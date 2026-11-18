# WiKahon AAC research and analysis

Prepared: 17 November 2026 (Asia/Manila)  
Audience: WiKahon product team, developers, designers, and SLP liaison  
Companion: [WiKahon implementation plan](02-wikahon-implementation-plan.md)

## 1. Purpose and principal findings

WiKahon should prioritize dependable, personalized communication in the languages a child uses. The recommended resources serve different purposes: a participation framework, a goal-planning tool, an assessment app, communication products, vocabulary references, and a textbook. They should inform different decisions rather than become a single feature checklist.

The most consequential findings are:

- **F01 — Participation is the outcome.** Evaluate whether the child can communicate in meaningful activities, including the support and opportunities provided by other people. The Participation Model supplies the framework. [S01][s01]
- **F02 — Communication ability is not a grid-size prescription.** DAGG-3 organizes goals across competencies; it does not establish a universal row-count-to-ability mapping. Remove that implication from the current UI. [S02][s02] [S03][s03]
- **F03 — AAC Genie was probably conflated with a communication app.** The identified AAC Evaluation Genie supports assessment and device trials; the reviewed listing does not establish the claimed folder/pinned-row workflow. [S04][s04]
- **F04 — App editions matter.** TouchChat Lite lacks voice output. A free download or trial is not equivalent to an indefinitely free speaking AAC system. [S05][s05] [S06][s06]
- **F05 — English vocabulary is a reference, not a Filipino specification.** Use language-specific research, family vocabulary, and SLP review to select content and language behavior. [S10][s10] [S12][s12]
- **F06 — Several transcript references remain uncertain.** The Chua poster is a strong title match for the manual board, but neither its full methods nor the SLP's intended source is confirmed. The second emailed link is unidentified.
- **F07 — The approximately 700-page book has a plausible match.** Beukelman and Light's fifth edition is listed as 704 pages. This dossier reviews available publisher material, not the complete book. [S16][s16] [S17][s17]

The code audit adds concrete engineering findings: existing grid controls and sentence repair should be extended; Spanish cloud speech, animated assets, weak editing separation, and unverified offline reopening need attention. These are implementation observations, not clinical outcome claims.

## 2. Method, provenance, and limits

### Research workflow completed

1. Read the supplied recommendations and the live [Update WiKahon AAC features chat][thread]. Extracted user-provided consultation statements separately from that chat's assistant-proposed roadmap.
2. Identified official framework documents, assessment instructions, app listings, manuals, publisher material, and original research metadata/abstracts.
3. Compared ambiguous references against discoverable titles. Preserved uncertainty rather than substituting a similarly named product or study.
4. Inspected the current checkout's board models, store, ViewModels, views, speech adapter, and local cloud repository contracts.
5. Mapped findings to requirements, work items, validation scenarios, and SLP questions in the companion plan.

This is a focused research dossier, not a registered systematic review. Searches included the named resources, Filipino manual communication boards, Tagalog-English core vocabulary, app editions and language support, and the likely textbook. Public professional and original sources were preferred. App descriptions establish advertised behavior, not comparative effectiveness. No apps were purchased or tested on devices; no children were assessed; no communication outcomes were measured. No private email was searched, and no messages were sent.

Source access differs: official documents were readable; the Ocampo article's abstract, reference list, and supplement descriptions were accessible, but full article access was restricted and supplementary PDF downloads failed. The original Chua poster was not obtained. HERDIN registry information was discoverable through indexed records, while direct retrieval failed. Those limits constrain the conclusions below.

Prices are observations from public Philippine App Store pages retrieved on the preparation date. Cached search snippets sometimes disagreed with opened listings, especially for TouchChat. They are comparison inputs, not purchase quotations.

### Evidence labels

| Label | Meaning | Appropriate use |
|---|---|---|
| Professional framework | Organizes assessment or intervention | Structure questions and evaluations; do not infer a specific feature's effect size |
| Original descriptive research | Reports vocabulary or usage observations | Inform content candidates within the sampled population and context |
| Official product documentation | Describes a vendor's implementation | Compare capabilities and plan demonstrations |
| Citation/registry only | Confirms a bibliographic lead or proposed study | Identify follow-up work; do not report unobserved results |
| Consultation input | User-supplied account of SLP feedback | Establish project requirements, with attribution |
| Code observation | Read directly in the current checkout | Establish likely implementation state; runtime behavior remains untested |
| Product inference | Recommendation derived from these inputs | Treat as a design decision to validate, not established clinical evidence |

