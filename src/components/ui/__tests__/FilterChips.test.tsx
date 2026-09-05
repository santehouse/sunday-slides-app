import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterChips } from "../FilterChips";

const options = [
  { value: "all", label: "All" },
  { value: "general", label: "General" },
  { value: "events", label: "Events" },
];

describe("FilterChips", () => {
  it("marks only the active chip with aria-pressed=true", () => {
    render(<FilterChips options={options} value="general" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "General" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Events" })).toHaveAttribute("aria-pressed", "false");
  });

  it("is single-select: clicking a chip reports that chip's value", () => {
    const onChange = vi.fn();
    render(<FilterChips options={options} value="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Events" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("events");
  });

  it("chips are real buttons, reachable and activatable from the keyboard", () => {
    render(<FilterChips options={options} value="all" onChange={() => {}} />);
    const chip = screen.getByRole("button", { name: "General" });
    expect(chip.tagName).toBe("BUTTON");
  });
});
