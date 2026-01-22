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
