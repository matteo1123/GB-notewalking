import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CAGED_SHAPES,
  CAGED_SHAPE_HEX,
  getShapeVoicingPositions,
  type CagedShape,
  type ChordToneNode,
} from '@/lib/cagedSystem';

/**
 * Shared chord-tone constellation layer — renders the 5 CAGED shapes as
 * glowing stars at their actual fretboard positions. Used by both the live
 * Fretboard (as an always-on layer behind the notes) and the SkillTree HUD
 * (as a standalone strip). Because both consumers share this one component
 * with the same coordinate system, the stars line up between views.
 *
 * The SVG is drawn in pixel-space (viewBox in pixels) so stars stay round
 * regardless of container aspect ratio. An optional `openStringW` allocates
 * a zone on the left for open-string (fret 0) voicing notes so shapes near
 * the nut (open A, open E, etc.) preserve their visual identity.
 */

// Frets that commonly get fret-marker inlays on a guitar — used here for
// subtle fret numbering below the constellation.
const MARKER_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21];

interface SizedProps {
  cagedKey: string;
  fretCount: number;
  /** Width of the fretted region (frets 1..fretCount) in pixels. */
  width: number;
  /** Height of the 6-string region in pixels. */
  height: number;
  /** Width allocated to the left for fret-0 (open string) voicing notes. */
  openStringW?: number;
  /** Map of shape → number of modules completed (0–3). Brightness scales. */
  shapeProgress?: Map<CagedShape, number>;
  /** When provided, only stars/lines on these "string-fret" cells render. */
  revealedFrets?: Set<string>;
  /** When true, draws shape letter labels under the strip. */
  showLabels?: boolean;
  /** When true, draws small fret numbers under the strip. */
  showFretNumbers?: boolean;
  /** When true, labels render INSIDE the height (just above the bottom) instead
   * of in an extra band below. Used on the live fretboard where the overlay is
   * bounded by the fretboard element and can't extend past its height. */
  labelsInside?: boolean;
  /** When true, only the densest octave of each shape renders — so each CAGED
   * constellation appears exactly once across the strip instead of repeating
   * every 12 frets. Keeps the HUD readable. */
  singleOctave?: boolean;
  /** When set, only these shapes' stars/lines/labels render. Used by the
   * cinematic shape-reveal overlay. Accepts a single shape or an array (e.g.
   * connect nodes spotlight both adjacent shapes simultaneously). */
  soloShape?: CagedShape | CagedShape[];
  /** Set of "string-fret" cells whose tone is currently sounding. When
   * provided, splits the chord-tone visuals into active vs passive groups so
   * CSS can throb only the active ones (live fretboard use). When omitted,
   * everything goes into a uniform group (HUD strip / dialog backdrop). */
  activeTones?: Set<string>;
  className?: string;
}

