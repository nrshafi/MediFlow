# FIGMA MAKE PROMPT — MediFlow Frontend (exhaustive spec)

## 0 · PRODUCT CONTEXT (read first — this shapes every screen)

Build **MediFlow**, the frontend for an AI Hospital Resource Orchestrator. MediFlow is NOT a hospital management system — it is the coordination "brain" that sits on top of a hospital's existing systems and optimizes patient flow across its resources. A deterministic scheduling engine decides each patient's optimal next step; an AI language layer only *explains* those decisions in plain words and *summarizes* patient history for doctors. The UI must reflect that: a calm, trustworthy, data-forward clinical control room — never playful, never consumer-app flashy. Target context: high-volume hospitals in Bangladesh; clarity beats decoration.

This build is a fully client-side simulated MVP: 3 doctors, 1 Laboratory, 1 X-Ray machine, 1 ECG machine, ~30 simulated patients flowing through one hospital day. No backend, no auth — an in-memory simulation store drives everything and mimics live polling.

## 1 · TECH & PROJECT RULES

- React 19 + TypeScript in strict mode (no `any`), latest stable versions of everything.
- Tailwind CSS v4; shadcn/ui for primitives (Button, Card, Table, Tabs, Select, Badge, Dialog, Tooltip, ScrollArea, Separator, Skeleton).
- lucide-react icons only — stroke icons, `h-4 w-4` inline, `h-5 w-5` in buttons.
- Chart.js v4 for charts (recharts is an acceptable fallback).
- Motion (framer-motion) for subtle transitions only.
- One central simulation store (Zustand, or context + reducer). Components subscribe to it; they never own copies of server-like state and never fetch ad hoc.
- Componentize cleanly: `StatusChip`, `MonoTag`, `StatCard`, `ResourceCard`, `AlertCard`, `StageStepper`, `QuoteBlock`, `GuardrailNote`, `PatientFlowTable`, `BriefSection`, `EcgPulse`, `SimControls`, `RoleSwitcher`.
- All colors come from CSS variables defined once — zero hardcoded hex values inside components.

## 2 · DESIGN SYSTEM

**Theme:** dark only, no light mode. Mood: dark clinical control room — near-black navy, layered surfaces, thin borders, vivid cyan accents, high contrast, generous whitespace.

**Color tokens (CSS variables):**

- `--bg-base` `#050D18` — page background
- `--bg-surface` `#0A1826` — cards
- `--bg-raised` `#0F2032` — hover states, nested surfaces, tooltips
- `--text-primary` `#E9F2F8` — primary text
- `--text-muted` `#8AA0B4` — captions, secondary text
- `--accent-primary` `#22D3EE` — cyan: interactive elements, links, focus rings, highlights, current step
- `--accent-secondary` `#3BE8C8` — teal: positive trends, gradient ends
- `--border-default` `#1A2C40` — all card/table borders (1px)
- `--state-success` `#2EE6A8` — AVAILABLE
- `--state-error` `#F4587E` — BUSY, allergies, negative deltas
- `--state-warning` `#E5C04B` — CONGESTED, guardrail notes

Status mapping is fixed: **Available → success, Busy → error, Congested → warning.** Tinted backgrounds = the token at 10–12% opacity.

**Typography:** Inter (`--font-sans`) for UI text; JetBrains Mono (`--font-mono`) for uppercase micro-labels (11px, letter-spacing 0.12em), status chips, metric values, patient tokens, timestamps, and AI quote blocks. Page titles: Inter 28–32px semibold; card titles 16–18px semibold; body 14px; captions 12px muted.

**Radius scale:** small UI `rounded-md`; status pills & tag chips `rounded-full`; cards/panels `rounded-xl`; modals `rounded-2xl`.

**Card anatomy (used everywhere):** `--bg-surface` background, 1px `--border-default` border, `rounded-xl`, 20–24px padding, an uppercase mono tag chip in the top-left corner (tiny bordered pill, e.g. "F1", "LAB", "X-RAY"). Hover: background shifts to `--bg-raised`. Never use drop shadows for elevation — use border + background steps.

**Signature motifs (from the brand deck):**
- A thin animated cyan ECG heartbeat line (SVG polyline) running under the top bar.
- "● MEDIFLOW · ORCHESTRATION LIVE" mono micro-label with a pulsing cyan dot.
- Numbered step circles with a cyan→teal gradient fill and dark mono numerals.
- ✓ (teal) / ✕ (pink) glyphs for pass/fail contrasts.
- Guardrail note: dashed 1.5px `--state-warning` border, transparent background, mono uppercase text.

