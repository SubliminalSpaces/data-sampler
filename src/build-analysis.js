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
