# Subliminal Spaces Phase I Analysis Pipeline

## Overview

This repository contains a Node.js data-processing pipeline for the **Subliminal Spaces** NYC subway research project.

It transforms a Qualtrics Phase I export into a research-ready JSON artifact that:

- groups responses by station and stimulus
- preserves exposure-level records for later modeling
- computes descriptive statistics for comfort and safety
- derives normalized emotion and topic labels from short free-text affect responses
- computes a bounded **satisfaction score**
- computes a spec-aligned **Subliminal Index Score (SIS)** using a Phase I stress proxy
- preserves demographic summaries for subgroup auditing and future expansion

The implementation is intentionally structured so that **Phase II physiological data** can be added later without redesigning the output schema.

## Research Context

The project studies how subway environments produce emotional and perceptual responses that may not be fully conscious. In Phase I, participants see randomized visual or audio stimuli and report:

- a short affective response in five words or fewer
- a comfort rating on a 1-7 Likert scale
- a safety rating on a 1-7 Likert scale
- optional demographic information collected at the end of the survey

The goal of this pipeline is to convert those responses into structured signals that can support:

- descriptive analysis
- dashboarding
- station comparison
- future predictive modeling
- later fusion with physiological measures in Phase II

## Source Documents Incorporated

The most important specification points folded into this code are:

- station-level aggregation is required
- comfort and safety are modeled as 1-7 Likert variables
- short-text affect should become structured labels
- demographics should be preserved for future analysis, but used cautiously
- the station-level scoring target is the **Subliminal Index Score**

## Spec-Derived Equations

### Station Aggregation

From the technical specification, station-level comfort and safety are defined as averages across responses associated with station \(s\):

$$
\mathrm{Comfort}_s = \frac{1}{n_s}\sum_{i=1}^{n_s} C_i
$$

$$
\mathrm{Safety}_s = \frac{1}{n_s}\sum_{i=1}^{n_s} S_i
$$

where:

- \(n_s\) is the number of responses associated with station \(s\)
- \(C_i\) is the comfort score for response \(i\)
- \(S_i\) is the safety score for response \(i\)

### Phase II Physiological Stress Proxy From Spec

The technical specification defines Phase II stress using physiology:

$$
\Delta \mathrm{HRV}_i = \mathrm{HRV}_{baseline,i} - \mathrm{HRV}_{exposure,i}
$$

$$
\Delta \mathrm{BP}_i = \mathrm{BP}_{post,i} - \mathrm{BP}_{pre,i}
$$

$$
\mathrm{Stress}_i = \alpha \cdot \Delta \mathrm{HRV}_i + \beta \cdot \Delta \mathrm{BP}_i
$$

### Subliminal Index Score From Spec

The station-level scoring equation in the technical specification is:

$$
\mathrm{SIS}_s = w_1 \cdot Z(\mathrm{Stress}_s) - w_2 \cdot Z(\mathrm{Comfort}_s) - w_3 \cdot Z(\mathrm{Safety}_s)
$$

where:

- \(Z(\cdot)\) is z-score normalization
- \(w_1, w_2, w_3\) are calibrated weights
- higher SIS means greater subliminal stress impact

## Phase I Adaptation Used In This Repository

Phase I has no physiological measurements yet, so the code implements a **Phase I stress proxy** derived only from the short-text affect response.

This avoids double-counting comfort and safety before SIS is computed.

### Text-Derived Stress Proxy

The implemented Phase I stress proxy is:

$$
\mathrm{StressPhaseI}_e = 0.65 \cdot \left(1 - \mathrm{ValenceNorm}_e\right) + 0.35 \cdot \mathrm{Arousal}_e
$$

with:

$$
\mathrm{ValenceNorm}_e = \frac{\mathrm{Valence}_e + 1}{2}
$$

where:

- \(\mathrm{Valence}_e \in [-1, 1]\) comes from the local NLP normalization layer
- \(\mathrm{Arousal}_e \in [0, 1]\) comes from the canonical emotion taxonomy

This yields a bounded stress proxy in \([0,1]\).

### Satisfaction Score

The pipeline also computes a separate bounded satisfaction score for each exposure:

$$
\mathrm{Satisfaction}_e =
0.4 \cdot \mathrm{ComfortNorm}_e +
0.4 \cdot \mathrm{SafetyNorm}_e +
0.2 \cdot \mathrm{ValenceNorm}_e
$$

where:

$$
\mathrm{ComfortNorm}_e = \frac{C_e - 1}{6}
$$

$$
\mathrm{SafetyNorm}_e = \frac{S_e - 1}{6}
$$

This score is not the same as SIS:

