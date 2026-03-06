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
 */
function serializeForHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Builds the standalone HTML dashboard document.
 *
 * @param {any} analysis
 * @returns {string}
 */
function buildHtml(analysis) {
  const embeddedData = serializeForHtml(analysis);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Subliminal Spaces Dashboard</title>
  <style>
    :root {
      --bg: #f4f1ea;
      --bg-accent: radial-gradient(circle at top left, rgba(183, 214, 194, 0.35), transparent 35%), radial-gradient(circle at top right, rgba(236, 211, 186, 0.45), transparent 28%), linear-gradient(180deg, #f7f3ec 0%, #f0ebe4 100%);
      --panel: rgba(255, 252, 247, 0.84);
      --panel-strong: rgba(255, 252, 247, 0.94);
      --border: rgba(74, 68, 57, 0.12);
      --text: #201d18;
      --muted: #666052;
      --accent: #1e6b5c;
      --accent-soft: rgba(30, 107, 92, 0.12);
      --accent-strong: #0f4e42;
      --shadow: 0 18px 48px rgba(52, 46, 36, 0.12);
      --positive: #2b7a4b;
      --negative: #a44d3f;
      --warning: #986b17;
      --chip: rgba(32, 29, 24, 0.06);
      --input: rgba(255, 255, 255, 0.9);
      --table-stripe: rgba(32, 29, 24, 0.03);
    }

    body.dark {
      --bg: #171a1f;
      --bg-accent: radial-gradient(circle at top left, rgba(52, 98, 89, 0.35), transparent 32%), radial-gradient(circle at top right, rgba(102, 75, 44, 0.3), transparent 26%), linear-gradient(180deg, #15181d 0%, #101318 100%);
      --panel: rgba(28, 32, 39, 0.82);
      --panel-strong: rgba(24, 28, 34, 0.96);
      --border: rgba(235, 228, 215, 0.08);
      --text: #efe8da;
      --muted: #b3ab9d;
      --accent: #7bc1af;
      --accent-soft: rgba(123, 193, 175, 0.14);
      --accent-strong: #a5dfd1;
      --shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
      --positive: #91d18d;
      --negative: #f19885;
      --warning: #e2c27a;
      --chip: rgba(255, 255, 255, 0.08);
      --input: rgba(17, 20, 26, 0.86);
      --table-stripe: rgba(255, 255, 255, 0.03);
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg-accent); color: var(--text); font-family: "Segoe UI", "Aptos", "Helvetica Neue", sans-serif; }
    body { transition: background 220ms ease, color 220ms ease; }
    .shell { max-width: 1500px; margin: 0 auto; padding: 28px; }
