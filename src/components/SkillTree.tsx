import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Link } from 'react-router-dom';
import { CheckCircle, Lock, Play, PlayCircle, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  HUB_THEME,
  SHAPE_THEMES,
  SKILL_NODES,
  SKILL_NODE_BY_ID,
  themeOf,
  type NodeId,
  type ShapeId,
  type SkillNode,
} from '@/data/skillTree';
import { CagedConstellation, CagedConstellationFill } from './CagedConstellation';
import { CAGED_SHAPES, type CagedShape } from '@/lib/cagedSystem';

// Each CAGED shape's "home key" — the key in which the shape sits at the open
// position so its diagram image (which we render in that home key) lines up
// with the constellation rendered next to it. C-shape ↔ key of C, etc.
const SHAPE_HOME_KEY: Record<CagedShape, string> = {
  C: 'C',
  A: 'A',
  G: 'G',
  E: 'E',
  D: 'D',
};

// How many frets to show in the dialog backdrop. Wider windows (more frets)
// space stars further apart, which contributes to the "approaching from light
// years" feel — the constellation reads as a distant sky, not a chart.
function backdropFrets(count: number) {
  if (count <= 1) return 6;
  if (count === 2) return 9;
  return 13;
}

/**
 * Tiny chord-diagram thumbnail used in the dialog. Just an image (no frame
 * around the constellation any more — that lives behind the whole dialog
 * as ambient backdrop). Falls back to the shape letter if the PNG isn't
 * present yet.
 */
function SmallChordDiagram({ shape }: { shape: CagedShape }) {
  const [imgFailed, setImgFailed] = useState(false);
  const theme = SHAPE_THEMES[shape];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black/70 rounded border border-white/10 overflow-hidden flex items-center justify-center">
        {imgFailed ? (
          <span className={`text-base font-black tracking-widest uppercase ${theme.text}`}>
            {shape}
          </span>
        ) : (
          <img
            src={`/chords/${shape.toLowerCase()}.png`}
            alt={`${shape} chord diagram`}
            className="w-full h-full object-contain"
            onError={() => setImgFailed(true)}
          />
        )}
      </div>
      <span className={`text-[9px] font-black tracking-widest uppercase ${theme.text}`}>
        {shape}
      </span>
    </div>
  );
}

// HUD strip sizing — uses the same 1.67 fret/string aspect ratio as the
// practice fretboard's desktop max cells (50 × 30), scaled down so the
// strip fits the top HUD bar. Because the HUD and fretboard both hand the
// same coordinate system to <CagedConstellation/>, the shapes are
// identical between views — the HUD is just a smaller copy.
const STRIP_KEY = 'C';
const STRIP_FRETS = 22;
// Matches the practice-fretboard per-cell size (50×30) so the HUD constellation
// renders at the same scale as the live fretboard.
const STRIP_OPEN_W = 50;
const STRIP_FRET_W = 50;
const STRIP_STRING_H = 30;
const STRIP_W = STRIP_FRETS * STRIP_FRET_W;
const STRIP_H = 6 * STRIP_STRING_H;

/**
 * HUD wrapper: derives per-shape module progress from the completed set and
 * hands it to the shared <CagedConstellation/>. Because Fretboard.tsx renders
 * the same component at the same 22-fret coordinate system, the stars here
 * sit at exactly the same relative positions as on the live fretboard.
 */
function ConstellationFretboard({ completed }: { completed: Set<NodeId> }) {
  const shapeProgress = useMemo(() => {
    const map = new Map<CagedShape, number>();
    for (const shape of CAGED_SHAPES) {
      const n = (['top', 'bot', 'full'] as const).reduce(
        (acc, k) => acc + (completed.has(`${shape}-${k}` as NodeId) ? 1 : 0),
        0,
      );
      map.set(shape, n);
    }
    return map;
  }, [completed]);

  return (
    <CagedConstellation
      cagedKey={STRIP_KEY}
      fretCount={STRIP_FRETS}
      width={STRIP_W}
      height={STRIP_H}
      openStringW={STRIP_OPEN_W}
      shapeProgress={shapeProgress}
      singleOctave
      className="block select-none max-w-full h-auto"
    />
  );
}
import {
  availableXpAtom,
  completedSetAtom,
  toggleNodeAtom,
} from '@/state/skillTreeAtoms';

