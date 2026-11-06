import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getUserFromAuth } from './users';

// Bucket keys look like "I-V|C-top": a universe id, a pipe, a skill node id.
const KEY_RE = /^[A-Za-z-]{2,12}\|[A-Za-z-]{3,16}$/;
// One flush covers ~30s of play; anything far beyond that is not real time.
const MAX_DELTA_SECONDS = 15 * 60;
const MAX_KEYS = 200;

export const getPracticeTime = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      seconds: v.record(v.string(), v.number()),
      expanseOpened: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const user = await getUserFromAuth(ctx);
    if (!user) return null;
    const row = await ctx.db
      .query('practiceTime')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    return {
      seconds: row?.seconds ?? {},
      expanseOpened: row?.expanseOpenedAt !== undefined,
    };
  },
});

/**
 * Adds per-bucket second deltas (not totals) so two devices practicing the
 * same section both count. Optionally records that the Expanse was opened.
 */
export const addPracticeTime = mutation({
  args: {
    deltas: v.record(v.string(), v.number()),
    expanseOpened: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { deltas, expanseOpened }) => {
    const user = await getUserFromAuth(ctx);
    if (!user) throw new Error('Not signed in');
    const existing = await ctx.db
      .query('practiceTime')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();

    const seconds: Record<string, number> = { ...(existing?.seconds ?? {}) };
    for (const [key, delta] of Object.entries(deltas)) {
      if (!KEY_RE.test(key)) continue;
      if (!Number.isFinite(delta) || delta <= 0) continue;
      if (!(key in seconds) && Object.keys(seconds).length >= MAX_KEYS) continue;
      seconds[key] = (seconds[key] ?? 0) + Math.min(delta, MAX_DELTA_SECONDS);
    }

    const now = Date.now();
    const expanseOpenedAt =
      existing?.expanseOpenedAt ?? (expanseOpened ? now : undefined);

    if (existing) {
      await ctx.db.patch('practiceTime', existing._id, {
        seconds,
        updatedAt: now,
        ...(expanseOpenedAt !== undefined ? { expanseOpenedAt } : {}),
      });
    } else {
      await ctx.db.insert('practiceTime', {
        userId: user._id,
        seconds,
        updatedAt: now,
        ...(expanseOpenedAt !== undefined ? { expanseOpenedAt } : {}),
      });
    }
    return null;
  },
});
