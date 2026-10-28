# BenchClaw Studio: hackathon submission text

This is the project story submitted to the Nebius × NVIDIA Global AI Hackathon (Best Apps and Agents). Video: https://youtu.be/LpHwFtMeQzY · Demo: https://agnuxo1.github.io/benchclaw-studio/

*Updated on 2026-10-28: two more pre-registered experiments (E03, E04), a call-timeout fix found by measurement, and two corrections. For E02 we first reported 89% of tasks passed at a 33% cost saving. The cost left out one cell whose cost was unknown, and the pass rate counted reruns that our pre-registered rule does not allow. See "Challenges".*

## Inspiration

Every team that wires an LLM agent into a real workflow ends up asking the same question: **which model is good enough for this job?** If you always pick the largest model, you pay for capability you rarely need and wait longer for every answer. If you always pick the smallest, you ship silent failures: a CSV that lost a row, a quote that does not exist in the source, or a pricing rule that breaks at the boundary. A fluent answer does not tell you which of the two happened.

## What it does

BenchClaw Studio runs real agent tasks on **NVIDIA Nemotron through Nebius Token Factory**, lets **deterministic acceptance checks** decide pass or fail, and measures which **routing policy** works on your tasks, with receipts:

1. **Success is defined before the run.** Each task has versioned inputs and checks: exact quotes against approved source lines, integer-cent arithmetic, and held-out boundary cases for a generated pricing rule.
2. **A real agent on Nemotron.** The model chooses every action (read, write, check, finish). The runtime enforces tool permissions on every action, and a planted prompt injection in one document cannot widen them.
3. **Auto-tier ladder.** Nemotron 3.5 Lightning goes first. If its output fails the checks, the task escalates to Nemotron 3 Super, then to Nemotron 3 Ultra, and stops at the first tier that passes.
4. **Evidence, not vibes.** Each run records its actions, artifact, check results, Nebius request IDs, provider-reported tokens, latency and cost. The report can be exported with SHA-256 digests and its checks recomputed offline.

## Results: 182 runs on Token Factory, four pre-registered experiments

Each grid has 3 tasks × 2 agent profiles × 3 seeds × 3 Nemotron tiers. Hypotheses, decision rules and stopping rules were committed with a SHA-256 hash before the first call of each experiment. The tasks are controlled synthetic fixtures, so these are measurements on these tasks, not a general ranking of the models.

| Auto-tier ladder vs always Ultra | E01 (2,048 output tokens) | E02 (8,192) | E04 (8,192, fresh grid) |
| --- | --- | --- | --- |
| Tasks passed | **83% vs 67%** | **83% vs 78%** | **94% vs 89%** |
| Cost per task | $0.0051 vs $0.0078 (−34%) | $0.0058–0.0060 vs $0.0061 (−1.5% to −5.5%) | $0.0073–0.0078 vs $0.0059 (+24% to +32%) |
| Mean time per task | 33 s vs 6 s | 54 s vs 7 s | 71 s vs 5 s |

- **The ladder passed more tasks than always using Ultra in every experiment.** Super and Ultra fail on *different* tasks, so escalating on failed checks gets the best of both.
- **Its cost advantage did not hold up.** It went from 34% cheaper to up to 32% dearer, because every failed cheap attempt is paid for. That is exactly why a team should measure its own tasks before choosing a policy, and why Studio exists.
- **Reasoning models need room.** With a 2,048-token output budget, Nemotron 3.5 Lightning ran out of tokens while thinking in 17 of 18 runs. At 8,192 tokens it passed 61%, and 8,192 is now the default.
- **Ultra is the fastest tier per task**, at 5–7 s, because it needs the fewest turns and tokens.
- **Two latency policies were tested in E04, and both missed their pre-registered 30 s target.** The speculative ladder (Lightning and Super together) halved the ladder's time, but it cost more than Ultra, so it was rejected and is not offered. Tier memory (start where the task last passed) kept the 94% pass rate in 34 s, at $0.0050 per task. That made it the cheapest policy at that pass rate, but it was also rejected on time, so it is our next experiment.
- The whole study cost about **$0.72** in Token Factory usage.

## How we built it

- **Nebius Token Factory** through the OpenAI-compatible `chat/completions` endpoint, with JSON-object mode and a provider seed. All three Nemotron tiers use one endpoint and one key, so changing tier is a single field.
- **NVIDIA Nemotron**: `Nemotron-3_5-Lightning` (30B/3B active), `nemotron-3-super-120b-a12b` (120B/12B) and `Nemotron-3-Ultra-550b-a55b` (550B/55B).
- **Node.js 22**, no framework, one pinned runtime dependency. A bounded runner allows 12 turns, 180 s and 32 KiB of output per run, and a provider call may use the run's remaining time.
- **EnigmAgent vault and broker**: the API key lives in an encrypted in-memory vault and is never a model-visible tool.
- **A durable token ledger** reserves tokens before every call and reconciles them with the usage Nebius reports, so a public demo cannot overspend. The benchmark also has a strict per-call USD stop.
- **Pre-registered experiments**: hypotheses, decision rules and stopping rules were committed to git, with a SHA-256 hash, **before** the first live call, and every deviation was logged before it was run.