export function CagedConstellation({
  cagedKey,
  fretCount,
  width,
  height,
  openStringW = 0,
  shapeProgress,
  revealedFrets,
  showLabels = false,
  showFretNumbers = false,
  labelsInside = false,
  singleOctave = false,
  soloShape,
  activeTones,
  className,
}: SizedProps) {
  const fretW = width / fretCount;
  const stringH = height / 6;
  const totalW = width + openStringW;
  // fret 0 sits centered in the dedicated open-string zone to the left when
  // one is provided, or tucked just inside the nut otherwise so the star
  // still renders (instead of being clipped at negative x) and the shape's
  // polyline keeps its identifiable geometry near the open strings.
  const xOf = (f: number) =>
    f === 0
      ? (openStringW > 0 ? openStringW / 2 : fretW * 0.15)
      : openStringW + (f - 0.5) * fretW;
  const yOf = (s: number) => (s - 0.5) * stringH;

  // Star sizes scale with the smaller of (stringH, fretW/2) so they stay
  // round regardless of container aspect ratio.
  const baseUnit = Math.min(stringH, fretW * 0.5);
  const coreR_R = baseUnit * 0.36;
  const coreR_other = baseUnit * 0.25;
  const haloR_R = baseUnit * 0.65;
  const haloR_other = baseUnit * 0.5;
  const lineWidth = Math.max(0.6, baseUnit * 0.07);
  const glowBlur = Math.max(0.8, baseUnit * 0.1);

  const isRevealed = (s: number, f: number) =>
    revealedFrets ? revealedFrets.has(`${s}-${f}`) : true;

  const shapeData = useMemo(() => {
    return CAGED_SHAPES.map((shape) => {
      // Fret 0 voicing notes are always included — xOf() positions them
      // either in the dedicated open-string zone (if present) or tucked
      // just inside the nut. That preserves shape integrity for open-chord
      // voicings (open A, open E, open D…) regardless of layout.
      const rawTones = getShapeVoicingPositions(cagedKey, shape, fretCount).filter(
        (t) => t.fret >= 0 && t.fret <= fretCount,
      );
      // Group polylines by octave so each voicing draws its own sweep.
      const byOct = new Map<number, ChordToneNode[]>();
      for (const t of rawTones) {
        if (!byOct.has(t.octaveShift)) byOct.set(t.octaveShift, []);
        byOct.get(t.octaveShift)!.push(t);
      }
      let octGroups = Array.from(byOct.entries()).map(([oct, pts]) => {
        const sorted = [...pts].sort(
          (a, b) => b.string - a.string || a.fret - b.fret,
        );
        return { oct, points: sorted };
      });
      if (singleOctave && octGroups.length > 1) {
        // Keep only the octave with the most voicing notes present — that's
        // the "home" octave that reads as the canonical CAGED shape.
        octGroups = [...octGroups].sort((a, b) => b.points.length - a.points.length).slice(0, 1);
      }
      const allTones = singleOctave
        ? octGroups.flatMap((g) => g.points)
        : rawTones;
      const done = shapeProgress
        ? Math.min(3, shapeProgress.get(shape) ?? 0)
        : 3;
      const lit = shapeProgress ? 0.25 + (done / 3) * 0.7 : 0.95;
      return { shape, allTones, octGroups, lit, done };
    });
  }, [cagedKey, fretCount, openStringW, shapeProgress, singleOctave]);

  const visibleShapeData = useMemo(() => {
    if (!soloShape) return shapeData;
    const allowed = Array.isArray(soloShape) ? new Set(soloShape) : new Set([soloShape]);
    return shapeData.filter((d) => allowed.has(d.shape));
  }, [shapeData, soloShape]);

  // When labels render below the strings, allocate one row per active label
  // type so fret numbers and shape letters don't stack on top of each other.
  const labelRows = (!labelsInside ? (showFretNumbers ? 1 : 0) + (showLabels ? 1 : 0) : 0);
  const labelBandH = labelRows > 0 ? Math.max(16 * labelRows, baseUnit * 1.0 * labelRows) : 0;
  const totalH = height + labelBandH;
  // When labelsInside, anchor labels near the bottom of the strings region so
  // they stay within the svg (no vertical overflow). Otherwise they render
  // below the strings in the extra band.
  const fretNumY = labelsInside
    ? height - Math.max(8, baseUnit * 0.55)
    : height + Math.max(10, baseUnit * 0.55);
  const labelY = labelsInside
    ? height - Math.max(2, baseUnit * 0.15)
    : height + Math.max(10, baseUnit * 0.55) + Math.max(11, baseUnit * 0.6);

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={className}
      style={{ display: 'block', pointerEvents: 'none' }}
    >
      <defs>
        {CAGED_SHAPES.map((s) => (
          <radialGradient
            id={`cc-star-${s}`}
            key={s}
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="50%"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
            <stop offset="35%" stopColor={CAGED_SHAPE_HEX[s]} stopOpacity={0.95} />
            <stop offset="100%" stopColor={CAGED_SHAPE_HEX[s]} stopOpacity={0} />
          </radialGradient>
        ))}
        <filter id="cc-star-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation={glowBlur} />
        </filter>
      </defs>

      {/* Chord-tone visuals (lines + halos + stars). When `activeTones` is
       * provided we tag each element 'active' or 'passive' based on whether
       * its position belongs to the currently-sounding chord; CSS then throbs
       * only the active ones. Without `activeTones` we fall back to uniform
       * tagging so the wrapper-level animation breathes everything together
       * (HUD strip / dialog backdrop case). The wrapper class also flips
       * between split/uniform so the right CSS rule applies. */}
      <g className={`cc-tones ${activeTones ? 'cc-tones-split' : 'cc-tones-uniform'}`}>
      {visibleShapeData.flatMap(({ shape, octGroups, lit }) =>
        octGroups.flatMap(({ oct, points }) => {
          if (points.length < 2) return [];
          const segs: React.ReactNode[] = [];
          for (let i = 0; i < points.length - 1; i++) {
            const a = points[i];
            const b = points[i + 1];
            if (Math.abs(a.string - b.string) !== 1) continue;
            if (!isRevealed(a.string, a.fret) || !isRevealed(b.string, b.fret)) continue;
            // A line throbs only when BOTH endpoints belong to the active
            // chord — otherwise the line connects an active and passive star
            // and reads as a partial chord, which is misleading.
            const cls = activeTones
              ? activeTones.has(`${a.string}-${a.fret}`) &&
                activeTones.has(`${b.string}-${b.fret}`)
                ? 'cc-tone cc-tone-active'
                : 'cc-tone cc-tone-passive'
              : 'cc-tone';
            segs.push(
              <line
                key={`ln-${shape}-${oct}-${i}`}
                className={cls}
                x1={xOf(a.fret)}
                y1={yOf(a.string)}
                x2={xOf(b.fret)}
                y2={yOf(b.string)}
                stroke={CAGED_SHAPE_HEX[shape]}
                strokeOpacity={lit * 0.45}
                strokeWidth={lineWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />,
            );
          }
          return segs;
        }),
      )}

      {/* glow halos */}
      {visibleShapeData.flatMap(({ shape, allTones, lit }) =>
        allTones
          .filter((t) => isRevealed(t.string, t.fret))
          .map((t) => {
            const cls = activeTones
              ? activeTones.has(`${t.string}-${t.fret}`)
                ? 'cc-tone cc-tone-active'
                : 'cc-tone cc-tone-passive'
              : 'cc-tone';
            return (
              <circle
                key={`halo-${shape}-${t.octaveShift}-${t.string}-${t.fret}`}
                className={cls}
                cx={xOf(t.fret)}
                cy={yOf(t.string)}
                r={t.role === 'R' ? haloR_R : haloR_other}
                fill={CAGED_SHAPE_HEX[shape]}
                opacity={lit * 0.35}
                filter="url(#cc-star-glow)"
              />
            );
          }),
      )}

      {/* bright star cores */}
      {visibleShapeData.flatMap(({ shape, allTones, lit }) =>
        allTones
          .filter((t) => isRevealed(t.string, t.fret))
          .map((t) => {
            const cls = activeTones
              ? activeTones.has(`${t.string}-${t.fret}`)
                ? 'cc-tone cc-tone-active'
                : 'cc-tone cc-tone-passive'
              : 'cc-tone';
            return (
              <circle
                key={`star-${shape}-${t.octaveShift}-${t.string}-${t.fret}`}
                className={cls}
                cx={xOf(t.fret)}
                cy={yOf(t.string)}
                r={t.role === 'R' ? coreR_R : coreR_other}
                fill={`url(#cc-star-${shape})`}
                opacity={lit}
              />
            );
          }),
      )}
      </g>

      {/* subtle fret numbers along a band below the strip */}
      {showFretNumbers &&
        MARKER_FRETS.filter((f) => f <= fretCount).map((f) => (
          <text
            key={`fn-${f}`}
            x={xOf(f)}
            y={fretNumY}
            textAnchor="middle"
            fontSize={Math.max(8, baseUnit * 0.45)}
            fontWeight={500}
            fill="rgba(255,255,255,0.5)"
          >
            {f}
          </text>
        ))}

      {/* subtle per-shape letter labels along the same band */}
      {showLabels &&
        visibleShapeData.map(({ shape, allTones, done }) => {
          // Pick the "home" octave for the label — the one with the most
          // voicing notes visible. This keeps labels from jumping around as
          // octaves clip at the fretboard edges.
          if (allTones.length === 0) return null;
          const byOct = new Map<number, ChordToneNode[]>();
          for (const t of allTones) {
            const arr = byOct.get(t.octaveShift) ?? [];
            arr.push(t);
            byOct.set(t.octaveShift, arr);
          }
          const bestOct = [...byOct.entries()].sort(
            (a, b) => b[1].length - a[1].length,
          )[0];
          if (!bestOct) return null;
          const pts = bestOct[1];
          const minF = Math.min(...pts.map((t) => t.fret));
          const maxF = Math.max(...pts.map((t) => t.fret));
          const cx = (xOf(minF) + xOf(maxF)) / 2;
          return (
            <text
              key={`lbl-${shape}`}
              x={cx}
              y={labelY}
              textAnchor="middle"
              fontSize={Math.max(9, baseUnit * 0.5)}
              fontWeight={700}
              letterSpacing={2}
              fill={CAGED_SHAPE_HEX[shape]}
              opacity={shapeProgress ? 0.35 + (done / 3) * 0.45 : 0.65}
            >
              {shape}-shape
            </text>
          );
        })}
    </svg>
  );
}

/**
 * Wrapper that fills its parent container (typically the live `.fretboard`
 * element), measures the rendered pixel size with ResizeObserver, and hands
 * it to <CagedConstellation/> so stars land on real fret/string positions.
 */
export function CagedConstellationFill({
  cagedKey,
  fretCount,
  shapeProgress,
  revealedFrets,
  showLabels = true,
  showFretNumbers = true,
  labelsInside = false,
  singleOctave = false,
  soloShape,
  activeTones,
  className,
}: Omit<SizedProps, 'width' | 'height' | 'openStringW'>) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {size.w > 0 && size.h > 0 && (
        <CagedConstellation
          cagedKey={cagedKey}
          fretCount={fretCount}
          width={size.w}
          height={size.h}
          shapeProgress={shapeProgress}
          revealedFrets={revealedFrets}
          showLabels={showLabels}
          showFretNumbers={showFretNumbers}
          labelsInside={labelsInside}
          singleOctave={singleOctave}
          soloShape={soloShape}
          activeTones={activeTones}
        />
      )}
    </div>
  );
}
