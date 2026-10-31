# ECC subset (vendored)

Hand-picked subset of [affaan-m/ECC](https://github.com/affaan-m/ECC) v2.2.3 (commit b38be6a), MIT licensed (see ECC-LICENSE).
Skills/agents/commands/rules only — no hooks, no MCP configs, no installer.

- skills/: orch-pipeline, orch-build-mvp, orch-add-feature, orch-fix-defect, blueprint, search-first, tdd-workflow, verification-loop, security-review, frontend-design-direction
- agents/: planner, architect, code-architect, code-explorer, code-reviewer, tdd-guide, security-reviewer, build-error-resolver, gan-planner, gan-generator, gan-evaluator
- commands/: /gan-build, /plan, /code-review, /build-fix
- rules/common/: shared rules referenced by orch-pipeline

Main entry point for a new app: `orch-build-mvp <spec-doc>`.
