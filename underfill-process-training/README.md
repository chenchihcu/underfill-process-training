# Canonical Underfill application

This directory is the only maintained website source.

## Source layout

- `src/index.html`: bilingual training and engineering decision support.
- `src/simulation.html`: nine-module engineering simulator.
- `src/data/process-spec.v1.json`: sole controlled engineering-data source.
- `src/data/training-content.v1.json`: ten bilingual topics, cases, quizzes, evidence, and simulator deep links.
- `src/data/simulation-modules.v1.json`: nine module authorities, phases, faults, overlays, and rule references.
- `src/data/media-manifest.v1.json`: offline media inventory, provenance, rights holder, caption, and alt text.
- `src/js`: acceptance, recommendation, records, localization, experience rendering, state machine, and dynamically loaded 3D engine.
- `scripts`: specification, encoding, build, distribution, and live-release gates.
- `tests`: unit and browser acceptance coverage.
- `dist`: generated and ignored production artifact.

## Commands

```powershell
npm ci
npm run check
npm run test:e2e
```

`npm run check` validates encoding, controlled specifications, experience schemas and cross-references, runs unit tests, builds the deterministic artifact, and verifies the distribution. Browser tests cover ten topics, desktop/mobile interaction, all nine module timelines, resource-count parity after switching, the 2D fallback, and offline operation.

## Authority boundary

Underfill rules marked `controlled` may support engineering decisions. A module authority describes its references, not blanket permission to release product. Training-only, experimental, and disputed modules must never emit production PASS/REJECT. The current models are replaceable high-fidelity training twins; calibrated CAD/DOE/CFD/FEA assets are required before any one-to-one digital-twin claim.

The training route does not load Three.js. The simulator engine is route-level dynamic content, uses adaptive quality for software rendering, and falls back to an interactive SVG cross-section if WebGL initialization or a module switch fails.
