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

**Results (2026-10-28, 54/54 runs, commit a3eb5b0 settings, `experiments/E01/summary.json`).** Pass rates are means over the three seeds ± sample SD. Cost and time are means per task.

| Tier / policy | Pass rate | Mean run time | Mean tokens | Mean cost (USD) |
| --- | --- | --- | --- | --- |
| Nemotron 3.5 Lightning | 0.056 ± 0.096 | 17.9 s | 4,092 | 0.00077 |
| Nemotron 3 Super (control) | 0.667 ± 0.167 | 14.0 s | 5,105 | 0.00272 |
| Nemotron 3 Ultra | 0.667 ± 0.167 | 6.1 s | 4,335 | 0.00780 |
| **Ladder** (Lightning → Super → Ultra) | **0.833 ± 0.167** | 32.7 s | — | **0.00513** |

- **H1: accepted.** Ladder 0.833 ≥ always-Ultra 0.667 − 0.05, and ladder cost $0.00513 < always-Ultra $0.00780, which is 34% less. The ladder resolved 15 of 18 cells: 1 on Lightning, 11 on Super and 3 on Ultra. Three cells stayed unresolved. The ladder beats both single tiers on pass rate because Super and Ultra fail on *different* cells (see below), and it makes up to three attempts per task. The ladder is slower (32.7 s), since it adds the time of every tier it tries.
- **H2: rejected.** Ultra was the *fastest* tier at 6.1 s, ahead of Super at 14.0 s and Lightning at 17.9 s. Both pre-registered inequalities failed. Ultra used fewer turns and served more tokens per second on Token Factory.
- **H3: accepted.** Ultra 0.667 ≥ Super 0.667 ≥ Lightning 0.056. Ultra and Super tie.
- **Failure analysis.**
  - Lightning failed 17 of 18 runs with `incomplete_response`. The provider returned `finish_reason=length` at the 2,048-token output cap, mostly in reasoning tokens. This motivated E02.
  - Super failed `release-brief` 5 times out of 6 on "Output is valid and executable", that is, its brief did not validate.
  - Ultra failed `release-brief` 3 times on "All required policy evidence cited", and stopped 3 `shipping-function` runs at the output cap.
  - Super hit the 12-turn limit once.
- **Spend.** The ledger reserved 243,570 of 3,000,000 tokens. The provider-reported cost of all 54 runs, summed from the per-run costs, was about $0.20.

## E02 — Output-token budget for reasoning tiers (pre-registered 2026-10-28, while E01 was running and before any E02 call)

**Observation that motivated it.** In the first E01 runs, every Nemotron 3.5 Lightning run stopped with `incomplete_response`: the provider returned `finish_reason=length` after 2,048 completion tokens, most of them reasoning tokens (the smoke test showed 306 of 320 completion tokens were reasoning on a trivial prompt). E01 is not modified; its Lightning failures are reported as measured.

**Question.** Is the Lightning failure in E01 caused by the output budget rather than by capability?

**Change.** One variable only: `max_tokens` per call goes from 2,048 to 8,192. Everything else is identical to E01: the same 3 tasks × 2 profiles × seeds 11, 22, 33 × 3 tiers (54 runs), temperature 0, 12 turns, 180 s per run, the same checks and the same prices.

**Hypotheses and decision rules.**
- **H4 (budget).** The Lightning pass rate in E02 is greater than in E01, and Lightning's share of `incomplete_response` errors falls to ≤ 1/18.
- **H5 (ladder at 8,192).** Same rule as H1, evaluated on E02.
- **H6 (no regression).** The Super and Ultra pass rates in E02 are ≥ their E01 rates − 0.05.
- **Product rule.** The Studio default `max_tokens` becomes 8,192 only if H4 and H6 both hold. Otherwise it stays at 2,048 and Lightning is documented as unsuitable at that setting.

**Stopping rule.** Separate token ledger, with a cap of 3,000,000.

**Results.** _Pending. Filled in only from `experiments/E02/summary.json`._

### E02 stopping event and E02b completion (written 2026-10-28, before any E02b call)

**What happened.** The E02 stopping rule fired as designed:
- At 12:38:47 UTC, a Lightning `shipping-function` run (seed 11, careful profile) reached the 180 s run timeout while a provider call was still open.
- That call was aborted, and its usage could not be reported (`provider_usage_unavailable`).
- The ledger then refused every later admission. Two calls already in flight were stopped at settlement, and 22 more runs never reached the model.

In total, **24 of the 54 runs were not executed**: every run whose error is `token_accounting_unknown` or `token_budget_overrun`. The timed-out run itself counts as a real failure (`run_timeout`).

The error code shown for blocked calls was misleading: `token_budget_overrun` appeared even though no reservation had been exceeded. It has been corrected to `token_accounting_unknown` (`server/token-budget.mjs`). This is a reporting fix only and does not change what the ledger blocks.

**Deviation (documented).** E02b runs **only those 24 cells**, with identical settings (8,192 output tokens, same seeds, tasks, profiles and limits) and a fresh ledger with a cap of 3,000,000 (`scripts/bench-tiers.mjs --complete experiments/E02/runs`). E02 is then evaluated on the union, using `scripts/summarize.mjs`. A later run replaces a cell only when the earlier run never reached the model. No executed run is ever replaced. If the ledger stops E02b too, the remaining cells are reported as missing and the hypotheses are judged only on complete cells.
