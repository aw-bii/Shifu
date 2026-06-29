import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the store module before importing defaults
vi.mock("./index", () => ({
  ConvStore: {
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    createPersona: vi.fn(),
    createPipelineTemplate: vi.fn(),
  },
}));

import { seedDefaults } from "./defaults";
import { ConvStore } from "./index";

describe("seedDefaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds personas and pipeline when not yet seeded", () => {
    (ConvStore.getSetting as ReturnType<typeof vi.fn>).mockReturnValue(
      undefined,
    );
    seedDefaults();
    expect(ConvStore.createPersona).toHaveBeenCalledTimes(2);
    expect(ConvStore.createPipelineTemplate).toHaveBeenCalledTimes(1);
    expect(ConvStore.setSetting).toHaveBeenCalledWith(
      "defaults_seeded",
      "true",
    );

    // Verify Coder persona args
    expect(ConvStore.createPersona).toHaveBeenNthCalledWith(1, {
      name: "Coder",
      systemPrompt:
        "You are an expert software engineer. Be concise, use code blocks, prefer working solutions over explanations.",
      isDefault: true,
    });

    // Verify Explainer persona args
    expect(ConvStore.createPersona).toHaveBeenNthCalledWith(2, {
      name: "Explainer",
      systemPrompt:
        "You are a patient teacher. Explain concepts clearly using plain language and examples. Avoid jargon.",
      isDefault: false,
    });

    // Verify pipeline template args
    expect(ConvStore.createPipelineTemplate).toHaveBeenCalledWith(
      "Draft → Review",
      [
        { stepOrder: 0, backendId: "claude", personaId: null },
        { stepOrder: 1, backendId: "claude", personaId: null },
      ],
    );
  });

  it("does nothing when already seeded", () => {
    (ConvStore.getSetting as ReturnType<typeof vi.fn>).mockReturnValue("true");
    seedDefaults();
    expect(ConvStore.createPersona).not.toHaveBeenCalled();
    expect(ConvStore.createPipelineTemplate).not.toHaveBeenCalled();
    expect(ConvStore.setSetting).not.toHaveBeenCalled();
  });
});
