import { useMemo } from 'react';

interface NoteParticlesProps {
  /** Changing this between renders regenerates random trajectories. Pair it
   * with a React `key` prop on the host element to force a remount so the
   * CSS animation re-triggers for every sparkle burst. */
  burstId: number;
  count?: number;
}

/**
 * A single sparkle burst — a handful of short-lived particles that fly
 * outward from (0,0) with randomized angle, distance, size, and duration.
 * Parent positions this inside a fretboard grid cell; the particles paint
 * around that cell's center for ~800ms and then vanish.
 */
export function NoteParticles({ burstId, count = 7 }: NoteParticlesProps) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      // Wide distance + size ranges so a single cell gets a scatter of
      // near/far, dusty/bright particles instead of a uniform ring.
      const distance = 10 + Math.random() * 30;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const size = 1 + Math.random() * 3.2;
      const delay = Math.random() * 160;
      const duration = 500 + Math.random() * 500;
      return { i, dx, dy, size, delay, duration };
    });
    // burstId participates in the deps so a parent that reuses the same
    // NoteParticles instance across bursts still regenerates trajectories.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burstId, count]);

  return (
    <div className="note-sparkle-burst" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.i}
          className="note-sparkle"
          style={{
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
            ['--sz' as string]: `${p.size}px`,
            ['--dur' as string]: `${p.duration}ms`,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default NoteParticles;