const NODE_SIZE = 80;
const GAP = 250;
const PAD = 500;

export function SkillTree() {
  const completed = useAtomValue(completedSetAtom);
  const availableXp = useAtomValue(availableXpAtom);
  const toggle = useSetAtom(toggleNodeAtom);
  const [selectedId, setSelectedId] = useState<NodeId | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledRef = useRef(false);

  const minRow = Math.min(...SKILL_NODES.map((n) => n.gridRow), -2);
  const maxRow = Math.max(...SKILL_NODES.map((n) => n.gridRow), 2);
  const minCol = Math.min(...SKILL_NODES.map((n) => n.gridCol), -2);
  const maxCol = Math.max(...SKILL_NODES.map((n) => n.gridCol), 2);
  const totalRows = maxRow - minRow + 1;
  const totalCols = maxCol - minCol + 1;

  const getX = React.useCallback((col: number) => (col - minCol) * GAP + 40, [minCol]);
  const getY = React.useCallback((row: number) => (row - minRow) * GAP + 40, [minRow]);

  const nodePositions = useMemo(() => {
    const pos = new Map<NodeId, { x: number; y: number }>();
    SKILL_NODES.forEach((n) => {
      pos.set(n.id, { x: getX(n.gridCol), y: getY(n.gridRow) });
    });
    return pos;
  }, [getX, getY]);

  // Center the viewport on the hub on first render. Defer one extra frame
  // past the first paint — on the landscape-rotated mobile layout, the
  // scroller's clientWidth/clientHeight reflect the pre-rotation dimensions
  // until the CSS transform has been applied, so a double-rAF gets us a
  // stable size before we compute the centering offset.
  useEffect(() => {
    if (hasScrolledRef.current) return;
    const container = scrollerRef.current;
    if (!container) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const hubX = getX(0) + PAD + NODE_SIZE / 2;
        const hubY = getY(0) + PAD + NODE_SIZE / 2;
        container.scrollTo({
          left: hubX - container.clientWidth / 2,
          top: hubY - container.clientHeight / 2,
          behavior: 'auto',
        });
        hasScrolledRef.current = true;
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [getX, getY]);

  const selected = selectedId ? SKILL_NODE_BY_ID[selectedId] : null;
  const selectedCompleted = selected ? completed.has(selected.id) : false;
  const selectedUnlocked = useMemo(() => {
    if (!selected) return false;
    return selected.prerequisites.every((p) => completed.has(p));
  }, [selected, completed]);
  const selectedCanAfford = selected ? availableXp >= selected.unlockCost : false;

  const completedCount = completed.size;
  const completionPct = Math.round((completedCount / SKILL_NODES.length) * 100);

  const renderConnectionLines = () => {
    const hubX = getX(0) + PAD + NODE_SIZE / 2;
    const hubY = getY(0) + PAD + NODE_SIZE / 2;

    return (
      <svg
        className="absolute inset-0 pointer-events-none z-10"
        width={totalCols * GAP + 1000}
        height={totalRows * GAP + 1000}
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          {(['C', 'A', 'G', 'E', 'D'] as ShapeId[]).map((s) => (
            <linearGradient
              key={s}
              id={`grad-shape-${s}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor={SHAPE_THEMES[s].color} />
              <stop offset="100%" stopColor={SHAPE_THEMES[s].color} stopOpacity="0.6" />
            </linearGradient>
          ))}
          <linearGradient id="grad-shape-main" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>

        {/* Core Hub background effect */}
        {(() => {
          const innerR = 130;
          const glowR = innerR + 100;
          const outerR = innerR + 150;
          const midR = innerR + 60;
          return (
            <g className="select-none pointer-events-none">
              <circle
                cx={hubX}
                cy={hubY}
                r={innerR}
                fill="#0a0a1a"
                stroke="url(#grad-shape-main)"
                strokeWidth="2"
                strokeDasharray="4 8"
                className="opacity-50"
              />
              <circle
                cx={hubX}
                cy={hubY}
                r={glowR}
                fill="url(#grad-shape-main)"
                filter="blur(80px)"
                className="opacity-[0.1]"
              />
              <circle
                cx={hubX}
                cy={hubY}
                r={outerR}
                fill="none"
                stroke="url(#grad-shape-main)"
                strokeWidth="2"
                strokeDasharray="10 20"
                className="animate-[spin_60s_linear_infinite] opacity-[0.15]"
              />
              <circle
                cx={hubX}
                cy={hubY}
                r={midR}
                fill="none"
                stroke="url(#grad-shape-main)"
                strokeWidth="4"
                strokeDasharray="5 30"
                className="animate-[spin_40s_linear_infinite_reverse] opacity-[0.15]"
              />
            </g>
          );
        })()}

        {/* Region labels + blob backgrounds per shape */}
        {(['C', 'A', 'G', 'E', 'D'] as ShapeId[]).map((shapeId) => {
          const shapeNodes = SKILL_NODES.filter((n) => n.shape === shapeId);
          if (shapeNodes.length === 0) return null;
          const theme = SHAPE_THEMES[shapeId];
          const positions = shapeNodes
            .map((n) => nodePositions.get(n.id))
            .filter(Boolean) as Array<{ x: number; y: number }>;
          const xs = positions.map((p) => p.x + PAD);
          const ys = positions.map((p) => p.y + PAD);
          const avgX = xs.reduce((a, b) => a + b, 0) / xs.length;
          const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
          const width = Math.max(Math.max(...xs) - Math.min(...xs) + GAP, GAP * 2);
          const height = Math.max(Math.max(...ys) - Math.min(...ys) + GAP, GAP * 2);

          const dx = avgX - hubX;
          const dy = avgY - hubY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const textPushDist = Math.max(dist, 400);
          const textX = hubX + (dx / dist) * textPushDist;
          const textY = hubY + (dy / dist) * textPushDist;

          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          let readableAngle = angle;
          if (readableAngle > 90 || readableAngle < -90) readableAngle += 180;

          return (
            <g key={shapeId} className="opacity-[0.2] select-none pointer-events-none">
              <ellipse
                cx={avgX}
                cy={avgY}
                rx={width / 1.5}
                ry={height / 1.5}
                fill={theme.color}
                filter=" blur(80px)"
                className="opacity-40"
                transform={`rotate(${angle}, ${avgX}, ${avgY})`}
              />
              <text
                x={textX}
                y={textY}
                textAnchor="middle"
                fontSize="40"
                fill={theme.color}
                className="font-black uppercase tracking-[0.4em] drop-shadow-2xl opacity-40"
                transform={`rotate(${readableAngle}, ${textX}, ${textY})`}
              >
                {theme.label}
              </text>
            </g>
          );
        })}

        {/* Shape-category dashed connections — link top/bot/full of each shape */}
        {(['C', 'A', 'G', 'E', 'D'] as ShapeId[]).flatMap((shapeId) => {
          const group = SKILL_NODES.filter((n) => n.shape === shapeId);
          if (group.length < 2) return [];
          const theme = SHAPE_THEMES[shapeId];
          const lines: React.ReactNode[] = [];
          for (let i = 0; i < group.length; i++) {
            let nearestIdx = -1;
            let nearestDist = Infinity;
            for (let j = i + 1; j < group.length; j++) {
              const pi = nodePositions.get(group[i].id);
              const pj = nodePositions.get(group[j].id);
              if (!pi || !pj) continue;
              const d = Math.sqrt((pi.x - pj.x) ** 2 + (pi.y - pj.y) ** 2);
              if (d < nearestDist) {
                nearestDist = d;
                nearestIdx = j;
              }
            }
            if (nearestIdx === -1) continue;
            const p1 = nodePositions.get(group[i].id)!;
            const p2 = nodePositions.get(group[nearestIdx].id)!;
            const sx = p1.x + PAD + NODE_SIZE / 2;
            const sy = p1.y + PAD + NODE_SIZE / 2;
            const ex = p2.x + PAD + NODE_SIZE / 2;
            const ey = p2.y + PAD + NODE_SIZE / 2;
            const dx = ex - sx;
            const dy = ey - sy;
            const curv = 0.15;
            lines.push(
              <path
                key={`cat-${shapeId}-${i}-${nearestIdx}`}
                d={`M ${sx} ${sy} C ${sx + dx * 0.3 - dy * curv} ${sy + dy * 0.3 + dx * curv}, ${sx + dx * 0.7 - dy * curv} ${sy + dy * 0.7 + dx * curv}, ${ex} ${ey}`}
                fill="none"
                stroke={theme.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="8 12"
                className="opacity-30"
              />,
            );
          }
          return lines;
        })}

        {/* Prerequisite connection paths */}
        {SKILL_NODES.flatMap((node) =>
          node.prerequisites.map((pid) => {
            const prereq = SKILL_NODE_BY_ID[pid];
            if (!prereq) return null;
            const startPos = nodePositions.get(prereq.id);
            const endPos = nodePositions.get(node.id);
            if (!startPos || !endPos) return null;

            const startX = startPos.x + PAD + NODE_SIZE / 2;
            const startY = startPos.y + PAD + NODE_SIZE / 2;
            const endX = endPos.x + PAD + NODE_SIZE / 2;
            const endY = endPos.y + PAD + NODE_SIZE / 2;

            const isMet = completed.has(pid);
            const theme = themeOf(node);

            const dx = endX - startX;
            const dy = endY - startY;
            const curvature = 0.2;
            const cx1 = startX + dx * 0.3 - dy * curvature;
            const cy1 = startY + dy * 0.3 + dx * curvature;
            const cx2 = startX + dx * 0.7 - dy * curvature;
            const cy2 = startY + dy * 0.7 + dx * curvature;

            return (
              <path
                key={`${pid}-${node.id}`}
                d={`M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`}
                fill="none"
                stroke={isMet ? `url(#${theme.gradId})` : '#1e1b4b'}
                strokeWidth={isMet ? '10' : '5'}
                strokeLinecap="round"
                strokeDasharray={isMet ? '0' : '12,12'}
                filter={isMet ? 'url(#glow)' : 'none'}
                className={`transition-all duration-1000 ease-in-out ${
                  isMet ? 'opacity-80 hover:opacity-100' : 'opacity-40'
                }`}
              />
            );
          }),
        )}
      </svg>
    );
  };

  return (
    <div className="h-full w-full bg-[#050505] text-slate-100 overflow-hidden flex flex-col relative font-sans">
      {/* Cosmic background */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-black">
        <div className="absolute inset-0 bg-[url('/space-bg.jpg')] bg-no-repeat bg-center bg-cover opacity-60 mix-blend-screen" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e1b4b_0%,#020617_100%)] opacity-40 mix-blend-multiply" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[150px]" />
      </div>

      {/* HUD. Everything in here is decorative status — no clickable children —
          so we leave every child pointer-events-none. On mobile the HUD stacks
          vertically and can occupy a sizable portion of the screen; if any
          child trapped pointer events, touches that started on the HUD would
          die there instead of passing through to the scroller beneath, which
          broke panning on phones. */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none flex flex-row flex-wrap sm:flex-nowrap justify-between items-start gap-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="bg-black/40 backdrop-blur-md border border-white/5 p-4 rounded-2xl shadow-2xl flex flex-col">
          <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">
            THE CAGED TREE
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {completedCount}/{SKILL_NODES.length} Skills Mastered
              </span>
            </div>
            <div className="w-16 sm:w-24 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Constellation wraps to its own row on mobile (w-full + order-last)
            so the title card and Practice/XP cluster share the top row. On sm+
            all three sit side-by-side with order reset to source order. */}
        <div className="flex justify-center w-full sm:w-auto sm:flex-1 sm:mx-4 max-w-full overflow-hidden order-last sm:order-none">
          <ConstellationFretboard completed={completed} />
        </div>

        {/* Top-right cluster is the only HUD area that needs pointer events —
            it holds the Practice nav link, which is the ONLY way to reach
            /practice on portrait mobile (ForceLandscapeWrapper rotates this
            view over the app header, hiding its nav). Keeping this cluster
            small and in the corner avoids the scroll-blocking issue that
            plagued the larger HUD children. */}
        <div className="flex flex-row gap-2 items-center pointer-events-auto">
          <Link
            to="/practice"
            className="bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 hover:border-white/30 px-3 sm:px-4 py-2 rounded-full flex items-center gap-2 shadow-lg h-[42px] text-slate-200 transition-colors"
            title="Go to practice"
          >
            <Play className="w-4 h-4" />
            <span className="text-xs font-black tracking-wider whitespace-nowrap hidden sm:inline">
              Practice
            </span>
          </Link>
          <div className="bg-primary/20 backdrop-blur-md border border-primary/30 px-3 sm:px-5 py-2 rounded-full flex items-center gap-2 shadow-lg h-[42px]">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-black text-primary tracking-wider whitespace-nowrap">
              {availableXp} XP
            </span>
          </div>
        </div>
      </div>

      {/* Map — mouse drag-to-pan for desktop, native touch-scroll on mobile.
          We deliberately don't hook onTouchStart — under the force-landscape
          `rotate(90deg)` wrapper, manual touch delta math would need to swap
          axes, and fighting the browser's native overflow-scroll just causes
          jitter. `overflow-auto` plus the rotated parent handles touch panning
          correctly on its own. */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-auto relative z-10 select-none cursor-grab active:cursor-grabbing"
        style={{ scrollbarWidth: 'none' }}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('button, a, [role=button]')) return;
          e.preventDefault();
          const container = e.currentTarget;
          const startX = e.clientX;
          const startY = e.clientY;
          const scrollLeft = container.scrollLeft;
          const scrollTop = container.scrollTop;
          container.style.cursor = 'grabbing';

          const onMove = (ev: MouseEvent) => {
            container.scrollLeft = scrollLeft - (ev.clientX - startX);
            container.scrollTop = scrollTop - (ev.clientY - startY);
          };
          const onUp = () => {
            container.style.cursor = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      >
        <div
          className="relative p-[500px]"
          style={{
            width: totalCols * GAP + 1000,
            height: totalRows * GAP + 1000,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950/10 via-transparent to-purple-950/10 pointer-events-none" />

          {renderConnectionLines()}

          {SKILL_NODES.map((node) => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;
            const isCompleted = completed.has(node.id);
            const prereqsMet = node.prerequisites.every((p) => completed.has(p));
            const isLocked = !prereqsMet && !isCompleted;
            const canAfford = availableXp >= node.unlockCost;
            const requiresPurchase = !isLocked && !isCompleted;
            const isFree = requiresPurchase && node.unlockCost === 0;
            const theme = themeOf(node);
            const isHub = node.kind === 'intro';

            return (
              <div
                key={node.id}
                className="absolute flex flex-col items-center group"
                style={{
                  left: pos.x + PAD,
                  top: pos.y + PAD,
                  width: NODE_SIZE,
                }}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/90 border border-white/20 rounded-xl p-3 min-w-[180px] max-w-[240px] text-center shadow-2xl backdrop-blur-sm">
                  <p className={`font-black text-sm uppercase tracking-wide leading-snug ${theme.text}`}>
                    {node.title}
                  </p>
                  <p className="text-slate-400 text-xs mt-1.5 leading-snug">{node.tagline}</p>
                  <p className="text-slate-500 text-[10px] mt-1.5 uppercase tracking-widest">
                    {isCompleted
                      ? '✓ Mastered'
                      : isLocked
                      ? 'Prereqs locked'
                      : isFree
                      ? 'Free — click to unlock'
                      : canAfford
                      ? `${node.unlockCost} XP to unlock`
                      : `Need ${node.unlockCost - availableXp} more XP`}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedId(node.id)}
                  className={`${isHub ? 'w-28 h-28 sm:w-32 sm:h-32' : 'w-20 h-20 sm:w-24 sm:h-24'} rounded-full flex flex-col items-center justify-center border-2 transition-all duration-700 relative shadow-2xl z-20 hover:scale-110 active:scale-95 group/node
                    ${
                      isCompleted
                        ? 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
                        : isFree
                        ? 'bg-indigo-950/70 border-indigo-400 hover:border-indigo-200 shadow-[0_0_50px_rgba(99,102,241,0.55)] animate-pulse'
                        : requiresPurchase
                        ? `bg-amber-950/60 border-amber-500 hover:border-amber-300 shadow-[0_0_40px_rgba(245,158,11,0.3)] animate-pulse`
                        : 'bg-black/60 border-slate-700 opacity-60'
                    }
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle className={`${isHub ? 'w-12 h-12' : 'w-10 h-10'} text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]`} />
                  ) : isFree ? (
                    <div className="flex flex-col items-center">
                      <PlayCircle className={`${isHub ? 'w-12 h-12' : 'w-9 h-9'} text-indigo-300 drop-shadow-[0_0_12px_rgba(129,140,248,0.9)]`} />
                      <span className="text-[10px] font-black tracking-widest text-indigo-200 mt-0.5">
                        {isHub ? 'START' : 'FREE'}
                      </span>
                    </div>
                  ) : requiresPurchase ? (
                    <div className="flex flex-col items-center">
                      <Lock
                        className={`w-6 h-6 mb-1 ${
                          canAfford ? 'text-amber-400' : 'text-slate-500'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-black tracking-widest ${
                          canAfford ? 'text-amber-400' : 'text-red-400/80'
                        }`}
                      >
                        {node.unlockCost} XP
                      </span>
                    </div>
                  ) : (
                    <Lock className="w-7 h-7 text-slate-700" />
                  )}

                  {/* Ping ring for available nodes */}
                  {requiresPurchase && (canAfford || isFree) && (
                    <div className={`absolute inset-0 rounded-full border-4 ${isFree ? 'border-indigo-400/50' : 'border-amber-400/50'} animate-ping pointer-events-none`} />
                  )}
                </button>

                <div className="text-center mt-5 w-[160px] z-10 px-2 flex flex-col items-center">
                  <p
                    className={`text-[12px] font-black uppercase tracking-widest leading-tight drop-shadow-xl transition-colors duration-300 ${
                      isCompleted
                        ? 'text-emerald-400'
                        : isLocked
                        ? 'text-slate-600'
                        : theme.text
                    }`}
                  >
                    {node.title}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        {/* Don't add `relative` here — DialogContent already has `fixed`,
            and tailwind-merge would drop `fixed` in favor of `relative`,
            kicking the dialog out of its centered overlay position into
            normal document flow. `fixed` itself is a containing block for
            absolutely positioned children, so the backdrop still works. */}
        <DialogContent className="bg-slate-950 border-white/10 max-w-2xl overflow-hidden">
          {selected && (() => {
            // Per-node reference shapes shown alongside the lesson video:
            //  - shape nodes get their own shape
            //  - connect nodes get both shapes of the pair
            //  - the intro node gets the full CAGED set so users see the system
            //    laid out before they spend on their first shape
            const refShapes: CagedShape[] =
              selected.kind === 'intro'
                ? [...CAGED_SHAPES]
                : selected.connectPair
                ? [...selected.connectPair]
                : selected.shape
                ? [selected.shape]
                : [];
            // Backdrop key: anchor on the FIRST shape's home key so its
            // voicing sits at the open position, with any companion shapes
            // sliding up the neck from there. Intro is special-cased to
            // C-key because that's the canonical CAGED layout.
            const bgKey =
              selected.kind === 'intro'
                ? 'C'
                : refShapes[0]
                ? SHAPE_HOME_KEY[refShapes[0]]
                : 'C';
            return (
            <>
              {/* Ambient constellation backdrop. Sits behind everything else
                  in the dialog (z-0) at low opacity so it reads as a distant
                  star field, not a chart. The dialog's overflow-hidden lets
                  the wider fret window bleed past the corners — which is the
                  point: it's OK if some stars/lines are clipped, it sells
                  the "approaching from many light-years away" feel. */}
              {refShapes.length > 0 && (
                <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
                  <CagedConstellationFill
                    cagedKey={bgKey}
                    fretCount={backdropFrets(refShapes.length)}
                    soloShape={refShapes}
                    singleOctave
                    showLabels={false}
                    showFretNumbers={false}
                  />
                </div>
              )}

              {/* Foreground content — own stacking context above the backdrop.
                  Recreates the DialogContent's grid+gap so the layout reads
                  identically to before we wrapped it. */}
              <div className="relative z-10 grid gap-4">
              <DialogHeader>
                <DialogTitle className="text-xl">{selected.subtitle}</DialogTitle>
                <DialogDescription>{selected.tagline}</DialogDescription>
              </DialogHeader>

              <div className="aspect-video bg-black rounded-md overflow-hidden border border-white/5">
                {selectedUnlocked || selectedCompleted ? (
                  <video
                    key={selected.videoSrc}
                    src={selected.videoSrc}
                    controls
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                    <Lock className="w-8 h-8" />
                    <div className="text-sm">Prerequisite not met</div>
                    <div className="text-xs">
                      Requires:{' '}
                      {selected.prerequisites
                        .map((p) => SKILL_NODE_BY_ID[p]?.title ?? p)
                        .join(' + ')}
                    </div>
                  </div>
                )}
              </div>

              {refShapes.length > 0 && (
                <div className="flex justify-center gap-3 flex-wrap">
                  {refShapes.map((s) => (
                    <SmallChordDiagram key={s} shape={s} />
                  ))}
                </div>
              )}

              <p className="text-sm text-slate-400">{selected.description}</p>

              <div className="flex items-center justify-between text-xs">
                <div className="text-slate-500">
                  {selected.prerequisites.length > 0 && (
                    <>
                      Requires:{' '}
                      {selected.prerequisites
                        .map((p) => SKILL_NODE_BY_ID[p]?.title ?? p)
                        .join(' + ')}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 font-mono tabular-nums">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-primary font-bold">{selected.unlockCost} XP</span>
                  <span className="text-slate-600">· you have {availableXp}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                {selectedCompleted && selected.kind !== 'intro' ? (
                  <Link
                    to={`/practice?node=${selected.id}`}
                    className="text-sm text-primary hover:underline font-bold"
                  >
                    Practice this node →
                  </Link>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  {!selectedCompleted && (
                    <Button
                      variant="default"
                      disabled={!selectedUnlocked || !selectedCanAfford}
                      onClick={() => toggle(selected.id)}
                    >
                      {!selectedUnlocked ? (
                        <>
                          <Lock className="h-4 w-4 mr-2" /> Locked
                        </>
                      ) : !selectedCanAfford ? (
                        <>Need {selected.unlockCost - availableXp} more XP</>
                      ) : selected.unlockCost === 0 ? (
                        <>
                          <PlayCircle className="h-4 w-4 mr-2" /> Start
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" /> Unlock ({selected.unlockCost} XP)
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              </div>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