## 3. Consultation requirements baseline

The referenced chat supplies the following requirements. Its assistant response is planning context, not an additional SLP endorsement.

| ID | Consultation item | Direction to preserve |
|---|---|---|
| R01 | Target users | Include children whose speech does not meet communication needs, not only children who never speak |
| R02 | Grid size | Adjustable rows and columns, including folders and a six-cell option |
| R03 | Consistency | Preserve learned tile positions; make rearrangement intentional |
| R04 | Color coding | Retain configurable word-class coloring and explain departures from reference schemes |
| R05 | Images | Support symbols and familiar guardian/SLP-provided photos |
| R06 | Animation | Prefer static presentation; retain animation as an optional evaluated candidate |
| R07 | Speech | Evaluate natural Tagalog speech and provide voice choice |
| R08 | Vibration | Independent optional setting; investigate usefulness and comfort |
| R09 | Scribble | Optional practice workflow; examine handwriting demands with OT input |
| R10 | Chat and roles | Optional communication feature; prioritize core AAC and guardian controls |
| R11 | Category wheel | Demonstrate and evaluate as an optional layout |
| R12 | Sentence repair | Sentence bar, backspace, clear, and recovery from mistakes |
| R13 | Tagalog combinations | Support meaningful combinations without forcing English ordering |
| R14 | Guardian access | Keep builder/settings access out of everyday child interaction |
| R15 | Touch safeguards | Support mis-tap recovery; discuss physical guards individually |
| R16 | Personalization | Preserve all candidate features, configurable to the individual |
| R17 | Resource review | Study every recommended reference and track unresolved identities |
| R18 | Follow-up | Prepare a revised prototype and evidence package for the SLP |
| R19 | Communication availability | Engineering requirement from repository guidance: preserve core use through network failures |

## 4. Source-by-source analysis

### 4.1 AAC Participation Model

**Identity and evidence.** ASHA publishes a one-page model attributed to Beukelman and Mirenda (2013). It begins with participation patterns and communication needs, separates opportunity barriers from access barriers, connects assessment to interventions and partner instruction, and evaluates whether participation improves. Opportunity factors include policy, practice, facilitator knowledge/skill, and attitudes. Access assessment considers current communication, capabilities, environmental adaptations, and AAC options. This is a framework, not an app specification or a controlled trial of grid design. [S01][s01]

**Analysis for WiKahon.** A successful tap is only one component of a successful exchange. A child may locate a tile but have no relevant word, no willing listener, or no available device. Conversely, a communication partner can make a simpler system useful by offering time and responding to the message. This argues for evaluating the whole interaction, not ranking children by app proficiency.

**Proposed application.** For each target activity, record the intended message, current communication methods, partner response, environmental obstacles, access obstacles, and outcome. Include requests, refusal, information sharing, questions, social connection, and repair. Keep this as a team observation sheet initially; a clinical dashboard is not required to improve the board.

**Study exercise.** Walk through a mealtime exchange and a classroom choice. Identify one barrier the app can address and one requiring a partner or environmental change. Ask the SLP whether those are the right participation targets. Link: R01, R15, R18, R19; implementation W09.

### 4.2 Dynamic AAC Goals Grid, third edition

**Identity and evidence.** DAGG-3 is a free Tobii Dynavox assessment/planning resource for SLPs and support teams. Its instructions describe emergent, emergent transitional, context dependent, transitional independent, and independent communication. Goals address linguistic, operational, social, and strategic competencies. Different competencies may have different starting levels. The workflow includes reviewing goals, identifying support, choosing teaching strategies, and monitoring progress. The reviewed materials do not establish population norms or a diagnostic cutoff; calling it a standardized test would need separate evidence. [S02][s02] [S03][s03]

**Analysis for WiKahon.** Selecting tiles measures only part of operational performance. The team also needs to know what the child can express, whom they communicate with, and how they handle misunderstanding. An application should not assign clinical classifications from grid dimensions or automatically determine eligibility for more vocabulary.

**Original task examples, not copied DAGG goals:**

| Competency | Prototype observation | Information to record |
|---|---|---|
| Linguistic | Compose a personally meaningful combination | Meaning conveyed, available vocabulary, support |
| Operational | Open a folder and return without losing the message | Navigation errors, access method, assistance |
| Social | Initiate or respond during a shared activity | Partner/context, initiation, response opportunity |
| Strategic | Correct an accidental selection or clarify a message | Repair chosen, success, support |

