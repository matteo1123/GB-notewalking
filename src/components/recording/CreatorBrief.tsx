import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { CHROMATIC_SCALE } from '@/lib/musicTheory';

// Creator-only. Everything here is gated server-side by creator.amICreator /
// creator.currentBrief, which return false/null for every other account, so
// students never receive brief data, not just never see it.

export interface CreatorBriefData {
  date: string;
  pillar: string;
  topic: string;
  hook: string;
  points: string[];
  demo: string;
  isToday: boolean;
}

function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Is the signed-in account the creator? false while loading or signed out. */
export function useIsCreator(): boolean {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.creator.amICreator, isAuthenticated ? {} : 'skip') === true;
}

export function useCreatorBrief(enabled: boolean): CreatorBriefData | null {
  const brief = useQuery(api.creator.currentBrief, enabled ? { today: localDate() } : 'skip');
  return brief ?? null;
}

const SEMIS: Record<string, number> = { '1': 0, '2': 2, '3': 4, '4': 5, '5': 7, '6': 9, '7': 11 };

/**
 * Briefs are written in scale degrees so they work in any key: `{4}`, `{b7}`,
 * `{#4}`. Render each as "4 (G#)" for the key the app picked today.
 */
export function renderDegrees(text: string, key: string | undefined): string {
  const root = key ? CHROMATIC_SCALE.indexOf(key) : -1;
  return text.replace(/\{([b#]?)([1-7])\}/g, (_, acc: string, num: string) => {
    if (root < 0) return `${acc}${num}`;
    const semi = SEMIS[num] + (acc === 'b' ? -1 : acc === '#' ? 1 : 0);
    return `${acc}${num} (${CHROMATIC_SCALE[(root + semi + 12) % 12]})`;
  });
}

export function CreatorBriefCard({
  brief,
  musicKey,
  compact = false,
}: {
  brief: CreatorBriefData;
  musicKey?: string;
  compact?: boolean;
}) {
  const r = (t: string) => renderDegrees(t, musicKey);
  return (
    <div
      className={`rounded border border-amber-500/40 bg-amber-500/10 text-amber-50 ${
        compact ? 'p-1.5 text-[10px] leading-snug' : 'p-3 text-sm'
      }`}
    >
      <div className={`font-bold uppercase tracking-widest text-amber-300 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        {brief.isToday ? "Today's brief" : `Brief from ${brief.date}`} · {brief.pillar}
      </div>
      <div className={`font-semibold ${compact ? 'mt-0.5' : 'mt-1 text-base'}`}>“{r(brief.hook)}”</div>
      <ul className={`list-disc pl-4 ${compact ? 'mt-0.5' : 'mt-1.5 space-y-0.5'}`}>
        {brief.points.map((p, i) => (
          <li key={i}>{r(p)}</li>
        ))}
      </ul>
      {brief.demo && (
        <div className={`${compact ? 'mt-0.5' : 'mt-1.5'} text-amber-200`}>
          <span className="font-semibold">Play:</span> {r(brief.demo)}
        </div>
      )}
    </div>
  );
}
