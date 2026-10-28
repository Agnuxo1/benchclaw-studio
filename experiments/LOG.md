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

**Results (2026-10-28, 54/54 cells: 30 from E02 plus 24 from E02b; `experiments/E02/summary-combined.json`).** Pass rates are means over the three seeds ± sample SD.

| Tier / policy | Pass rate | Mean run time | Mean tokens | Mean cost (USD) |
| --- | --- | --- | --- | --- |
| Nemotron 3.5 Lightning | 0.667 ± 0.167 | 46.6 s | 16,256 | 0.00284 |
| Nemotron 3 Super (control) | 0.667 ± 0.167 | 19.4 s | 6,759 | 0.00374 |
| Nemotron 3 Ultra | 0.778 ± 0.096 | 7.2 s | 3,557 | 0.00612 |
| **Ladder** (Lightning → Super → Ultra) | **0.889 ± 0.096** | 55.1 s | — | **0.00413** |

- **H4: accepted.** Lightning went from 0.056 to 0.667, and its `incomplete_response` share fell from 17/18 to 1/18. Its remaining failures were 2 `step_limit`, 1 `run_timeout`, 1 empty answer (`finish_reason=stop` with no content) and 2 failed checks.
- **H5: accepted.** Ladder 0.889 ≥ always-Ultra 0.778 − 0.05, and ladder cost $0.00413 < $0.00612, which is 33% less. The ladder resolved 16 of 18 cells: 12 on Lightning, 3 on Super and 1 on Ultra.
- **H6: accepted.** Super 0.667 vs 0.667 in E01, and Ultra 0.778 vs 0.667.
- **Product rule applied.** The default `max_tokens` is now 8,192 (`DEFAULT_MAX_TOKENS` in `server/engine.mjs`).
- **Trade-off made explicit.** At 8,192 tokens, Lightning is the cheapest per task, yet it is the slowest tier. It used 4.6× Ultra's tokens, most of them reasoning. The ladder therefore saves money at the cost of latency (55 s against 7 s for Ultra). For latency-critical tasks, starting at Ultra is the better policy. Studio exposes both options.
- **Spend.** E02 plus E02b cost about $0.23 in total, based on provider-reported usage.

### E02 stopping event and E02b completion (written 2026-10-28, before any E02b call)

**What happened.** The E02 stopping rule fired as designed:
- At 12:38:47 UTC, a Lightning `shipping-function` run (seed 11, careful profile) reached the 180 s run timeout while a provider call was still open.
- That call was aborted, and its usage could not be reported (`provider_usage_unavailable`).
- The ledger then refused every later admission. Two calls already in flight were stopped at settlement, and 22 more runs never reached the model.

In total, **24 of the 54 runs were not executed**: every run whose error is `token_accounting_unknown` or `token_budget_overrun`. The timed-out run itself counts as a real failure (`run_timeout`).

The error code shown for blocked calls was misleading: `token_budget_overrun` appeared even though no reservation had been exceeded. It has been corrected to `token_accounting_unknown` (`server/token-budget.mjs`). This is a reporting fix only and does not change what the ledger blocks.

**Deviation (documented).** E02b runs **only those 24 cells**, with identical settings (8,192 output tokens, same seeds, tasks, profiles and limits) and a fresh ledger with a cap of 3,000,000 (`scripts/bench-tiers.mjs --complete experiments/E02/runs`). E02 is then evaluated on the union, using `scripts/summarize.mjs`. A later run replaces a cell only when the earlier run never reached the model. No executed run is ever replaced. If the ledger stops E02b too, the remaining cells are reported as missing and the hypotheses are judged only on complete cells.

## E03 — Speculative ladder and tier memory: attacking the ladder's latency (pre-registered 2026-10-28, before any E03 call)

**Motivation.** In E02 the ladder passed 88.9% of tasks at $0.00413 per task, but it took 55.1 s per task against 7.2 s for always-Ultra. A task that escalates waits for every tier in turn, and Lightning alone averaged 46.6 s. E03 tests two policies that keep the ladder's checks, tiers and prices and only change the order of work. E01 and E02 are not modified.

**Policies.**
- *Sequential ladder* (control 1, the E02 policy): Lightning → Super → Ultra, stopping at the first run that passes.
- *Always-Ultra* (control 2, the quality and latency reference).
- *Speculative ladder* (H7, primary): Lightning and Super start together. The answer is the first of the two runs to pass its checks; if both pass at the same moment, the cheaper one is kept. Ultra runs only if both fail. The slower parallel run is not cancelled, so the token ledger reconciles every call and both runs are paid for. The answer time is when the answer is known; the settle time is when every run has finished.
- *Tier memory* (H8, secondary): seeds are taken in time order 11 → 22 → 33. Each task and profile starts at the tier that resolved its latest earlier seed, or at Lightning if none has resolved yet, and escalates upwards only.

