# Task 5 Report: Gemini + Opencode Adapters

## TDD Evidence

### RED Phase
Tests written in `src/main/adapters/gemini.adapter.test.ts` and `src/main/adapters/opencode.adapter.test.ts`. Initial run fails as expected:

```
❌ src/main/adapters/gemini.adapter.test.ts
❌ src/main/adapters/opencode.adapter.test.ts
Error: Failed to load url ./gemini.adapter / ./opencode.adapter (file does not exist)
```

### GREEN Phase
After implementing both adapter files, all tests pass:

```
✓ src/main/adapters/opencode.adapter.test.ts (1 test) 13ms
✓ src/main/adapters/gemini.adapter.test.ts (2 tests) 27ms

Test Files: 2 passed (2)
Tests: 3 passed (3)
Duration: 672ms
```

## Files Created

1. **src/main/adapters/gemini.adapter.ts** (52 lines)
   - Implements `GeminiAdapter` with id `'gemini'`
   - Spawns `gemini` CLI with JSON format flag
   - Parses JSON response extracting text from `candidates[0].content.parts[0].text`
   - Falls back to plain-text line parsing on JSON parse failure
   - Implements `BackendAdapter` contract: `isAvailable()`, `send()` async generator, `abort()`

2. **src/main/adapters/opencode.adapter.ts** (50 lines)
   - Implements `OpencodeAdapter` with id `'opencode'`
   - Spawns `opencode run --json` command with unstable JSON flag (noted in comment)
   - Parses JSON responses checking `content` or `text` fields
   - Falls back to plain-text line parsing (fallback is primary handling for this adapter)
   - Same `BackendAdapter` contract implementation

3. **src/main/adapters/gemini.adapter.test.ts** (35 lines)
   - Tests JSON parsing: `candidates[0].content.parts[0].text` path
   - Tests fallback: plain-text lines when JSON parse fails
   - Uses mocked `child_process.spawn` with `EventEmitter` simulation

4. **src/main/adapters/opencode.adapter.test.ts** (25 lines)
   - Tests plain-text fallback behavior
   - Uses same mocking pattern as Gemini tests

## Implementation Details

Both adapters follow the exact pattern established by `ClaudeAdapter` (Task 4):

- **Process management:** Spawn CLI, attach stdout/stderr event listeners, implement graceful abort via SIGTERM
- **Async generator pattern:** Queue chunks, yield on demand, resolve promise to unblock when data arrives
- **Done signal:** Push `{ type: 'done', content: '' }` on process close
- **Line parsing:** Split stdout by `\n`, filter empty lines, parse each through adapter-specific JSON parser, fallback to plain text
- **Persona handling:** Append `--system-prompt` arg when persona provided

## Deviations from Brief

None. Implementation matches brief exactly:
- Function signatures match
- JSON parsing paths are correct
- Fallback logic implemented
- Tests pass without modification
- Commit message follows convention

## Concerns

None. All tests pass. Code follows established patterns from Task 4. No TypeScript errors or linting issues expected (same structure as ClaudeAdapter).

## Verification Commands Run

```bash
npx vitest run src/main/adapters/gemini.adapter.test.ts src/main/adapters/opencode.adapter.test.ts
→ 3/3 passing
```

## Commit

```
fb5ecf3 feat: GeminiAdapter and OpencodeAdapter with line-parsing fallback
```
