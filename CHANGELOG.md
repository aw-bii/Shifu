# Changelog

## [0.2.0] — 2026-06-25

### Bug Fixes
- Panels (Personas, Pipelines, Settings) now properly collapse to zero width — chat area fills available space when panels are closed
- Close button added to Personas and Pipelines panels
- Wizard sign-in instructions are hidden when all tools are already authenticated
- Backend switcher warns you when the selected backend needs sign-in before use
- Security dialogs correctly re-focus on the first button when multiple alerts arrive in sequence
- Settings panel loads gracefully even if individual IPC calls fail on startup
- Pipeline security events reach the renderer even after a window reload mid-run
- Conversation search no longer fires a stale setState after the component unmounts
- Wizard install output lines carry the backend id so the renderer can route them correctly

### Performance
- Search results update after you pause typing (300 ms debounce) — not on every keystroke
- Settings panel fetches all data in one parallel round-trip instead of four sequential ones
- Message bubbles skip re-renders when only unrelated fields change; attachment cache is bounded at 100 entries
- Message list skips re-renders on unrelated parent updates
- Backend availability and auth checks run in parallel per adapter

### Accessibility
- All toolbar buttons have accessible labels (`aria-label`) and toggle state (`aria-pressed`)
- Press F2 on a conversation to enter rename mode from the keyboard
- Only one of Send / Stop exists in the DOM at a time — screen readers no longer see a hidden duplicate button
- Focus is trapped inside security alert dialogs and returns to the first button when a new alert arrives
- Pipeline step tabs use `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`
- A skip-to-main-content link is visible on keyboard focus at the top of the app
- Streaming assistant responses are announced to screen readers via a `role="status"` live region
- Message bubbles carry `role="article"` with an accessible label; timestamps use a `<time>` element
- Interactive persona items are native `<button>` elements instead of `div role="button"`

### Design System
- All component colors now use CSS custom property tokens (`--c-primary`, `--c-bubble`, etc.)
- Tailwind semantic utility classes registered: `bg-primary`, `bg-bubble`, `text-text-muted`, `border-border`, and more
- Dark mode handled by CSS variable flipping in `.dark` — no more paired `dark:` Tailwind variants

### Responsive
- Sidebar panels clamp to `min(Npx, 80vw)` — never overflow on narrow viewports
- Toolbar wraps to a second row on small screens instead of scrolling horizontally
- Long-press (600 ms) on a conversation triggers rename on touch devices
- Input textarea height caps at `min(10rem, 40vh)` — shrinks proportionally on mobile
- Touch targets meet the 44 px minimum on coarse-pointer devices

## [0.1.0] — 2026-06-17

Initial release.
