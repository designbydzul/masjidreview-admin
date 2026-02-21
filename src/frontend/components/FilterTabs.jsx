import { cn } from '../lib/utils';

export default function FilterTabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full border whitespace-nowrap transition-colors',
              isActive
                ? 'bg-green text-white border-green'
                : 'bg-white text-text-2 border-border hover:border-green hover:text-green'
            )}
          >
            {tab.label}
            <span
              className={cn(
                'text-[11px] font-bold px-1.5 py-0 rounded-full',
                isActive ? 'bg-white/25 text-white' : 'bg-border-2 text-text-3'
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
