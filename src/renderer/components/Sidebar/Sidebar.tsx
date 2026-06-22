import { ConvList } from "./ConvList";
import { SearchPanel } from "../SearchPanel/SearchPanel";
import { CronPanel } from "./CronPanel";
import { McpPanel } from "./McpPanel";
import { PluginPanel } from "./PluginPanel";

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  searchInputRef?: React.MutableRefObject<HTMLInputElement | null>;
  refreshTrigger?: number;
  searchMode: boolean;
  onCloseSearch: () => void;
  showCron: boolean;
  onCloseCron: () => void;
  showMCP: boolean;
  onCloseMCP: () => void;
  showPlugins: boolean;
  onClosePlugins: () => void;
}

export function Sidebar({
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  searchInputRef,
  refreshTrigger,
  searchMode,
  onCloseSearch,
  showCron,
  onCloseCron,
  showMCP,
  onCloseMCP,
  showPlugins,
  onClosePlugins,
}: Props) {
  return (
    <div className="w-64 flex flex-col h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm">BII Agent Harness</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => (showCron ? onCloseCron() : null)}
            className={`text-xs px-2 py-0.5 rounded transition-transform duration-100 ease-press active:scale-95 ${
              showCron
                ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hoverable:hover:bg-gray-300 dark:hoverable:hover:bg-gray-600"
            }`}
          >
            Cron
          </button>
          <button
            onClick={() => (showMCP ? onCloseMCP() : null)}
            className={`text-xs px-2 py-0.5 rounded transition-transform duration-100 ease-press active:scale-95 ${
              showMCP
                ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hoverable:hover:bg-gray-300 dark:hoverable:hover:bg-gray-600"
            }`}
          >
            MCP
          </button>
          <button
            onClick={() => (showPlugins ? onClosePlugins() : null)}
            className={`text-xs px-2 py-0.5 rounded transition-transform duration-100 ease-press active:scale-95 ${
              showPlugins
                ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hoverable:hover:bg-gray-300 dark:hoverable:hover:bg-gray-600"
            }`}
          >
            Plugins
          </button>
          <button
            onClick={onNew}
            className="btn-sm bg-blue-600 text-white hoverable:hover:bg-blue-700"
          >
            + New
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {showPlugins ? (
          <PluginPanel />
        ) : showMCP ? (
          <McpPanel />
        ) : showCron ? (
          <CronPanel />
        ) : searchMode ? (
          <SearchPanel onSelect={onSelect} onClose={onCloseSearch} />
        ) : (
          <ConvList
            activeId={activeId}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
            searchInputRef={searchInputRef}
            refreshTrigger={refreshTrigger}
          />
        )}
      </div>
    </div>
  );
}
