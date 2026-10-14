# Repository Instructions

## Knowledge Map

- Cursor gateway:`.cursor/rules/agents_gateway.mdc`
- 通用 UI/UX 規則:`.cursor/rules/ui-ux-universal.mdc`（Web §9）
- 風險帳:`docs/risk-ledger.md`

## Website inspection recovery

- Use the Codex in-app Browser for read-only inspection of this project's public, unauthenticated websites.
- If Computer Use stops because it cannot verify the browser URL, do not repeat the same Computer Use attempt. Switch to the in-app Browser and continue the read-only audit.
- This standing fallback authorization covers navigation, screenshots, DOM inspection, and other non-mutating checks only. It does not waive confirmation requirements for sign-in, form submission, uploads, permission changes, or any external side effect.
- Report which browser surface was used and any verification gaps in the final delivery.

## Engineering-product guardrails

- Treat `underfill-process-training/src/data/process-spec.v1.json` as the only application source for engineering limits. Do not hardcode controlled limits in HTML, UI controllers, tests, or simulator modules.
- Preview, render, language, navigation, and slider handlers must remain side-effect free. Only an explicit record action may create an inspection sample.
- Label each module's authority (`controlled` / `training-only` / `experimental` / `disputed`) in both the UI and its manifest. A module with `training-only`, `experimental`, or `disputed` authority must not emit production PASS/REJECT, release guidance, or production-result controls.
- Render user and imported values with `textContent` or safe DOM construction. Do not concatenate them into `innerHTML`.
- Do not remove a legacy implementation until the canonical build passes specification, correctness, simulator, bilingual, accessibility, offline, and parity gates.
- Production release requires one CI build deployed to all public hosts (Netlify + GitHub Pages); before releasing, verify commit, app/spec version, manifest, and artifact hash are identical on every host. Do not release until parity passes.
