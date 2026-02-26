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
