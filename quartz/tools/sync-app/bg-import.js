/**
 * BibleGateway import — processes exported notes into:
 *  content/.bg-connections.json — enriched cross-reference data for verseIndex
 *
 * Can be used as a module from main.js or as a CLI:
 *   node bg-import.js --input ~/Downloads/bg-notes.json --content ./content
 */

const fs = require('fs')
const path = require('path')

/**
 * Canonical book name map. Keys are lowercase aliases, values are canonical names.
 */
const bookAliases = {
  gen: 'Genesis', genesis: 'Genesis',
  exod: 'Exodus', exo: 'Exodus', exodus: 'Exodus',
  lev: 'Leviticus', leviticus: 'Leviticus',
  num: 'Numbers', numbers: 'Numbers',
  deut: 'Deuteronomy', deu: 'Deuteronomy', deuteronomy: 'Deuteronomy',
  josh: 'Joshua', joshua: 'Joshua',
  judg: 'Judges', judges: 'Judges',
  ruth: 'Ruth',
  '1 sam': '1 Samuel', '1sam': '1 Samuel', '1 samuel': '1 Samuel',
  '2 sam': '2 Samuel', '2sam': '2 Samuel', '2 samuel': '2 Samuel',
  '1 kings': '1 Kings', '1kings': '1 Kings',
  '2 kings': '2 Kings', '2kings': '2 Kings',
  '1 chron': '1 Chronicles', '1chron': '1 Chronicles', '1 chronicles': '1 Chronicles',
  '2 chron': '2 Chronicles', '2chron': '2 Chronicles', '2 chronicles': '2 Chronicles',
  ezra: 'Ezra', neh: 'Nehemiah', nehemiah: 'Nehemiah',
  esth: 'Esther', esther: 'Esther',
  job: 'Job', ps: 'Psalms', psa: 'Psalms', psalm: 'Psalms', psalms: 'Psalms',
  prov: 'Proverbs', pro: 'Proverbs', proverbs: 'Proverbs',
  eccl: 'Ecclesiastes', ecc: 'Ecclesiastes', ecclesiastes: 'Ecclesiastes',
  song: 'Song of Solomon', sos: 'Song of Solomon', 'song of solomon': 'Song of Solomon',
  isa: 'Isaiah', isaiah: 'Isaiah',
  jer: 'Jeremiah', jeremiah: 'Jeremiah',
  lam: 'Lamentations', lamentations: 'Lamentations',
  ezek: 'Ezekiel', eze: 'Ezekiel', ezekiel: 'Ezekiel',
  dan: 'Daniel', daniel: 'Daniel',
  hos: 'Hosea', hosea: 'Hosea',
  joel: 'Joel', amos: 'Amos',
  obad: 'Obadiah', obadiah: 'Obadiah',
  jon: 'Jonah', jonah: 'Jonah',
  mic: 'Micah', micah: 'Micah',
  nah: 'Nahum', nahum: 'Nahum',
  hab: 'Habakkuk', habakkuk: 'Habakkuk',
  zeph: 'Zephaniah', zephaniah: 'Zephaniah',
  hag: 'Haggai', haggai: 'Haggai',
  zech: 'Zechariah', zechariah: 'Zechariah',
  mal: 'Malachi', malachi: 'Malachi',
  matt: 'Matthew', mat: 'Matthew', matthew: 'Matthew',
  mark: 'Mark', luke: 'Luke',
  john: 'John', acts: 'Acts',
  rom: 'Romans', romans: 'Romans',
  '1 cor': '1 Corinthians', '1cor': '1 Corinthians', '1 corinthians': '1 Corinthians',
  '2 cor': '2 Corinthians', '2cor': '2 Corinthians', '2 corinthians': '2 Corinthians',
  gal: 'Galatians', galatians: 'Galatians',
  eph: 'Ephesians', ephesians: 'Ephesians',
  phil: 'Philippians', philippians: 'Philippians',
  col: 'Colossians', colossians: 'Colossians',
  '1 thess': '1 Thessalonians', '1thess': '1 Thessalonians', '1 thessalonians': '1 Thessalonians',
  '2 thess': '2 Thessalonians', '2thess': '2 Thessalonians', '2 thessalonians': '2 Thessalonians',
  '1 tim': '1 Timothy', '1tim': '1 Timothy', '1 timothy': '1 Timothy',
  '2 tim': '2 Timothy', '2tim': '2 Timothy', '2 timothy': '2 Timothy',
  tit: 'Titus', titus: 'Titus',
  phlm: 'Philemon', philemon: 'Philemon',
  heb: 'Hebrews', hebrews: 'Hebrews',
  jas: 'James', james: 'James',
  '1 pet': '1 Peter', '1pet': '1 Peter', '1 peter': '1 Peter',
  '2 pet': '2 Peter', '2pet': '2 Peter', '2 peter': '2 Peter',
  '1 john': '1 John', '1john': '1 John',
  '2 john': '2 John', '2john': '2 John',
  '3 john': '3 John', '3john': '3 John',
  jude: 'Jude',
  rev: 'Revelation', revelation: 'Revelation',
  // Apocrypha / Deuterocanonical
  wisdom: 'Wisdom', 'wisdom of solomon': 'Wisdom',
  sirach: 'Sirach', ecclesiasticus: 'Sirach',
  tobit: 'Tobit', judith: 'Judith',
  baruch: 'Baruch',
  '1 macc': '1 Maccabees', '1macc': '1 Maccabees', '1 maccabees': '1 Maccabees',
  '2 macc': '2 Maccabees', '2macc': '2 Maccabees', '2 maccabees': '2 Maccabees',
  '1 esdras': '1 Esdras', '2 esdras': '2 Esdras',
}

