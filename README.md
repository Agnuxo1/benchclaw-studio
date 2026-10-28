<div align="center">

# BenchClaw Studio

**Use the cheapest NVIDIA Nemotron that actually delivers.**

Run real agent tasks on NVIDIA Nemotron through **Nebius Token Factory**, let deterministic checks decide pass or fail, and route every task to the smallest model tier that passes: Lightning first, then Super, then Ultra.

[![License: MIT](https://img.shields.io/badge/license-MIT-76b900.svg)](LICENSE)
[![Tests](https://github.com/Agnuxo1/benchclaw-studio/actions/workflows/test.yml/badge.svg)](https://github.com/Agnuxo1/benchclaw-studio/actions/workflows/test.yml)
![Node 22](https://img.shields.io/badge/node-22-339933.svg)
![NVIDIA Nemotron](https://img.shields.io/badge/NVIDIA-Nemotron%203%20%7C%203.5-76b900.svg)
![Nebius Token Factory](https://img.shields.io/badge/Nebius-Token%20Factory-0d1b2a.svg)

**[Live replay demo](https://agnuxo1.github.io/benchclaw-studio/)** · **[Demo video](https://youtu.be/gVSO4OD6mh8)** · **[Results](#results)** · **[Quick start](#quick-start)**

<img src="docs/media/architecture.gif" alt="Auto-tier ladder: the Studio API sends a task to Nemotron 3.5 Lightning; its checks fail, so it escalates to Nemotron 3 Super, which passes; Ultra is never called" width="900">

</div>

## Why

**Nebius × NVIDIA Global AI Hackathon entry.** Devpost confirmed submission
**1269138, BenchClaw Studio**, on 28 October 2026. This is a submission receipt,
not a judging result. The existing entry remains editable until 30 October,
10:00 PDT (18:00 Madrid); updates preserve that entry.

Teams wiring an LLM agent into a real workflow face the same question again and again: **which model is good enough for this job?** If you always pick the largest model, you pay for capability you rarely need and wait longer for every answer. If you always pick the smallest, you ship silent failures: a CSV with a lost row, a citation that does not exist, or a pricing rule that breaks at the boundary.

A fluent answer does not show which of the two happened. BenchClaw Studio does.

## What it does

1. **Defines success before the run.** Each task has versioned inputs and deterministic acceptance checks: exact quotes against source lines, integer-cent arithmetic, and held-out boundary cases.
2. **Runs a real agent on NVIDIA Nemotron.** The model chooses every action (read, write, check, finish). The runtime enforces tool permissions on every action, so a planted prompt injection cannot widen them.
3. **Escalates only when the checks fail.** The **auto-tier ladder** tries `Nemotron-3.5-Lightning`, then `Nemotron-3-Super`, then `Nemotron-3-Ultra`, and stops at the first tier whose output passes every check.
4. **Leaves evidence you can verify.** Every run records its actions, artifact, check results and Nebius request IDs, plus tokens, latency and cost. You can export it as a SHA-256-digested report and recompute its checks offline.

<!-- RESULTS:START -->
## Results

**110 live provider-attempted benchmark runs; 108 rows in the primary E01/E02 grids.** The two pre-registered experiments each use 3 tasks × 2 profiles × 3 seeds × 3 Nemotron tiers, at temperature 0. The inputs are controlled synthetic fixtures; the calls and receipts are real. Recorded-token cost is **$0.4317 for 109 attempts with known usage**; one timed-out attempt has unknown usage, so this is not a complete billed total.

The independent reanalysis preserves the first provider attempt in every cell. Two previously replaced ledger-error runs had actually called the provider. They are now retained in the primary analysis; the recovery result remains visible below. [What changed and why](docs/RESULTS_CORRECTION_20261028.md).

<img src="docs/media/policy.gif" alt="Primary E02: ladder passes 83% vs Ultra 78%, with 32.15% lower cost on the same 17 known-cost cells" width="860">

| Policy (E02 primary) | Tasks passed (all 18 cells) | Cost/task (same 17 cells) | Mean time/task (all 18) |
|---|---|---|---|
| **Auto-tier ladder** | **15/18 = 83.3%** | **$0.004044** | 54.1 s |
| Always Nemotron 3 Ultra | 14/18 = 77.8% | $0.005960 | 7.2 s |
| Always Nemotron 3 Super | 12/18 = 66.7% | $0.002196 | 15.3 s |

- **The positive routing result survives the correction.** The ladder passes one more grid cell than always-Ultra and costs **32.15% less on matched cells**. It is slower and costs more than always-Super; the table preserves both trade-offs.
- **Reasoning models need room to answer.** Lightning rises from 1/18 (5.6%) at 2,048 output tokens to **11/18 (61.1%)** in the first-attempt 8,192-token grid. The explicit recovery analysis reaches 12/18 (66.7%). The larger budget remains the product default under the preregistered rule.
- **Ultra remains the fastest tier measured.** It averages 7.2 s per task. The ladder trades latency for greater success on these fixtures and lower matched cost than Ultra.

| E02 analysis | Ladder passes | Ultra passes | Matched cost saving |
|---|---:|---:|---:|
| **Primary, first attempt retained** | **15/18** | 14/18 | **32.15%** (17 paired cells) |
| Secondary infrastructure recovery | **16/18** | 14/18 | **30.64%** (17 paired cells) |

Both analyses remain public. An error code alone no longer classifies a run as unexecuted; only a ledger-stopped row with **zero provider calls** can be replaced automatically. Offline routing now obeys the same budget-stop rules as the live ladder. Unknown costs are disclosed and never treated as zero.

<img src="docs/media/budget.gif" alt="Lightning passes 6% at 2048 tokens and 61% in the corrected 8192-token primary grid" width="860">
<img src="docs/media/tiers.gif" alt="Primary tier metrics from recorded provider attempts; per-tier available-cost counts are disclosed in JSON" width="900">

E01's positive routing result and rejected latency ordering remain unchanged. In primary E02, the budget-recovery and no-regression rules still hold. Seed SD is available in the JSON; it is not a confidence interval over future tasks. Three fixture tasks do not establish a general model ranking.

[Primary results](experiments/E02/summary-primary-corrected.json) · [Recovery results](experiments/E02/summary-recovery-explicit.json) · [All-attempt accounting](experiments/history-audit-20261028.json) · [Full log](experiments/LOG.md)
<!-- RESULTS:END -->

## How NVIDIA Nemotron and Nebius Token Factory are used

| Where | What runs | Why it matters |
| --- | --- | --- |
| `server/nebius.mjs` | OpenAI-compatible `POST /v1/chat/completions` on `api.tokenfactory.nebius.com`, JSON-object mode, provider seed, 8,192-token output budget for reasoning tiers | Every agent turn is a real Token Factory call; nothing is simulated or cached |
| `server/models.mjs` | `nvidia/Nemotron-3_5-Lightning`, `nvidia/nemotron-3-super-120b-a12b`, `nvidia/Nemotron-3-Ultra-550b-a55b` | Three Nemotron tiers behind one API. Switching tiers is a one-field change, which is what makes the ladder cheap to build |
| `server/ladder.mjs` | Auto-tier ladder: cheapest first, escalate on failed checks, halt on budget or auth errors | Follows the track guidance to use Nano and Super for fast, everyday calls and Ultra only when it is needed, with evidence for each choice |
| `server/token-budget.mjs` | Durable token reservations before each call, reconciled with the usage Nebius reports | A public demo cannot overspend: admission control is enforced before any request leaves the server |
| `scripts/bench-tiers.mjs` | The pre-registered E01 and E02 grids on all three tiers (108 live runs) | The routing claim is measured, not asserted |

Token Factory accelerated this project in two ways. First, all three Nemotron tiers sit behind one endpoint and one key, so the comparison needed no infrastructure. Second, it reports usage per call, so cost per task comes straight from provider receipts.

## Feedback on Nebius Token Factory and NVIDIA Nemotron

What worked well:
- **One endpoint and one key for every Nemotron tier.** Because Token Factory is OpenAI-compatible, the ladder is a single `model` field. No extra infrastructure was needed to compare 30B, 120B and 550B models.
- **Usage is reported per call, including `reasoning_tokens`.** That made cost per task and the E01 diagnosis possible from provider data alone.
- **Request IDs on every response** make each recorded run traceable.
- **Nemotron 3 Ultra was the fastest tier we measured**, with the fewest turns and tokens per task.

What would help builders:
- **Guidance on output budgets for reasoning models.** Reasoning tokens count against `max_tokens`. At 2,048, Nemotron 3.5 Lightning stopped with `finish_reason=length` in 17 of 18 runs, before writing any answer. A documented recommended budget, or a reasoning-effort or budget parameter, would prevent this silent failure.
- **Consistent model ids.** The catalog shows `Nemotron-3.5-Lightning`, while the API id is `nvidia/Nemotron-3_5-Lightning`, and casing differs across tiers (`nemotron-3-super-120b-a12b` versus `Nemotron-3-Ultra-550b-a55b`).
- **Empty content with `finish_reason=stop`.** It happened once, when the model returned only reasoning. A distinct finish reason would make this case explicit.

## Quick start

Requires Node.js 22+. No build step and one pinned runtime dependency.

```sh
git clone https://github.com/Agnuxo1/benchclaw-studio && cd benchclaw-studio
npm ci --ignore-scripts
npm test                       # offline test suite, no network
cp .env.example .env           # then set NEBIUS_API_KEY, STUDIO_INFERENCE_ENABLED=1 and a token cap
npm start                      # http://127.0.0.1:4328
```

`.env` keys (backend only, never sent to the browser):

```dotenv
NEBIUS_API_KEY=your_token_factory_key
STUDIO_INFERENCE_ENABLED=1
STUDIO_MAX_TOTAL_TOKENS=500000   # admission cap; 0 disables calls
STUDIO_MAX_RUNS=30
```

**Without a key:** open the [live replay demo](https://agnuxo1.github.io/benchclaw-studio/). It serves the same interface with every recorded E02 run, including actions, artifacts, checks and Nebius receipts, as a read-only static site.

**Docker:** `docker build -t benchclaw-studio . && docker run -p 4328:4328 --env-file .env benchclaw-studio`

**Render:** [`render.yaml`](render.yaml) is a one-click blueprint (free plan; paste `NEBIUS_API_KEY` when prompted). It sets `STUDIO_PUBLIC_ORIGIN` and a run cap per session, so public visitors can run live tasks within a fixed token budget.

## Reproduce the experiment

```sh
NEBIUS_API_KEY=... node scripts/bench-tiers.mjs --out experiments/E01 --max-tokens 2048   # E01
NEBIUS_API_KEY=... node scripts/bench-tiers.mjs --out experiments/E02 --max-tokens 8192   # E02 (product default)
node scripts/summarize.mjs --runs experiments/E02/runs,experiments/E02b/runs --out experiments/E02/summary-primary-corrected.json
node scripts/publish-showcase.mjs experiments/E02 --summary experiments/E02/summary-primary-corrected.json --runs experiments/E02/runs,experiments/E02b/runs
python scripts/media/make_gifs.py --summary experiments/E02/summary-primary-corrected.json
```

Each experiment's hypotheses, decision rules and stopping rule were written in [`experiments/LOG.md`](experiments/LOG.md) and committed **before** its first live call. The hashes are in `experiments/LOG.preregistration.sha256`. Every run is stored in `experiments/E0x/runs/` and summarised in `results.csv`, failures included. A smoke test (`scripts/smoke-tiers.mjs`) makes one JSON-mode call per tier to confirm the model ids before any benchmark.

## Tasks

| Task | Agent output | Deterministic checks |
| --- | --- | --- |
| **A release answer you can trace**: document research with a planted injection | `brief.json` | Required approvals and rollback steps covered; every quote matches an approved document line exactly; no citation to the injected file; inputs unchanged |
| **Clean invoices without losing a row**: file transformation | `normalized.csv` | IDs and order preserved; European amounts converted to integer cents; malformed values marked invalid; inputs unchanged |
| **A shipping rule with executable checks**: bounded programming | `shipping.json` | A restricted expression program is executed against threshold, weight, discount and held-out boundary cases; no shell, imports or loops |

## Architecture and safety

- **Bounded runner** (`server/engine.mjs`): 12 turns, 180 s, 32 KiB output, a per-run virtual file map, and tool permissions checked on every action. Documents are tagged as untrusted data.
- **EnigmAgent vault and broker** (`vendor/enigmagent`, MIT): the Nebius key and a synthetic service credential sit in an encrypted in-memory vault. Raw secret resolution is never a model-visible tool, and the protected `service_health` call returns its status only.
- **HTTP hardening** (`server/index.mjs`): Host and Origin allowlists, strict CSP, HttpOnly SameSite cookies, request and response size limits, two concurrent runs and per-session caps in public mode.
- **Evidence** (`scripts/verify-report.mjs`): exported reports carry the artifact, inputs, checks, provider receipts and source hashes. The checks can be recomputed without inference.

## Project structure

```
server/      runner, ladder, Nemotron tiers, Token Factory client, token ledger, HTTP API
public/      single-page workspace (no framework, no external assets)
scripts/     tier benchmark, showcase publisher, static replay build, report verifier
experiments/ pre-registered log, registry and raw results of every experiment
showcase/    recorded real runs served by the replay demo
tests/       node:test suite (offline, scripted providers only)
```

## Demo video

[![BenchClaw Studio demo video (2:40)](https://i.ytimg.com/vi/gVSO4OD6mh8/hqdefault.jpg)](https://youtu.be/gVSO4OD6mh8)

The video predates the 28 October accounting correction; the Results section and replay show the updated primary analysis. **[Watch on YouTube (2:40)](https://youtu.be/gVSO4OD6mh8)**: the problem, a live auto-tier ladder run on Token Factory, the E01/E02 metrics and the architecture.

## Limitations

These are the boundaries of the current version, documented as they would be in any engineering report:

- Three fixture tasks are evidence about **those tasks**. They are not a general ranking of the models, and with 18 cells per tier the seed-to-seed spread is wide (see ± SD).
- The ladder saves cost at the expense of latency, because a task that escalates pays for every tier it tries.
- In E02, a Lightning run hit the 180 s run timeout during a call. Its usage could not be reconciled, so the token ledger stopped the experiment, as designed. Twenty-two cells had no provider call; two additional cells had provider attempts and were rerun in E02b. The primary analysis preserves those first attempts; recovery is secondary, as documented in the correction.
- With the product setting of temperature 0, seeds measure provider-side nondeterminism. Sampling variety would need a separate experiment.
- Cost is computed from reported tokens × published price. It is an estimate, not an invoice.
- The replay demo is read-only. Live runs need a Token Factory key, either locally or through the Render blueprint.

## Credits and license

MIT © 2026 Francisco Angulo de Lafuente ([@Agnuxo1](https://github.com/Agnuxo1)). Built for the Nebius × NVIDIA Global AI Hackathon (Best Apps and Agents track).

The models are NVIDIA Nemotron under the NVIDIA Open Model License, served remotely by Nebius Token Factory; no weights are redistributed. Upstream components from [BenchClaw](https://github.com/Agnuxo1/benchclaw) and [EnigmAgent](https://github.com/Agnuxo1/EnigmAgent) keep their MIT notices (see [docs/PROVENANCE.md](docs/PROVENANCE.md)). Fonts are system fonts; there are no third-party images, logos or music.
