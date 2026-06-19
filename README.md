# Underfill Process Learning & Engineering Decision Support

The maintained product is the Vite multi-page application in `underfill-process-training/`.

It combines:

- Ten bilingual, theme-based engineering learning paths with cases, evidence, failure mechanisms, experiments, and immediate quizzes.
- Versioned, sourced engineering limits.
- Fail-closed package recommendations.
- Explicit Visual/X-Ray/CSAM inspection records stored in IndexedDB.
- JSON/CSV record export and JSON import.
- Nine engineering-realistic SMT/Underfill training twins with a shared timeline, fault injection, overlays, and camera presets.
- Offline operation with a verified 2D fallback.

The simulator targets high-fidelity training, not a calibrated one-to-one digital twin. SPI, FPCA, and Reflow remain training-only; capillary-flow and warpage models remain experimental. None can issue production PASS/REJECT.

## Local development

```powershell
cd underfill-process-training
npm ci
npm run dev
```

## Required gates

```powershell
cd underfill-process-training
npm run check
npm run test:e2e
```

`process-spec.v1.json` is the only source for engineering values. Training, simulation, and media structure live in separate validated manifests and may reference—but never duplicate—those values.

## Public sites

- Canonical: https://underfill-tutorial.netlify.app/
- Mirror: https://chenchihcu.github.io/underfill-process-training/

Both sites must report the same commit, specification version, application version, and artifact hash in `build-meta.json` before a release is accepted.

See [DEPLOY.md](DEPLOY.md) for release and rollback procedures and [docs/underfill-website-audit-2026-06-19.md](docs/underfill-website-audit-2026-06-19.md) for the audit remediation register.
