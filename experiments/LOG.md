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

### E03 stopping event and E03b completion (written 2026-10-28, before any E03b call)

**What happened.** At 14:44:20 UTC a Lightning `release-brief` run (seed 11, careful profile) made a provider call that exceeded the 45 s per-call transport timeout (`provider_timeout`). The aborted call returned no usage, and the token ledger blocked every later admission (`provider_usage_unavailable`), as designed. 18 of the 54 runs were recorded: 7 reached the model (3 passed, 3 failed and the timed-out run, which counts as a real failure), and 11 were stopped by the ledger.

**A fault in the new USD stop.** `--usd-cap` charged every run with an unknown cost the $0.035 reserve, including the 11 runs the ledger had stopped before any call. It therefore estimated $0.37 of spend and refused to start the remaining 36 jobs. The provider-reported spend of E03 is $0.0212, plus one call without reported usage (the timed-out Lightning call, at most $0.0044 by the worst case below). This is a bookkeeping fault, not a result.

**Corrections, made before E03b and independent of any E03 result.**
- The USD stop now counts spend per call: the provider-reported cost, or, for a call that reached the provider without reported usage, a worst case of 40,000 prompt tokens plus the full output budget at that tier's price. Runs stopped by the ledger before a call cost nothing. Carried-over spend is passed with `--spent-usd`.
- `--complete` now selects every grid cell without a run that reached the model. That covers runs stopped by the ledger, as before, and also cells never started because the USD stop refused them. On the E02 data it selects exactly the 24 cells that E02b ran, so the E02b procedure is unchanged.

