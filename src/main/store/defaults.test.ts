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
  });

  it("does nothing when already seeded", () => {
    (ConvStore.getSetting as ReturnType<typeof vi.fn>).mockReturnValue("true");
    seedDefaults();
    expect(ConvStore.createPersona).not.toHaveBeenCalled();
    expect(ConvStore.createPipelineTemplate).not.toHaveBeenCalled();
    expect(ConvStore.setSetting).not.toHaveBeenCalled();
  });
});
