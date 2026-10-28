# Experiment log

Every hypothesis is written here **before** its runs. Negative results stay in the log.
The registry with one row per experiment is [`experiments.csv`](experiments.csv); per-run rows are in each experiment's `results.csv`.

## E01 — Nemotron tier ladder on Nebius Token Factory (pre-registered 2026-10-28, before any live call)

**Question.** For bounded agent tasks with deterministic acceptance checks, does a ladder that tries the cheapest Nemotron tier first and escalates only on failure keep the success rate of the strongest tier at a lower cost?

**Control.** `nvidia/nemotron-3-super-120b-a12b` (Nemotron 3 Super), the Studio default before this experiment. The *always-Ultra* policy is the quality reference.

**Arms.** `nvidia/Nemotron-3_5-Lightning`, `nvidia/nemotron-3-super-120b-a12b` and `nvidia/Nemotron-3-Ultra-550b-a55b`, all through `https://api.tokenfactory.nebius.com/v1/chat/completions`.

**Design.** 3 tasks × 2 agent profiles × 3 seeds (11, 22, 33) × 3 tiers = 54 runs. Product settings unchanged: temperature 0, JSON-object responses, at most 12 turns, 2,048 output tokens per call, 180 s per run, same tool permissions. The seed is sent to the provider; with temperature 0, repeats measure provider-side nondeterminism. The ladder policy is evaluated offline on the same grid (Lightning → Super → Ultra, stop at the first passing run). No extra calls are made.

**Metrics.** (1) The task passes when all of the Studio's deterministic acceptance checks pass (`server/tasks.mjs`, validator v2); (2) wall-clock run time; (3) provider-reported tokens; (4) cost in USD = reported tokens × the published Token Factory price. When a price is not verified, the cost is reported as unknown.

**Hypotheses and decision rules.**
- **H1 (ladder).** Ladder pass rate ≥ always-Ultra pass rate − 0.05 (mean over seeds), **and** ladder mean cost per task < always-Ultra mean cost. Accepted only if both hold.
- **H2 (latency).** Mean run time: Lightning < Super < Ultra. Each inequality is judged separately.
- **H3 (capability).** Pass rate: Ultra ≥ Super ≥ Lightning. Each inequality is judged separately; a reversal is reported as such.

**Stopping rule.** Hard token reservation cap of 3,000,000 (application ledger). Any `token_*` error stops the experiment, and runs completed so far are reported as partial.

**Results.** _Pending. Filled in only from `experiments/E01/summary.json`._
