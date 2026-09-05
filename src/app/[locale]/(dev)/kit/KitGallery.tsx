"use client";

import { useState, type ReactNode } from "react";
import { Upload, Pencil, Download, ChevronDown } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { ColorSelect, type ApprovedColor } from "@/components/ui/ColorSelect";
import { Toggle } from "@/components/ui/Toggle";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/StatusBadge";
import { MessageState, type MessageStateKind } from "@/components/ui/MessageState";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { FilterChips } from "@/components/ui/FilterChips";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Popover } from "@/components/ui/Popover";
import { Dropzone } from "@/components/ui/Dropzone";
import { WeekSwitcher } from "@/components/ui/WeekSwitcher";
import { DurationStepper } from "@/components/ui/DurationStepper";
import { SafeZonesAction } from "@/components/ui/SafeZonesAction";
import { Spinner } from "@/components/ui/Spinner";
import { ToastProvider, useToast } from "@/components/ui/Toast";

import { AppHeader } from "@/components/shell/AppHeader";
import { SundayPageHeader } from "@/components/shell/SundayPageHeader";
import { AdminNav } from "@/components/shell/AdminNav";
import { AdminShell } from "@/components/shell/AdminShell";

const ALL_STATUSES: StatusBadgeStatus[] = [
  "ready",
  "needsReview",
  "draft",
  "added",
  "apply",
  "published",
  "archived",
  "exported",
  "active",
  "enabled",
  "suggested",
  "available",
  "needsFontFile",
  "failed",
  "processing",
  "queued",
  "invalid",
  "waiting",
];

const MESSAGE_STATES: MessageStateKind[] = ["success", "warning", "error", "info"];

const DEMO_COLORS: ApprovedColor[] = [
  { id: "coral", name: "Coral", hex: "#ff4233" },
  { id: "navy", name: "Navy", hex: "#1f2b4a" },
  { id: "gold", name: "Gold", hex: "#f5db7a" },
  { id: "sky", name: "Sky", hex: "#3b7dbf" },
];

const DEMO_USER = { displayName: "Josiah Nelson", role: "admin" as const, locale: "EN" };

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 font-bold text-fg">{title}</h2>
        {description ? <p className="mt-1 text-label text-fg-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption font-bold text-fg-secondary">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function KitGallery() {
  return (
    <ToastProvider>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-6 py-10">
        <KitHeader />
        <ButtonSection />
        <FormSection />
        <ToggleAndSegmentedSection />
        <StatusAndMessageSection />
        <CardSection />
        <DialogAndPopoverSection />
        <DropzoneSection />
        <SundaySpecificSection />
        <ShellSection />
        <MiscSection />
      </div>
    </ToastProvider>
  );
}

function KitHeader() {
  const t = useTranslations("dev.kit");
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border pb-6">
      <h1 className="text-h1 font-bold text-fg">{t("title")}</h1>
      <LanguageSelector size="md" />
    </header>
  );
}

function ButtonSection() {
  const [loading, setLoading] = useState(false);
  return (
    <Section title="Button" description="Variants primary / secondary / ghost / danger; sizes md / sm; leading icon; loading; disabled.">
      <Row label="Variants — md">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </Row>
      <Row label="Sizes">
        <Button size="md">Medium</Button>
        <Button size="sm">Small</Button>
      </Row>
      <Row label="Leading icon">
        <Button variant="primary" leadingIcon={Upload}>
          Replace run sheet
        </Button>
        <Button variant="secondary" leadingIcon={Pencil}>
          Edit slide
        </Button>
        <Button variant="secondary" leadingIcon={Download}>
          Download
        </Button>
      </Row>
      <Row label="States">
        <Button disabled>Disabled</Button>
        <Button loading={loading} onClick={() => setLoading((l) => !l)}>
          {loading ? "Loading…" : "Toggle loading"}
        </Button>
      </Row>
      <Row label="As link">
        <Button href="/sunday" variant="secondary">
          Go to Sunday dashboard
        </Button>
      </Row>
      <Row label="IconButton — sizes 36 / 40 / 44 / 48, ghost / outlined">
        <IconButton icon={Pencil} size={36} variant="ghost" aria-label="Edit (36 ghost)" />
        <IconButton icon={Pencil} size={40} variant="ghost" aria-label="Edit (40 ghost)" />
        <IconButton icon={Pencil} size={44} variant="outlined" aria-label="Edit (44 outlined)" />
        <IconButton icon={Pencil} size={48} variant="outlined" aria-label="Edit (48 outlined)" />
        <IconButton icon={Pencil} size={40} variant="outlined" aria-label="Disabled" disabled />
      </Row>
    </Section>
  );
}