- `satisfactionScore` is an intuitive bounded "goodness" score for a response or aggregate
- `subliminalIndexScore` is the spec-aligned stress-oriented index for station comparison

## Why The Implementation Uses Node.js

The technical specification suggests Python for future ML work, but this repository intentionally uses **Node.js** per project direction.

That means:

- ingestion is implemented in Node
- local NLP normalization is implemented in Node
- the JSON artifact is generated in Node

This still preserves compatibility with later Python-based ML work because the output is plain JSON and easily ingestible by Python, SQL, dashboards, or notebooks.

## Input Files

### `stations.json`

This file is treated as a **stimulus-to-station mapping**, not a full MTA station metadata table.

Each object is expected to look like:

```json
{ "id": 28, "name": "Canal St — N/Q" }
```

Interpretation:

- `id` is the stimulus ID
- `name` is the station name associated with that stimulus

### Qualtrics CSV

Each CSV row is treated as one **participant exposure to one stimulus**.

The pipeline expects columns equivalent to:

- `Response ID`
- `Start Date`
- `End Date`
- `Age Group`
- `Gender`
- `Ethnicity / Race`
- `Frequency`
- `Borough`
- `Stimulus ID`
- `Stimulus Type`
- `Feelings`
- `Comfort`
- `Safety`
- `Loop #`
- `Total #`

## Local NLP Design

The free-text response field is short, noisy, and highly variable, so the code uses a local lexicon-based normalization pipeline built with:

