# Bible Notes Website & Sync App — Implementation Plan

## Implementation Order & Dependency Map

The 11 changes group into 4 phases based on dependencies and risk:

- **Phase A (Foundation):** Items 8, 10, 9 — Global tooltip, hover animations, iOS polish. These establish shared infrastructure that later phases consume.
- **Phase B (Fixes):** Items 1, 2, 3 — BG scraping fix, BG credentials, accordion/button fix. Standalone Electron + website bug fixes.
- **Phase C (Redesigns):** Items 5, 4, 7 — Dark mode 3-way toggle, heatmap redesign, sync output redesign. Each is self-contained.
- **Phase D (Major):** Items 6, 11 — Verse Chain Explorer overhaul + PDF connections. Largest scope, depends on tooltip system from Phase A.

---

## Phase A: Foundation (Website Polish Infrastructure)

### A1. Global Tooltip System (Item 8)

**Goal:** Single reusable tooltip utility replacing ad-hoc `title` attributes across all components.

**Files to create:**
- `quartz/components/scripts/tooltip.inline.ts` — The tooltip engine
- `quartz/components/styles/tooltip.scss` — Tooltip styles

**Files to modify:**
- `quartz/components/scripts/pipelineDashboard.inline.ts` — Hook tooltips to stat cards, heatmap cells
- `quartz/components/scripts/verseChainExplorer.inline.ts` — Hook tooltips to action buttons, filter chips
- `quartz/components/scripts/topicalChain.inline.ts` — Hook tooltips to verse badges
- `quartz/components/scripts/darkmode.inline.ts` — Hook tooltip to toggle button
- Each component's TSX file that currently uses `title=` attributes

**Implementation details for `tooltip.inline.ts`:**

```
Architecture:
- Single positioned `<div id="global-tooltip">` appended to body on first use
- Exported API: tooltip.attach(element, text) and tooltip.detach(element)
- 300ms hover delay via setTimeout; cancel on mouseleave
- Position: measure element rect, place tooltip above by default
- Flip logic: if tooltip top < 8px from viewport top, position below
- Fade: CSS opacity transition 150ms
- Touch detection: if ('ontouchstart' in window) skip all tooltip registration
- SPA cleanup: register via window.addCleanup() pattern already used everywhere
```

**Integration pattern:** Each component's inline script calls `tooltip.attach()` in its `init()` function. Since inline scripts are bundled separately in Quartz, the tooltip module needs to be either:
- Option A: A `beforeDOMLoaded` script on a shared component (like Head.tsx) that exposes `window.tooltip`
- Option B: Inline in each script that needs it (code duplication)

**Recommended: Option A** — Add to an always-present component. The tooltip utility attaches to `window.__tooltip` and each component reads from there.

**Key decision:** The tooltip module should be registered as a `beforeDOMLoaded` script on a component that renders on every page (e.g., `Head.tsx` or a new `SharedUtils.tsx` component). This ensures it is available before any `afterDOMLoaded` scripts run.

---

### A2. Hover Animations (Item 10)

**Goal:** Standardized micro-interactions via CSS classes and variables.

**Files to modify:**
- `quartz/styles/base.scss` — Add animation utility classes and CSS custom properties
- `quartz/styles/custom.scss` — Add global interaction patterns
- `quartz/components/styles/pipelineDashboard.scss` — Already has card hover; standardize
- `quartz/components/styles/verseChainExplorer.scss` — Add to cards, chips, buttons
- `quartz/components/styles/topicalChain.scss` — Add to pills, chips

**Implementation — CSS-only approach (no JS needed):**

Add to `base.scss`:
```scss
// Interaction tokens
:root {
  --hover-lift: translateY(-2px);
  --press-scale: scale(0.97);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out: cubic-bezier(0.0, 0.0, 0.2, 1);
}

// Utility: pressable button
.pressable {
  transition: transform 0.15s var(--spring);
  &:active { transform: var(--press-scale); }
}

// Utility: liftable card
.liftable {
  transition: transform 0.2s var(--spring), box-shadow 0.2s;
  &:hover {
    transform: var(--hover-lift);
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  }
}

// Link underline animation
a.animated-underline {
  text-decoration: none;
  background-image: linear-gradient(currentColor, currentColor);
  background-position: 50% 100%;
  background-repeat: no-repeat;
  background-size: 0% 1px;
  transition: background-size 0.25s var(--ease-out);
  &:hover { background-size: 100% 1px; }
}
```

