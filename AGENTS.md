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

### 2.3 Accessibility & Design Constraints (Hard Requirements)

- **Discard Previous UI:** All previous UI styling (warm beige backgrounds `#F8F6F2`, dark gray text `#2D2D2D`, generic green cards) is discarded across the repository.
- **Design Ground Truth:** All UI components, colors, and layout structures must strictly adhere to the SVG design language specification (see Section 2.5).
- **Minimum Font Size:** `16px` (`senior-sm`). Default body font: `20px` (`senior-base` / `1.25rem`). Subheadings: `24px` (`senior-lg`). Headings: `30px` (`senior-xl`).
- **Touch Targets:** Minimum `48×48px` (`min-h-touch` / `3rem`) for all buttons, links, and interactive elements.
- **Color Contrast:** High contrast ratio meeting WCAG AAA requirements with Deep Indigo Navy text (`#21215C`) against pure white surfaces (`#FFFFFF`) and pastel card backgrounds.

### 2.4 Three-Tier Persistent Memory

1. **Tier 1 (Short-Term Context):** Last $N$ conversation turns stored in `users/{userId}/messages` subcollection.
2. **Tier 2 (Rolling Daily Summary):** Synthesized narrative stored in `users/{userId}/dailySummary`.
3. **Tier 3 (Permanent Profile Facts):** Learned facts and preferences accumulated in `users/{userId}/profile.facts`.

### 2.5 UI Design Language & Layout Specification (SVG-Based System)

> **Authoritative visual design language specification for the LIFF application, derived from the master SVG design. All previous UI patterns in the codebase are deprecated in favor of this specification.**

#### 2.5.1 Core Color System

- **Canvas / Background:** `#F2F7FA` (Serene soft sky-fog/powder canvas).
- **Surface / Card Background:** `#FFFFFF` (Pure white containers).
- **Primary Typography:** `#21215C` (Deep Indigo Navy — provides crisp readability with zero glare for senior vision).
- **Secondary & Meta Typography:** `#7D84A3` and `#4B4F72` (Muted slate for dates, timestamps, day indicators, and examples).
- **System & Header Icons:** `#111111` for top app bar controls (close `X`, title, option dots `...`).

#### 2.5.2 Four-Category Pastel Hub Palette (2x2 Category Grid)

The top hub features a 2-column, 2-row grid of large, rounded pastel cards (`rounded-3xl` / `24px` radius):

1. **Alarms (นาฬิกาปลุก):**
   - Container Background: `#FBEFD8` (Warm soft cream)
   - Icon Accent: `#FCCE57` (Golden Amber circular badge)
   - Icon Lines & Typography: `#7A4E00` (Deep Amber Bronze)
2. **Reminders (การเตือน):**
   - Container Background: `#E1E8F8` (Periwinkle ice blue)
   - Icon Accent: `#3E81F7` (Royal Azure Blue bell badge)
   - Icon Lines & Typography: `#385289` (Deep Navy Slate)
3. **Notes (โน้ต):**
   - Container Background: `#EEE1FA` (Pastel lilac lavender)
   - Icon Accent: `#9A59EF` (Vibrant Violet document badge)
   - Icon Lines & Typography: `#544378` (Deep Plum Purple)
4. **My Plans (แผนของฉัน):**
   - Container Background: `#FDE5F0` (Pastel blossom pink)
   - Icon Accent: `#E8216F` (Rose Magenta calendar badge)
   - Icon Lines & Typography: `#B4225A` (Deep Berry Ruby)

#### 2.5.3 Status Pills & Badges

- **Reminder Tag:** `#E1E8F8` background, `#385289` text (e.g. `การเตือน`, `การเตือน · เลื่อนเวลา`).
- **Plan Tag:** `#FDE5F0` background, `#B4225A` text (e.g. `แผน`).
- **Alarm Tag:** `#FBEFD8` background, `#7A4E00` text (e.g. `นาฬิกาปลุก`).
- **Input Method Tag:** `#EAF0F6` background, `#21215C` text (e.g. `🎤 เสียง`, `⌨️ พิมพ์`).

#### 2.5.4 Elevation & Container Architecture

- **Cards & Panels:** Pure white `#FFFFFF` surface with `24px` (`rounded-3xl`) corner radius.
- **Dual Drop Shadow:** `box-shadow: 0 2px 6px rgba(33, 33, 92, 0.06), 0 8px 24px rgba(33, 33, 92, 0.08)`.
- **Dividers:** Subtle `#F2F7FA` or `#EAF0F6` 1px borders between item rows.
- **Outlined Buttons:** `2px solid #7D84A3`, `#FFFFFF` background, `#21215C` bold typography, `16px` (`rounded-2xl`) radius, minimum `52px` height.
- **Tip Card Banner:** Rounded `#EAF0F6` container with `#E1E8F8` round icon badge, `#3E5EB5` mic icon, and two-line natural Thai speech guidance.

#### 2.5.5 Detail Pages & Modular Component Specifications (Figma Ground Truth)

Detail pages (such as Notes, Alarms, Reminders, and Plans) adhere to a shared, reusable component system configured per category:

