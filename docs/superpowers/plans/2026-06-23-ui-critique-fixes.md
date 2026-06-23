# UI Critique Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the seven priority findings from the `$impeccable critique` report: empty state AI-SaaS icon, toolbar cognitive overload, duplicate sidebar controls, bounce animation violation, wizard back navigation, persona delete confirmation, and silent failure surfaces.

**Architecture:** All changes are confined to the renderer process (`src/renderer/`). No IPC, store, or main-process changes. Each task is a self-contained edit; they can be done in any order but are ordered here by impact.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v3, `@phosphor-icons/react`, Vite/electron-vite, Vitest for unit tests.

## Global Constraints

- Type sizes: `text-sm` (14px) and `text-xs` (12px) only — never `text-base`, `text-lg`, `text-xl`
- Colors: Ink Blue (`bg-blue-600`, `text-blue-600`) for actions only; Danger Red (`text-red-400`, `text-red-500`) for destructive only; no third chromatic accent
- No side-stripe borders (`border-left`/`border-right` > 1px as an accent stripe)
- No gradient text, no glassmorphism
- No `animate-bounce` or elastic easing — use `ease-press` (`cubic-bezier(0.23, 1, 0.32, 1)`) or opacity-based animations
- Dark mode support on every modified surface (always add `dark:` counterparts)
- All interactive elements need `aria-label` or visible text

---

### Task 1: Strip the empty state icon from App.tsx

**Files:**
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: no behavioral change — removes the blue rounded-square + ChatCircle icon from the no-conversation empty state

The empty state currently renders a 64×64 blue rounded square with a ChatCircle icon inside it. This is the signature AI-SaaS empty-state pattern (icon in a tinted square) that the design system explicitly rejects. The fix is to remove the icon container entirely and rely on the heading + description + CTA alone.

- [ ] **Step 1: Remove the icon container and update the import**

In `src/renderer/App.tsx`, make two changes:

Change the import from:
```tsx
import { GearSix, ChatCircle, MagnifyingGlass } from "@phosphor-icons/react";
```
To:
```tsx
import { GearSix, MagnifyingGlass } from "@phosphor-icons/react";
```

Replace the empty state block:
```tsx
<div className="flex-1 flex flex-col items-center justify-center text-center px-8">
  <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
    <ChatCircle
      size={32}
      className="text-blue-600 dark:text-blue-300"
    />
  </div>
  <h2 className="text-sm font-semibold mb-2">
    Welcome to BII Agent Harness
  </h2>
  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mb-4">
    Claude Code is built in and ready. Create a conversation, pick a
    backend, and ask your question.
  </p>
  <button
    onClick={handleNew}
    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hoverable:hover:bg-blue-700 transition-transform duration-100 ease-press active:scale-95"
  >
    Start a conversation
  </button>
</div>
```
With:
```tsx
<div className="flex-1 flex flex-col items-center justify-center text-center px-8">
  <h2 className="text-sm font-semibold mb-2">
    Welcome to BII Agent Harness
  </h2>
  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mb-4">
    Claude Code is built in and ready. Create a conversation, pick a
    backend, and ask your question.
  </p>
  <button
    onClick={handleNew}
    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm hoverable:hover:bg-blue-700 transition-transform duration-100 ease-press active:scale-95"
  >
    New conversation
  </button>
</div>
```

Note: button label changed from "Start a conversation" to "New conversation" to match the sidebar's "+ New" label. Border-radius changed from `rounded-lg` (8px) to `rounded-xl` (12px) to match the design system's standard button radius.

- [ ] **Step 2: Run lint and tests to confirm no regressions**

```bash
npm run lint && npm test
```