Then apply these classes in component SCSS files where appropriate, replacing existing hover rules. The `pipelineDashboard.scss` already uses similar patterns (`$spring` variable, card hover lift). Standardize to use the shared tokens.

---

### A3. iOS-like UI Polish (Item 9)

**Goal:** Increase visual refinement across all components.

**Files to modify:**
- `quartz/styles/base.scss` — Increase default border-radius, add glass morphism mixins
- `quartz/styles/custom.scss` — Global overrides
- `quartz/styles/variables.scss` — Add radius and blur tokens
- `quartz/components/styles/pipelineDashboard.scss` — Already uses `backdrop-filter: blur(16px)` and `border-radius: 12px` on stat cards; extend to other elements
- `quartz/components/styles/verseChainExplorer.scss` — Cards, search input, filter chips
- `quartz/components/styles/topicalChain.scss` — Pill and chip refinement
- `quartz/components/styles/darkmode.scss` — Will be replaced in Phase C

**Implementation approach:**

Add to `variables.scss`:
```scss
$radius-sm: 8px;
$radius-md: 12px;
$radius-lg: 16px;
$radius-xl: 20px;
$blur-sm: 8px;
$blur-md: 16px;
$blur-lg: 24px;
```

Add a glass morphism mixin to `base.scss`:
```scss
@mixin glass($blur: 16px) {
  background: rgba(var(--light-rgb, 255,255,255), 0.6);
  backdrop-filter: blur($blur);
  -webkit-backdrop-filter: blur($blur);
  border: 1px solid rgba(255,255,255,0.08);
}
```

**Segmented controls:** Create a reusable `.segmented-control` CSS class. This will be used for the dark mode toggle (Item 5) and can replace button groups in the verse chain explorer filters. The segmented control pattern:
```
Container: inline-flex, gap:0, rounded-full, bg: surface
Segments: buttons, padding, no border
Active indicator: absolutely positioned pill that transitions left/width
```

**Sheet-style mobile modals:** Add a `.modal-sheet` class with:
```scss
@media (max-width: 800px) {
  .modal-sheet {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    border-radius: $radius-xl $radius-xl 0 0;
    transform: translateY(100%);
    transition: transform 0.35s var(--spring);
    &.open { transform: translateY(0); }
  }
}
```

---

## Phase B: Bug Fixes

### B1. BibleGateway Notes Scraping Fix (Item 1)

**Problem:** CSS selectors in `bg-sync.js` (line 150-151) and `bg-controller.js` (line 76) don't match BibleGateway's current DOM.

**Files to modify:**
- `quartz/tools/sync-app/bg-sync.js` — Update note extraction selectors (line 150-151) and sub-element selectors (lines 155-158)
- `quartz/tools/sync-app/bg-controller.js` — Update login detection selectors (line 76)

**Implementation approach:**

1. **Add debug mode to `bg-sync.js`:** Before the selector-based extraction, add a fallback that captures page HTML for inspection:
   ```javascript
   // After: const pageDoc = parser.parseFromString(html, 'text/html');
   // Add:
   const noteEls = pageDoc.querySelectorAll(
     '.annotation-item, .note-item, [data-annotation-id], .user-annotation, ' +
     // New selectors based on BG's current DOM (to be determined by inspection):
     '.note-card, .annotation-card, [class*="annotation"], [class*="note-entry"]'
   );
   
   // Debug: if no notes found on first page, send HTML snippet for diagnosis
   if (noteEls.length === 0 && pageNum === 1) {
     sendProgress({
       step: 'debug',
       message: 'No notes found with known selectors',
       htmlSnippet: pageDoc.body.innerHTML.slice(0, 2000),
       bodyClasses: pageDoc.body.className,
       mainContent: pageDoc.querySelector('main, #content, .content, [role="main"]')?.innerHTML?.slice(0, 1000) || 'no main found'
     });
   }
   ```

