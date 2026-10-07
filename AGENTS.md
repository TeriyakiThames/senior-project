# AGENTS.md: Developer & AI Agent Guidelines

> **Operational manual and architecture boundaries for AI coding agents working in the Senior Project codebase.**

---

## 1. ⚠️ Strict Git Protocol & Boundaries

Any AI assistant or agent operating in this repository must strictly adhere to these rules:

1. **Never Commit or Merge:**
   - The AI writes code, creates branches, and runs tests locally.
   - The AI must **NEVER** run `git commit`, `git push`, or merge any branch or Merge Request (MR / PR).
2. **Review Before Commit:**
   - After code changes and local checks pass, the AI pauses and presents the diff to the human developer.
   - The human developer performs all commits, pushes, and PR creations.
3. **Granular Feature Branches:**
   - Each individual ticket must belong to its own dedicated branch targeting `main` (e.g. `feat/line-client-signature`, `feat/firestore-models`, `fix/webhook-route`).
4. **Manual External Setup:**
   - Whenever external console configurations are required (LINE Developers, Firebase Console, Google Cloud Console, Vercel), the AI must outline clear, step-by-step instructions and wait for the developer to perform them.
5. **Package Manager:**
   - Use **`pnpm`** exclusively across all environments and scripts. Never use `npm` or `yarn`.

---

## 2. Core Architecture & Mental Model

### 2.1 Dual AI Stack

- **Gemini 3.5 Flash-Lite (`@google/genai`):**
  - Generates conversational dialogue, empathy, and contextual understanding.
  - Models the elder persona with warm, respectful Thai phrasing.
- **TypeSafe AI Jev (`@typesafe-ai/sdk`):**
  - High-certainty deterministic intent classification (`choice`, `noul`).
  - Zero hallucination guarantee on tool selection (`set_alarm`, `set_reminder`, `save_note`, `list_items`, `delete_item`, `snooze`, `dismiss`).
  - Parameter extraction for Thai colloquial time expressions ("7 โมงเช้า", "บ่ายสาม", "ทุ่มครึ่ง").

### 2.2 Elderly Thai Persona Guidelines

- **Tone:** Caring, respectful, warm, and patient — like a helpful, attentive grandchild.
- **Language:** Polite Thai particles (**ค่ะ/ครับ**), natural colloquial phrasing.
- **Restrictions:**
  - Avoid technical jargon (no "API", "JSON", "Database", "Token").
  - Avoid patronizing baby talk or dismissive language.
  - Keep sentences concise, clear, and easy to read on mobile screens.

### 2.3 Accessibility Constraints (Hard Requirements)

- **Minimum Font Size:** `16px` (`senior-sm`). Default body font: `20px` (`senior-base` / `1.25rem`).
- **Touch Targets:** Minimum `48×48px` (`min-h-touch` / `3rem`) for all buttons, links, and interactive elements. Large touch targets use `64px` (`touch-lg`).
- **Color Contrast:** High contrast borders and dark text (`senior-text: #2D2D2D`) against warm backgrounds (`senior-bg: #F8F6F2`).
- **Primary Action Color:** LINE Green (`#06C755`).

### 2.4 Three-Tier Persistent Memory

1. **Tier 1 (Short-Term Context):** Last $N$ conversation turns stored in `users/{userId}/messages` subcollection.
2. **Tier 2 (Rolling Daily Summary):** Synthesized narrative stored in `users/{userId}/dailySummary`.
3. **Tier 3 (Permanent Profile Facts):** Learned facts and preferences accumulated in `users/{userId}/profile.facts`.

---

## 3. Security Boundaries & Trust Zones

- **LINE Webhook (`/api/webhook`):**
  - Must verify raw body with HMAC-SHA256 against `LINE_CHANNEL_SECRET`.
  - Always return HTTP `200` immediately, delegating processing to Next.js `after()`.
- **Scheduled Callbacks (`/api/notify`):**
  - Must validate the shared secret header (`X-Webhook-Secret`) against `WEBHOOK_SECRET`.
  - Reject unauthorized calls with HTTP `401`.
- **LIFF API Endpoints (`/api/liff/*`):**
  - Must authenticate requests via LINE ID tokens exchanged through `/api/auth/line` or Firebase custom tokens.

---

## 4. Code Standards & CI Requirements

### CI Validation Steps (`.github/workflows/ci.yml`)

Every PR must pass:

1. **Branch Freshness:** Must be up to date with `origin/main`.
2. **Prettier Format Check:** `pnpm format:check`.
3. **TypeScript Validation:** `pnpm type-check` (`tsc --noEmit`) with 0 errors.
4. **Unit Tests:** `pnpm test:run` with external SDKs mocked in Vitest.
5. **Production Build:** `pnpm build` must compile cleanly.
6. **Semantic Versioning & Branch Prefixes:**
   - The CI checks the branch name prefix (`GITHUB_HEAD_REF`) to enforce `package.json` version bumping:
     - `feat/*`: Minor version bump (`0.1.0` → `0.2.0`).
     - `fix/*`, `chore/*`, `style/*`, `refactor/*`: Patch bump (`0.1.0` → `0.1.1`).
   - Branch names only need the semantic prefix (e.g., `feat/line-client-signature`, `fix/webhook-route`) — ticket IDs are not required in branch names.
7. **Pull Request Naming Convention:**
   - PR titles must prefix the ticket key and include standard semantic commit types:
     - Format: `[<TICKET-ID>] <type>: <description>`
     - Example: `[LINE-01] feat: set up LINE client singleton and signature verification`

### Unit Testing Rule

- **Never make real network calls in unit tests:** All tests in `src/__tests__/` must mock LINE SDK, Firebase Admin, GCP STT/Tasks, and Gemini/Jev SDKs.

---

## 5. Ticket Completion Summary Protocol

After completing work and verifying each individual ticket, the AI assistant must summarize everything done in short, concise bullet points without numbering or blank line breaks between items. Section headers must not have bullets in front; instead, each section's contents are listed in bullets, strictly following these sections:

**Ticket:**

- [<TICKET-ID>] - <Ticket Title> (e.g. `[LINE-01] - Set up LINE client singleton and signature verification`)

**Problem that we are fixing:**

- Brief explanation of the issue, requirement, or ticket objective addressed.

**File by file changes:**

- List each modified/created file with its change described in exactly 1 sentence only.

**Recommended PR title:**

- The recommended PR title following the ticket standard (e.g. `[LINE-01] feat: set up LINE client singleton and signature verification`).

**Recommended commit message:**

- Normal semantic commit message for changes inside the branch/PR (e.g. `feat: implement line client singleton and signature validation`).

**Leftover/handoff tasks if any:**

- Actionable manual steps for the developer (console setups, env vars, PR reviews, moving ticket to Done on GitHub Projects board).
