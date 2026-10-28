# BenchClaw Studio: hackathon submission text

This is the project story submitted to the Nebius × NVIDIA Global AI Hackathon (Best Apps and Agents). Video: https://youtu.be/gVSO4OD6mh8 · Demo: https://agnuxo1.github.io/benchclaw-studio/

## Inspiration

Every team that wires an LLM agent into a real workflow ends up asking the same question: **which model is good enough for this job?** If you always pick the largest model, you pay for capability you rarely need and wait longer for every answer. If you always pick the smallest, you ship silent failures: a CSV that lost a row, a quote that does not exist in the source, or a pricing rule that breaks at the boundary. A fluent answer does not tell you which of the two happened.

## What it does

BenchClaw Studio runs real agent tasks on **NVIDIA Nemotron through Nebius Token Factory**, lets **deterministic acceptance checks** decide pass or fail, and routes each task to the **cheapest Nemotron tier that passes**:

1. **Success is defined before the run.** Each task has versioned inputs and checks: exact quotes against approved source lines, integer-cent arithmetic, and held-out boundary cases for a generated pricing rule.
2. **A real agent on Nemotron.** The model chooses every action (read, write, check, finish). The runtime enforces tool permissions on every action, and a planted prompt injection in one document cannot widen them.
3. **Auto-tier ladder.** Nemotron 3.5 Lightning goes first. If its output fails the checks, the task escalates to Nemotron 3 Super, then to Nemotron 3 Ultra, and stops at the first tier that passes.
4. **Evidence, not vibes.** Each run records its actions, artifact, check results, Nebius request IDs, provider-reported tokens, latency and cost. The report can be exported with SHA-256 digests and its checks recomputed offline.

## Results: 108 live runs on Token Factory, pre-registered

Two experiments, each with 3 tasks × 2 agent profiles × 3 seeds × 3 Nemotron tiers. Hypotheses and decision rules were committed before the first call. Values are means over seeds ± SD.

| Policy (product settings) | Tasks passed | Cost per task | Time per task |
| --- | --- | --- | --- |
| **Auto-tier ladder** | **88.9% ± 9.6** | **$0.0041** | 55.1 s |
| Always Nemotron 3 Ultra | 77.8% ± 9.6 | $0.0061 | 7.2 s |
| Always Nemotron 3 Super | 66.7% ± 16.7 | $0.0037 | 19.4 s |

- **The ladder passes more tasks than always using Ultra, at 33% lower cost.** Super and Ultra fail on *different* tasks, so escalating on failed checks gets the best of both. 12 of 18 task cells were settled by the cheapest tier.
- **Reasoning models need room.** With a 2,048-token output budget, Nemotron 3.5 Lightning ran out of tokens while thinking in 17 of 18 runs, so its pass rate was 6%. At 8,192 tokens it passed 67%. Following the pre-registered rule, 8,192 is now the default.
- **Ultra was the fastest tier on Token Factory**, at 7.2 s per task. The ladder trades latency for cost, and Studio lets you choose either.
- The whole study cost about **$0.43** in Token Factory usage.

## How we built it

- **Nebius Token Factory** through the OpenAI-compatible `chat/completions` endpoint, with JSON-object mode and a provider seed. All three Nemotron tiers use one endpoint and one key, so changing tier is a single field.
- **NVIDIA Nemotron**: `Nemotron-3_5-Lightning` (30B/3B active), `nemotron-3-super-120b-a12b` (120B/12B) and `Nemotron-3-Ultra-550b-a55b` (550B/55B).
- **Node.js 22**, no framework, one pinned runtime dependency. A bounded runner allows 12 turns, 180 s and 32 KiB of output per run.
- **EnigmAgent vault and broker**: the API key lives in an encrypted in-memory vault and is never a model-visible tool.
- **A durable token ledger** reserves tokens before every call and reconciles them with the usage Nebius reports, so a public demo cannot overspend.
- **Pre-registered experiments**: hypotheses, decision rules and stopping rules were committed to git (with a SHA-256 hash) **before** the first live call.

## Challenges we ran into

Reasoning tiers spend output tokens on thinking. With our original 2,048-token output budget, Nemotron 3.5 Lightning reached `finish_reason=length` before it wrote its answer. We kept that result (E01) and pre-registered a one-variable follow-up (E02) before running it. At 8,192 tokens, Lightning went from 6% to 67% of tasks passed. One more surprise: during E02, a run timeout left one call's usage unreconciled, and our own fail-closed token ledger stopped the experiment, exactly as designed. We completed the 24 cells that never ran, with identical settings, and documented the deviation.

## Accomplishments that we're proud of

- Every number in this submission comes from live Token Factory runs, failures included, and every run can be inspected in the public replay demo.
- The routing claim is measured, not asserted.

## What we learned

The cheapest model per token is not always the cheapest per task: Lightning used 4.6× the tokens of Ultra, yet still cost less per task. Measuring with deterministic checks turned a vague "which model?" debate into a table we can act on, and pre-registering kept us honest when a hypothesis failed: we expected Ultra to be the slowest, and it was the fastest.

## What's next

Per-task tier memory (start where the task last passed), streaming progress, and more task families (SQL migrations, API contract tests).

## Feedback on Nebius Token Factory and NVIDIA Nemotron

**What worked well.** One OpenAI-compatible endpoint and one key cover every Nemotron tier, so the whole ladder is a single `model` field. Usage is reported per call, including `reasoning_tokens`, along with request IDs, which made cost per task and our failure diagnosis possible from provider data alone. Nemotron 3 Ultra was impressively fast.

**What would help builders.**
- Document a recommended `max_tokens` for reasoning models, or expose a reasoning-budget parameter: at 2,048, Lightning silently stopped with `finish_reason=length` before answering.
- Use consistent model ids: the catalog shows `Nemotron-3.5-Lightning` while the API id is `nvidia/Nemotron-3_5-Lightning`, and casing differs across tiers.
- Return a distinct finish reason when the model produces only reasoning and empty content.

## New or updated during the Submission Period

BenchClaw Studio was created during the Submission Period: first commit on 2026-09-30. It reuses two of my earlier open-source components, both MIT: the BenchClaw runner idea and the EnigmAgent vault. During the period I added: the Nemotron tier catalog and per-call model routing, the auto-tier ladder, cost accounting from Token Factory usage, the public read-only replay build, the per-session budget for public mode, the evidence gallery, the tier benchmark with experiments E01 and E02, and this documentation.
