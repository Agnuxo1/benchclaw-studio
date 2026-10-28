# First-attempt and recovery analyses (E02)

*An independent reanalysis wrote this note on 28 October 2026 (16:23). It was amended the same evening, when it was reconciled with the cost-bounds correction: the cost table below now reports bounds over every cell, and the matched-cell figure is kept only as a sensitivity check. No additional provider calls were made for either correction.*

The reanalysis keeps the positive pass-rate result and corrects two measurement issues.

**Two E02 rows classified as ledger failures contained real provider calls** (three Super calls and two Lightning calls), so they were executed runs. The pre-registered E02b rule replaces a cell only when the earlier run never reached the model. The primary merger now keeps every provider attempt. Only the 22 rows with no provider call are completed automatically. The two reruns of the attempted rows remain available in a clearly labelled secondary recovery analysis.

**The offline ladder now obeys the live ladder's halt-on-budget-error rule.** It no longer escalates through a global accounting failure that would have stopped the live ladder.

| E02 analysis | Ladder passes /18 | Always Ultra /18 | Ladder cost per task, all 18 cells | Ultra cost per task | Saving | Matched 17-cell saving (sensitivity only) |
|---|---:|---:|---:|---:|---:|---:|
| **Primary: first provider attempt kept** | **15** | 14 | **$0.00578–0.00602** | $0.00612 | **1.5–5.5%** | 32.15% |
| Secondary: infrastructure recovery | 16 | 14 | $0.00586–0.00611 | $0.00612 | 0.2–4.1% | 30.64% |

**Why the published cost uses bounds and not matched cells.** One cell, seed 11 · shipping-function · careful, has a call without reported usage. It is the most expensive cell of the grid. On the ladder path, Lightning timed out after 12 calls, 11 of them with reported usage; Super hit the step limit ($0.0156); and Ultra passed ($0.0088). The provider therefore reported at least $0.0353 of ladder spend in that cell, against $0.0088 for always-Ultra. A matched comparison drops that cell from both arms. It also drops the reported, certain spend, and that favours the ladder. The bounds count every reported call. The missing call counts $0 at the low end and, at the high end, 40,000 prompt tokens plus the full output budget. Costs are estimated from recorded tokens and catalogue prices, not from final invoices. The original comparison mixed 17 ladder costs with 18 Ultra costs.

The primary Lightning pass rate is 11/18 (61.1%), against 1/18 at the smaller output budget. The recovery rate, 12/18 (66.7%), is kept as secondary evidence. Super still passes 12/18 and Ultra 14/18. The pre-registered product rule is still satisfied: budget recovery and no Super or Ultra pass-rate regression support keeping the 8,192-token default. No endpoint or API budget is changed here.

E01, E02 and E02b contain 110 benchmark runs that reached the provider, including the two infrastructure-recovery reruns. The primary grids contain 108 selected rows. Across E01–E04 there are 182 such runs. The three tasks are controlled synthetic fixtures: real provider receipts do not turn them into a broad real-world dataset, and these small-grid effects do not establish a general model ranking.

The same first-attempt rule also applies to E03. There, 5 of 18 cells are complete instead of 4, and H7 is still not accepted. The details are in [`experiments/LOG.md`](../experiments/LOG.md), under "Reconciliation of the two corrections".

## Reproduce without inference

```sh
node scripts/audit-history.mjs
node scripts/summarize.mjs --runs experiments/E02/runs,experiments/E02b/runs --out experiments/E02/summary-primary-corrected.json
node scripts/summarize.mjs --runs experiments/E02/runs,experiments/E02b/runs --recover-ledger-failures --out experiments/E02/summary-recovery-explicit.json
npm test
```

The historical combined summary and all raw runs remain unchanged. The new summaries record every replacement, its reason and the number of provider calls of the run it replaced (`mergeAudit`). The matched-cell means are in `pairedCostComparisons`. Regression tests in `tests/summarize.test.mjs` cover the correction, and the full offline suite passes.
