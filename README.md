<div align="center">

# BenchClaw Studio

**Use the cheapest NVIDIA Nemotron that actually delivers.**

Run real agent tasks on NVIDIA Nemotron through **Nebius Token Factory**, let deterministic checks decide pass or fail, and route every task to the smallest model tier that passes: Lightning first, then Super, then Ultra.

[![License: MIT](https://img.shields.io/badge/license-MIT-76b900.svg)](LICENSE)
[![Tests](https://github.com/Agnuxo1/benchclaw-studio/actions/workflows/test.yml/badge.svg)](https://github.com/Agnuxo1/benchclaw-studio/actions/workflows/test.yml)
![Node 22](https://img.shields.io/badge/node-22-339933.svg)
![NVIDIA Nemotron](https://img.shields.io/badge/NVIDIA-Nemotron%203%20%7C%203.5-76b900.svg)
![Nebius Token Factory](https://img.shields.io/badge/Nebius-Token%20Factory-0d1b2a.svg)

**[Live replay demo](https://agnuxo1.github.io/benchclaw-studio/)** · **[Demo video](#demo-video)** · **[Results](#results-e01)** · **[Quick start](#quick-start)**

<img src="docs/media/architecture.gif" alt="Auto-tier ladder: the Studio API sends a task to Nemotron 3.5 Lightning; its checks fail, so it escalates to Nemotron 3 Super, which passes; Ultra is never called" width="900">

</div>

## Why

Teams wiring an LLM agent into a real workflow face the same question again and again: **which model is good enough for this job?** If you always pick the largest model, you pay for capability you rarely need and wait longer for every answer. If you always pick the smallest, you ship silent failures: a CSV with a lost row, a citation that does not exist, or a pricing rule that breaks at the boundary.

A fluent answer does not show which of the two happened. BenchClaw Studio does.

## What it does

1. **Defines success before the run.** Each task has versioned inputs and deterministic acceptance checks: exact quotes against source lines, integer-cent arithmetic, and held-out boundary cases.
2. **Runs a real agent on NVIDIA Nemotron.** The model chooses every action (read, write, check, finish). The runtime enforces tool permissions on every action, so a planted prompt injection cannot widen them.
3. **Escalates only when the checks fail.** The **auto-tier ladder** tries `Nemotron-3.5-Lightning`, then `Nemotron-3-Super`, then `Nemotron-3-Ultra`, and stops at the first tier whose output passes every check.
4. **Leaves evidence you can verify.** Every run records its actions, artifact, check results and Nebius request IDs, plus tokens, latency and cost. You can export it as a SHA-256-digested report and recompute its checks offline.

<!-- RESULTS:START -->
## Results

**108 live runs on Nebius Token Factory, about $0.43 in total.** There were two pre-registered experiments: 3 tasks × 2 agent profiles × 3 seeds × 3 Nemotron tiers each, temperature 0, and every pass or fail decided by deterministic checks. Values are means over seeds ± sample SD. Every run, failures included, is in [`experiments/`](experiments) and in the [live replay demo](https://agnuxo1.github.io/benchclaw-studio/#evidence).

<img src="docs/media/policy.gif" alt="Routing policies on the E02 grid: auto-tier ladder $0.0041 per task with 89% passed; always Super $0.0037 with 67%; always Ultra $0.0061 with 78%" width="860">

| Policy (E02, product settings) | Tasks passed | Cost per task | Mean time per task |
| --- | --- | --- | --- |
| **Auto-tier ladder** (Lightning → Super → Ultra) | **88.9% ± 9.6** | **$0.0041** | 55.1 s |
| Always Nemotron 3 Ultra | 77.8% ± 9.6 | $0.0061 | 7.2 s |
| Always Nemotron 3 Super | 66.7% ± 16.7 | $0.0037 | 19.4 s |

- **The ladder passes more tasks than always using the largest model, and costs 33% less.** Super and Ultra fail on *different* tasks: Super's release brief sometimes does not validate, and Ultra sometimes skips a required citation. Escalating on failed checks gets the best of each. The ladder settled 12 of 18 task cells on the cheapest tier.
- **Reasoning models need room to answer.** With a 2,048-token output budget (E01), Nemotron 3.5 Lightning ran out of tokens while still thinking in 17 of 18 runs. At 8,192 tokens (E02), its pass rate rose from 6% to 67%. Following the pre-registered rule, 8,192 is now the Studio default.
- **Ultra is the fastest tier on Token Factory.** It averaged 7.2 s per task, needed the fewest turns and tokens, and served the most tokens per second. The ladder trades latency for cost. For latency-critical work, start at Ultra; Studio lets you choose either.

<img src="docs/media/budget.gif" alt="Tasks passed per tier at 2,048 vs 8,192 output tokens: Lightning 6% to 67%, Super 67% to 67%, Ultra 67% to 78%" width="860">

<img src="docs/media/tiers.gif" alt="E02 per tier: tasks passed 67%, 67%, 78%; mean run time 46.6 s, 19.4 s, 7.2 s; cost per run $0.0028, $0.0037, $0.0061" width="900">

| Hypothesis (pre-registered) | Outcome |
| --- | --- |
| H1 · E01: ladder ≥ always-Ultra − 5 pts and cheaper | **Accepted**: 83.3% vs 66.7%, $0.0051 vs $0.0078 |
| H2 · E01: latency Lightning < Super < Ultra | **Rejected**: Ultra was fastest (6.1 s vs 14.0 s vs 17.9 s) |
| H3 · E01: pass rate Ultra ≥ Super ≥ Lightning | **Accepted**: 66.7% = 66.7% > 5.6% |
| H4 · E02: Lightning recovers with 8,192 output tokens | **Accepted**: 5.6% → 66.7%; truncations 17/18 → 1/18 |
| H5 · E02: ladder ≥ always-Ultra − 5 pts and cheaper | **Accepted**: 88.9% vs 77.8%, $0.0041 vs $0.0061 |
| H6 · E02: no regression for Super and Ultra | **Accepted** |

Full tables, failure analysis and the deviation note are in [`experiments/LOG.md`](experiments/LOG.md).
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
node scripts/summarize.mjs --runs experiments/E02/runs,experiments/E02b/runs --out experiments/E02/summary-combined.json
node scripts/publish-showcase.mjs experiments/E02 --summary experiments/E02/summary-combined.json --runs experiments/E02/runs,experiments/E02b/runs
python scripts/media/make_gifs.py --summary experiments/E02/summary-combined.json
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

_Link added at release._

## Limitations

These are the boundaries of the current version, documented as they would be in any engineering report:

- Three fixture tasks are evidence about **those tasks**. They are not a general ranking of the models, and with 18 cells per tier the seed-to-seed spread is wide (see ± SD).
- The ladder saves cost at the expense of latency, because a task that escalates pays for every tier it tries.
- In E02, a Lightning run hit the 180 s run timeout during a call. Its usage could not be reconciled, so the token ledger stopped the experiment, as designed. The 24 cells that never reached the model were completed with identical settings (E02b), as documented in the log.
- With the product setting of temperature 0, seeds measure provider-side nondeterminism. Sampling variety would need a separate experiment.
- Cost is computed from reported tokens × published price. It is an estimate, not an invoice.
- The replay demo is read-only. Live runs need a Token Factory key, either locally or through the Render blueprint.

## Credits and license

MIT © 2026 Francisco Angulo de Lafuente ([@Agnuxo1](https://github.com/Agnuxo1)). Built for the Nebius × NVIDIA Global AI Hackathon (Best Apps and Agents track).

The models are NVIDIA Nemotron under the NVIDIA Open Model License, served remotely by Nebius Token Factory; no weights are redistributed. Upstream components from [BenchClaw](https://github.com/Agnuxo1/benchclaw) and [EnigmAgent](https://github.com/Agnuxo1/EnigmAgent) keep their MIT notices (see [docs/PROVENANCE.md](docs/PROVENANCE.md)). Fonts are system fonts; there are no third-party images, logos or music.