## Challenges we ran into

- **Reasoning budgets.** Reasoning tiers spend output tokens on thinking. With our original 2,048-token budget, Lightning reached `finish_reason=length` before it wrote its answer. We kept that result (E01) and pre-registered a one-variable follow-up (E02).
- **Provider throughput changes within a day.** In E03, Lightning's served throughput fell from 264 to 78 tokens/s within one afternoon. An 8,192-token call no longer fit our fixed 45 s per-call timeout, so the aborted call returned no usage. Our own fail-closed token ledger then stopped the experiment twice, and only 5 of 18 cells finished. We fixed the cause (a call may now use the run's remaining time) and gave each benchmark run its own ledger. E04 confirmed the fix, pre-registered as H11: 54 of 54 runs, with no provider timeouts.
- **We found two mistakes in our own headline.** We had reported the E02 ladder as passing 89% of tasks at 33% lower cost than always-Ultra. First, the cost average left out one cell whose last call returned no usage. That was the most expensive cell: the provider reported at least $0.0353 of ladder spend in it, against $0.0088 for Ultra. An independent review by Codex, during E04's pre-registration, led us to it. Second, an independent reanalysis found that two runs stopped by our ledger had already called the model, and we had replaced them with reruns. Our pre-registered rule keeps such runs. With both fixed, the E02 ladder passes 83% (vs 78%) and is 1.5% to 5.5% cheaper. Both corrections are in the open log. The rerun analysis stays public as a labelled secondary result, and every cost decision now counts unknown costs against the hypothesis.

## Accomplishments that we're proud of

- Every number in this submission comes from live Token Factory runs, failures included, and every run can be inspected in the public replay demo.
- The routing claims are measured, not asserted. When a claim did not survive more data, we said so.

## What we learned

The cheapest model per token is not always the cheapest per task, and the cheapest policy on one day is not the cheapest on the next. Lightning used over four times the tokens of Ultra per run, yet still cost less per run. A ladder that tries it first passes more tasks, but it pays for every failed attempt. Pre-registering kept us honest: we expected Ultra to be the slowest tier, and it was the fastest per task. We also expected the speculative ladder to fix the latency, and it did not do so cheaply.

## What's next

Tier memory as a Studio policy, tested against its own pre-registered target. Then streaming progress, and more task families (SQL migrations, API contract tests).

## Feedback on Nebius Token Factory and NVIDIA Nemotron

**What worked well.** One OpenAI-compatible endpoint and one key cover every Nemotron tier, so the whole ladder is a single `model` field. Usage is reported per call, including `reasoning_tokens`, along with request IDs, which made cost per task and our failure diagnosis possible from provider data alone. The echoed `model` matched the requested id in every recorded call. Nemotron 3 Ultra was impressively fast per task.

**What would help builders.**
- Document a recommended `max_tokens` for reasoning models, or expose a reasoning-budget parameter. At 2,048, Lightning silently stopped with `finish_reason=length` before answering in 17 of 18 runs, and Ultra did so in 3.
- Report usage for aborted requests, for example through a lookup by request ID. A non-streaming call that is cancelled or times out returns no usage, so its cost cannot be reconciled. It happened five times in our runs, and three of those times it stopped a whole experiment behind our fail-closed ledger.
- Publish per-model live throughput or status. Lightning's served throughput changed 3.4× within one day, which changes which timeouts are safe.
- Use consistent model ids. The catalog shows `Nemotron-3.5-Lightning`, but the API id is `nvidia/Nemotron-3_5-Lightning`. `/v1/models` lists `Nemotron-3_5-Lightning` next to `Nemotron-3.5-Super-VL`, and `NVIDIA-Nemotron-3-Nano-30B-A3B` repeats the vendor name. Casing also differs across tiers.
- Unify cache accounting. Responses carry both `prompt_cache_hit_tokens` and `prompt_tokens_details`, and the latter differs by tier: `null` for Lightning, with `created_cache_tokens` for Super, and without it for Ultra.
- Return a distinct finish reason when the model produces only reasoning and empty content.

## New or updated during the Submission Period

BenchClaw Studio was created during the Submission Period: first commit on 2026-09-30. It reuses two of my earlier open-source components, both MIT: the BenchClaw runner idea and the EnigmAgent vault. During the period I added: the Nemotron tier catalog and per-call model routing, the auto-tier ladder, cost accounting from Token Factory usage, the public read-only replay build, the per-session budget for public mode, the evidence gallery, the tier benchmark with experiments E01 to E04, a speculative-ladder executor (measured and not adopted), the call-timeout fix, a strict per-call USD stop for benchmarks, cost bounds for runs with unknown usage, and this documentation.
