import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { DurationStepper } from "../DurationStepper";
import messages from "../../../../messages/en.json";

function renderStepper(value: number, onChange: (value: number) => void) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DurationStepper value={value} onChange={onChange} min={1} max={30} />
    </NextIntlClientProvider>,
  );
}

describe("DurationStepper", () => {
  it("disables decrease at the minimum and enables increase", () => {
    renderStepper(1, () => {});
    expect(screen.getByRole("button", { name: "Decrease duration" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase duration" })).not.toBeDisabled();
  });

  it("disables increase at the maximum and enables decrease", () => {
    renderStepper(30, () => {});
    expect(screen.getByRole("button", { name: "Increase duration" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decrease duration" })).not.toBeDisabled();
  });

  it("calls onChange with value + 1 / - 1 within bounds", () => {
    const onChange = vi.fn();
    const { rerender } = renderStepper(5, onChange);
    fireEvent.click(screen.getByRole("button", { name: "Increase duration" }));
    expect(onChange).toHaveBeenCalledWith(6);

    // The parent commits the new value, which re-syncs the control.
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DurationStepper value={6} onChange={onChange} min={1} max={30} />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Decrease duration" }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("compounds taps that land before the parent re-renders (no dropped steps)", () => {
    const onChange = vi.fn();
    renderStepper(5, onChange);
    const plus = screen.getByRole("button", { name: "Increase duration" });
    fireEvent.click(plus);
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([6, 7, 8]);
  });

  it("clamps compounded taps at the maximum", () => {
    const onChange = vi.fn();
    renderStepper(29, onChange);
    const plus = screen.getByRole("button", { name: "Increase duration" });
    fireEvent.click(plus);
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([30]);
  });

  it("formats the value using the plural seconds message", () => {
    renderStepper(1, () => {});
    expect(screen.getByText("1 sec")).toBeInTheDocument();
  });
});
