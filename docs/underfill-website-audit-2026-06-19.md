# Underfill Website and Code Audit

Date: 2026-06-19
Mode: read-only product/code review; only this report and the requested repo rule were added

## Executive summary

The project has strong source material and a usable visual shell, but it is not yet reliable enough to act as an engineering decision tool. The main cause is three independently evolving implementations with duplicated material constants and no canonical source-of-truth model:

1. Netlify production dashboard: <https://underfill-tutorial.netlify.app/>
2. GitHub Pages training site and five-scene simulator: <https://chenchihcu.github.io/underfill-process-training/>
3. Local nine-module simulator under `underfill-process-training/`

The user's concern about the 3D model is valid. The production model is a generic board, die, ball grid, and needle made from primitives. The local nine-module simulator has more modules but uses camera distances around 50-55 units for models only a few units wide, leaving most scenes tiny inside a large empty viewport. Neither simulator expresses the engineering distinctions emphasized by the references: pitch, ball size, standoff, flow-front behavior, vent path, fillet geometry, defect location, flux compatibility, or package-specific risk.

Four high-priority correctness issues should be fixed before investing in visual polish:

- quality counters increase during initialization, translation, reload, and slider movement rather than when a sample is accepted;
- several material/process ranges disagree with the supplied standard;
- the component decision matrix can recommend the wrong Underfill strategy;
- the GitHub Pages deployment serves a different application than the current `gh-pages` branch and documented deployment target.

## Source-of-truth comparison

Primary local references reviewed:

- `docs/reference/Underfill作業標準書.pdf`, pages 1-7
- `docs/reference/Underfill作業標準書.docx`
- `docs/reference/Underfill_作業標準書 工程版.docx`
- `docs/reference/Underfill_Matrix.xlsx`, sheet `Underfill Matrix`, range `A1:F7`
- `docs/reference/Underfill_Engineering_Blueprint.pptx`, slides 1-8

| Topic | Supplied reference | Website/local implementation | Gap |
| --- | --- | --- | --- |
| Storage | -25°C to -15°C, unopened and dry | -40°C to -15°C | Incorrect lower bound |
| Pot life | 3 days at 25°C, defined by 25% viscosity increase | 24 h | Incorrect and definition omitted |
| Thawing | 10 cc: 1 h; 30 cc: 1.5 h; 55 cc: 2-3 h | Fixed 2 h | Syringe-size dependency omitted |
| Preheat | Standard 75-90°C; accepted 70-90°C | 70-100°C, optimum 85°C | Upper range exceeds reference |
| Dispense pressure | 0.10-0.35 MPa | 0.10-0.50 MPa | Upper range exceeds reference |
| Dispense height | 0.2-0.5 mm above component | 0.05-0.50 mm, optimum 0.10 mm | Range and meaning conflict |
| Cure | >=8 min at 130°C; engineering edition also lists 5 min at 150°C | Both profiles shown without source/version | Needs approved source/version label |
| Voiding | <=25% of an individual solder-joint projected area, plus position/connectivity rules | <=25% total area, represented as generic circles | Wrong denominator and missing risk topology |
| Fillet | 50-75% sidewall height, 100% continuous perimeter, no cracks/contamination/clearance breach | Height slider only | Acceptance logic incomplete |
| Component strategy | WLCSP/Flip Chip mandatory; Standard BGA risk-based; QFN/LGA conditional and full UF generally discouraged | WLCSP recommended, Flip Chip `Core`, large BGA mandatory, QFN recommended | Decision guidance is not aligned |
| Process control | Needle gauge, pressure, height, edge distance, delay, preheat, dispensed weight/flow, staging, Plasma, inspection traceability | Mostly temperature, speed, pressure, and height sliders | Major controls and records absent |

## Findings

### F1 - High - Quality counts are corrupted by UI rendering

Issue: `updateFillet()` and `updateVoiding()` increment persisted pass/reject counters every time they run. They run during page initialization and language changes, and slider `input` events can add many samples during one drag.