function FormSection() {
  const [error, setError] = useState(false);
  return (
    <Section title="Input / Textarea / Select / ColorSelect" description="Label, helper, error and adornment states.">
      <Row label="Input">
        <Input label="Headline" placeholder="Enter value…" className="w-72" />
        <Input label="With helper" helper="Shown under the field." className="w-72" />
        <Input
          label="With error"
          error={error ? "This field is required." : undefined}
          className="w-72"
          onFocus={() => setError(true)}
        />
        <Input label="With adornment" adornment="sec" defaultValue="5" className="w-40" />
      </Row>
      <Row label="Textarea">
        <Textarea label="Line 1" placeholder="Enter value…" className="w-72" />
      </Row>
      <Row label="Select">
        <Select
          label="Template"
          className="w-72"
          options={[
            { value: "general", label: "General announcement" },
            { value: "welcome", label: "Welcome" },
          ]}
        />
      </Row>
      <Row label="ColorSelect (accessible listbox)">
        <ColorSelectDemo />
      </Row>
    </Section>
  );
}

function ColorSelectDemo() {
  const [value, setValue] = useState(DEMO_COLORS[0]!.id);
  return <ColorSelect options={DEMO_COLORS} value={value} onChange={setValue} aria-label="Approved color" />;
}

function ToggleAndSegmentedSection() {
  const [toggleOn, setToggleOn] = useState(true);
  const [toggleOff, setToggleOff] = useState(false);
  const [bg, setBg] = useState<"color" | "image">("color");
  const [format, setFormat] = useState<"jpg" | "mp4">("mp4");
  return (
    <Section title="Toggle / SegmentedControl / LanguageSelector">
      <Row label="Toggle">
        <Toggle checked={toggleOn} onChange={setToggleOn} label="Include in MP4" />
        <Toggle
          checked={toggleOff}
          onChange={setToggleOff}
          label="Auto-process attachments"
          description="Both email and manual uploads use the same pipeline."
        />
        <Toggle checked={false} onChange={() => {}} label="Disabled" disabled />
      </Row>
      <Row label="SegmentedControl — default variant, md/sm">
        <SegmentedControl
          ariaLabel="Background"
          value={bg}
          onChange={setBg}
          options={[
            { value: "color", label: "Color" },
            { value: "image", label: "Image" },
          ]}
        />
        <SegmentedControl
          ariaLabel="Format"
          size="sm"
          value={format}
          onChange={setFormat}
          options={[
            { value: "jpg", label: "JPG" },
            { value: "mp4", label: "MP4" },
          ]}
        />
      </Row>
      <Row label="LanguageSelector — SM / MD (built on SegmentedControl, primary variant)">
        <LanguageSelector size="sm" />
        <LanguageSelector size="md" />
      </Row>
    </Section>
  );
}

