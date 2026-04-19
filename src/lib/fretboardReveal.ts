import {
  getShapeRevealPositions,
  CAGED_SHAPES,
  type CagedShape,
} from '@/lib/cagedSystem';
import type { NodeId, ShapeId } from '@/data/skillTree';

const TOP_STRINGS = new Set([1, 2, 3]);
const BOT_STRINGS = new Set([4, 5, 6]);
const VALID_SHAPES = new Set<string>(CAGED_SHAPES);

function isShape(id: string): id is CagedShape {
  return VALID_SHAPES.has(id);
}

export function computeRevealedFrets(key: string, completed: Set<NodeId>): Set<string> {
  const revealed = new Set<string>();
  if (completed.size === 0) return revealed;

  for (const id of completed) {
    if (id === 'hub-intro') continue;

    if (id.startsWith('connect-')) {
      const a = id[8];
      const b = id[9];
      if (!isShape(a) || !isShape(b)) continue;
      // A connect node represents owning the bridge between two shapes — so
      // its focused view shows EVERY note from both shapes (the union, with
      // overlaps naturally collapsed by the Set). An earlier version used the
      // pentatonic intersection, which read as "the seam" but visually showed
      // FEWER notes than either shape alone — confusing because the connect
      // node sits downstream of two full-shape unlocks.
      const aPos = getShapeRevealPositions(key, a, 22);
      const bPos = getShapeRevealPositions(key, b, 22);
      for (const pos of aPos) revealed.add(pos);
      for (const pos of bPos) revealed.add(pos);
      continue;
    }

    const dash = id.lastIndexOf('-');
    const shapeStr = id.slice(0, dash) as ShapeId;
    const half = id.slice(dash + 1) as 'top' | 'bot' | 'full';
    if (!isShape(shapeStr)) continue;

    const strings =
      half === 'top' ? TOP_STRINGS : half === 'bot' ? BOT_STRINGS : null;

    // Per-shape reveal: every in-scale note inside the pent window plus the
    // leading-tone-below / 4th-above. Boundary pent notes appear in BOTH
    // neighbouring shapes — exactly what we want so unlocking one shape still
    // shows its full shared edge with neighbours.
    const positions = getShapeRevealPositions(key, shapeStr, 22);
    for (const pos of positions) {
      if (strings) {
        const s = Number(pos.slice(0, pos.indexOf('-')));
        if (!strings.has(s)) continue;
      }
      revealed.add(pos);
    }
  }

  return revealed;
}