1. **Detail Page Header (`DetailHeader`):**
   - **LINE App Bar:** Fixed `54px` height with subtle bottom border, close `X` (`#111111`), service name `[ชื่อบริการ]`, and options `...` linking to settings.
   - **Back Navigation & Title:** Large chevron `<` back button (`#21215C`), `48x48px` squircle category badge (`rounded-2xl`) using the category's pastel background (`#EEE1FA` for Notes, `#FBEFD8` for Alarms, `#E1E8F8` for Reminders, `#FDE5F0` for Plans), bold heading (`#21215C`, `text-3xl font-extrabold`), and count/sort order descriptor subtitle (`#7D84A3`, e.g. `12 โน้ต · ใหม่สุดอยู่บนสุด`).

2. **Date-Grouped Item Listing (`NoteCard` & `ItemCard`):**
   - **Date Section Headings:** Crisp bold slate/indigo text (`text-xl font-bold #21215C`) grouped chronologically (newest first). Header rules: `วันนี้` for today, `เมื่อวาน · 21 ต.ค.` for yesterday, and `{weekday} 20 ต.ค.` (with `วัน` prefix omitted in Thai, e.g. `อังคาร 20 ต.ค.`) for past dates.
   - **Item Containers:** Pure white `#FFFFFF` surface, `24px` (`rounded-3xl`) radius, soft dual shadow (`0 2px 6px rgba(33, 33, 92, 0.06), 0 8px 24px rgba(33, 33, 92, 0.08)`).
   - **Item Body:** Deep Indigo Navy `#21215C`, `text-lg` / `text-senior-base`, relaxed line height, break-words.
   - **Footer Meta & Action Row:**
     - Left: Source pill (`bg-[#EAF0F6]`, rounded-full, mic 🎤 or keyboard ⌨️ icon + `เสียง` or `พิมพ์`) paired with clean timestamp text (`#7D84A3`, e.g. `14:15 น.`).
     - Right: Outlined crimson delete button with `1.5px` border in `#942626`, `#FFFFFF` surface, red trash can icon + `ลบ` label, `rounded-2xl` radius, minimum `48px` touch target.

3. **Destructive Delete Confirmation Modal (`ConfirmDialog`):**
   - **Backdrop:** Semi-transparent Deep Indigo Navy overlay `bg-[#21215C]/40` with subtle blur.
   - **Dialog Card:** Pure white `#FFFFFF` container with `24px` (`rounded-3xl`) radius, centered with `max-w-[360px]`.
   - **Header Badge:** Centered `64x64px` circular badge (`#FEE2E2`) with dark crimson `#942626` trash icon.
   - **Title:** Polite Thai confirmation (`ลบโน้ตนี้ไหมคะ`, configurable per category).
   - **Content Preview Box:** Rounded container (`rounded-2xl`, `#F0F4F9` background, `p-4`) displaying the note text or item details in `#21215C`.
   - **Warning Text:** Muted slate guidance (`#7D84A3`, `ลบแล้วจะเอากลับมาไม่ได้นะคะ`).
   - **Stacked Vertical Buttons:**
     - Primary Destructive: Full-width solid crimson `#942626` button (`h-[54px]`, `rounded-2xl`), white trash icon + `ลบโน้ต`.
     - Secondary Cancel: Full-width white button with `2px solid #7D84A3` border, `#21215C` text (`ไม่ลบ`), `rounded-2xl`.

4. **Empty State Screen (`EmptyState`):**
   - **Category Badge:** Large centered `128x128px` circular pastel container matching the category palette (`#EEE1FA` for Notes) with the category icon.
   - **Title:** Polite empty notice (`ยังไม่มีโน้ตค่ะ`, `text-2xl sm:text-3xl font-extrabold #21215C`).
   - **Conversational Speech Guidance:** Two-line natural Thai speech prompt (e.g. `พูดหรือพิมพ์ในแชตว่า\n“จดไว้หน่อย...” แล้วกด “บันทึกเลย”`) in `#4B4F72`.
   - **Call-to-Action:** Royal Azure Blue `#3E81F7` full-width button (`h-[54px]`, `rounded-2xl`) with microphone icon and `ไปที่แชต` that directs the elder back to the LINE 1-on-1 chat.

5. **Floating Toast Feedback (`Toast`):**
   - Floating dark container at the bottom (`bg-[#21215C]`, `rounded-2xl`, `py-3.5 px-5`, `shadow-2xl`).
   - White checkmark icon `✓` with concise confirmation text (e.g. `ลบโน้ตแล้วค่ะ`).
   - Auto-dismisses after 3 seconds, accessible with `role="status"` and `aria-live="polite"`.

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
6. **Automated Semantic Releases:**
   - Versions and GitHub Releases are automated upon merging to `main` via `semantic-release` (`.github/workflows/release.yml`).
   - Every merged PR generates a release according to Conventional Commits:
     - `feat`: Minor bump.
     - `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `ci`, `build`: Patch bump.
7. **Pull Request Naming Convention (`.github/workflows/lint-pr.yml`):**
   - PR titles must strictly follow Conventional Commits format with the ticket ID in the scope:
     - Format: `<type>(<TICKET-ID>): <description>`
     - Example: `feat(LINE-01): set up LINE client singleton and signature verification`

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

- The recommended PR title following the ticket standard (e.g. `feat(LINE-01): set up LINE client singleton and signature verification`).

**Recommended commit message:**

- Normal semantic commit message for changes inside the branch/PR (e.g. `feat: implement line client singleton and signature validation`).

**Leftover/handoff tasks if any:**

- Actionable manual steps for the developer (console setups, env vars, PR reviews, moving ticket to Done on GitHub Projects board).
