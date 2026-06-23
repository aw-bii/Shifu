import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WizardStep2 } from "./WizardStep2";

vi.mock("../../ipc", () => ({
  installBackend: vi.fn().mockResolvedValue({ success: false }),
}));

describe("WizardStep2", () => {
  it("calls onBack when the Back button is clicked", () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    render(<WizardStep2 missing={[]} onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("calls onNext when Continue is clicked", () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    render(<WizardStep2 missing={[]} onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});

describe("WizardStep2 install error", () => {
  it("shows an error message when installation fails", async () => {
    (window as unknown as { ipc: { on: ReturnType<typeof vi.fn> } }).ipc = {
      on: vi.fn().mockReturnValue(() => {}),
    };

    const { findByText } = render(
      <WizardStep2 missing={["gemini"]} onNext={vi.fn()} onBack={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^install$/i }));

    expect(await findByText(/installation failed/i)).toBeTruthy();
  });
});
