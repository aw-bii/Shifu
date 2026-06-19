# Persona Templates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship persona templates with variable placeholders — 8 pre-built research/analysis personas that seed on first launch.

**Architecture:** Extends the existing `personas` table with 4 new columns. Templates are seeded via migration SQL. The `Persona` type gains `isTemplate`, `category`, `description`, `variables`. UI in PersonaPanel adds a "Templates" section; picking a template opens a variable-fill form that resolves `{{var}}` placeholders into a concrete persona.

**Tech Stack:** SQLite (better-sqlite3), React + TypeScript, Tailwind CSS

---

### Task 1: Migration — add columns + seed templates

**Files:**
- Create: `src/main/store/migrations/004_persona_templates.sql`
- Modify: `src/main/store/index.ts` (rowToPersona reads new columns)

- [ ] **Step 1: Write the migration SQL**

```sql
-- 004_persona_templates.sql
ALTER TABLE personas ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0;
ALTER TABLE personas ADD COLUMN category TEXT;
ALTER TABLE personas ADD COLUMN description TEXT;
ALTER TABLE personas ADD COLUMN variables TEXT NOT NULL DEFAULT '[]';

-- Seed templates (INSERT OR IGNORE so re-running migration is safe)
INSERT OR IGNORE INTO personas (id, name, system_prompt, is_default, is_template, category, description, variables) VALUES
('tmpl-deep-dive', 'Company Deep-Dive', 'You are an equity research analyst. Analyze {{ticker}} covering: business overview, competitive positioning, financial health, growth catalysts, risks, and valuation. Support claims with specific data points.', 0, 1, 'Research', 'Comprehensive financial analysis of a single company', '[{"name":"ticker","label":"Ticker","placeholder":"e.g. AAPL, GOOGL, MSFT","required":true}]'),
('tmpl-sector-overview', 'Sector Overview', 'You are a sector strategist. Provide a comprehensive overview of the {{sector}} sector: market size, growth trends, key players, regulatory environment, and investment themes over the next 12-24 months.', 0, 1, 'Research', 'Market structure and trends across an industry sector', '[{"name":"sector","label":"Sector","placeholder":"e.g. Semiconductor, Fintech, Healthcare","required":true}]'),
('tmpl-competitive-analysis', 'Competitive Analysis', 'You are a competitive strategy analyst. Compare {{company}} against {{competitors}}. Analyze: market share, product differentiation, moat, pricing power, R&D pipeline, and management quality. Identify who wins and why.', 0, 1, 'Analysis', 'Head-to-head company comparison with strategic assessment', '[{"name":"company","label":"Company","placeholder":"e.g. Tesla","required":true},{"name":"competitors","label":"Competitors","placeholder":"e.g. BYD, Rivian, Lucid","required":true}]'),
('tmpl-investment-memo', 'Investment Memo', 'You are an investment professional. Draft a structured investment memo for {{company}} with: thesis overview, investment rationale, catalysts, valuation analysis (DCF / comps), key risks, and recommended next steps.', 0, 1, 'Analysis', 'Structured memo with thesis, valuation, and risks', '[{"name":"company","label":"Company","placeholder":"e.g. Airbnb","required":true},{"name":"thesis","label":"Investment Thesis","placeholder":"e.g. AI-driven margin expansion","required":true}]'),
('tmpl-deal-screener', 'Deal Screener', 'You are a deal sourcing analyst. Screen opportunities based on: {{criteria}}. For each, evaluate: strategic fit, return profile, risk level, and integration complexity. Rank by priority.', 0, 1, 'Analysis', 'Screen opportunities against custom criteria', '[{"name":"criteria","label":"Screening Criteria","placeholder":"e.g. B2B SaaS, >$10M ARR, US-based","required":true}]'),
('tmpl-memo-draft', 'Memo Draft', 'You are a business writer. Draft a clear, concise memo on: {{topic}}. Use a structured format: summary, background, analysis, recommendation, next steps. Tone: professional, direct, neutral.', 0, 1, 'Writing', 'Professional business memo on any topic', '[{"name":"topic","label":"Topic","placeholder":"e.g. Q3 hiring plan","required":true}]'),
('tmpl-critical-reviewer', 'Critical Reviewer', 'You are a skeptical reviewer. Your job is to stress-test arguments, surface hidden assumptions, identify logical gaps, and play devil''s advocate. Be direct but constructive.', 0, 1, 'General', 'Stress-test arguments and surface hidden assumptions', '[]'),
('tmpl-plain-assistant', 'Plain Assistant', 'You are a helpful assistant. Answer clearly and concisely.', 0, 1, 'General', 'Neutral general-purpose assistant (default)', '[]');
```

