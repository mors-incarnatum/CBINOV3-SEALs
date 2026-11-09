<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-rules -->
1. Do not touch anything in the codebase that is not explicitly told to.
2. README should not be updated or touched in any way.
3. Drastic changes require explicit permission.
<!-- END:project-rules -->

<!-- BEGIN:project-architecture -->
# Architecture Pattern: MVVM (Model-View-ViewModel)

This project strictly adheres to the **Model-View-ViewModel (MVVM)** pattern adapted for Next.js (App Router) and React 19. All new features and refactors must follow these layer boundaries and rules.

---

## 1. Architectural Layers & Separation of Concerns

### A. Model Layer (`models/`, `services/`, `store/`, `lib/`)
* **Purpose:** Represents domain entities, business data structures, persistence, and external/hardware services.
* **Rules:**
  1. **Zero UI Awareness:** The Model layer must NEVER import React, JSX, DOM APIs, or Tailwind classes.
  2. **Domain Entities:** Core types (`WordTile`, `GridSlot`, `CategoryId`, etc.) live in domain models and define pure data contracts.
  3. **Repository / Store:** Global and persisted state (Zustand stores like `useBoardStore`) acts as the client-side data repository. Direct store subscriptions inside presentation views are discouraged in favor of passing through ViewModels.
  4. **Service Abstraction:** Hardware and external capabilities (e.g., Text-To-Speech, cloud sync) must be defined via interfaces (e.g., `ITTSService`) with implementations supporting fallback strategies (e.g., Puter.js / ElevenLabs with offline Web Speech API fallback).

### B. ViewModel Layer (`viewmodels/`)
* **Purpose:** Acts as the mediator between the Model layer and the View layer. Encapsulates all presentation logic, gesture calculations, UI state, and user interaction commands.
* **Rules:**
  1. **Headless Custom Hooks:** ViewModels are implemented as React hooks (named `use<Feature>ViewModel.ts`).
  2. **No JSX / DOM Elements:** A ViewModel must never return JSX or HTML elements. It returns plain objects containing:
     - **State / Getters:** Formatted data ready for display (e.g., active word, current page, active coordinates).
     - **Actions / Commands:** Callbacks for user triggers (e.g., `actions.onPress`, `actions.onRemove`, `actions.onSwipeNext`).
  3. **Gesture & Timing Isolation:** All timers (`setTimeout`, `setInterval`), long-press dwell calculations (e.g., 500ms hold threshold), drag tolerances (`Math.hypot`), and touch swipe math (`dx/dy`) must be contained entirely within ViewModels, never in View components.
  4. **Accessibility Configuration:** AAC accessibility tolerances (dwell times, swipe thresholds, volume) must be parameterized in ViewModels so they can be driven by user configuration.
  5. **Headless Testability:** ViewModels must be testable via `@testing-library/react` (`renderHook`) without mounting or mocking complex DOM trees.

### C. View Layer (`components/` or `app/components/`)
* **Purpose:** Pure declarative UI rendering.
* **Rules:**
  1. **Dumb / Thin Views:** View components only declare visual structure (Tailwind CSS, SVG icons, ARIA attributes) and wire up user events to ViewModel actions.
  2. **No Business or Gesture Logic:** Views must NOT contain timers, touch math, or direct mutations to persistence stores or external hardware services.
  3. **Consumption:** Views either consume their corresponding ViewModel hook directly or receive ViewModel state and actions via props.

### D. App / Route Layer (`app/`)
* **Purpose:** Handles Next.js routing, layout composition, server parameters, and route metadata.
* **Rules:**
  1. Route pages (`app/**/page.tsx`) must remain minimal: handle parameter resolution (`generateStaticParams`, params unwrapping), route guards, and render the corresponding top-level View.
  2. No inline business logic or heavy component composition inside `page.tsx` files.

---

## 2. Directory Structure Conventions

When adding or refactoring features, organize code within these designated directories:

```text
seals/
├── app/                  # Next.js App Router (Routing, Layouts, Metadata only)
│   ├── board/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── [categoryId]/page.tsx
│   └── globals.css
├── components/           # View Layer (Pure JSX, styling, ARIA)
│   ├── BoardShell.tsx
│   ├── HomeBoard.tsx
│   ├── CategoryBoard.tsx
│   ├── EditableTileSlot.tsx
│   ├── TileButton.tsx
│   ├── CategoryWheel.tsx
│   └── WordPicker.tsx
├── viewmodels/           # ViewModel Layer (Headless React Hooks)
│   ├── useBoardShellViewModel.ts
│   ├── useHomeBoardViewModel.ts
│   ├── useCategoryBoardViewModel.ts
│   ├── useTileSlotViewModel.ts
│   ├── useCategoryWheelViewModel.ts
│   └── useWordPickerViewModel.ts
├── models/               # Domain Entities & Types (Plain TS / JSON)
│   ├── board.ts
│   └── Words.json
├── services/             # Hardware, Cloud & External Adapters
│   └── tts/
│       ├── ttsService.ts (Interface & Implementations)
│       └── ttsClient.ts
└── store/                # Data Store / State Persistence (Zustand)
    ├── useBoardStore.ts
    └── BoardProvider.tsx
```

---

## 3. AAC-Specific Engineering Directives

1. **Speech Pipeline:** Never trigger TTS directly from a button click handler. Speech requests must flow through ViewModel commands to allow queueing, active word highlights, and volume normalization.
2. **Offline-First:** All AAC communication features (speech, custom board personalization, navigation) must handle offline environments gracefully without uncaught exceptions.
3. **Accessibility (a11y):** All interactive tiles and controls must retain appropriate ARIA roles, labels, live regions, and keyboard fallbacks (e.g., F2 for edit, Enter/Space for activation, Escape for dismissal).
<!-- END:project-architecture -->
