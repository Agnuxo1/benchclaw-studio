<div align="center">

# BenchClaw Studio

**Find out which NVIDIA Nemotron actually delivers on your agent tasks, and what it really costs.**

Run real agent tasks on NVIDIA Nemotron through **Nebius Token Factory**, let deterministic checks decide pass or fail, and route every task to the smallest model tier that passes: Lightning first, then Super, then Ultra.

[![License: MIT](https://img.shields.io/badge/license-MIT-76b900.svg)](LICENSE)
[![Tests](https://github.com/Agnuxo1/benchclaw-studio/actions/workflows/test.yml/badge.svg)](https://github.com/Agnuxo1/benchclaw-studio/actions/workflows/test.yml)
![Node 22](https://img.shields.io/badge/node-22-339933.svg)
![NVIDIA Nemotron](https://img.shields.io/badge/NVIDIA-Nemotron%203%20%7C%203.5-76b900.svg)
![Nebius Token Factory](https://img.shields.io/badge/Nebius-Token%20Factory-0d1b2a.svg)

**[Live replay demo](https://agnuxo1.github.io/benchclaw-studio/)** · **[Demo video](https://youtu.be/LpHwFtMeQzY)** · **[Results](#results)** · **[Quick start](#quick-start)**

<img src="docs/media/architecture.gif" alt="Auto-tier ladder: the Studio API sends a task to Nemotron 3.5 Lightning; its checks fail, so it escalates to Nemotron 3 Super, which passes; Ultra is never called" width="900">

</div>

> **Nebius × NVIDIA Global AI Hackathon entry** (Best Apps and Agents). Devpost confirmed submission 1269138 on 28 October 2026. That is a submission receipt, not a judging result. The submitted commit is tagged `submitted-20261028`; later updates, made before the edit deadline, are recorded in [`experiments/LOG.md`](experiments/LOG.md).

**Contents** — [Why](#why) · [Background](#background) · [What it does](#what-it-does) · [Results](#results) · [How NVIDIA Nemotron and Nebius Token Factory are used](#how-nvidia-nemotron-and-nebius-token-factory-are-used) · [Feedback on Nebius Token Factory and NVIDIA Nemotron](#feedback-on-nebius-token-factory-and-nvidia-nemotron) · [Quick start](#quick-start) · [Reproduce the experiment](#reproduce-the-experiment) · [Tasks](#tasks) · [Architecture and safety](#architecture-and-safety) · [Project structure](#project-structure) · [Demo video](#demo-video) · [Limitations](#limitations) · [Real-world applications](#real-world-applications) · [Possible improvements](#possible-improvements) · [Future work](#future-work) · [Credits and license](#credits-and-license) · [Bibliography](#bibliography)

## Why

<p align="center"><img src="docs/readme/01-why.gif" alt="Three cards: always the largest model, always the smallest, and deterministic checks" width="100%"><br><sub>Fig. 1 — Illustrative: the choice described in this section.</sub></p>

Teams wiring an LLM agent into a real workflow face the same question again and again: **which model is good enough for this job?** If you always pick the largest model, you pay for capability you rarely need and wait longer for every answer. If you always pick the smallest, you ship silent failures: a CSV with a lost row, a citation that does not exist, or a pricing rule that breaks at the boundary.

A fluent answer does not show which of the two happened. BenchClaw Studio does.

## Background

<p align="center"><img src="docs/readme/02-background.gif" alt="Animated timeline from the BenchClaw and EnigmAgent baselines to the experiments of 28 October 2026" width="100%"><br><sub>Fig. 2 — Dates recorded in the repository. The Devpost receipt is a submission receipt, not a judging result.</sub></p>

Evaluating an agent means checking what it did, not how fluent it sounds. Software-engineering benchmarks such as
SWE-bench grade a model's patch by running tests [[1](#ref-1)], and AgentBench and τ-bench evaluate language models as
agents in interactive settings, τ-bench also over repeated trials [[2](#ref-2), [3](#ref-3)]. Using another LLM as the judge is
the alternative, but LLM judges show documented biases [[4](#ref-4)]. BenchClaw Studio takes the first route: each of
its three tasks has deterministic acceptance checks that are fixed before the run.

Cost is the second axis. Cascades and routers send a query to a cheaper model first and escalate or route only when
needed [[5](#ref-5), [6](#ref-6)], and agent evaluations that report accuracy alone can hide large cost differences [[7](#ref-7)].
The auto-tier ladder here is such a cascade with the deterministic checks as the escalation signal; its speculative
variant borrows the idea of speculative decoding, starting cheaper work in parallel [[8](#ref-8)], at the level of whole
runs. The experiments measure it, and the Results section says where the cost advantage did not hold.

NVIDIA describes Nemotron 3 Super and Ultra in a technical report [[9](#ref-9)]; the tiers used here are those two and
Nemotron 3.5 Lightning, served through the OpenAI-compatible API of Nebius Token Factory
[[10](#ref-10)]. Reasoning models spend inference-time compute [[11](#ref-11)]; in the Token Factory API that compute counts against the
output budget, which is what E01 exposed. One task plants an instruction in a source document, so its checks also probe indirect prompt
injection [[12](#ref-12), [13](#ref-13)]. Hypotheses, decision rules and stopping rules were committed before each experiment, in the
spirit of preregistration [[14](#ref-14)].

**Prior public work of the author.** BenchClaw [[15](#ref-15)] (a CLI, dashboard and adapters that call remote evaluation
services) and EnigmAgent [[16](#ref-16)] (an encrypted vault with a bounded operation broker) were public before this
project. Studio reuses three EnigmAgent v3 files byte for byte and adapts one HTTP request function from BenchClaw's
CLI; the Nebius client, task library, agent runner and experiments were created in the contest window. Details and hashes are in
[`docs/PROVENANCE.md`](docs/PROVENANCE.md).

## What it does

<p align="center"><img src="docs/readme/03-what-it-does.gif" alt="Task, agent on Nemotron, deterministic checks, escalation on failure, evidence on pass" width="100%"><br><sub>Fig. 3 — The run loop. A failed check escalates to the next tier; a pass ends the run with evidence.</sub></p>

1. **Defines success before the run.** Each task has versioned inputs and deterministic acceptance checks: exact quotes against source lines, integer-cent arithmetic, and held-out boundary cases.
2. **Runs a real agent on NVIDIA Nemotron.** The model chooses every action (read, write, check, finish). The runtime enforces tool permissions on every action, so a planted prompt injection cannot widen them.
3. **Escalates only when the checks fail.** The **auto-tier ladder** tries `Nemotron-3.5-Lightning`, then `Nemotron-3-Super`, then `Nemotron-3-Ultra`, and stops at the first tier whose output passes every check.
4. **Leaves evidence you can verify.** Every run records its actions, artifact, check results and Nebius request IDs, plus tokens, latency and cost. You can export it as a SHA-256-digested report and recompute its checks offline.

<!-- RESULTS:START -->
## Results

**182 benchmark runs that reached Nebius Token Factory, about $0.72 in total, in four pre-registered experiments.** Each grid is 3 tasks × 2 agent profiles × 3 seeds × 3 Nemotron tiers at temperature 0, and deterministic checks decide every pass or fail. The three tasks are controlled synthetic fixtures, so these are measurements on these tasks, not a general ranking of the models. Hypotheses, decision rules and stopping rules were committed with a SHA-256 hash before the first call of each experiment. Values are means over seeds ± sample SD. Every run, failures included, is in [`experiments/`](experiments) and in the [live replay demo](https://agnuxo1.github.io/benchclaw-studio/#evidence). The full record, with deviations and two corrections, is [`experiments/LOG.md`](experiments/LOG.md).

<img src="docs/media/experiments.gif" alt="Auto-tier ladder vs always Nemotron 3 Ultra in E01, E02 and E04. Tasks passed: 83% vs 67%, 83% vs 78%, 94% vs 89%. Cost per task: $0.0051 vs $0.0078, $0.0058–0.0060 vs $0.0061, $0.0073–0.0078 vs $0.0059" width="900">

**The honest answer: the ladder passes more tasks, but whether it saves money depends on the run.**

| Auto-tier ladder vs always Ultra | E01 (2,048 output tokens) | E02 (8,192) | E04 (8,192, fresh grid) |
| --- | --- | --- | --- |
| Tasks passed | **83% vs 67%** | **83% vs 78%** | **94% vs 89%** |
| Cost per task | **$0.0051 vs $0.0078** (−34%) | $0.0058–0.0060 vs $0.0061 (−1.5% to −5.5%) | $0.0073–0.0078 vs $0.0059 (+24% to +32%) |
| Mean time per task | 32.7 s vs 6.1 s | 54.1 s vs 7.2 s | 71.0 s vs 5.4 s |

- **The ladder passed more tasks than always using the largest model in every experiment.** Super and Ultra fail on *different* tasks. Super's release brief sometimes does not validate, and Ultra sometimes skips a required citation, so escalating on failed checks gets the best of each.
- **Its cost advantage did not hold up.** It was 34% cheaper in E01, only 1.5–5.5% cheaper in E02 and up to 32% dearer in E04, because every failed cheap attempt is paid for. *Corrections:* we first published 89% of tasks passed at "33% lower cost" for E02. Both figures were wrong. The cost averaged only the 17 of 18 cells whose cost was known, and the cell left out was the most expensive one: the provider reported at least $0.0353 of ladder spend in it, against $0.0088 for Ultra. An independent reanalysis then found that two E02 runs we had replaced with reruns had already called the model. The pre-registered rule keeps such runs, which gives 83%; the rerun analysis (89%) is kept as a labelled secondary result. Both corrections are explained in [`experiments/LOG.md`](experiments/LOG.md) and [`docs/RESULTS_CORRECTION_20261028.md`](docs/RESULTS_CORRECTION_20261028.md). Where a run lost its usage, costs are shown as low–high bounds.
- **Reasoning models need room to answer.** With a 2,048-token output budget (E01), Nemotron 3.5 Lightning ran out of tokens while still thinking in 17 of 18 runs. At 8,192 tokens (E02), its pass rate rose from 6% to 61%. Following the pre-registered rule, 8,192 is now the Studio default.
- **Ultra is the fastest tier on Token Factory.** It took 5–7 s per task because it needed the fewest turns and tokens, even though Lightning streams more tokens per second. For latency-critical work, start at Ultra. Studio shows every policy, so you choose with numbers.

### Attacking the ladder's latency (E03, E04)

<img src="docs/media/policy.gif" alt="E04 routing policies: auto-tier ladder $0.0073–0.0078 per task with 94% passed; always Super $0.0033 with 56%; always Ultra $0.0059 with 89%" width="860">

| Policy, E04 grid (54 runs) | Tasks passed | Cost per task | Mean time | Median time |
| --- | --- | --- | --- | --- |
| Auto-tier ladder (Lightning → Super → Ultra) | 94.4% ± 9.6 | $0.0073–0.0078 | 71.0 s | 39.9 s |
| Always Nemotron 3 Ultra | 88.9% ± 9.6 | $0.0059 | 5.4 s | 4.5 s |
| Always Nemotron 3 Super | 55.6% ± 9.6 | $0.0033 | 14.2 s | 10.0 s |
| Speculative ladder: Lightning and Super together, Ultra if both fail | 94.4% ± 9.6 | $0.0084–0.0089 | 38.6 s | 13.6 s |
| Tier memory: start where the task last passed | 94.4% ± 9.6 | $0.0050 | 34.2 s | 21.2 s |

- **Both new policies were pre-registered against a 30 s mean answer time, and both missed it.** The speculative ladder halved the ladder's time, but it pays for two tiers on every task, so it cost more than always-Ultra. It was rejected, and it is not offered in Studio. **Tier memory** kept the ladder's pass rate with about half its time and a third less cost, and it was the cheapest policy that passed 94%. It was rejected only on the 30 s target, so it is the next thing we will test.
- **E03 could not answer the question.** A slow provider call stopped the whole grid twice. Lightning's served throughput fell from 264 to 78 tokens/s within the day, so an 8,192-token call no longer fit our fixed 45 s per-call timeout. The aborted call returned no usage, and our fail-closed token ledger stopped everything, as designed. Only 5 of 18 cells finished.
- **The fix is now in the product.** A provider call may use the run's remaining time, and the 180 s run limit is unchanged. The benchmark now keeps one ledger per run. E04 confirmed it, pre-registered as H11: there were no provider timeouts and no lost cells.

| Hypothesis (pre-registered) | Outcome |
| --- | --- |
| H1 · E01: ladder ≥ always-Ultra − 5 pts and cheaper | **Accepted**: 83.3% vs 66.7%, $0.0051 vs $0.0078 |
| H2 · E01: latency Lightning < Super < Ultra | **Rejected**: Ultra was fastest (6.1 s vs 14.0 s vs 17.9 s) |
| H3 · E01: pass rate Ultra ≥ Super ≥ Lightning | **Accepted**: 66.7% = 66.7% > 5.6% |
| H4 · E02: Lightning recovers with 8,192 output tokens | **Accepted**: 5.6% → 61.1%; truncations 17/18 → 1/18 |
| H5 · E02: ladder ≥ always-Ultra − 5 pts and cheaper | **Accepted**: 83.3% vs 77.8%, $0.0058–0.0060 vs $0.0061 (corrected) |
| H6 · E02: no regression for Super and Ultra | **Accepted** |
| H7, H8 · E03: speculative ladder, tier memory < 30 s and cheaper than Ultra | **Not accepted**: on the 5 complete cells, 26.6 s but cost $0.0041–0.0059 vs $0.0051; tier memory never applied |
| H9 · E04: speculative ladder < 30 s and cheaper than Ultra | **Rejected**: 38.6 s, $0.0084–0.0089 vs $0.0059 |
| H10 · E04: tier memory < 30 s and cheaper than Ultra | **Rejected** on time: 34.2 s; cost $0.0050 vs $0.0059 |
| H11 · E04: call timeout bounded by the run | **Accepted**: no provider timeouts, 54/54 runs |

<img src="docs/media/budget.gif" alt="Tasks passed per tier at 2,048 vs 8,192 output tokens: Lightning 6% to 61%, Super 67% to 67%, Ultra 67% to 78%" width="860">

<img src="docs/media/tiers.gif" alt="E04 per tier: tasks passed 56%, 56%, 89%; mean run time 60.7 s, 14.2 s, 5.4 s; cost per run up to $0.0039, $0.0033, $0.0059" width="900">
<!-- RESULTS:END -->

## How NVIDIA Nemotron and Nebius Token Factory are used

<p align="center"><img src="docs/readme/04-nemotron-token-factory.gif" alt="Module map: runner, ladder, tiers, token ledger, provider client and Nebius Token Factory" width="100%"><br><sub>Fig. 4 — Where each module sits. Tokens are reserved before a call and reconciled with the reported usage.</sub></p>

| Where | What runs | Why it matters |
| --- | --- | --- |
| `server/nebius.mjs` | OpenAI-compatible `POST /v1/chat/completions` on `api.tokenfactory.nebius.com`, JSON-object mode, provider seed, 8,192-token output budget for reasoning tiers | Every agent turn is a real Token Factory call; nothing is simulated or cached |
| `server/models.mjs` | `nvidia/Nemotron-3_5-Lightning`, `nvidia/nemotron-3-super-120b-a12b`, `nvidia/Nemotron-3-Ultra-550b-a55b` | Three Nemotron tiers behind one API. Switching tiers is a one-field change, which is what makes the ladder cheap to build |
| `server/ladder.mjs` | Auto-tier ladder: cheapest first, escalate on failed checks, halt on budget or auth errors | Follows the track guidance to use Nano and Super for fast, everyday calls and Ultra only when it is needed, with evidence for each choice |
| `server/token-budget.mjs` | Durable token reservations before each call, reconciled with the usage Nebius reports | A public demo cannot overspend: admission control is enforced before any request leaves the server |
| `scripts/bench-tiers.mjs` | The pre-registered E01–E04 grids on all three tiers (182 runs that reached Token Factory), plus the live speculative mode and a strict per-call USD stop | The routing claim is measured, not asserted, including where it failed |

Token Factory accelerated this project in two ways. First, all three Nemotron tiers sit behind one endpoint and one key, so the comparison needed no infrastructure. Second, it reports usage per call, so cost per task comes straight from provider receipts.

## Feedback on Nebius Token Factory and NVIDIA Nemotron

<p align="center"><img src="docs/readme/05-throughput-feedback.gif" alt="Dumbbell chart of served tokens per second for three tiers, E02 against E03" width="100%"><br><sub>Fig. 5 — Throughput changed within a day. Data: the Feedback text below and experiments/LOG.md.</sub></p>

What worked well:
- **One endpoint and one key for every Nemotron tier.** Because Token Factory is OpenAI-compatible, the ladder is a single `model` field. No extra infrastructure was needed to compare 30B, 120B and 550B models.
- **Usage is reported per call, including `reasoning_tokens`.** That made cost per task and the E01 diagnosis possible from provider data alone.
- **Request IDs on every response** make each recorded run traceable. The echoed `model` matched the requested id in every recorded call.
- **Nemotron 3 Ultra was the fastest tier we measured**, with the fewest turns and tokens per task.

What would help builders:
- **Guidance on output budgets for reasoning models.** Reasoning tokens count against `max_tokens`. At 2,048, Nemotron 3.5 Lightning stopped with `finish_reason=length` in 17 of 18 runs, before writing any answer, and Nemotron 3 Ultra did so in 3 runs (E01). A documented recommended budget, or a reasoning-effort or budget parameter, would prevent this silent failure.
- **Usage for aborted requests.** When a non-streaming request is cancelled or times out on the client, no usage comes back, so the cost of that call cannot be reconciled. This happened five times in our runs: three runs cut at the 180 s run limit (one in E02, two in E04) and two calls past a 45 s client timeout (E03, E03b). Three of those times, our fail-closed token ledger had to stop the whole experiment. A usage lookup by request ID, or documented usage reporting for cancelled streams, would let builders account for every call ([`experiments/LOG.md`](experiments/LOG.md), E02 and E03 stopping events).
- **Throughput that changes within a day.** For the same prompts and settings, the median served throughput of Nemotron 3.5 Lightning fell from 264 completion tokens per second of call time (E02, from 12:35 UTC on 2026-10-28) to 78 (E03, 14:44–15:30 UTC). Super went from 125 to 84, while Ultra held at 138. A per-model status or latency indicator would help builders set timeouts; we now bound each call by the run's own time limit instead of a fixed 45 s.
- **Consistent model ids.** The catalog shows `Nemotron-3.5-Lightning`, while the API id is `nvidia/Nemotron-3_5-Lightning`. `/v1/models` lists `Nemotron-3_5-Lightning` next to `Nemotron-3.5-Super-VL` (underscore against dot, in the same family) and `NVIDIA-Nemotron-3-Nano-30B-A3B` (the vendor name repeated), and casing differs across tiers (`nemotron-3-super-120b-a12b` versus `Nemotron-3-Ultra-550b-a55b`). Evidence: [`experiments/smoke-20261028.json`](experiments/smoke-20261028.json).
- **One cache-accounting schema.** Every response carries `prompt_cache_hit_tokens` and `prompt_cache_miss_tokens`, and also `prompt_tokens_details`. That second object is `null` for Lightning, includes `created_cache_tokens` for Super, and omits it for Ultra (same smoke test).
- **Empty content with `finish_reason=stop`.** It happened once, when the model returned only reasoning. A distinct finish reason would make this case explicit.

## Quick start

<p align="center"><img src="docs/readme/06-quick-start.gif" alt="Terminal running npm test: 54 tests pass" width="100%"><br><sub>Fig. 6 — A real local run of the offline test suite on a copy of the published source.</sub></p>

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

**Without a key:** open the [live replay demo](https://agnuxo1.github.io/benchclaw-studio/). It serves the same interface with every recorded E04 run, including actions, artifacts, checks and Nebius receipts, as a read-only static site.

**Docker:** `docker build -t benchclaw-studio . && docker run -p 4328:4328 --env-file .env benchclaw-studio`

**Render:** [`render.yaml`](render.yaml) is a one-click blueprint (free plan; paste `NEBIUS_API_KEY` when prompted). It sets `STUDIO_PUBLIC_ORIGIN` and a run cap per session, so public visitors can run live tasks within a fixed token budget.

## Reproduce the experiment

<p align="center"><img src="docs/readme/07-reproduce.gif" alt="Four-step pipeline and bars with the number of runs per experiment, 182 in total" width="100%"><br><sub>Fig. 7 — The reproduction path and the runs behind the Results. Data: experiments/LOG.md.</sub></p>

```sh
NEBIUS_API_KEY=... node scripts/bench-tiers.mjs --out experiments/E01 --max-tokens 2048   # E01
NEBIUS_API_KEY=... node scripts/bench-tiers.mjs --out experiments/E02 --max-tokens 8192   # E02 (product default)
NEBIUS_API_KEY=... node scripts/bench-tiers.mjs --out experiments/E04 --ledger per-run --usd-cap 0.40   # E04
NEBIUS_API_KEY=... node scripts/bench-tiers.mjs --policy speculative --out experiments/E04-live --ledger per-run --usd-cap 0.25   # live speculative ladder (not run: H9 rejected)
node scripts/summarize.mjs --runs experiments/E02/runs,experiments/E02b/runs --out experiments/E02/summary-primary-corrected.json   # first attempts kept (primary)
node scripts/summarize.mjs --runs experiments/E02/runs,experiments/E02b/runs --recover-ledger-failures --out experiments/E02/summary-recovery-explicit.json   # secondary
node scripts/audit-history.mjs   # provider attempts and ledger-only rows, no inference
node scripts/summarize.mjs --runs experiments/E04/runs --out experiments/E04/summary-analysis.json
node scripts/publish-showcase.mjs experiments/E04 --summary experiments/E04/summary-analysis.json --runs experiments/E04/runs
python scripts/media/make_gifs.py --no-architecture --experiments "E01 (2,048 tokens)=experiments/E01/summary-corrected.json;E02 (8,192)=experiments/E02/summary-primary-corrected.json;E04 (8,192)=experiments/E04/summary-analysis.json" --summary experiments/E04/summary-analysis.json --label E04
```

Each experiment's hypotheses, decision rules and stopping rule were written in [`experiments/LOG.md`](experiments/LOG.md) and committed **before** its first live call. The hashes are in `experiments/LOG.preregistration.sha256`. Every run is stored in `experiments/E0x/runs/` and summarised in `results.csv`, failures included. `--usd-cap` checks every provider call against a strict monetary limit, from prompt size and output budget at the published price, so a benchmark cannot overspend. A smoke test (`scripts/smoke-tiers.mjs`) makes one JSON-mode call per tier to confirm the model ids before any benchmark.

## Tasks

<p align="center"><img src="docs/readme/08-tasks.gif" alt="Three task cards with their output files and deterministic checks" width="100%"><br><sub>Fig. 8 — The three tasks and what their checks verify.</sub></p>

| Task | Agent output | Deterministic checks |
| --- | --- | --- |
| **A release answer you can trace**: document research with a planted injection | `brief.json` | Required approvals and rollback steps covered; every quote matches an approved document line exactly; no citation to the injected file; inputs unchanged |
| **Clean invoices without losing a row**: file transformation | `normalized.csv` | IDs and order preserved; European amounts converted to integer cents; malformed values marked invalid; inputs unchanged |
| **A shipping rule with executable checks**: bounded programming | `shipping.json` | A restricted expression program is executed against threshold, weight, discount and held-out boundary cases; no shell, imports or loops |

## Architecture and safety

<p align="center"><img src="docs/readme/09-architecture-safety.gif" alt="Four cards: bounded runner, EnigmAgent vault and broker, HTTP hardening, evidence" width="100%"><br><sub>Fig. 9 — The four safeguards described below.</sub></p>

- **Bounded runner** (`server/engine.mjs`): 12 turns, 180 s, 32 KiB output, a per-run virtual file map, and tool permissions checked on every action. Documents are tagged as untrusted data.
- **EnigmAgent vault and broker** (`vendor/enigmagent`, MIT): the Nebius key and a synthetic service credential sit in an encrypted in-memory vault. Raw secret resolution is never a model-visible tool, and the protected `service_health` call returns its status only.
- **HTTP hardening** (`server/index.mjs`): Host and Origin allowlists, strict CSP, HttpOnly SameSite cookies, request and response size limits, two concurrent runs and per-session caps in public mode.
- **Evidence** (`scripts/verify-report.mjs`): exported reports carry the artifact, inputs, checks, provider receipts and source hashes. The checks can be recomputed without inference.

## Project structure

<p align="center"><img src="docs/readme/10-project-structure.gif" alt="Folder map with arrows showing which folder writes or serves which" width="100%"><br><sub>Fig. 10 — Schematic of the directory layout.</sub></p>

```
server/      runner, ladder, Nemotron tiers, Token Factory client, token ledger, HTTP API
public/      single-page workspace (no framework, no external assets)
scripts/     tier benchmark, showcase publisher, static replay build, report verifier
experiments/ pre-registered log, registry and raw results of every experiment
showcase/    recorded real runs served by the replay demo
tests/       node:test suite (offline, scripted providers only)
```

## Demo video

[![BenchClaw Studio demo video (2:53)](https://i.ytimg.com/vi/LpHwFtMeQzY/hqdefault.jpg)](https://youtu.be/LpHwFtMeQzY)

**[Watch on YouTube (2:53)](https://youtu.be/LpHwFtMeQzY)**: the problem, a live auto-tier ladder run on Token Factory, the measured results of all four experiments and the architecture. It replaces the first video of 28 October, whose E02 figures were later corrected (see Results).

## Limitations

These are the boundaries of the current version, documented as they would be in any engineering report:

<p align="center"><img src="docs/readme/11-limitations.gif" alt="Mean time per task for the ladder and always Ultra, and the ladder's cost change in three experiments" width="100%"><br><sub>Fig. 11 — Data: the Results table and experiments/LOG.md.</sub></p>

- Three fixture tasks are evidence about **those tasks**. They are not a general ranking of the models, and with 18 cells per tier the seed-to-seed spread is wide (see ± SD).
- The ladder raises the pass rate, but it is slower than always-Ultra, and its cost advantage depends on the run: from −34% to +32% across our experiments. A task that escalates pays for every tier it tries.
- Provider throughput changes within a day (Lightning 264 → 78 tokens/s on 2026-10-28), so latency figures hold for the time they were measured.
- A call cut by the run limit returns no usage. The ledger then fails closed: in the Studio server it blocks new calls, and in the benchmark it stops that run. Costs of such runs are reported as low–high bounds. E02 and E03 were stopped this way. Only the cells that never reached the model were completed; ledger-stopped runs that had already called the model are kept as failures, as the log records.
- With the product setting of temperature 0, seeds measure provider-side nondeterminism. Sampling variety would need a separate experiment.
- Cost is computed from reported tokens × published price. It is an estimate, not an invoice.
- The replay demo is read-only. Live runs need a Token Factory key, either locally or through the Render blueprint.

## Real-world applications

<p align="center"><img src="docs/readme/12-applications.gif" alt="Six application cards appearing one after another" width="100%"><br><sub>Fig. 12 — Potential uses that follow from the measured design; none is a deployed application.</sub></p>

The method is not tied to the three fixture tasks. Applications that could follow, each needing the user's own tasks
and checks first:

- **Choosing a tier per workflow.** Before wiring an agent into a job, run that job's tasks and checks on each
  Nemotron tier and compare pass rate, time and cost together, as cost-aware agent evaluation argues [[7](#ref-7)].
- **Setting a latency policy.** Use the ladder when pass rate matters most and start at Ultra for latency-critical
  work; the Results show both with their measured costs.
- **Re-testing after provider changes.** Repeat the grid when a model, a price or the served throughput changes,
  because the latency figures hold only for the time they were measured.
- **Probing prompt-injection exposure.** A planted instruction in a source document is checked for being cited, and
  tool permissions are enforced so it cannot widen them, in the spirit of agent security benchmarks [[12](#ref-12), [13](#ref-13)].
- **Audit evidence.** Exported reports carry source hashes and provider receipts, so a reviewer can recompute the
  checks offline without running inference.
- **A template for honest benchmarks.** Pre-registered hypotheses, failures kept and corrections logged can be
  reused for other agent tasks.

## Possible improvements

<p align="center"><img src="docs/readme/13-improvements.gif" alt="Four stated limitations on the left turning into proposed next experiments on the right" width="100%"><br><sub>Fig. 13 — Each improvement targets a limitation stated in this README.</sub></p>

- **More tasks and seeds.** Three fixture tasks and 18 cells per tier leave a wide seed-to-seed spread. Larger and
  more varied task sets, with repeated trials as in τ-bench [[3](#ref-3)], would narrow it. The next grid should be
  pre-registered [[14](#ref-14)].
- **Test tier memory.** In E04 it matched the ladder's 94.4% with a mean time of 34.2 s and $0.0050 per task, and
  was rejected only on the 30 s target. It is the next policy to test, with its target fixed in advance.
- **Separate provider load from policy.** Throughput changed within a day (Lightning 264 to 78 tokens/s), so
  repeating grids at different hours would show how much of the latency depends on the time of measurement.
- **Account for every call.** A call cut by the run limit returns no usage and the ledger fails closed. A provider
  usage lookup by request ID, as requested in the feedback above, would let the cost of such runs be reported exactly
  instead of as low–high bounds.
- **Measure sampling variety.** At temperature 0 the seeds only measure provider-side nondeterminism [[17](#ref-17)]. A
  separate experiment with sampling would measure variety.
- **Check cost against billing.** Cost is computed from reported tokens and published prices; comparing it with an
  invoice would test that estimate.

## Future work

<p align="center"><img src="docs/readme/14-roadmap.gif" alt="Roadmap with three completed milestones and three proposed steps" width="100%"><br><sub>Fig. 14 — Completed milestones are documented in this repository; the rest are proposed next steps; none is claimed as started.</sub></p>

Proposed next steps, in order; none is claimed as started:

1. Pre-register and run the tier-memory test that the Results name as the next one to run.
2. Extend the task set and the number of seeds, and report the spread again.
3. Repeat the grids at different times of day and report throughput per call as a covariate.
4. Add a sampling experiment to measure variety beyond temperature 0.
5. Compare the computed costs with the provider's billing data.

## Credits and license

MIT © 2026 Francisco Angulo de Lafuente ([@Agnuxo1](https://github.com/Agnuxo1)). Built for the Nebius × NVIDIA Global AI Hackathon (Best Apps and Agents track).

The models are NVIDIA Nemotron under the NVIDIA Open Model License, served remotely by Nebius Token Factory; no weights are redistributed. Upstream components from [BenchClaw](https://github.com/Agnuxo1/benchclaw) and [EnigmAgent](https://github.com/Agnuxo1/EnigmAgent) keep their MIT notices (see [docs/PROVENANCE.md](docs/PROVENANCE.md)). Fonts are system fonts; there are no third-party images, logos or music.

## Bibliography

1. <a id="ref-1"></a>Jimenez, C. E., Yang, J., Wettig, A., et al. (2023). SWE-bench: Can Language Models Resolve Real-World GitHub Issues?. *arXiv* 2310.06770. https://arxiv.org/abs/2310.06770
2. <a id="ref-2"></a>Liu, X., Yu, H., Zhang, H., et al. (2023). AgentBench: Evaluating LLMs as Agents. *arXiv* 2308.03688. https://arxiv.org/abs/2308.03688
3. <a id="ref-3"></a>Yao, S., Shinn, N., Razavi, P., & Narasimhan, K. (2024). τ-bench: A benchmark for tool-agent-user interaction in real-world domains. *arXiv* 2406.12045. https://arxiv.org/abs/2406.12045
4. <a id="ref-4"></a>Zheng, L., Chiang, W., Sheng, Y., et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena. *arXiv* 2306.05685. https://arxiv.org/abs/2306.05685
5. <a id="ref-5"></a>Chen, L., Zaharia, M., & Zou, J. (2023). FrugalGPT: How to Use Large Language Models While Reducing Cost and Improving Performance. *arXiv* 2305.05176. https://arxiv.org/abs/2305.05176
6. <a id="ref-6"></a>Ong, I., Almahairi, A., Wu, V., et al. (2024). RouteLLM: Learning to Route LLMs with Preference Data. *arXiv* 2406.18665. https://arxiv.org/abs/2406.18665
7. <a id="ref-7"></a>Kapoor, S., Stroebl, B., Siegel, Z. S., Nadgir, N., & Narayanan, A. (2024). AI Agents That Matter. *arXiv* 2407.01502. https://arxiv.org/abs/2407.01502
8. <a id="ref-8"></a>Leviathan, Y., Kalman, M., & Matias, Y. (2022). Fast Inference from Transformers via Speculative Decoding. *arXiv* 2211.17192. https://arxiv.org/abs/2211.17192
9. <a id="ref-9"></a>NVIDIA, Blakeman, A., et al. (2025). NVIDIA Nemotron 3: Efficient and open intelligence. *arXiv* 2512.20856. https://arxiv.org/abs/2512.20856
10. <a id="ref-10"></a>Nebius (2026). *Nebius Token Factory documentation*. https://docs.tokenfactory.nebius.com/
11. <a id="ref-11"></a>Snell, C., Lee, J., Xu, K., & Kumar, A. (2024). Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters. *arXiv* 2408.03314. https://arxiv.org/abs/2408.03314
12. <a id="ref-12"></a>Greshake, K., Abdelnabi, S., Mishra, S., et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection. *arXiv* 2302.12173. https://arxiv.org/abs/2302.12173
13. <a id="ref-13"></a>Debenedetti, E., Zhang, J., Balunović, M., et al. (2024). AgentDojo: A Dynamic Environment to Evaluate Prompt Injection Attacks and Defenses for LLM Agents. *arXiv* 2406.13352. https://arxiv.org/abs/2406.13352
14. <a id="ref-14"></a>Nosek, B. A., Ebersole, C. R., DeHaven, A. C., & Mellor, D. T. (2018). The preregistration revolution. *Proceedings of the National Academy of Sciences*, 115(11), 2600–2606. https://doi.org/10.1073/pnas.1708274114
15. <a id="ref-15"></a>Angulo de Lafuente, F. (2026). *BenchClaw* [Software repository, MIT licence]. GitHub. https://github.com/Agnuxo1/benchclaw
16. <a id="ref-16"></a>Angulo de Lafuente, F. (2026). *EnigmAgent* [Software repository, MIT licence]. GitHub. https://github.com/Agnuxo1/EnigmAgent
17. <a id="ref-17"></a>Atil, B., Aykent, S., Chittams, A., et al. (2024). Non-Determinism of "Deterministic" LLM Settings. *arXiv* 2408.04667. https://arxiv.org/abs/2408.04667

---

<div align="center">
<sub>Built by <a href="https://github.com/Agnuxo1">Francisco Angulo de Lafuente</a> · each added figure names its
data source in its footer, and schematic figures say so · <a href="#benchclaw-studio">back to top ↑</a></sub>
</div>
