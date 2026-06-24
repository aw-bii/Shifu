import { spawn, execSync } from "child_process";

const INSTALL_COMMANDS: Record<string, [string, string[]]> = {
  gemini: ["npm", ["install", "-g", "@google/gemini-cli"]],
  opencode: ["npm", ["install", "-g", "opencode"]],
};

function canSpawnNpm(): { ok: boolean; error?: string } {
  try {
    execSync("npm --version", { stdio: "pipe", timeout: 5000 });
    return { ok: true };
  } catch {
    return { ok: false, error: "npm not found in PATH. Install Node.js from https://nodejs.org" };
  }
}

export function installBackend(
  id: string,
  onData: (line: string) => void,
): Promise<{ success: boolean; error?: string }> {
  const cmd = INSTALL_COMMANDS[id];
  if (!cmd)
    return Promise.resolve({ success: false, error: `Unknown backend: ${id}` });

  const check = canSpawnNpm();
  if (!check.ok) return Promise.resolve({ success: false, error: check.error });

  const [binary, args] = cmd;
  const isWin = process.platform === "win32";

  return new Promise((resolve) => {
    const p = spawn(binary, args, {
      stdio: "pipe",
      shell: isWin,
      env: { ...process.env },
    });
    let stderrOutput = "";
    p.stdout!.on("data", (buf: Buffer) =>
      buf.toString().split("\n").filter(Boolean).forEach(onData),
    );
    p.stderr!.on("data", (buf: Buffer) => {
      const text = buf.toString();
      stderrOutput += text;
      text.split("\n").filter(Boolean).forEach(onData);
    });
    p.on("close", (code) => {
      if (code === 0) return resolve({ success: true });
      const isPermissionError =
        /EACCES|EPERM|access denied|permission denied/i.test(stderrOutput);
      resolve({
        success: false,
        error: isPermissionError
          ? isWin
            ? `Permission denied. Run "${binary} ${args.join(" ")}" in a terminal opened as Administrator.`
            : `Permission denied. Try: sudo ${binary} ${args.join(" ")}`
          : `Install failed with exit code ${code}. See output above.`,
      });
    });
    p.on("error", (err) =>
      resolve({
        success: false,
        error: `Failed to start installer: ${err.message}`,
      }),
    );
  });
}
