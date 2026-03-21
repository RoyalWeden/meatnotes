---
title: Jeremiah Septuagint Order
---

<style>
.jer-page { font-family: var(--bodyFont); max-width: 680px; margin: 0 auto; }

/* ── Converter card ── */
.jer-converter {
  border: 1px solid var(--lightgray);
  border-radius: 12px;
  padding: 1.25rem 1.5rem 1.4rem;
  margin-bottom: 2rem;
  background: var(--light);
}
.jer-converter h2 {
  margin: 0 0 0.9rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--gray);
}
.jer-direction {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 1rem;
}
.jer-direction button {
  flex: 1;
  padding: 0.4rem 0.7rem;
  border-radius: 6px;
  border: 1px solid var(--lightgray);
  background: transparent;
  color: var(--darkgray);
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.jer-direction button.active {
  background: var(--secondary);
  color: var(--light);
  border-color: var(--secondary);
}
.jer-inputs {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}
.jer-inputs label {
  font-size: 0.8rem;
  color: var(--gray);
  white-space: nowrap;
}
.jer-inputs input {
  width: 60px;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--lightgray);
  background: var(--light);
  color: var(--dark);
  font-size: 0.9rem;
  font-family: var(--codeFont);
  text-align: center;
}
.jer-inputs input:focus {
  outline: none;
  border-color: var(--secondary);
}
.jer-arrow {
  font-size: 1.1rem;
  color: var(--gray);
  margin: 0 0.15rem;
}
.jer-output {
  margin-top: 0.85rem;
  min-height: 1.6rem;
  font-size: 1rem;
  font-family: var(--codeFont);
  font-weight: 600;
  color: var(--secondary);
}
.jer-output.wanting {
  color: var(--gray);
  font-style: italic;
  font-weight: 400;
  font-family: var(--bodyFont);
  font-size: 0.88rem;
}
.jer-note {
  margin-top: 0.3rem;
  font-size: 0.78rem;
  color: var(--gray);
  font-family: var(--bodyFont);
  font-weight: 400;
}

/* ── Reference table ── */
.jer-table-wrap { overflow-x: auto; }
.jer-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}
.jer-table th {
  text-align: left;
  padding: 0.45rem 0.8rem;
  border-bottom: 2px solid var(--lightgray);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gray);
}
.jer-table td {
  padding: 0.32rem 0.8rem;
  border-bottom: 1px solid var(--lightgray);
  font-family: var(--codeFont);
  color: var(--dark);
}
.jer-table tr.wanting td {
  opacity: 0.45;
  font-style: italic;
  font-family: var(--bodyFont);
}
.jer-table tr:last-child td { border-bottom: none; }
.jer-table tr:hover td { background: var(--highlight); }
.jer-table tr.wanting:hover td { background: transparent; }

/* ── Output links ── */
.jer-output a {
  color: var(--secondary);
  text-decoration: none;
  font-weight: 600;
  font-family: var(--codeFont);
  font-size: 1rem;
}
.jer-output a:hover { text-decoration: underline; }
.jer-out-sep {
  color: var(--gray);
  font-family: var(--bodyFont);
  font-weight: 400;
  font-size: 0.85rem;
  margin: 0 0.25rem;
}
.jer-wanting-note {
  color: var(--gray);
  font-style: italic;
  font-weight: 400;
  font-family: var(--bodyFont);
  font-size: 0.88rem;
}
.jer-wanting-note a {
  color: var(--secondary);
  font-style: normal;
  font-family: var(--bodyFont);
  font-size: 0.88rem;
  font-weight: 400;
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 2px;
}

@media (max-width: 480px) {
  .jer-converter { padding: 1rem; }
  .jer-inputs input { width: 52px; }
}
</style>

<div class="jer-page">

<p style="font-size:0.9rem;color:var(--gray);margin-bottom:1.8rem;">The Septuagint (LXX) reorganizes Jeremiah significantly from chapter 25 onward — oracles are reordered and some passages are absent. Chapters 1–24 are identical in both traditions.</p>