2. **Add debug mode toggle in bg-controller.js:** Pass a `debugMode` option to `buildExportScript()`. When enabled, the injected script captures full page HTML and sends it back via the relay, rather than trying to extract notes.

3. **Forward debug data to log window:** In `bg-controller.js` `handleBGMessage()`, forward debug-type messages to the log window so the user can see them in the Output tab.

4. **The actual selector fix** requires inspecting BG's live DOM. The implementation should:
   - Open BG in debug mode first
   - Capture the HTML structure
   - Update selectors in both files
   - Test iteratively

**Key architectural note:** The selectors on line 76 of bg-controller.js and line 150 of bg-sync.js must stay in sync. Consider extracting them to a shared constant, but since bg-controller runs in the main process and bg-sync generates a string to inject into a renderer, the simplest approach is to maintain them separately with a comment referencing each other.

---

### B2. BibleGateway Credentials in Sync App Settings (Item 2)

**Files to modify:**
- `quartz/tools/sync-app/log-window.html` — Add BibleGateway section to Settings tab (after GitHub Integration section, around line 2405)
- `quartz/tools/sync-app/state.js` — No changes needed (settings.json is schemaless, loadSettings/saveSettings handle arbitrary keys)
- `quartz/tools/sync-app/preload.js` — No new IPC channels needed; `saveSettings` and `getSettings` already handle arbitrary keys
- `quartz/tools/sync-app/bg-controller.js` — Add auto-login flow before export

**Settings UI addition (log-window.html around line 2405, before closing `</div>` of settings):**

Insert a new `<div class="settings-section">` with:
- Title: "BibleGateway"
- Email input (type text, id `bgEmailInput`)
- Password input (type password, id `bgPasswordInput`) with reveal toggle (same pattern as GitHub token)
- Save button
- Status line showing `settings.lastBGSync` formatted date and `settings.bgNoteCount`

The save function calls `window.syncAPI.saveSettings({ bgUsername: email, bgPassword: password })`.

**Auto-login flow in `bg-controller.js`:**

Modify the `did-finish-load` handler. Before checking for login status (line 74), add:

```javascript
// Step 2.5: If we have credentials and are on the login page, auto-fill
const url = state.bgSyncWindow.webContents.getURL();
if (url.includes('/user/') && !url.includes('/annotations')) {
  // Might be on login page — try to auto-fill
  const settings = loadSettings();
  if (settings.bgUsername && settings.bgPassword) {
    await state.bgSyncWindow.webContents.executeJavaScript(`
      const emailField = document.querySelector('input[type="email"], input[name="email"], #email');
      const passField = document.querySelector('input[type="password"], input[name="password"], #password');
      const submitBtn = document.querySelector('button[type="submit"], input[type="submit"], .login-btn');
      if (emailField && passField) {
        emailField.value = ${JSON.stringify(settings.bgUsername)};
        passField.value = ${JSON.stringify(settings.bgPassword)};
        emailField.dispatchEvent(new Event('input', { bubbles: true }));
        passField.dispatchEvent(new Event('input', { bubbles: true }));
        if (submitBtn) submitBtn.click();
      }
    `).catch(() => {});
    return; // Wait for page reload after login
  }
}
```

**Security note:** Credentials stored in plain text in `settings.json`. For a local Electron app this is acceptable but could be improved later with `safeStorage.encryptString()`.

---

### B3. Verse Chain Page — Accordion & Button Fixes (Item 3)

**Files to modify:**
- `quartz/components/scripts/topicalChain.inline.ts` — Debug accordion logic
- `quartz/components/scripts/verseChainExplorer.inline.ts` — Add tooltips to action buttons
- `quartz/components/VerseChainExplorer.tsx` — Verify `title` attributes on buttons

**Accordion analysis:**

Looking at the code in `topicalChain.inline.ts` lines 146-166, the accordion logic appears correct:
- Click handler on `.tc-verse-pill` buttons
- Guards against clicking the `.tc-verse-ref` link itself (line 149)
- Toggles `expanded` class on the parent `.tc-group`
- CSS in `topicalChain.scss` uses `grid-template-rows: 0fr` / `1fr` transition (lines 86-93)

