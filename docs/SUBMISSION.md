# BenchClaw Studio — submission draft

**Status:** prepared text, not submitted. Public repository, release commit/tag, judge build, actual remote results and public video URLs are pending. Do not submit this draft with missing evidence.

## Short description

Run bounded AI-agent tasks, inspect tool permissions and artifacts, and compare equivalent executions with reproducible evidence.

## User, problem and solution

A developer needs to know whether an agent works before connecting it to a real workflow. A fluent answer alone does not reveal whether files were changed correctly, citations exist, tools exceeded their permissions or a configuration is reliable. BenchClaw Studio turns a task into an inspectable execution: criteria first, enforced tool permissions, observable actions, deterministic artifact checks, and an exportable report.

## Main journey

Choose a versioned task, review its synthetic inputs and acceptance criteria, select an agent profile and permissions, run the agent, inspect actions and checks, repeat under equivalent conditions, and export the evidence. Three tasks cover document research, invoice transformation and a bounded shipping-policy program.

## Architecture and intended sponsor integration

A browser workspace connects to a loopback Node backend. The bounded runner uses a separate Nebius Token Factory client configured for `nvidia/nemotron-3-super-120b-a12b`. The model selects actions for task-local reads, writes and checks; the runtime enforces capability boundaries independently. EnigmAgent's original vault and fixed-operation broker support a protected local health check without exposing its secret. Provider calls are intended to record model, status, time, request ID and available token usage.

**Publication gate:** replace intended integration language with verified implementation evidence only after successful authenticated executions. No remote execution is currently claimed.

## Original contribution

BenchClaw previously supplied an HTTP evaluation client and dashboard; EnigmAgent supplied its authenticated vault and bounded broker. Studio adds the task execution engine, three original fixtures, deterministic validators, versioned evidence, permissions, session isolation, cancellation, comparison, report export, offline recomputation and a new responsive interface. See PROVENANCE.md and the source manifest for preserved upstream versions and licenses. Final original-development history must be identified by real commits and a release tag.

## Results and limitations

See VALIDATION.md for the 28 local tests and limited responsive measurements. Remote results, timings and token totals remain pending. Citation matches do not prove every sentence true, fixture checks do not imply general agent superiority, and the restricted expression language is not arbitrary code execution. Report digests are not signatures.

## Tool feedback

Pending actual Token Factory onboarding and model use. Record concrete endpoint, model availability, structured response behavior, latency, error handling and documentation observations. Do not invent sponsor feedback from simulated tests.

## Final required fields

- Real participant identity, residence/eligibility and team declarations supplied by the participant.
- Final track justified against current definitions; proposed Best Apps and Agents.
- Public licensed repository and exact commit/tag.
- Freely accessible judge demo or test build for the required evaluation period.
- Public English YouTube demonstration shorter than three minutes.
- Sanitized real provider receipts and measured execution results.
- Final feedback, original-work history and truthful required declarations.
- Devpost confirmation URL, identifier and submission timestamp after final submission.
