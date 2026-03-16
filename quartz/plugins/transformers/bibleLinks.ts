import { QuartzTransformerPlugin } from "../types"

const books: Record<string, string> = {
  // Old Testament
  "genesis": "Genesis", "gen": "Genesis",
  "exodus": "Exodus", "exod": "Exodus", "exo": "Exodus",
  "leviticus": "Leviticus", "lev": "Leviticus",
  "numbers": "Numbers", "num": "Numbers",
  "deuteronomy": "Deuteronomy", "deut": "Deuteronomy", "deu": "Deuteronomy",
  "joshua": "Joshua", "josh": "Joshua",
  "judges": "Judges", "judg": "Judges",
  "ruth": "Ruth",
  "1 samuel": "1+Samuel", "1 sam": "1+Samuel", "1sam": "1+Samuel",
  "2 samuel": "2+Samuel", "2 sam": "2+Samuel", "2sam": "2+Samuel",
  "1 kings": "1+Kings", "1kings": "1+Kings",
  "2 kings": "2+Kings", "2kings": "2+Kings",
  "1 chronicles": "1+Chronicles", "1 chron": "1+Chronicles", "1chron": "1+Chronicles",
  "2 chronicles": "2+Chronicles", "2 chron": "2+Chronicles", "2chron": "2+Chronicles",
  "ezra": "Ezra",
  "nehemiah": "Nehemiah", "neh": "Nehemiah",
  "job": "Job",
  "psalm": "Psalms", "psalms": "Psalms", "ps": "Psalms", "psa": "Psalms",
  "proverbs": "Proverbs", "prov": "Proverbs", "pro": "Proverbs",
  "ecclesiastes": "Ecclesiastes", "eccl": "Ecclesiastes", "ecc": "Ecclesiastes",
  "song of solomon": "Song+of+Solomon", "song": "Song+of+Solomon", "sos": "Song+of+Solomon",
  "isaiah": "Isaiah", "isa": "Isaiah",
  "jeremiah": "Jeremiah", "jer": "Jeremiah",
  "lamentations": "Lamentations", "lam": "Lamentations",
  "ezekiel": "Ezekiel", "ezek": "Ezekiel", "eze": "Ezekiel",
  "daniel": "Daniel", "dan": "Daniel",
  "hosea": "Hosea", "hos": "Hosea",
  "joel": "Joel",
  "amos": "Amos",
  "obadiah": "Obadiah", "obad": "Obadiah",
  "jonah": "Jonah", "jon": "Jonah",
  "micah": "Micah", "mic": "Micah",
  "nahum": "Nahum", "nah": "Nahum",
  "habakkuk": "Habakkuk", "hab": "Habakkuk",
  "zephaniah": "Zephaniah", "zeph": "Zephaniah",
  "haggai": "Haggai", "hag": "Haggai",
  "zechariah": "Zechariah", "zech": "Zechariah",
  "malachi": "Malachi", "mal": "Malachi",
  // New Testament
  "matthew": "Matthew", "matt": "Matthew", "mat": "Matthew",
  "mark": "Mark",
  "luke": "Luke",
  "john": "John",
  "acts": "Acts",
  "romans": "Romans", "rom": "Romans",
  "1 corinthians": "1+Corinthians", "1 cor": "1+Corinthians", "1cor": "1+Corinthians",
  "2 corinthians": "2+Corinthians", "2 cor": "2+Corinthians", "2cor": "2+Corinthians",
  "galatians": "Galatians", "gal": "Galatians",
  "ephesians": "Ephesians", "eph": "Ephesians",
  "philippians": "Philippians", "phil": "Philippians",
  "colossians": "Colossians", "col": "Colossians",
  "1 thessalonians": "1+Thessalonians", "1 thess": "1+Thessalonians", "1thess": "1+Thessalonians",
  "2 thessalonians": "2+Thessalonians", "2 thess": "2+Thessalonians", "2thess": "2+Thessalonians",
  "1 timothy": "1+Timothy", "1 tim": "1+Timothy", "1tim": "1+Timothy",
  "2 timothy": "2+Timothy", "2 tim": "2+Timothy", "2tim": "2+Timothy",
  "titus": "Titus", "tit": "Titus",
  "philemon": "Philemon", "phlm": "Philemon",
  "hebrews": "Hebrews", "heb": "Hebrews",
  "james": "James", "jas": "James",
  "1 peter": "1+Peter", "1 pet": "1+Peter", "1pet": "1+Peter",
  "2 peter": "2+Peter", "2 pet": "2+Peter", "2pet": "2+Peter",
  "1 john": "1+John", "1john": "1+John",
  "2 john": "2+John", "2john": "2+John",
  "3 john": "3+John", "3john": "3+John",
  "jude": "Jude",
  "revelation": "Revelation", "rev": "Revelation",
}

const bookPattern = Object.keys(books)
  .sort((a, b) => b.length - a.length)
  .map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join("|")

const verseRegex = new RegExp(
  `(?<![\\w/>"'])\\b(${bookPattern})\\s+(\\d+):(\\d+(?:-\\d+)?)(?!\\])`,
  "gi"
)

export const BibleLinks: QuartzTransformerPlugin = () => {
  return {
    name: "BibleLinks",
    textTransform(_ctx, src) {
      return src.replace(verseRegex, (match, book, chapter, verse) => {
        const bookKey = book.toLowerCase().trim()
        const bgBook = books[bookKey]
        if (!bgBook) return match
        const url = `https://www.biblegateway.com/passage/?search=${bgBook}+${chapter}%3A${verse}&version=KJV`
        return `[${match}](${url})`
      })
    },
  }
}