## 3 · GLOBAL SHELL & NAVIGATION

Top bar (56–64px, `--bg-base`, 1px bottom border):
- Left: wordmark "MediFlow" — "Medi" in `--text-primary`, "Flow" in `--accent-primary` — plus the "● ORCHESTRATION LIVE" micro-label.
- Center: **role switcher** — segmented control with STAFF / DOCTOR / PATIENT (mono uppercase). There is no authentication; switching is instant and persisted to localStorage.
- Right: simulated clock (mono, e.g. "10:42 AM · SIM DAY 1") + SimControls: play/pause, speed toggle (1× / 4×), and a reset icon-button with tooltip "Restart simulation day".

Below the bar: the animated ECG pulse line spanning full width.
Routing: three routes — `/staff` (default), `/doctor`, `/patient` — deep-linkable.

## 4 · SIMULATION ENGINE (drives all data)

- Simulated day starts 09:00 AM. Tick every 3 real seconds = +1 simulated minute at 1× (+4 at 4×). Pause freezes everything.
- ~30 patients, arrival times distributed 09:00–13:00 with a peak 09:30–11:00. Patients appear only at/after their arrival time.
- Priority: NORMAL or URGENT (~15% urgent). URGENT inserts at the front of queues, behind the patient currently in service. *(Placeholder rule — final priority semantics are still TBD in the project.)*
- Simulated service durations: consultation 8–20 min (per-patient estimate), Laboratory 6–10, X-Ray 7–12, ECG 5–8, Pharmacy 3–5, Billing 2–4.
- Patient journey: Registration (instant at arrival) → orchestrated middle (required diagnostics + consultation, ORDER DECIDED BY THE ENGINE — e.g. tests before consult when that saves time) → Pharmacy → Billing → Done.
- The mock scheduling engine is a simple deterministic heuristic: route each patient to the required service with the shortest predicted wait + service time; recompute on every tick and stage completion. **CRITICAL: every number displayed (waits, ETAs, utilization, queue lengths) must derive from actual simulation state and stay internally consistent — no random display values.**
- Baseline comparison: precompute the same patient set under naive uncoordinated FIFO; keep those aggregates static for the before/after chart and KPI deltas.
- Resource status logic: AVAILABLE (idle), BUSY (serving), CONGESTED (queue ≥ 4 or predicted wait > 25 min — overrides the label while still serving).

## 5 · DATA MODEL (implement these TypeScript interfaces exactly)

- `Patient`: id, token ("P-001"…), name, age, gender, arrivalTime, priority ("normal" | "urgent"), requiredServices (subset of ["consultation","lab","xray","ecg"] with an assigned doctorId), estimatedConsultationDuration, currentStage, queuePosition, timeline events [{ stage, start, end }], history { diagnoses [{ condition, year }], medications [{ name, dose, frequency }], allergies [{ substance, reaction, severity }], recentTests [{ test, value, date, flag: "normal" | "abnormal" }], treatments [{ procedure, date, note }] }.
- `Resource`: id, name, type ("doctor" | "lab" | "xray" | "ecg"), specialty (doctors only), status, currentPatientId, queue: patientId[], predictedWaitMin, utilizationPct, queueHistory (for sparklines).
- `Recommendation`: patientId, nextResourceId, actionText, reasonSummary, etaMin, minutesSaved, explanation (the plain-language AI string).
- `BottleneckAlert`: id, resourceId, severity ("warning" | "critical"), headline, suggestedAction, detectedAt.
- `Metrics`: live { avgWaitMin, avgVisitMin, utilizationPct, patientsInHouse, completed } + the same fields for the FIFO baseline.

## 6 · SEED DATA (use exactly this flavor)

- Doctors: **Dr. Rahman (General Medicine), Dr. Akter (Cardiology), Dr. Chowdhury (Internal Medicine)**. Other resources: Laboratory, X-Ray, ECG.
- Patient names — realistic Bangladeshi names, mixed genders, ages 8–75: Abdul Karim, Fatema Begum, Rahim Uddin, Nusrat Jahan, Kamal Hossain, Shirin Akhtar, Tanvir Ahmed, Salma Khatun, Jashim Uddin, Rokeya Sultana, Mizanur Rahman, Farhana Yasmin, Habibur Sheikh, Taslima Akter, Shafiqul Islam… (generate ~30 in this style).
- Histories: plausible conditions (Type 2 diabetes, hypertension, asthma, gastritis, anemia); medications like "Metformin 500mg · 2×/day", "Amlodipine 5mg · 1×/day"; allergies like "Penicillin → rash (moderate)", "Sulfa drugs → anaphylaxis (severe)"; recent tests like "Fasting glucose — 7.8 mmol/L (abnormal)", "CBC — normal".
- ALL DATA IS SIMULATED — include a persistent tiny mono footer on every view: "SIMULATED DATA — NO REAL PATIENT RECORDS".

