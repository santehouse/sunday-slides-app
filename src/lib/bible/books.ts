/**
 * The 66 books of the Protestant canon, in canonical order, with the French names used by
 * the Louis Segond 1910 — the translation EAJC reads from. Ids follow USFM/OSIS.
 * Book names are scripture content, not UI copy (rule 8), so they are not translated.
 */

export interface BibleBook {
  id: BibleBookId;
  /** French display name, e.g. "Hébreux". */
  name: string;
  /** Short reference form used on slides, e.g. "Héb". */
  abbreviation: string;
  chapters: number;
  testament: "old" | "new";
}

export type BibleBookId =
  | "GEN" | "EXO" | "LEV" | "NUM" | "DEU" | "JOS" | "JDG" | "RUT" | "1SA" | "2SA" | "1KI" | "2KI"
  | "1CH" | "2CH" | "EZR" | "NEH" | "EST" | "JOB" | "PSA" | "PRO" | "ECC" | "SNG" | "ISA" | "JER"
  | "LAM" | "EZK" | "DAN" | "HOS" | "JOL" | "AMO" | "OBA" | "JON" | "MIC" | "NAM" | "HAB" | "ZEP"
  | "HAG" | "ZEC" | "MAL" | "MAT" | "MRK" | "LUK" | "JHN" | "ACT" | "ROM" | "1CO" | "2CO" | "GAL"
  | "EPH" | "PHP" | "COL" | "1TH" | "2TH" | "1TI" | "2TI" | "TIT" | "PHM" | "HEB" | "JAS" | "1PE"
  | "2PE" | "1JN" | "2JN" | "3JN" | "JUD" | "REV";

function book(id: BibleBookId, name: string, abbreviation: string, chapters: number, testament: "old" | "new"): BibleBook {
  return { id, name, abbreviation, chapters, testament };
}

export const BIBLE_BOOKS: readonly BibleBook[] = [
  book("GEN", "Genèse", "Gen", 50, "old"),
  book("EXO", "Exode", "Ex", 40, "old"),
  book("LEV", "Lévitique", "Lév", 27, "old"),
  book("NUM", "Nombres", "Nb", 36, "old"),
  book("DEU", "Deutéronome", "Deut", 34, "old"),
  book("JOS", "Josué", "Jos", 24, "old"),
  book("JDG", "Juges", "Jug", 21, "old"),
  book("RUT", "Ruth", "Ruth", 4, "old"),
  book("1SA", "1 Samuel", "1 Sam", 31, "old"),
  book("2SA", "2 Samuel", "2 Sam", 24, "old"),
  book("1KI", "1 Rois", "1 Rois", 22, "old"),
  book("2KI", "2 Rois", "2 Rois", 25, "old"),
  book("1CH", "1 Chroniques", "1 Chr", 29, "old"),
  book("2CH", "2 Chroniques", "2 Chr", 36, "old"),
  book("EZR", "Esdras", "Esd", 10, "old"),
  book("NEH", "Néhémie", "Néh", 13, "old"),
  book("EST", "Esther", "Est", 10, "old"),
  book("JOB", "Job", "Job", 42, "old"),
  book("PSA", "Psaumes", "Ps", 150, "old"),
  book("PRO", "Proverbes", "Prov", 31, "old"),
  book("ECC", "Ecclésiaste", "Eccl", 12, "old"),
  book("SNG", "Cantique des cantiques", "Cant", 8, "old"),
  book("ISA", "Ésaïe", "És", 66, "old"),
  book("JER", "Jérémie", "Jér", 52, "old"),
  book("LAM", "Lamentations", "Lam", 5, "old"),
  book("EZK", "Ézéchiel", "Éz", 48, "old"),
  book("DAN", "Daniel", "Dan", 12, "old"),
  book("HOS", "Osée", "Os", 14, "old"),
  book("JOL", "Joël", "Joël", 3, "old"),
  book("AMO", "Amos", "Am", 9, "old"),
  book("OBA", "Abdias", "Abd", 1, "old"),
  book("JON", "Jonas", "Jon", 4, "old"),
  book("MIC", "Michée", "Mich", 7, "old"),
  book("NAM", "Nahum", "Nah", 3, "old"),
  book("HAB", "Habacuc", "Hab", 3, "old"),
  book("ZEP", "Sophonie", "Soph", 3, "old"),
  book("HAG", "Aggée", "Agg", 2, "old"),
  book("ZEC", "Zacharie", "Zach", 14, "old"),
  book("MAL", "Malachie", "Mal", 4, "old"),
  book("MAT", "Matthieu", "Matt", 28, "new"),
  book("MRK", "Marc", "Marc", 16, "new"),
  book("LUK", "Luc", "Luc", 24, "new"),
  book("JHN", "Jean", "Jean", 21, "new"),
  book("ACT", "Actes", "Act", 28, "new"),
  book("ROM", "Romains", "Rom", 16, "new"),
  book("1CO", "1 Corinthiens", "1 Cor", 16, "new"),
  book("2CO", "2 Corinthiens", "2 Cor", 13, "new"),
  book("GAL", "Galates", "Gal", 6, "new"),
  book("EPH", "Éphésiens", "Éph", 6, "new"),
  book("PHP", "Philippiens", "Phil", 4, "new"),
  book("COL", "Colossiens", "Col", 4, "new"),
  book("1TH", "1 Thessaloniciens", "1 Thess", 5, "new"),
  book("2TH", "2 Thessaloniciens", "2 Thess", 3, "new"),
  book("1TI", "1 Timothée", "1 Tim", 6, "new"),
  book("2TI", "2 Timothée", "2 Tim", 4, "new"),
  book("TIT", "Tite", "Tite", 3, "new"),
  book("PHM", "Philémon", "Phm", 1, "new"),
  book("HEB", "Hébreux", "Héb", 13, "new"),
  book("JAS", "Jacques", "Jacq", 5, "new"),
  book("1PE", "1 Pierre", "1 Pi", 5, "new"),
  book("2PE", "2 Pierre", "2 Pi", 3, "new"),
  book("1JN", "1 Jean", "1 Jean", 5, "new"),
  book("2JN", "2 Jean", "2 Jean", 1, "new"),
  book("3JN", "3 Jean", "3 Jean", 1, "new"),
  book("JUD", "Jude", "Jude", 1, "new"),
  book("REV", "Apocalypse", "Apoc", 22, "new"),
];

const BY_ID = new Map(BIBLE_BOOKS.map((b) => [b.id, b]));

export function getBibleBook(id: string): BibleBook | null {
  return BY_ID.get(id as BibleBookId) ?? null;
}

export function isBibleBookId(value: string): value is BibleBookId {
  return BY_ID.has(value as BibleBookId);
}

/** Reference as it appears on a slide: "Hébreux 10:38", "Hébreux 10:38-39", "Hébreux 10:38, 40". */
export function formatReference(bookId: BibleBookId, chapter: number, verses: readonly number[]): string {
  const name = BY_ID.get(bookId)?.name ?? bookId;
  const sorted = [...new Set(verses)].sort((a, b) => a - b);
  if (sorted.length === 0) return `${name} ${chapter}`;
  const ranges: string[] = [];
  let start = sorted[0]!;
  let prev = start;
  for (const v of sorted.slice(1)) {
    if (v === prev + 1) {
      prev = v;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = v;
    prev = v;
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return `${name} ${chapter}:${ranges.join(", ")}`;
}
