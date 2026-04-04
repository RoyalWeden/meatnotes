/**
 * BibleGateway import — processes exported notes into:
 *  1. content/.bg-connections.json — cross-reference data for verseIndex
 *  2. content/00 — Capture/BibleGateway Notes.md — readable note file
 *
 * Can be used as a module from main.js or as a CLI:
 *   node bg-import.js --input ~/Downloads/bg-notes.json --content ./content
 */

const fs = require('fs')
const path = require('path')

/**
 * Normalize a verse reference to a canonical form.
 * "John 3:16" → "John 3:16", "1 Cor 13:4" → "1 Corinthians 13:4"
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
}

function normalizeRef(raw) {
  const trimmed = raw.trim()
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
 * Import BG notes into the content directory.
 * @param {Array} notes - Array of { verseRef, text, date }
 * @param {string} contentDir - Path to the content directory
 * @returns {{ connectionsCount: number, notesCount: number, newCount: number }}
 */
function importNotes(notes, contentDir) {
  if (!notes || notes.length === 0) {
    return { connectionsCount: 0, notesCount: 0, newCount: 0 }
  }

  // Build connections map: verse → set of other verses from same note session
  const connections = {}
  // Group notes by verse
  const byVerse = new Map()

  for (const note of notes) {
    const ref = normalizeRef(note.verseRef)
    if (!byVerse.has(ref)) byVerse.set(ref, [])
    byVerse.get(ref).push(note)
  }

  // Cross-reference: verses that appear close together (by date) are connected
  const sortedNotes = [...notes].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0
    const db = b.date ? new Date(b.date).getTime() : 0
    return da - db
  })

  // Simple heuristic: notes within 1 hour of each other are "related"
  const HOUR = 60 * 60 * 1000
  for (let i = 0; i < sortedNotes.length; i++) {
    const a = sortedNotes[i]
    const aRef = normalizeRef(a.verseRef)
    const aTime = a.date ? new Date(a.date).getTime() : 0
    if (!aTime) continue

    if (!connections[aRef]) connections[aRef] = new Set()

    for (let j = i + 1; j < sortedNotes.length; j++) {
      const b = sortedNotes[j]
      const bTime = b.date ? new Date(b.date).getTime() : 0
      if (!bTime) continue
      if (bTime - aTime > HOUR) break

      const bRef = normalizeRef(b.verseRef)
      if (aRef !== bRef) {
        connections[aRef].add(bRef)
        if (!connections[bRef]) connections[bRef] = new Set()
        connections[bRef].add(aRef)
      }
    }
  }

  // Load existing connections and merge
  const bgPath = path.join(contentDir, '.bg-connections.json')
  let existing = {}
  try {
    if (fs.existsSync(bgPath)) {
      existing = JSON.parse(fs.readFileSync(bgPath, 'utf-8'))
    }
  } catch {}

  let newCount = 0
  const merged = { ...existing }
  for (const [verse, conns] of Object.entries(connections)) {
    const existingSet = new Set(merged[verse] || [])
    const before = existingSet.size
    for (const c of conns) existingSet.add(c)
    merged[verse] = [...existingSet].sort()
    newCount += existingSet.size - before
  }

  fs.writeFileSync(bgPath, JSON.stringify(merged, null, 2))

  // Generate BibleGateway Notes markdown
  const captureDir = path.join(contentDir, '00 — Capture')
  if (!fs.existsSync(captureDir)) {
    fs.mkdirSync(captureDir, { recursive: true })
  }

  const now = new Date().toISOString().slice(0, 10)
  let md = `---\ntitle: BibleGateway Notes\ndate: ${now}\n---\n\n`
  md += `> Imported ${notes.length} notes from BibleGateway on ${now}\n\n`

  // Group by book for readability
  const byBook = new Map()
  for (const [ref, noteList] of byVerse) {
    const book = ref.replace(/\s+\d.*/, '')
    if (!byBook.has(book)) byBook.set(book, [])
    byBook.get(book).push({ ref, notes: noteList })
  }

  for (const [book, entries] of byBook) {
    md += `## ${book}\n\n`
    for (const { ref, notes: noteList } of entries) {
      md += `### ${ref}\n\n`
      for (const n of noteList) {
        if (n.text) md += `${n.text}\n\n`
        if (n.date) md += `*${n.date}*\n\n`
      }
    }
  }

  const mdPath = path.join(captureDir, 'BibleGateway Notes.md')
  fs.writeFileSync(mdPath, md)

  return {
    connectionsCount: Object.keys(merged).length,
    notesCount: notes.length,
    newCount,
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
  console.log(`Imported ${result.notesCount} notes, ${result.connectionsCount} connections (${result.newCount} new)`)
}

module.exports = { importNotes, normalizeRef }