**Study exercise.** With the SLP, map one observation to each competency and identify what assistance was provided. Do not set a universal pass rate from this dossier. Current preset tooltips equating small grids with “Emergent” and large grids with “Independent” should be replaced with neutral dimensions (C02). Link: R02, R12, R18; W02, W09.

### 4.3 AAC Evaluation Genie

**Identity and evidence.** The identified iPad app is AAC Evaluation Genie by Hump Software, with Celeste Helling listed as provider. The Philippine listing displayed PHP 799 and version 4.4. It describes assessment of language representation and access through direct selection and switch scanning, including visual tasks, vocabulary/category tasks, core words, picture description, and word prediction. Its stated purpose is to inform further evaluation/device trials, not choose a device automatically. English is listed; a Filipino assessment adaptation was not established. The description calls the battery “13” subtests while its current enumeration is inconsistent, so avoid reproducing a definitive count without checking the installed version. [S04][s04]

**Analysis.** A user's result may reflect vocabulary familiarity, task comprehension, visual access, motor access, fatigue, or experience with the symbol system. It should not be converted into a fixed maximum grid size or a requirement to “earn” AAC. ASHA supports individualized AAC assessment and rejects prerequisite gatekeeping. [S18][s18]

**Correction to earlier planning.** Study grid/folder/pinning interfaces in communication-app manuals or demonstrations. Do not attribute these to Genie unless the SLP identifies the intended screen or another app. The exact “AAC Genie” link remains worth confirming.

**Study exercise.** Ask the SLP to demonstrate a relevant assessment task and explain what it can and cannot establish. Record stimulus language, access method, and support. Do not build a replica diagnostic test into WiKahon. Link: R02, R15, R17; W00, W09.

### 4.4 AAC Board: identity unresolved

“AAC Board” is insufficient to identify a product. Two public listings illustrate the ambiguity: **iBoard - AAC Board** by JPH Dev advertises editable tiles, images, linked boards, speech, and offline availability after sign-in/caching; **Mosaic | AAC Board** by Vansuita advertises device speech, personalized boards, local operation without an account, and backup files. Neither has been established as the SLP's recommendation. [S19][s19] [S20][s20]

**Analysis.** These products have materially different first-use and persistence assumptions. Substituting one silently would produce an unreliable comparison. Until the name/developer/platform is confirmed, leave its price, pinned-row behavior, Filipino speech quality, and clinical evidence unspecified.

**Study exercise after identification.** Create a folder, add a personal word/photo, resize the board, compose and repair a message, reopen offline, and restore a backup. Record which edition and device were used. Link: R05, R17, R19; W00.

### 4.5 TouchChat

**Identity and editions.** PRC-Saltillo offers TouchChat Discover with a 30-day trial and upgrades to HD, HD with WordPower, or HD Lite. Its official language list includes English, Spanish, Canadian French, Arabic, Hebrew, and Mandarin, not Filipino. HD Lite has no voice output. WordPower is a vocabulary offering rather than simply another grid-size setting. [S05][s05] [S06][s06]

**Features worth studying.** The version 2025.5 manual documents editable vocabulary files, image import/camera use, button customization, page organization, speech-display settings, menu passcode protection, and backup workflows. It is older than the retrieved 2026 listing; use it to understand concepts and confirm changed controls in the actual installed version. [S08][s08]

**Analysis.** TouchChat is useful for comparing the effort required to personalize vocabulary, protect editing, and recover a communication system. Its feature list does not demonstrate better outcomes than WiKahon or supply a validated Filipino layout. Recorded messages may be relevant to familiar phrases, but a few recordings do not solve open-ended Taglish sentence speech.

**Study exercise.** Compare a stock page set and a personalized copy. Record the number of actions needed to find “help,” add a photo, navigate back, and recover a mistaken message. Inspect whether recurring vocabulary preserves location across pages; do not assume a global pinning feature.

**Cost caution.** The opened Philippine Discover listing showed HD Lite PHP 299, HD PHP 4,990, and HD with WordPower PHP 9,999. Search-indexed versions showed higher prices for some upgrades. Recheck the in-device purchase screen if procurement is later requested. [S07][s07] Link: R02–R05, R12, R14, R17; W02, W03, W04.

