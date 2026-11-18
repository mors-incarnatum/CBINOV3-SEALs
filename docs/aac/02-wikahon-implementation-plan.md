# WiKahon implementation plan

Prepared: 17 November 2026 (Asia/Manila)  
Status: Engineering plan; application changes have not been implemented  
Evidence baseline: [Research and analysis](01-research-and-analysis.md)  
Consultation context: [Update WiKahon AAC features](thread://01a1e9b3-bb77-7c10-9e19-5b9e59c90b56?hostId=local)

## 1. Intended result and boundaries

Deliver a dependable, customizable Filipino/Taglish AAC board with stable vocabulary positions, recoverable messages, understandable speech, protected editing, and verified offline behavior. Retain animation, vibration, scribble, chat, and the category wheel as optional capabilities with separate evaluation paths.

This plan builds on the dossier's requirement IDs **R01–R19**, findings **F01–F16**, source IDs **S01–S24**, and code observations **C01–C13**. Those identifiers are the source of truth for rationale. The earlier chat's assistant recommendations are inputs to reconsider, not evidence of clinical approval.

Three work statuses prevent research uncertainty from being silently converted into implementation:

- **Ready:** behavior is sufficiently specified for engineering after baseline verification.
- **Prototype:** implement only an isolated, disabled-by-default experiment, then evaluate it.
- **Gated:** the named research/technical decision must be recorded before production work begins. Independent tasks continue.

The present documentation task creates these two files only. It does not edit application code, run migrations, purchase software, contact reviewers, deploy, or perform child assessments. Future implementation must preserve existing working-tree changes and the deleted legacy plan/tests unless their owner explicitly requests restoration.

## 2. Delivery sequence and decisions

| Stage | Work | Depends on | Exit condition |
|---|---|---|---|
| 0 | W00 baseline and evidence register | Dossier | Baseline recorded; uncertain references have owners and next actions |
| 1 | W01 data/profile foundation; W02 grid safety; W04 sentence repair | W00 | Existing vocabulary survives migration; layout and repair regressions pass |
| 2 | W03 static media/photos/colors; W05 speech; W06 vocabulary | W01; W02 for layout trials | Core communication prototype is ready for adult review; gated content/voices remain clearly marked |
| 3 | W07 guardian integration; W08 offline delivery and recovery | W01; W03–W05 | Profile isolation, protected editing, storage recovery and offline tests pass |
| 4 | W09 participation review and optional prototypes | Stable core from stages 1–3 | Review package and evidence-backed decisions recorded |

Work can overlap where dependencies permit, but no experimental feature may delay message composition, repair, or basic board access. Calendar estimates require an implementer and reviewer availability; the stages are dependency milestones rather than promised dates.

### Defaults selected for the next prototype

| Setting | Default and migration behavior |
|---|---|
| Grid | Preserve existing dimensions and coordinates. Retain the current 5×4 new-board default as a starting configuration, not a clinical recommendation; add a clearly labeled 3-column × 2-row option |
| Resizing | Preserve coordinates; guardian can explicitly relocate overflow after a preview |
| Sentence | Preserve selected order and existing speak-on-tap preference; auto-clear stays off for new profiles |
| Animation | Off for migrated and new profiles; existing GIF content remains available for an optional experiment |
| Vibration, scribble, chat, wheel | Off; saved experimental content is retained when disabled |
| Colors | Preserve existing color selection; new reviewed vocabulary may use word-class mode; add neutral mode and label the project palette as modified |
| Speech | Offer only verified language-compatible choices for automatic fallback. Never silently choose an arbitrary Spanish/system-default voice for Filipino text |
| Guardian access | Child communication mode after reload; editing unlock is separate from account login and per-profile authorization |
| Data | Read local board immediately; synchronize only through explicit authorized operations in the first release |

These are product decisions based on consultation and the dossier, not universal AAC prescriptions.

## 3. Work packages

### W00 — Establish the implementation baseline and resolve source identities

**Status:** Ready. **Owner:** developer and research lead. **Trace:** R17, F03–F07, F16; C13.

1. Re-read applicable repository instructions and the local Next.js documentation before application edits. Record the current commit, working-tree changes, package scripts, and active model-file casing.
2. Run the existing lint/build checks without overwriting unrelated files. Record pre-existing failures separately. Check import casing on a case-sensitive environment before declaring a build portable.
3. Preserve this dossier as the evidence baseline. Add source updates here with dates; do not turn the implementation plan into a separate, conflicting bibliography.
4. Research lead owns Q01–Q03: obtain the exact app links, original Chua material, emailed Filipino link, and book edition through the normal SLP follow-up process. No source substitutions without a recorded identity decision.
5. Designer prepares the common app comparison tasks from dossier section 5. Hands-on results must name app edition, device, and date; incomplete trials stay labeled incomplete.

**Acceptance:** all consultation items have a work-package mapping; source gaps are bounded; code observations are revalidated before use; no unrelated files are reset. Existing build failures cannot be reported as caused or fixed by this documentation.

### W01 — Introduce per-child local state and versioned contracts

**Status:** Ready locally; cloud publication depends on W07. **Owner:** developer. **Trace:** R16, R19, F13–F14, F16; C09, C11, C13.

**Behavior.** Retain the current board/cell model. Wrap board data in a profile-specific local document, with a local profile ID and optional cloud profile ID. Make the active profile explicit in the provider. Profile selection occurs in the guardian area; normal communication never needs to wait for cloud authentication.

**Required contracts:**

| Contract | Planned addition/change |
|---|---|
| Local profile document | Schema version 3; profile identity; BoardData; last successful save state; optional cloud revision |
| BoardData | Feature preferences; expanded speech settings; neutral color option; references to media; keep transient editing state outside it |
| Tile | Optional media reference and language tag; retain label, spokenText, iconName and stable ID for backward compatibility |
| SentenceToken | Snapshot display/spoken text, media reference, and effective visual metadata so editing a tile cannot rewrite an already composed message |
| Local persistence service | Load/save/list profiles; report unavailable/quota/corrupt-storage errors; retrieve/save media blobs separately |
| Cloud repository | Extend existing profile-scoped contracts only after access checks; exclude local unlock credentials, sentence drafts and undo history |

Use `wikahon-board-v3:<localProfileId>` for profile JSON and an explicit active-profile index. Store uploaded media in IndexedDB keyed by profile and media ID; keep binary data out of localStorage. Do not treat local storage as an access-control boundary against someone controlling the device.

**Migration.** Read v2 first, then the existing v1 fallback. Create one local profile containing all current boards, IDs, placements, hidden flags, settings, and sentence tokens. Supply new optional fields without reflowing. Do not send a v2 payload through the existing v1 dictionary converter. Write and verify the v3 document before switching the active pointer; retain legacy values for rollback. Unknown future versions must be preserved and shown as unsupported, not reset to an empty board.

**Acceptance:** migration is repeatable without duplicating profiles; child A changes never appear in child B; storage errors retain in-memory use but visibly report that changes are unsaved; migration never silently drops out-of-bounds or custom content. Tests: T01, T02, T10.

### W02 — Complete adjustable grids and stable navigation

**Status:** Ready; pinned vocabulary remains a later prototype. **Owner:** developer/designer. **Trace:** R02–R03, R11, R15, F02, F08; C01–C02, C12.

**Behavior.** Keep global dimensions and per-board overrides. Add row/column step controls and the explicit six-cell preset. Remove communication-level labels from dimensions. Show both row and column labels so “3×2” is not ambiguous.

Hide/unhide, adding/removing vocabulary, and ordinary navigation must not shift existing occupied coordinates. Resizing previews overflow before applying. Applying without reflow preserves off-grid cells; the guardian can inspect them, restore the prior grid, or explicitly reflow. Reflow presents affected boards and destinations, preserves hidden state, and creates additional pages if needed. Save a pre-reflow snapshot for guardian rollback.

Provide consistent Home/Back and folder navigation with the sentence retained. Disabled wheel means no wheel opening from right-click, context-menu key, or Shift+F10. The conventional navigation path must remain fully usable.

**Affected layers.** Board placement model/store; settings/grid/shell ViewModels; settings, board, and navigation views. Do not encode layout logic in components.

**Acceptance:** surviving in-bounds cells never move during resize-only actions; no vocabulary disappears irretrievably; folder overrides remain independent; intentional reflow is reversible. Test empty folders, 1×1 and maximum bounds, multiple pages, hidden overflow, keyboard navigation, and portrait/landscape. Tests: T03, T08.

### W03 — Add static media, familiar photos, and coherent colors

**Status:** Ready; final palette/content choices require W06 review. **Owner:** developer/designer/content reviewer. **Trace:** R04–R06, R16, F09–F11; C03–C05.

**Static assets.** Give each bundled symbol an explicit still-image asset and optional animated variant. Inspect stills for recognizability instead of assuming a GIF's first frame is suitable. Use one media resolver for board tiles, sentence tokens, previews, and galleries. Reduced-motion preference always suppresses animation, even when a guardian enabled it.

**Photos.** Extend the existing editor with upload, preview, crop, replace, and remove. Accept decodable JPEG, PNG and WebP up to 10 MB; reject unsupported/corrupt files with the existing tile intact. Crop/re-encode locally with longest edge at most 1024 pixels and strip source metadata. These are engineering limits, not clinical thresholds. Preserve label and spoken text independently. An upload is saved only after the local blob write succeeds; a missing blob falls back to label/symbol and reports the issue in guardian settings.

**Colors.** Add a shared resolver used by tiles and tokens. In word-class mode use the reviewed class mapping, with an explicit “other” category; in catalog mode retain existing overrides; neutral mode removes semantic background color. Record exact palette values and rationale in the dossier after review. Do not label the current custom mapping as the canonical Fitzgerald key. Labels and images must convey meaning without color alone.

**Acceptance:** no animated URLs load with animation disabled; uploaded images survive reload/offline reopening; sentence images remain valid after source-tile edits; all color modes are consistent and have readable text. Photo replacement must not delete media still referenced by another tile or a sentence. Tests: T04, T05, T10.

### W04 — Make sentence repair reversible

**Status:** Ready. **Owner:** developer. **Trace:** R12, R15, F11; C06.

Add `undoSentenceEdit()` alongside existing append/remove/backspace/clear commands. Maintain at most 20 previous sentence snapshots per active session/profile in memory. Every manual append, remove, backspace, or clear pushes the previous state once; Undo restores it without speaking. Repeated identical words remain separate tokens. Undo after Clear is available immediately, without a confirmation modal blocking communication. Changing profiles clears undo history and stops speech.

All sentence mutations, including Undo, cancel pending/current playback and invalidate any deferred auto-clear request. Navigation within a profile preserves the message. Stop does not delete text. Retain existing auto-clear options for those who deliberately select them; an automatic clear must be undoable during the same session.

**Affected layers.** Store commands/history helper, sentence ViewModel, sentence strip. Add an accessible Undo button and a concise status announcement; preserve keyboard focus after a token is removed.

**Acceptance:** a mistaken addition, removal, or full clear can be reversed; stale speech promises cannot clear a subsequently edited message; history never crosses profiles. Tests: T06, T07.

### W05 — Correct speech behavior and evaluate Tagalog voices

**Status:** Ready for service correction/local selection; production cloud voice is gated. **Owner:** developer plus Filipino-speaking SLP/reviewer. **Trace:** R07, R13, R19, F12; C07.

**Immediate behavior.** Remove the automatic Spanish cloud configuration for Filipino messages. Enumerate available voices, handle delayed voice-list loading, and let the guardian preview and select language-compatible options. Store provider, voice ID, language tag, rate, and volume per profile; do not store an expiring audio URL as a voice identity.

Extend `ITTSService` to expose available voice descriptors/capabilities and accept a structured speech request: text, language, selected voice, rate, volume. Retain `stop()` and cancellation-generation behavior. Update callers through ViewModels only. A descriptor must state whether offline availability is known, unknown, or unavailable; a language tag alone is not proof.

**Failure order.** Try the explicitly configured provider. On failure use a guardian-selected, verified local compatible voice if available. Otherwise show a recoverable speech-unavailable state while retaining the sentence and visual communication. Do not silently substitute another language, freeze the board, repeatedly request authentication, or claim offline speech without a device test. A new utterance or Stop invalidates older synthesis results.

**Voice decision record.** Compare candidate voices with the same set of Filipino words, requests, refusals, questions, names, repeated words, longer phrases, and mixed Tagalog-English utterances. Record pronunciation, stress/intonation, meaning intelligibility, user preference, latency, failure behavior, cost, and availability. The SLP/reviewer must flag meaning-changing pronunciations and decide acceptability; engineering cannot infer naturalness from an API language code.

**Gate:** select a production cloud provider/voice only after listening review and a reproducible target-device test. Until then, local speech may ship only on devices where it passes; unsupported devices retain text/symbol communication and a clearly documented speech limitation. Do not announce general offline Tagalog support.

Tests: T07, T11. Technical checks cover lifecycle/error behavior; listening review covers speech quality.

### W06 — Build a reviewed Filipino/Taglish vocabulary baseline

**Status:** Ready for worksheet/editor support; final seed inventory and morphology UI are gated. **Owner:** Filipino-speaking content lead and SLP, supported by developer. **Trace:** R01, R04, R13, R17, F05–F07, F10; C04–C05.

Create a vocabulary review table in the research file with stable candidate ID, label, spoken form, language, word class, communicative purpose, family relevance, provenance, and disposition. Classify existing seeds first. Do not invent the complete Chua/Ocampo lists or copy proprietary symbol sets from screenshots.

Maintain reusable words, personal vocabulary, and quick phrases. Explicitly review coverage for refusal, assistance, questions, comments, social interaction, and clarification. Allow guardians to add words and complete phrases even while the default vocabulary review is pending. Preserve authored selection order and spoken text; no automatic grammar correction or translation in the core release.

Retain existing vocabulary as a legacy profile baseline during migration. A reviewed new starter set is offered as an explicit import/new-profile option, never a silent replacement of a child's learned board. Draft examples such as “gusto kain” are consultation examples to review, not an enforced grammatical target or evidence of corpus frequency.

**Morphology gate:** obtain the relevant full methods/word-list material or an independently documented SLP review before designing affix composition. The initial release supports whole-word forms and phrases. A later affix experiment must specify joining/spelling behavior and demonstrate that users can express intended meanings without forced English syntax.

**Acceptance:** every proposed seed has provenance and disposition; missing evidence is marked; existing IDs/placements are preserved; no age, diagnosis, speech label, or grid dimension limits access to vocabulary. Test: T12; review: T13.

### W07 — Separate guardian login, editing unlock, and profile permissions

**Status:** Ready specification; cloud integration requires verifying the existing backend. **Owner:** developer. **Trace:** R10, R14, R16, F13; C08–C11.

Reuse the existing Supabase profile owner and membership model. Guardian account login authenticates the adult; profile ownership/editor membership authorizes cloud edits; the local unlock session gates child-facing editing. Do not derive authorization merely from the global PARENT/CAREGIVER/CHILD label. Children need no separate email/login to use an already configured local board.

Add a guardian entry flow for profile selection, account login, and settings. Require an editing session for builder commands, uploads, catalog management, and layout changes. Check the guard in commands as well as views; cover F2, long press, contextual actions and direct routes. Relock on reload, profile switch, explicit return to communication mode, or five minutes of inactivity in the guardian area. Communication controls remain usable while locked.

Local unlocking uses a device-local salted PIN verifier, not the current plain PIN in board data. Migrate a nonempty legacy PIN into the verifier and remove it from the new document; retain the old backup only as long as the guardian needs migration rollback. If no PIN exists, the guardian setup flow establishes one before editing is exposed to child mode. Recovery requires the authenticated owner online; unavailable recovery must not lock the communication board. A local PIN prevents casual editing, not a determined device owner from reading local storage.

Cloud operations require owner/editor permissions enforced at the database, with viewer read-only behavior and unrelated accounts denied. Follow the [official RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security). Review actual deployed policies before using the local repository; no deployment was inspected in this task. Keep PIN, sentence drafts and undo history out of cloud settings.

For the first release, use explicit **Publish profile** and **Download as local copy** operations rather than automatic merging. Add a revision-checked atomic profile publish operation to the repository: reject stale revisions and preserve the local draft; insert/update/delete the profile snapshot consistently or roll back entirely. Download never overwrites a dirty local document. Publish media first to a private profile-scoped bucket, then commit media references; failure keeps the local copy intact. See [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

**Acceptance:** an unlock cannot grant cloud rights; viewers cannot edit through alternate UI or direct API calls; cross-profile access is denied; stale publication cannot overwrite another edit; expired login does not erase the local board. Tests: T02, T09, T10.

### W08 — Verify offline reopening, storage health, and recovery

**Status:** Ready. **Owner:** developer. **Trace:** R19, F14; C09–C11.

Implement an app-shell/service-worker cache strategy compatible with the installed Next.js version. Cache the board shell, required static assets and fonts, bundled still images, and routes needed for local board navigation. Resolve custom local folders through the client board model so a folder created offline does not require a successful server response to open or reload.

Prepare offline readiness per device/profile: app shell cached, media available, local data saved, and selected speech capability separately checked. A single green “offline-ready” label must not conceal unavailable speech. Network status is a hint; actual request failure must use the same recovery behavior.

Provide a guardian-controlled export/import package containing versioned profile JSON and referenced media, with a manifest of media IDs and checksums. Never export account tokens or unlock credentials. Validate an import completely, then create a new local profile; do not replace the active profile in place. Corrupt or unsupported input leaves all existing data intact. Offer export when storage errors prevent further saving.

Cache updates must not interrupt an in-progress message or replace the running shell unexpectedly. Offer reload when safe. Do not delete old caches until a new shell is successfully installed; keep profile migration rollback independent from asset-cache cleanup.

**Acceptance:** after one successful setup, close the app, disable networking, reopen Home and a custom-folder URL, compose/repair, display photos, and exercise the documented speech fallback. Test a missing voice, full storage, private browsing/storage denial, a failed cache update, and corrupt import. Tests: T05, T10, T11.

### W09 — Evaluate participation and retain optional feature experiments

**Status:** Ready evaluation design; optional features are prototypes or gated below. **Owner:** research lead/designer with SLP/OT input as relevant. **Trace:** R01, R06, R08–R11, R15–R18, F01–F03, F15.

Start with an internal adult walkthrough of the static core board, then SLP review. User sessions require the project's consent/assent and institutional process; this plan does not claim those sessions have occurred. Use the Participation Model to record environmental/partner factors and DAGG-3 to discuss competency coverage. Do not automate diagnosis, cognitive classification, or AAC eligibility.

| Candidate | Prototype behavior | Evidence gate and exit |
|---|---|---|
| Animation | Existing animated assets available only when explicitly enabled; stills remain the default; reduced motion wins | Compare recognition, unintended selections, participation and preference with the static condition; retain only a documented purpose |
| Vibration | Independent off-by-default flag; supported devices give one short feedback pulse on accepted activation; unsupported devices behave normally | Device feasibility first, then comfort/usefulness observations; stop immediately if unwanted; no therapeutic benefit claim |
| Category wheel | Off-by-default alternative alongside conventional navigation; disable every invocation when off | Demonstrate to SLP; compare successful navigation, errors, support and preference while other features remain fixed |
| Scribble practice | Separate off-by-default practice area; review/edit recognized text before explicitly adding it to a sentence; never replace the main board | Gate OCR provider/retention and handwriting suitability on an OT-informed task definition; prototype mock recognition before any production provider integration |
| Parent-child chat | Separate off-by-default flow with guardian-managed contacts and explicit Send; composing in AAC never automatically sends | Gate production transport, contact authorization, retention and child interaction design on a reviewed scenario; prototype with local mock messages first |
| Pinned vocabulary | Optional later layout mock, not part of the initial core | Confirm what the SLP meant; compare persistent core access against lost grid space; define collision/resizing behavior before coding |

Feature settings are per profile. Disabling a module removes its entry points, event handlers and side effects without deleting its saved content. Show unavailable experimental modules as unavailable in guardian settings; never display a working toggle for a nonexistent implementation.

**Observation protocol.** Use personally relevant tasks for requesting, refusing, commenting, asking for help, navigating, combining words, and repairing mistakes. Record outcome, assistance, unintended activations, successful repair, navigation steps, device/context, and observed comfort/preference. Record elapsed time as descriptive data, not a universal speed requirement. Compare one optional change at a time; a small prototype trial is not proof of general clinical effectiveness.

**Follow-up package.** Update the two documents with verified results; include a short demonstration, voice samples, palette rationale, vocabulary review, requirement status, limitations, and Q01–Q08. Prepare the email content only when requested; do not send or schedule it automatically. Test/review: T13, T14.

## 4. Interface, migration, and architecture rules

These are proposed interfaces, not APIs already present in the app.

- Keep domain/media/profile types in the model layer, persistence and speech adapters in services, and state changes in store/ViewModel commands. Views render state and invoke commands; route files remain minimal.
- `IMediaRepository` must support save/load/remove with profile scope and recoverable errors. Resolve object URLs in the presentation/service boundary and release them when unused; do not persist object URLs.
- `ITTSService` must expose voice discovery, a structured speak request, and Stop. Its result/error state must distinguish cancellation, unavailable voice, provider failure and playback failure without discarding text.
- Add session-local sentence-history commands and a centralized editing-session guard. Do not synchronize transient state or build authentication logic into tile components.
- Extend cloud row types, mappers and schema together when adding tile media/language and profile feature settings. Existing settings validators reject unknown enum choices such as a new color mode unless updated. Preserve their explicit exclusion of PIN/sentence data.
- Cloud schema rollout is additive: introduce new nullable/defaulted fields and revision support, update validators, migrate local documents, then enable publication. Verify policies and profile/media ownership in a test environment before deployment. Do not change an already deployed migration in place.
- Keep the existing cloud repository as an explicit adapter; no database request belongs in a tile click handler. Recheck current provider documentation before implementation, including CLI migration behavior.

Do not introduce patient scoring, general communication logging, AI message rewriting, or predictive grammar as side effects of this work. Manual evaluation records are sufficient for the current research stage.

## 5. Test and acceptance matrix

Add a focused TypeScript unit/hook test setup compatible with the current React/Next stack, using Vitest and Testing Library, plus Playwright for browser flows. Pin compatible dependencies during implementation. Define `test` and `test:e2e` scripts then; they do not exist today. Review existing deleted tests before replacing their coverage. Hardware speech/haptics and offline behavior require actual-device checks in addition to browser automation.

| ID | Scenario | Required result |
|---|---|---|
| T01 | v1/v2 migration; repeated migration; future/corrupt version | Preserve IDs, words, locations, hidden state and settings; no duplicate import or silent reset |
| T02 | Profile A/B switching; unsaved data; expired account | No cross-profile content/history; switching cancels speech; local communication remains available |
| T03 | Resize global/folder grids; hidden overflow; explicit reflow | Stable coordinates without reflow; recoverable overflow; rollback restores prior layout |
| T04 | Static/animated/reduced-motion modes on every surface | No GIF playback in static mode; consistent symbol and color behavior |
| T05 | Photo upload/crop/replacement, corrupt file, missing blob, offline reload | Valid media persists; failures preserve old content; no broken communication flow |
| T06 | Append duplicates, remove middle token, backspace, clear and undo | Ordered messages recover exactly; empty-state actions are safe; undo does not speak |
| T07 | Delayed synthesis, Stop, rapid replacement, edits during playback | Stale results never play or clear new messages; errors retain text |
| T08 | Touch, keyboard, focus, screen-reader labels, orientation, larger text | Equivalent navigation/repair; intentional repeated taps work; scrolling does not select unwanted tiles |
| T09 | F2/long-press/direct editor routes; viewer and unrelated cloud accounts | All editing paths guarded; data-layer access rules hold independently of UI |
| T10 | Quota/storage denial, failed publish, stale revision, corrupt backup | Honest unsaved status; no data loss; publication is atomic; recovery creates a separate profile |
| T11 | Cold reopen with network off, custom folder, photos and speech | Cached communication works; speech capability is accurately represented for each tested device |
| T12 | Vocabulary import, new starter set, word classes, mixed-language strings | Legacy boards unchanged; authored order/text retained; content provenance recorded |
| T13 | SLP review across four competencies and real activities | Outcomes and assistance recorded; no universal clinical pass score invented |
| T14 | Optional feature disabled/enabled; unsupported vibration; mock chat/OCR | No disabled side effects; explicit review/send actions; independent feature decisions |

Run the existing `npm run lint` and `npm run build` from the application directory after changes, then relevant unit/browser tests. Preserve a baseline report for pre-existing failures. Use Windows/Chromium for development, with physical iPad/Safari and Android/Chrome as the provisional tablet validation targets; unsupported target devices must be disclosed rather than marked passing. Exact hardware/OS versions are recorded at execution time.

### Release gates

1. **Data safety:** migrations, profile isolation and recovery scenarios pass.
2. **Core interaction:** grids, navigation, repair, editing protection and static media pass automated and manual checks.
3. **Availability:** cold offline reopening is demonstrated; speech limitations are documented per device.
4. **Content/voice:** the SLP/content reviewer records disposition of vocabulary, palette and voice findings; unresolved items remain gated.
5. **Optional features:** each has its own outcome record; none is automatically enabled by completing the core release.

Technical passage does not establish clinical effectiveness. Do not describe planned tests or review sessions as completed.

## 6. Coverage and ownership handoff

| Requirements | Primary work | Acceptance evidence |
|---|---|---|
| R01 target users | W06, W09 | Inclusive wording and participation scenarios |
| R02–R03 grids/consistency | W02 | T03, T08 |
| R04–R05 colors/photos | W03, W06 | T04, T05, T12 |
| R06 animation | W03, W09 | T04, T14 |
| R07 speech | W05 | T07, T11 plus listening review |
| R08 vibration | W09 | T14 plus comfort review |
| R09 scribble | W09 | Reviewed mock flow and OT-informed gate |
| R10 chat/roles | W07, W09 | T09, T14; production chat remains gated |
| R11 wheel | W02, W09 | Conventional navigation and separate comparison |
| R12 sentence repair | W04 | T06, T07 |
| R13 Tagalog combinations | W05, W06 | T12 and language review |
| R14 guardian access | W07 | T09 |
| R15 safeguards | W02, W04, W09 | T06, T08; individualized guard discussion |
| R16 customization | W01, W03, W07, W09 | T02, T14 |
| R17 resources | W00, W06 | Dossier source register and resolved/remaining Q01–Q03 |
| R18 follow-up | W09 | Reviewed package; no automatic email |
| R19 offline availability | W01, W05, W08 | T10, T11 |

The developer owns software correctness and migration records; the research lead owns source identity and evidence limits; the designer owns interaction comparisons; the Filipino-speaking SLP/content reviewer owns clinical-language review; guardians and AAC users contribute priorities and preferences. These are roles, not claims that named reviewers have accepted assignments.

Begin with W00 and the implementation-ready core packages. Missing screenshots, unpurchased apps, or unavailable full texts do not block correcting established code mismatches. Gated work must remain visibly gated until its exact missing input is obtained and documented.