function StatusAndMessageSection() {
  return (
    <Section title="StatusBadge / MessageState">
      <Row label="Every status">
        {ALL_STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </Row>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {MESSAGE_STATES.map((state) => (
          <MessageStateSample key={state} state={state} />
        ))}
      </div>
    </Section>
  );
}

function MessageStateSample({ state }: { state: MessageStateKind }) {
  const t = useTranslations("sunday.editor");
  const copy: Record<MessageStateKind, { title: string; message: string }> = {
    success: { title: t("textFitGood"), message: t("textFitGoodBody") },
    warning: { title: t("textFitWarning"), message: t("textFitWarningBody") },
    error: { title: t("textTooLong"), message: t("textTooLongBody") },
    info: { title: t("templateNote"), message: t("templateNoteBody") },
  };
  return <MessageState state={state} title={copy[state].title} message={copy[state].message} />;
}

function CardSection() {
  return (
    <Section title="Card / CardHeader / StatCard / FilterChips">
      <Row label="Card">
        <Card padding="md" className="w-80">
          <CardHeader title="Sunday flow" action={<Button size="sm">Open flow</Button>} />
          <p className="mt-3 text-label text-fg-secondary">
            Card body content goes here, laid out by the consuming screen.
          </p>
        </Card>
      </Row>
      <Row label="StatCard">
        <StatCard value="8" label="Slides prepared" className="w-44" />
        <StatCard value="1" label="Needs review" className="w-44" />
        <StatCard className="w-56">
          <DurationStepper value={5} onChange={() => {}} />
        </StatCard>
      </Row>
      <Row label="FilterChips">
        <FilterChipsDemo />
      </Row>
    </Section>
  );
}

function FilterChipsDemo() {
  const t = useTranslations("sunday.addSlide.categories");
  const [value, setValue] = useState("all");
  const options = ["all", "general", "events", "special", "giving", "welcome", "theme", "closing"].map((key) => ({
    value: key,
    label: t(key),
  }));
  return <FilterChips options={options} value={value} onChange={setValue} aria-label="Category" />;
}

function DialogAndPopoverSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <Section title="Dialog / ConfirmDialog / Popover">
      <Row label="Dialog">
        <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Dialog title"
          actions={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)}>Save</Button>
            </>
          }
        >
          Body copy for a standard dialog, focus-trapped and closable with Escape.
        </Dialog>
      </Row>
      <Row label="ConfirmDialog — destructive">
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          Replace deck
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => setConfirmOpen(false)}
          title="Replace the whole deck?"
          destructive
        >
          All slides for this Sunday, including manual edits, will be regenerated. This can&rsquo;t be undone.
        </ConfirmDialog>
      </Row>
      <Row label="Popover — anchored, closes on outside click / Escape">
        <ExportPopoverDemo />
      </Row>
      <Row label="Toast">
        <ToastDemoButtons />
      </Row>
    </Section>
  );
}

function ExportPopoverDemo() {
  return (
    <Popover
      trigger={({ toggle, id, "aria-expanded": ariaExpanded, "aria-haspopup": ariaHaspopup }) => (
        <Button
          id={id}
          aria-expanded={ariaExpanded}
          aria-haspopup={ariaHaspopup}
          variant="primary"
          onClick={toggle}
        >
          Export
          <ChevronDown aria-hidden="true" size={16} />
        </Button>
      )}
    >
      {({ close }) => (
        <div className="flex w-80 flex-col gap-3">
          <p className="text-h3 font-bold text-fg">Export</p>
          <p className="text-caption text-fg-secondary">Anchored panel content goes here.</p>
          <Button onClick={close}>Close</Button>
        </div>
      )}
    </Popover>
  );
}

function ToastDemoButtons() {
  const { showToast } = useToast();
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => showToast({ state: "success", title: "Slide saved", message: "Your changes were saved." })}
      >
        Show success toast
      </Button>
      <Button
        variant="secondary"
        onClick={() => showToast({ state: "error", title: "Export failed", message: "Try again in a moment." })}
      >
        Show error toast
      </Button>
    </>
  );
}