// Build the regex for scanning verse references in freeform text.
// Sort keys longest-first so "1 samuel" matches before "1 sam", etc.
const _bookKeys = Object.keys(bookAliases).sort((a, b) => b.length - a.length)
// Escape regex special chars in keys (handles entries like "1 sam")
const _bookPattern = _bookKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

// The regex matches:  bookName  number(s)  with optional :verse(-verse) and/or ,number(s)
// Examples matched: "hosea 8:11", "isaiah 6:9-10", "ephesians 2,5", "psalm 118", "1 cor 13:4"
const _refRegex = new RegExp(
  `(?:^|[^a-zA-Z])(${_bookPattern})\\s+(\\d+(?::\\d+(?:-\\d+)?)?(?:\\s*,\\s*\\d+)*)`,
  'gi'
)

/**
 * Normalize a single verse reference to canonical form.
 * "hosea 8:11" → "Hosea 8:11", "1 cor 13:4" → "1 Corinthians 13:4"
 */
function normalizeRef(raw) {
  const trimmed = raw.trim().replace(/[.?!…]+$/, '')
  // Match "Book Ch:V" or "Book Ch:V-V"
  const m = trimmed.match(/^(.+?)\s+(\d+:\d+(?:-\d+)?)$/i)
  if (m) {
    const bookKey = m[1].toLowerCase().trim()
    const canonical = bookAliases[bookKey]
    if (canonical) return `${canonical} ${m[2]}`
  }
  // Match "Book Ch"
  const cm = trimmed.match(/^(.+?)\s+(\d+)$/i)
  if (cm) {
    const bookKey = cm[1].toLowerCase().trim()
    const canonical = bookAliases[bookKey]
    if (canonical) return `${canonical} ${cm[2]}`
  }
  return trimmed
}

/**
 * Scan freeform text for all verse references.
 * Returns { connections: string[], observations: string[] }
 *
 * "hosea 8:11; ephesians 2,5; covering -> weave spider web" →
 *   connections: ["Hosea 8:11", "Ephesians 2", "Ephesians 5"]
 *   observations: ["covering -> weave spider web"]
 *
 * Comma after a chapter number (without colon) = multiple chapters:
 *   "ephesians 2,5" → ["Ephesians 2", "Ephesians 5"]
 * Colon = verse:
 *   "ephesians 2:5" → ["Ephesians 2:5"]
 */
function parseNoteText(text) {
  if (!text || !text.trim()) return { connections: [], observations: [] }

  const connections = []
  const matchRanges = [] // track character positions of matches

  // Reset regex state
  _refRegex.lastIndex = 0
  let match
  while ((match = _refRegex.exec(text)) !== null) {
    const bookRaw = match[1]
    const numPart = match[2]
    const bookKey = bookRaw.toLowerCase().trim()
    const canonical = bookAliases[bookKey]
    if (!canonical) continue

    // Track the position of this match in the original text
    // match[0] may start with a non-alpha char due to the lookbehind
    const fullMatchStart = match.index + (match[0].length - match[1].length - match[2].length - 1)
    const fullMatchEnd = match.index + match[0].length
    matchRanges.push([Math.max(0, match.index), fullMatchEnd])

    if (numPart.includes(':')) {
      // Has a colon: it's a verse or verse range (e.g., "8:11" or "6:9-10")
      connections.push(`${canonical} ${numPart}`)
    } else if (numPart.includes(',')) {
      // Has comma(s) but no colon: multiple chapters (e.g., "2,5" → ch 2 and ch 5)
      const chapters = numPart.split(/\s*,\s*/)
      for (const ch of chapters) {
        if (ch.trim()) connections.push(`${canonical} ${ch.trim()}`)
      }
    } else {
      // Plain chapter number
      connections.push(`${canonical} ${numPart}`)
    }
  }

  // Build observations from text that isn't part of any verse reference match
  const observations = []
  if (matchRanges.length > 0) {
    // Sort ranges by start position
    matchRanges.sort((a, b) => a[0] - b[0])

    // Collect text segments between/around matches
    const segments = []
    let pos = 0
    for (const [start, end] of matchRanges) {
      if (start > pos) segments.push(text.slice(pos, start))
      pos = end
    }
    if (pos < text.length) segments.push(text.slice(pos))

    // Clean up each segment and filter out empty/separator-only ones
    for (const seg of segments) {
      const cleaned = seg.replace(/^[\s;,]+|[\s;,]+$/g, '').trim()
      if (cleaned && cleaned.length > 1) {
        observations.push(cleaned)
      }
    }
  } else {
    // No verse refs found — the entire text is an observation
    const trimmed = text.trim()
    if (trimmed) observations.push(trimmed)
  }

  return { connections, observations }
}

