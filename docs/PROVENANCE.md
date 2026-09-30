# Source provenance and original contribution

Audit date: 2026-09-30. Contest window verified against the official rules: 2026-08-26 through 2026-10-30 10:00 Pacific (18:00 Europe/Madrid). Preserve this statement as an audit, not a guarantee that rules cannot change.

## Baselines inspected

| Source | Exact local baseline | Current observed capability |
| --- | --- | --- |
| `Agnuxo1/benchclaw` / `D:/PROJECTS/95_BenchClaw` | `1217cee97e8d7443ee46fefb9e7de9872ec88a69`, 2026-04-26 | CLI, dashboard and adapters that call remote P2PCLAW evaluation services; no local 17-judge implementation present in this checkout |
| `Agnuxo1/EnigmAgent` / `D:/PROJECTS/32_enigmagent` | `2b4d3fff45463b74430563c89a38a58dbe3e153c`, 2026-09-17 | v3 authenticated vault, bounded fixed-operation broker, adapters and release/threat-model documentation |
| `Agnuxo1/enigmagent-mcp` | Public default-branch package inspected 2026-09-30, package version 2.0.0 | Separate older MCP/REST package; not the canonical v3 integration used here |

Both local source trees and public GitHub files were inspected. BenchClaw contains many existing untracked research files; none were copied, modified or published. EnigmAgent's local working tree was clean. Public repository admin/push access was observed through the GitHub connector. License files in the two reused projects are MIT and name Francisco Angulo de Lafuente.

## Actual code reuse

- `server/http.mjs` adapts the request function from BenchClaw `cli/index.js`. It keeps Node's native HTTPS request + JSON payload + buffered-response pattern, adding response/deadline bounds, fixed redacted error codes, abort signals and credential handling. The BenchClaw remote tribunal is not run or reimplemented.
- `vendor/enigmagent/vault-core.js`, `operation-broker.js`, `gateway-policy.js` are byte-for-byte copies of the canonical EnigmAgent v3 MCP server files at the baseline above. The upstream MIT notice is retained. File hashes are recorded in `docs/source-manifest.json`.
- The authenticated vault actually stores the Nebius credential in backend memory. The original broker actually executes an operator-defined synthetic health operation. The fixed GET/HEAD broker cannot perform chat POST inference; Studio does not imply otherwise.
- No code was copied from the older `enigmagent-mcp` repository.

## Before / after

| Before the Studio work | Created in this contest window |
| --- | --- |
| BenchClaw's remote publishing/leaderboard workflow | Task library, execution workspace, per-run artifacts and source-citation inspection |
| General multi-dimensional scores in historical UI | Fixture-specific deterministic acceptance checks, with clear limitations and no IQ claims |
| Existing Node client HTTP function | Isolated Nebius client, bounded structured-action agent runner, measured provider receipts |
| EnigmAgent vault and fixed-operation boundary | Trusted-backend integration and a status-only protected-service demonstration, with exact upstream code preserved |
| No equivalent local run comparison in inspected clients | Task/input/validator/runtime/permissions equivalence manifest, history and export |
| Existing independent project branding | Original accessible Studio UI and responsive states |

These Studio features are being created on 2026-09-30, after the window opened. Existing EnigmAgent v3 work occurred during the contest window but was already present before this Studio request; it is reused and credited, not described as newly created for Studio. Git history and a final commit/tag must substantiate the submitted version; no submission tag is claimed yet.

## Model and resources

Selected served model: `nvidia/nemotron-3-super-120b-a12b` on Nebius Token Factory. The current Nebius cookbook links this identifier. Confirm the account catalog and authenticated call before calling it live-validated. Review the NVIDIA model card/license and Nebius platform conditions before final delivery. Remote model weights are not included in the software distribution.

All fixtures are synthetic original examples. The lettermark, CSS illustrations, layout and interface assets are original; typography uses operating-system fonts. No music, sponsor marks, scraped datasets or third-party artwork is included.

Sources: [official rules](https://nebiusglobalaihackathon.devpost.com/rules), [organizer resources](https://nebiusglobalaihackathon.devpost.com/resources), [organizer updates](https://nebiusglobalaihackathon.devpost.com/updates), [Nebius quickstart](https://docs.tokenfactory.nebius.com/quickstart), [Nemotron cookbook](https://github.com/nebius/token-factory-cookbook/blob/main/models/nemotron/README.md), [EnigmAgent](https://github.com/Agnuxo1/EnigmAgent), [BenchClaw](https://github.com/Agnuxo1/benchclaw).