- [`natural`](https://www.npmjs.com/package/natural)
- [`stopword`](https://www.npmjs.com/package/stopword)

### NLP Goals

The NLP layer is designed to:

- normalize encoding artifacts
- remove stopwords and filler language
- map noisy text into canonical emotions
- derive topic tags useful for station-level interpretation
- produce numeric valence and arousal values
- keep the logic local and auditable

### Why Lexicon-Based Instead Of A Hosted Model

For this stage, a lexicon approach is appropriate because:

- the responses are extremely short
- the dataset is small
- the mapping must be transparent for auditability
- the project benefits from deterministic outputs
- the labels should remain interpretable to researchers

This is a strong baseline that can later be replaced or augmented by transformer-based classifiers if the dataset grows.

### Canonical Emotions

The current taxonomy includes:

- Calm
- Joy
- Curiosity
- Nostalgia
- Neutral
- Vigilance
- Anxiety
- Fear
- Disgust
- Claustrophobia
- Eeriness
- Irritation
- Boredom
- Confusion

Each canonical emotion has:

- a stable ID
- a display label
- a polarity
- a valence score
- an arousal score
- keyword and phrase hooks

### Canonical Topics

The topic layer currently includes:

- Cleanliness / Decay
- Noise / Sound
- Crowding / Space
- Safety / Security
- Wayfinding / Ambiguity
- Urban Character

These are not used directly in scoring yet, but they are valuable for:

- interpreting high-SIS stations
- building dashboards
- later feature engineering

## Data Flow

The pipeline proceeds in the following order:

1. Read stimulus-to-station mapping.
2. Read the Qualtrics CSV export.
3. Normalize each short-text affect response.
4. Compute exposure-level valence, arousal, emotion labels, and topic labels.
5. Compute exposure-level stress proxy and satisfaction score.
6. Aggregate exposures by stimulus.
7. Aggregate exposures by station.
8. Compute descriptive statistics and confidence intervals.
9. Compute stimulus-level and station-level SIS values.
10. Write a research-ready JSON artifact.

## Output Artifact

The output file is written to:

- `output/station-analysis.json`

### Top-Level Shape

```json
{
  "metadata": {},
  "globalSummary": {},
  "stations": []
}
```

## Output Schema

Below is a practical schema sketch of the generated JSON.

### `metadata`

Contains:

- generation timestamp
- runtime information
- input file references
- record counts
- scoring equations
- scoring weights
- notes about Phase I assumptions
- legacy comparison values

Example shape:

```json
{
  "generatedAt": "2026-04-13T18:38:47.153Z",
  "project": "Subliminal Spaces",
  "phase": "Phase I",
  "runtime": "Node v22.14.0",
  "sourceFiles": {
    "stationsPath": "...",
    "csvPath": "...",
    "legacyResultsPath": "...",
    "outputPath": "..."
  },
  "recordCounts": {
    "csvRows": 58,
    "validExposures": 58,
    "uniqueParticipants": 9,
    "uniqueStimuli": 29,
    "uniqueStations": 6
  },
  "scoring": {
    "sisEquation": "...",
    "sisWeights": {},
    "phase1StressProxyEquation": "...",
    "satisfactionEquation": "...",
    "notes": []
  }
}
```

### `globalSummary`

Contains:

- top emotions across the dataset
- top topics across the dataset
- demographic summaries
- modality breakdown
- overall satisfaction stats
- overall Phase I stress stats
- uncategorized affect count

### `stations`

Each entry represents a station-level entity derived from grouped stimuli.

Each station object contains:

- station key
- station name
- station metadata
- response count
- participant count
- aggregated comfort metrics
- aggregated safety metrics
- aggregated affect metrics
- aggregated stress metrics
- aggregated satisfaction metrics
- top five emotions
- top five topics
- most positive observed emotion
- most negative observed emotion
- participant profile summaries
- data quality diagnostics
- nested `stimuli` array

### Station Object Schema

```json
{
  "stationKey": "dekalb-av-b-q-r",
  "stationName": "DeKalb Av — B/Q/R",
  "stationMetadata": {
    "complexName": "DeKalb Av",
    "lineGroup": "B/Q/R",
    "stimulusIds": ["1", "2", "3", "4", "5", "32", "33"],
    "stimulusTypes": ["audio", "image"]
  },
  "responseCount": 10,
  "participantCount": 5,
  "aggregateMetrics": {
    "comfort": {},
    "safety": {},
    "affectValence": {},
    "affectArousal": {},
    "phase1Stress": {},
    "satisfactionScore": {},
    "subliminalIndexScore": {
      "value": -1.56,
      "zComponents": {
        "stress": 0.12,
        "comfort": 0.91,
        "safety": 0.77
      }
    }
  },
  "topEmotions": [],
  "topTopics": [],
  "mostPositiveEmotion": {},
  "mostNegativeEmotion": {},
  "participantProfile": {},
  "dataQuality": {},
  "stimuli": []
}
```

### Stimulus Object Schema

Each station contains a `stimuli` array of nested stimulus summaries. Each stimulus summary contains:

- `stimulusId`
- parent station identity
- stimulus types present
- exposure-level records
- all aggregate metrics
- top emotions and topics
- positive and negative emotion summaries
- participant profile summaries

Example shape:

```json
{
  "stimulusId": "30",
  "stationKey": "atlantic-av-barclays-ctr-d-n-r",
  "stationName": "Atlantic Av-Barclays Ctr — D/N/R",
  "stimulusTypes": ["audio"],
  "responseCount": 3,
  "participantCount": 3,
  "aggregateMetrics": {
    "comfort": {},
    "safety": {},
    "affectValence": {},
    "affectArousal": {},
    "phase1Stress": {},
    "satisfactionScore": {},
    "subliminalIndexScore": {}
  },
  "topEmotions": [],
  "topTopics": [],
  "exposures": []
}
```

### Exposure Object Schema

Each nested exposure preserves the row-level signal needed for future modeling:

```json
{
  "responseId": "R_123:30:1",
  "participantId": "R_123",
  "stimulusId": "30",
  "stimulusType": "audio",
  "comfort": 4,
  "safety": 2,
  "satisfactionScore": 0.31,
  "phase1StressProxy": 0.77,
  "feelings": {
    "rawText": "Dirty, loud, unsafe",
    "normalizedText": "dirty, loud, unsafe",
    "emotionLabels": [],
    "topicLabels": [],
    "valence": -0.84,
    "arousal": 0.82,
    "polarity": "negative"
  },
  "participant": {
    "participantId": "R_123",
    "ageGroup": "18-24",
    "gender": "Male",
    "ethnicity": "Asian, White",
    "frequency": "Every day",
    "borough": "Brooklyn"
  },
  "timings": {
    "startDate": "2026-03-19T16:06:20.000Z",
    "endDate": "2026-03-19T16:12:47.000Z"
  }
}
```

## Aggregate Metrics Explained

Most numeric aggregate blocks contain:

- `count`
- `min`
- `max`
- `average`
- `median`
- `standardDeviation`
- `range`
- `histogram7` for Likert-style discrete distributions where relevant
- `confidenceInterval95`

This makes the JSON suitable not only for app display, but also for:

- statistical inspection
- dashboard charting
- versioned recomputation
- future regression feature engineering

## Demographics

This repository follows that guidance:

- demographics are **preserved**
- demographics are **aggregated**
- demographics are **not used as predictive inputs**

Right now they are included for:

- subgroup auditing
- descriptive research
- fairness checks
- future robustness analysis

## Data Quality Features

The output includes simple diagnostics such as:

- uncategorized affect response count
- empty affect response count
- average token count per affect response

These are useful for:

- spotting weak prompts
- finding problematic survey sessions
- deciding when the lexicon should be expanded

## Running The Pipeline

### Install Dependencies

```bash
npm install
```

### Build The Analysis JSON

```bash
npm run build:analysis
```

### Build The Standalone Dashboard

```bash
npm run build:dashboard
```

### Build Both Artifacts

```bash
npm run build:all
```

### Run Syntax Checks

```bash
npm test
```

## Environment Variable Overrides

You can override any default input/output path:

```bash
STATIONS_JSON_PATH="C:/path/to/stations.json"
QUALTRICS_CSV_PATH="C:/path/to/export.csv"
LEGACY_RESULTS_JSON_PATH="C:/path/to/results.json"
ANALYSIS_OUTPUT_PATH="C:/path/to/output.json"
npm run build:analysis
```

## File Guide

### `src/build-analysis.js`

Main orchestration script. Responsibilities:

- reading inputs
- normalizing rows
- computing derived exposure-level metrics
- aggregating by stimulus and station
- computing SIS
- writing final JSON

### `src/build-dashboard.js`

Standalone dashboard generator. Responsibilities:

- reading the generated analysis JSON
- embedding the data into a portable HTML file
- rendering summary cards, station browsing, and stimulus drilldowns
- providing light/dark theme support
- preserving a clean no-backend workflow for review and presentation

### `src/lib/nlp.js`

Local NLP utility layer. Responsibilities:

- encoding cleanup
- tokenization
- stopword removal
- lexicon matching
- valence and arousal scoring
- topic extraction

### `src/lib/emotion-taxonomy.js`

Central taxonomy definition for:

- canonical emotions
- topic tags
- polarity
- valence
- arousal
- lexical triggers

## Design Decisions

### 1. Stimulus-Level And Station-Level Both Matter

The project needs station-level conclusions, but the raw unit of collection is the exposure to a specific stimulus.

For that reason the JSON keeps:

- exposure-level detail
- stimulus-level aggregation
- station-level aggregation

This makes the dataset more useful for later modeling and auditing.

### 2. SIS And Satisfaction Are Both Preserved

These scores answer different questions.

- `satisfactionScore` answers: "How good does this exposure seem overall?"
- `subliminalIndexScore` answers: "How stress-heavy is this station relative to others?"

Keeping both avoids overloading one number with two jobs.

### 3. Emotions Are Canonicalized Instead Of Leaving Raw Phrases Alone

Raw text is valuable, but the project also needs stable labels. Canonicalization improves:

- aggregation
- interpretability
- chartability
- future modeling

The raw text is still preserved in exposure records.

### 4. Phase I Stress Proxy Is Explicitly Temporary

The implemented text-derived stress proxy is a research bridge, not the final physiological target.

Once Phase II data exists, the intended direction is:

1. compute physiology-based stress from HRV and BP
2. calibrate \(w_1, w_2, w_3\)
3. optionally train supervised models to predict stress from text, image, and audio features
4. version the resulting score definitions

## Recommended Next Steps

### Short Term

- expand the emotion lexicon with real observed phrasing from your dataset
- add rubric-coded environmental tags per stimulus if available
- review uncategorized responses and add missing mappings
- compare station-level outputs against researcher intuition

### Medium Term

- add a proper `Stimuli` metadata source with capture date, URI, and research tags
- add true MTA station metadata if you want richer station-side information
- store this output in a relational database aligned to the technical spec
- add dashboard visualizations

### Phase II

- ingest HRV, blood pressure, and motion quality flags
- replace the text-only stress proxy with the physiology-derived stress target
- calibrate SIS weights empirically
- train interpretable regression baselines

## Important Limitations

- `stations.json` currently maps stimulus IDs to station names, but does not provide full MTA metadata.
- The current NLP layer is deterministic and auditable, but not yet a learned classifier.
- SIS weights are placeholders until calibration data exists.
- The current output only includes stimuli observed in the provided CSV export.
- Confidence intervals are bootstrap estimates over small samples and should be interpreted carefully.

## Current Output Summary

At the time of the latest run, the generated artifact captured:

- 58 valid exposures
- 9 unique participants
- 29 observed stimuli
- 6 observed station groups

The dashboard build also produces:

- `output/dashboard.html`, a standalone visual report with embedded data
- a station search sidebar
- light/dark theme toggle
- granular filtering and sorting controls for stations, stimuli, and the comparison table
- a dev-mode raw exposure tab with command-style filtering for ad hoc inspection
- dataset-wide summary cards
- station drilldowns with stimulus-level tables
- readable demographics and emotion/topic summaries

## Command Summary

```bash
npm install
npm test
npm run build:analysis
npm run build:dashboard
npm run build:all
```
