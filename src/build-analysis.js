/**
 * @file build-analysis.js
 * @description Reads the Qualtrics Phase I export and station-stimulus mapping,
 * normalizes affect text with local NLP, computes stimulus/station aggregates,
 * and writes a research-ready JSON artifact for downstream modeling.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { analyzeAffect, normalizeEncoding } = require('./lib/nlp');
const logger = require('./lib/logger');

const ROOT_DIR = path.resolve(__dirname, '..');
const INPUTS = {
  stationsPath: process.env.STATIONS_JSON_PATH ?? 'C:/Users/Xander/Desktop/SubliminalSpaces/stations.json',
  csvPath: process.env.QUALTRICS_CSV_PATH ?? 'C:/Users/Xander/Downloads/export_2026-04-13_14-17-03.csv',
  legacyResultsPath: process.env.LEGACY_RESULTS_JSON_PATH ?? 'C:/Users/Xander/Desktop/SubliminalSpaces/results.json',
  outputPath: process.env.ANALYSIS_OUTPUT_PATH ?? path.join(ROOT_DIR, 'output', 'station-analysis.json'),
};

/**
 * Research-facing scoring constants used for Phase I aggregation.
 *
 * @type {Readonly<{
 *   sis: {stress: number, comfort: number, safety: number},
 *   satisfaction: {comfort: number, safety: number, affect: number},
 *   phase1Stress: {negativeAffect: number, arousal: number}
 * }>}
 */
const SCORE_WEIGHTS = Object.freeze({
  sis: {
    stress: 1,
    comfort: 1,
    safety: 1,
  },
  satisfaction: {
    comfort: 0.4,
    safety: 0.4,
    affect: 0.2,
  },
  phase1Stress: {
    negativeAffect: 0.65,
    arousal: 0.35,
  },
});

/**
 * Parses JSON from disk with UTF-8 decoding.
 *
 * @param {string} filePath
 * @returns {any}
 */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Reads the Qualtrics CSV export into plain objects.
 *
 * @param {string} filePath
 * @returns {Record<string, string>[]}
 */