### 4.6 Proloquo2Go

**Identity and verified claims.** AssistiveWare's Proloquo2Go is a symbol-based communication app, distinct from its product named Proloquo. Official materials describe Crescendo vocabulary, customizable buttons/photos, multiple layouts, alternative access, and bilingual use in English, Spanish, French, and Dutch. Filipino is not among those four vocabulary languages. The Philippine listing displayed PHP 14,990, making the SLP's “about 14K” plausible as a peso estimate, but not confirming the original currency or historical price. [S09][s09] [S21][s21]

Support materials document vocabulary backup and transfer. Reinstalling the app alone does not restore customizations; preserving the user's vocabulary is a separate workflow. [S22][s22]

**Analysis.** Study how the product balances vocabulary access, stable locations, personal words, and recoverable configuration. A larger vocabulary is not automatically more usable; hiding unavailable content and moving learned content have different consequences. Conversely, a small fixed request-only board may prevent the child from expressing a wider range of intentions. WiKahon should let the support team investigate these tradeoffs without locking the user into a developmental label.

**Study exercise.** Compare layouts and vocabulary visibility while tracking the location of familiar words. Test an unfamiliar message, not only a practiced request. Confirm voice downloads and offline behavior on the available device rather than treating “installed app” as sufficient evidence. Link: R03, R05, R13, R19; W02, W03, W06, W08.

### 4.7 Tobii Dynavox core vocabulary resources

**Identity and contents.** “Toby Dynafox” is a plausible transcription of **Tobii Dynavox**; the exact list remains unconfirmed. The official Core First English guide distinguishes a high-frequency core, categorized word lists, quick social/repair expressions, topic-based messages, and keyboard access. Its English word-class arrangement and automatic word-form behavior are product choices. The resource center also provides printable communication materials. [S10][s10] [S11][s11]

**Analysis.** The transferable principle is supporting reusable words alongside personal and situation-specific content. The English arrangement is not evidence that Filipino combinations should follow English syntax. Likewise, a commercial word-class palette does not validate WiKahon's exact modified palette.

**Proposed vocabulary review worksheet.** For each candidate, record its communicative purpose, Filipino/English form, observed family usage, relevant word forms, proposed location, symbol/photo choice, speech rendering, source, and SLP disposition. Label examples developed by the team as examples, not corpus-derived core words.

Use refusal, assistance, questions, commenting, social connection, and repair as coverage checks. Candidate expressions such as “ayaw,” “tulong,” or “ulit” require contextual review; their presence in a draft is not proof of frequency rank. Do not redistribute proprietary symbols or complete page sets on the assumption that a publicly downloadable document grants app reuse rights.

**Study exercise.** Map one everyday activity across core words, personal fringe words, and a quick phrase. Compare how much navigation each strategy requires. Link: R04, R12, R13; W06, W09.

### 4.8 Filipino/UP manual communication-board reference

#### Closest bibliographic match

Ocampo et al.'s public reference list cites **Chua, E. C. K. (2017, October 13–14), “Using a developmental language model in evaluating the usefulness of a Filipino manual communication board with core vocabulary,”** a poster at the 10th Clinical AAC Research Conference in Washington, DC. This closely matches the transcript's wording. It remains a bibliographic lead: the original poster, sample, methods, word list, and results were not obtained. Its identity as the SLP's intended source is not confirmed. [S12][s12]

**Required next evidence:** original poster or author-provided material, institutional affiliation, vocabulary-selection method, intended users, board version, outcome measures, and any subsequent publication. Do not invent sample sizes or claim demonstrated benefit.

#### Separate UP Manila adult-board project

An indexed HERDIN record identifies “Evaluating the vocabulary and vocabulary organization of a Tagalog core communication board for adults: Initial usability testing with adults without disabilities,” associated with UP Manila and Ellyn Cassey Ko Chua. Its described two-round evaluation concerns a prototype for Tagalog-dominant adults. Registration documents planned research, not established results; direct registry retrieval failed in this review. Do not merge it with the 2017 poster or infer pediatric effectiveness. [S13][s13]

#### Supplemental pediatric research: Ocampo et al. (2025)

