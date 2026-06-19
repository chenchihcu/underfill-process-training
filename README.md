# Underfill Process Learning & Engineering Decision Support

The maintained product is the Vite multi-page application in `underfill-process-training/`.

It combines:

- Bilingual Underfill process training.
- Versioned, sourced engineering limits.
- Fail-closed package recommendations.
- Explicit Visual/X-Ray/CSAM inspection records stored in IndexedDB.
- JSON/CSV record export and JSON import.
- Nine engineering-realistic SMT/Underfill simulator modules.
- Offline operation with a verified 2D fallback.

SPI, FPCA, and Reflow are training-only until controlled module-specific specifications are approved.

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

## Public sites

- Canonical: https://underfill-tutorial.netlify.app/
- Mirror: https://chenchihcu.github.io/underfill-process-training/

Both sites must report the same commit, specification version, application version, and artifact hash in `build-meta.json` before a release is accepted.

See [DEPLOY.md](DEPLOY.md) for release and rollback procedures and [docs/underfill-website-audit-2026-06-19.md](docs/underfill-website-audit-2026-06-19.md) for the audit remediation register.