- [ ] **Step 2: Verify migration loads in test**

Run: `npx vitest run src/main/store/index.test.ts --reporter verbose`
Expected: All tests pass (migration runs automatically via `initDb`)

- [ ] **Step 3: Update rowToPersona in store/index.ts**

After the existing `rowToPersona` function at line 218, update it to read new columns:

```typescript
function rowToPersona(r: any): Persona {
  return {
    id: r.id,
    name: r.name,
    systemPrompt: r.system_prompt,
    isDefault: r.is_default === 1,
    isTemplate: r.is_template === 1,
    category: r.category ?? null,
    description: r.description ?? null,
    variables: JSON.parse(r.variables ?? '[]'),
  }
}
```

- [ ] **Step 4: Run tests to confirm no regressions**

Run: `npx vitest run src/main/store/index.test.ts --reporter verbose`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/main/store/migrations/004_persona_templates.sql src/main/store/index.ts
git commit -m "feat: persona template columns and seed data"
```

---

### Task 2: Update Persona type and IPC types

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc.ts`

- [ ] **Step 1: Add VariableDef type and extend Persona**

In `src/shared/types.ts`, add before the `Persona` interface:

```typescript
export interface VariableDef {
  name: string
  label: string
  placeholder: string
  required: boolean
}
```

Update the `Persona` interface to add:

```typescript
export interface Persona {
  id: string
  name: string
  systemPrompt: string
  isDefault: boolean
  isTemplate: boolean
  category: string | null
  description: string | null
  variables: VariableDef[]
}
```

- [ ] **Step 2: Update IPC invoke type for PERSONA_SAVE**

In `src/shared/ipc.ts`, update the PERSONA_SAVE entry to accept the new fields:

```typescript
[IPC.PERSONA_SAVE]: { id?: string; name: string; systemPrompt: string; isDefault: boolean; isTemplate?: boolean; category?: string | null; description?: string | null; variables?: import('./types').VariableDef[] }
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts src/shared/ipc.ts
git commit -m "feat: extend Persona type with template fields and VariableDef"
```

---

### Task 3: Update store createPersona to handle new fields

**Files:**
- Modify: `src/main/store/index.ts`

- [ ] **Step 1: Update createPersona INSERT to include new columns**

Update the INSERT in `createPersona` (around line 58):

