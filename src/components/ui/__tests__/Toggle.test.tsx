import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toggle } from "../Toggle";

describe("Toggle", () => {
  it("exposes role=switch with aria-checked reflecting the checked prop", () => {
    const { rerender } = render(<Toggle checked={false} onChange={() => {}} label="Include in MP4" />);
    const toggle = screen.getByRole("switch", { name: /include in mp4/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    rerender(<Toggle checked={true} onChange={() => {}} label="Include in MP4" />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with the inverted value when clicked", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Include in MP4" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders an optional description as part of the accessible name", () => {
    render(
      <Toggle
        checked={false}
        onChange={() => {}}
        label="Auto-process attachments"
        description="Both email and manual uploads use the same pipeline."
      />,
    );
    expect(
      screen.getByRole("switch", { name: /auto-process attachments.*same pipeline/is }),
    ).toBeInTheDocument();
  });

  it("does not call onChange when disabled", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Disabled toggle" disabled />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(onChange).not.toHaveBeenCalled();
  });
});
