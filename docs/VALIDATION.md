# Validation evidence

Status: 30 September 2026. Candidate build; no authenticated Nebius execution has been verified, no video is published, and no Devpost submission is confirmed.

## Local verification

Node.js 22.18.0, Windows, local Node test runner. `npm test`: **28 tests passed**, including the real local EnigmAgent vault/broker, session ownership and HTTP boundaries, cancellation, provider-adapter failures, strengthened shipping checks, version equivalence and offline report verification. Provider responses in unit tests are scripted and are not evidence of NVIDIA inference.

Independent Claude review found a slow-request admission race. Codex applied the reviewed patch and repeated the original experiment in a separate folder: two of eight delayed-body requests accepted under the global active cap of two; one of six accepted for the same owner. Remaining requests returned 429. Before the fix, the independent review recorded eight and six accepted respectively. These are local server tests using a scripted provider, not remote benchmarks.

The strengthened shipping validator rejects three fabricated wrong programs that previously passed the original six cases. This demonstrates improved coverage of those counterexamples, not general correctness of arbitrary programs. Correct reference output passes 17 checks.

## Rendered interface

Chrome, initial overview and empty run workspace, measured at widths 390, 768 and 1440 CSS pixels. Document scroll widths were respectively 375, 753 and 1425 pixels on both screens. Six screenshots are saved locally under `artifacts/screenshots/`. The earlier 499-pixel overflow at a 390-pixel viewport was corrected. This is a limited responsive check, not a completed accessibility audit; populated results, keyboard-only flow and reduced motion still need review.

## Recompute an exported report

```sh
node scripts/verify-report.mjs path/to/report.json
```

This needs no inference credentials or model calls. It checks the report digest, compatible task and validator fingerprints, recomputes deterministic checks against the included files, and checks consistency with the recorded result. It refuses unevaluated runs and incompatible validators. A failed task can still have a consistent, verifiable report.

The digest is **not a signature**: someone can modify an artifact and regenerate its digest. This utility cannot authenticate provider receipts, prove authorship, certify execution history or establish semantic truth of prose. Genuine sanitized remote reports still need to be supplied with the final candidate; no example report is presented as a real provider execution.

## Prospective remote validation

After authorized account setup and verification of free credits, first perform one smoke execution to establish model availability, JSON compatibility and latency. Then run `npm run validate` for three consecutive paired repetitions of the document task and one run of each remaining task. No retries are silently excluded. Record all results, source fingerprints, preregistered contract hashes and API comparison decisions.

The existing contract requires six principal-task runs with at least five passing all checks, three equivalent and comparable pairs, and both additional tasks passing. A provider error does not become a task score. Times and reported tokens are measured per execution; unknown tokens and cost remain unknown. There is no target improvement percentage or model ranking.

## Open limitations

- No real Nebius/NVIDIA receipts yet; compatibility and stability remain unverified.
- Release prose checks verify exact citations and concept coverage, but contradictory prose can still pass; semantic review remains necessary.
- Shipping acceptance cases are withheld from tool feedback, but the software is public: they are not secret from a person reading source.
- Clean dependency installation is pending the required nominal package approval.
- No public judging route or provider balance check yet. A durable cumulative token admission guard now exists and defaults to zero; its conservative reservation estimate and operator flag are not billing guarantees.
- Loopback sessions and virtual file capabilities do not constitute public account authentication or a general OS sandbox.

Review evidence: local coordination reports and experiment outputs are retained in the dedicated workspace. They must be sanitized and deliberately selected before publication.
