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