```typescript
createPersona(p: Omit<Persona, 'id'>): Persona {
  const db = getDb()
  const id = crypto.randomUUID()
  if (p.isDefault) db.prepare('UPDATE personas SET is_default = 0').run()
  db.prepare(`INSERT INTO personas (id, name, system_prompt, is_default, is_template, category, description, variables)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, p.name, p.systemPrompt, p.isDefault ? 1 : 0, p.isTemplate ? 1 : 0, p.category ?? null, p.description ?? null, JSON.stringify(p.variables ?? []))
  return { id, ...p }
}
```

- [ ] **Step 2: Update updatePersona to handle new fields**

Add to the update sequence (around line 67, after existing field updates):

```typescript
if (p.isTemplate !== undefined) db.prepare('UPDATE personas SET is_template = ? WHERE id = ?').run(p.isTemplate ? 1 : 0, id)
if (p.category !== undefined) db.prepare('UPDATE personas SET category = ? WHERE id = ?').run(p.category, id)
if (p.description !== undefined) db.prepare('UPDATE personas SET description = ? WHERE id = ?').run(p.description, id)
if (p.variables !== undefined) db.prepare('UPDATE personas SET variables = ? WHERE id = ?').run(JSON.stringify(p.variables), id)
```

- [ ] **Step 3: Update persona test to verify template fields round-trip**

In `src/main/store/index.test.ts`, update the existing persona test at line 62:

```typescript
describe('ConvStore persona methods', () => {
  it('creates, lists, and marks default persona', () => {
    ConvStore.createPersona({ name: 'Coder', systemPrompt: 'You are a coder.', isDefault: false, isTemplate: false, category: null, description: null, variables: [] })
    const p2 = ConvStore.createPersona({ name: 'Writer', systemPrompt: 'You write.', isDefault: true, isTemplate: false, category: null, description: null, variables: [] })
    const personas = ConvStore.listPersonas()
    expect(personas).toHaveLength(2)
    expect(ConvStore.getDefaultPersona()?.id).toBe(p2.id)
  })

  it('creates and retrieves template persona with variables', () => {
    const t = ConvStore.createPersona({
      name: 'Deep-Dive Template',
      systemPrompt: 'Analyze {{ticker}}',
      isDefault: false,
      isTemplate: true,
      category: 'Research',
      description: 'Company analysis',
      variables: [{ name: 'ticker', label: 'Ticker', placeholder: 'AAPL', required: true }],
    })
    expect(t.isTemplate).toBe(true)
    expect(t.category).toBe('Research')
    expect(t.variables).toHaveLength(1)
    expect(t.variables[0].name).toBe('ticker')

    const loaded = ConvStore.listPersonas().find(p => p.id === t.id)!
    expect(loaded.isTemplate).toBe(true)
    expect(loaded.variables[0].label).toBe('Ticker')
  })
})
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/main/store/index.test.ts --reporter verbose`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/main/store/index.ts src/main/store/index.test.ts
git commit -m "feat: store supports template fields in create/update persona"
```

---

### Task 4: PersonaPanel — templates section UI

**Files:**
- Modify: `src/renderer/components/Personas/PersonaPanel.tsx`

- [ ] **Step 1: Add template section with accordion**

The existing panel shows "No persona" then the user's personas. Above that, add a "Templates" section grouped by category. Replace the file content:

