/**
 * @file build-dashboard.js
 * @description Builds a standalone HTML dashboard from the generated
 * station-analysis JSON so the dataset can be explored in a browser without a
 * backend.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./lib/logger');

const ROOT_DIR = path.resolve(__dirname, '..');
const INPUT_JSON_PATH = process.env.ANALYSIS_OUTPUT_PATH ?? path.join(ROOT_DIR, 'output', 'station-analysis.json');
const OUTPUT_HTML_PATH = process.env.DASHBOARD_OUTPUT_PATH ?? path.join(ROOT_DIR, 'output', 'dashboard.html');

/**
 * Reads and parses UTF-8 JSON from disk.
 *
 * @param {string} filePath
 * @returns {any}
 */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Ensures a directory exists before writing a file.
 *
 * @param {string} directoryPath
 */
function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

/**
 * Escapes JSON for safe inline embedding in HTML.
 *
 * @param {any} value
 * @returns {string}
