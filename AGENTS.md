# AGENTS.md

## Purpose
This file defines non-negotiable standards for keeping code, documentation, and testing consistent in Seldon's Game TNG.

## Scope
Applies to the repository root and `seldon-game/` application code.

## Source of Truth Order
1. Runtime behavior in `seldon-game/src/`
2. `PRODUCTION_NOTES.md` (implemented features)
3. `ROADMAP.md` (planned work)
4. `DOCUMENTATION_INDEX.md` (navigation)
5. Archive docs (`Design Documents Archive/`, `Implementation History/`) as reference only

## Core Engineering Rules
- Keep TypeScript strict and warning-free.
- A change is not complete unless `npm.cmd run build` passes locally.
- Do not introduce dead code, unused params, or unused helpers.
- Do not edit generated/vendor artifacts unless explicitly required: `node_modules/`, `dist/`.
- Keep changes modular: simulation logic in `src/core/`, rendering in `src/rendering/`, utilities in `src/utils/`.
- Solo-dev override: you may bypass any rule for rapid experimentation, but before calling work done you must reconcile with the full checklist.

## Determinism Policy
- Core simulation must remain reproducible from seed.
- Do not use `Math.random()` in `src/core/**`.
- Use `SeededRandom` (or deterministic RNG utilities) with stable seed inputs.
- If non-determinism is intentionally introduced, document why and where in `PRODUCTION_NOTES.md`.

## Testing Policy
- Minimum quality gate for every change:
1. `npm.cmd run build`
2. Run/update targeted regression checks for affected systems
- For simulation logic changes, add/update deterministic tests in `seldon-game/tests/`:
- include fixed seed
- include phase count
- assert expected invariants/outcomes
- If a full test framework is absent, add executable TS smoke checks and wire them to npm scripts.

## Documentation Sync Policy
When behavior changes, update docs in the same change set:
- Implemented feature: update `PRODUCTION_NOTES.md`
- Planned/removed work: update `ROADMAP.md`
- Navigation/status changes: update `DOCUMENTATION_INDEX.md`
- Major phase completion: update/create `seldon-game/PHASE_X_COMPLETE.md`
- Version changes: keep `README.md` and `seldon-game/package.json` version fields aligned

## Change Checklist (required before merge)
- [ ] Build passes (`npm.cmd run build`)
- [ ] Determinism preserved (no new `Math.random()` in `src/core/**`)
- [ ] Tests added/updated for behavior changes
- [ ] Docs updated (`PRODUCTION_NOTES.md` / `ROADMAP.md` / `DOCUMENTATION_INDEX.md` as applicable)
- [ ] Version references aligned across docs/package
- [ ] No edits to generated/vendor files unless intentional and documented

## Review Priority
Reviewers should prioritize:
1. Correctness/regressions
2. Determinism and reproducibility
3. Test coverage for changed behavior
4. Documentation accuracy and version consistency
5. Style/refactor concerns