```typescript
import { useState, useMemo } from 'react'
import { usePersonas } from '../../hooks/usePersonas'
import type { Persona, VariableDef } from '../../../shared/types'

interface Props {
  activePersonaId: string | null
  onSelect: (id: string | null) => void
}

export function PersonaPanel({ activePersonaId, onSelect }: Props) {
  const { personas, save, remove } = usePersonas()
  const [editing, setEditing] = useState<Partial<Persona> | null>(null)
  const [creatingFromTemplate, setCreatingFromTemplate] = useState<Persona | null>(null)
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})

  const templates = useMemo(() => personas.filter(p => p.isTemplate), [personas])
  const userPersonas = useMemo(() => personas.filter(p => !p.isTemplate), [personas])

  const categories = useMemo(() => {
    const map = new Map<string, Persona[]>()
    for (const t of templates) {
      const cat = t.category ?? 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(t)
    }
    return Array.from(map.entries())
  }, [templates])

  const startNew = () => setEditing({ name: '', systemPrompt: '', isDefault: false, isTemplate: false, variables: [], category: null, description: null })
  const cancel = () => { setEditing(null); setCreatingFromTemplate(null); setVariableValues({}) }

  const submit = async () => {
    if (!editing?.name) return
    await save({
      name: editing.name!,
      systemPrompt: editing.systemPrompt ?? '',
      isDefault: editing.isDefault ?? false,
      isTemplate: editing.isTemplate ?? false,
      variables: editing.variables ?? [],
      category: editing.category ?? null,
      description: editing.description ?? null,
      ...(editing.id ? { id: editing.id } : {}),
    })
    setEditing(null)
  }

  const startTemplateCreate = (t: Persona) => {
    setCreatingFromTemplate(t)
    const initial: Record<string, string> = {}
    for (const v of t.variables) initial[v.name] = ''
    setVariableValues(initial)
  }

  const submitFromTemplate = async () => {
    if (!creatingFromTemplate) return
    let resolved = creatingFromTemplate.systemPrompt
    for (const v of creatingFromTemplate.variables) {
      resolved = resolved.replaceAll(`{{${v.name}}}`, variableValues[v.name] ?? '')
    }
    await save({
      name: creatingFromTemplate.name,
      systemPrompt: resolved,
      isDefault: false,
      isTemplate: false,
      variables: [],
      category: null,
      description: null,
    })
    setCreatingFromTemplate(null)
    setVariableValues({})
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Personas</h3>
        <button onClick={startNew} className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">+ New</button>
      </div>

      {/* Templates section */}
      {categories.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs text-gray-400 font-medium uppercase tracking-wider">Templates</h4>
          {categories.map(([cat, catTemplates]) => (
            <details key={cat} className="group" open>
              <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">{cat}</summary>
              <div className="flex flex-col gap-1 mt-1">
                {catTemplates.map(t => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => startTemplateCreate(t)}
                  >
                    <div>
                      <div className="font-medium">{t.name}</div>
                      {t.description && <div className="text-xs text-gray-400">{t.description}</div>}
                    </div>
                    <span className="text-xs text-blue-500 shrink-0">Create</span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}

      {/* Template variable fill form */}
      {creatingFromTemplate && (
        <div className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="text-sm font-medium">Create from: {creatingFromTemplate.name}</div>
          {creatingFromTemplate.description && (
            <div className="text-xs text-gray-400">{creatingFromTemplate.description}</div>
          )}
          {creatingFromTemplate.variables.map(v => (
            <div key={v.name} className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">{v.label}{v.required && ' *'}</label>
              <input
                className="text-sm border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
                placeholder={v.placeholder}
                value={variableValues[v.name] ?? ''}
                onChange={e => setVariableValues(prev => ({ ...prev, [v.name]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <button
              onClick={submitFromTemplate}
              className="flex-1 text-sm py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={creatingFromTemplate.variables.some(v => v.required && !variableValues[v.name])}
            >
              Create Persona
            </button>
            <button onClick={cancel} className="flex-1 text-sm py-1 rounded border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">Cancel</button>
          </div>
        </div>
      )}

      {/* Separator */}
      {userPersonas.length > 0 && <div className="border-t border-gray-200 dark:border-gray-700" />}

      {/* User personas */}
      <div
        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm ${activePersonaId === null ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
        onClick={() => onSelect(null)}
      >
        <span>No persona</span>
      </div>

      {userPersonas.map(p => (
        <div
          key={p.id}
          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm ${activePersonaId === p.id ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          onClick={() => onSelect(p.id)}
        >
          <div>
            <div className="font-medium">{p.name}</div>
            {p.isDefault && <div className="text-xs text-blue-500">default</div>}
          </div>
          <div className="flex gap-1">
            <button onClick={e => { e.stopPropagation(); setEditing(p) }} className="text-xs text-gray-400 hover:text-gray-700 px-1">Edit</button>
            <button onClick={e => { e.stopPropagation(); remove(p.id) }} className="text-xs text-red-400 hover:text-red-600 px-1">Del</button>
          </div>
        </div>
      ))}

      {/* New/edit persona form */}
      {editing && !creatingFromTemplate && (
        <div className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <input
            className="text-sm border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
            placeholder="Name"
            value={editing.name ?? ''}
            onChange={e => setEditing(prev => ({ ...prev, name: e.target.value }))}
          />
          <textarea
            className="text-sm border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 resize-none"
            placeholder="System prompt..."
            rows={3}
            value={editing.systemPrompt ?? ''}
            onChange={e => setEditing(prev => ({ ...prev, systemPrompt: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.isDefault ?? false} onChange={e => setEditing(prev => ({ ...prev, isDefault: e.target.checked }))} />
            Set as default
          </label>
          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 text-sm py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
            <button onClick={cancel} className="flex-1 text-sm py-1 rounded border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -30`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Personas/PersonaPanel.tsx
git commit -m "feat: persona templates UI with variable fill form"
```

---

### Task 5: Full integration test

- [ ] **Step 1: Run all tests**

Run: `npx vitest run --reporter verbose`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "chore: fix lint and type issues for persona templates"
```