**Potential issues:**
1. The `.tc-verse-ref` is an `<a>` tag inside the `<button>`. Clicking anywhere on the button text might be captured by the link check on line 149 if the `<a>` spans too wide. Check if the verse ref link occupies the full pill width.
2. The `e.target` check uses `.closest(".tc-verse-ref")` which should work. But if the click lands on the chevron span, it should fall through. Test this.
3. **Most likely issue:** The `content.querySelectorAll(".tc-verse-pill")` on line 146 runs at render time. If the page loads via SPA navigation, the content might not be in the DOM when the handlers attach. But `init()` is called on `"nav"` event (line 169) and `renderConnections` is called within `init()`, so the handlers should attach after rendering.

**Fix approach:**
- Add `event.preventDefault()` to the click handler to prevent any default button behavior
- Ensure the chevron rotation CSS actually works by checking the selector chain `.tc-group.expanded .tc-chevron`

**Button tooltips in VerseChainExplorer.tsx:**

The three action buttons (lines 37-53) already have `title` attributes. After the tooltip system from Phase A is ready, replace these with tooltip.attach() calls. For now, verify the `title` attributes render correctly.

**View toggle button fix:** The `onViewToggle` handler (line 161) toggles between tree and graph mode. Check that the graph element (`#vc-graph`) actually exists in the DOM and that d3 loads correctly. The button itself seems wired up correctly.

---

## Phase C: Redesigns

### C1. Appearance Toggle — 3-Way Segmented Control (Item 5)

**Files to modify:**
- `quartz/components/Darkmode.tsx` — Replace button with segmented control HTML
- `quartz/components/scripts/darkmode.inline.ts` — Add system mode, 3-way selection logic
- `quartz/components/styles/darkmode.scss` — Replace with segmented control styles

**New TSX structure for `Darkmode.tsx`:**

Replace the single `<button>` with:
```tsx
<div class={classNames(displayClass, "darkmode-segmented")}>
  <div class="dm-segment" role="radiogroup" aria-label="Appearance">
    <button class="dm-seg-btn" data-theme="light" role="radio" aria-label="Light mode">
      {/* Sun SVG icon, 16x16 */}
    </button>
    <button class="dm-seg-btn" data-theme="dark" role="radio" aria-label="Dark mode">
      {/* Moon SVG icon, 16x16 */}
    </button>
    <button class="dm-seg-btn" data-theme="system" role="radio" aria-label="System preference">
      {/* Monitor SVG icon, 16x16 */}
    </button>
    <div class="dm-seg-indicator" aria-hidden="true"></div>
  </div>
</div>
```

**New inline script logic for `darkmode.inline.ts`:**

```
Top-level (beforeDOMLoaded, runs immediately):
1. Read localStorage "theme" → can be "light", "dark", or "system"
2. If "system" or absent: use prefers-color-scheme
3. Set document.documentElement saved-theme to resolved value ("light" or "dark")

On "nav" event:
1. Find all .dm-seg-btn elements
2. Set active state based on stored preference
3. Position the indicator pill on the active button
4. Click handler: update localStorage, apply theme, move indicator
5. For "system" mode: add prefers-color-scheme listener
6. Clean up listeners via window.addCleanup()
```

**Key detail:** The `saved-theme` attribute must remain either "light" or "dark" (never "system") because all CSS color schemes depend on it. The "system" choice is a _preference_ stored in localStorage; at runtime it resolves to light or dark.

**Indicator animation:** The pill indicator uses `position: absolute` within the segment container. On selection change:
```javascript
const btn = segment.querySelector(`[data-theme="${mode}"]`);
const rect = btn.getBoundingClientRect();
const parentRect = segment.getBoundingClientRect();
indicator.style.transform = `translateX(${rect.left - parentRect.left}px)`;
indicator.style.width = `${rect.width}px`;
```
With `transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.2s ease` on the indicator.

**Styles for `darkmode.scss`:**