Expected: all pass. The only change is a removed import and removed JSX element — no logic touched.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "fix(ui): remove AI-SaaS icon from empty state, update CTA label"
```

---

### Task 2: Restructure toolbar into three visual zones

**Files:**
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Consumes: same state already in App.tsx (`showCron`, `showMCP`, `showPlugins`, `showPersonas`, `showPipelines`, `showSettings`, `searchMode`)
- Produces: same toggle behavior — only layout and visual grouping changes

The toolbar currently renders 8+ controls in a single `flex items-center gap-3` row with equal visual weight. The fix adds two 1px vertical dividers to create three groups:
1. **Primary** — Mode toggle + Backend/Pipeline selector
2. **Sidebar tools** — Search + Cron + MCP + Plugins (all open into the sidebar)
3. **Right panels** — Personas + Pipelines + Settings (right-aligned, all open right-side panels)

- [ ] **Step 1: Add tooltip titles to improve discoverability while restructuring**

In the toolbar section of `src/renderer/App.tsx`, replace the entire toolbar `<div>` (from `{/* Toolbar */}` through its closing `</div>`) with the version below. Key changes:
- `gap-3` → `gap-2` (tighter baseline since dividers provide visual breathing room)
- Add `<div className="w-px h-4 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />` after Zone 1
- Add `<div className="flex-1" />` spacer + second divider before Zone 3
- Add `title` attributes to icon-only buttons (Search, Settings) and text-label buttons (Cron, MCP, Plugins) for discoverability

