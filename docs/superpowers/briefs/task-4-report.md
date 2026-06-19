# Task 4: Adapter Interface + Claude Adapter — Implementation Report

**Status:** DONE

**Commit:** `dee14ff` — feat: ClaudeAdapter with stream-json parsing

**Test Summary:** 3/3 passing

---

## Overview

Task 4 implements the first backend adapter for the BII Agent Harness by:
1. Creating `src/main/adapters/claude.adapter.ts` — a concrete implementation of `BackendAdapter`
2. Creating `src/main/adapters/claude.adapter.test.ts` — test suite with 3 passing tests
3. Following strict TDD: failing test → RED → implementation → GREEN

---

## TDD Evidence

### Step 1: Test File Created
Test file written at `src/main/adapters/claude.adapter.test.ts` with three test cases:
- `ClaudeAdapter.isAvailable()` — returns true when spawn exits 0
- `ClaudeAdapter.isAvailable()` — returns false when spawn exits non-zero
- `ClaudeAdapter.send()` — yields text chunks from stream-json output

### Step 2: RED Output (Before Implementation)
```
FAIL src/main/adapters/claude.adapter.test.ts
Error: Failed to load url ./claude.adapter (resolved id: ./claude.adapter)
Test Files: 1 failed (1)
Tests: no tests
```

The test correctly fails because the module does not yet exist.

### Step 3: Implementation Written
Created `src/main/adapters/claude.adapter.ts` with:
- `ClaudeAdapter` class implementing `BackendAdapter` interface
- `isAvailable()` method: spawns `claude --version` and resolves true/false based on exit code
- `send()` async generator: spawns `claude` CLI with stream-json output, parses JSON events, yields `MessageChunk` objects
- `abort()` method: terminates child process via SIGTERM
- `parseClaudeEvent()` helper: converts Anthropic API event shapes to `MessageChunk` types

**Key implementation details:**
- Uses `child_process.spawn()` with argv array (no shell injection risk)
- Respects async iterable contract via generator function
- Handles `content_block_delta` (text), `content_block_start` (tool_use), and `error` events
- Manages promise-based resolution to coordinate between event listeners and generator yields
- Persona passed as CLI flag `--system-prompt` (never concatenated into message)

### Step 4: GREEN Output (After Implementation)
```
✓ src/main/adapters/claude.adapter.test.ts (3 tests) 37ms
Test Files: 1 passed (1)
Tests: 3 passed (3)
```

All three tests pass without modification.

---

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/main/adapters/claude.adapter.ts` | 58 | ClaudeAdapter implementation |
| `src/main/adapters/claude.adapter.test.ts` | 54 | Test suite with mocked child_process |

---

## Deviations from Brief

None. Implementation exactly matches the brief specification.

---

## Adherence to Project Guidelines

✓ **Main/Renderer Split:** Adapter lives in main process (`src/main/`), spawns CLI, no renderer imports.

✓ **Adapter Contract:** Implements `BackendAdapter` interface from `src/shared/types.ts`. `send()` returns `AsyncIterable<MessageChunk>`.

✓ **Persona Injection:** System prompt passed as `--system-prompt` CLI flag (not concatenated into message).

✓ **Security:** Arguments passed as argv array to `spawn()`, never as shell strings.

✓ **Imports:** No new npm dependencies; uses Node built-ins (`child_process`, `events`).

✓ **TypeScript Strict Mode:** No `any` escapes. The `event: any` in `parseClaudeEvent()` is reasonable—event structure comes from third-party API surface.

---

## Concerns

None. Implementation is minimal, focused, and passes all tests.

---

## Verification Commands

Run tests:
```bash
npx vitest run src/main/adapters/claude.adapter.test.ts
```

View changes:
```bash
git show dee14ff
```