Evidence:

- `dashboard/app.js:520-530`
- `dashboard/app.js:562-580`
- `dashboard/app.js:857-865`
- `dashboard/app.js:2330-2334`
- Live observation: the counter increased from `2/0` to `4/0` after language switching and to `6/0` after reload without inspecting any new product.

Recommendation: separate display recalculation from sample recording. Add an explicit `Record inspection` action with sample ID, timestamp, fillet result, void result, and batch ID. Never increment counters from render, translation, or slider-preview functions.

### F2 - High - Material and process limits disagree with the supplied standard

Issue: storage, pot life, preheat, pressure, thawing, and needle-height values conflict with the supplied SOP.

Evidence:

- Website constants/content: `dashboard/index.html:36-40`, `dashboard/index.html:759-783`
- Reference: `Underfill作業標準書.pdf`, pages 1-3
- Simulator drift: `underfill-process-training/js/data/materials.js:18-24` reports UF3808 as 380 mPa-s, CTE 28 ppm/°C, Tg 155°C, and 65% filler, conflicting with the dashboard/reference values.

Recommendation: create one versioned `process-spec.json` generated from an approved engineering source. Every UI, quiz, simulator, and report must read the same values and show source revision/effective date.

### F3 - High - Component recommendations can drive the wrong process choice

Issue: the dashboard's four hard-coded component mappings do not match the supplied matrix or blueprint.

Evidence:

- Dashboard mapping: `dashboard/app.js:13-17`
- Reference: `Underfill_Matrix.xlsx`, `Underfill Matrix!A1:F7`
- Reference: engineering blueprint slide 2

Recommendation: replace the component dropdown with a decision model using package type, pitch, ball size, standoff, die/package size, clearance, reliability class, and use environment. Show recommendation strength, rationale, and required validation rather than a single absolute tag.

### F4 - High - Public deployments and source branches are split

Issue: Netlify serves the dashboard, while GitHub Pages serves the older training site and a different five-scene simulator. The fetched `gh-pages` branch currently contains dashboard files, so the live Pages site is not serving the documented branch artifact. The local nine-module simulator is a third implementation.

Evidence:

- `.github/workflows/deploy-pages.yml` publishes `dashboard/` to `gh-pages`.
- `origin/gh-pages` points to deployment commit `a8f7659` for main commit `41b7941` and contains `app.js`, `index.html`, `manifest.json`, `style.css`, and `sw.js`.
- Live GitHub Pages title is `Underfill 製程訓練`, and its simulator loads `src/js/simulation/main.js`.
- Live GitHub Pages `index.html` and `simulation.html` do not hash-match the local source or local `_site` files.

Recommendation: choose one canonical public product. Repair the GitHub Pages source/configuration, display build commit/version in the UI, and add a release check that compares served asset hashes with the intended artifact.

### F5 - Medium - 3D scenes lack engineering realism and product identity

Issue: the 3D assets are procedural boxes, planes, spheres, and cylinders with generic materials. They do not resemble the supplied package cross-sections or show meaningful process mechanics. The local nine-module camera presets place models far away.

Evidence:

- Production primitives: `dashboard/app.js:1455-1511`
- Local simulator camera: `underfill-process-training/js/scene.js:14-20`, `underfill-process-training/js/scene.js:185-193`
- Reference visuals: SOP PDF pages 3 and 5; blueprint slides 1, 5, 6, and 8

Recommendation: build one data-driven BGA assembly model with recognizable PCB stack-up, solder mask, pads, solder balls, die/package, gap/standoff, nozzle/needle, bead, flow front, fillet, and defect overlays. Fit the camera to the model bounding box per module. Use the supplied cross-sections and flow diagrams as the visual language; do not chase photorealism before process meaning is correct.

### F6 - Medium - Acceptance and defect logic is oversimplified

Issue: the X-Ray view treats voiding as one percentage and does not model per-ball area, location, ring/edge connectivity, flow-front closure, or interface risk. Fillet logic checks height only. CSAM is a gallery label rather than a decision workflow.

