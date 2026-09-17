# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Behavioral guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---


**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## What this repo is

A static marketing/campaign website for gventus (`gventus.store`) plus its small Flask API backend. There is no build step, no bundler, no package manager for the frontend — pages are plain HTML files with `<script>`/`<link>` tags to shared JS/CSS. `api/server.py` is a standalone Flask app that receives form submissions and forwards them to Telegram.

`choi3/` is a **separate, independently-deployed project** (its own git repo, own CI, own EC2 subdomain `choi3.gventus.store`). It is excluded from this repo's git tree via `.gitignore` (`/choi3/`) and from the deploy rsync. Don't assume changes there affect the main site, and don't include it when reasoning about "the repo" unless the user is specifically working inside `choi3/`.

## Running locally

Frontend: no server is required for static pages — open the HTML files directly, or serve the directory root with any static file server (e.g. `python3 -m http.server`) since pages reference assets with root-relative paths under `/assets/...`.

API (`api/server.py`):
```bash
pip install -r api/requirements.txt
# requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (and optionally TELEGRAM_SABUJAK_CHAT)
# in production these load from /home/ubuntu/report/.env — for local dev, export them or edit the load_dotenv path
python3 api/server.py   # listens on API_PORT (default 3000)
```
There are no tests or linters configured in this repo.

## Architecture

**Page ↔ route mapping.** Each top-level HTML file is a standalone landing/campaign page, not part of an SPA router. Nginx (`nginx/gventus`) maps clean URLs to specific files:
- `/` → `index.html` (main site, SPA-fallback for anything unmatched)
- `/survey` → `survey.html`
- `/form/hskcM5sSYK` → `sabujak-book.html` (obfuscated path intentionally — external form link)
- `/seedsbook` → `seedsbookapp.html`
- `/healing-type` → `healing-type.html`
- `/hub` → `hub.html`

When adding a new campaign page, add both the HTML file at repo root and a corresponding `location` block in `nginx/gventus`.

**Frontend → API flow.** Forms POST to same-origin `/api/<name>` endpoints (e.g. `assets/scripts/pages/survey.js` → `/api/survey`, `sabujak-book.html` → `/api/sabujak-book`, `index.html` contact form → `/api/contact`, `assets/scripts/pages/seedsbook.js` → `/api/seedsbook`). In production, nginx proxies `/api/` to the Flask app on `127.0.0.1:8000`. Some pages (`assets/scripts/pages/survey.js`, `assets/scripts/pages/seedsbook.js`) *also* fire a parallel, best-effort `fetch` to a hardcoded Google Apps Script URL (`APPS_SCRIPT_URL`) for a secondary spreadsheet log — this is separate from and redundant with the Telegram path, and failures there are silently ignored.

**API backend (`api/server.py`).** A single-file Flask app with one route per form (`/contact`, `/survey`, `/sabujak-book`, `/seedsbook`). Every route: validates/extracts fields from the JSON body, formats an HTML-formatted message, and posts it to Telegram via `send_telegram()`/`_post_telegram()` (raw `urllib`, no external HTTP lib). `/seedsbook` is multiplexed by a `type` field in the body (`survey` vs `checklist`) into different message formats. Routes intentionally use Korean field names from the request bodies (e.g. `이름`, `나이`, `연락처`) because the frontend forms are Korean and send those keys directly — keep new fields consistent with whatever the corresponding HTML form/JS sends. `/sabujak-book` sends to a distinct Telegram chat (`SABUJAK_CHAT_ID`) if configured, everything else goes to the default `CHAT_ID`.

**Shared frontend assets.** `assets/styles/common.css` and `assets/scripts/core/site.js` are shared across most pages (nav, mobile menu, scroll reveal, smooth scroll). Page-specific behavior lives in `assets/scripts/pages/`, or inline `<script>` blocks in the HTML itself (e.g. `sabujak-book.html`, `healing-type.html`). Images are grouped by feature below `assets/images/`; an unreferenced historical script remains in `assets/scripts/legacy/`.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main` (also manually via `workflow_dispatch`) and deploys directly to a single EC2 host — there is no staging environment or PR preview:
1. rsyncs the repo root (excluding `.git`, `.idea`, `api/`, `nginx/`, `choi3/`, logs, etc.) to `/home/ubuntu/report/dist/` as static files.
2. rsyncs `api/` to `/home/ubuntu/report/api/`, installs deps into a venv, and restarts the API under PM2 as `gventus-api` running gunicorn on port 8000.
3. Copies `nginx/gventus` to `/etc/nginx/sites-available/gventus` and reloads nginx.

Because deploy is push-to-main = deploy-to-prod, treat `main` as the live branch.
