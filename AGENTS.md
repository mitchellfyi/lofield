# Agent Playbook

This document explains how human collaborators, GitHub Copilot, and other AI coding agents should operate inside the Lofield FM repository. Treat it as the “read this first” checklist before touching the codebase.

## 1. Required Reading

Review these files **before** writing code:

1. `.github/copilot-instructions.md`
2. `README.md`, `QUICKSTART.md`, `DOCKER.md`, and `docs/deployment.md`
3. `docs/style_guide.md` (tone), `docs/architecture.md` (system overview), `config/README.md` (station data)
4. Any file referenced in the task/issue description

## 2. Operating Principles

- **Docs-as-code**: Follow the industry guidance highlighted in the [GitHub documentation playbooks](https://github.com/resources/articles/tools-and-techniques-for-effective-code-documentation). Every code change must consider whether a doc, runbook, or config example needs to change in the same PR.
- **Single source of truth**: `.env` lives in the repo root. Use `make env-sync` so `web/.env`, `services/scheduler/.env`, and `services/playout/.env` stay aligned.
- **Automate via `make`**: Prefer the provided targets (`make dev`, `make dev-hot`, `make migrate`, `make seed`, `make logs`, `make lint`, `make typecheck`, `make test`, `make quick-ci`, `make validate-config`) instead of ad‑hoc commands. That keeps local, CI, and docs workflows in sync.
- **Security first**: Never commit secrets, credentials, or real `.env` files. When a task involves auth, document the secure flow rather than hardcoding tokens.
- **Fail loudly**: If automation, migrations, or docs fall out of sync, pause and explain the inconsistency rather than papering over it.

## 3. Standard Workflow for Agents

1. **Understand the task**: Read the full issue/PR plus all linked context. Summarize the acceptance criteria in your own words.
2. **Find the relevant code**: Use search (`grep`, `codebase_search`) and the repo structure above before editing.
3. **Plan**: Outline your approach (even briefly) so reviewers can follow your reasoning.
4. **Edit**: Favor small, focused commits. Keep files ASCII unless the file already uses Unicode accents/emoji.
5. **Run checks**:
   ```bash
   make lint
   make typecheck
   make test
   make quick-ci   # Lint + type + test + build + config validation
   make validate-config
   ```
6. **Update docs**: If the behavior, API, CLI, or workflows changed, update the relevant Markdown file during the same PR.
7. **Summarize clearly**: Reference files (not line numbers) and call out risks, TODOs, or manual steps that remain.

## 4. Documentation Expectations

- Keep Markdown approachable and scannable: short paragraphs, headings, bullet lists.
- Reference the new Docker/Makefile flow (`make setup`, `make env-sync`, `make dev`).
- Whenever you introduce a new command, add it to the most visible doc (README, QUICKSTART, or DOCKER) and note which Make target runs it.
- Cite monitoring/ops steps using concrete commands (`docker compose logs -f web`, `curl /api/health`), not just prose.

## 5. Voice & Tone

- Adopt the Lofield FM voice: dry, self-aware, remote-work humor. See `docs/style_guide.md`.
- Avoid motivational clichés, politics, or personal opinions. The station is fictional but the operating notes are not.

## 6. Communication Guidelines

- Be explicit about assumptions, risks, or incomplete information.
- Suggest verification steps (tests, `make quick-ci`, `docker compose ps`, etc.) after each substantial change.
- When blocked, state what you tried and what data would unblock you.

## 7. Copilot / AI Agent Notes

- Copilot instructions live in `.github/copilot-instructions.md`. Keep that file updated whenever workflows shift.
- If you introduce new scripts or commands, append them to the “Common Tasks” or “Development Setup” sections in the Copilot instructions file so the next agent inherits the context.

---

*The TL;DR: read the docs, use the Makefile, keep secrets secret, and update documentation every time the code changes.*

