"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./Button";

export type DropzoneProps = {
  title: string;
  hint: string;
  chooseFileLabel: string;
  onFile: (file: File) => void;
  /** Set with `onFiles` to accept several files in one drop / pick (e.g. every weight of a font). */
  multiple?: boolean;
  onFiles?: (files: File[]) => void;
  accept?: string;
  maxSizeMb?: number;
  className?: string;
  disabled?: boolean;
};

/** Figma "Upload Dropzone". Keyboard accessible via a hidden input + label. */
export function Dropzone({
  title,
  hint,
  chooseFileLabel,
  onFile,
  multiple = false,
  onFiles,
  accept,
  maxSizeMb,
  className,
  disabled,
}: DropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function acceptFiles(list: FileList | null | undefined) {
    if (!list || disabled) return;
    const files = Array.from(list).filter((file) => !maxSizeMb || file.size <= maxSizeMb * 1024 * 1024);
    if (files.length === 0) return;
    if (multiple && onFiles) {
      onFiles(files);
      return;
    }
    onFile(files[0]!);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    acceptFiles(event.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-surface-subtle px-6 py-10 text-center",
        dragOver ? "border-primary" : "border-border-strong",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <Upload aria-hidden="true" size={24} className="text-fg-secondary" />
      <p className="text-body font-bold text-fg">{title}</p>
      <p className="text-caption text-fg-secondary">{hint}</p>
      <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={disabled}>
        {chooseFileLabel}
      </Button>
      {/* Hidden but still a labelled form control (axe `label`): the visible
          "Choose file" button forwards the click to it. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        tabIndex={-1}
        aria-label={chooseFileLabel}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          acceptFiles(event.target.files);
          // Allow picking the same file again after a removal.
          event.target.value = "";
        }}
      />
    </div>
  );
}