Evidence:

- `dashboard/index.html:268-343`
- `dashboard/app.js:520-580`
- SOP PDF pages 4-7
- Blueprint slide 8

Recommendation: implement multi-factor inspection cards: per-ball void area, defect topology, location risk, fillet continuity, contamination/clearance, CSAM delamination extent, and stop/hold/disposition outcomes.

### F7 - Medium - Prediction formulas are uncalibrated and contradict the dashboard

Issue: the Simulator Lab uses hand-authored linear equations with no units, dataset, confidence, or validation status. At default settings it predicts 26% voiding and REJECT, while the dashboard independently displays 12% and PASS.

Evidence: `dashboard/app.js:1140-1149` and live browser inspection.

Recommendation: label the current equations as illustrative training heuristics or remove predictive wording. For production use, calibrate from DOE data and show model version, valid input domain, uncertainty, and validation metrics.

### F8 - Medium - 3D/offline fallback can fail before fallback runs

Issue: `ensure3D()` returns `null` when the CDN import fails, but each initializer immediately dereferences `.THREE`. The rejected async function prevents the intended 2D fallback call from running. The service worker also does not cache Three.js.

Evidence:

- `dashboard/app.js:1397-1400`
- `dashboard/app.js:1455-1459` and equivalent initializers at lines 1625, 1729, 1790, 1819, and 1877
- `dashboard/app.js:2300-2310`
- `dashboard/sw.js:1-20`

Recommendation: return cleanly when the engine is unavailable, catch each initializer, and invoke a verified fallback. Bundle or cache the exact Three.js version if offline operation is a real requirement.

### F9 - Medium - Legacy training source contains severe encoding corruption

Issue: `underfill-process-training/index.html` renders mojibake and literal malformed closing tags. The scan found 165 mojibake markers and 330 `??` pairs. `simulation.html` also contains `??Flow`, `??Quiz`, and `?? Data`.

Evidence:

- `underfill-process-training/index.html`
- `underfill-process-training/simulation.html:68-79`
- Local browser inspection

Recommendation: restore clean UTF-8 source from a known-good revision, remove generated/corrupt duplicate entrypoints, and add an encoding scan to CI.

### F10 - Medium - Localization and navigation accessibility are incomplete

Issue: the language toggle translates only a small subset of controls; headings, labels, navigation, checklist text, and tutorial content remain mixed-language. Sidebar routes are clickable `<li>` elements, exposed as generic DOM nodes rather than links/buttons, with no keyboard activation contract.

Evidence:

- `dashboard/app.js:35-67`, `dashboard/app.js:214-238`
- `dashboard/index.html:64-87`
- `dashboard/app.js:926-951`
- Live accessibility snapshots

Recommendation: use complete translation keys and semantic `<button>` or `<a>` navigation with focus, keyboard, `aria-current`, and visible focus states.

### F11 - Medium - PWA cache policy can serve stale releases

Issue: the service worker uses cache-first for all requests and the fixed cache name `underfill-v2`. Updated assets are not refreshed until the cache name changes or storage is cleared.

Evidence: `dashboard/sw.js:1-20`.

Recommendation: use hashed assets or network-first/stale-while-revalidate for application files, include build revision in cache keys, and test upgrades from the previous production version.

### F12 - Low - Operator log accepts user markup

Issue: batch ID is concatenated into a log message and the log is rendered with `innerHTML`. This permits markup injection into the local dashboard session.

Evidence: `dashboard/app.js:800-817`, `dashboard/app.js:840-848`.

Recommendation: render log entries with `textContent` and DOM nodes; do not concatenate user values into HTML.

### F13 - Medium - Verification and risk documentation are stale

Issue: there is no automated web test suite. `docs/risk-ledger.md` says LocalStorage is only proposed even though it is implemented, and its dark-theme rollback guidance no longer matches the current light-theme source.

