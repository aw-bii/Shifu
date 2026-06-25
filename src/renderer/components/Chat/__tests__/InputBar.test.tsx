import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../../ipc", () => ({
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));
vi.mock("../../hooks/useAttachments", () => ({
  useAttachments: () => ({
    pending: [], errors: [], ingesting: false,
    addFiles: vi.fn(), removeFile: vi.fn(), clear: vi.fn(),
  }),
}));

import { InputBar } from "../InputBar";

describe("InputBar Send/Stop", () => {
  it("shows Send button when not streaming", () => {
    const { container } = render(<InputBar onSend={vi.fn()} onAbort={vi.fn()} streaming={false} />);
    const sendButton = container.querySelector('button[class*="bg-blue"]');
    const stopButton = container.querySelector('button[class*="bg-red"]');
    expect(sendButton).toBeTruthy();
    expect(stopButton).toBeNull();
  });

  it("shows Stop button when streaming", () => {
    const { container } = render(<InputBar onSend={vi.fn()} onAbort={vi.fn()} streaming={true} />);
    const sendButton = container.querySelector('button[class*="bg-blue"]');
    const stopButton = container.querySelector('button[class*="bg-red"]');
    expect(stopButton).toBeTruthy();
    expect(sendButton).toBeNull();
  });
});