```scss
.darkmode-segmented {
  display: flex;
  align-items: center;
}

.dm-segment {
  position: relative;
  display: inline-flex;
  background: var(--lightgray);
  border-radius: 10px;
  padding: 2px;
  gap: 0;
}

.dm-seg-btn {
  position: relative;
  z-index: 1;
  padding: 4px 8px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg { width: 14px; height: 14px; fill: var(--gray); transition: fill 0.15s; }
  &.active svg { fill: var(--darkgray); }
}

.dm-seg-indicator {
  position: absolute;
  top: 2px;
  height: calc(100% - 4px);
  background: var(--light);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.2s ease;
  pointer-events: none;
}
```

---

### C2. Dashboard Heatmap Redesign (Item 4)

**Files to modify:**
- `quartz/components/scripts/pipelineDashboard.inline.ts` — Rewrite `renderHeatmap()` function
- `quartz/components/styles/pipelineDashboard.scss` — Add sticky label and modal styles
- `quartz/components/PipelineDashboard.tsx` — Add modal container to TSX

**Sticky weekday labels approach:**

The current implementation renders everything in a single SVG. To make weekday labels sticky, we need to separate them:

```
Structure:
<div class="pd-heatmap-container" style="position: relative">
  <!-- Sticky day labels (position: sticky; left: 0) -->
  <div class="pd-heatmap-days" style="position: sticky; left: 0; z-index: 2; background: var(--light)">
    SVG with just the day labels (M, W, F)
  </div>
  <!-- Scrollable grid area -->
  <div class="pd-heatmap-scroll" style="overflow-x: auto">
    <svg class="pd-heatmap-svg">
      Month labels at top + grid cells (no day labels)
    </svg>
  </div>
</div>
```

Actually, a simpler approach: Use a single scroll container with the day labels absolutely positioned and sticky:

```
<div class="pd-heatmap" style="overflow-x: auto; position: relative">
  <svg width="totalW" height="totalH">
    <!-- Day labels group with CSS class for sticky positioning -->
    <!-- This won't work because SVG elements can't be position:sticky -->
  </svg>
</div>
```

SVG elements cannot use CSS sticky. So the approach must be **HTML-based day labels overlaying the SVG**:

```
<div class="pd-heatmap-outer" style="position: relative">
  <div class="pd-heatmap-day-labels" style="position: absolute; left: 0; top: 14px; z-index: 2; background: var(--light)">
    <div style="height: 14px; line-height: 14px">M</div>
    <div style="height: 14px; display: none"></div>
    <div style="height: 14px; line-height: 14px">W</div>
    ...
  </div>
  <div class="pd-heatmap" style="overflow-x: auto; padding-left: 20px">
    <svg> <!-- cells + month labels only, no day labels --> </svg>
  </div>
</div>
```

The day labels are plain HTML divs with `position: sticky; left: 0` inside the scroll container. This is the cleanest approach.

**Hover tooltip:** Replace the SVG `<title>` elements with the global tooltip system from Phase A. On `mouseenter` of each `<rect>`, call `tooltip.show(event, formattedText)` with:
- Formatted date: "Friday, April 4, 2026"
- Created count: X notes created
- Modified count: Y notes modified
- To distinguish created vs modified, the contentIndex.json currently only has a single `date` field. This is the `getDate()` return value which uses `cfg.defaultDateType`. To get both dates, we need to modify the content index emitter.

**Content index enhancement for created vs modified dates:**

In `quartz/plugins/emitters/contentIndex.tsx`, the `ContentDetails` type has a single `date` field. To support the heatmap distinguishing created from modified:

Option A: Add `createdDate` and `modifiedDate` to `ContentDetails`. This increases the JSON size.
Option B: Keep the existing single date (which is the modified date per syncStamp.ts) and use frontmatter `created` date when available. The client-side script can parse both.

**Recommended: Option B** — Add `createdDate` as an optional field alongside the existing `date` (which represents modified). Modify the emitter at line 104-118:

```typescript
const createdDate = file.data.dates?.created
const modifiedDate = file.data.dates?.modified ?? date
// In the linkIndex.set:
createdDate: createdDate,
date: modifiedDate,
```

And update the `ContentDetails` type to include `createdDate?: Date`.

