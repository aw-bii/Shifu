import { useState } from "react";
import type { SecurityEvent } from "../../../shared/types";

interface SecurityDialogProps {
  event: SecurityEvent;
  onRespond: (approved: boolean) => void;
}

export function SecurityDialog({ event, onRespond }: SecurityDialogProps) {
  const [resolved, setResolved] = useState(false);

  if (resolved) return null;

  const severityColors: Record<string, string> = {
    low: "bg-yellow-50 border-yellow-200 text-yellow-800",
    medium: "bg-orange-50 border-orange-200 text-orange-800",
    high: "bg-red-50 border-red-200 text-red-800",
    critical: "bg-red-100 border-red-400 text-red-900",
  };

  const severityClass = severityColors[event.severity] ?? severityColors.medium;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className={`max-w-md w-full mx-4 rounded-lg border p-4 shadow-lg ${severityClass}`}>
        <div className="font-semibold mb-1 text-sm uppercase tracking-wide">
          {event.severity} — Security Alert
        </div>
        <div className="font-medium mb-2">{event.message}</div>
        <div className="text-sm opacity-80 mb-3 font-mono break-all">
          {event.detail}
        </div>
        {event.filePath && (
          <div className="text-xs opacity-70 mb-3">
            File: <code className="font-mono">{event.filePath}</code>
            {event.content && <div className="mt-1">Size: {event.content.length} bytes</div>}
          </div>
        )}
        <div className="flex gap-2 justify-end mt-2">
          {event.type === "write_approval_needed" ? (
            <>
              <button
                onClick={() => { setResolved(true); onRespond(false); }}
                className="px-3 py-1.5 text-xs rounded border border-current opacity-80 hover:opacity-100 transition-opacity"
              >
                Deny
              </button>
              <button
                onClick={() => { setResolved(true); onRespond(true); }}
                className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Approve
              </button>
            </>
          ) : (
            <button
              onClick={() => setResolved(true)}
              className="px-3 py-1.5 text-xs rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