This peer-reviewed article reports secondary analysis of personal narratives from **100 Tagalog-English bilingual children in Metro Manila**. Frequency criteria identified 193 Tagalog words, 28 English words, and 60 Tagalog affixes; commonality criteria identified 56, three, and 11 respectively. This is vocabulary-development evidence, not a clinical trial of WiKahon. The public supplement descriptions identify 70-location Tagalog and 96-location bilingual boards. Full methods and the board PDFs were not reviewed, so this dossier does not reproduce their vocabulary inventory. [S12][s12] [S14][s14]

**Analysis.** Narrative sampling need not represent every classroom, home routine, region, age, or AAC user's priorities. Affixes deserve explicit design consideration, but their corpus presence does not establish that isolated affix tiles are the best interface. The companion plan keeps full-word and phrase authoring available and puts a productive morphology interface behind a separate language review.

#### Additional local resource: AAClatan

AAClatan describes itself as a UP graduate-founded spin-off offering Filipino vocabulary, locally relevant symbols, and a board maker. This makes it a useful local comparison lead. It is not confirmed as the emailed resource, and its website's product claims are not independent outcome evidence. [S15][s15]

**Study exercise.** Bring the Chua citation and the Ocampo abstract to the SLP; establish which resource was intended. Compare candidate vocabulary against actual family language, including code-switching and personally important expressions. Link: R05, R13, R17; W00, W06.

### 4.9 “Buckelman” AAC book

**Likely identity.** David R. Beukelman and Janice C. Light, *Augmentative & Alternative Communication: Supporting Children and Adults with Complex Communication Needs*, fifth edition, Brookes, 2020, ISBN 9781681253039. The publisher lists 704 pages. Earlier editions involve Pat Mirenda; the author name alone does not resolve edition. [S16][s16]

**Material actually reviewed.** The publisher's 32-page excerpt includes bibliographic material, a table of contents, and opening material. The contents identify assessment, intervention, partner collaboration, and AAC systems as major topics. Prioritize chapter 2 (assessment), chapter 3 (intervention), and chapter 4 (communication partners) for a licensed full-book reading. A chapter's presence in the contents is not evidence that its full text was reviewed. [S17][s17]

**Analysis.** The book is best used to integrate the other resources into a service and learning process. It should not be cited as proof for vibration, animated tiles, scribble recognition, or this exact wheel. For those questions, locate the specific relevant evidence rather than using the textbook's authority as a substitute.

**Study exercise.** Have each team discipline identify one question for the relevant chapter: assessment for the researcher, partner instruction for the designer, and access/persistence demands for the engineer. Record edition and page references when the full material becomes available. Link: R17, R18; W00, W09.

## 5. App comparison and procurement boundary

These are documentation findings, not hands-on test results. “Unverified” means this review did not establish the feature, not that the product lacks it.

| Dimension | AAC Evaluation Genie | AAC Board | TouchChat | Proloquo2Go |
|---|---|---|---|---|
| Main role | Assessment support | Product unresolved | Everyday AAC | Everyday AAC |
| Reviewed platform | iPad | Depends on identity | iPhone/iPad; other compatibility varies by listing | iPhone/iPad; companion support varies |
| Philippine cost observed | PHP 799 | Unverified | Discover trial; edition upgrades described above | PHP 14,990 |
| Vocabulary organization | Assessment stimuli | Unverified | Page sets and editable buttons | Crescendo, folders and personalization |
| Familiar photos | Custom photo support in vision tasks | Candidate listings advertise it | Documented import/camera | Advertised button personalization |
| Access | Direct selection and scanning | Unverified | Consult access settings/manual and edition | Official alternative-access documentation |
| Pinned rows/columns | Not established | Unverified | Exact workflow unverified | Exact workflow unverified |
| Filipino vocabulary/voice | Not established | Unverified | Not in reviewed supported vocabulary languages | Not in four advertised vocabulary languages |
| Backup | Assessment-data workflow needs demonstration | Depends on identity | Documented vocabulary backups | Documented vocabulary backups |
| Offline readiness | Not tested | Candidate-specific conditions | Not tested | Not tested |

Sources: [S04][s04], [S05][s05], [S07][s07], [S08][s08], [S09][s09], [S19][s19], [S20][s20], [S21][s21], [S22][s22]. No product is recommended for purchase solely from this table.

## 6. Current implementation audit

Audit method: source inspection on 17 November 2026. The checkout contains pre-existing edits, deleted tests, and new model/backend files. No build, device, network-loss, or clinical tests were run for this documentation task. Paths below identify implementation evidence, not a claim that the working tree is production-ready.

