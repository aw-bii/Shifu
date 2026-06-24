import { useState } from "react";
import { installBackend } from "../../ipc";

const LABELS: Record<string, string> = {
  gemini: "Gemini CLI",
  opencode: "Opencode",
};

interface Props {
  missing: string[];
  onNext: () => void;
  onBack: () => void;
}

export function WizardStep2({ missing, onNext, onBack }: Props) {
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [installing, setInstalling] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const install = async (id: string) => {
    setErrors((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    setInstalling((prev) => ({ ...prev, [id]: true }));
    const addLine = (line: string) =>
      setLogs((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), line] }));

    const off = window.ipc.on("wizard:install:line", (line: unknown) =>
      addLine(String(line)),
    );
    const { success: ok } = await installBackend(id);
    off();

    setInstalling((prev) => ({ ...prev, [id]: false }));
    setDone((prev) => ({ ...prev, [id]: ok }));
    if (!ok) {
      setErrors((prev) => ({
        ...prev,
        [id]: "Installation failed. Check your internet connection.",
      }));
    }
  };

  if (missing.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-sm font-semibold mb-1">All tools found</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Every AI tool was detected on your system.
          </p>
        </div>
        <button
          onClick={onNext}
          className="btn-lg bg-blue-600 text-white hoverable:hover:bg-blue-700"
        >
          Next
        </button>
        <button
          onClick={onBack}
          className="btn-md w-full text-gray-500 dark:text-gray-400 hoverable:hover:text-gray-700 dark:hoverable:hover:text-gray-200 transition-transform duration-100 ease-press active:scale-95"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Install additional tools</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          These are optional. You can skip and install them from Settings later.
        </p>
      </div>
      {missing.map((id) => (
        <div
          key={id}
          className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{LABELS[id] ?? id}</span>
            <div className="flex gap-2">
              <button
                onClick={() => install(id)}
                disabled={installing[id] || done[id]}
                className="btn-sm bg-blue-600 text-white hoverable:hover:bg-blue-700 disabled:opacity-50"
              >
                {done[id]
                  ? "Installed"
                  : installing[id]
                    ? "Installing..."
                    : "Install"}
              </button>
              <button
                onClick={() => setDone((prev) => ({ ...prev, [id]: true }))}
                disabled={done[id]}
                className="btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 disabled:opacity-30"
              >
                Skip
              </button>
            </div>
          </div>
          {(logs[id] ?? []).length > 0 && (
            <pre className="text-xs bg-gray-900 text-gray-300 rounded-lg p-2 max-h-24 overflow-y-auto">
              {logs[id].join("\n")}
            </pre>
          )}
          {errors[id] && <p className="text-xs text-red-500">{errors[id]}</p>}
        </div>
      ))}
      <button
        onClick={onNext}
        className="btn-lg bg-blue-600 text-white hoverable:hover:bg-blue-700"
      >
        Continue
      </button>
      <button
        onClick={onBack}
        className="btn-md w-full text-gray-500 dark:text-gray-400 hoverable:hover:text-gray-700 dark:hoverable:hover:text-gray-200 transition-transform duration-100 ease-press active:scale-95"
      >
        Back
      </button>
    </div>
  );
}
