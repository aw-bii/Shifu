import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SecurityDialog } from "./SecurityDialog";

describe("SecurityDialog", () => {
  const mockRespond = vi.fn();

  it("renders warning for injection event", () => {
    render(
      <SecurityDialog
        event={{
          type: "injection_detected",
          severity: "high",
          message: "Injection detected",
          detail: "Found pattern X",
          source: "claude",
        }}
        onRespond={mockRespond}
      />,
    );
    expect(screen.getByText(/Injection detected/i)).toBeDefined();
    expect(screen.getByText(/high/i)).toBeDefined();
  });

  it("renders approve/deny buttons for write approval", () => {
    render(
      <SecurityDialog
        event={{
          type: "write_approval_needed",
          severity: "medium",
          message: "File write requires approval",
          detail: "/etc/passwd",
          source: "opencode",
          filePath: "/etc/passwd",
          content: "root:x:0:0:",
        }}
        onRespond={mockRespond}
      />,
    );
    expect(screen.getByText(/Approve/i)).toBeDefined();
    expect(screen.getByText(/Deny/i)).toBeDefined();
  });

  it("calls onRespond with approved=true when approve clicked", () => {
    render(
      <SecurityDialog
        event={{
          type: "write_approval_needed",
          severity: "medium",
          message: "Write approval needed",
          detail: "/tmp/test.txt",
          source: "claude",
          filePath: "/tmp/test.txt",
          content: "data",
        }}
        onRespond={mockRespond}
      />,
    );
    fireEvent.click(screen.getByText(/Approve/i));
    expect(mockRespond).toHaveBeenCalledWith(true);
  });
});
