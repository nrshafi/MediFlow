# MediFlow

## Overview

MediFlow is an AI Hospital Resource Orchestrator — an intelligent coordination layer that sits **on top of** a hospital's existing systems rather than replacing them. It is not a hospital management system; it is the "brain" that optimizes patient flow across the hospital's existing resources (doctors, laboratory, X-ray, ECG, consultation rooms). A deterministic, rule-based scheduling engine computes the optimal next step for every patient in real time; an LLM layer translates each recommendation into plain language for patients and staff and briefs doctors before consultations; a live dashboard surfaces queues, resource status, and bottlenecks. It targets high-volume, resource-constrained hospitals in Bangladesh and similar developing regions, where patients lose hours to avoidable waiting, workloads are wildly uneven, and staff cannot see bottlenecks before they happen.

## Goals

1. Reduce average waiting time and total visit duration per patient — proven live with before/after metrics
2. Balance utilization across all hospital resources — no doctor or machine overloaded while others sit idle
3. Give staff real-time visibility: current queues, predicted waits, and bottlenecks detected before they form
4. Keep every scheduling decision deterministic and explainable — generative AI is used only where communication matters, never for scheduling or clinical decisions

## Core User Flow

1. A simulated patient arrives (arrival time, priority level, required services, estimated consultation duration)
2. The scheduling engine computes the patient's optimal next step across all required services (e.g. "do your blood test first, then see Doctor B")
3. The patient view shows plain-language LLM guidance: *"Proceed to the laboratory first. Doctor B is expected to become available in approximately 12 minutes — reducing your overall visit time by 25 minutes."*
4. Before the consultation, the doctor receives an LLM pre-consultation brief: previous diagnoses, medications, allergies, recent test results, treatment history
5. As the patient completes each stage, the engine recalculates queues, waits, and bottlenecks for the whole hospital
6. Staff watch the live dashboard: resource status (Busy/Available), queue lengths, wait estimates, bottleneck alerts, and before/after impact metrics

## Features

### Orchestration Core (deterministic, rule-based)

- **AI Recommendation Engine** — tells each patient which department to visit next, which doctor to consult, whether to complete tests before consultation, and their estimated completion time
- **Queue Prediction** — forecasts waiting time, total visit duration, and resource utilization before they happen
- **Bottleneck Detection** — flags overloaded doctors, congested departments, and underutilized resources in real time

### LLM Layer (language only — never decisions)

- **LLM Explanation Layer** — translates every recommendation into clear, human-readable guidance for patients and staff
- **Pre-Consultation Patient Summary** — analyzes the patient's historical records and hands the doctor a concise brief (previous diagnoses, medications, allergies, recent test results, treatment history) without replacing existing EMR systems

### Dashboard & Visibility

- **Live Resource Dashboard** — available doctors, current queues, Busy/Available status, and estimated waiting times at a glance, recalculated continuously as patients arrive and move
- **Impact Metrics** — live before/after comparison: average waiting time, total visit duration, resource utilization, queue lengths

## Scope

### In Scope (MVP)

- Simulated hospital: 3 doctors, 1 laboratory, 1 X-ray machine, 1 ECG machine
- 20–50 simulated patients, each with arrival time, priority level, required services, and estimated consultation duration
- Deterministic rule-based scheduling engine — no ML training, no datasets, no model risk
- One LLM API integration, used only for explanations and pre-consultation summaries
- Live dashboard: queues, resource status, wait estimates, bottleneck detection, before/after metrics
- Patient guidance view readable on screens or a web view — no training required
- Simulated data only — no real patient records

### Out of Scope (MVP)

- Building or replacing an HMS/EMR — MediFlow is an overlay, not a management system
- Appointment booking, billing, pharmacy, or medical records management
- ML-trained predictions (roadmap: only once real operational data accumulates)
- Emergency dynamic triage, "what-if" instant re-planning, HMS integration adapters (roadmap)
- Multi-hospital orchestration, city/region health-network load balancing, SaaS packaging (roadmap)
- Real patient data or live hospital data-feed integrations

## Success Criteria

1. A simulated day with 20–50 patients runs end to end: every patient receives a next-step recommendation at each stage until all required services are complete
2. The dashboard reflects arrivals, stage completions, and recalculated queues continuously
3. Every recommendation carries a plain-language LLM explanation, and every consultation is preceded by an LLM patient brief
4. Before/after metrics show measurable improvement over an uncoordinated baseline (average waiting time, total visit duration, resource utilization, queue lengths)
5. Removing the LLM changes no scheduling behavior — proof that the LLM never makes scheduling or clinical decisions