**Design.**
- *Part A (primary).* A fresh full grid with `scripts/bench-tiers.mjs`, identical to E02: 3 tasks × 2 profiles × seeds 11, 22, 33 × 3 tiers = 54 runs; temperature 0, JSON-object responses, 12 turns, 8,192 output tokens per call, 180 s per run, concurrency 3, the same checks (validator v2) and the same prices. The four policies are evaluated offline on this grid with `scripts/summarize.mjs` (`evaluatePolicy` and `evaluateSpeculative` in `server/ladder.mjs`, committed with this entry before any E03 call). Offline, a parallel run is assumed to take the time it took in the grid.
- *Part B (live check of H7).* The product executor `executeSpeculativeLadder` runs live once per cell: 18 cells, one at a time, same settings (`bench-tiers.mjs --policy speculative`). This measures the answer time on the clock. It also checks the offline latency model, by applying it to the runs each live ladder made.
- *Secondary, retrospective.* The same four policies on the E02 grid (E02 plus E02b). This analysis is not confirmatory, because the E02 data were known when E03 was designed. It is never used to judge H7 or H8.

**Design note, written before any E03 data.** The variant was chosen knowing only E02's aggregate numbers. With Lightning at 46.6 s on average, a variant that waits for both parallel runs cannot reach a 30 s mean, so the hedged variant (first passing run wins) is the primary hypothesis. JEV chose the design (provenance=jev): measurement "fresh grid plus live check", confidence 0.29, settled by the budget and by consistency with E01/E02; hedged variant, 0.84; tier memory as a secondary hypothesis, 0.57; run on the PC with the CPU lane booked in the server-ia queue, 0.98, because the key must not leave the PC.

**Metrics.** A task passes when all its deterministic checks pass. Answer time per task: offline, as each policy defines it; live, the executor's `decisionMs`. Cost per task in USD: provider-reported tokens × published prices, including runs that were started but not chosen. Means are taken over the 18 cells; pass rates are the mean over seeds ± sample SD.

**Hypotheses and decision rules.** Each is judged separately, on means over the 18 cells.
- **H7 (speculative, primary, Part A).** Accepted only if all three hold on the E03 grid: (a) pass rate ≥ the sequential ladder's pass rate − 0.05; (b) mean answer time < 30 s; (c) mean cost per task < the always-Ultra mean cost. On the same grid, the speculative and sequential ladders pass exactly the same cells by construction (both pass whenever any tier passes), so (a) is only informative in Part B.
- **H7-live (Part B).** The same three criteria with live measurements: live pass rate ≥ the E03 sequential ladder's − 0.05; live mean answer time < 30 s; live mean cost < the E03 always-Ultra mean cost.
- **H8 (tier memory, secondary, Part A).** The same three criteria as H7, on the E03 grid.
- Reported without a decision rule: median and maximum answer time, cells resolved per tier, and the mean absolute and signed error of the offline latency model against the live clock (Part B).

**Product rule.** The speculative ladder becomes an extra Studio policy, next to the sequential ladder and the single tiers (nothing is removed), only if H7 and H7-live are both accepted. Tier memory is added only if H8 is accepted. Otherwise the code stays in the repository as a measured option that was rejected, and the README says so.

**Stopping rules and budget.**
- Phase budget: $1.00 of estimated Token Factory usage (E01 and E02 together cost about $0.43). The token ledger counts tokens, not money, so every invocation also has a monetary stop, `--usd-cap`. A run starts only if the provider-reported spend so far plus $0.035 per run in flight stays under the cap ($0.035 is above the most expensive single run in E01–E02, $0.034). Caps: Part A $0.40, Part B $0.25, each including its completion, which receives the cap minus what was already spent. Expected spend: about $0.23 for Part A and $0.14 for Part B.
- Token ledger: cap of 3,000,000 per invocation, as in E02. Any `token_*` error stops new admissions, as in E02.
- *Completion of Part A.* If the ledger stops the grid, the cells that never reached the model are completed with `--complete`, the same settings and a fresh ledger, exactly as E02b. Runs that were executed are never replaced.
- *Completion of Part B.* If the ledger halts a live cell, its runs that reached the model are kept. The missing parallel runs, and Ultra if neither parallel run passed, run again individually with a fresh ledger, and the cell's answer time is composed with the offline rule. Composed cells are counted and reported separately, and the latency-model check uses measured cells only.
- If a USD cap stops an invocation, the hypotheses are judged on complete cells only, and the missing cells are reported.