**Click → modal → full page:**

On click of a heatmap cell:
1. Show a modal overlay with notes from that day (filter contentIndex by date)
2. The modal has an "Expand" button that navigates to `/Dashboard/YYYY-MM-DD`
3. This requires a new page route. In Quartz, pages are either content files or emitter-generated. For dynamic date routes, the simplest approach is to use the Dashboard page with a URL parameter: `/Dashboard?date=YYYY-MM-DD` and handle it client-side.

Actually, a modal with a "View full page" button that navigates to `/Dashboard?date=2026-04-04` is simpler and avoids creating new routes. The dashboard inline script can check for the `date` query param and render a focused day view.

---

### C3. Sync Output & Deploy Logs Redesign (Item 7)

**Files to modify:**
- `quartz/tools/sync-app/log-window.html` — Redesign Output tab (Tab 1) and deploy section on Status tab
- `quartz/tools/sync-app/log-window.js` — Not a separate file; JS is inline in log-window.html
- `quartz/tools/sync-app/sync-runner.js` — Emit stage-tagged output chunks
- `quartz/tools/sync-app/github-api.js` — Stream deploy status updates

**Output tab redesign (log-window.html):**

Replace the plain `<pre>` output area with:

```html
<div class="output-stages" id="outputStages">
  <div class="stage-pill" data-stage="pull">Pull</div>
  <div class="stage-connector"></div>
  <div class="stage-pill" data-stage="commit">Commit</div>
  <div class="stage-connector"></div>
  <div class="stage-pill" data-stage="push">Push</div>
  <div class="stage-connector"></div>
  <div class="stage-pill" data-stage="lfs">LFS</div>
  <div class="stage-connector"></div>
  <div class="stage-pill" data-stage="deploy">Deploy</div>
</div>
<div class="output-stream" id="outputStream"></div>
```

**Stage detection in sync-runner.js:**

The sync process runs `quartz-sync.sh`. The output lines can be tagged by detecting patterns:
- "git pull" → stage "pull"
- "git add" / "git commit" → stage "commit"
- "git push" → stage "push"
- "LFS" → stage "lfs"
- Deploy webhook / GitHub Actions → stage "deploy"

Modify the `sync-output` IPC message to include a `stage` field. In sync-runner.js, parse stdout lines and tag them:

```javascript
// In the spawn stdout handler:
function detectStage(line) {
  if (/git pull|pulling/i.test(line)) return 'pull';
  if (/git add|git commit|committing/i.test(line)) return 'commit';
  if (/git push|pushing/i.test(line)) return 'push';
  if (/lfs|large file/i.test(line)) return 'lfs';
  if (/deploy|workflow|actions/i.test(line)) return 'deploy';
  return null;
}
```

**Deploy log integration:**

After sync completes, if deploy polling is active (github-api.js), stream deploy status updates into the same output stream. The existing `pollDeployStatus` function already sends status updates. Route these to the output tab via a new IPC message or reuse `sync-output`.

**Recent syncs DOM diffing (Status tab):**

The current issue is that refresh re-renders the entire recent syncs list, causing visual flicker. Fix by:
1. Compare new data with what's already in the DOM
2. Only add new items (prepend with animation)
3. Update changed items in-place
4. Remove deleted items

Implementation: Give each sync entry a unique key (timestamp). On refresh, compare keys. Use `insertBefore` for new items with a CSS `animation: slideIn`.

---

## Phase D: Major Redesigns

### D1. Verse Connection Explorer Overhaul (Item 6)

**Files to modify:**
- `quartz/components/VerseChainExplorer.tsx` — New HTML structure for horizontal flow
- `quartz/components/scripts/verseChainExplorer.inline.ts` — Major rewrite of rendering logic
- `quartz/components/styles/verseChainExplorer.scss` — New layout styles

**New architecture — Horizontal column flow:**