## 7 · VIEW 1 — STAFF DASHBOARD (default route)

Desktop layout (≥1280px): main column (~2/3) + right rail (~1/3); stacks cleanly on smaller screens.
Header row: micro-label "01 · LIVE OPERATIONS", title "Hospital Flow — Live", and on the right a recalc stamp ("RECALCULATED 10:42:07 AM", mono, updates each tick).

**(a) KPI strip** — 4 StatCards: AVG WAIT (min), AVG VISIT DURATION (min), RESOURCE UTILIZATION (%), PATIENTS IN-HOUSE. Big mono values (28–32px) with a small delta chip vs. baseline underneath (e.g. "▼ 32% vs uncoordinated" in success color when improved, error when worse; the in-house card shows "12 COMPLETED" instead).

**(b) Resource grid** — 6 ResourceCards (3 doctors + Laboratory + X-Ray + ECG), 3-up: mono tag ("DR-01", "LAB"…), resource name + specialty, StatusChip (AVAILABLE / BUSY / CONGESTED), current patient ("Now: Fatema Begum · P-004" or "—"), queue count, predicted wait ("EST WAIT 14 MIN", mono), a 30-min queue-depth sparkline (thin cyan line, no axes), and a thin teal utilization bar.

**(c) Bottleneck alert rail** (right column) — mono header "BOTTLENECK DETECTION". AlertCards with a 3px left accent border (warning amber / critical pink) and tinted background: headline + suggested action + mono timestamp. Examples:
- "X-RAY — Queue predicted to exceed 25 min within 15 min. Suggested: route P-007 and P-012 to Laboratory first."
- "DR. AKTER — Overloaded: 5 waiting while Dr. Chowdhury is idle. Suggested: shift the next two general consultations."
Empty state: teal ✓ + "No bottlenecks detected — flow is balanced."
Pinned below the rail: GuardrailNote (dashed amber): "⚠ THE LLM NEVER MAKES A SCHEDULING OR CLINICAL DECISION."

**(d) Live patient flow table** — full width. Columns: TOKEN (mono) | PATIENT | PRIORITY (chip; URGENT = pink outline) | CURRENT STAGE (badge) | NEXT STEP (arrow icon + "X-Ray → Dr. Rahman") | ETA REMAINING (mono) | WAITED (mono). Search input (name/token) + stage filter select. Row hover → `--bg-raised`. Clicking a row opens a Dialog with the patient's StageStepper timeline, the current recommendation + its plain-language explanation in a QuoteBlock, and minutes saved.

**(e) Charts row** — two cards:
- "QUEUE DEPTH — LAST 60 MIN": multi-line chart, 6 series. Series palette: cyan `#22D3EE`, teal `#3BE8C8`, amber `#E5C04B`, pink `#F4587E`, slate `#5B8DB8`, muted `#8AA0B4`. Legend rendered as mono chips.
- "MEDIFLOW VS UNCOORDINATED": grouped bars for Avg Wait and Avg Visit Duration — baseline in muted slate, live in cyan, mono value labels.
Chart styling everywhere: gridlines `--border-default`, tick labels mono 10–11px muted, dark tooltips on `--bg-raised` with border, no chart junk.

## 8 · VIEW 2 — PATIENT GUIDANCE (public-screen legibility)

What a patient sees on a lobby screen or phone. Zero learning curve, minimal chrome.
- Top: a discreet patient selector (mono tokens) to preview any active patient — demo affordance only.
- Centered column (max-w-3xl): large mono token + name + priority chip, then THE CARD — micro-label "● YOUR NEXT STEP" and one large plain-language instruction in a QuoteBlock (mono, 18–22px, cyan left border, faint cyan-tinted background): "Proceed to the laboratory first. Doctor B is expected to become available in approximately 12 minutes — reducing your overall visit time by 25 minutes."
- Beneath it, two big mono stats side by side: "EST. WAIT — 12 MIN" and "TIME REMAINING — 47 MIN".
- StageStepper of the whole visit: numbered circles (done = cyan→teal gradient + ✓; current = pulsing cyan ring; upcoming = dim outline), labels beneath (Registration, Blood Test, Consultation — Dr. Akter, Pharmacy, Billing), connector lines fill as stages complete.
- Auto-updates with the tick; when the instruction changes, crossfade + brief cyan glow — never a layout jump.
- Completed state: teal ✓ + "Your visit is complete. Total time: 58 minutes — 25 minutes faster than a typical uncoordinated visit."
- Typography scales with clamp() so a 1080p lobby screen reads from meters away; single column down to 360px phones.

