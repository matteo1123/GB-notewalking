import { internalMutation, mutation, query, type QueryCtx, type MutationCtx } from './_generated/server';
import { v } from 'convex/values';

// Look up the Convex user row corresponding to the currently-authenticated
// Clerk identity. Returns null if not signed in or not yet provisioned.
export async function getUserFromAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique();
}

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await getUserFromAuth(ctx);
    return user
      ? { _id: user._id, email: user.email ?? identity.email, clerkId: user.clerkId }
      : null;
  },
});

// Idempotent — call from the frontend after sign-in to ensure a user row
// exists for this Clerk identity. Safe to call repeatedly.
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not signed in');
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert('users', {
      clerkId: identity.subject,
      email: identity.email,
    });
  },
});

// Internal twin of ensureUser: takes the identity fields explicitly so it can
// be called from a node action (where re-running the auth check inside a
// mutation would be redundant — the action already has the identity).
export const ensureUserInternal = internalMutation({
  args: { clerkId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, { clerkId, email }) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert('users', { clerkId, email });
  },
});
