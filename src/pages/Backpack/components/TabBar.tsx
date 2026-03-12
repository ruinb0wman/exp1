import type { Tab, TabKey } from "../lib";

interface TabBarProps {
  tabs: Tab[];
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="px-4">
      <div className="flex gap-2 p-1 bg-surface rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`ml-1.5 text-xs ${
                  activeTab === tab.key ? "text-white/80" : "text-text-muted"
                }`}
              >
                ({tab.count})
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
