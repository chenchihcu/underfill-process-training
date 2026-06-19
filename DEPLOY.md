# Underfill release and rollback

## Release contract

GitHub Actions builds once from `underfill-process-training/`, runs every release gate, and uploads the resulting `dist/` artifact to both Netlify and GitHub Pages.

Required repository configuration:

- GitHub Pages source: **GitHub Actions**.
- Protected `production` environment.
- `NETLIFY_AUTH_TOKEN`: scoped Netlify deploy token.
- `NETLIFY_SITE_ID`: site ID for `underfill-tutorial`.

The workflow never logs either secret. Netlify Git-triggered builds are skipped by `netlify.toml`; production comes only from the verified Actions artifact.

## Local pre-release

```powershell
cd underfill-process-training
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
```

## Release verification

```powershell
cd underfill-process-training
npm run verify:release -- https://underfill-tutorial.netlify.app https://chenchihcu.github.io/underfill-process-training
```

This compares application version, commit SHA, specification version, artifact hash, asset manifest, and critical routes.

## Rollback

1. Identify the previous known-good commit SHA.
2. Run the release workflow manually with that SHA as `release_ref`.
3. The workflow checks out and rebuilds that exact locked revision.
4. It deploys the resulting immutable artifact to both hosts.
5. Run the release verification command and confirm both hosts report the previous artifact hash.

IndexedDB records are not rolled back. Record readers remain forward-compatible and exported records retain their original specification version.

## Go/no-go

Release is blocked when specification validation, unit tests, encoding checks, build verification, browser tests, offline tests, Pages deployment, Netlify deployment, or live parity verification fails.
