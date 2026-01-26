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