```
TSX structure:
<div class="verse-chain">
  <div class="vc-search-wrap"> ... (keep existing) </div>
  <div class="vc-history"> ... (keep existing) </div>
  <div class="vc-controls"> ... (keep existing filters + buttons) </div>
  <div id="vc-count" class="vc-count"></div>
  
  <!-- NEW: Horizontal flow container -->
  <div id="vc-flow" class="vc-flow">
    <!-- Columns inserted dynamically -->
    <!-- Each column: <div class="vc-column" data-depth="0"> -->
    <!--   <div class="vc-column-card"> verse card </div> -->
    <!--   <div class="vc-column-connections"> small connection cards </div> -->
    <!-- </div> -->
  </div>
  
  <!-- Keep graph view as secondary option -->
  <div id="vc-graph" class="vc-graph vc-desktop-only" style="display:none;"></div>
</div>
```

**Data flow:**

```
User types verse → Column 0: verse card (text, notes, connection count)
  + Show 1st-degree connections as smaller cards below/around
  
User clicks a connection → Column 1 slides in from right
  + That verse's card + its connections (2nd degree)
  
Continue for 3rd, 4th, 5th degree...
```

**Column rendering:**

```typescript
interface FlowColumn {
  depth: number
  verseRef: string
  parentRef?: string
  notes: VerseIndexEntry[]
  connections: string[]
  verseText?: string
}

function renderColumn(col: FlowColumn): string {
  return `<div class="vc-column" data-depth="${col.depth}" data-ref="${col.verseRef}">
    <div class="vc-column-header">
      ${col.depth > 0 ? `<button class="vc-col-back">←</button>` : ''}
      <span class="vc-col-ref">${col.verseRef}</span>
      <span class="vc-col-badge">${col.connections.length} connections</span>
    </div>
    <div class="vc-column-body">
      <div class="vc-col-text">${col.verseText || ''}</div>
      <div class="vc-col-notes">${col.notes.map(renderNotePill).join('')}</div>
      <div class="vc-col-connections">
        ${col.connections.map(ref => renderConnectionCard(ref, col.depth + 1)).join('')}
      </div>
    </div>
  </div>`
}
```

**Layout CSS:**

```scss
.vc-flow {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding-bottom: 1rem;
  
  // Snap to columns on scroll
  scroll-snap-type: x proximity;
}

.vc-column {
  flex: 0 0 320px; // fixed width columns
  scroll-snap-align: start;
  border-radius: 12px;
  @include glass;
  animation: columnSlideIn 0.4s var(--spring);
}

@keyframes columnSlideIn {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}

// Mobile: stack vertically
@media (max-width: 800px) {
  .vc-flow {
    flex-direction: column;
    overflow-x: visible;
  }
  .vc-column {
    flex: 0 0 auto;
    margin-left: calc(var(--depth, 0) * 12px); // indentation
  }
}
```

**Connection lines:** Use CSS `::before` pseudo-elements or a thin SVG overlay to draw curved lines between parent column and child column. Alternatively, use a subtle left-border highlight on the child column matching the parent's color.

**Performance considerations:**
- Limit connections shown per column to 15 (with "Show all" button)
- Lazy-load verse text only when a column becomes visible
- Cap total depth at 6 levels
- Reuse the existing verse text cache (localStorage)

**Context mode:** Add a toggle to show surrounding verses. When enabled, for each verse in a column, also show the preceding and following verse with dimmed styling. If a context verse also has connections, show a small badge.

**Keeping existing functionality:** The search, autocomplete, history, filters, export, and graph view all remain. The main change is replacing the vertical card list (`vc-tree`) with the horizontal flow (`vc-flow`). The tree view becomes a view mode option alongside the flow view and graph view.

---

### D2. PDF Connections in Verse Explorer (Item 11)

**Files to modify:**
- `quartz/plugins/emitters/verseIndex.ts` — Track PDF references per verse
- `quartz/components/scripts/verseChainExplorer.inline.ts` — Render PDF cards

**Emitter changes in `verseIndex.ts`:**

Currently, the emitter iterates over all content, parsing verse refs from the text. To track PDFs, add:

