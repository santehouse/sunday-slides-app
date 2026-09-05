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
    renderStepper(5, onChange);
    fireEvent.click(screen.getByRole("button", { name: "Increase duration" }));
    expect(onChange).toHaveBeenCalledWith(6);
    fireEvent.click(screen.getByRole("button", { name: "Decrease duration" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("formats the value using the plural seconds message", () => {
    renderStepper(1, () => {});
    expect(screen.getByText("1 sec")).toBeInTheDocument();
  });
});