/**
 * Import BG notes into the content directory.
 * @param {Array} notes - Array of { verseRef, text, date }
 * @param {string} contentDir - Path to the content directory
 * @returns {{ connectionsCount: number, notesCount: number, newCount: number, details: object }}
 */
function importNotes(notes, contentDir) {
  if (!notes || notes.length === 0) {
    return { connectionsCount: 0, notesCount: 0, newCount: 0, details: {} }
  }

  const output = {
    lastSync: new Date().toISOString(),
    noteCount: notes.length,
    notes: [],
    connections: {},
  }

  const sampleConnections = [] // for progress reporting

  for (const note of notes) {
    const verse = normalizeRef(note.verseRef)
    const { connections, observations } = parseNoteText(note.text || '')

    output.notes.push({
      verse,
      date: note.date || '',
      text: note.text || '',
      connections,
      observations,
    })

    // Build bidirectional connections map
    if (connections.length > 0) {
      if (!output.connections[verse]) output.connections[verse] = []
      const existingSet = new Set(output.connections[verse])

      for (const conn of connections) {
        // Forward: verse → conn
        if (!existingSet.has(conn) && conn !== verse) {
          output.connections[verse].push(conn)
          existingSet.add(conn)
        }

        // Reverse: conn → verse
        if (conn !== verse) {
          if (!output.connections[conn]) output.connections[conn] = []
          const reverseSet = new Set(output.connections[conn])
          if (!reverseSet.has(verse)) {
            output.connections[conn].push(verse)
          }
        }
      }

      // Collect sample for progress
      if (sampleConnections.length < 10) {
        sampleConnections.push({
          verse,
          connections: connections.slice(0, 5),
          observation: observations[0] || null,
        })
      }
    }
  }

  // Sort connection arrays for consistency
  for (const key of Object.keys(output.connections)) {
    output.connections[key].sort()
  }

  // Write the enriched JSON
  const bgPath = path.join(contentDir, '.bg-connections.json')
  fs.writeFileSync(bgPath, JSON.stringify(output, null, 2))

  const totalConnections = Object.keys(output.connections).length
  const notesWithConnections = output.notes.filter(n => n.connections.length > 0).length
  const notesWithObservationsOnly = output.notes.filter(n => n.connections.length === 0 && n.observations.length > 0).length

  return {
    connectionsCount: totalConnections,
    notesCount: notes.length,
    newCount: totalConnections,
    details: {
      notesWithConnections,
      notesWithObservationsOnly,
      notesWithNothing: notes.length - notesWithConnections - notesWithObservationsOnly,
      sampleConnections,
    },
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2)
  const inputIdx = args.indexOf('--input')
  const contentIdx = args.indexOf('--content')

  if (inputIdx === -1) {
    console.error('Usage: node bg-import.js --input <bg-notes.json> [--content <content-dir>]')
    process.exit(1)
  }

  const inputFile = args[inputIdx + 1]
  const contentDir = contentIdx !== -1 ? args[contentIdx + 1] : './content'

  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'))
  const notes = Array.isArray(data) ? data : data.notes || []
  const result = importNotes(notes, contentDir)

  console.log(`Imported ${result.notesCount} notes, ${result.connectionsCount} verse connections`)
  console.log(`  ${result.details.notesWithConnections} notes with verse connections`)
  console.log(`  ${result.details.notesWithObservationsOnly} notes with observations only`)
  console.log(`  ${result.details.notesWithNothing} notes with no parseable content`)

  if (result.details.sampleConnections.length > 0) {
    console.log('\nSample connections:')
    for (const s of result.details.sampleConnections) {
      console.log(`  ${s.verse} → ${s.connections.join(', ')}${s.observation ? ` (${s.observation})` : ''}`)
    }
  }
}

module.exports = { importNotes, normalizeRef, parseNoteText, bookAliases }
