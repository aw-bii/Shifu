import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DangerZone } from "./DangerZone";

vi.mock("../../ipc/app", () => ({
  uninstallApp: vi.fn(),
}));

import { uninstallApp } from "../../ipc/app";

describe("DangerZone", () => {
  it("keeps the Uninstall button disabled until DELETE is typed exactly", async () => {
    render(<DangerZone />);
    await userEvent.click(screen.getByText("Uninstall MyRA"));

    const confirmBtn = screen.getByRole("button", { name: "Uninstall" });
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "delete");
    expect(confirmBtn).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, "DELETE");
    expect(confirmBtn).not.toBeDisabled();
  });

  it("calls uninstallApp() when confirmed", async () => {
    vi.mocked(uninstallApp).mockImplementation(() => new Promise(() => {}));
    render(<DangerZone />);
    await userEvent.click(screen.getByText("Uninstall MyRA"));
    await userEvent.type(screen.getByRole("textbox"), "DELETE");
    await userEvent.click(screen.getByRole("button", { name: "Uninstall" }));

    expect(uninstallApp).toHaveBeenCalled();
  });

  it("shows the error message inline when uninstallApp() rejects", async () => {
    vi.mocked(uninstallApp).mockRejectedValue(
      new Error("Uninstall isn't available in development mode."),
    );
    render(<DangerZone />);
    await userEvent.click(screen.getByText("Uninstall MyRA"));
    await userEvent.type(screen.getByRole("textbox"), "DELETE");
    await userEvent.click(screen.getByRole("button", { name: "Uninstall" }));

    await vi.waitFor(() => {
      expect(
        screen.getByText("Uninstall isn't available in development mode."),
      ).toBeTruthy();
    });
  });

  it("cancel closes the dialog and resets the typed text", async () => {
    render(<DangerZone />);
    await userEvent.click(screen.getByText("Uninstall MyRA"));
    await userEvent.type(screen.getByRole("textbox"), "DELETE");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
