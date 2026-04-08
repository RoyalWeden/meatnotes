/**
 * BibleGateway sync — export logic (two-phase).
 *
 * Phase 1: Crawl the annotations listing page to build an inventory of
 *          verse refs + dates, grouped by chapter.
 * Phase 2: For each unique chapter, navigate to the passage page and
 *          extract actual note text from the "Your Content" sidebar.
 *
 * Each phase returns a string of JavaScript to inject into the
 * BibleGateway BrowserWindow via webContents.executeJavaScript().
 */

/**
 * Phase 1 — Annotations page inventory.
 *
 * Crawls all pages of /user/annotations/?iv=notes, collecting verseRef + date
 * for every note. Groups them by chapter and sends a bg-phase1-complete message
 * with the chapter list + per-chapter verse inventory.
 *
 * Fixes from the old single-phase script:
 *  - Scopes selectors to the active tab pane only
 *  - Sends chapter-grouped inventory instead of raw note text
 *
 * @param {object} opts
 * @param {number} [opts.resumeFromPage] - Page to resume from (0-based)
 * @returns {string} JavaScript to execute in the BrowserWindow
 */
function buildPhase1Script(opts = {}) {
  const resumeFrom = opts.resumeFromPage || 0

  return `
(async function bgPhase1() {
  const RESUME_FROM = ${resumeFrom};
  const CONCURRENCY = 3;
  const BASE_URL = 'https://www.biblegateway.com/user/annotations/?iv=notes';
  const inventory = [];        // [{verseRef, date}]
  let totalPages = 1;
  let errorCount = 0;
  let backoffMs = 0;

  function sendProgress(data) {
    window.postMessage({ type: 'bg-progress', ...data }, '*');
  }

  function sendError(data) {
    window.postMessage({ type: 'bg-error', ...data }, '*');
  }

  // Inject progress overlay
  const overlay = document.createElement('div');
  overlay.id = 'bg-export-overlay';
  overlay.innerHTML = \`
    <div style="position:fixed;top:16px;right:16px;z-index:99999;background:#1a1a2e;color:#e0e0e0;
      padding:16px 20px;border-radius:12px;font-family:system-ui;font-size:13px;
      box-shadow:0 8px 32px rgba(0,0,0,0.4);min-width:280px;max-width:360px;">
      <div style="font-weight:700;margin-bottom:8px;font-size:14px;">BibleGateway Export</div>
      <div id="bg-step" style="margin-bottom:6px;opacity:0.8;">Phase 1: Scanning annotations...</div>
      <div style="background:#333;border-radius:4px;height:6px;overflow:hidden;margin-bottom:6px;">
        <div id="bg-bar" style="height:100%;background:#4CAF50;width:0%;transition:width 0.3s;border-radius:4px;"></div>
      </div>
      <div id="bg-stats" style="font-size:11px;opacity:0.6;">Discovering notes...</div>
      <div id="bg-preview" style="font-size:11px;opacity:0.5;margin-top:4px;max-height:40px;overflow:hidden;"></div>
      <button id="bg-cancel-btn" style="margin-top:8px;padding:4px 12px;border:1px solid #555;
        background:transparent;color:#ccc;border-radius:6px;cursor:pointer;font-size:12px;">Cancel</button>
    </div>
  \`;
  document.body.appendChild(overlay);

  const barEl = document.getElementById('bg-bar');
  const stepEl = document.getElementById('bg-step');
  const statsEl = document.getElementById('bg-stats');
  const previewEl = document.getElementById('bg-preview');
  let cancelled = false;

  document.getElementById('bg-cancel-btn').addEventListener('click', () => {
    cancelled = true;
    stepEl.textContent = 'Cancelling...';
  });

  function updateUI(step, pct, stats) {
    if (stepEl) stepEl.textContent = step;
    if (barEl && pct >= 0) barEl.style.width = pct + '%';
    if (statsEl) statsEl.textContent = stats;
  }

  // Fetch with retry + backoff
  async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
      if (cancelled) throw new Error('Cancelled');
      if (backoffMs > 0) {
        updateUI('Rate limited, waiting ' + Math.ceil(backoffMs/1000) + 's...', -1, '');
        await new Promise(r => setTimeout(r, backoffMs));
      }
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (res.status === 429 || res.status === 503) {
          backoffMs = Math.min((backoffMs || 2000) * 2, 60000);
          errorCount++;
          if (errorCount >= 5) {
            sendError({ message: 'Too many rate limits. Try again later.' });
            throw new Error('Rate limited');
          }
          continue;
        }
        backoffMs = 0;
        errorCount = 0;
        return await res.text();
      } catch (e) {
        if (e.message === 'Cancelled' || e.message === 'Rate limited') throw e;
        if (i === retries - 1) throw e;
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }

  try {
    // Step 1: Detect total pages
    updateUI('Phase 1: Scanning pages...', 5, '');
    const firstPage = await fetchWithRetry(BASE_URL);
    const parser = new DOMParser();
    const doc = parser.parseFromString(firstPage, 'text/html');

    // Find pagination — BG uses .info-viewer-pager with ?iv=notes&i=<offset>
    const pageLinks = doc.querySelectorAll(
      '.info-viewer-pager a, .info-viewer-footer a, .pagination a, .pager a, ' +
      '[data-page], .page-numbers a, a[href*="page="], a[href*="&i="], .paging a, nav.pagination a'
    );
    let maxOffset = 0;
    if (pageLinks.length > 0) {
      for (const link of pageLinks) {
        const href = link.getAttribute('href') || '';
        const offsetMatch = href.match(/[?&]i=(\\d+)/);
        if (offsetMatch) maxOffset = Math.max(maxOffset, parseInt(offsetMatch[1]));
        const pageMatch = href.match(/page=(\\d+)/);
        if (pageMatch) totalPages = Math.max(totalPages, parseInt(pageMatch[1]));
        const text = link.textContent?.trim();
        if (text && /^\\d+$/.test(text)) totalPages = Math.max(totalPages, parseInt(text));
      }
      if (maxOffset > 0) {
        const ITEMS_PER_PAGE = 25;
        totalPages = Math.ceil((maxOffset + ITEMS_PER_PAGE) / ITEMS_PER_PAGE);
      }
    }

    sendProgress({ step: 'phase1-scan', totalPages });
    updateUI('Phase 1: Found ' + totalPages + ' pages', 10, '');

    // Step 2: Crawl all annotation pages for verse refs + dates
    const pages = [];
    for (let p = RESUME_FROM; p < totalPages; p++) pages.push(p + 1);

    let completed = 0;
    const processPage = async (pageNum) => {
      if (cancelled) return;
      const offset = (pageNum - 1) * 25;
      const url = BASE_URL + '&i=' + offset;
      const html = await fetchWithRetry(url);
      const pageDoc = parser.parseFromString(html, 'text/html');

      // Scope to the active/visible tab pane only
      // BG may have multiple tabs (notes, highlights, bookmarks) —
      // find the notes pane by looking for the active tab content
      let scope = pageDoc.querySelector('.tab-pane.active, .tab-content > .active, [role="tabpanel"][aria-hidden="false"]');
      if (!scope) scope = pageDoc.body;

      // Strategy 1: Current BG layout (article.bible-item)
      let noteEls = scope.querySelectorAll(
        'article.bible-item, .bible-item, .annotation-item, .note-item, [data-annotation-id], .user-annotation'
      );

      // Strategy 2: Table rows
      if (noteEls.length === 0) {
        noteEls = scope.querySelectorAll(
          'table tr[data-id], table.annotations tr, .notes-container > div, .notes-list > li'
        );
      }

      // Strategy 3: Broader fallback
      if (noteEls.length === 0) {
        noteEls = scope.querySelectorAll('[data-reference], [data-verse], .reference-container');
      }

      for (const noteEl of noteEls) {
        const verseRef = (
          noteEl.querySelector('.bible-item-title a[href*="passage"]')?.textContent?.trim() ||
          noteEl.querySelector('.verse-ref, .annotation-verse, .reference, .passage-ref')?.textContent?.trim() ||
          noteEl.querySelector('a[href*="passage"]')?.textContent?.trim() ||
          noteEl.getAttribute('data-reference') ||
          noteEl.getAttribute('data-verse')
        );

        // Date from the listing — we'll get exact dates in Phase 2
        const dateEl = noteEl.querySelector('.bible-item-details, .date, .annotation-date, time, .timestamp');
        let date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';
        date = date.replace(/\\s*\\|\\s*\\w+$/, '').replace(/\\s*(Delete|Undo)\\s*/g, '').trim();

        if (verseRef) {
          inventory.push({ verseRef, date });
          if (previewEl) previewEl.textContent = verseRef;
        }
      }

      completed++;
      const pct = 10 + Math.round((completed / pages.length) * 85);
      updateUI(
        'Phase 1: Page ' + completed + '/' + pages.length,
        pct,
        inventory.length + ' notes found'
      );
      sendProgress({ step: 'phase1-fetch', page: pageNum, completed, total: pages.length, noteCount: inventory.length });
    };

    // Process with limited concurrency
    const queue = [...pages];
    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
      workers.push((async () => {
        while (queue.length > 0 && !cancelled) {
          const page = queue.shift();
          if (page) await processPage(page);
        }
      })());
    }
    await Promise.all(workers);

    if (cancelled) {
      updateUI('Cancelled', 0, inventory.length + ' notes (partial)');
      overlay.remove();
      return;
    }

    // Group inventory by chapter: "Isaiah 30:1" → "Isaiah 30"
    const chapterMap = {};
    for (const item of inventory) {
      // Extract chapter from verseRef: "Isaiah 30:1" → "Isaiah 30", "Psalm 118" → "Psalm 118"
      const chapterMatch = item.verseRef.match(/^(.+?)\\s*:\\s*\\d+/);
      const chapter = chapterMatch ? chapterMatch[1] : item.verseRef;
      if (!chapterMap[chapter]) chapterMap[chapter] = [];
      chapterMap[chapter].push(item);
    }

    const chapters = Object.keys(chapterMap);
    updateUI('Phase 1 complete!', 100, inventory.length + ' notes across ' + chapters.length + ' chapters');

    // Send Phase 1 results back to main process
    window.postMessage({
      type: 'bg-phase1-complete',
      inventory,
      chapters,
      chapterMap,
      totalPages,
      totalNotes: inventory.length,
    }, '*');

    setTimeout(() => overlay.remove(), 2000);
  } catch (e) {
    sendError({ message: 'Phase 1 error: ' + e.message });
    updateUI('Error: ' + e.message, 0, '');
  }
})();
`
}

