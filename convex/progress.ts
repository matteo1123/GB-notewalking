import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getUserFromAuth } from './users';

// Per-user XP + completed-node list. Acts as the cross-device source of
// truth — the client merges this with localStorage on sign-in and then
// pushes updates back here as the user makes progress.
export const getProgress = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUserFromAuth(ctx);
    if (!user) return null;
    const row = await ctx.db
      .query('userProgress')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    return {
      totalXp: row?.totalXp ?? 0,
      completedNodes: row?.completedNodes ?? [],
    };
  },
});

export const setProgress = mutation({
  args: {
    totalXp: v.number(),
    completedNodes: v.array(v.string()),
  },
  handler: async (ctx, { totalXp, completedNodes }) => {
    const user = await getUserFromAuth(ctx);
    if (!user) throw new Error('Not signed in');
    const existing = await ctx.db
      .query('userProgress')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        totalXp,
        completedNodes,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('userProgress', {
        userId: user._id,
        totalXp,
        completedNodes,
        updatedAt: Date.now(),
      });
    }
  },
});