**E03b.** As pre-registered and decided by JEV (a single pass, exactly as E02b; provenance=jev, confidence 0.2, settled in favour of the pre-registered rule): the 47 cells without an executed run are run once, with identical settings and a fresh ledger (cap 3,000,000), with `--usd-cap 0.40 --spent-usd 0.026` (Part A's $0.40 cap includes its completion). E03 is then evaluated on the union with `scripts/summarize.mjs`. If the ledger stops E03b too, the remaining cells are reported as missing, and H7 and H8 are judged on complete cells only. Part B keeps its pre-registered completion rule.

### E03 results (2026-10-28, complete cells only, `experiments/E03/summary-combined.json`)

E03b was stopped by the ledger as well, again by a Lightning call over the 45 s transport timeout: 7 of its 47 runs reached the model and 40 were stopped. Over E03 plus E03b, **only 4 of the 18 cells have all three tiers executed, all of them seed 11.** As pre-registered, the other 14 cells are missing and the hypotheses are judged on the 4 complete cells. Runs stopped by the ledger count as missing data, not failures: `scripts/summarize.mjs` now excludes them, which leaves the E02 figures unchanged because E02 had none. With a single seed there is no standard deviation.

| Policy (4 complete cells) | Pass rate | Mean answer time | Median | Max | Mean cost (USD) |
| --- | --- | --- | --- | --- | --- |
| Sequential ladder (control) | 1.00 | 64.4 s | 66.0 s | 84.4 s | 0.00173 |
| Always-Ultra (control) | 0.75 | 6.0 s | 5.3 s | 9.9 s | 0.00589 |
| **Speculative ladder** | 1.00 | **30.8 s** | 27.6 s | 59.0 s | 0.00338 |
| Tier memory | 1.00 | 64.4 s | 66.0 s | 84.4 s | 0.00173 |

- **H7: rejected.** (a) holds: 1.00 ≥ 1.00 − 0.05. (b) fails: 30.8 s is not < 30 s. (c) holds: $0.00338 < $0.00589. The speculative ladder halved the sequential ladder's answer time (64.4 s → 30.8 s) at about twice its cost, but it missed the latency threshold by 0.8 s. The evidence is thin, with 4 cells and one seed.
- **H8: rejected and uninformative.** Only seed 11 is complete, so tier memory never applied and the policy equals the sequential ladder.
- **Part B was not run.** The product rule needed H7 and H7-live, so Part B could no longer change the decision, and it would have faced the same ledger stops (JEV, provenance=jev, 0.22 for running it). This is a deviation from the plan, recorded here before any further call.
- **Cause of the stops: provider throughput changed during the day.** The median of completion tokens per second of call time was, in E02 (from 12:35 UTC) against E03 (14:44–15:30 UTC): Lightning 264 → 78, Super 125 → 84, Ultra 138 → 137. At 78 tok/s, an 8,192-token Lightning call needs about 105 s. That is within the 180 s run limit but beyond the fixed 45 s per-call transport timeout, which aborts the call and loses its usage, and the global ledger then stops everything.
- **Spend.** E03 $0.0212 and E03b $0.0259, provider-reported, plus 2 calls without usage (at most $0.0044 each).

## E04 — E03 repeated with a call timeout bounded by the run and one ledger per run (pre-registered 2026-10-28, before any E04 call)

**Why.** E03 could not answer its question, because one slow call stopped the whole grid twice. E04 repeats E03 with two changes that address only that operational failure, both written before any E04 data and independent of the H7 result:
1. **Product (`server/engine.mjs`, `server/nebius.mjs`).** A provider call may use the run's remaining time plus 1 s, instead of the fixed 45 s transport default. The run's own 180 s limit, which is unchanged, still bounds every call. The extra second lets the run deadline fire first, so a call cut at the limit is reported as `run_timeout`. With E02's throughput no call took more than 28 s, so this change would not have altered E02.
2. **Benchmark (`scripts/bench-tiers.mjs --ledger per-run`).** Each run has its own token ledger, with the same reservation and reconciliation rules. A call that loses its usage then stops only its own run. The global monetary stop (`--usd-cap`, per call) still bounds total spend. The Studio server keeps its single global ledger, unchanged.

JEV chose to run E04 now (provenance=jev; 0.14, settled in its favour by the remaining budget and time, and by the failure being operational rather than result-dependent). JEV also gave 0.57 for the timeout fix. Provider throughput per tier is reported as a covariate.

**Design.** As E03 in every other respect:
- *Part A.* A fresh 54-run grid (3 tasks × 2 profiles × seeds 11, 22, 33 × 3 tiers), 8,192 output tokens, temperature 0, 12 turns, 180 s per run, concurrency 3, the same checks and prices; the five policies evaluated offline with `scripts/summarize.mjs`.
- *Part B.* The live speculative executor once per cell, 18 cells, one at a time. Part B runs **only if H9 is accepted**, because otherwise it cannot change the product decision.

**Hypotheses and decision rules** (means over complete cells; each judged separately).
- **H9 (speculative, primary).** As H7, on the E04 grid: (a) pass rate ≥ sequential ladder − 0.05; (b) mean answer time < 30 s; (c) mean cost < always-Ultra. All three must hold.
- **H9-live (Part B).** As H7-live: the live pass rate ≥ the E04 sequential ladder's − 0.05; live mean answer time < 30 s; live mean cost < the E04 always-Ultra cost.
- **H10 (tier memory, secondary).** As H8, on the E04 grid.
- **H11 (robustness of the timeout change).** No E04 run ends with `provider_timeout`, and no cell is missing because of a ledger stop.
- Reported without a decision rule: median and maximum answer time, cells resolved per tier, per-tier throughput, and the offline latency model's error against the clock (Part B).

**Product rules.**
- The speculative ladder becomes an extra Studio policy, with nothing removed, only if H9 and H9-live are both accepted.
- Tier memory is added only if H10 is accepted.
- The call-timeout change stays in the release only if H11 holds and all tests pass; otherwise it is reverted.
- E01–E03 are not modified, and E04 does not replace their results. Each experiment is reported under its own conditions.

**Stopping rules and budget.** Spend in this phase before E04: at most $0.056. Part A runs with `--usd-cap 0.40` and Part B with `--usd-cap 0.25`, so the phase total stays at or below $0.71, under the $1.00 budget. If any runs are stopped by their own ledger, the cells without an executed run get a single completion pass (`--complete`, the same settings, the cap minus what was spent), as in E03b. Any cells still missing are reported, and the hypotheses are judged on complete cells only.

### Erratum: E02 cost per task, and the E03 cost figures (found 2026-10-28 while implementing cost bounds, before any E04 call)

**What was wrong.** `scripts/summarize.mjs` averaged a policy's cost only over the cells whose cost was known, while it counted every cell for pass rate and time. In E02, one ladder cell has an unknown cost: Lightning `shipping-function`, careful, seed 11, which ran 12 calls and was cut at the 180 s run limit, so its last call returned no usage. That cell paid for Lightning, then Super, then Ultra, and it was left out of the cost mean. E01 is not affected, because all 18 of its cells have known costs.

**Corrected E02 figures** (all 18 cells). Unknown usage is counted as $0 at the low bound, and as 40,000 prompt tokens plus the full output budget at the high bound:

| Policy, E02 | Pass rate | Cost per task, published | Cost per task, corrected (low – high) |
| --- | --- | --- | --- |
| Auto-tier ladder | 0.889 ± 0.096 | $0.00413 (17 cells) | **$0.00586 – $0.00611** |
| Always-Ultra | 0.778 ± 0.096 | $0.00612 | $0.00612 |
| Always-Super | 0.667 ± 0.167 | $0.00374 | $0.00374 |

- **H5 still holds.** Even the high bound is below always-Ultra ($0.00611 < $0.00612), and the pass rate is unchanged.
- **The published "33% lower cost" for E02 is wrong.** The corrected saving against always-Ultra is 0.2% to 4.2%. In E02 the ladder therefore passed 11 points more tasks than always-Ultra at about the same cost. The −33% figure only holds for E01, which used 2,048 tokens: $0.00513 against $0.00780, −34%, all cells known.
- **Where the wrong figure appears.** The 33% figure and $0.0041 appear in the README, docs/SUBMISSION.md, the Devpost text, the demo gallery, `docs/media/policy.gif` and the submitted video, in both the narration and the chart. The correction is planned in the final update, and none of them is left as published.

**E03 figures corrected the same way** (4 complete cells): ladder $0.00347 – $0.00565, speculative $0.00430 – $0.00648, always-Ultra $0.00589. The earlier E03 table averaged the ladder and speculative costs over only 2 known cells. Under its pre-registered "mean cost", E03's criterion (c) is therefore undetermined rather than met. **H7 stays rejected**, on criterion (b).

`scripts/summarize.mjs` now reports `costKnownCells`, `costUSDLow` and `costUSDHigh` for every policy. The old `costUSD`, the mean over known cells, is kept for reference only.

### E04 amendments after an independent review by Codex (written 2026-10-28, before any E04 call)

Codex (`codex exec`, gpt-6-sol, read-only) asked for four corrections before any call. All four are applied, together with one clarification:
1. **Cost decisions use bounds.** Criterion (c) of H9, H9-live and H10 compares the tested policy's **high** cost bound with the control's **low** bound. Unknown costs therefore always count against the hypothesis.
2. **Tier memory needs a real history.** H10 is evaluated only on task-and-profile sequences whose earlier seeds are all complete. A missing seed ends that sequence for tier memory.
3. **The USD stop is strict per call.** Before each provider call, the stop checks the spend so far, plus the worst case of every call in flight, plus this call's worst case (prompt bytes counted as tokens, plus the full output budget, at the tier's price) against the cap. Afterwards the call is charged its reported cost, or its worst case when no usage came back.
4. **Real cancellation is tested.** A call cut at the run limit is reported as `run_timeout`. Behaviour change, stated plainly: a single provider call can now occupy a run for up to the run's 180 s limit, which a whole run could already do.
5. **Clarification on timing and conditions.** H9-live compares live measurements with Part A controls measured at a different time. Per-tier median throughput is reported for both parts. If Lightning's or Super's median throughput in Part B differs from Part A by more than a factor of 2, H9-live is reported as confounded and the speculative ladder's product rule is not met. H9 and H10 are new tests under adjusted operating conditions, not independent confirmations of E03.
