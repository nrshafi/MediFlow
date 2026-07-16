# MediFlow Technical Walkthrough

MediFlow is a hospital-flow orchestration layer. It sits beside an existing
HMS/EMR, consumes operational facts such as arrivals and resource status, and
recommends the next operational step. It does not replace clinical systems,
make diagnoses, or own billing and medical records.

Use this guide alongside the live [judge walkthrough](judge-walkthrough.md).
The live walkthrough proves the outcome; this guide explains why the outcome
is trustworthy and how the same pattern can be integrated into a hospital.
For the exact formulas and metric definitions, see
[how MediFlow calculates things](calculations.md).

## Presentation narrative

1. **The problem** — crowded hospitals often have good staff and equipment but
   no real-time coordination across their queues.
2. **The solution** — MediFlow continuously selects each patient's next
   operational step to reduce their projected whole-visit completion time.
3. **The safety boundary** — a deterministic rules engine makes every routing
   decision. Gemini only turns established facts into readable guidance and a
   doctor brief.
4. **The proof** — run the simulated day, show all 30 patients complete, then
   compare MediFlow with the fixed-order, FIFO baseline.
5. **The adoption path** — integrate read-only operational feeds first, keep
   clinical authority in existing systems, and introduce write-back only after
   governance and validation.

## How the product is built

The repository is an npm-workspace monorepo with deliberately separate
responsibilities:

| Area | Implementation | Responsibility |
| --- | --- | --- |
| `frontend/` | React, TypeScript, Vite, Chart.js | Staff, patient, and doctor views render the shared API snapshot. Polling keeps views current; the browser never schedules. |
| `backend/src/routes/` | Hono on Cloudflare Workers | Thin HTTP boundary for snapshots, simulation ticks, reset, Gemini-key verification, and doctor briefs. |
| `backend/src/engine/` | Pure TypeScript | Deterministic routing, queue ordering, projected waits, and congestion detection. No database, network, or LLM calls. |
| `backend/src/simulation/` | Persistent one-minute clock | Applies arrivals, completions, routing, and metric collection as an atomic database batch. |
| `backend/src/db/` | Drizzle ORM + Turso/libSQL | Normalized operational state, audit events, metric snapshots, histories, and cached language output. |
| `backend/src/llm/` | Provider-agnostic Gemini adapter | Generates explanations and pre-consultation summaries with timeouts, caching, and deterministic fallbacks. |
| `shared/` | TypeScript contracts | Shared domain and API types used by both frontend and backend. |

See the [system overview](diagram/system-overview.mmd) for the runtime path.

## What happens during one simulated minute

The client controls playback speed, but every request advances exactly one
minute. That preserves the audit trail even at 4x or 10x playback.

1. The frontend posts `POST /api/simulation/tick`.
2. The Worker reads the persisted simulation state and plans the next minute.
3. It records a unique clock event first. This prevents two concurrent requests
   from advancing the same minute.
4. Due services finish in patient-ID order; arrivals register in patient-ID
   order.
5. The pure scheduler assigns next steps and starts work on idle resources.
6. Resource status, queues, audit events, and live metric snapshots are saved
   in one libSQL batch.
7. Polling clients read `GET /api/operations` and render the same current
   snapshot in every role-specific view.

The [scheduler diagram](diagram/scheduler-flow.mmd) shows this sequence and
the [patient state diagram](diagram/patient-state.mmd) shows the legal patient
states.

## How the scheduler stays explainable

For every eligible patient with unfinished services, the engine evaluates the
available next services and selects the option with the lowest projected
whole-visit completion time. It uses fixed tie-breakers, so the same persisted
state always produces the same result.

- Urgent patients precede normal patients in a waiting queue.
- Patients of the same priority are FIFO by queue-entry minute, then patient
  ID.
- Active work is never preempted.
- A patient can wait in only one queue and receive only one active service.
- For consultations, the three simulated doctors are operationally
  interchangeable; the engine chooses the one with the best projected finish.
