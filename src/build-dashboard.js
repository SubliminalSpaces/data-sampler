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
    .hero { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(260px, 0.75fr); gap: 18px; margin-bottom: 18px; }
    .panel { background: var(--panel); backdrop-filter: blur(18px); border: 1px solid var(--border); border-radius: 24px; box-shadow: var(--shadow); }
    .hero-copy { padding: 28px; }
    .eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-strong); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
    h1 { margin: 16px 0 10px; font-size: clamp(2rem, 4vw, 3.6rem); line-height: 1.05; letter-spacing: -0.04em; }
    p { margin: 0; color: var(--muted); line-height: 1.6; }
    .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
    .button, .toggle { appearance: none; border: 1px solid var(--border); background: var(--panel-strong); color: var(--text); border-radius: 999px; padding: 11px 16px; cursor: pointer; font: inherit; transition: transform 180ms ease, background 180ms ease, border-color 180ms ease; }
    .button:hover, .toggle:hover { transform: translateY(-1px); }
    .hero-meta { padding: 22px; display: grid; gap: 12px; align-content: start; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
    .stat-card { padding: 18px; }
    .stat-label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 10px; }
    .stat-value { font-size: clamp(1.3rem, 2vw, 2.1rem); font-weight: 700; letter-spacing: -0.04em; }
    .icon-wrap { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 12px; background: var(--accent-soft); color: var(--accent-strong); flex: 0 0 auto; }
    .icon-wrap svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .icon-inline { display: inline-flex; align-items: center; gap: 10px; }
    .layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 18px; }
    .sidebar { padding: 18px; position: sticky; top: 20px; height: calc(100vh - 40px); overflow: hidden; display: flex; flex-direction: column; }
    .sidebar h2, .content h2 { margin: 0 0 14px; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.08em; }
    .search { width: 100%; border: 1px solid var(--border); background: var(--input); color: var(--text); padding: 12px 14px; border-radius: 14px; font: inherit; outline: none; margin-bottom: 14px; }
    .control-grid { display: grid; gap: 10px; margin-bottom: 14px; }
    .control-select {
      width: 100%;
      border: 1px solid var(--border);
      background: var(--input);
      color: var(--text);
      padding: 11px 12px;
      border-radius: 14px;
      font: inherit;
      outline: none;
    }
    .station-list { overflow: auto; display: grid; gap: 10px; padding-right: 2px; }
    .station-button { width: 100%; text-align: left; border: 1px solid var(--border); background: transparent; color: var(--text); padding: 14px; border-radius: 16px; cursor: pointer; transition: background 160ms ease, border-color 160ms ease, transform 160ms ease; }
    .station-button:hover { transform: translateY(-1px); }
    .station-button.active { background: var(--accent-soft); border-color: rgba(30, 107, 92, 0.35); }
    .station-button strong { display: block; margin-bottom: 6px; font-size: 0.98rem; }
    .station-button small { display: flex; justify-content: space-between; gap: 10px; color: var(--muted); }
    .content { display: grid; gap: 18px; }
    .section-card { padding: 22px; }
    .section-head { display: flex; justify-content: space-between; gap: 16px; align-items: start; margin-bottom: 18px; }
    .section-head h3 { margin: 0; font-size: clamp(1.2rem, 1.8vw, 1.8rem); letter-spacing: -0.03em; }
    .muted { color: var(--muted); }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .chip { padding: 7px 10px; border-radius: 999px; background: var(--chip); color: var(--text); font-size: 12px; }
    .controls-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }
    .controls-row.dev {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .tab-bar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
    .tab-button { appearance: none; border: 1px solid var(--border); background: transparent; color: var(--muted); border-radius: 999px; padding: 10px 14px; cursor: pointer; font: inherit; display: inline-flex; align-items: center; gap: 10px; transition: background 180ms ease, color 180ms ease, transform 180ms ease; }
    .tab-button:hover { transform: translateY(-1px); color: var(--text); }
    .tab-button.active { background: var(--accent-soft); color: var(--accent-strong); border-color: rgba(30, 107, 92, 0.28); }
    .tab-panel { display: none; gap: 18px; }
    .tab-panel.active { display: grid; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric-tile { padding: 16px; border-radius: 18px; background: var(--chip); border: 1px solid var(--border); }
    .metric-tile .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 8px; }
    .metric-tile .value { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.04em; }
    .dual-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .stack { display: grid; gap: 12px; }
    .bar-list { display: grid; gap: 10px; }
    .bar-row { display: grid; gap: 6px; }
    .bar-meta { display: flex; justify-content: space-between; gap: 12px; font-size: 0.94rem; }
    .bar-track { width: 100%; height: 10px; border-radius: 999px; background: var(--chip); overflow: hidden; }
    .bar-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), var(--accent-strong)); }
    .table-wrap { overflow: auto; border-radius: 18px; border: 1px solid var(--border); }
    table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
    th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
    tbody tr:nth-child(even) { background: var(--table-stripe); }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: var(--chip); font-size: 12px; }
    .positive { color: var(--positive); }
    .negative { color: var(--negative); }
    .warning { color: var(--warning); }
    .stimuli-grid { display: grid; gap: 14px; }
    .stimulus-card { border: 1px solid var(--border); border-radius: 18px; padding: 18px; background: var(--chip); }
    .stimulus-header { display: flex; justify-content: space-between; gap: 14px; align-items: start; margin-bottom: 12px; }
    .stimulus-header h4 { margin: 0; font-size: 1rem; }
    .mini-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 12px 0; }
    .mini { padding: 12px; border: 1px solid var(--border); border-radius: 14px; background: rgba(255,255,255,0.04); }
    .mini .k { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 4px; }
    .mini .v { font-size: 1.08rem; font-weight: 700; }
    .footer-note { margin-top: 18px; color: var(--muted); font-size: 0.92rem; }
    .command-box {
      width: 100%;
      border: 1px solid var(--border);
      background: var(--input);
      color: var(--text);
      padding: 12px 14px;
      border-radius: 16px;
      font: inherit;
      outline: none;
      margin-bottom: 10px;
    }
    .helper-text {
      color: var(--muted);
      font-size: 0.92rem;
      line-height: 1.5;
      margin-bottom: 16px;
    }
    .mono { font-family: "Cascadia Code", "Consolas", monospace; }
    @media (max-width: 1160px) { .hero, .layout, .dual-grid { grid-template-columns: 1fr; } .sidebar { position: static; height: auto; } }
    @media (max-width: 860px) { .shell { padding: 16px; } .stat-grid, .metric-grid, .mini-grid, .controls-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 560px) { .stat-grid, .metric-grid, .mini-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div class="panel hero-copy">
        <div class="eyebrow">
          <span class="icon-inline">
            <span class="icon-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h3l3-8 4 16 3-8h5"/></svg>
            </span>
            <span>Subliminal Spaces · Phase I Dashboard</span>
          </span>
        </div>
        <h1>Readable station analytics for a sensory subway study.</h1>
        <p>
          This standalone dashboard visualizes the full contents of
          <code>station-analysis.json</code>, including SIS, satisfaction, affect
          normalization, demographics, and station/stimulus drilldowns.
        </p>
        <div class="hero-actions">
          <button class="button" id="jump-to-stations">Jump To Stations</button>
          <button class="toggle" id="theme-toggle" aria-label="Toggle color mode">Toggle Theme</button>
        </div>
      </div>
      <div class="panel hero-meta">
        <div><div class="stat-label">Generated</div><div id="generated-at" class="muted"></div></div>
        <div><div class="stat-label">Runtime</div><div id="runtime" class="muted"></div></div>
        <div><div class="stat-label">Scoring</div><div class="muted">SIS, Phase I stress proxy, satisfaction score</div></div>
        <div><div class="stat-label">Display Mode</div><div class="muted">Standalone HTML with embedded analysis data</div></div>
      </div>
    </section>

    <section id="summary-cards" class="stat-grid"></section>

    <main class="layout" id="stations-anchor">
      <aside class="panel sidebar">
        <h2>Stations</h2>
        <input id="station-search" class="search" type="search" placeholder="Search station or line group" />
        <div class="control-grid">
          <select id="station-sort" class="control-select">
            <option value="name_asc">Sort stations: Name A-Z</option>
            <option value="name_desc">Sort stations: Name Z-A</option>
            <option value="sis_desc">Sort stations: Highest SIS</option>
            <option value="sis_asc">Sort stations: Lowest SIS</option>
            <option value="satisfaction_desc">Sort stations: Highest satisfaction</option>
            <option value="responses_desc">Sort stations: Most responses</option>
          </select>
          <select id="station-type-filter" class="control-select">
            <option value="all">Filter stations: All modalities</option>
            <option value="image">Image stations only</option>
            <option value="audio">Audio stations only</option>
            <option value="mixed">Mixed modality stations</option>
          </select>
        </div>
        <div id="station-list" class="station-list"></div>
      </aside>

      <section class="content">
        <div class="panel section-card">
          <div class="section-head">
            <div>
              <h3 id="station-title"></h3>
              <p id="station-subtitle" class="muted"></p>
              <div id="station-chips" class="chips"></div>
            </div>
            <div id="station-health"></div>
          </div>
          <div id="station-metrics" class="metric-grid"></div>
        </div>

        <div class="panel section-card">
          <div class="tab-bar">
            <button class="tab-button active" data-tab="overview">
              <span class="icon-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg></span>
              <span>Overview</span>
            </button>
            <button class="tab-button" data-tab="demographics">
              <span class="icon-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
              <span>Demographics</span>
            </button>
            <button class="tab-button" data-tab="stimuli">
              <span class="icon-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 18v3"/></svg></span>
              <span>Stimuli</span>
            </button>
            <button class="tab-button" data-tab="stations-table">
              <span class="icon-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg></span>
              <span>Comparison</span>
            </button>
            <button class="tab-button" data-tab="dev-mode">
              <span class="icon-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9l-5 3 5 3"/><path d="M16 9l5 3-5 3"/><path d="M14 4l-4 16"/></svg></span>
              <span>Dev Mode</span>
            </button>
          </div>

          <div id="tab-overview" class="tab-panel active">
            <div class="dual-grid">
              <div class="panel section-card">
                <div class="section-head"><div><h3>Global Signals</h3><p class="muted">Dataset-wide emotion, topic, and modality patterns.</p></div></div>
                <div class="stack">
                  <div><h2>Top Emotions</h2><div id="global-emotions" class="bar-list"></div></div>
                  <div><h2>Top Topics</h2><div id="global-topics" class="bar-list"></div></div>
                  <div><h2>Modalities</h2><div id="global-modalities" class="bar-list"></div></div>
                </div>
              </div>

              <div class="panel section-card">
                <div class="section-head"><div><h3>Station Profile</h3><p class="muted">Distributional summaries for the selected station.</p></div></div>
                <div class="stack">
                  <div><h2>Top Emotions</h2><div id="station-emotions" class="bar-list"></div></div>
                  <div><h2>Top Topics</h2><div id="station-topics" class="bar-list"></div></div>
                  <div><h2>Data Quality</h2><div id="station-quality" class="chips"></div></div>
                </div>
              </div>
            </div>
          </div>

          <div id="tab-demographics" class="tab-panel">
            <div class="panel section-card">
              <div class="section-head"><div><h3>Demographics</h3><p class="muted">Participant-side audit summaries for the selected station.</p></div></div>
              <div class="dual-grid">
                <div id="demographics-left" class="stack"></div>
                <div id="demographics-right" class="stack"></div>
              </div>
