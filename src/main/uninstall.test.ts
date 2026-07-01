import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("electron", () => ({
  app: {
    isPackaged: true,
    getPath: vi.fn(() => "/fake/userData"),
    exit: vi.fn(),
  },
  shell: {
    trashItem: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("fs", () => ({
  default: {
    readdirSync: vi.fn(),
    rmSync: vi.fn(),
  },
}));
vi.mock("child_process");
vi.mock("./store/db", () => ({
  closeDb: vi.fn(),
}));

import { app, shell } from "electron";
import fs from "fs";
import { spawn } from "child_process";
import { closeDb } from "./store/db";
import {
  performUninstall,
  findWindowsUninstaller,
  findMacAppBundle,
} from "./uninstall";

function setPlatform(platform: string) {
  Object.defineProperty(process, "platform", {
    value: platform,
    writable: true,
  });
}

function setExecPath(execPath: string) {
  Object.defineProperty(process, "execPath", {
    value: execPath,
    writable: true,
  });
}

describe("findWindowsUninstaller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the matching uninstaller path when found", () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      "MyRA.exe",
      "Uninstall MyRA.exe",
      "resources",
    ] as any);

    expect(findWindowsUninstaller("C:\\Program Files\\MyRA")).toBe(
      "C:\\Program Files\\MyRA\\Uninstall MyRA.exe",
    );
  });

  it("returns null when no uninstaller file is present", () => {
    vi.mocked(fs.readdirSync).mockReturnValue(["MyRA.exe"] as any);
    expect(findWindowsUninstaller("C:\\Program Files\\MyRA")).toBeNull();
  });

  it("returns null when the install directory can't be read", () => {
    vi.mocked(fs.readdirSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(findWindowsUninstaller("C:\\nonexistent")).toBeNull();
  });
});

describe("findMacAppBundle", () => {
  it("finds the .app ancestor of the executable path", () => {
    expect(
      findMacAppBundle("/Applications/MyRA.app/Contents/MacOS/MyRA"),
    ).toBe("/Applications/MyRA.app");
  });

  it("returns null when no ancestor ends in .app", () => {
    expect(findMacAppBundle("/usr/local/bin/myra")).toBeNull();
  });
});

describe("performUninstall", () => {
  const originalPlatform = process.platform;
  const originalExecPath = process.execPath;

  beforeEach(() => {
    vi.clearAllMocks();
    app.isPackaged = true;
  });

  afterEach(() => {
    setPlatform(originalPlatform);
    setExecPath(originalExecPath);
  });

  it("throws without deleting anything when not packaged", async () => {
    app.isPackaged = false;

    await expect(performUninstall()).rejects.toThrow(
      "Uninstall isn't available in development mode.",
    );
    expect(closeDb).not.toHaveBeenCalled();
    expect(fs.rmSync).not.toHaveBeenCalled();
  });

  it("throws without deleting anything on an unsupported platform", async () => {
    setPlatform("linux");

    await expect(performUninstall()).rejects.toThrow(
      "Uninstall is not supported on this platform.",
    );
    expect(closeDb).not.toHaveBeenCalled();
  });

  describe("on Windows", () => {
    beforeEach(() => {
      setPlatform("win32");
      setExecPath("C:\\Program Files\\MyRA\\MyRA.exe");
    });

    it("throws without deleting anything when the uninstaller is missing", async () => {
      vi.mocked(fs.readdirSync).mockReturnValue(["MyRA.exe"] as any);

      await expect(performUninstall()).rejects.toThrow(
        "Could not find the Windows uninstaller.",
      );
      expect(closeDb).not.toHaveBeenCalled();
      expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it("wipes app data then spawns the uninstaller and exits", async () => {
      vi.mocked(fs.readdirSync).mockReturnValue([
        "MyRA.exe",
        "Uninstall MyRA.exe",
      ] as any);

      await performUninstall();

      expect(closeDb).toHaveBeenCalled();
      expect(fs.rmSync).toHaveBeenCalledWith("/fake/userData", {
        recursive: true,
        force: true,
      });
      expect(spawn).toHaveBeenCalledWith(
        "C:\\Program Files\\MyRA\\Uninstall MyRA.exe",
        [],
        { detached: true, stdio: "ignore" },
      );
      expect(app.exit).toHaveBeenCalledWith(0);
    });
  });

  describe("on macOS", () => {
    beforeEach(() => {
      setPlatform("darwin");
      setExecPath("/Applications/MyRA.app/Contents/MacOS/MyRA");
    });

    it("throws without deleting anything when the bundle path can't be resolved", async () => {
      setExecPath("/usr/local/bin/myra");

      await expect(performUninstall()).rejects.toThrow(
        "Could not locate the app bundle.",
      );
      expect(closeDb).not.toHaveBeenCalled();
    });

    it("wipes app data then trashes the app bundle and exits", async () => {
      await performUninstall();

      expect(closeDb).toHaveBeenCalled();
      expect(fs.rmSync).toHaveBeenCalledWith("/fake/userData", {
        recursive: true,
        force: true,
      });
      expect(shell.trashItem).toHaveBeenCalledWith("/Applications/MyRA.app");
      expect(app.exit).toHaveBeenCalledWith(0);
    });
  });
});
