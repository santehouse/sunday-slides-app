"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";
import type { TemplateWithFields } from "@/lib/data";
import { BIBLE_BOOKS, BIBLE_TRANSLATION_NAME, formatReference, isBibleBookId, type BibleBookId } from "@/lib/bible/books";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { MessageState } from "@/components/ui/MessageState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { addScriptureSlidesAction, getChapterVersesAction } from "@/app/[locale]/(sunday)/sunday/actions";

export type ScripturePickerDialogProps = {
  open: boolean;
  sundayId: string;
  /** The Scriptures deck's published templates (already filtered to the scripture category). */
  templates: TemplateWithFields[];
  onClose: () => void;
  onAdded: (count: number) => void;
};

type PerSlide = "1" | "2" | "3";

interface VerseRow {
  verse: number;
  text: string;
}

/**
 * "Add scripture": pick a book, chapter and verses of the Louis Segond 1910, and the
 * chosen layout makes one slide per verse (or per 2–3 verses). Verses are ticked from a
 * checklist so a sermon's scattered references are one visit each.
 */
export function ScripturePickerDialog({ open, sundayId, templates, onClose, onAdded }: ScripturePickerDialogProps) {
  const t = useTranslations("sunday.scripture");
  const tCommon = useTranslations("common");
  const { showToast } = useToast();

  const scriptureTemplates = useMemo(() => templates.filter((tpl) => tpl.category === "scripture"), [templates]);
  const [pickedTemplateId, setTemplateId] = useState<string>("");
  // Falls back to the first scripture layout until the volunteer picks another.
  const templateId = pickedTemplateId || scriptureTemplates[0]?.id || "";
  const [bookId, setBookId] = useState<BibleBookId>("JHN");
  const [chapter, setChapter] = useState(3);
  // The chapter on screen is the one whose rows were last loaded; anything else is "loading".
  const chapterKey = `${bookId}:${chapter}`;
  const [loaded, setLoaded] = useState<{ key: string; rows: VerseRow[] } | null>(null);
  const verses = loaded?.key === chapterKey ? loaded.rows : [];
  const loading = open && loaded?.key !== chapterKey;
  const [selected, setSelected] = useState<number[]>([]);
  const [perSlide, setPerSlide] = useState<PerSlide>("1");
  const [isAdding, startAdding] = useTransition();

  const book = BIBLE_BOOKS.find((b) => b.id === bookId) ?? BIBLE_BOOKS[0]!;
  const chapterOptions = useMemo(
    () => Array.from({ length: book.chapters }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
    [book.chapters],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getChapterVersesAction(bookId, chapter).then((rows) => {
      if (!cancelled) setLoaded({ key: `${bookId}:${chapter}`, rows });
    });
    return () => {
      cancelled = true;
    };
  }, [open, bookId, chapter]);

  function changeBook(next: string) {
    if (!isBibleBookId(next)) return;
    setBookId(next);
    setChapter(1);
    setSelected([]);
  }

  function changeChapter(next: number) {
    setChapter(next);
    setSelected([]);
  }

  function toggleVerse(verse: number) {
    setSelected((prev) => (prev.includes(verse) ? prev.filter((v) => v !== verse) : [...prev, verse].sort((a, b) => a - b)));
  }

  const slideCount = selected.length === 0 ? 0 : Math.ceil(selected.length / Number(perSlide));
  const reference = selected.length > 0 ? formatReference(bookId, chapter, selected) : `${book.name} ${chapter}`;

  function handleAdd() {
    if (!templateId || selected.length === 0) return;
    startAdding(async () => {
      try {
        const created = await addScriptureSlidesAction({
          sundayId,
          templateId,
          bookId,
          chapter,
          verses: selected,
          perSlide: Number(perSlide),
        });
        showToast({ state: "success", title: t("added", { count: created.length }), message: reference });
        onAdded(created.length);
      } catch {
        showToast({ state: "error", title: t("addFailed"), message: reference });
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      bareBody
      title={t("title")}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button
            variant="primary"
            leadingIcon={BookOpen}
            onClick={handleAdd}
            loading={isAdding}
            disabled={!templateId || selected.length === 0}
          >
            {t("add", { count: slideCount })}
          </Button>
        </>
      }
    >
      {scriptureTemplates.length === 0 ? (
        <div className="sm:p-6">
          <MessageState state="warning" title={t("noTemplateTitle")} message={t("noTemplate")} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-col gap-4 sm:p-6 lg:h-full lg:flex-row">
          <div className="flex w-full flex-col gap-4 lg:w-[320px] lg:shrink-0">
            <p className="text-caption text-fg-secondary">{t("helper", { translation: BIBLE_TRANSLATION_NAME })}</p>
            <Select
              id="scripture-template"
              label={t("template")}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              options={scriptureTemplates.map((tpl) => ({ value: tpl.id, label: tpl.nameFr || tpl.nameEn }))}
            />
            <Select
              id="scripture-book"
              label={t("book")}
              value={bookId}
              onChange={(e) => changeBook(e.target.value)}
              options={BIBLE_BOOKS.map((b) => ({ value: b.id, label: b.name }))}
            />
            <Select
              id="scripture-chapter"
              label={t("chapter")}
              value={String(chapter)}
              onChange={(e) => changeChapter(Number(e.target.value))}
              options={chapterOptions}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-bold text-fg-secondary">{t("perSlide")}</span>
              <SegmentedControl
                ariaLabel={t("perSlide")}
                size="md"
                variant="solid"
                equalWidth
                value={perSlide}
                onChange={setPerSlide}
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                  { value: "3", label: "3" },
                ]}
              />
            </div>
            <p className="text-label font-bold text-fg" aria-live="polite">
              {selected.length === 0 ? t("nothingSelected") : t("selection", { reference, count: slideCount })}
            </p>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-caption font-bold uppercase tracking-[0.08em] text-fg-secondary">
                {book.name} {chapter}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(verses.map((v) => v.verse))} disabled={verses.length === 0}>
                  {t("selectAll")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected([])} disabled={selected.length === 0}>
                  {t("clearSelection")}
                </Button>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-label text-fg-secondary">
                <Spinner size={18} />
                {t("loading")}
              </div>
            ) : (
              // On a phone the dialog body is the only scroller — an inner scroll box here
              // would strand the verses below the fold behind a second, nested gesture.
              <ul className="flex flex-col gap-1 overflow-y-auto rounded-md border border-border p-2 lg:max-h-[52vh]" aria-label={t("verses")}>
                {verses.map((row) => {
                  const checked = selected.includes(row.verse);
                  return (
                    <li key={row.verse}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-sm px-2.5 py-2 text-label text-fg hover:bg-surface-subtle",
                          checked && "bg-primary-subtle",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 accent-primary"
                          checked={checked}
                          onChange={() => toggleVerse(row.verse)}
                        />
                        <span className="w-7 shrink-0 text-caption font-bold text-fg-secondary">{row.verse}</span>
                        <span lang="fr">{row.text}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
