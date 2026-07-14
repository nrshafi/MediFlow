# UI Context

## Theme

Dark only. No light mode. The design language follows the MediFlow pitch deck: a dark clinical control room — near-black navy backgrounds, layered card surfaces with thin borders, vivid cyan for accents and interactive elements, teal-green for positive states, and an ECG-pulse motif. Uppercase, letter-spaced monospace micro-labels tag sections and statuses. Calm, high-contrast, data-forward.

## Colors

All components must use these tokens — no hardcoded hex values. Values are derived from the pitch deck. *(proposed — fine-tune once the design is in the browser)*

| Role                | CSS Variable         | Value     |
| ------------------- | -------------------- | --------- |
| Page background     | `--bg-base`          | `#050D18` |
| Surface (cards)     | `--bg-surface`       | `#0A1826` |
| Raised surface      | `--bg-raised`        | `#0F2032` |
| Primary text        | `--text-primary`     | `#E9F2F8` |
| Muted text          | `--text-muted`       | `#8AA0B4` |
| Primary accent      | `--accent-primary`   | `#22D3EE` |
| Secondary accent    | `--accent-secondary` | `#3BE8C8` |
| Border              | `--border-default`   | `#1A2C40` |
| Error / Busy        | `--state-error`      | `#F4587E` |
| Success / Available | `--state-success`    | `#2EE6A8` |
| Warning / Congested | `--state-warning`    | `#E5C04B` |

Status semantics: resource chips map **Available → success**, **Busy → error**, **Congested/at-risk → warning**. Guardrail notes (e.g. the LLM safety rule) use a dashed `--state-warning` border, per the deck.

## Typography

| Role        | Font           | Variable      |
| ----------- | -------------- | ------------- |
| UI text     | Inter          | `--font-sans` |
| Code / mono | JetBrains Mono | `--font-mono` |

Mono is used for micro-labels (uppercase, wide letter-spacing), status tags, metric values, and LLM guidance quote blocks — mirroring the deck. *(Font pairing proposed; the deck's source fonts are not web-standard.)*

## Border Radius

| Context             | Class          |
| ------------------- | -------------- |
| Inline / small UI   | `rounded-md`   |
| Status pills / tags | `rounded-full` |
| Cards / panels      | `rounded-xl`   |
| Modals / overlays   | `rounded-2xl`  |

## Component Library

Tailwind CSS + shadcn/ui (Vite-compatible setup). Generated components live in `frontend/src/components/ui/` — add via the CLI rather than writing from scratch. Chart.js renders all data visualizations (queues, waits, utilization) using the color tokens above. *(shadcn/ui confirmed 2026-07-14; Chart.js is specified in the brief.)*

## Layout Patterns

- **Staff dashboard**: top KPI strip (hospital-wide metrics) → grid of resource/queue cards → bottleneck alert rail. Updates live as patients move
- **Patient guidance view**: single-column, one large plain-language next-step card with wait estimate — legible on public screens and phones, zero training required
- **Doctor brief view**: patient header + pre-consultation summary sections (diagnoses, medications, allergies, recent results, treatment history)
- **Cards**: bordered surface with an uppercase mono tag chip in the top corner (deck pattern)
- **Callouts / bottleneck alerts**: left accent border + tinted surface
- **Guardrail notes**: dashed amber border box

## Icons

Lucide React. Stroke-based icons only. Sizes: `h-4 w-4` inline, `h-5 w-5` buttons. Use check/x glyphs for pass–fail contrasts, matching the deck's ✓/✕ pattern.