Recommendation: add focused browser checks for route switching, counters, translation, material consistency, mobile layout, 3D fallback, and deployment hashes. Refresh the risk ledger after fixes are approved.

## Recommended action roadmap

### Phase 0 - Correctness stop-loss (1-2 days)

1. Fix the inspection counter so preview/render events never create samples.
2. Approve a source hierarchy and correct storage, pot life, thawing, preheat, pressure, height, cure, and acceptance wording.
3. Replace the component matrix with the approved package strategy.
4. Add a visible `Training only` banner until predictive and acceptance logic is validated.

Exit gate: all displayed limits trace to one approved source revision; counter tests pass; no contradictory defaults remain.

### Phase 1 - Consolidate product and deployment (2-3 days)

1. Select one canonical app and one canonical simulator.
2. Remove or archive obsolete generated/corrupt entrypoints.
3. Repair GitHub Pages configuration and verify both hosts serve the intended commit.
4. Add build revision, cache revision, and served-asset hash checks.

Exit gate: one source tree produces both public deployments, and live hashes match the release artifact.

### Phase 2 - Engineering-realistic simulator (3-5 days for first vertical slice)

1. Build one high-quality BGA scene before expanding modules.
2. Drive geometry from die size, pitch, ball diameter, standoff, and clearance.
3. Show nozzle position, bead deposition, flow front, vent direction, fillet formation, and visible time/progress.
4. Add camera fit-to-object and inspection presets: top, side cross-section, 45-degree process, X-Ray overlay, and CSAM overlay.
5. Reproduce I/L/U behavior from blueprint slide 5, including racing/air-lock risk rather than merely drawing different lines.

Exit gate: an engineer can identify the package, process stage, flow path, and failure mechanism without reading the control labels.

### Phase 3 - Workflow value (2-4 days)

1. Add syringe-size thaw guidance, Plasma/staging controls, dispensed weight/flow monitoring, and product-level traceability.
2. Upgrade inspection logic to topology-aware voiding, full fillet criteria, and CSAM disposition.
3. Replace generic icons in the gallery with approved reference imagery or purpose-built diagrams.

### Phase 4 - Durable verification (1-2 days initial harness)

1. Add static syntax, UTF-8/mojibake, source-data consistency, and local-asset checks.
2. Add browser checks at desktop and mobile breakpoints.
3. Add a live deployment comparison command for title, commit marker, and asset hashes.
4. Require screenshots for dashboard, theory, simulator, quality, knowledge, and tutorial routes.

## Verification performed

- In-app browser inspection of every Netlify dashboard route at 1280x720.
- Mobile inspection at 390x844; no document-level horizontal overflow observed.
- Live interaction with language toggle and dispensing simulation.
- Live inspection of GitHub Pages training and five-scene simulator.
- Local HTTP inspection of the nine-module simulator and corrupted training page.
- Console warning/error inspection: no warnings or errors observed during the reviewed flows.
- JavaScript syntax: 36 source `.js` files checked with `node --check`; 0 failures.
- Local HTML asset scan: no production missing assets; the source training page's `simulation.html` link resolves only after build output placement.
- DOCX/PDF/XLSX/PPTX content and visual review completed for the supplied references.

## Residual risk

- The supplied references disagree in a few places, including package recommendation strength and whether the 150°C/5 min cure profile is part of the active standard. Engineering must approve a document hierarchy before implementation.
- No production-side configuration was changed, and no source bugs were fixed in this audit.
- Browser coverage did not include every slider combination, offline mode, older industrial browsers, or device/GPU performance profiling.

## Remediation register — implementation update

The original findings above are retained as audit evidence. The remediation implementation makes `underfill-process-training/src` the canonical source and replaces the former dashboard and duplicate simulators. Status is `implemented-local` until the live single-artifact workflow completes successfully.

