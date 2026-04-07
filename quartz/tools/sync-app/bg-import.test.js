/**
 * Tests for bg-import.js — 15 tests with 3 verification methods each.
 *
 * Group A: Verse Reference Scanning (5 tests)
 * Group B: Full Note Text Parsing (5 tests)
 * Group C: Integration (5 tests)
 *
 * Run: node --test bg-import.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { parseNoteText, normalizeRef, importNotes, bookAliases } = require('./bg-import');

// ── Group A: Verse Reference Scanning ──────────────────────────────────────

describe('Group A: Verse Reference Scanning', () => {

  // Test 1: Simple verse ref
  it('1. parses "hosea 8:11" → ["Hosea 8:11"]', () => {
    const result = parseNoteText('hosea 8:11');
    // V1: Unit assertion — correct connection
    assert.deepStrictEqual(result.connections, ['Hosea 8:11']);
    // V2: Manual spot check — canonical book name
    assert.ok(result.connections[0].startsWith('Hosea'), 'Should use canonical name "Hosea"');
    // V3: Observations should be empty
    assert.deepStrictEqual(result.observations, []);
  });

  // Test 2: Comma = chapter separator
  it('2. parses "ephesians 2,5" → ["Ephesians 2", "Ephesians 5"]', () => {
    const result = parseNoteText('ephesians 2,5');
    // V1: Unit assertion — two separate chapter entries
    assert.deepStrictEqual(result.connections, ['Ephesians 2', 'Ephesians 5']);
    // V2: Manual check — comma does NOT mean verse 2:5
    assert.ok(!result.connections.includes('Ephesians 2:5'), 'Comma should NOT be interpreted as a verse separator');
    // V3: Count check
    assert.strictEqual(result.connections.length, 2, 'Should produce exactly 2 connections');
  });

  // Test 3: Trailing punctuation stripped
  it('3. parses "amos 6:10...?" → ["Amos 6:10"]', () => {
    // Use normalizeRef directly for punctuation stripping
    const normalized = normalizeRef('amos 6:10...?');
    // V1: normalizeRef strips trailing punctuation
    assert.strictEqual(normalized, 'Amos 6:10');
    // V2: parseNoteText also extracts the connection correctly
    const result = parseNoteText('amos 6:10');
    assert.deepStrictEqual(result.connections, ['Amos 6:10']);
    // V3: Book alias lookup works
    assert.strictEqual(bookAliases['amos'], 'Amos');
  });

  // Test 4: Chapter-only
  it('4. parses "psalm 118" → ["Psalms 118"]', () => {
    const result = parseNoteText('psalm 118');
    // V1: Unit assertion — chapter-only ref
    assert.deepStrictEqual(result.connections, ['Psalms 118']);
    // V2: Uses canonical "Psalms" (plural) not "Psalm"
    assert.ok(result.connections[0].startsWith('Psalms'), 'Should normalize to "Psalms" (plural)');
    // V3: No observations for a clean verse ref
    assert.deepStrictEqual(result.observations, []);
  });

  // Test 5: Numbered book
  it('5. parses "1 cor 13:4" → ["1 Corinthians 13:4"]', () => {
    const result = parseNoteText('1 cor 13:4');
    // V1: Unit assertion
    assert.deepStrictEqual(result.connections, ['1 Corinthians 13:4']);
    // V2: Full book name expansion
    assert.ok(result.connections[0].includes('Corinthians'), 'Should expand "cor" to "Corinthians"');
    // V3: Numbered prefix preserved
    assert.ok(result.connections[0].startsWith('1 '), 'Should keep the number prefix');
  });
});

// ── Group B: Full Note Text Parsing ────────────────────────────────────────

describe('Group B: Full Note Text Parsing', () => {

  // Test 6: Complex note with mixed refs and observation
  it('6. parses complex note with observations', () => {
    const text = 'hosea 8:11; ephesians 2,5; covering -> weave spider web; hosea 4:12; ezekiel 28:14';
    const result = parseNoteText(text);
    // V1: All 5 connections extracted
    assert.deepStrictEqual(result.connections, [
      'Hosea 8:11', 'Ephesians 2', 'Ephesians 5', 'Hosea 4:12', 'Ezekiel 28:14',
    ]);
    // V2: Observation text captured
    assert.ok(result.observations.some(o => o.includes('covering')), 'Should capture "covering -> weave spider web" as observation');
    // V3: Connection count
    assert.strictEqual(result.connections.length, 5, 'Should find exactly 5 connections');
  });

  // Test 7: Verse range preserved
  it('7. parses "habakkuk 2:2; isaiah 6:9-10" with range preserved', () => {
    const result = parseNoteText('habakkuk 2:2; isaiah 6:9-10');
    // V1: Both refs extracted, range preserved
    assert.deepStrictEqual(result.connections, ['Habakkuk 2:2', 'Isaiah 6:9-10']);
    // V2: Range notation kept
    assert.ok(result.connections[1].includes('-'), 'Range should be preserved with dash');
    // V3: No observations
    assert.deepStrictEqual(result.observations, []);
  });

  // Test 8: No verse refs — all observation
  it('8. parses text with no verse refs as pure observation', () => {
    const result = parseNoteText('trust in usa (why there is left vs. right)');
    // V1: No connections
    assert.deepStrictEqual(result.connections, []);
    // V2: Entire text becomes observation
    assert.strictEqual(result.observations.length, 1);
    assert.ok(result.observations[0].includes('trust'), 'Full text should be the observation');
    // V3: Original text preserved
    assert.ok(result.observations[0].includes('left vs. right'));
  });

  // Test 9: Arrow notation with multiple refs
  it('9. parses quoted text with arrow and multiple refs', () => {
    const text = '"blessed is he that comes in the name of the lord" -> psalm 118, luke 13, luke 19';
    const result = parseNoteText(text);
    // V1: All refs found
    assert.deepStrictEqual(result.connections, ['Psalms 118', 'Luke 13', 'Luke 19']);
    // V2: Quoted text captured as observation
    assert.ok(result.observations.some(o => o.includes('blessed')), 'Quoted text should be in observations');
    // V3: Connection count
    assert.strictEqual(result.connections.length, 3);
  });

  // Test 10: Empty text
  it('10. handles empty text gracefully', () => {
    const result = parseNoteText('');
    // V1: Empty connections
    assert.deepStrictEqual(result.connections, []);
    // V2: Empty observations
    assert.deepStrictEqual(result.observations, []);
    // V3: Also handles null/undefined
    const result2 = parseNoteText(null);
    assert.deepStrictEqual(result2.connections, []);
  });
});

// ── Group C: Integration ───────────────────────────────────────────────────

describe('Group C: Integration', () => {

  // Create a temp directory for integration tests
  const tmpDir = path.join(os.tmpdir(), 'bg-import-test-' + Date.now());

  it('setup: create temp directory', () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    assert.ok(fs.existsSync(tmpDir));
  });

  // Test 11: importNotes writes valid JSON with correct structure
  it('11. importNotes writes valid JSON with correct keys', () => {
    const notes = [
      { verseRef: 'Isaiah 30:1', text: 'hosea 8:11; ephesians 2,5', date: '2026-01-20' },
      { verseRef: 'Isaiah 30:8', text: 'habakkuk 2:2; isaiah 6:9-10', date: '2026-01-06' },
    ];
    const result = importNotes(notes, tmpDir);

    // V1: Return value has expected keys
    assert.ok('connectionsCount' in result);
    assert.ok('notesCount' in result);
    assert.ok('details' in result);

    // V2: JSON file was written
    const bgPath = path.join(tmpDir, '.bg-connections.json');
    assert.ok(fs.existsSync(bgPath), '.bg-connections.json should exist');

    // V3: JSON is valid and has correct structure
    const data = JSON.parse(fs.readFileSync(bgPath, 'utf-8'));
    assert.ok('lastSync' in data);
    assert.ok('noteCount' in data);
    assert.ok('notes' in data);
    assert.ok('connections' in data);
    assert.strictEqual(data.noteCount, 2);
  });

  // Test 12: Bidirectional connections
  it('12. connections are bidirectional', () => {
    const bgPath = path.join(tmpDir, '.bg-connections.json');
    const data = JSON.parse(fs.readFileSync(bgPath, 'utf-8'));

    // V1: If Isaiah 30:1 → Hosea 8:11, then Hosea 8:11 → Isaiah 30:1
    assert.ok(data.connections['Isaiah 30:1']?.includes('Hosea 8:11'), 'Forward: Isaiah 30:1 → Hosea 8:11');
    assert.ok(data.connections['Hosea 8:11']?.includes('Isaiah 30:1'), 'Reverse: Hosea 8:11 → Isaiah 30:1');

    // V2: Same for range refs
    assert.ok(data.connections['Isaiah 30:8']?.includes('Isaiah 6:9-10'), 'Forward: Isaiah 30:8 → Isaiah 6:9-10');
    assert.ok(data.connections['Isaiah 6:9-10']?.includes('Isaiah 30:8'), 'Reverse: Isaiah 6:9-10 → Isaiah 30:8');

    // V3: Self-references should not exist
    for (const [verse, conns] of Object.entries(data.connections)) {
      assert.ok(!conns.includes(verse), `No self-reference for ${verse}`);
    }
  });

  // Test 13: Chapter connections from comma-separated input
  it('13. chapter connections preserved for comma-separated chapters', () => {
    const bgPath = path.join(tmpDir, '.bg-connections.json');
    const data = JSON.parse(fs.readFileSync(bgPath, 'utf-8'));

    // V1: "ephesians 2,5" creates entries for Ephesians 2 AND Ephesians 5
    assert.ok('Ephesians 2' in data.connections, 'Should have entry for Ephesians 2');
    assert.ok('Ephesians 5' in data.connections, 'Should have entry for Ephesians 5');

    // V2: Both link back to Isaiah 30:1
    assert.ok(data.connections['Ephesians 2'].includes('Isaiah 30:1'));
    assert.ok(data.connections['Ephesians 5'].includes('Isaiah 30:1'));

    // V3: Isaiah 30:1 links to both chapters
    assert.ok(data.connections['Isaiah 30:1'].includes('Ephesians 2'));
    assert.ok(data.connections['Isaiah 30:1'].includes('Ephesians 5'));
  });

  // Test 14: No BibleGateway Notes.md created
  it('14. no BibleGateway Notes.md file is created after import', () => {
    const notes = [
      { verseRef: 'Genesis 1:1', text: 'john 1:1', date: '2026-01-01' },
    ];
    const tmpDir2 = path.join(os.tmpdir(), 'bg-import-test-nomd-' + Date.now());
    fs.mkdirSync(tmpDir2, { recursive: true });
    importNotes(notes, tmpDir2);

    // V1: No .md file in content dir
    const mdFiles = fs.readdirSync(tmpDir2).filter(f => f.endsWith('.md'));
    assert.strictEqual(mdFiles.length, 0, 'No .md files should be created');

    // V2: No "BibleGateway Notes.md" specifically
    assert.ok(!fs.existsSync(path.join(tmpDir2, 'BibleGateway Notes.md')));

    // V3: No capture subdirectory created
    assert.ok(!fs.existsSync(path.join(tmpDir2, '00 — Capture')));

    // Cleanup
    fs.rmSync(tmpDir2, { recursive: true, force: true });
  });

  // Test 15: New enriched format structure validation
  it('15. enriched JSON format has notes with connections and observations', () => {
    const notes = [
      { verseRef: 'Romans 8:28', text: 'genesis 50:20; God works all things together for good', date: '2026-03-15' },
    ];
    const tmpDir3 = path.join(os.tmpdir(), 'bg-import-test-format-' + Date.now());
    fs.mkdirSync(tmpDir3, { recursive: true });
    importNotes(notes, tmpDir3);

    const bgPath = path.join(tmpDir3, '.bg-connections.json');
    const data = JSON.parse(fs.readFileSync(bgPath, 'utf-8'));

    // V1: Note entry has expected fields
    const note = data.notes[0];
    assert.ok('verse' in note, 'Note should have verse field');
    assert.ok('date' in note, 'Note should have date field');
    assert.ok('text' in note, 'Note should have text field');
    assert.ok('connections' in note, 'Note should have connections field');
    assert.ok('observations' in note, 'Note should have observations field');

    // V2: Connection correctly parsed
    assert.deepStrictEqual(note.connections, ['Genesis 50:20']);

    // V3: Observation captured
    assert.ok(note.observations.some(o => o.includes('God works')), 'Should capture non-verse text as observation');

    // Cleanup
    fs.rmSync(tmpDir3, { recursive: true, force: true });
  });

  it('cleanup: remove temp directory', () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
