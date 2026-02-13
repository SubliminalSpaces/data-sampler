/**
 * @file nlp.js
 * @description Local NLP helpers for turning short survey text into normalized
 * emotions, topics, valence, arousal, and quality diagnostics.
 */

const natural = require('natural');
const { removeStopwords } = require('stopword');
const { EMOTION_TAXONOMY, TOPIC_TAXONOMY } = require('./emotion-taxonomy');

const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;
const sentimentAnalyzer = new natural.SentimentAnalyzer('English', stemmer, 'afinn');

const MOJIBAKE_REPLACEMENTS = new Map([
  ['â€™', "'"],
  ['â€œ', '"'],
  ['â€\u009d', '"'],
  ['â€“', '-'],
  ['â€”', ' - '],
  ['â€¦', '...'],
  ['Â', ''],
]);

const EXTRA_STOPWORDS = [
  'feel',
  'feels',
  'feeling',
  'place',
  'space',
  'like',
  'bit',
  'really',
  'very',
  'subway',
  'station',
  'there',
  'here',
  'am',
  'im',
  'its',
  'this',
];

/**
 * Creates a fast lookup structure for lexicon matching.
 *
 * @param {ReadonlyArray<{id: string, keywords: string[], phrases?: string[]}>} taxonomy
 * @returns {Map<string, {id: string, matchedBy: string}>}
 */
function buildStemLookup(taxonomy) {
  const lookup = new Map();

  for (const entry of taxonomy) {
    for (const keyword of entry.keywords) {
      lookup.set(stemmer.stem(keyword.toLowerCase()), {
        id: entry.id,
        matchedBy: keyword.toLowerCase(),
      });
    }
  }

  return lookup;
}

const emotionStemLookup = buildStemLookup(EMOTION_TAXONOMY);
const topicStemLookup = buildStemLookup(TOPIC_TAXONOMY);

/**
 * Replaces common mojibake artifacts observed in CSV and JSON exports.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeEncoding(value) {
  let normalized = String(value ?? '');

  for (const [broken, fixed] of MOJIBAKE_REPLACEMENTS.entries()) {
    normalized = normalized.split(broken).join(fixed);
  }

  return normalized;
}

/**
 * Normalizes arbitrary free-text into a lower-noise form suitable for lexicon
 * and sentiment analysis.
 *
 * @param {string} value
 * @returns {string}
 */
function cleanText(value) {
  return normalizeEncoding(value)
    .toLowerCase()
    .replace(/\r?\n/g, ' ')
    .replace(/[^a-z0-9,\-'/\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits short-text survey answers into phrase-like chunks before tokenization.
 *
 * @param {string} text
 * @returns {string[]}
 */
function splitPhrases(text) {
  return text
    .split(/,|;|\/|\|/g)
    .map((phrase) => phrase.trim())
    .filter(Boolean);
}

/**
 * Builds lexicon hit counts by phrase and by token stems.
 *
 * @param {string[]} phrases
 * @param {string[]} filteredTokens
 * @param {ReadonlyArray<{id: string, keywords: string[], phrases?: string[]}>} taxonomy
 * @param {Map<string, {id: string}>} stemLookup
 * @returns {Map<string, number>}
 */
function collectLexiconHits(phrases, filteredTokens, taxonomy, stemLookup) {
  const counts = new Map();

  for (const phrase of phrases) {
    for (const entry of taxonomy) {
      for (const candidate of entry.phrases ?? []) {
        if (phrase.includes(candidate.toLowerCase())) {
          counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
        }
      }
    }
  }

  for (const token of filteredTokens) {
    const hit = stemLookup.get(stemmer.stem(token));
    if (hit) {
      counts.set(hit.id, (counts.get(hit.id) ?? 0) + 1);
    }
  }

  return counts;
}
