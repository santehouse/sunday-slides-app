import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { StatusBadge, type StatusBadgeStatus } from "../StatusBadge";
import messages from "../../../../messages/en.json";

function renderBadge(status: StatusBadgeStatus) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <StatusBadge status={status} />
    </NextIntlClientProvider>,
  );
}

describe("StatusBadge", () => {
  it.each([
    ["ready", "Ready"],
    ["needsReview", "Needs review"],
    ["draft", "Draft"],
    ["added", "Added to flow"],
    ["apply", "Ready to apply"],
    ["published", "Published"],
    ["archived", "Archived"],
    ["exported", "Exported"],
    ["active", "Active"],
    ["enabled", "Enabled"],
    ["suggested", "Suggested"],
    ["available", "Available"],
    ["needsFontFile", "Needs font file"],
    ["failed", "Failed"],
    ["processing", "Processing"],
    ["queued", "Queued"],
    ["invalid", "Invalid"],
    ["waiting", "Waiting for run sheet"],
  ] as [StatusBadgeStatus, string][])("maps status %s to the label %s", (status, label) => {
    renderBadge(status);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("applies the success tone for ready", () => {
    renderBadge("ready");
    expect(screen.getByText("Ready")).toHaveClass("bg-success-bg", "text-success-fg");
  });

  it("applies the warning tone for needsReview", () => {
    renderBadge("needsReview");
    expect(screen.getByText("Needs review")).toHaveClass("bg-warning-bg", "text-warning-fg");
  });

  it("applies the error tone for failed and invalid", () => {
    renderBadge("failed");
    expect(screen.getByText("Failed")).toHaveClass("bg-error-bg", "text-error-fg");
  });

  it("applies the info tone for suggested and processing", () => {
    renderBadge("suggested");
    expect(screen.getByText("Suggested")).toHaveClass("bg-info-bg", "text-info-fg");
  });

  it("applies the subtle tone for draft/added/apply", () => {
    renderBadge("draft");
    expect(screen.getByText("Draft")).toHaveClass("bg-surface-subtle", "text-fg-secondary");
  });
});
