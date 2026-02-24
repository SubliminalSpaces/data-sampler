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
