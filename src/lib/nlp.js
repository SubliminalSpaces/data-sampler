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
