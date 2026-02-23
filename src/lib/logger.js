/**
 * @file logger.js
 * @description Lightweight console logger for readable pipeline progress,
 * section headers, metrics, and final summaries.
 */

const WIDTH = 78;

/**
 * Pads or trims a string for aligned metric output.
 *
 * @param {string} value
 * @param {number} width
 * @returns {string}
 */
function pad(value, width) {
  return String(value).padEnd(width, ' ');
}

/**
 * Prints a horizontal divider.
 */
function divider() {
  console.log('─'.repeat(WIDTH));
}

/**
 * Prints a prominent section header.
 *
 * @param {string} title
 */
function section(title) {
  divider();
  console.log(title.toUpperCase());
  divider();
}

/**
 * Prints a smaller stage marker.
 *
 * @param {string} label
 */
function step(label) {
  console.log(`• ${label}`);
}

/**
 * Prints a single key/value metric line.
 *
 * @param {string} label
 * @param {string | number} value
 */
function metric(label, value) {
  console.log(`  ${pad(label, 30)} ${value}`);
}

/**
 * Prints a short list under a heading.
 *
 * @param {string} label
 * @param {string[]} items
 */
function list(label, items) {
  console.log(`  ${label}`);
  for (const item of items) {
    console.log(`    - ${item}`);
  }
}

/**
 * Prints a blank line for visual grouping.
 */
function blank() {
  console.log('');
}

/**
 * Formats a number for human-readable logging.
 *
 * @param {number | null | undefined} value
 * @param {number} [digits=3]
 * @returns {string}
 */
function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'n/a';
  }

  return Number(value).toFixed(digits);
}

module.exports = {
  blank,
  divider,
  formatNumber,
  list,
  metric,
  section,
  step,
};