<div class="jer-converter">
  <h2>Reference Converter</h2>
  <div class="jer-direction">
    <button id="jer-btn-heb" class="active" onclick="jerSetDir('heb')">Hebrew / English → LXX</button>
    <button id="jer-btn-lxx" onclick="jerSetDir('lxx')">LXX → Hebrew / English</button>
  </div>
  <div class="jer-inputs">
    <label id="jer-lbl-ch">Hebrew ch</label>
    <input id="jer-ch" type="number" min="1" max="52" placeholder="ch" oninput="jerConvert()" />
    <label id="jer-lbl-v">verse</label>
    <input id="jer-v" type="text" placeholder="v or v–v" oninput="jerConvert()" style="width:80px;" />
    <span class="jer-arrow">→</span>
  </div>
  <div id="jer-output" class="jer-output" style="color:var(--gray);font-style:italic;font-weight:400;font-family:var(--bodyFont);font-size:0.88rem;">Enter a chapter to convert</div>
  <div id="jer-note" class="jer-note"></div>
</div>

<div class="jer-table-wrap">
<table class="jer-table">
<thead>
<tr><th>Hebrew / English</th><th>Septuagint (LXX)</th></tr>
</thead>
<tbody>
<tr><td>1–24</td><td>1–24 (same)</td></tr>
<tr><td>25:1–13</td><td>25:1–13</td></tr>
<tr><td>25:14–end</td><td>32 (verse − 13)</td></tr>
<tr><td>26</td><td>33</td></tr>
<tr><td>27:1–18</td><td>34:1–18</td></tr>
<tr class="wanting"><td>27:19–end</td><td>— (wanting)</td></tr>
<tr><td>28</td><td>35</td></tr>
<tr><td>29</td><td>36</td></tr>
<tr><td>30</td><td>37</td></tr>
<tr><td>31</td><td>38</td></tr>
<tr><td>32</td><td>39</td></tr>
<tr><td>33:1–13</td><td>40:1–13</td></tr>
<tr class="wanting"><td>33:14–end</td><td>— (wanting)</td></tr>
<tr><td>34</td><td>41</td></tr>
<tr><td>35</td><td>42</td></tr>
<tr><td>36</td><td>43</td></tr>
<tr><td>37</td><td>44</td></tr>
<tr><td>38</td><td>45</td></tr>
<tr><td>39:1–3, 14–18</td><td>46 (v14+ offset by −10)</td></tr>
<tr class="wanting"><td>39:4–13</td><td>— (wanting)</td></tr>
<tr><td>40</td><td>47</td></tr>
<tr><td>41</td><td>48</td></tr>
<tr><td>42</td><td>49</td></tr>
<tr><td>43</td><td>50</td></tr>
<tr><td>44</td><td>51:1–31</td></tr>
<tr><td>45</td><td>51:31–end (verse + 30)</td></tr>
<tr><td>46</td><td>26</td></tr>
<tr><td>47</td><td>29</td></tr>
<tr><td>48:1–45</td><td>31:1–45</td></tr>
<tr class="wanting"><td>48:46–end</td><td>— (wanting)</td></tr>
<tr><td>49:1–5</td><td>30:1–5</td></tr>
<tr class="wanting"><td>49:6</td><td>— (wanting)</td></tr>
<tr><td>49:7–23</td><td>29:7–23</td></tr>
<tr><td>49:23–33</td><td>30 (verse order varies)</td></tr>
<tr><td>49:34–end</td><td>25:13–end (verse − 21)</td></tr>
<tr><td>50</td><td>27</td></tr>
<tr><td>51</td><td>28</td></tr>
<tr><td>52</td><td>52</td></tr>
</tbody>
</table>
</div>

</div>

