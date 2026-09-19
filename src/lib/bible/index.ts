import { LSG1910_BOOKS } from "./lsg1910";
import { getBibleBook, type BibleBookId } from "./books";

export {
  BIBLE_BOOKS,
  BIBLE_TRANSLATION_NAME,
  formatReference,
  getBibleBook,
  isBibleBookId,
  type BibleBook,
  type BibleBookId,
} from "./books";

export interface BibleVerse {
  verse: number;
  text: string;
}

/**
 * Louis Segond 1910 (public domain), bundled with the app so the scripture picker works
 * offline, in mock mode, and without a third-party API. One JSON module per book is
 * loaded on demand and then kept in memory.
 */
const cache = new Map<BibleBookId, Promise<string[][]>>();

function loadBook(bookId: BibleBookId): Promise<string[][]> {
  let pending = cache.get(bookId);
  if (!pending) {
    pending = LSG1910_BOOKS[bookId]().then((mod) => mod.default.chapters);
    cache.set(bookId, pending);
  }
  return pending;
}

/** Every verse of a chapter, in order; null when the book or chapter does not exist. */
export async function getChapter(bookId: BibleBookId, chapter: number): Promise<BibleVerse[] | null> {
  const book = getBibleBook(bookId);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return null;
  const chapters = await loadBook(bookId);
  const verses = chapters[chapter - 1] ?? [];
  return verses.map((text, i) => ({ verse: i + 1, text })).filter((v) => v.text !== "");
}

/** The requested verses of a chapter (unknown numbers are skipped), in ascending order. */
export async function getVerses(bookId: BibleBookId, chapter: number, verses: readonly number[]): Promise<BibleVerse[]> {
  const all = await getChapter(bookId, chapter);
  if (!all) return [];
  const wanted = new Set(verses);
  return all.filter((v) => wanted.has(v.verse));
}