function DropzoneSection() {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <Section title="Dropzone">
      <Dropzone
        title="Drop Word or PDF run sheet here"
        hint="DOCX or PDF · up to 10 MB"
        chooseFileLabel="Choose file"
        accept=".docx,.pdf"
        maxSizeMb={10}
        onFile={(file) => setFileName(file.name)}
        className="w-[576px] max-w-full"
      />
      {fileName ? <p className="mt-2 text-caption text-fg-secondary">Selected: {fileName}</p> : null}
    </Section>
  );
}

function SundaySpecificSection() {
  const [date, setDate] = useState(new Date(Date.UTC(2026, 8, 6)));
  const [duration, setDuration] = useState(5);
  const [safeZonesOn, setSafeZonesOn] = useState(false);
  const format = useFormatter();

  function shiftWeek(days: number) {
    setDate((d) => new Date(d.getTime() + days * 24 * 60 * 60 * 1000));
  }

  return (
    <Section title="WeekSwitcher / DurationStepper / SafeZonesAction">
      <Row label="WeekSwitcher — md / lg">
        <WeekSwitcher
          date={date}
          label={format.dateTime(date, "sundayShort")}
          onPrev={() => shiftWeek(-7)}
          onNext={() => shiftWeek(7)}
          size="md"
        />
        <WeekSwitcher
          date={date}
          label={format.dateTime(date, "sundayShort")}
          onPrev={() => shiftWeek(-7)}
          onNext={() => shiftWeek(7)}
          size="lg"
        />
      </Row>
      <Row label="DurationStepper — md / lg (bounded 1–30)">
        <DurationStepper value={duration} onChange={setDuration} />
        <DurationStepper value={duration} onChange={setDuration} size="lg" />
      </Row>
      <Row label="SafeZonesAction">
        <SafeZonesAction active={safeZonesOn} onToggle={() => setSafeZonesOn((s) => !s)} />
      </Row>
    </Section>
  );
}

function ShellSection() {
  return (
    <Section title="Shell — AppHeader / SundayPageHeader / AdminNav / AdminShell">
      <Row label="AppHeader">
        <div className="w-full rounded-lg border border-border bg-surface px-4 py-2">
          <AppHeader />
        </div>
      </Row>
      <Row label="SundayPageHeader — xl / lg / md">
        <div className="flex w-full flex-col gap-4">
          <SundayPageHeader title="Sunday, September 6" subtitle="Draft prepared from 26-09-06.docx" titleSize="xl" />
          <SundayPageHeader
            title="Sunday flow"
            subtitle="September 6 · 8 slides · 5 sec global hold"
            titleSize="lg"
            actions={
              <>
                <Button variant="secondary">Upload run sheet</Button>
                <Button variant="primary">
                  Export
                  <ChevronDown aria-hidden="true" size={16} />
                </Button>
              </>
            }
          />
          <SundayPageHeader
            title="Veillée des hommes"
            titleSize="md"
            backHref="/sunday"
            actions={
              <>
                <Button variant="secondary">Duplicate</Button>
                <Button variant="primary">Save changes</Button>
              </>
            }
          />
        </div>
      </Row>
      <Row label="AdminNav (scrollable preview)">
        <div className="h-[420px] w-[300px] overflow-auto rounded-lg border border-border">
          <AdminNav user={DEMO_USER} onSignOut={() => {}} />
        </div>
      </Row>
      <Row label="AdminShell (scrollable preview)">
        <div className="h-[420px] w-full overflow-auto rounded-lg border border-border">
          <AdminShell user={DEMO_USER} onSignOut={() => {}}>
            <p className="text-label text-fg-secondary">Admin page content renders here.</p>
          </AdminShell>
        </div>
      </Row>
    </Section>
  );
}

function MiscSection() {
  return (
    <Section title="Spinner">
      <Row label="Sizes">
        <Spinner size={16} label="Loading" />
        <Spinner size={20} label="Loading" />
        <Spinner size={28} label="Loading" />
      </Row>
    </Section>
  );
}