## 9 · VIEW 3 — DOCTOR BRIEF

Two panes at ≥1024px, stacked below.
- **Left sidebar (280–320px):** doctor selector (the 3 doctors), then "UPCOMING QUEUE" — ordered patient cards: token, name, age/gender, priority chip, est. consultation duration, "IN 12 MIN" mono ETA. Selected card = cyan left border. Empty state: "No patients waiting."
- **Main panel:** header with patient name, token, age/gender, arrival time, priority; mono tag "AI-GENERATED BRIEF" (cyan outline) + generation timestamp.
- BriefSections as cards in a 2-column grid — ALLERGIES first and full-width:
  - **ALLERGIES** — error-tinted card, pink border accent; each row: substance + reaction + severity chip. If none: "No known allergies" in a success tint.
  - **PREVIOUS DIAGNOSES** — condition + year rows.
  - **CURRENT MEDICATIONS** — mono name + dose + frequency rows.
  - **RECENT TEST RESULTS** — test, value, date; abnormal values flagged pink with ▲.
  - **TREATMENT HISTORY** — procedure + date + note rows.
- Every section is scannable rows, not paragraphs — a doctor absorbs the brief in under 30 seconds.
- Footer caption: "Generated from historical records — verify critical details." plus the standard GuardrailNote.
- Primary Button (cyan): "START CONSULTATION" (marks the patient in-service in the sim). Secondary ghost: "SKIP / NEXT PATIENT".

## 10 · STATES, MOTION, RESPONSIVENESS

- First load: Skeleton shimmer on cards/table for ~600ms, then data (mimics the initial poll).
- Value changes: number crossfade + a subtle 300ms cyan pulse on the affected card; charts animate smoothly; NEVER reflow the layout on tick.
- Status chip changes: quick color crossfade.
- Motion durations 150–300ms, ease-out. Respect `prefers-reduced-motion`: disable the ECG animation, pulses, and chart animations.
- Breakpoints: dashboard optimized ≥1280, graceful at 1024, single column below; patient view fine at 360px; doctor view stacks below 1024.

## 11 · ACCESSIBILITY

- WCAG AA contrast for all text (muted text only for captions).
- Visible focus everywhere: 2px cyan ring (`--accent-primary` at 40% opacity).
- Status is never conveyed by color alone — chips always contain text.
- Charts get aria-labels and visible legends; the alert rail uses `aria-live="polite"`; role switcher and sim controls are fully keyboard-operable.

## 12 · MICROCOPY (use these exact strings)

- Guardrail: "⚠ THE LLM NEVER MAKES A SCHEDULING OR CLINICAL DECISION."
- Data footer: "SIMULATED DATA — NO REAL PATIENT RECORDS"
- Live label: "● ORCHESTRATION LIVE"
- Brief disclaimer: "Generated from historical records — verify critical details."
- Sample explanations (every explanation = instruction + why + time saved):
  - "Proceed to the laboratory first. Doctor B is expected to become available in approximately 12 minutes — reducing your overall visit time by 25 minutes."
  - "Your X-ray can be done now — the machine is free. Completing it before your consultation saves an estimated 18 minutes."
  - "Please go to Pharmacy. Your prescriptions are being prepared; estimated wait is under 5 minutes."
- Empty alerts: "No bottlenecks detected — flow is balanced."

## 13 · HARD CONSTRAINTS — DO NOT

- No light mode, no theme toggle, no login/signup/auth screens.
- No HMS features: no appointment booking, no billing forms, no editable medical records, no admin CRUD.
- Never present the AI as deciding treatment or scheduling — it only explains decisions and summarizes records.
- No emojis in UI chrome (the ⚠ ● ✓ ✕ ▲ glyphs above are the only symbols). No gradients except cyan→teal on step circles and utilization bars. No drop-shadow elevation. No hardcoded hex outside the token definitions. No lorem ipsum — every string must be realistic.