```typescript
// After the verse extraction loop, also track PDF links per note
const pdfLinks: Map<string, Set<string>> = new Map() // slug → set of PDF paths

for (const [_tree, file] of content) {
  const slug = file.data.slug!
  const links = file.data.links ?? []
  const pdfs = links.filter(l => l.endsWith('.pdf'))
  if (pdfs.length > 0) {
    pdfLinks.set(slug, new Set(pdfs))
  }
}

// In the index output, for each verse entry, check if any of its notes reference PDFs
// Add a pdfConnections field: Record<string, string[]> (verse → PDF slugs)
const pdfConnections: Record<string, string[]> = {}
for (const [verse, entries] of Object.entries(index)) {
  const pdfs = new Set<string>()
  for (const entry of entries) {
    const notePdfs = pdfLinks.get(entry.slug)
    if (notePdfs) notePdfs.forEach(p => pdfs.add(p))
  }
  if (pdfs.size > 0) pdfConnections[verse] = [...pdfs]
}

// Update output:
const data = { index, cooccurrence, pdfConnections }
```

**UI changes in verseChainExplorer:**

In each verse card or flow column, if `pdfConnections[verseRef]` exists, render PDF document cards:

```html
<div class="vc-pdf-connections">
  <div class="vc-pdf-label">Referenced PDFs</div>
  <a class="vc-pdf-card" href="/Books-and-PDFs#pdf-name">
    <svg><!-- document icon --></svg>
    <span>PDF filename</span>
  </a>
</div>
```

---

## Summary of All Files Modified

### Website (Quartz)

| File | Changes |
|------|---------|
| `quartz/components/scripts/tooltip.inline.ts` | **NEW** — Global tooltip utility |
| `quartz/components/styles/tooltip.scss` | **NEW** — Tooltip styles |
| `quartz/styles/base.scss` | Add interaction tokens, glass mixin, utility classes |
| `quartz/styles/custom.scss` | Global polish rules |
| `quartz/styles/variables.scss` | Add radius/blur design tokens |
| `quartz/components/Darkmode.tsx` | Replace button with segmented control |
| `quartz/components/scripts/darkmode.inline.ts` | 3-way toggle logic with system mode |
| `quartz/components/styles/darkmode.scss` | Segmented control styles |
| `quartz/components/PipelineDashboard.tsx` | Add modal container, heatmap structure |
| `quartz/components/scripts/pipelineDashboard.inline.ts` | Rewrite heatmap, add modal, tooltips |
| `quartz/components/styles/pipelineDashboard.scss` | Sticky labels, modal, hover animations |
| `quartz/components/VerseChainExplorer.tsx` | New horizontal flow HTML structure |
| `quartz/components/scripts/verseChainExplorer.inline.ts` | Major rewrite: flow layout, multi-degree |
| `quartz/components/styles/verseChainExplorer.scss` | Flow layout CSS, column animations |
| `quartz/components/scripts/topicalChain.inline.ts` | Fix accordion, add tooltips |
| `quartz/components/styles/topicalChain.scss` | Hover animation polish |
| `quartz/plugins/emitters/verseIndex.ts` | Add pdfConnections to output |
| `quartz/plugins/emitters/contentIndex.tsx` | Add createdDate field |

### Electron Sync App

| File | Changes |
|------|---------|
| `quartz/tools/sync-app/bg-sync.js` | Update selectors, add debug mode |
| `quartz/tools/sync-app/bg-controller.js` | Update login selectors, add auto-login flow |
| `quartz/tools/sync-app/log-window.html` | BG credentials UI, output tab stage indicators, deploy integration |
| `quartz/tools/sync-app/preload.js` | Possibly no changes needed |
| `quartz/tools/sync-app/sync-runner.js` | Tag output with stage info |

## Risk Assessment

1. **Highest risk:** Item 1 (BG scraping) — Depends on BG's live DOM which we cannot inspect in this planning session. The debug mode approach mitigates this.
2. **High complexity:** Item 6 (Verse Explorer overhaul) — Largest rewrite. Recommend implementing incrementally: first the flow layout with existing data, then context mode, then animations.
3. **Medium risk:** Item 4 (Heatmap) — The sticky labels + SVG separation requires careful measurement. The created vs modified date distinction requires emitter changes.
4. **Low risk:** Items 5, 8, 9, 10 — CSS-heavy changes with well-understood patterns.
