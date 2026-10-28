# First-attempt and recovery analyses

The independent reanalysis retains the positive result while correcting two
measurement issues. No additional provider calls were made for this correction.

Two original E02 rows classified as ledger failures contained actual provider
calls (three Super calls and two Lightning calls). They were not unexecuted.
The primary merger now preserves every provider attempt; only the 22 rows with
no provider calls can be completed automatically. The two additional E02 b
attempts remain available in a clearly labelled secondary recovery analysis.

The offline ladder also now obeys the live ladder's halt-on-budget-error rule.
It no longer pretends to escalate through a global accounting failure.

| E02 analysis | Ladder passes /18 | Always Ultra /18 | Matched cost cells | Ladder cost/task | Ultra cost/task | Saving |
|---|---:|---:|---:|---:|---:|---:|
| **Primary: first provider attempt retained** | **15** | 14 | 17 | **$0.004044** | $0.005960 | **32.15%** |
| Secondary: infrastructure recovery | **16** | 14 | 17 | **$0.004134** | $0.005960 | **30.64%** |

Unknown usage in one timed-out cell is never treated as zero. Both policies
use the same 17 cells for cost contrasts; pass rates use all 18 cells. Costs are
estimated from recorded tokens and catalogue prices, not final invoices.
The old comparison mixed 17 ladder costs with 18 Ultra costs.

The primary Lightning pass rate is 11/18 (61.1%), versus 1/18 at the smaller
output budget. The recovery rate 12/18 (66.7%) is retained as secondary evidence.
Super still passes 12/18 and Ultra 14/18. The preregistered product rule remains
satisfied: budget recovery and no Super/Ultra pass-rate regression support
keeping the 8192-token default. No endpoint or API budget is changed here.

There are 110 provider-attempted benchmark runs across E01/E02/E02 b, including
the two additional infrastructure-recovery attempts. The primary grids contain
108 selected rows. The three tasks are controlled synthetic fixtures: real
provider receipts do not turn them into a broad real-world dataset. These
small-grid effects do not establish a general model ranking.

## Reproduce without inference

```sh
node scripts/audit-history.mjs
node scripts/summarize.mjs --runs experiments/E02/runs,experiments/E02 b/runs --out experiments/E02/summary-primary-corrected.json
node scripts/summarize.mjs --runs experiments/E02/runs,experiments/E02 b/runs --recover-ledger-failures --out experiments/E02/summary-recovery-explicit.json
npm test
```

The historical combined summary and all raw runs remain unchanged. The new
summaries record every replacement, its reason and its prior provider-call count.
The correction is covered by four regression tests and the full offline suite.
