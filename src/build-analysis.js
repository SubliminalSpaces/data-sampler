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
