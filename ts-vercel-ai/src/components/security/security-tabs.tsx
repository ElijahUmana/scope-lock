'use client';

import { useQueryState } from 'nuqs';

import { cn } from '@/utils/cn';
import ScopeMatrix from '@/components/matrix/scope-matrix';
import SandboxContent from '@/components/sandbox/sandbox-content';
import InsightsContent from '@/components/insights/insights-content';

const TABS = [
  { id: 'matrix', label: 'Matrix' },
  { id: 'tests', label: 'Security Tests' },
  { id: 'insights', label: 'Insights' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function SecurityTabs({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useQueryState('tab', {
    defaultValue: isValidTab(initialTab) ? initialTab : 'matrix',
    shallow: false,
  });

  const activeTab = isValidTab(tab) ? tab : 'matrix';

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-0.5 md:gap-1 border-b border-white/10 mb-4 md:mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 md:px-4 py-2.5 text-sm font-medium transition-all cursor-pointer border-b-2 -mb-px whitespace-nowrap min-h-[44px]',
              activeTab === t.id
                ? 'text-white border-white'
                : 'text-white/50 border-transparent hover:text-white/70 hover:border-white/20',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'matrix' && <ScopeMatrix />}
      {activeTab === 'tests' && <SandboxContent />}
      {activeTab === 'insights' && <InsightsContent />}
    </div>
  );
}

function isValidTab(value: string | undefined | null): value is TabId {
  return value === 'matrix' || value === 'tests' || value === 'insights';
}