- A resource is marked congested when its queue reaches four patients or its
  predicted wait exceeds 25 minutes.

Every simulation tick stores ordered events, queue state, and a metric
snapshot. That makes the recommendation reproducible and auditable rather
than a black-box prediction.

## How the AI features work safely

Gemini is a language layer, not the orchestration engine. It receives facts
that are already known: the selected resource, queue estimate, and simulated
history. It returns either a patient-friendly explanation or a six-section
doctor brief. It cannot change a queue, assign a doctor, or make a clinical
decision.

The implementation protects that boundary in four ways:

1. The scheduler module has no LLM or network dependency.
2. Gemini calls are isolated behind one provider-agnostic adapter with a
   timeout.
3. Outputs are cached by patient, output kind, and deterministic source hash,
   so polling does not regenerate text unnecessarily.
4. If the model or key is unavailable, deterministic fallback text is shown;
   operational behavior is unchanged.

The [AI features diagram](diagram/ai-features.mmd) makes the one-way boundary
visible. For demos without a configured Worker key, a presenter may enter a
Gemini key only after a read-only verification call. That key remains in
browser memory for the session, is never stored, and is re-checked by the
Worker when used for the narrowly scoped demo-reset exception.

## Evidence shown in the demo

The canonical seed contains six resources and 30 simulated patients. Against
the same fixture run with a fixed `lab → X-ray → ECG → consultation` order and
naive FIFO queues, the completed MediFlow run produced:

| Measure | MediFlow | Baseline |
| --- | ---: | ---: |
| Average wait | 2 min | 10 min |
| Average visit duration | 25 min | 32 min |
| Resource utilization | 46.5% | 45% |
| Average queue depth | 0.3 | 1.2 |
| Peak queue depth | 2 | 5 |

These are simulated MVP results, not a clinical claim or a prediction of a
specific hospital's outcome. The key judge takeaway is the controlled
comparison: identical patients and resources, different coordination policy.

## Real-world integration path

MediFlow should be introduced as an overlay, in controlled stages:

1. **Discover and map.** Identify the hospital's HMS/EMR, lab/radiology
   systems, department queues, resource identifiers, and current service-time
   data. Agree the operational events MediFlow may read.
2. **Read-only shadow mode.** Ingest de-identified or consented live feeds for
   arrivals, orders, completion events, resource availability, and estimated
   durations. Run the deterministic engine alongside existing workflow without
   sending instructions to staff.
3. **Validate locally.** Compare predicted waits and recommendations with
   observed flow by department. Tune explicit policy parameters with hospital
   leadership; do not train an opaque scheduling model by default.
4. **Staff decision support.** Surface recommendations in a dashboard or
   embedded link. Staff retain authority to accept, defer, or override an
   operational recommendation, with a reason recorded for review.
5. **Governed interoperability.** Add authenticated, least-privilege adapters
   using the hospital's supported standards and APIs (for example FHIR where
   available). Begin with read-only access; any write-back must be scoped,
   approved, logged, and reversible.
6. **Production controls.** Add role-based access, tenant isolation, audit
   review, monitoring, incident response, data-retention rules, consent and
   privacy review, encryption, and locally applicable healthcare compliance
   controls before processing real patient data.

In production, the inputs replace simulation events; the deterministic engine,
auditable event model, dashboard, and language-only AI boundary remain the
same. Clinical triage, diagnosis, prescribing, billing, appointments, and the
source medical record remain in their existing owner systems.

## Judge questions to invite

- **"What if Gemini fails?"** The scheduler continues unchanged and MediFlow
  shows deterministic fallback text.
- **"Why trust the recommendation?"** Its rule inputs, queue ordering,
  tie-breakers, event history, and metrics are persisted and reproducible.
- **"Does this replace the hospital system?"** No. It is a coordination
  overlay that begins with read-only operational integration.
- **"Can it use real records now?"** No. This MVP uses simulated data only;
  authentication, governance, and a controlled integration program are
  prerequisites for real data.