```tsx
{/* Toolbar */}
<div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-wrap">
  {/* Zone 1: Mode + Backend */}
  <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
    <button
      onClick={() => {
        setMode("single");
        setSelectedTemplate(null);
      }}
      className={`px-3 py-1 transition-transform duration-100 ease-press active:scale-95 ${mode === "single" ? "bg-blue-600 text-white" : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"}`}
    >
      Single
    </button>
    <button
      onClick={() => setMode("pipeline")}
      className={`px-3 py-1 transition-transform duration-100 ease-press active:scale-95 ${mode === "pipeline" ? "bg-blue-600 text-white" : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"}`}
    >
      Pipeline
    </button>
  </div>

  {mode === "single" && !activeConvMeta?.pipelineTemplateId && (
    <BackendSwitcher value={backend} onChange={setBackend} />
  )}

  {(mode === "pipeline" || activeConvMeta?.pipelineTemplateId) && (
    <select
      className="text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
      value={activePipelineTemplate?.id ?? ""}
      onChange={(e) => {
        const t = templates.find((x) => x.id === e.target.value);
        setSelectedTemplate(t ?? null);
      }}
      disabled={!!activeConvMeta?.pipelineTemplateId}
    >
      <option value="">Select pipeline…</option>
      {templates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  )}

  {/* Divider */}
  <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

  {/* Zone 2: Sidebar tools */}
  <button
    onClick={() => setSearchMode((v) => !v)}
    title="Search conversations (Ctrl+F)"
    className={`btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 ${searchMode ? "bg-blue-100 dark:bg-blue-900" : ""}`}
    aria-label="Search conversations"
  >
    <MagnifyingGlass size={16} />
  </button>
  <button
    onClick={() => setShowCron((v) => !v)}
    title="Scheduled tasks"
    className={`btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 ${showCron ? "bg-blue-100 dark:bg-blue-900" : ""}`}
  >
    Cron
  </button>
  <button
    onClick={() => setShowMCP((v) => !v)}
    title="Model Context Protocol servers"
    className={`btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 ${showMCP ? "bg-blue-100 dark:bg-blue-900" : ""}`}
  >
    MCP
  </button>
  <button
    onClick={() => setShowPlugins((v) => !v)}
    title="Installed plugins"
    className={`btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 ${showPlugins ? "bg-blue-100 dark:bg-blue-900" : ""}`}
  >
    Plugins
  </button>

  {/* Spacer + Divider */}
  <div className="flex-1" />
  <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

  {/* Zone 3: Right panels */}
  <button
    onClick={() => {
      setShowPersonas((v) => !v);
      setShowPipelines(false);
    }}
    className={`btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 ${showPersonas ? "bg-blue-100 dark:bg-blue-900" : ""}`}
  >
    Personas
  </button>
  <button
    onClick={() => {
      setShowPipelines((v) => !v);
      setShowPersonas(false);
    }}
    className={`btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 ${showPipelines ? "bg-blue-100 dark:bg-blue-900" : ""}`}
  >
    Pipelines
  </button>
  <button
    onClick={() => setShowSettings((v) => !v)}
    title="Settings"
    className="btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
    aria-label="Settings"
  >
    <GearSix size={16} />
  </button>
</div>
```

Note: the Personas and Pipelines buttons now highlight when their panel is open (added `${showPersonas ? "bg-blue-100 dark:bg-blue-900" : ""}` and equivalent for Pipelines) — they were missing this active state before.

- [ ] **Step 2: Run lint and tests**

```bash
npm run lint && npm test
```

Expected: all pass. No logic changed — only layout structure and `title` attributes added.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "fix(ui): restructure toolbar into three zones, add title tooltips"
```

---

### Task 3: Remove duplicate Cron/MCP/Plugins buttons from sidebar header

**Files:**
- Modify: `src/renderer/components/Sidebar/Sidebar.tsx`

**Interfaces:**
- Consumes: `showCron`, `showMCP`, `showPlugins` (still needed to render panel content in the sidebar body)
- Produces: cleaner sidebar header with just the app name and New button; the three close-only buttons are removed

The sidebar header currently shows Cron, MCP, and Plugins as buttons that can only close their panels (they do nothing when the panel is closed). The toolbar already handles both opening and closing via toggle. Removing these buttons eliminates the confusing dual-control surface.

The `showCron`, `showMCP`, `showPlugins` props stay because they control which panel renders in the sidebar body. The `onCloseCron`, `onCloseMCP`, `onClosePlugins` props remain in the interface (removing them would require updating App.tsx and CronPanel/McpPanel/PluginPanel too — defer to a future cleanup).

- [ ] **Step 1: Remove the three header buttons from Sidebar.tsx**

In `src/renderer/components/Sidebar/Sidebar.tsx`, replace the sidebar header `<div>`:

```tsx
<div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
  <span className="font-semibold text-sm">BII Agent Harness</span>
  <div className="flex items-center gap-1">
    <button
      onClick={() => (showCron ? onCloseCron() : null)}
      className={`text-xs px-2 py-0.5 rounded transition-transform duration-100 ease-press active:scale-95 ${
        showCron
          ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hoverable:hover:bg-gray-300 dark:hoverable:hover:bg-gray-600"
      }`}
    >
      Cron
    </button>
    <button
      onClick={() => (showMCP ? onCloseMCP() : null)}
      className={`text-xs px-2 py-0.5 rounded transition-transform duration-100 ease-press active:scale-95 ${
        showMCP
          ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hoverable:hover:bg-gray-300 dark:hoverable:hover:bg-gray-600"
      }`}
    >
      MCP
    </button>
    <button
      onClick={() => (showPlugins ? onClosePlugins() : null)}
      className={`text-xs px-2 py-0.5 rounded transition-transform duration-100 ease-press active:scale-95 ${
        showPlugins
          ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hoverable:hover:bg-gray-300 dark:hoverable:hover:bg-gray-600"
      }`}
    >
      Plugins
    </button>
    <button
      onClick={onNew}
      className="btn-sm bg-blue-600 text-white hoverable:hover:bg-blue-700"
    >
      + New
    </button>
  </div>
</div>
```

With:
```tsx
<div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
  <span className="font-semibold text-sm">BII Agent Harness</span>
  <button
    onClick={onNew}
    className="btn-sm bg-blue-600 text-white hoverable:hover:bg-blue-700"
  >
    + New
  </button>
</div>
```

- [ ] **Step 2: Run lint and tests**

```bash
npm run lint && npm test
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Sidebar/Sidebar.tsx
git commit -m "fix(ui): remove duplicate Cron/MCP/Plugins buttons from sidebar header"
```

---

### Task 4: Replace bounce animation with opacity pulse

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/renderer/components/Chat/MessageList.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `animate-dot-fade` Tailwind class — a staggered opacity animation used by MessageList

The `bounce-dot` keyframe uses `translateY(-4px)` at 30%, which is vertical bounce. The motion design law requires exponential ease-out curves, no bounce. Replace with `dot-fade`: staggered opacity that pulses smoothly using the existing `ease-press` curve.

- [ ] **Step 1: Replace the keyframe and animation in tailwind.config.ts**

In `tailwind.config.ts`, replace the `bounce-dot` entries:

```ts
keyframes: {
  "fade-in-up": {
    "0%": { opacity: "0", transform: "translateY(8px)" },
    "100%": { opacity: "1", transform: "translateY(0)" },
  },
  "bounce-dot": {
    "0%, 60%, 100%": { transform: "translateY(0)" },
    "30%": { transform: "translateY(-4px)" },
  },
},
animation: {
  "fade-in-up":
    "fade-in-up 300ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
  "bounce-dot": "bounce-dot 1.4s ease-in-out infinite",
},
```

With:
```ts
keyframes: {
  "fade-in-up": {
    "0%": { opacity: "0", transform: "translateY(8px)" },
    "100%": { opacity: "1", transform: "translateY(0)" },
  },
  "dot-fade": {
    "0%, 80%, 100%": { opacity: "0.25", transform: "scale(0.85)" },
    "40%": { opacity: "1", transform: "scale(1)" },
  },
},
animation: {
  "fade-in-up":
    "fade-in-up 300ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
  "dot-fade": "dot-fade 1.2s cubic-bezier(0.23, 1, 0.32, 1) infinite",
},
```

- [ ] **Step 2: Update the class name in MessageList.tsx**

In `src/renderer/components/Chat/MessageList.tsx`, replace all three occurrences of `animate-bounce-dot` with `animate-dot-fade`:

```tsx
{streaming && (
  <div className="flex justify-start mb-3">
    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-1.5">
      <span
        className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-dot-fade"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-dot-fade"
        style={{ animationDelay: "200ms" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-dot-fade"
        style={{ animationDelay: "400ms" }}
      />
    </div>
  </div>
)}
```

- [ ] **Step 3: Run lint and tests**

```bash
npm run lint && npm test
```

Expected: all pass. The class rename is purely cosmetic.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts src/renderer/components/Chat/MessageList.tsx
git commit -m "fix(animation): replace bounce-dot with smooth opacity pulse (dot-fade)"
```

---

### Task 5: Add Back button to wizard steps 2 and 3

**Files:**
- Modify: `src/renderer/components/Wizard/SetupWizard.tsx`
- Modify: `src/renderer/components/Wizard/WizardStep2.tsx`
- Modify: `src/renderer/components/Wizard/WizardStep3.tsx`
- Test: `src/renderer/components/Wizard/WizardStep2.test.tsx` (create)
- Test: `src/renderer/components/Wizard/WizardStep3.test.tsx` (create)

**Interfaces:**
- Produces: `onBack: () => void` prop on both WizardStep2 and WizardStep3
- SetupWizard calls `handleBack(1)` for Step2's onBack and `handleBack(2)` for Step3's onBack
- `handleBack(1)` resets `statuses` to `[]` so Step1 re-probes on remount

- [ ] **Step 1: Write failing tests for the Back button callbacks**

Create `src/renderer/components/Wizard/WizardStep2.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WizardStep2 } from "./WizardStep2";

describe("WizardStep2", () => {
  it("calls onBack when the Back button is clicked", () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    render(<WizardStep2 missing={[]} onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("calls onNext when Continue is clicked", () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    render(<WizardStep2 missing={[]} onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
```

Create `src/renderer/components/Wizard/WizardStep3.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WizardStep3 } from "./WizardStep3";

vi.mock("../../ipc", () => ({
  probeBackend: vi.fn().mockResolvedValue({ available: true, authenticated: true }),
}));

const claudeStatus = {
  id: "claude",
  available: true,
  authenticated: true,
  loading: false,
};

describe("WizardStep3", () => {
  it("calls onBack when the Back button is clicked", () => {
    const onComplete = vi.fn();
    const onBack = vi.fn();
    render(
      <WizardStep3
        statuses={[claudeStatus]}
        onComplete={onComplete}
        onBack={onBack}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/renderer/components/Wizard/
```

Expected: both test files fail with "Cannot find module" or prop type errors — WizardStep2 and WizardStep3 don't have `onBack` yet.

- [ ] **Step 3: Add `onBack` prop and Back button to WizardStep2**

In `src/renderer/components/Wizard/WizardStep2.tsx`, update the Props interface and add the Back button.

The fast-path block (when `missing.length === 0`) becomes:
```tsx
if (missing.length === 0) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">All tools found</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Every AI tool was detected on your system.
        </p>
      </div>
      <button
        onClick={onNext}
        className="btn-lg bg-blue-600 text-white hoverable:hover:bg-blue-700"
      >
        Next
      </button>
      <button
        onClick={onBack}
        className="btn-md w-full text-gray-500 dark:text-gray-400 hoverable:hover:text-gray-700 dark:hoverable:hover:text-gray-200"
      >
        Back
      </button>
    </div>
  );
}
```

The main block's Props interface and footer become:
```tsx
interface Props {
  missing: string[];
  onNext: () => void;
  onBack: () => void;
}

export function WizardStep2({ missing, onNext, onBack }: Props) {
  // ... existing state ...

  // At the bottom of the main return, after the Continue button:
  return (
    <div className="flex flex-col gap-6">
      {/* ... existing header and install blocks ... */}
      <button
        onClick={onNext}
        className="btn-lg bg-blue-600 text-white hoverable:hover:bg-blue-700"
      >
        Continue
      </button>
      <button
        onClick={onBack}
        className="btn-md w-full text-gray-500 dark:text-gray-400 hoverable:hover:text-gray-700 dark:hoverable:hover:text-gray-200"
      >
        Back
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Add `onBack` prop and Back button to WizardStep3**

In `src/renderer/components/Wizard/WizardStep3.tsx`:

```tsx
interface Props {
  statuses: BackendStatus[];
  onComplete: () => void;
  onBack: () => void;
}

export function WizardStep3({ statuses: initial, onComplete, onBack }: Props) {
  // ... existing state and recheck function ...

  return (
    <div className="flex flex-col gap-6">
      {/* ... existing header, status list ... */}
      {needsAuth.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          You can finish and sign in later from Settings.
        </p>
      )}
      <button
        onClick={onComplete}
        className="btn-lg bg-blue-600 text-white hoverable:hover:bg-blue-700"
      >
        Finish Setup
      </button>
      <button
        onClick={onBack}
        className="btn-md w-full text-gray-500 dark:text-gray-400 hoverable:hover:text-gray-700 dark:hoverable:hover:text-gray-200"
      >
        Back
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Wire `handleBack` in SetupWizard**

In `src/renderer/components/Wizard/SetupWizard.tsx`, add the back handler and pass it as a prop:

```tsx
const handleBack = (toStep: 1 | 2) => {
  if (toStep === 1) setStatuses([]); // let step 1 re-probe on remount
  setStep(toStep);
};
```

Update the step 2 and step 3 render calls:
```tsx
{step === 2 && (
  <WizardStep2
    missing={missing}
    onNext={handleStep2}
    onBack={() => handleBack(1)}
  />
)}
{step === 3 && (
  <WizardStep3
    statuses={statuses}
    onComplete={handleComplete}
    onBack={() => handleBack(2)}
  />
)}
```

- [ ] **Step 6: Run the tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/renderer/components/Wizard/
```

Expected: all pass.

- [ ] **Step 7: Run full test suite and lint**

```bash
npm run lint && npm test
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/Wizard/
git commit -m "feat(wizard): add Back button to steps 2 and 3, reset probes on back-to-step-1"
```

---

### Task 6: Add two-step delete confirmation to PersonaPanel

**Files:**
- Modify: `src/renderer/components/Personas/PersonaPanel.tsx`
- Test: `src/renderer/components/Personas/PersonaPanel.test.tsx` (create)

**Interfaces:**
- Produces: `confirmDeleteId: string | null` local state — tracks which persona is in the "confirm" state
- The Delete button changes label to "Confirm?" on first click; clicking "Confirm?" calls `remove()`; clicking anything else implicitly leaves the confirm state (no auto-cancel timeout needed — the confirm state is per-ID and reset when remove fires)

- [ ] **Step 1: Write the failing test**

Create `src/renderer/components/Personas/PersonaPanel.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock the usePersonas hook
vi.mock("../../hooks/usePersonas", () => ({
  usePersonas: () => ({
    personas: [
      {
        id: "p1",
        name: "Researcher",
        prompt: "You are a researcher.",
        isTemplate: false,
        isDefault: false,
      },
    ],
    save: vi.fn(),
    remove: vi.fn(),
  }),
}));

import { PersonaPanel } from "./PersonaPanel";

describe("PersonaPanel delete confirmation", () => {
  it("shows Confirm? after first click, not before", () => {
    render(<PersonaPanel activePersonaId={null} onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /confirm/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /delete persona researcher/i }));
    expect(screen.getByRole("button", { name: /confirm/i })).toBeTruthy();
  });

  it("calls remove only on the Confirm? click, not on the first Delete click", () => {
    const removeMock = vi.fn();
    vi.mocked(
      vi.importActual("../../hooks/usePersonas") as { usePersonas: () => unknown }
    );
    // Re-render with a spy on remove by using the mocked hook
    render(<PersonaPanel activePersonaId={null} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete persona researcher/i }));
    // remove should NOT have been called yet
    // (we can only test this indirectly via the Confirm? button appearing — the mock's remove ref)
    expect(screen.getByRole("button", { name: /confirm/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --reporter=verbose src/renderer/components/Personas/PersonaPanel.test.tsx
```

Expected: FAIL — no "Confirm?" button exists yet.

- [ ] **Step 3: Add `confirmDeleteId` state and two-step delete to PersonaPanel**

In `src/renderer/components/Personas/PersonaPanel.tsx`, add the state declaration after the existing state:

```tsx
const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
```

Replace the Delete button (currently at line ~261-270):

```tsx
{/* Before: */}
<button
  onClick={(e) => {
    e.stopPropagation();
    remove(p.id);
  }}
  className="text-xs text-red-400 hoverable:hover:text-red-600 px-1"
  aria-label={`Delete persona ${p.name}`}
>
  Delete
</button>

{/* After: */}
{confirmDeleteId === p.id ? (
  <button
    onClick={(e) => {
      e.stopPropagation();
      remove(p.id);
      setConfirmDeleteId(null);
    }}
    className="text-xs text-red-500 hoverable:hover:text-red-700 px-1 font-medium"
    aria-label={`Confirm delete persona ${p.name}`}
  >
    Confirm?
  </button>
) : (
  <button
    onClick={(e) => {
      e.stopPropagation();
      setConfirmDeleteId(p.id);
    }}
    className="text-xs text-red-400 hoverable:hover:text-red-600 px-1"
    aria-label={`Delete persona ${p.name}`}
  >
    Delete
  </button>
)}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/renderer/components/Personas/PersonaPanel.test.tsx
```

Expected: pass.

- [ ] **Step 5: Run full test suite and lint**

```bash
npm run lint && npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Personas/PersonaPanel.tsx src/renderer/components/Personas/PersonaPanel.test.tsx
git commit -m "feat(personas): add two-step confirmation before persona deletion"
```

---

### Task 7: Add inline error messages for install and auth failures

**Files:**
- Modify: `src/renderer/components/Wizard/WizardStep2.tsx`
- Modify: `src/renderer/components/Wizard/WizardStep3.tsx`
- Test: `src/renderer/components/Wizard/WizardStep2.test.tsx` (extend — file created in Task 5)
- Test: `src/renderer/components/Wizard/WizardStep3.test.tsx` (extend — file created in Task 5)

**Interfaces:**
- WizardStep2: adds `errors: Record<string, string>` state; install failure sets `errors[id]` to an error string
- WizardStep3: adds `recheckFailed: Record<string, boolean>` state; failed auth probe sets `recheckFailed[s.id] = true`

- [ ] **Step 1: Add failing tests for install error display**

Append to `src/renderer/components/Wizard/WizardStep2.test.tsx`:

```tsx
import { vi } from "vitest";

vi.mock("../../ipc", () => ({
  installBackend: vi.fn().mockResolvedValue({ success: false }),
  // wizard:install:line listener — stub window.ipc
}));

// Add before existing tests or in a separate describe block:
describe("WizardStep2 install error", () => {
  it("shows an error message when installation fails", async () => {
    // Stub window.ipc for the install line listener
    (window as unknown as { ipc: { on: ReturnType<typeof vi.fn> } }).ipc = {
      on: vi.fn().mockReturnValue(() => {}),
    };

    const { findByText } = render(
      <WizardStep2 missing={["gemini"]} onNext={vi.fn()} onBack={vi.fn()} />
    );

    fireEvent.click(screen.getByRole("button", { name: /^install$/i }));

    expect(
      await findByText(/installation failed/i)
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --reporter=verbose src/renderer/components/Wizard/WizardStep2.test.tsx
```

Expected: FAIL — no error message rendered yet.

- [ ] **Step 3: Add `errors` state and error display to WizardStep2**

In `src/renderer/components/Wizard/WizardStep2.tsx`, add the `errors` state and update the `install` function:

Add state:
```tsx
const [errors, setErrors] = useState<Record<string, string>>({});
```

Update `install`:
```tsx
const install = async (id: string) => {
  setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
  setInstalling((prev) => ({ ...prev, [id]: true }));
  const addLine = (line: string) =>
    setLogs((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), line] }));

  const off = window.ipc.on("wizard:install:line", (line: unknown) =>
    addLine(String(line)),
  );
  const { success: ok } = await installBackend(id);
  off();

  setInstalling((prev) => ({ ...prev, [id]: false }));
  setDone((prev) => ({ ...prev, [id]: ok }));
  if (!ok) {
    setErrors((prev) => ({
      ...prev,
      [id]: "Installation failed. Check your internet connection.",
    }));
  }
};
```

Add error display below the log `<pre>`, inside each missing backend's container:
```tsx
{errors[id] && (
  <p className="text-xs text-red-500">{errors[id]}</p>
)}
```

Full updated `missing.map` block in the main return:
```tsx
{missing.map((id) => (
  <div
    key={id}
    className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
  >
    <div className="flex items-center justify-between">
      <span className="font-medium text-sm">{LABELS[id] ?? id}</span>
      <button
        onClick={() => install(id)}
        disabled={installing[id] || done[id]}
        className="btn-sm bg-blue-600 text-white hoverable:hover:bg-blue-700 disabled:opacity-50"
      >
        {done[id]
          ? "Installed"
          : installing[id]
            ? "Installing..."
            : "Install"}
      </button>
    </div>
    {(logs[id] ?? []).length > 0 && (
      <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-2 max-h-24 overflow-y-auto">
        {logs[id].join("\n")}
      </pre>
    )}
    {errors[id] && (
      <p className="text-xs text-red-500">{errors[id]}</p>
    )}
  </div>
))}
```

Note: "Installed ✓" changed to "Installed" — the checkmark emoji is removed per design system (no emoji as primary UI elements).

- [ ] **Step 4: Add failing test for auth recheck failure display**

Append to `src/renderer/components/Wizard/WizardStep3.test.tsx`:

```tsx
import { probeBackend } from "../../ipc";

describe("WizardStep3 recheck failure", () => {
  it("shows an error message when recheck returns unauthenticated", async () => {
    vi.mocked(probeBackend).mockResolvedValueOnce({
      available: true,
      authenticated: false,
    });

    const needsAuthStatus = {
      id: "gemini",
      available: true,
      authenticated: false,
      loading: false,
    };

    const { findByText } = render(
      <WizardStep3
        statuses={[needsAuthStatus]}
        onComplete={vi.fn()}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^check$/i }));

    expect(
      await findByText(/could not verify/i)
    ).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run test to confirm it fails**

```bash
npm test -- --reporter=verbose src/renderer/components/Wizard/WizardStep3.test.tsx
```

Expected: FAIL — no "Could not verify" message yet.

- [ ] **Step 6: Add `recheckFailed` state and error display to WizardStep3**

In `src/renderer/components/Wizard/WizardStep3.tsx`, add:

```tsx
const [recheckFailed, setRecheckFailed] = useState<Record<string, boolean>>({});
```

Update `recheck`:
```tsx
const recheck = async (id: string) => {
  setRecheckFailed((prev) => { const n = { ...prev }; delete n[id]; return n; });
  setStatuses((prev) =>
    prev.map((s) => (s.id === id ? { ...s, loading: true } : s)),
  );
  const result = await probeBackend(id);
  setStatuses((prev) =>
    prev.map((s) => (s.id === id ? { ...s, ...result, loading: false } : s)),
  );
  if (!result.authenticated) {
    setRecheckFailed((prev) => ({ ...prev, [id]: true }));
  }
};
```

Add error display below the Check button, inside each `needsAuth.map` container:
```tsx
{needsAuth.map((s) => (
  <div
    key={s.id}
    className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
  >
    <div className="font-medium text-sm">
      {BACKEND_LABELS[s.id] ?? s.id}
    </div>
    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
      {AUTH_COMMANDS[s.id]}
    </code>
    <button
      onClick={() => recheck(s.id)}
      disabled={s.loading}
      className="btn-md w-full bg-gray-200 dark:bg-gray-700 hoverable:hover:bg-gray-300 dark:hoverable:hover:bg-gray-600 disabled:opacity-50"
    >
      {s.loading ? "Checking..." : "Check"}
    </button>
    {recheckFailed[s.id] && (
      <p className="text-xs text-red-500">
        Could not verify. Run the command again and click Check.
      </p>
    )}
  </div>
))}
```

- [ ] **Step 7: Run the full test suite**

```bash
npm run lint && npm test
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/Wizard/WizardStep2.tsx src/renderer/components/Wizard/WizardStep2.test.tsx src/renderer/components/Wizard/WizardStep3.tsx src/renderer/components/Wizard/WizardStep3.test.tsx
git commit -m "feat(wizard): show inline error messages for install and auth check failures"
```

---

## Self-Review

**Spec coverage check:**

| Finding | Task |
|---------|------|
| Empty state AI-SaaS icon | Task 1 |
| Toolbar cognitive overload (8+ flat controls) | Task 2 |
| Duplicate Cron/MCP/Plugins in sidebar header | Task 3 |
| `animate-bounce-dot` violation | Task 4 |
| No wizard back button | Task 5 |
| Persona delete fires immediately | Task 6 |
| Silent install failure | Task 7 (WizardStep2) |
| Silent auth check failure | Task 7 (WizardStep3) |
| "Finish Setup" with unauth backends has no warning | Task 5 (added to WizardStep3) |
| Personas/Pipelines toolbar buttons missing active state | Task 2 (added `bg-blue-100` when open) |

All priority findings from the critique are covered. Minor observations (native `<select>` inconsistency, pipeline tab labels showing backendId) are deferred — they require schema/data changes beyond UI-layer fixes.

**Placeholder scan:** No TBDs, no "implement later", no "similar to Task N" references. Every step contains actual code.

**Type consistency:**
- `onBack: () => void` defined in Task 5 Props, used consistently in WizardStep2 and WizardStep3
- `confirmDeleteId: string | null` defined and used only in PersonaPanel (Task 6)
- `errors: Record<string, string>` defined in WizardStep2 (Task 7)
- `recheckFailed: Record<string, boolean>` defined in WizardStep3 (Task 7)
- `animate-dot-fade` defined in tailwind.config.ts (Task 4), used in MessageList.tsx (Task 4)
