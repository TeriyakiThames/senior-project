# 📝 Detailed High-Level Ticket Drafts

This document outlines the high-level ticket drafts for the 10+ core prototype features (F0 through F10).
The ticket numbering continues the project's established component conventions (`LINE`, `FE`, `AI`, `SCHED`, `STT`), mapped to the respective parent Epics in **Senior Project Board (View 3: Current Board)**.

---

## 📋 Overview Matrix

| Feature | Ticket ID    | Proposed Title                                                      | Component Tag  |    Parent Epic    |
| :------ | :----------- | :------------------------------------------------------------------ | :------------: | :---------------: |
| **F0**  | `[LINE-06]`  | Handle LINE follow event with onboarding welcome greeting           |     `LINE`     | `[LINE-00]` (#2)  |
| **F0**  | `[FE-06]`    | Build elderly onboarding LIFF profile setup form                    |      `FE`      |  `[FE-00]` (#6)   |
| **F1**  | `[LINE-07]`  | Interactive reminder confirmation card & voice pipeline wiring      |     `LINE`     | `[LINE-00]` (#2)  |
| **F1**  | `[SCHED-09]` | Medication dose logging and confirmation tracking                   |    `SCHED`     | `[SCHED-00]` (#5) |
| **F2**  | `[AI-06]`    | Conversational task detection and proactive reminder quick replies  |      `AI`      |  `[AI-00]` (#4)   |
| **F3**  | `[SCHED-10]` | Reminder importance tagging and morning bundled summary scheduler   |    `SCHED`     | `[SCHED-00]` (#5) |
| **F3**  | `[SCHED-11]` | Daily push message quota cap and quiet hours enforcement            |    `SCHED`     | `[SCHED-00]` (#5) |
| **F4**  | `[FE-07]`    | LIFF settings expansion for feature toggles and memory management   |      `FE`      |  `[FE-00]` (#6)   |
| **F4**  | `[AI-07]`    | Voice memory deletion ("ลืมเรื่องนี้") and privacy sharing settings |      `AI`      |  `[AI-00]` (#4)   |
| **F5**  | `[AI-08]`    | Interest-based activity recommendation engine and response card     |      `AI`      |  `[AI-00]` (#4)   |
| **F6**  | `[SCHED-12]` | Scheduled evening home safety check-in and fall prevention tips     |    `SCHED`     | `[SCHED-00]` (#5) |
| **F7**  | `[LINE-08]`  | Location message handling and nearby places recommendation carousel |     `LINE`     | `[LINE-00]` (#2)  |
| **F8**  | `[STT-03]`   | Thai Text-to-Speech (TTS) audio synthesis for spoken replies        | `STT` / `LINE` |  `[STT-00]` (#3)  |
| **F9**  | `[FE-08]`    | Weekly progress summary card and LIFF activity chart                |      `FE`      |  `[FE-00]` (#6)   |
| **F10** | `[AI-09]`    | Multimodal screenshot inspection and step-by-step tech support      |      `AI`      |  `[AI-00]` (#4)   |

---

## 🎯 Feature F0: Welcome and Set-up

### `[LINE-06] Handle LINE follow event with onboarding welcome greeting`

- **Parent:** `[LINE-00]` (Issue #2)
- **Labels:** `LINE`
- **Status:** `Todo`

#### Problem Statement:

When an elder adds the LINE official account as a friend, no greeting message or onboarding orientation is sent because the webhook dispatcher currently ignores non-message events.

#### Solution:

Intercept LINE `follow` events inside `processWebhookEvents`/`handleWebhookEvent`, initialize a new `UserDoc` document in Firestore if not already present, and reply with a warm, respectful Thai welcome message that includes a direct button linking to the onboarding LIFF setup page (`/liff/onboarding`).

#### Rough Files Touched:

- `src/lib/line/dispatcher.ts`
- `src/lib/firebase/collections.ts`
- `src/__tests__/lib/line/dispatcher.test.ts`

#### Acceptance Criteria:

- [ ] Webhook acknowledges and handles `event.type === 'follow'` gracefully.
- [ ] Creates default `UserDoc` in Firestore (`users/{userId}`) if first time adding friend.
- [ ] Replies immediately with a warm greeting (`ยินดีต้อนรับค่ะคุณตาคุณยาย...`) and LIFF onboarding link.
- [ ] Unit tests verify follow event handling and greeting message dispatch.

---

### `[FE-06] Build elderly onboarding LIFF profile setup form`

- **Parent:** `[FE-00]` (Issue #6)
- **Labels:** `FE`
- **Status:** `Todo`

#### Problem Statement:

First-time elderly users have different preferred forms of address (ยาย, ตา, ป้า, ลุง) and daily routines (meal times, sleep hours), but currently there is no initial setup UI to collect this information with accessible UI standards.

#### Solution:

Build a step-by-step onboarding page at `/liff/onboarding` using high-contrast, large-touch elements ($\ge 48\text{px}$ touch targets, $\ge 20\text{px}$ body text). Ask what the assistant should call them, usual meal and sleep times, hobbies/interests, and optional medication schedules, and test notification permissions.

#### Rough Files Touched:

- `src/app/[locale]/liff/onboarding/page.tsx`
- `src/types/firestore.ts`
- `src/components/liff/LiffProvider.tsx`
- `src/hooks/useLiffData.ts`

#### Acceptance Criteria:

- [ ] Page strictly follows accessibility rules (minimum $48\text{px}$ touch targets, $20\text{px}$ text, high contrast).
- [ ] Form captures preferred title/nickname, meal times, bedtime, and interests.
- [ ] Updates `UserDoc` in Firestore upon submission and smoothly navigates to the dashboard.
- [ ] Provides an option to skip non-critical questions.

---

## 🎯 Feature F1: Voice Reminders (Missing Parts)

### `[LINE-07] Interactive reminder confirmation card & voice pipeline wiring`

- **Parent:** `[LINE-00]` (Issue #2)
- **Labels:** `LINE`
- **Status:** `Todo`

#### Problem Statement:

While voice download and Chirp STT transcription are implemented, `dispatcher.ts` currently only echoes text back to the user (`ได้รับข้อความแล้ว`). Furthermore, extracted reminders are saved immediately without a pre-confirmation card showing the time and allowing the user to confirm or edit.

#### Solution:

Wire `handleAudioMessage` and `handleTextMessage` to the full cognitive pipeline (`classifyIntent` and `executeTool`). When a reminder is extracted, reply with an interactive Flex Message displaying the detected time with `[Confirm / ยืนยัน]` and `[Change / เปลี่ยนเวลา]` (linking to a LINE datetime picker fallback).

#### Rough Files Touched:

- `src/lib/line/dispatcher.ts`
- `src/lib/line/flex-messages.ts`
- `src/lib/tools/reminder.ts`
- `src/__tests__/lib/line/dispatcher.test.ts`

#### Acceptance Criteria:

- [ ] Transcribed audio text is automatically forwarded to intent classification and tool execution.
- [ ] Displays a pre-confirmation Flex Message with detected time and `[ยืนยัน]` / `[เปลี่ยนเวลา]` buttons.
- [ ] Tapping `[เปลี่ยนเวลา]` opens the native LINE datetime picker.
- [ ] Reminder is scheduled in Firestore and Cloud Tasks only upon explicit confirmation.

---

### `[SCHED-09] Medication dose logging and confirmation tracking`

- **Parent:** `[SCHED-00]` (Issue #5)
- **Labels:** `SCHED`
- **Status:** `Todo`

#### Problem Statement:

When a medication reminder notification fires and the elder presses "Taken" (`[ทานยาแล้ว]`), the reminder is marked done but no record of the dose or adherence timestamp is preserved for family review or medical history.

#### Solution:

Extend reminder actions in `src/lib/tools/actions.ts` so that confirming medication intake creates a structured adherence record in `users/{userId}/medicationLogs` with dose time, scheduled time, and status (`on-time` or `delayed`).

#### Rough Files Touched:

- `src/lib/tools/actions.ts`
- `src/types/firestore.ts`
- `src/lib/firebase/collections.ts`
- `src/__tests__/lib/tools/actions.test.ts`

#### Acceptance Criteria:

- [ ] Tapping `[ทานยาแล้ว]` writes a timestamped record to the `medicationLogs` subcollection.
- [ ] Evaluates and records whether the dose was on time or delayed relative to the scheduled fire time.
- [ ] Replies with warm positive reinforcement (e.g., "เก่งมากค่ะคุณตา บันทึกการทานยาเรียบร้อยแล้วค่ะ").

---

## 🎯 Feature F2: Zero-Effort Capture

### `[AI-06] Conversational task detection and proactive reminder quick replies`

- **Parent:** `[AI-00]` (Issue #4)
- **Labels:** `AI`
- **Status:** `Todo`

#### Problem Statement:

Elderly users often mention appointments naturally in general chat (e.g., "วันอังคารนี้ต้องไปหาหมอที่โรงพยาบาล") without explicitly asking to set a reminder. The bot currently treats this as plain conversation.

#### Solution:

Update Gemini conversational prompting and extraction logic to passively detect future tasks and appointments mentioned in chat. The bot responds empathetically to the conversational content and appends a proactive LINE Quick Reply: _"ต้องการให้หนูช่วยเตือนตอนเย็นวันจันทร์ไหมคะ? [ใช่, เตือนหน่อย] [ไม่ต้องจ้ะ]"_.

#### Rough Files Touched:

- `src/lib/ai/system-prompt.ts`
- `src/lib/ai/gemini.ts`
- `src/lib/line/dispatcher.ts`
- `src/__tests__/lib/ai/gemini.test.ts`

#### Acceptance Criteria:

- [ ] Implicit dates and obligations in chat are recognized by the model.
- [ ] Conversational reply naturally includes a proactive reminder question.
- [ ] Attaches free LINE Quick Reply buttons (`[ใช่, เตือนหน่อย]` and `[ไม่ต้องจ้ะ]`).
- [ ] Tapping `[ใช่, เตือนหน่อย]` automatically routes into reminder creation.

---

## 🎯 Feature F3: Importance and Daily Limit

### `[SCHED-10] Reminder importance tagging and morning bundled summary scheduler`

- **Parent:** `[SCHED-00]` (Issue #5)
- **Labels:** `SCHED`
- **Status:** `Todo`

#### Problem Statement:

Sending individual push messages for every single minor reminder quickly depletes monthly LINE push quotas and causes notification fatigue for elderly users.

#### Solution:

Add an `importance: 'important' | 'normal'` field to `ReminderDoc`. High-priority items (medications, doctor visits) trigger dedicated push notifications at the scheduled time. Low-priority/normal items are automatically held and bundled into a single morning summary Flex Message delivered at the elder's usual wake time.

#### Rough Files Touched:

- `src/types/firestore.ts`
- `src/lib/tools/reminder.ts`
- `src/lib/line/flex-messages.ts`
- `src/app/api/notify/route.ts`

#### Acceptance Criteria:

- [ ] Reminders support `importance: 'important' | 'normal'`.
- [ ] Interactive reminder creation allows designating importance via quick replies or AI classification.
- [ ] Normal items for the day are compiled into a single morning overview push message.
- [ ] Important items retain independent, exact-time push notifications.

---

### `[SCHED-11] Daily push message quota cap and quiet hours enforcement`

- **Parent:** `[SCHED-00]` (Issue #5)
- **Labels:** `SCHED`
- **Status:** `Todo`

#### Problem Statement:

Late-night notifications disrupt elders' sleep, and uncontrolled automated pushes risk exceeding the monthly LINE Messaging API plan quota.

#### Solution:

Implement quiet hours validation (defaulting to 21:00–07:00, or user-customized) and a daily push counter in `UserDoc`. Any non-urgent notification arriving during quiet hours is queued until morning, and pushes are capped at a safe daily limit.

#### Rough Files Touched:

- `src/app/api/notify/route.ts`
- `src/lib/utils/date.ts`
- `src/types/firestore.ts`
- `src/__tests__/api/notify.test.ts`

#### Acceptance Criteria:

- [ ] Push router checks user quiet hours before sending messages.
- [ ] Defers non-critical alerts scheduled during quiet hours until the morning wake window.
- [ ] Enforces a configurable daily push cap per user to protect API quota.

---

## 🎯 Feature F4: Control Centre (Missing Parts)

### `[FE-07] LIFF settings expansion for feature toggles and memory management`

- **Parent:** `[FE-00]` (Issue #6)
- **Labels:** `FE`
- **Status:** `Todo`

#### Problem Statement:

The current `/liff/settings` page only shows name, user ID, and language toggle. Users cannot toggle features on or off, configure quiet hours, or view and manage the facts the bot has memorized.

#### Solution:

Expand `/liff/settings` with accessible toggle switches for optional modules (Safety check-in, Activity suggestions), time pickers for quiet hours, and a dedicated "Things I remember" section displaying Tier 3 user facts with individual delete buttons.

#### Rough Files Touched:

- `src/app/[locale]/liff/settings/page.tsx`
- `src/app/api/liff/items/route.ts`
- `src/types/firestore.ts`
- `src/hooks/useLiffData.ts`

#### Acceptance Criteria:

- [ ] Provides toggles for optional features (Morning summary, Evening safety, Activity suggestions).
- [ ] Quiet hours time selectors (start and end times).
- [ ] Lists all learned facts from `user.profile.facts` with one-tap delete buttons.
- [ ] Maintains full accessibility ($\ge 48\text{px}$ touch targets and large text).

---

### `[AI-07] Voice memory deletion ("ลืมเรื่องนี้") and privacy sharing settings`

- **Parent:** `[AI-00]` (Issue #4)
- **Labels:** `AI`
- **Status:** `Todo`

#### Problem Statement:

Elders need an effortless way to delete sensitive memories using voice or text without opening the webview, and family sharing permissions must be off by default.

#### Solution:

Add memory deletion intent recognition to Jev and parameter extractor. When the user says "ลืมเรื่องนี้" or "ลบความจำนี้", the memory manager matches and removes the corresponding fact from `user.profile.facts`. Ensure family sharing flags in `UserDoc` default to private.

#### Rough Files Touched:

- `src/lib/ai/jev.ts`
- `src/lib/ai/memory.ts`
- `src/lib/tools/delete.ts`
- `src/__tests__/lib/ai/memory.test.ts`

#### Acceptance Criteria:

- [ ] Recognizes voice/text commands such as "ลืมเรื่องนี้" or "ลบความจำเรื่อง...".
- [ ] Identifies and removes the matching item from `user.profile.facts`.
- [ ] Replies with gentle, reassuring confirmation in polite Thai.
- [ ] Family sharing defaults to disabled (`familySharing: false`).

---

## 🎯 Feature F5: Activity Suggestions

### `[AI-08] Interest-based activity recommendation engine and response card`

- **Parent:** `[AI-00]` (Issue #4)
- **Labels:** `AI`
- **Status:** `Todo`

#### Problem Statement:

Elders frequently experience loneliness and low physical activity; gentle, interest-aligned nudges can encourage healthy daily routines.

#### Solution:

Create a daily activity recommendation generator using Gemini. Based on the user's recorded interests and past reactions, formulate a single gentle suggestion (e.g. watering plants, light stretching, praying) embedded directly within the morning bundled summary Flex card, featuring `[ทำเลย]` and `[ยังไม่สะดวก]` buttons.

#### Rough Files Touched:

- `src/lib/ai/gemini.ts`
- `src/lib/line/flex-messages.ts`
- `src/lib/tools/index.ts`
- `src/__tests__/lib/ai/gemini.test.ts`

#### Acceptance Criteria:

- [ ] Generates personalized suggestions matching user facts and interests.
- [ ] Embedded inside the morning summary card (costs zero extra push messages).
- [ ] Postback buttons (`[ทำเลย]` / `[ยังไม่สะดวก]`) record preference without aggressive follow-up.

---

## 🎯 Feature F6: Home Safety Check-in

### `[SCHED-12] Scheduled evening home safety check-in and fall prevention tips`

- **Parent:** `[SCHED-00]` (Issue #5)
- **Labels:** `SCHED`
- **Status:** `Todo`

#### Problem Statement:

Evening home safety hazards (unlocked doors, unextinguished gas stoves) cause significant worry for elders and their families.

#### Solution:

Schedule an optional evening check-in Flex Message (delivered ~20:00 or user bedtime): _"ปิดแก๊สหรือยังคะ? ล็อกประตูบ้านเรียบร้อยไหมคะ?"_ with a single large `[เรียบร้อยแล้ว]` action button, accompanied by rotating, gentle fall-prevention safety tips.

#### Rough Files Touched:

- `src/lib/line/flex-messages.ts`
- `src/lib/scheduler/cloud-tasks.ts`
- `src/app/api/notify/route.ts`
- `src/__tests__/lib/line/flex-messages.test.ts`

#### Acceptance Criteria:

- [ ] Fires evening safety card at user's configured evening time.
- [ ] Single large button `[เรียบร้อยแล้ว]` acknowledges check-in.
- [ ] Includes occasional, easy-to-read fall-prevention safety tips.
- [ ] Can be completely toggled off in LIFF settings.

---

## 🎯 Feature F7: Places and People

### `[LINE-08] Location message handling and nearby places recommendation carousel`

- **Parent:** `[LINE-00]` (Issue #2)
- **Labels:** `LINE`
- **Status:** `Todo`

#### Problem Statement:

Elderly users find map search apps complicated and struggle to find accessible, quiet places nearby matching their interests or share outing plans with family.

#### Solution:

Handle incoming LINE `location` messages in `dispatcher.ts`. Extract latitude/longitude, query nearby elder-friendly venues (peaceful temples, shaded parks, senior community centers), and return a Flex carousel with Google Maps navigation links. Include a LIFF Share Target Picker button to share the venue to a family chat.

#### Rough Files Touched:

- `src/lib/line/dispatcher.ts`
- `src/lib/line/flex-messages.ts`
- `src/__tests__/lib/line/dispatcher.test.ts`

#### Acceptance Criteria:

- [ ] Webhook receives and processes `message.type === 'location'`.
- [ ] Returns a Flex carousel of nearby elder-friendly venues with images and map links.
- [ ] Includes a quick action to share activity details directly into family chat.
- [ ] Includes gentle family connection nudge (e.g. "ชวนลูกหลานไปด้วยกันไหมคะ?").

---

## 🎯 Feature F8: Warm Thai Persona & Spoken Reply (Missing Parts)

### `[STT-03] Thai Text-to-Speech (TTS) audio synthesis for spoken replies`

- **Parent:** `[STT-00]` (Issue #3)
- **Labels:** `STT` / `LINE`
- **Status:** `Todo`

#### Problem Statement:

While text replies use polite Thai particles, elders who suffer from cataracts, eye strain, or illiteracy cannot comfortably read text bubbles on mobile screens.

#### Solution:

Implement Thai Text-to-Speech synthesis (using Google Cloud TTS with natural Thai voice or Gemini audio) to convert assistant responses into `.m4a` audio format. When the elder sends voice messages or has voice mode enabled, reply with a LINE audio message alongside or instead of text.

#### Rough Files Touched:

- `src/lib/speech/tts.ts`
- `src/lib/line/dispatcher.ts`
- `src/__tests__/lib/speech/handler.test.ts`

#### Acceptance Criteria:

- [ ] Converts Thai text reply into clean AAC/m4a audio buffer.
- [ ] Sends LINE audio message when voice-reply mode is active.
- [ ] Preserves warm Thai polite particles (`ค่ะ/ครับ`).
- [ ] Gracefully falls back to text reply if TTS synthesis fails.

---

## 🎯 Feature F9: Progress View

### `[FE-08] Weekly progress summary card and LIFF activity chart`

- **Parent:** `[FE-00]` (Issue #6)
- **Labels:** `FE`
- **Status:** `Todo`

#### Problem Statement:

Elders and family caregivers have no visual feedback on routine consistency (percentage of medication taken on time, activities completed).

#### Solution:

Build a `/liff/progress` page displaying a high-contrast, large-format chart of completed tasks and activities for the week. Deliver a celebratory weekly Flex card on Sunday mornings summarizing their positive achievements.

#### Rough Files Touched:

- `src/app/[locale]/liff/progress/page.tsx`
- `src/lib/line/flex-messages.ts`
- `src/app/api/liff/items/route.ts`
- `src/hooks/useLiffData.ts`

#### Acceptance Criteria:

- [ ] Aggregates weekly completion rate for reminders, medication, and safety check-ins.
- [ ] Visual progress view in LIFF with large numbers and easy-to-read charts.
- [ ] Sends a warm weekly milestone summary card on Sunday morning.

---

## 🎯 Feature F10: Quick-Fix Help

### `[AI-09] Multimodal screenshot inspection and step-by-step tech support`

- **Parent:** `[AI-00]` (Issue #4)
- **Labels:** `AI`
- **Status:** `Todo`

#### Problem Statement:

Elders frequently encounter confusing smartphone popups or app interfaces (e.g., Netflix login, system updates) and struggle to explain the problem in words.

#### Solution:

Add `image` message handling to `dispatcher.ts`. Download the screenshot from LINE Blob storage, pass it to Gemini multimodal vision with a dedicated elderly tech support prompt, and reply with maximum 3 clear, simplified, jargon-free steps.

#### Rough Files Touched:

- `src/lib/line/dispatcher.ts`
- `src/lib/ai/gemini.ts`
- `src/__tests__/lib/line/dispatcher.test.ts`

#### Acceptance Criteria:

- [ ] Ingests and processes LINE image messages (`event.message.type === 'image'`).
- [ ] Analyzes UI screenshot with Gemini multimodal capabilities.
- [ ] Returns patient, step-by-step guidance formatted in 1–3 simple sentences without technical jargon.
- [ ] Avoids patronizing tone while providing clear visual action cues.
