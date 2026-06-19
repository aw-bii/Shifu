# Task 3 Report: Database Layer

## Status: DONE

## Commit
- `085ded0` feat: SQLite ConvStore with migrations and FTS5 search

## Files Created
- `src/main/store/migrations/001_initial.sql` — SQL schema: conversations, personas, messages tables + FTS5 virtual table + 3 sync triggers
- `src/main/store/db.ts` — initDb/getDb/closeDb with WAL pragma, foreign keys ON, migration runner
- `src/main/store/index.ts` — ConvStore with all 10 required methods
- `src/main/store/index.test.ts` — 4 test suites as specified in brief (plus closeDb() in afterEach for Windows WAL lock)

## TDD Evidence

### RED (before implementation — missing ./db module)
```
FAIL src/main/store/index.test.ts
Error: Failed to load url ./db (resolved id: ./db) in src/main/store/index.test.ts. Does the file exist?
Tests: no tests
```

### Intermediate RED (after db.ts + index.ts, before better-sqlite3 compiled)
```
FAIL src/main/store/index.test.ts (4 tests | 4 failed)
→ Could not locate the bindings file.
→ ENOENT: no such file or directory, unlink ...
Tests: 4 failed
```

### GREEN (after npm rebuild + closeDb fix)
```
✓ src/main/store/index.test.ts (4 tests) 39ms
Test Files: 1 passed (1)
Tests: 4 passed (4)
Duration: 699ms (transform 38ms, setup 0ms, collect 59ms, tests 39ms)
```

## Test Summary
4/4 passing, output pristine.

## Deviations from Brief

### 1. better-sqlite3 upgraded v9.4.3 → v12.11.1
The installed v9.4.3 failed to compile against Node 24 (error: `C++20 or later required` from MSBuild despite binding.gyp specifying `/std:c++20` — node-gyp 12 override). `npm install better-sqlite3@latest` pulled v12.11.1 which compiled cleanly via `npm rebuild`. package.json version bumped accordingly.

### 2. closeDb() added to db.ts; test afterEach updated
On Windows with WAL journal mode, SQLite holds a file lock until `db.close()` is called. The brief's test `afterEach` calls `fs.unlinkSync(dbPath)` directly, which throws `EBUSY` on Windows. Added `closeDb()` export to `db.ts` and added it to `afterEach` in the test before the unlink. All 4 test assertions from the brief are preserved verbatim.

### 3. __dirname resolution — no change needed
`__dirname` resolved correctly during Vitest runs: Vite transforms the TypeScript source in-place so `__dirname` points to `src/main/store/` where the `migrations/` folder lives. No fallback path needed.

## Code Review Fixes

### Finding #2: updatePersona non-null assertion guard

- **Commit:** `670c462` fix: guard updatePersona against missing id; document db singleton limitation
- **Change:** Replaced `return ConvStore.listPersonas().find(x => x.id === id)!` with explicit error guard: `if (!result) throw new Error(\`Persona not found: ${id}\`)`
- **Rationale:** Prevents confusing TypeError when persona lookup fails; explicit error message aids debugging

### Finding #3: Module-level db singleton warning

- **Commit:** `670c462` (same)
- **Change:** Added comment above `let db: Database.Database`: "Module-level singleton — not safe for parallel test workers; tests must call initDb() per suite"
- **Rationale:** Flags known limitation for maintainers; prevents accidental parallelization that would break tests

### Test Result

✓ All 4 tests in `src/main/store/index.test.ts` pass (43ms)