<script>
(function () {
  // NOTE: no < or && in this script — HTML-escaped by rehype inside markdown script blocks.
  // Use >= (swapped operands) instead of <=, ternary instead of &&.

  // ── Helpers ───────────────────────────────────────────────────────────────
  function padCh(n) { return n >= 10 ? '' + n : '0' + n; }

  function ebUrl(lxxCh, lxxV, lxxVEnd) {
    var code = 'JER' + padCh(lxxCh) + '.htm';
    var base = 'https://ebible.org/eng-Brenton/' + code;
    return lxxV !== undefined ? base + '#:~:text=' + lxxV : base;
  }

  function bgUrl(hebCh, hebV, hebVEnd) {
    var ref = 'Jer+' + hebCh;
    if (hebV !== undefined) ref += '%3A' + hebV;
    return 'https://www.biblegateway.com/passage/?search=' + ref + '&version=KJV';
  }

  function aLink(href, label) {
    return '\u003ca href="' + href + '" target="_blank" rel="noopener"\u003e' + label + ' \u2197\u003c/a\u003e';
  }

  // ── Parse verse input: "14" or "14-17" or "14–17" ────────────────────────
  function parseVerse(str) {
    if (!str || str.trim() === '') return { s: undefined, e: undefined };
    var s = str.trim().replace(/\u2013|\u2014/g, '-');
    var parts = s.split('-');
    var a = parseInt(parts[0], 10);
    var b = parts.length >= 2 ? parseInt(parts[1], 10) : a;
    if (isNaN(a)) return { s: undefined, e: undefined };
    if (isNaN(b)) b = a;
    return { s: a, e: b };
  }

  // ── Mapping: Hebrew → LXX (verse-level) ──────────────────────────────────
  function hebToLxx(ch, v) {
    var hv = v || 0;
    if (24 >= ch) return { ch: ch, v: v };
    switch (ch) {
      case 25:
        if (hv === 0 || 13 >= hv) return { ch: 25, v: v };
        return { ch: 32, v: v ? v - 13 : undefined };
      case 26: return { ch: 33, v: v };
      case 27:
        if (hv === 0 || 18 >= hv) return { ch: 34, v: v };
        return { wanting: true };
      case 28: return { ch: 35, v: v };
      case 29: return { ch: 36, v: v };
      case 30: return { ch: 37, v: v };
      case 31: return { ch: 38, v: v };
      case 32: return { ch: 39, v: v };
      case 33:
        if (hv === 0 || 13 >= hv) return { ch: 40, v: v };
        return { wanting: true };
      case 34: return { ch: 41, v: v };
      case 35: return { ch: 42, v: v };
      case 36: return { ch: 43, v: v };
      case 37: return { ch: 44, v: v };
      case 38: return { ch: 45, v: v };
      case 39:
        if (hv === 0 || 3 >= hv) return { ch: 46, v: v };
        if (13 >= hv) return { wanting: true };
        return { ch: 46, v: v ? v - 10 : undefined };
      case 40: return { ch: 47, v: v };
      case 41: return { ch: 48, v: v };
      case 42: return { ch: 49, v: v };
      case 43: return { ch: 50, v: v };
      case 44: return { ch: 51, v: v };
      case 45: return { ch: 51, v: v ? v + 30 : undefined };
      case 46: return { ch: 26, v: v };
      case 47: return { ch: 29, v: v };
      case 48:
        if (hv === 0 || 45 >= hv) return { ch: 31, v: v };
        return { wanting: true };
      case 49:
        if (hv === 0) return { ch: 30, v: undefined };
        if (5 >= hv) return { ch: 30, v: v };
        if (hv === 6) return { wanting: true };
        if (23 >= hv) return { ch: 29, v: v };
        if (33 >= hv) return { ch: 30, v: undefined };
        return { ch: 25, v: v ? v - 21 : undefined };
      case 50: return { ch: 27, v: v };
      case 51: return { ch: 28, v: v };
      case 52: return { ch: 52, v: v };
      default: return { ch: ch, v: v };
    }
  }

  // Iterate a verse range through the map, grouping consecutive verses with same LXX chapter.
  // Returns array of segments: { lxxCh, startV, endV, hebCh, wanting, wantingStart, wantingEnd }
  function iterHebRange(hebCh, vStart, vEnd) {
    if (vStart === undefined) {
      var r = hebToLxx(hebCh, undefined);
      return [{ lxxCh: r.ch, startV: undefined, endV: undefined, hebCh: hebCh, wanting: r.wanting || false }];
    }
    var segs = [];
    var cur = null;
    for (var v = vStart; vEnd >= v; v++) {
      var r = hebToLxx(hebCh, v);
      var lxxCh = r.wanting ? null : r.ch;
      var lxxV = r.wanting ? null : r.v;
      if (cur === null) {
        cur = { lxxCh: lxxCh, startHebV: v, endHebV: v, startLxxV: lxxV, endLxxV: lxxV, wanting: r.wanting || false };
      } else if (cur.lxxCh === lxxCh) {
        cur.endHebV = v;
        cur.endLxxV = lxxV;
      } else {
        segs.push(cur);
        cur = { lxxCh: lxxCh, startHebV: v, endHebV: v, startLxxV: lxxV, endLxxV: lxxV, wanting: r.wanting || false };
      }
    }
    if (cur !== null) segs.push(cur);
    return segs;
  }

  // ── Reverse map: LXX → Hebrew ─────────────────────────────────────────────
  var lxxMap = {};
  function addLxx(lxxCh, hebCh, vMin, vMax, vOffset) {
    if (!lxxMap[lxxCh]) lxxMap[lxxCh] = [];
    lxxMap[lxxCh].push({ hebCh: hebCh, vMin: vMin, vMax: vMax, vOffset: vOffset || 0 });
  }
  for (var i = 1; 24 >= i; i++) addLxx(i, i, 0, 999, 0);
  addLxx(25, 25, 0, 13, 0);
  addLxx(25, 49, 14, 999, 21);   // LXX 25:14+ = Heb 49:34+; Heb v = LXX v + 21
  addLxx(26, 46, 0, 999, 0);
  addLxx(27, 50, 0, 999, 0);
  addLxx(28, 51, 0, 999, 0);
  addLxx(29, 47, 0, 999, 0);
  addLxx(29, 49, 7, 23, 0);
  addLxx(30, 49, 1, 5, 0);
  addLxx(30, 49, 23, 33, 0);
  addLxx(31, 48, 1, 45, 0);
  addLxx(32, 25, 1, 999, 13);   // LXX 32:1+ = Heb 25:14+; Heb v = LXX v + 13
  addLxx(33, 26, 0, 999, 0);
  addLxx(34, 27, 1, 18, 0);
  addLxx(35, 28, 0, 999, 0);
  addLxx(36, 29, 0, 999, 0);
  addLxx(37, 30, 0, 999, 0);
  addLxx(38, 31, 0, 999, 0);
  addLxx(39, 32, 0, 999, 0);
  addLxx(40, 33, 1, 13, 0);
  addLxx(41, 34, 0, 999, 0);
  addLxx(42, 35, 0, 999, 0);
  addLxx(43, 36, 0, 999, 0);
  addLxx(44, 37, 0, 999, 0);
  addLxx(45, 38, 0, 999, 0);
  addLxx(46, 39, 1, 3, 0);
  addLxx(46, 39, 14, 18, 10);   // LXX v = Heb v - 10, so Heb v = LXX v + 10
  addLxx(47, 40, 0, 999, 0);
  addLxx(48, 41, 0, 999, 0);
  addLxx(49, 42, 0, 999, 0);
  addLxx(50, 43, 0, 999, 0);
  addLxx(51, 44, 0, 31, 0);
  addLxx(51, 45, 31, 999, -30); // LXX v = Heb v + 30, so Heb v = LXX v - 30
  addLxx(52, 52, 0, 999, 0);

  function lxxToHeb(lxxCh, lxxV) {
    var entries = lxxMap[lxxCh];
    if (!entries || entries.length === 0) return [];
    if (lxxV === undefined) {
      var seen = {};
      var out = [];
      entries.forEach(function(e) {
        if (!seen[e.hebCh]) { seen[e.hebCh] = true; out.push({ hebCh: e.hebCh, hebV: undefined }); }
      });
      return out;
    }
    var results = [];
    entries.forEach(function(e) {
      if (lxxV >= e.vMin ? e.vMax >= lxxV : false) {
        var hebV = e.vOffset !== 0 ? lxxV + e.vOffset : lxxV;
        results.push({ hebCh: e.hebCh, hebV: hebV });
      }
    });
    return results;
  }

  // ── UI logic ──────────────────────────────────────────────────────────────
  var dir = 'heb';

  window.jerSetDir = function(d) {
    dir = d;
    document.getElementById('jer-btn-heb').classList.toggle('active', d === 'heb');
    document.getElementById('jer-btn-lxx').classList.toggle('active', d === 'lxx');
    document.getElementById('jer-lbl-ch').textContent = d === 'heb' ? 'Hebrew ch' : 'LXX ch';
    // Preserve chapter/verse values — do NOT clear them
    jerConvert();
  };

  window.jerConvert = function() {
    var chVal = parseInt(document.getElementById('jer-ch').value, 10);
    var vStr = document.getElementById('jer-v').value;
    var vr = parseVerse(vStr);
    var out = document.getElementById('jer-output');
    var noteEl = document.getElementById('jer-note');
    out.className = 'jer-output';
    noteEl.textContent = '';

    var S = '\u003cspan class="jer-wanting-note"\u003e';
    var ES = '\u003c/span\u003e';
    var SEP = '\u003cspan class="jer-out-sep"\u003e / \u003c/span\u003e';

    if (isNaN(chVal)) {
      out.innerHTML = S + 'Enter a chapter to convert' + ES;
      return;
    }

    if (dir === 'heb') {
      if (1 > chVal || chVal > 52) {
        out.innerHTML = S + 'Jeremiah has chapters 1\u201352' + ES;
        return;
      }

      if (vr.s === undefined) {
        // Chapter-only
        var r0 = hebToLxx(chVal, undefined);
        if (r0.wanting) {
          out.innerHTML = S + 'Not in the Septuagint \u2014 ' + aLink(bgUrl(chVal, undefined), 'Jeremiah ' + chVal + ' (KJV)') + ES;
        } else {
          var lbl0 = 'Jeremiah ' + r0.ch + ' (LXX)';
          out.innerHTML = aLink(ebUrl(r0.ch, undefined), lbl0);
        }
        return;
      }

      // Verse range
      var segs = iterHebRange(chVal, vr.s, vr.e);
      var parts = [];
      segs.forEach(function(seg) {
        if (seg.wanting) {
          var wHebRef = 'Jeremiah ' + chVal + ':' + seg.startHebV + (seg.endHebV !== seg.startHebV ? '\u2013' + seg.endHebV : '');
          parts.push(S + 'v.' + seg.startHebV + (seg.endHebV !== seg.startHebV ? '\u2013' + seg.endHebV : '') + ' \u2014 not in Septuagint \u2014 ' + aLink(bgUrl(chVal, seg.startHebV, seg.endHebV), wHebRef + ' (KJV)') + ES);
        } else {
          var vs = seg.startLxxV;
          var ve = seg.endLxxV;
          var vPart = vs !== undefined ? ':' + vs + (ve !== vs ? '\u2013' + ve : '') : '';
          var lbl = 'Jeremiah ' + seg.lxxCh + vPart + ' (LXX)';
          parts.push(aLink(ebUrl(seg.lxxCh, vs, ve), lbl));
        }
      });
      out.innerHTML = parts.join(SEP);

    } else {
      // LXX → Hebrew
      if (1 > chVal || chVal > 52) {
        out.innerHTML = S + 'LXX Jeremiah has chapters 1\u201352' + ES;
        return;
      }

      var lxxV = vr.s;
      var lxxVEnd = vr.e;

      if (lxxV === undefined) {
        var matches0 = lxxToHeb(chVal, undefined);
        if (matches0.length === 0) {
          out.innerHTML = S + 'Not found in Hebrew Jeremiah' + ES;
          return;
        }
        var pAll = matches0.map(function(m) {
          var lbl2 = 'Jeremiah ' + m.hebCh;
          return aLink(bgUrl(m.hebCh, undefined), lbl2 + ' (KJV)');
        });
        out.innerHTML = pAll.join(SEP);
        return;
      }

      // Verse (or range) — iterate each LXX verse
      var segMap = {};
      var segOrder = [];
      for (var lv = lxxV; lxxVEnd >= lv; lv++) {
        var hits = lxxToHeb(chVal, lv);
        hits.forEach(function(m) {
          var key = m.hebCh;
          if (!segMap[key]) { segMap[key] = { hebCh: m.hebCh, startV: m.hebV, endV: m.hebV }; segOrder.push(key); }
          else {
            if (m.hebV !== undefined) {
              if (segMap[key].startV === undefined || m.hebV >= segMap[key].startV ? false : true) segMap[key].startV = m.hebV;
              if (segMap[key].endV === undefined || m.hebV >= segMap[key].endV) segMap[key].endV = m.hebV;
            }
          }
        });
      }
      if (segOrder.length === 0) {
        out.innerHTML = S + 'Not found in Hebrew Jeremiah' + ES;
        return;
      }
      var pRev = segOrder.map(function(key) {
        var seg2 = segMap[key];
        var vPart2 = seg2.startV !== undefined ? ':' + seg2.startV + (seg2.endV !== seg2.startV ? '\u2013' + seg2.endV : '') : '';
        var lbl3 = 'Jeremiah ' + seg2.hebCh + vPart2;
        return aLink(bgUrl(seg2.hebCh, seg2.startV, seg2.endV), lbl3 + ' (KJV)');
      });
      out.innerHTML = pRev.join(SEP);
    }
  };
})();
</script>