| Finding | Root cause | Implemented target behavior | Gate and evidence | Status | Residual risk |
|---|---|---|---|---|---|
| F1 | Preview/render functions mutated quality counters. | Preview evaluation is pure. Only `Record inspection` creates one schema-v1 IndexedDB record; totals are derived from stored records. | Unit acceptance/record tests and E2E `preview...never create` plus `one explicit submission...`. | implemented-local | Browser storage can be cleared; export warning remains mandatory. |
| F2 | Engineering limits were duplicated across UI and modules. | `process-spec.v1.json` is the sole controlled source, validated by JSON Schema with source, reference, unit, precision and status. Non-controlled rules fail closed. | `npm run validate:spec`; source buttons expose rule provenance. | implemented-local | Engineering remains responsible for approving future source revisions. |
| F3 | Package recommendations were hardcoded and contradicted the matrix. | A data-driven service accepts package geometry, reliability, environment, material and profile; it emits controlled decision classes, missing evidence and validation actions. | Recommendation unit fixtures and E2E fail-closed case. | implemented-local | No numeric package threshold is invented where the source is silent. |
| F4 | Three public implementations and independent deploy paths drifted. | One Vite source produces one deterministic `dist` artifact; one workflow uploads it to Netlify and Pages and compares live metadata/hashes. | `npm run verify:dist`; `verify-release.mjs`; release workflow. | implemented-local / live-pending | GitHub Pages must be configured for Actions and Netlify secrets must exist. |
| F5 | Primitive scene geometry and distant fixed cameras obscured process meaning. | Nine modules share a dimensioned PCB/pad/ball/package/die/nozzle/flow model with automatic bounding-box camera fit, scale data and deterministic geometry. | E2E iterates all nine modules and checks active renderer plus dimension/status output. | implemented-local | GPU performance still varies by industrial workstation. |
| F6 | Acceptance used simplified total-area and height-only rules. | The engine evaluates every solder-joint void, topology, location, fillet height, full perimeter, crack, contamination, clearance and CSAM disposition with reason codes. | Boundary and multi-joint unit tests. | implemented-local | Inspectors must provide valid topology/location and CSAM dispositions. |
| F7 | An uncalibrated formula emitted authoritative PASS/REJECT. | It is now a versioned `training-estimate` with assumptions, `calibrated:false`, and `result:null`. | Unit test asserts no acceptance result; UI displays the non-calibrated boundary. | implemented-local | Production prediction remains unavailable until approved DOE calibration exists. |
| F8 | CDN failure was dereferenced before fallback and Three.js was not offline. | Three.js is pinned and bundled. Renderer initialization is guarded and a useful interactive 2D cross-section is activated on failure. | Forced `?fallback=1` E2E and offline reload test. | implemented-local | 2D mode explains geometry but does not reproduce full 3D interaction. |
| F9 | Maintained generated HTML contained severe mojibake. | Canonical UTF-8 sources replace corrupted generated entrypoints; CI scans source and distribution for replacement/mojibake markers. | `npm run test:encoding`; `npm run verify:dist`. | implemented-local | Newly supplied external documents are outside the source scan. |
| F10 | Translation coverage was partial and navigation used generic clickable nodes. | Complete Traditional Chinese/English dictionaries drive all maintained UI; navigation uses buttons/links with focus and `aria-current`. | Dictionary parity unit test, bilingual lesson E2E and visual focus check. | implemented-local | A professional linguistic review is still advisable for terminology nuance. |
| F11 | Fixed cache name and cache-first HTML pinned stale releases. | Build-hash caches use network-first HTML, immutable hashed assets, old-cache cleanup and an update notice. Asset matching handles `Vary: Origin`. | Playwright installs, claims, disables network and reloads successfully. | implemented-local | Browser-managed storage eviction remains possible. |
| F12 | User batch text entered `innerHTML`. | Dynamic UI uses `textContent`/DOM nodes; identifiers and notes are length/control-character validated. | Unit export test and E2E markup payload remains literal with zero injected images. | implemented-local | Free-text exports may contain sensitive data entered by users; no upload occurs. |
| F13 | No automated web suite and stale release/risk guidance. | Deterministic scripts cover specification, encoding, unit, build, distribution, browser, responsive, visual, fallback, offline and live parity gates; README/DEPLOY/AGENTS are synchronized. | `npm run check`, `npm run test:e2e`, and release workflow. | implemented-local | Live parity cannot be marked verified until the protected production workflow runs. |

