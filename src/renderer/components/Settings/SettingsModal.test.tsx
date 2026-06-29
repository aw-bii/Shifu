import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { SettingsModal } from "./SettingsModal";

beforeAll(() => {
  // Mock window.matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

vi.mock("../../ipc", () => ({
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  getAppVersion: vi.fn().mockResolvedValue("0.2.1"),
  storeKey: vi.fn().mockResolvedValue(undefined),
  deleteKey: vi.fn().mockResolvedValue(undefined),
  hasKey: vi.fn().mockResolvedValue(false),
  probeBackend: vi
    .fn()
    .mockResolvedValue({ available: false, authenticated: false }),
  getProxySettings: vi
    .fn()
    .mockResolvedValue({ httpProxy: "", httpsProxy: "", noProxy: "" }),
  setProxySettings: vi.fn().mockResolvedValue(undefined),
  listPersonas: vi.fn().mockResolvedValue([]),
  savePersona: vi.fn().mockResolvedValue({ id: "1", name: "Test" }),
  deletePersona: vi.fn().mockResolvedValue(undefined),
  listPipelines: vi.fn().mockResolvedValue([]),
  savePipeline: vi.fn().mockResolvedValue({ id: "1", name: "Test" }),
  deletePipeline: vi.fn().mockResolvedValue(undefined),
  listBackends: vi.fn().mockResolvedValue([]),
  listMcpServers: vi.fn().mockResolvedValue([]),
  addMcpServer: vi.fn().mockResolvedValue(undefined),
  removeMcpServer: vi.fn().mockResolvedValue(undefined),
  toggleMcpServer: vi.fn().mockResolvedValue(undefined),
  listMcpTools: vi.fn().mockResolvedValue([]),
  listCronJobs: vi.fn().mockResolvedValue([]),
  createCronJob: vi.fn().mockResolvedValue(undefined),
  updateCronJob: vi.fn().mockResolvedValue(undefined),
  deleteCronJob: vi.fn().mockResolvedValue(undefined),
  toggleCronJob: vi.fn().mockResolvedValue(undefined),
  getCronJobs: vi.fn().mockResolvedValue([]),
  getCronJobLogs: vi.fn().mockResolvedValue([]),
  runCronJobNow: vi.fn().mockResolvedValue(undefined),
  listPlugins: vi.fn().mockResolvedValue([]),
  togglePlugin: vi.fn().mockResolvedValue(undefined),
  reloadPlugins: vi.fn().mockResolvedValue(undefined),
  getDefaultModel: vi.fn().mockResolvedValue(""),
  setDefaultModel: vi.fn().mockResolvedValue(undefined),
  listModels: vi.fn().mockResolvedValue([]),
}));

const base = {
  open: true,
  section: "settings" as const,
  onClose: vi.fn(),
  onSectionChange: vi.fn(),
  onReRunWizard: vi.fn(),
  activePersonaId: null,
  onPersonaSelect: vi.fn(),
  activeTemplateId: null,
  onTemplateSelect: vi.fn(),
};

describe("SettingsModal", () => {
  it("renders when open=true", () => {
    render(<SettingsModal {...base} />);
    expect(
      screen.getByRole("dialog", { name: /settings/i }),
    ).toBeInTheDocument();
  });

  it("does not render when open=false", () => {
    render(<SettingsModal {...base} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onSectionChange when Personas nav item clicked", () => {
    const onSectionChange = vi.fn();
    render(<SettingsModal {...base} onSectionChange={onSectionChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^personas$/i }));
    expect(onSectionChange).toHaveBeenCalledWith("personas");
  });

  it("calls onClose when backdrop clicked", () => {
    const onClose = vi.fn();
    render(<SettingsModal {...base} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("settings-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when ✕ button clicked", () => {
    const onClose = vi.fn();
    render(<SettingsModal {...base} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close settings/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
