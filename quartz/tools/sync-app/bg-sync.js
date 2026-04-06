/**
 * BibleGateway sync — export logic.
 * This module returns a string of JavaScript to be injected into the
 * BibleGateway BrowserWindow via webContents.executeJavaScript().
 * It crawls the authenticated annotations page, fetches all notes,
 * and sends them back to the main process via IPC.
 */

/**
 * Builds the JavaScript string to inject into the BG BrowserWindow.
 * The injected script:
 *  1. Detects the annotations page
 *  2. Discovers total page count
 *  3. Crawls all pages, extracting note data
 *  4. Sends progress updates and final data via postMessage
 *
 * @param {object} opts
 * @param {number} [opts.resumeFromPage] - Page to resume from (0-based)
 * @returns {string} JavaScript code to execute in the BrowserWindow
 */
function buildExportScript(opts = {}) {
  const resumeFrom = opts.resumeFromPage || 0

  // This entire function body becomes a string to inject
  return `
(async function bgExport() {
  const RESUME_FROM = ${resumeFrom};
  const CONCURRENCY = 3;
  const BASE_URL = 'https://www.biblegateway.com/user/annotations/?iv=notes';
  const results = [];
  let totalPages = 1;
  let errorCount = 0;
  let backoffMs = 0;

  function sendProgress(data) {
    window.postMessage({ type: 'bg-progress', ...data }, '*');
  }

  function sendComplete(data) {
    window.postMessage({ type: 'bg-complete', ...data }, '*');
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
      <div id="bg-step" style="margin-bottom:6px;opacity:0.8;">Scanning pages...</div>
      <div style="background:#333;border-radius:4px;height:6px;overflow:hidden;margin-bottom:6px;">
        <div id="bg-bar" style="height:100%;background:#4CAF50;width:0%;transition:width 0.3s;border-radius:4px;"></div>
      </div>
      <div id="bg-stats" style="font-size:11px;opacity:0.6;">0 notes found</div>
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
    if (barEl) barEl.style.width = pct + '%';
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
    // Step 1: Detect total pages from first page
    updateUI('Step 1/2: Scanning pages...', 5, '');
    const firstPage = await fetchWithRetry(BASE_URL);
    const parser = new DOMParser();
    const doc = parser.parseFromString(firstPage, 'text/html');

    // Find pagination — look for last page number (broadened selectors)
    const pageLinks = doc.querySelectorAll('.pagination a, .pager a, [data-page], .page-numbers a, a[href*="page="], .paging a, nav.pagination a');
    if (pageLinks.length > 0) {
      for (const link of pageLinks) {
        const href = link.getAttribute('href') || '';
        const pageMatch = href.match(/page=(\\d+)/);
        if (pageMatch) totalPages = Math.max(totalPages, parseInt(pageMatch[1]));
        const text = link.textContent?.trim();
        if (text && /^\\d+$/.test(text)) totalPages = Math.max(totalPages, parseInt(text));
      }
    }

    sendProgress({ step: 'scan', totalPages });
    updateUI('Step 1/2: Found ' + totalPages + ' pages', 10, '');

    // Step 2: Crawl all pages
    const pages = [];
    for (let p = RESUME_FROM; p < totalPages; p++) {
      pages.push(p + 1);
    }

    let completed = 0;
    const processPage = async (pageNum) => {
      if (cancelled) return;
      const url = BASE_URL + '&page=' + pageNum;
      const html = await fetchWithRetry(url);
      const pageDoc = parser.parseFromString(html, 'text/html');

      // Extract notes — BG uses various selectors depending on version
      // Strategy 1: Try known annotation container selectors
      let noteEls = pageDoc.querySelectorAll(
        '.annotation-item, .note-item, [data-annotation-id], .user-annotation, .annotation-row, .note-row, .user-note, .activity-item'
      );

      // Strategy 2: If nothing found, try table rows within annotation sections
      if (noteEls.length === 0) {
        noteEls = pageDoc.querySelectorAll('table tr[data-id], table.annotations tr, .annotations-table tr, .notes-container > div, .notes-list > li, .notes-list > div');
      }

      // Strategy 3: Broader fallback — look for any elements containing verse references
      if (noteEls.length === 0) {
        noteEls = pageDoc.querySelectorAll('[data-reference], [data-verse], .reference-container, .passage-display + .note');
      }

      // Log selector match counts for debugging
      const selectorCounts = {
        strategy1: pageDoc.querySelectorAll('.annotation-item, .note-item, [data-annotation-id], .user-annotation, .annotation-row, .note-row').length,
        strategy2: pageDoc.querySelectorAll('table tr[data-id], .notes-container > div, .notes-list > li').length,
        strategy3: pageDoc.querySelectorAll('[data-reference], [data-verse]').length,
        allTables: pageDoc.querySelectorAll('table').length,
        allListItems: pageDoc.querySelectorAll('li').length,
        allAnchors: pageDoc.querySelectorAll('a[href*="passage"]').length,
      };
      console.log('BG selector counts page ' + pageNum + ':', JSON.stringify(selectorCounts));

      for (const noteEl of noteEls) {
        // Try multiple selector strategies for verse references
        const verseRef = (
          noteEl.querySelector('.verse-ref, .annotation-verse, .reference, .passage-ref, [data-reference]')?.textContent?.trim() ||
          noteEl.querySelector('a[href*="passage"]')?.textContent?.trim() ||
          noteEl.getAttribute('data-reference') ||
          noteEl.getAttribute('data-verse')
        );
        const noteText = (
          noteEl.querySelector('.note-text, .annotation-text, .note-content, .text, .body, .content')?.textContent?.trim() ||
          noteEl.querySelector('td:nth-child(2), .note-body')?.textContent?.trim()
        );
        const dateEl = noteEl.querySelector('.date, .annotation-date, time, .timestamp');
        const date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim();

        if (verseRef) {
          const note = { verseRef, text: noteText || '', date: date || '' };
          results.push(note);
          if (previewEl) previewEl.textContent = verseRef + ': ' + (noteText || '').slice(0, 60);
        }
      }

      // If still no notes found on first page, send debug info
      if (noteEls.length === 0 && pageNum === 1) {
        const bodySnippet = pageDoc.body?.innerHTML?.slice(0, 2000) || '(empty)';
        console.log('BG: No note elements found on page 1. Body snippet:', bodySnippet);
        sendProgress({
          step: 'warning',
          message: 'No note elements found on page ' + pageNum + '. Run Debug BG Sync to inspect.',
          selectorCounts,
        });
      }

      completed++;
      const pct = 10 + Math.round((completed / pages.length) * 85);
      updateUI(
        'Step 2/2: Fetching page ' + completed + '/' + pages.length,
        pct,
        results.length + ' notes found · ' + completed + '/' + pages.length + ' pages'
      );
      sendProgress({ step: 'fetch', page: pageNum, completed, total: pages.length, noteCount: results.length });
    };

    // Process pages with limited concurrency
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
      // Save progress for resume
      sendProgress({ step: 'cancelled', completedPages: completed, totalPages, notesSoFar: results.length });
      updateUI('Cancelled', 0, results.length + ' notes collected (partial)');
      overlay.remove();
      return;
    }

    updateUI('Complete!', 100, results.length + ' notes exported');
    sendComplete({ notes: results, totalPages, totalNotes: results.length });

    setTimeout(() => overlay.remove(), 3000);
  } catch (e) {
    sendError({ message: e.message });
    updateUI('Error: ' + e.message, 0, '');
  }
})();
`
}

module.exports = { buildExportScript }