| ID | Observed state | Implication and code evidence |
|---|---|---|
| C01 | Explicit page/cell coordinates, hidden placements, global grid and folder override; dimensions constrained to 1–16 | Preserve this model. Shrinking can retain out-of-bounds cells; reflow is explicit. [Board types](../../seals/lib/board.ts), [store](../../seals/store/useBoardStore.ts) |
| C02 | Preset tooltips associate dimensions with ability labels | Replace with neutral dimensions; add explicit six-cell preset without prescribing it. [Settings](../../seals/app/components/BoardSettings.tsx) |
| C03 | Icon paths reference GIFs; board, editor gallery, and sentence tokens render them | Static mode needs actual still assets across all surfaces. [Tile view](../../seals/app/components/TileButton.tsx), [sentence view](../../seals/app/components/SentenceStrip.tsx) |
| C04 | Catalog and word-class color modes exist; initial tiles lack wordClass metadata; no neutral mode | A mapping alone does not deliver consistent grammatical coloring. Sentence token colors currently use tile/catalog colors. [Types](../../seals/lib/board.ts), [store](../../seals/store/useBoardStore.ts) |
| C05 | Editor separates label/spoken text, supports symbols and folders; no photo media reference or uploader found | Extend current authoring rather than replace it. [Editor](../../seals/viewmodels/useTileEditorViewModel.ts) |
| C06 | Append, remove-at-index, backspace, clear, speech stop/error handling exist; no undo command | Add bounded message history and verify playback/repair interaction. [Sentence ViewModel](../../seals/viewmodels/useSentenceViewModel.ts) |
| C07 | Cloud synthesis specifies Andres/es-MX; local fallback requests fil-PH and searches fil/tl voices | Current cloud configuration does not match intended language. Local availability and pronunciation are unverified. [TTS](../../seals/services/tts/ttsService.ts) |
| C08 | Optional local edit PIN; default null allows editing; long press and F2 can enter edit flow | This is an editing convenience gate, not account authorization. [Edit ViewModel](../../seals/viewmodels/useEditModeViewModel.ts), [interaction ViewModel](../../seals/viewmodels/useTileInteractionViewModel.ts) |
| C09 | Single localStorage key, wikahon-board-v2; storage-write failures are swallowed | No active-profile isolation in this store. Report failed persistence and test migrations; do not claim changes were saved. [Store](../../seals/store/useBoardStore.ts) |
| C10 | No service-worker registration/cache implementation found in searched app code | Local state persistence does not establish offline cold-start support. [App tree](../../seals/app), [provider](../../seals/store/BoardProvider.tsx) |
| C11 | Local profile/membership, board, tile and settings repository contracts exist; no runtime caller found outside setup documentation | Reuse contracts after verification; neither deployment nor live access rules were audited. Cloud mapping excludes PIN and sentence. [Repository](../../seals/models/supabase/boardRepository.ts), [mappers](../../seals/models/supabase/mappers.ts) |
| C12 | Wheel opens through context menu/keyboard; no feature flag; no scribble/chat/vibration implementation found in inspected flows | Keep candidates separate from the core board. [Shell ViewModel](../../seals/viewmodels/useBoardShellViewModel.ts) |
| C13 | Build/lint scripts exist; no test script; import casing includes MODELS while several working-tree paths use models | Establish a case-sensitive build and test baseline before app work. Do not revive deleted tests without reviewing ownership. [Manifest](../../seals/package.json), [store](../../seals/store/useBoardStore.ts) |

### Findings derived from the audit

- **F08:** Preserve coordinate-based placement and make overflow recoverable, not silently destructive (C01).
- **F09:** Static defaults require replacing GIF URLs with still images, not just CSS reduced motion (C03).
- **F10:** Word-class consistency requires metadata plus a shared color resolver for board and sentence surfaces (C04).
- **F11:** Repair and personalization are extensions to existing flows, not new systems from scratch (C05, C06).
- **F12:** Speech needs explicit voice/language selection and honest fallback availability (C07).
- **F13:** Guardian authorization, local edit unlocking, and child profile selection are separate concerns (C08, C09, C11).
- **F14:** Persistence, cached assets, app reopening, and offline speech need separate verification (C09, C10).
- **F15:** Optional features can remain in the roadmap without being enabled or claimed effective (consultation, C12).
- **F16:** The repository is in active transition; implementation must recheck the baseline and preserve other work (C13).

