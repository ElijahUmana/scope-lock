'use client';

import { Shield, Lock, Unlock } from 'lucide-react';
import { SCOPE_PRESETS, type ScopePreset } from '@/lib/scope-presets';
import { cn } from '@/utils/cn';

const ICON_MAP: Record<string, typeof Shield> = {
  shield: Shield,
  lock: Lock,
  unlock: Unlock,
};

const COLOR_STYLES: Record<string, { selected: string; icon: string }> = {
  red: {
    selected: 'border-red-500/50 bg-red-500/10 ring-1 ring-red-500/20',
    icon: 'text-red-400',
  },
  green: {
    selected: 'border-green-500/50 bg-green-500/10 ring-1 ring-green-500/20',
    icon: 'text-green-400',
  },
  amber: {
    selected: 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/20',
    icon: 'text-amber-400',
  },
};

function PresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: ScopePreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = ICON_MAP[preset.icon] ?? Shield;
  const colors = COLOR_STYLES[preset.color] ?? COLOR_STYLES.green;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left cursor-pointer min-w-0',
        selected
          ? colors.selected
          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07] opacity-60 hover:opacity-80',
      )}
    >
      <Icon className={cn('w-4 h-4 shrink-0', selected ? colors.icon : 'text-white/40')} />
      <div className="min-w-0">
        <div className="text-xs font-medium text-white truncate">{preset.name}</div>
        <div className="text-[10px] text-white/40 truncate">{preset.description}</div>
      </div>
    </button>
  );
}

export function ScopePresetSelector({
  activePresetId,
  onPresetChange,
}: {
  activePresetId: string;
  onPresetChange: (presetId: string) => void;
}) {
  return (
    <div className="flex gap-2 max-w-[768px] w-full mx-auto mb-2">
      {SCOPE_PRESETS.map((preset) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          selected={activePresetId === preset.id}
          onSelect={() => onPresetChange(preset.id)}
        />
      ))}
    </div>
  );
}
