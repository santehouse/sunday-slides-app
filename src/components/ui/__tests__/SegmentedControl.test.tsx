import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { SegmentedControl } from "../SegmentedControl";

type Value = "a" | "b" | "c";

function Harness() {
  const [value, setValue] = useState<Value>("a");
  return (
    <SegmentedControl<Value>
      ariaLabel="Demo"
      value={value}
      onChange={setValue}
      options={[
        { value: "a", label: "A" },
        { value: "b", label: "B" },
        { value: "c", label: "C" },
      ]}
    />
  );
}

describe("SegmentedControl", () => {
  it("renders a radiogroup of radios reflecting the selected value", () => {
    render(<Harness />);
    expect(screen.getByRole("radiogroup", { name: "Demo" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "A" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "B" })).toHaveAttribute("aria-checked", "false");
  });

  it("only the selected segment is tab-reachable (roving tabindex)", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: "A" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "B" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("radio", { name: "C" })).toHaveAttribute("tabindex", "-1");
  });

  it("ArrowRight moves selection and focus to the next segment, wrapping at the end", () => {
    render(<Harness />);
    const a = screen.getByRole("radio", { name: "A" });
    const b = screen.getByRole("radio", { name: "B" });
    const c = screen.getByRole("radio", { name: "C" });

    a.focus();
    fireEvent.keyDown(a, { key: "ArrowRight" });
    expect(b).toHaveAttribute("aria-checked", "true");
    expect(b).toHaveFocus();

    fireEvent.keyDown(b, { key: "ArrowRight" });
    expect(c).toHaveAttribute("aria-checked", "true");
    expect(c).toHaveFocus();

    fireEvent.keyDown(c, { key: "ArrowRight" });
    expect(a).toHaveAttribute("aria-checked", "true");
    expect(a).toHaveFocus();
  });

  it("ArrowLeft moves selection backward, wrapping at the start", () => {
    render(<Harness />);
    const a = screen.getByRole("radio", { name: "A" });
    const c = screen.getByRole("radio", { name: "C" });

    a.focus();
    fireEvent.keyDown(a, { key: "ArrowLeft" });
    expect(c).toHaveAttribute("aria-checked", "true");
    expect(c).toHaveFocus();
  });

  it("Home/End jump to the first/last option", () => {
    render(<Harness />);
    const a = screen.getByRole("radio", { name: "A" });
    const b = screen.getByRole("radio", { name: "B" });
    const c = screen.getByRole("radio", { name: "C" });

    b.focus();
    fireEvent.keyDown(b, { key: "End" });
    expect(c).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(c, { key: "Home" });
    expect(a).toHaveAttribute("aria-checked", "true");
  });

  it("clicking a segment selects it directly", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: "C" }));
    expect(screen.getByRole("radio", { name: "C" })).toHaveAttribute("aria-checked", "true");
  });
});