## 7. Evidence-to-product conclusions

| Decision | Basis | Confidence and boundary |
|---|---|---|
| Remove grid/ability labels | F02, C02 | Ready: UI currently implies a relationship not established by reviewed guidance |
| Preserve positions and recover overflow | R03, F08 | Ready as a behavior requirement; usability still needs observation |
| Static default, optional animation | R06, F09 | Consultation-led default; no claim that animation is universally ineffective |
| Add photos and consistent color options | R04–R05, F10–F11 | Ready for engineering; specific visual choices require individual review |
| Add undo and preserve messages through errors | R12, F11–F12 | Ready for engineering and regression tests |
| Correct voice-language configuration | R07, C07 | Ready; selection of a production cloud voice remains gated by listening tests |
| Review Filipino vocabulary and morphology | F05–F06 | Research-led; full corpus-derived inventory and final placement remain review-gated |
| Separate guardian access from optional chat | R10, R14, F13 | Ready architectural direction; account integration requires implementation verification |
| Validate true offline use | R19, F14 | Ready test requirement; current offline capability is not established |
| Prototype vibration, wheel, scribble and chat separately | R08–R11, F15 | Experimental; no benefit claim established by this review |

Not finding effectiveness evidence in this focused review does not prove none exists. A broader targeted literature search is required before making feature-specific clinical claims. The proposed modified palette, animated tiles, haptic feedback, handwriting recognition, and wheel should not inherit validation from unrelated AAC resources.

## 8. Reading sequence and SLP session package

### Recommended study order

1. Participation Model: agree on meaningful activities and partner responsibilities.
2. DAGG-3 instructions: select observations across all four competencies.
3. Chua citation and Ocampo abstract: resolve the Filipino sources and vocabulary scope.
4. Core First resources: compare vocabulary organization without directly translating the layout.
5. TouchChat and Proloquo2Go manuals/demos: examine personalization, navigation, repair, and backups.
6. AAC Genie demonstration with the SLP: understand assessment interpretation.
7. Relevant textbook chapters through a licensed copy: deepen assessment and partner-support reasoning.

### Questions requiring SLP clarification

| ID | Question | Decision affected |
|---|---|---|
| Q01 | Which exact AAC Board app and AAC Genie link/screens were intended? | Product comparison and pinning investigation |
| Q02 | Is the 2017 Chua poster the recommended manual-board study? Can its original material and the emailed Filipino link be identified? | Vocabulary evidence and source attribution |
| Q03 | Which book edition and screenshots/pages should the team prioritize? | Reading assignment and accurate citations |
| Q04 | Which communication activities, partners, languages and access needs should the prototype support first? | Content and evaluation tasks |
| Q05 | Which word classes/palette modifications are appropriate, and should family phrases or full word forms take precedence over affix controls? | Content model and default presentation |
| Q06 | What does acceptable Tagalog/Taglish speech sound like for the intended users, and which devices are available for trials? | Voice release gate |
| Q07 | Which optional feature should be demonstrated first, and what observation would justify retaining it? | Experimental sequence |
| Q08 | Which participation outcomes and assistance levels should be recorded at follow-up? | Evaluation protocol |

Prepare a prototype walk-through, findings/requirements matrix, vocabulary worksheet, static versus optional-layout examples, voice samples, and known limitations. Drafting the package is included in W09; emailing or scheduling it requires a separate explicit instruction.

## 9. Source register

All web sources were retrieved or checked on 17 November 2026; this is an access date, not a guarantee of live availability or current checkout price.

