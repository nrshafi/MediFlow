# UI Context

## Theme

Light clinical control room. High-contrast crisp off-white background, layered pure-white card surfaces with subtle borders, rich cyan/teal for accents and interactive elements, emerald green for positive states, rose for busy/error states, and amber for warnings. Uppercase, letter-spaced monospace micro-labels tag sections and statuses. Calm, legible, data-forward.

## Colors

All components must use these tokens — no hardcoded hex values.

| Role                | CSS Variable         | Value     |
| ------------------- | -------------------- | --------- |
| Page background     | `--bg-base`          | `#EEF2F6` |
| Surface (cards)     | `--bg-surface`       | `#FFFFFF` |
| Raised surface      | `--bg-raised`        | `#E2E8F0` |
| Primary text        | `--text-primary`     | `#020617` |
| Muted text          | `--text-muted`       | `#334155` |
| Primary accent      | `--accent-primary`   | `#0284C7` |
| Secondary accent    | `--accent-secondary` | `#0D9488` |
| Border              | `--border-default`   | `#CBD5E1` |
| Error / Busy        | `--state-error`      | `#E11D48` |
| Success / Available | `--state-success`    | `#15803D` |
| Warning / Congested | `--state-warning`    | `#D97706` |

Status semantics: resource chips map **Available → success**, **Busy → error**, **Congested/at-risk → warning**. Guardrail notes (e.g. the LLM safety rule) use a dashed `--state-warning` border, per the deck.

## Typography

| Role        | Font  | Variable      |
| ----------- | ----- | ------------- |
| UI text     | Inter | `--font-sans` |
| Micro / tag | Inter | `--font-mono` (aliased to `--font-sans`) |

All UI elements, micro-labels, status tags, metric values, and guidance blocks use standard proportional sans-serif typography (`Inter`), with monospace fonts removed entirely.

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