### Release-gate mapping

1. **Specification:** schema validity, source references and controlled-status checks.
2. **Correctness:** inspection, recommendation, training-estimate, storage and markup-safety tests.
3. **Simulator:** all nine modules, camera fitting, dimensions and 2D fallback.
4. **Experience:** eight bilingual training modules, semantic navigation, focus/color roles and mobile overflow.
5. **Offline:** worker installation, cache claim, offline module loading and old-cache cleanup logic.
6. **Parity:** canonical training/tool coverage must pass before legacy deletion.
7. **Release:** both hosts must expose matching commit, specification, application and artifact hashes.

### Durable prevention rules

- No controlled value may be added outside `process-spec.v1.json`.
- No render, preview, language, navigation or slider handler may persist a sample.
- No non-controlled module may return production acceptance.
- No production deploy may bypass the shared artifact or the live parity check.
- Repeated violations belong in a test or verification script first; repository `AGENTS.md` remains the concise governance map.

## Production closeout — 2026-06-19

The remediation-register status column was written before production configuration and deployment. This closeout supersedes every `implemented-local` or `live-pending` status above with `verified-production`; the documented residual boundaries remain applicable.

- Final application commit: `e0b42cd`.
- Successful workflow: `Verify and release Underfill`, run `27802550100`.
- Canonical Netlify site: `https://underfill-tutorial.netlify.app/`.
- GitHub Pages mirror: `https://chenchihcu.github.io/underfill-process-training/`.
- Shared production artifact hash: `2d7beb7fb081a099`.
- Both hosts reported application `3.0.0`, specification `UF-ENG-2026.04-v1`, and commit marker `e0b42cde`.
- Live in-app browser inspection found eight bilingual lessons, zero document-level horizontal overflow, and no browser warnings or errors.
- The workflow completed specification, encoding, unit, build, distribution, desktop/mobile browser, nine-module simulator, forced fallback, offline, Netlify, Pages, and live parity gates successfully.

## High-fidelity thematic redesign — 2026-06-19 follow-up

This section supersedes the former eight-lesson experience description while preserving the original audit as historical evidence.

- The redesigned release is versioned as application `3.1.0`; specification authority remains `UF-ENG-2026.04-v1`.
- Training is now organized as ten fixed bilingual engineering themes. Every theme includes principle, controlled-rule references, shop-floor actions, evidence, normal/abnormal mechanisms, a case, an immediate quiz, and a simulator deep link.
- `training-content.v1.json`, `simulation-modules.v1.json`, and `media-manifest.v1.json` separate learning structure, simulator behavior, and media provenance from `process-spec.v1.json`, which remains the only engineering-value source.
- The nine simulators now share ready/run/pause/step/fault/inspection/reset state semantics, route-level dynamic loading, PBR materials, ACES tone mapping, environment lighting, instanced solder balls, transparent sections, overlays, camera presets, adaptive software-render quality, and switch-time 2D recovery.
- The home route no longer loads Three.js. The previous single 567 kB initial simulator warning is removed from the training route; the simulator engine is an isolated dynamic chunk.
- Desktop 1280×720 and mobile 390×844 acceptance covers theme depth, module authority, timelines, fault/overlay controls, mobile model-first layout, explicit record side effects, safe imported/user text, offline nine-module switching, and object-count parity after a full module cycle.
- This remains a high-fidelity training twin. It is not described as a calibrated one-to-one digital twin or production predictor without machine, fixture, package CAD, DOE, CFD/FEA, and calibration data.
- Media provenance and rights holders are recorded. Vendor-image copyright and trademark exposure remains an explicitly accepted release risk, not an authorization claim.