| ID | Source and reviewed material | Evidence/access status |
|---|---|---|
| S01 | [ASHA: Participation Model][s01], attributed to Beukelman & Mirenda (2013) | Official one-page framework |
| S02 | [Tobii Dynavox: DAGG-3 overview][s02] | Official product/resource explanation |
| S03 | [DAGG-3 instructions][s03], 11-page PDF | Instructions reviewed; not a psychometric validation study |
| S04 | [AAC Evaluation Genie, Philippine App Store][s04] | Developer listing, price and version history |
| S05 | [TouchChat Discover][s05] | Official trial/edition/language description |
| S06 | [TouchChat: How to buy][s06] | Official distinction concerning Lite voice output |
| S07 | [TouchChat Discover, Philippine App Store][s07] | Opened listing; conflicting cached prices noted |
| S08 | [TouchChat manual DOC100208v102][s08], app version 2025.5 | Selected customization, access and backup sections; not all 124 pages analyzed |
| S09 | [AssistiveWare: Proloquo2Go][s09] | Official product capabilities |
| S10 | [Core First English Page Set Guide v1.1][s10] | Official vocabulary organization reference |
| S11 | [Tobii Dynavox resource center][s11] | Resource discovery, including communication books |
| S12 | [Ocampo et al. (2025), AJSLP 34(6), 3103–3117][s12], DOI 10.1044/2025_AJSLP-24-00454 | Abstract, supplement descriptions, reference list; article/supplements not fully accessible |
| S13 | [HERDIN registry PHRR250522-008351][s13] | Indexed project record only; direct retrieval failed |
| S14 | [PubMed record 40882021][s14] | Original article abstract and bibliographic verification |
| S15 | [AAClatan][s15] | Local developer description; not confirmed emailed link |
| S16 | [Brookes: Beukelman & Light, fifth edition][s16] | Publisher metadata and availability |
| S17 | [Publisher excerpt and table of contents][s17] | 32-page excerpt; full textbook not reviewed |
| S18 | [ASHA AAC Practice Portal][s18] | Professional guidance, not a WiKahon evaluation |
| S19 | [iBoard - AAC Board][s19] | Possible name match only; Google Play developer listing |
| S20 | [Mosaic \| AAC Board][s20] | Possible name match only; Google Play developer listing |
| S21 | [Proloquo2Go, Philippine App Store][s21] | Price and advertised app capabilities |
| S22 | [Proloquo2Go support][s22] | Backup, editing, language, and access documentation index |
| S23 | [Supabase row-level security][s23] | Technical reference for future access-control implementation |
| S24 | [Supabase Storage access control][s24] | Technical reference for future private media storage |

The Chua (2017) poster is cited bibliographically through S12; an original public URL was not verified. The SLP's screenshots and unnamed email resource remain unavailable. These are bounded evidence gaps, not reasons to postpone independent engineering corrections.

[thread]: thread://01a1e9b3-bb77-7c10-9e19-5b9e59c90b56?hostId=local
[s01]: https://www.asha.org/siteassets/practice-portal/augmentative-and-alternative-communication/participation-model-for-augmentative-and-alternative-communication.pdf
[s02]: https://www.tobiidynavox.com/products/dagg-3
[s03]: https://download.mytobiidynavox.com/Resources%20for%20Pros/TD_DAGG_Instructions_en-US.pdf
[s04]: https://apps.apple.com/ph/app/aac-evaluation-genie/id541418407
[s05]: https://touchchatapp.com/touchchat-discover
[s06]: https://touchchatapp.com/support/how-to-buy-touchchat
[s07]: https://apps.apple.com/ph/app/touchchat-discover/id427022529
[s08]: https://touchchatapp.com/assets/uploads/TouchChat_App_Manual-v102-en-us.pdf
[s09]: https://www.assistiveware.com/products/proloquo2go
[s10]: https://download.mytobiidynavox.com/Snap/documents/TobiiDynavox_CoreFirst_English_PageSet_Guide_v1-1_en-US_WEB.pdf
[s11]: https://www.tobiidynavox.com/pages/resource-center/X190ZC1zbmFwX18
[s12]: https://pubs.asha.org/doi/10.1044/2025_AJSLP-24-00454
[s13]: https://olfu.herdin.ph/index.php/registry?cid=8351&layout=details&view=research
[s14]: https://pubmed.ncbi.nlm.nih.gov/40882021/
[s15]: https://www.aaclatan.com/
[s16]: https://brookes.ahw2m.net/Augmentative-and-Alternative-Communication-P1194.aspx
[s17]: https://brookespublishing.com/wp-content/uploads/2020/02/Beukelman-Excerpt-wTOC.pdf
[s18]: https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/
[s19]: https://play.google.com/store/apps/details?id=com.jme.iboardaac
[s20]: https://play.google.com/store/apps/details?id=com.neat.nest.mosaic
[s21]: https://apps.apple.com/ph/app/proloquo2go-aac/id308368164
[s22]: https://www.assistiveware.com/support/proloquo2go
[s23]: https://supabase.com/docs/guides/database/postgres/row-level-security
[s24]: https://supabase.com/docs/guides/storage/security/access-control
