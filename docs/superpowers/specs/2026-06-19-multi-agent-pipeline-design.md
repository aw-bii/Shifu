# Multi-Agent Pipeline — Design Spec

**Date:** 2026-06-19
**Status:** Approved

---

## Overview

Adds named, reusable pipeline templates to BII Agent Harness. A pipeline is an ordered list of (backend, persona) steps that run sequentially: each step receives the prior step's accumulated output as its input. The user picks a template at conversation start; execution is fully automatic once the first message is sent.

This is a clean extension of the existing adapter pattern. The main process owns all CLI orchestration; the renderer stays dumb.

---

## Architecture

```text
Renderer                          Main Process
--------                          ------------
PipelinePanel  ──pipeline:save──► ConvStore (pipeline_templates, pipeline_steps)
               ──pipeline:list──►
               ──pipeline:run───► PipelineRunner
                                       │
                               step 0: ClaudeAdapter.send()
                                       │ chunks ──pipeline:chunk(stepIndex:0)──► ChatView
                               step 1: GeminiAdapter.send(accumulated text)
                                       │ chunks ──pipeline:chunk(stepIndex:1)──► ChatView
                                       │
                               ──pipeline:done──────────────────────────────► ChatView
```

---

## Data Model

### New tables

```sql
CREATE TABLE pipeline_templates (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER
);

CREATE TABLE pipeline_steps (
  id           TEXT PRIMARY KEY,
  template_id  TEXT REFERENCES pipeline_templates(id) ON DELETE CASCADE,
  step_order   INTEGER NOT NULL,
  backend_id   TEXT NOT NULL,
  persona_id   TEXT REFERENCES personas(id) ON DELETE SET NULL
);
```

### Modified tables

**`conversations`** — add nullable column:
```sql
ALTER TABLE conversations ADD COLUMN pipeline_template_id TEXT REFERENCES pipeline_templates(id);
```
Null = regular single-backend conversation (unchanged). Non-null = pipeline conversation.

**`messages`** — add nullable column:
```sql
ALTER TABLE messages ADD COLUMN step_index INTEGER;
```
Null for regular conversations. 0, 1, 2… for pipeline conversations. Required to reconstruct per-tab history on reload.

### Migration

Added as migration in `src/main/store/migrations/` following the existing migration runner pattern.

---

## PipelineRunner Service

**File:** `src/main/pipeline/runner.ts`

```typescript
interface PipelineChunk extends MessageChunk {
  stepIndex: number
}

interface PipelineStep {
  adapterId: string
  persona?: string  // resolved system prompt text
}

class PipelineRunner {
  run(params: {
    conversationId: string
    userMessage: string
    steps: PipelineStep[]
    onChunk: (chunk: PipelineChunk) => void
    onStepDone: (stepIndex: number) => void
  }): Promise<void>

  abort(conversationId: string): void
}
```

**Execution flow:**
1. Step 0 receives the original user message.
2. Chunks stream out via `onChunk` tagged `stepIndex: 0`.
3. Chunks are accumulated in memory into a full response string.
4. On step N done, `onStepDone(N)` fires; accumulated text becomes the input to step N+1.
5. Repeat until all steps complete.
6. `abort()` calls the current step's adapter's `abort()` and breaks the loop — no further steps run, partial results are preserved.

**Error handling:**
If a step's adapter throws or emits an error chunk, the runner emits a final error chunk tagged with the failing `stepIndex` and stops. Subsequent steps do not run. Completed step tabs remain readable.

---

## IPC Channels

Added to `src/shared/ipc.ts`:

| Channel | Direction | Payload |
|---|---|---|
| `pipeline:list` | Renderer → Main | — |
| `pipeline:save` | Renderer → Main | `PipelineTemplate` (with steps array) |
| `pipeline:delete` | Renderer → Main | `{ id }` |
| `pipeline:run` | Renderer → Main | `{ conversationId, message, templateId }` |
| `pipeline:chunk` | Main → Renderer | `PipelineChunk` (MessageChunk + stepIndex) |
| `pipeline:step-done` | Main → Renderer | `{ conversationId, stepIndex }` |
| `pipeline:done` | Main → Renderer | `{ conversationId }` |
| `pipeline:abort` | Renderer → Main | `{ conversationId }` |

Existing `chat:send / chat:chunk / chat:done / chat:abort` channels are unchanged. Single-backend and pipeline conversations use entirely separate code paths.

**IPC handler resolution:** The `pipeline:run` handler in `src/main/ipc.ts` is responsible for resolving `templateId` → steps before calling `PipelineRunner`. It fetches steps from `ConvStore`, looks up each step's persona system prompt, and passes a fully resolved `PipelineStep[]` to the runner. The runner itself knows nothing about the database.

**Validation:** The `pipeline:run` handler rejects with an error if the resolved step count is fewer than 2. The UI enforces the same minimum at template creation time.

---

## UI

### Starting a pipeline conversation

The new conversation flow gets a mode toggle: **Single backend** (default, current behavior) or **Pipeline**. In Pipeline mode, the backend switcher is hidden and replaced by a template picker dropdown. The conversation is created with `pipeline_template_id` set.

### Chat view — step tabs

A tab bar appears above the message list for pipeline conversations. One tab per step, labelled `Backend / Persona` (e.g. "Claude / Researcher", "Gemini / Critic"). Behavior:

- The active (currently streaming) step's tab shows a muted activity indicator.
- Completed steps are clickable — switching tabs filters the message list to `step_index = N`.
- The input bar is locked while the pipeline is running.
- The Stop button aborts the entire pipeline (no partial re-run).

### Pipeline template management

A **Pipelines** section in the right-hand panel (same panel as Personas), following the same visual pattern: list of templates, inline edit form below the list. No new panel or modal.

Creating/editing a template:
- Name field.
- Ordered list of steps; each step has a backend picker and a persona picker (optional).
- Up/down arrows to reorder steps.
- Minimum 2 steps enforced in the UI.

### Conversation sidebar

Pipeline conversations show a small chain icon alongside the title to distinguish them from single-backend conversations.

---

## Testing

- **`PipelineRunner` unit tests** (`src/main/pipeline/runner.test.ts`): mock adapters, verify step sequencing, verify accumulated text passes correctly as input to each step, verify abort stops after current step.
- **`ConvStore` tests**: new assertions for pipeline template CRUD, `step_index` column on messages.
- **Existing tests**: no changes to adapter or single-backend IPC tests.

---

## Out of Scope

- Mixing single-backend and pipeline messages within one conversation.
- Per-step abort (abort stops the whole pipeline).
- Pipeline templates shared across users.
- More than one pipeline running concurrently per session.