function readCsv(filePath) {
  const rawCsv = fs.readFileSync(filePath, 'utf8');
  return parse(rawCsv, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
}

/**
 * Ensures a directory exists before file output.
 *
 * @param {string} directoryPath
 */
function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

/**
 * Parses station display names into stable metadata fields.
 *
 * @param {string} stationName
 * @returns {{complexName: string, lineGroup: string | null}}
 */
function parseStationDisplayName(stationName) {
  const cleaned = normalizeEncoding(stationName).replace(/\s+-\s+/g, ' — ');
  const segments = cleaned.split(/\s+—\s+/);

  return {
    complexName: segments[0]?.trim() ?? cleaned,
    lineGroup: segments[1]?.trim() ?? null,
  };
}

/**
 * Builds a stable station key for JSON consumers.
 *
 * @param {string} stationName
 * @returns {string}
 */
function buildStationKey(stationName) {
  return normalizeEncoding(stationName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parses a number-like CSV cell into a finite number or null.
 *
 * @param {string | number | null | undefined} value
 * @returns {number | null}
 */
function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Parses Qualtrics date cells, which may be ISO-like text or Excel serial
 * numbers depending on the export settings.
 *
 * @param {string} value
 * @returns {string | null}
 */
function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const excelEpochMs = Date.UTC(1899, 11, 30);
    const millis = excelEpochMs + numeric * 24 * 60 * 60 * 1000;
    return new Date(millis).toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Calculates descriptive statistics for numeric arrays.
 *
 * @param {number[]} values
 * @returns {{
 *   count: number,
 *   min: number | null,
 *   max: number | null,
 *   average: number | null,
 *   median: number | null,
 *   standardDeviation: number | null,
 *   range: number | null,
 *   histogram7: Record<string, number>
 * }}
 */
function calculateStats(values) {
  if (values.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      average: null,
      median: null,
      standardDeviation: null,
      range: null,
      histogram7: {},
    };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance = sorted.reduce((sum, value) => sum + (value - average) ** 2, 0) / sorted.length;
  const midpoint = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];

  const histogram7 = sorted.reduce((accumulator, value) => {
    const key = String(value);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    average,
    median,
    standardDeviation: Math.sqrt(variance),
    range: sorted[sorted.length - 1] - sorted[0],
    histogram7,
  };
}

/**
 * Counts categorical values on either a response-weighted or participant-weighted basis.
 *
 * @param {Array<Record<string, any>>} items
 * @param {string} field
 * @returns {Array<{label: string, count: number}>}
 */
function countByField(items, field) {
  const counts = new Map();

  for (const item of items) {
    const rawValue = item[field];
    if (!rawValue) {
      continue;
    }

    const parts = String(rawValue)
      .split(',')
      .map((part) => normalizeEncoding(part).trim())
      .filter(Boolean);

    for (const part of parts) {
      counts.set(part, (counts.get(part) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

/**
 * Summarizes emotion or topic labels across exposures.
 *
 * @param {Array<Record<string, any>>} exposures
 * @param {'emotionLabels' | 'topicLabels'} labelField
 * @returns {Array<{id: string, label: string, count: number, responseShare: number, averageValence?: number}>}
 */
function summarizeLabels(exposures, labelField) {
  const totals = new Map();
  const exposureCount = exposures.length || 1;

  for (const exposure of exposures) {
    for (const label of exposure.affect[labelField]) {
      const previous = totals.get(label.id) ?? {
        id: label.id,
        label: label.label,
        count: 0,
        valenceTotal: 0,
        valenceHits: 0,
      };

      previous.count += label.count;
      if (typeof label.valence === 'number') {
        previous.valenceTotal += label.valence * label.count;
        previous.valenceHits += label.count;
      }

      totals.set(label.id, previous);
    }
  }

  return [...totals.values()]
    .map((item) => ({
      id: item.id,
      label: item.label,
      count: item.count,
      responseShare: item.count / exposureCount,
      averageValence: item.valenceHits > 0 ? item.valenceTotal / item.valenceHits : undefined,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

/**
 * Calculates a simple percentile bootstrap confidence interval around a mean.
 *
 * @param {number[]} values
 * @param {number} [iterations=400]
 * @returns {{lower: number | null, upper: number | null}}
 */
function bootstrapMeanInterval(values, iterations = 400) {
  if (values.length < 2) {
    return { lower: null, upper: null };
  }

  const means = [];
  for (let index = 0; index < iterations; index += 1) {
    let total = 0;
    for (let sample = 0; sample < values.length; sample += 1) {
      total += values[Math.floor(Math.random() * values.length)];
    }
    means.push(total / values.length);
  }

  means.sort((left, right) => left - right);

  return {
    lower: means[Math.floor(iterations * 0.025)] ?? null,
    upper: means[Math.floor(iterations * 0.975)] ?? null,
  };
}

/**
 * Maps an affect valence value from [-1, 1] to [0, 1].
 *
 * @param {number} valence
 * @returns {number}
 */
function normalizeValence(valence) {
  return Math.max(0, Math.min(1, (valence + 1) / 2));
}

/**
 * Computes a Phase I-only stress proxy from text-derived affect so comfort and
 * safety are not double-counted before SIS is applied.
 *
 * @param {{valence: number, arousal: number}} affect
 * @returns {number}
 */
function computePhase1StressProxy(affect) {
  const negativeAffect = 1 - normalizeValence(affect.valence);
  return (
    SCORE_WEIGHTS.phase1Stress.negativeAffect * negativeAffect +
    SCORE_WEIGHTS.phase1Stress.arousal * affect.arousal
  );
}

/**
 * Computes a bounded satisfaction score for one exposure.
 *
 * @param {{comfort: number, safety: number, valence: number}} input
 * @returns {number}
 */
function computeSatisfactionScore(input) {
  const comfortNorm = (input.comfort - 1) / 6;
  const safetyNorm = (input.safety - 1) / 6;
  const affectNorm = normalizeValence(input.valence);

  return (
    SCORE_WEIGHTS.satisfaction.comfort * comfortNorm +
    SCORE_WEIGHTS.satisfaction.safety * safetyNorm +
    SCORE_WEIGHTS.satisfaction.affect * affectNorm
  );
}

/**
 * Converts an array of numeric values into z-scores, guarding against a zero
 * standard deviation by returning zeros.
 *
 * @param {number[]} values
 * @returns {number[]}
 */
function zScore(values) {
  if (values.length === 0) {
    return [];
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const standardDeviation = Math.sqrt(variance);

  if (standardDeviation === 0) {
    return values.map(() => 0);
  }

  return values.map((value) => (value - mean) / standardDeviation);
}

/**
 * Adds SIS scores in-place to a homogeneous collection of summaries.
 *
 * @param {Array<Record<string, any>>} summaries
 */
function attachSubliminalIndexScores(summaries) {
  const stressValues = summaries.map((summary) => summary.aggregateMetrics.phase1Stress.average ?? 0);
  const comfortValues = summaries.map((summary) => summary.aggregateMetrics.comfort.average ?? 0);
  const safetyValues = summaries.map((summary) => summary.aggregateMetrics.safety.average ?? 0);

  const stressZ = zScore(stressValues);
  const comfortZ = zScore(comfortValues);
  const safetyZ = zScore(safetyValues);

  summaries.forEach((summary, index) => {
    const sisValue =
      SCORE_WEIGHTS.sis.stress * stressZ[index] -
      SCORE_WEIGHTS.sis.comfort * comfortZ[index] -
      SCORE_WEIGHTS.sis.safety * safetyZ[index];

    summary.aggregateMetrics.subliminalIndexScore = {
      value: sisValue,
      zComponents: {
        stress: stressZ[index],
        comfort: comfortZ[index],
        safety: safetyZ[index],
      },
    };
  });
}

/**
 * Creates a compact summary object for a stimulus or station.
 *
 * @param {Array<Record<string, any>>} exposures
 * @param {Record<string, any>} metadata
 * @returns {Record<string, any>}
 */
function buildAggregateSummary(exposures, metadata) {
  const comfortValues = exposures.map((item) => item.comfort);
  const safetyValues = exposures.map((item) => item.safety);
  const valenceValues = exposures.map((item) => item.affect.valence);
  const arousalValues = exposures.map((item) => item.affect.arousal);
  const phase1StressValues = exposures.map((item) => item.phase1StressProxy);
  const satisfactionValues = exposures.map((item) => item.satisfactionScore);
  const participants = [...new Map(exposures.map((item) => [item.participantId, item.participant])).values()];
  const emotionSummary = summarizeLabels(exposures, 'emotionLabels');
  const topicSummary = summarizeLabels(exposures, 'topicLabels');

  return {
    ...metadata,
    responseCount: exposures.length,
    participantCount: new Set(participants.map((item) => item.participantId)).size,
    aggregateMetrics: {
      comfort: {
        ...calculateStats(comfortValues),
        confidenceInterval95: bootstrapMeanInterval(comfortValues),
      },
      safety: {
        ...calculateStats(safetyValues),
        confidenceInterval95: bootstrapMeanInterval(safetyValues),
      },
      affectValence: {
        ...calculateStats(valenceValues),
        confidenceInterval95: bootstrapMeanInterval(valenceValues),
      },
      affectArousal: {
        ...calculateStats(arousalValues),
        confidenceInterval95: bootstrapMeanInterval(arousalValues),
      },
      phase1Stress: {
        ...calculateStats(phase1StressValues),
        confidenceInterval95: bootstrapMeanInterval(phase1StressValues),
      },
      satisfactionScore: {
        ...calculateStats(satisfactionValues),
        confidenceInterval95: bootstrapMeanInterval(satisfactionValues),
      },
    },
    topEmotions: emotionSummary.slice(0, 5),
    topTopics: topicSummary.slice(0, 5),
    mostPositiveEmotion: emotionSummary
      .filter((item) => typeof item.averageValence === 'number')
      .sort((left, right) => (right.averageValence ?? -Infinity) - (left.averageValence ?? -Infinity))[0] ?? null,
    mostNegativeEmotion: emotionSummary
      .filter((item) => typeof item.averageValence === 'number')
      .sort((left, right) => (left.averageValence ?? Infinity) - (right.averageValence ?? Infinity))[0] ?? null,
    participantProfile: {
      ageGroups: countByField(participants, 'ageGroup'),
      genders: countByField(participants, 'gender'),
      ethnicities: countByField(participants, 'ethnicity'),
      subwayFrequency: countByField(participants, 'frequency'),
      boroughs: countByField(participants, 'borough'),
    },
    dataQuality: {
      uncategorizedAffectResponses: exposures.filter((item) => item.affect.uncategorized).length,
      emptyAffectResponses: exposures.filter((item) => item.affect.filteredTokens.length === 0).length,
      averageAffectTokenCount:
        exposures.reduce((sum, item) => sum + item.affect.filteredTokens.length, 0) / (exposures.length || 1),
    },
  };
}

/**
 * Main entry point for the JSON build.
 */
function main() {
  logger.section('Subliminal Spaces Phase I Analysis');
  logger.step('Loading source files');
  logger.metric('Stations mapping', INPUTS.stationsPath);
  logger.metric('Qualtrics CSV', INPUTS.csvPath);
  logger.metric('Legacy JSON', INPUTS.legacyResultsPath);
  logger.metric('Output JSON', INPUTS.outputPath);
  logger.blank();

  const stimulusMappings = readJson(INPUTS.stationsPath).map((row) => ({
    stimulusId: String(row.id),
    stationName: normalizeEncoding(row.name),
  }));
  const legacyResults = readJson(INPUTS.legacyResultsPath);
  const csvRows = readCsv(INPUTS.csvPath);
  const stimulusToStation = new Map(stimulusMappings.map((row) => [row.stimulusId, row.stationName]));

  logger.section('Input Summary');
  logger.metric('Stimulus mappings loaded', stimulusMappings.length);
  logger.metric('CSV rows loaded', csvRows.length);
  logger.metric('Legacy responses', legacyResults.totalResponses ?? 'n/a');
  logger.metric('Legacy stations', legacyResults.totalStations ?? 'n/a');
  logger.blank();

  const exposures = csvRows
    .map((row) => {
      const stimulusId = String(row['Stimulus ID'] ?? '').trim();
      const comfort = toNumber(row.Comfort);
      const safety = toNumber(row.Safety);

      if (!stimulusId || comfort === null || safety === null) {
        return null;
      }

      const affect = analyzeAffect(row.Feelings ?? '');
      const stationName = stimulusToStation.get(stimulusId) ?? 'Unknown Station';
      const stationDisplay = parseStationDisplayName(stationName);
      const participantId = String(row['Response ID'] ?? '').trim();
      const participant = {
        participantId,
        ageGroup: normalizeEncoding(row['Age Group'] ?? ''),
        gender: normalizeEncoding(row.Gender ?? ''),
        ethnicity: normalizeEncoding(row['Ethnicity / Race'] ?? ''),
        frequency: normalizeEncoding(row.Frequency ?? ''),
        borough: normalizeEncoding(row.Borough ?? ''),
      };

      return {
        responseId: `${participantId}:${stimulusId}:${row['Loop #'] ?? 'na'}`,
        participant,
        participantId,
        stationKey: buildStationKey(stationName),
        stationName,
        stationMetadata: {
          complexName: stationDisplay.complexName,
          lineGroup: stationDisplay.lineGroup,
        },
        stimulusId,
        stimulusType: normalizeEncoding(row['Stimulus Type'] ?? 'unknown').toLowerCase(),
        loopIndex: toNumber(row['Loop #']),
        stimuliPerSession: toNumber(row['Total #']),
        responseLinkPresent: Boolean(row['Response Link']),
        comfort,
        safety,
        affect,
        phase1StressProxy: computePhase1StressProxy(affect),
        satisfactionScore: computeSatisfactionScore({
          comfort,
          safety,
          valence: affect.valence,
        }),
        timings: {
          startDate: normalizeDate(row['Start Date']),
          endDate: normalizeDate(row['End Date']),
        },
      };
    })
    .filter(Boolean);

  const uncategorizedExposureCount = exposures.filter((item) => item.affect.uncategorized).length;
  const audioExposureCount = exposures.filter((item) => item.stimulusType === 'audio').length;
  const imageExposureCount = exposures.filter((item) => item.stimulusType === 'image').length;

  logger.section('Exposure Processing');
  logger.metric('Valid exposures', exposures.length);
  logger.metric('Unique participants', new Set(exposures.map((item) => item.participantId)).size);
  logger.metric('Unique stimuli observed', new Set(exposures.map((item) => item.stimulusId)).size);
  logger.metric('Unique stations observed', new Set(exposures.map((item) => item.stationKey)).size);
  logger.metric('Image exposures', imageExposureCount);
  logger.metric('Audio exposures', audioExposureCount);
  logger.metric('Uncategorized affect rows', uncategorizedExposureCount);
  logger.blank();

  const stationGroups = new Map();
  const stimulusGroups = new Map();

  for (const exposure of exposures) {
    if (!stationGroups.has(exposure.stationKey)) {
      stationGroups.set(exposure.stationKey, []);
    }
    stationGroups.get(exposure.stationKey).push(exposure);

    if (!stimulusGroups.has(exposure.stimulusId)) {
      stimulusGroups.set(exposure.stimulusId, []);
    }
    stimulusGroups.get(exposure.stimulusId).push(exposure);
  }

  const stimulusSummaries = [...stimulusGroups.entries()]
    .map(([stimulusId, groupedExposures]) => buildAggregateSummary(groupedExposures, {
      stimulusId,
      stationKey: groupedExposures[0].stationKey,
      stationName: groupedExposures[0].stationName,
      stimulusTypes: [...new Set(groupedExposures.map((item) => item.stimulusType))],
      exposures: groupedExposures.map((exposure) => ({
        responseId: exposure.responseId,
        participantId: exposure.participantId,
        stimulusId: exposure.stimulusId,
        stimulusType: exposure.stimulusType,
        comfort: exposure.comfort,
        safety: exposure.safety,
        satisfactionScore: exposure.satisfactionScore,
        phase1StressProxy: exposure.phase1StressProxy,
        feelings: {
          rawText: exposure.affect.rawText,
          normalizedText: exposure.affect.normalizedText,
          emotionLabels: exposure.affect.emotionLabels,
          topicLabels: exposure.affect.topicLabels,
          valence: exposure.affect.valence,
          arousal: exposure.affect.arousal,
          polarity: exposure.affect.affectPolarity,
        },
        participant: exposure.participant,
        timings: exposure.timings,
      })),
    }))
    .sort((left, right) => Number(left.stimulusId) - Number(right.stimulusId));

  attachSubliminalIndexScores(stimulusSummaries);

  logger.section('Stimulus Aggregation');
  logger.metric('Stimulus summaries built', stimulusSummaries.length);
  logger.metric(
    'Mean stimulus satisfaction',
    logger.formatNumber(
      stimulusSummaries.reduce((sum, item) => sum + (item.aggregateMetrics.satisfactionScore.average ?? 0), 0) /
        (stimulusSummaries.length || 1),
    ),
  );
  logger.metric(
    'Mean stimulus Phase I stress',
    logger.formatNumber(
      stimulusSummaries.reduce((sum, item) => sum + (item.aggregateMetrics.phase1Stress.average ?? 0), 0) /
        (stimulusSummaries.length || 1),
    ),
  );
  logger.blank();

  const stimulusSummaryById = new Map(stimulusSummaries.map((item) => [item.stimulusId, item]));

  const stationSummaries = [...stationGroups.entries()]
    .map(([stationKey, groupedExposures]) => {
      const firstExposure = groupedExposures[0];
      return buildAggregateSummary(groupedExposures, {
        stationKey,
        stationName: firstExposure.stationName,
        stationMetadata: {
          ...firstExposure.stationMetadata,
          stimulusIds: [...new Set(groupedExposures.map((item) => item.stimulusId))].sort((left, right) => Number(left) - Number(right)),
          stimulusTypes: [...new Set(groupedExposures.map((item) => item.stimulusType))].sort(),
        },
        stimuli: [...new Set(groupedExposures.map((item) => item.stimulusId))]
          .sort((left, right) => Number(left) - Number(right))
          .map((stimulusId) => stimulusSummaryById.get(stimulusId)),
      });
    })
    .sort((left, right) => left.stationName.localeCompare(right.stationName));

  attachSubliminalIndexScores(stationSummaries);

  logger.section('Station Aggregation');
  logger.metric('Station summaries built', stationSummaries.length);
  logger.metric(
    'Mean station satisfaction',
    logger.formatNumber(
      stationSummaries.reduce((sum, item) => sum + (item.aggregateMetrics.satisfactionScore.average ?? 0), 0) /
        (stationSummaries.length || 1),
    ),
  );
  logger.metric(
    'Mean station SIS',
    logger.formatNumber(
      stationSummaries.reduce((sum, item) => sum + (item.aggregateMetrics.subliminalIndexScore.value ?? 0), 0) /
        (stationSummaries.length || 1),
    ),
  );
  logger.blank();

  const allParticipants = [...new Map(exposures.map((item) => [item.participantId, item.participant])).values()];
  const globalEmotionSummary = summarizeLabels(exposures, 'emotionLabels');
  const globalTopicSummary = summarizeLabels(exposures, 'topicLabels');

  const output = {
    metadata: {
      generatedAt: new Date().toISOString(),
      project: 'Subliminal Spaces',
      phase: 'Phase I',
      runtime: `Node ${process.version}`,
      sourceFiles: INPUTS,
      recordCounts: {
        csvRows: csvRows.length,
        validExposures: exposures.length,
        uniqueParticipants: allParticipants.length,
        uniqueStimuli: stimulusSummaries.length,
        uniqueStations: stationSummaries.length,
      },
      scoring: {
        sisEquation: 'SIS_s = w1 * Z(Stress_s) - w2 * Z(Comfort_s) - w3 * Z(Safety_s)',
        sisWeights: SCORE_WEIGHTS.sis,
        phase1StressProxyEquation: 'StressPhase1_e = 0.65 * (1 - normalized_valence_e) + 0.35 * arousal_e',
        satisfactionEquation: 'Satisfaction_e = 0.4 * comfort_norm_e + 0.4 * safety_norm_e + 0.2 * affect_valence_norm_e',
        notes: [
          'Phase I has no physiological measurements, so stress is proxied from local NLP affect signals only.',
          'SIS weights are left at 1.0 until calibrated against Phase II physiology or model tuning.',
          'Demographics are summarized for auditing and subgroup research, not used as predictive features.',
        ],
      },
      legacyComparison: {
        legacyTotalResponses: legacyResults.totalResponses ?? null,
        legacyTotalStations: legacyResults.totalStations ?? null,
      },
    },
    globalSummary: {
      topEmotions: globalEmotionSummary.slice(0, 10),
      topTopics: globalTopicSummary.slice(0, 10),
      demographics: {
        ageGroups: countByField(allParticipants, 'ageGroup'),
        genders: countByField(allParticipants, 'gender'),
        ethnicities: countByField(allParticipants, 'ethnicity'),
        subwayFrequency: countByField(allParticipants, 'frequency'),
        boroughs: countByField(allParticipants, 'borough'),
      },
      modalityBreakdown: countByField(exposures, 'stimulusType'),
      satisfactionScore: calculateStats(exposures.map((item) => item.satisfactionScore)),
      phase1Stress: calculateStats(exposures.map((item) => item.phase1StressProxy)),
      uncategorizedAffectResponses: exposures.filter((item) => item.affect.uncategorized).length,
    },
    stations: stationSummaries,
  };

  ensureDirectory(path.dirname(INPUTS.outputPath));
  fs.writeFileSync(INPUTS.outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  logger.section('Top Signals');
  logger.list(
    'Top emotions',
    globalEmotionSummary.slice(0, 5).map((item) => `${item.label} (${item.count})`),
  );
  logger.list(
    'Top topics',
    globalTopicSummary.slice(0, 5).map((item) => `${item.label} (${item.count})`),
  );
  logger.list(
    'Stations by highest SIS',
    [...stationSummaries]
      .sort((left, right) => right.aggregateMetrics.subliminalIndexScore.value - left.aggregateMetrics.subliminalIndexScore.value)
      .slice(0, 3)
      .map((item) => `${item.stationName} (${logger.formatNumber(item.aggregateMetrics.subliminalIndexScore.value)})`),
  );
  logger.list(
    'Stations by highest satisfaction',
    [...stationSummaries]
      .sort((left, right) => right.aggregateMetrics.satisfactionScore.average - left.aggregateMetrics.satisfactionScore.average)
      .slice(0, 3)
      .map((item) => `${item.stationName} (${logger.formatNumber(item.aggregateMetrics.satisfactionScore.average)})`),
  );
  logger.blank();

  logger.section('Build Complete');
  logger.metric('Analysis JSON written', INPUTS.outputPath);
  logger.metric('Stations exported', stationSummaries.length);
  logger.metric('Stimuli exported', stimulusSummaries.length);
  logger.metric('Exposures exported', exposures.length);
  logger.metric('Participants represented', allParticipants.length);
}

main();
