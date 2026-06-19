# Canonical Underfill application

This directory is the only maintained website source.

## Source layout

- `src/index.html`: bilingual training and engineering decision support.
- `src/simulation.html`: nine-module engineering simulator.
- `src/data/process-spec.v1.json`: sole controlled engineering-data source.
- `src/js`: acceptance, recommendation, records, localization, and simulator logic.
- `scripts`: specification, encoding, build, distribution, and live-release gates.
- `tests`: unit and browser acceptance coverage.
- `dist`: generated and ignored production artifact.

## Commands

```powershell
npm ci
npm run check
npm run test:e2e
```

`npm run check` validates encoding and the controlled specification, runs unit tests, builds the deterministic artifact, and verifies the distribution. Browser tests cover desktop/mobile interaction, all nine modules, the 2D fallback, and offline reload.

## Authority boundary

Underfill rules marked `controlled` may support engineering decisions. SPI, FPCA, and Reflow are deep training modules and must not produce production acceptance until controlled module-specific references are approved.
