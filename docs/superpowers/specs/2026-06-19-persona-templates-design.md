# Persona Templates — Design Spec

**Date:** 2026-06-19
**Status:** Approved

---

## Overview

Extend the persona system with pre-built template personas that ship with the app. Each template defines a system prompt with `{{variable}}` placeholders. Users pick a template, fill in the variables, and get a concrete saved persona. This gives BII analysts and researchers an instant library of purpose-built personas without needing to write prompts from scratch.

---

## Data Model

Extended `Persona` type — all new fields optional/ nullable except for templates which require them:

```typescript
interface Persona {
  id: string
  name: string
  systemPrompt: string       // may contain {{variableName}} placeholders
  isDefault: boolean
  // new:
  isTemplate: boolean        // true for pre-seeded, false for user-created
  category: string | null    // "Research", "Analysis", "Writing", "General"
  description: string | null // one-liner shown in template picker
  variables: VariableDef[]   // metadata for UI input fields
}

interface VariableDef {
  name: string               // matches {{name}} in prompt
  label: string              // "Sector / Industry"
  placeholder: string        // "e.g. Financial Services"
  required: boolean
}
```

### DB changes (migration `004_persona_templates.sql`)

```sql
ALTER TABLE personas ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0;
ALTER TABLE personas ADD COLUMN category TEXT;
ALTER TABLE personas ADD COLUMN description TEXT;
ALTER TABLE personas ADD COLUMN variables TEXT NOT NULL DEFAULT '[]';
```

The `variables` column stores a JSON array of `VariableDef` objects.

---

## Seed Personas

Seeded unconditionally on first launch (via migration). Duplicate IDs are no-ops via `INSERT OR IGNORE`.

| Category | Name | Variables | Prompt |
|---|---|---|---|
| Research | Company Deep-Dive | `{{ticker}}` | "You are an equity research analyst. Analyze {{ticker}} covering: business overview, competitive positioning, financial health, growth catalysts, risks, and valuation. Support claims with specific data points." |
| Research | Sector Overview | `{{sector}}` | "You are a sector strategist. Provide a comprehensive overview of the {{sector}} sector: market size, growth trends, key players, regulatory environment, and investment themes over the next 12-24 months." |
| Analysis | Competitive Analysis | `{{company}}`, `{{competitors}}` | "You are a competitive strategy analyst. Compare {{company}} against {{competitors}}. Analyze: market share, product differentiation, moat, pricing power, R&D pipeline, and management quality. Identify who wins and why." |
| Analysis | Investment Memo | `{{company}}`, `{{thesis}}` | "You are an investment professional. Draft a structured investment memo for {{company}} with: thesis overview, investment rationale, catalysts, valuation analysis (DCF / comps), key risks, and recommended next steps." |
| Analysis | Deal Screener | `{{criteria}}` | "You are a deal sourcing analyst. Screen opportunities based on: {{criteria}}. For each, evaluate: strategic fit, return profile, risk level, and integration complexity. Rank by priority." |
| Writing | Memo Draft | `{{topic}}` | "You are a business writer. Draft a clear, concise memo on: {{topic}}. Use a structured format: summary, background, analysis, recommendation, next steps. Tone: professional, direct, neutral." |
| General | Critical Reviewer | (none) | "You are a skeptical reviewer. Your job is to stress-test arguments, surface hidden assumptions, identify logical gaps, and play devil's advocate. Be direct but constructive." |
| General | Plain Assistant | (none) | "You are a helpful assistant. Answer clearly and concisely." |

---

## Variable Resolution

When a user selects a template:

1. Modal/inline form renders one input per `VariableDef`
2. User fills in values; required fields validated before submit
3. On submit: `systemPrompt.replaceAll('{{' + v.name + '}}', value)` for each variable
4. Result saved as a new Persona record with `isTemplate=false`, `variables=[]`, `category=null`, `description=null`
5. The template record remains unchanged in the DB

No runtime resolution — the prompt is concrete at creation time. This avoids adapter-layer changes and prevents template edits from retroactively affecting existing personas.

---

## Persona Manager Changes

No new IPC channels. Reuse existing CRUD:

- Templates are seeded via migration — not through `persona:save`
- `persona:list` returns ALL personas (templates + user-created). Filter by `isTemplate` on the renderer side
- `persona:save` works identically — client sends fully resolved persona, store saves it

---

## UI Changes

All in `PersonaPanel.tsx`. No new components, no routing changes.

**Layout:**
- Top section: "Templates" header with category-grouped accordion
- Each template row: name + description + "Create from this" button
  - Clicking shows inline variable form (replaces current edit form pattern)
- Separator line
- Bottom section: user-created personas list (same as today)
  - Existing "No persona" row + list + "New" button unchanged

**Inline variable form:**
- One `<input>` per `VariableDef` with label and placeholder
- Prompt field is NOT shown (it's assembled from template)
- "Create Persona" + "Cancel" buttons
- On create: resolves variables, saves, closes form

---

## Implementation Order

1. Migration `004_persona_templates.sql` — add columns, seed templates
2. Update `Persona` type in `src/shared/types.ts` — add new fields
3. Update `rowToPersona` in `src/main/store/index.ts` — read new columns
4. Update `PersonaPanel.tsx` — template section + variable form
5. Update tests

---

## Out of Scope

- Variable autocomplete/suggestions
- User-created templates (cloning a template into another template)
- Variable type validation beyond required/optional