/**
 * Phase 2 — Per-chapter note extraction.
 *
 * Injected after navigating to a BG passage page with &tab=notes (e.g.,
 * /passage/?search=Isaiah+30&version=KJV&tab=notes). BG's React app may
 * not auto-switch to the notes tab from the URL param alone, so this script
 * actively clicks the notes tab after React mounts, then polls for notes.
 *
 * BG sidebar note structure (observed 2026):
 *   <h3>Your Notes</h3>   (or similar heading — BG uses "Your Content" label)
 *   <div>
 *     <div style="margin: 4px 0px 8px;">
 *       <span style="color: rgb(178, 178, 178);">2026/01/20</span>  ← date
 *       <span>Isaiah 30:1</span>                                    ← verse ref
 *       <div style="margin: 8px 0px;">note text here</div>         ← note text
 *       <div>Edit | Delete buttons</div>
 *     </div>
 *   </div>
 *
 * @param {string} chapter - Chapter identifier, e.g. "Isaiah 30"
 * @param {object} [opts] - Options
 * @param {boolean} [opts.isFirstChapter] - Whether to capture debug HTML
 * @returns {string} JavaScript to execute in the BrowserWindow
 */
function buildPhase2Script(chapter, opts = {}) {
  const isFirstChapter = opts.isFirstChapter || false;
  return `
(async function bgPhase2() {
  const CHAPTER = ${JSON.stringify(chapter)};
  const IS_FIRST = ${isFirstChapter};
  const MAX_WAIT = 15000; // ms to wait for notes content (increased for tab-click latency)
  const POLL_INTERVAL = 300; // ms between checks

  function sendResult(data) {
    window.postMessage({ type: 'bg-phase2-result', ...data }, '*');
  }

  function sendError(data) {
    window.postMessage({ type: 'bg-error', ...data }, '*');
  }

  function sendDebug(data) {
    window.postMessage({ type: 'bg-debug', ...data }, '*');
  }

  // Network interceptor: capture fetch/XHR URLs for API discovery.
  const _intercepted = [];
  const _origFetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === 'string') _intercepted.push({ type: 'fetch', url: url.substring(0, 300) });
    return _origFetch.apply(this, arguments);
  };
  const _origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string') _intercepted.push({ type: 'xhr', method, url: url.substring(0, 300) });
    return _origXHROpen.apply(this, arguments);
  };

  try {
    // ── Step 1: Wait for React sidebar to mount ──
    // BG renders the tab bar via React. We need it to exist before clicking.
    let notesTab = null;
    const mountStart = Date.now();
    while (Date.now() - mountStart < 10000) {
      notesTab = document.querySelector('li[data-tab="notes"]');
      if (notesTab) break;
      // Also check for the sidebar menu as a whole
      if (document.querySelector('.sidebar-menu, ul.sidebar-menu')) {
        notesTab = document.querySelector('li[data-tab="notes"]');
        if (notesTab) break;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    if (!notesTab) {
      sendResult({
        chapter: CHAPTER, notes: [], timeout: true,
        reason: 'React sidebar never mounted (li[data-tab=notes] not found)',
      });
      return;
    }

    // ── Step 2: Activate the notes tab if not already active ──
    // BG may not auto-switch to notes despite &tab=notes in URL.
    // Check if the notes tab is active via its border-bottom style.
    const tabStyle = window.getComputedStyle(notesTab);
    const borderW = parseFloat(tabStyle.borderBottomWidth) || 0;
    const isActive = borderW >= 2; // Active tab has 2px solid border

    if (!isActive) {
      // Neutralize the <a> inside the <li> to prevent full-page navigation.
      // The <a> has an href that would navigate and destroy this script.
      const innerLink = notesTab.querySelector('a');
      if (innerLink) {
        innerLink.removeAttribute('href');
        innerLink.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
        }, true); // capture phase
      }

      // Click the <li> to trigger React's tab-switch handler
      notesTab.click();

      // Give React time to process the click, switch state, and fetch notes
      await new Promise(r => setTimeout(r, 1500));
    }

    // ── Step 3: Poll for notes content in sidebar ──
    let notesContainer = null;
    const startTime = Date.now();
    while (Date.now() - startTime < MAX_WAIT) {
      // Strategy 1: Look for heading containing relevant text
      const headings = document.querySelectorAll('h3, h4, .notes-heading');
      for (const h of headings) {
        const text = (h.textContent || '').trim().toLowerCase();
        if (text.includes('your notes') || text.includes('your content') || text === 'notes') {
          notesContainer = h.nextElementSibling;
          if (notesContainer) break;
        }
      }
      if (notesContainer) break;

      // Strategy 2: Look for note-like content in .sticky-resources
      const stickyRes = document.querySelector('.sticky-resources .sidebar-box');
      if (stickyRes) {
        // Check if spinner is gone and real content appeared
        const spinner = stickyRes.querySelector('svg[name="spinner"], .spin.spinner');
        const spans = stickyRes.querySelectorAll('span');
        if (!spinner && spans.length > 2) {
          // Found non-spinner content with multiple spans (likely notes)
          notesContainer = stickyRes;
          break;
        }
        // Check for a heading inside the sidebar-box
        const innerH = stickyRes.querySelector('h3, h4');
        if (innerH && innerH.nextElementSibling) {
          notesContainer = innerH.nextElementSibling;
          break;
        }
      }

      // Strategy 3: Check for "no notes" empty state
      const sidebarText = (document.querySelector('.sticky-resources') || document.querySelector('.resources.flex-5') || {}).textContent || '';
      const lower = sidebarText.toLowerCase();
      if (lower.includes('no notes') || lower.includes('no content') || lower.includes('you haven\\'t')) {
        sendResult({ chapter: CHAPTER, notes: [], noNotes: true });
        return;
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }

    // Capture debug HTML for first chapter (after tab click + polling)
    if (IS_FIRST) {
      try {
        const html = document.documentElement.outerHTML.slice(0, 500000);
        sendDebug({ html });
      } catch (e) { /* ignore */ }
    }

    if (!notesContainer) {
      // Timed out — include sidebar snippet for debugging
      const sidebarHTML = (
        document.querySelector('.sticky-resources') ||
        document.querySelector('.resources.flex-5') ||
        {}
      ).innerHTML || '(sidebar not found)';
      sendResult({
        chapter: CHAPTER, notes: [], timeout: true,
        reason: 'notes container not found after tab click',
        sidebarSnippet: sidebarHTML.substring(0, 500),
      });
      return;
    }

    // ── Step 4: Extract individual note blocks ──
    // Each note block is a child div with: date span, verse span, text div
    const notes = [];
    const noteBlocks = notesContainer.querySelectorAll(':scope > div');

    for (const block of noteBlocks) {
      const spans = block.querySelectorAll(':scope > span');
      const divs = block.querySelectorAll(':scope > div');

      if (spans.length < 2) continue; // Need at least date + verse ref

      const date = (spans[0]?.textContent || '').trim();
      const verseRef = (spans[1]?.textContent || '').trim();

      // Note text is in the first child div (skip the Edit/Delete buttons div)
      let text = '';
      for (const d of divs) {
        const content = (d.textContent || '').trim();
        // Skip the Edit/Delete controls
        if (content.match(/^(Edit|Delete|\\|\\s*)+$/i)) continue;
        if (content.length > 0) {
          text = content;
          break;
        }
      }

      if (verseRef) {
        notes.push({ verseRef, date, text });
      }
    }

    // If the block structure didn't match, try a more flexible approach
    if (notes.length === 0 && notesContainer.children.length > 0) {
      // Walk all text nodes looking for date + verse patterns
      const walker = document.createTreeWalker(notesContainer, NodeFilter.SHOW_ELEMENT);
      let currentNote = {};
      let node;
      while (node = walker.nextNode()) {
        const text = (node.textContent || '').trim();
        if (!text) continue;

        // Date pattern: YYYY/MM/DD or Month DD, YYYY
        if (text.match(/^\\d{4}\\/\\d{2}\\/\\d{2}$/) || text.match(/^[A-Z][a-z]+ \\d+/)) {
          if (currentNote.verseRef) notes.push({ ...currentNote });
          currentNote = { date: text, verseRef: '', text: '' };
        }
        // Verse ref pattern
        else if (text.match(/^\\d?\\s*[A-Z][a-z]+\\s+\\d+:\\d+/)) {
          currentNote.verseRef = text;
        }
        // Note text (longer content)
        else if (text.length > 3 && !text.match(/^(Edit|Delete)/i)) {
          if (currentNote.verseRef && !currentNote.text) {
            currentNote.text = text;
          }
        }
      }
      if (currentNote.verseRef) notes.push({ ...currentNote });
    }

    sendResult({ chapter: CHAPTER, notes, noteCount: notes.length });

    // ── Step 5: Report intercepted network requests for API discovery ──
    if (_intercepted.length > 0) {
      sendDebug({
        interceptedRequests: _intercepted.filter(r =>
          r.url.includes('biblegateway') || r.url.startsWith('/')
        ),
      });
    }

  } catch (e) {
    sendError({ message: 'Phase 2 error (' + CHAPTER + '): ' + e.message });
  }
})();
`
}

module.exports = { buildPhase1Script, buildPhase2Script }
