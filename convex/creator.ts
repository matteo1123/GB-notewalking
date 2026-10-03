import { internalMutation, query, type QueryCtx } from './_generated/server';
import { v } from 'convex/values';

// Creator-only features (daily content brief, talk markers on recordings).
//
// Who counts as the creator is decided here, server-side, from the signed-in
// identity — never from anything the client sends. Set on the deployment:
//   CREATOR_EMAILS               comma-separated emails, e.g. me@example.com
//   CREATOR_TOKEN_IDENTIFIERS    (optional) comma-separated Convex
//                                tokenIdentifiers, for when the Clerk JWT
//                                template doesn't include the email claim
// Everyone else gets `false` / `null` from every function in this file.

function envList(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function isCreator(ctx: QueryCtx): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  if (envList('CREATOR_TOKEN_IDENTIFIERS').includes(identity.tokenIdentifier.toLowerCase())) return true;
  let email = identity.email?.toLowerCase();
  if (!email) {
    // The JWT may omit email; fall back to the address stored at sign-up.
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    email = user?.email?.toLowerCase();
  }
  return !!email && envList('CREATOR_EMAILS').includes(email);
}

export const amICreator = query({
  args: {},
  handler: async (ctx) => isCreator(ctx),
});

const briefFields = {
  date: v.string(), // YYYY-MM-DD the brief is for
  pillar: v.string(),
  topic: v.string(),
  hook: v.string(),
  points: v.array(v.string()),
  demo: v.string(),
};

// The brief for `today` (the client's local date), or the most recent one
// before it if the pipeline hasn't written today's yet. Creator only.
export const currentBrief = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    if (!(await isCreator(ctx))) return null;
    const brief = await ctx.db
      .query('creatorBriefs')
      .withIndex('by_date', (q) => q.lte('date', today))
      .order('desc')
      .first();
    if (!brief) return null;
    const { date, pillar, topic, hook, points, demo } = brief;
    return { date, pillar, topic, hook, points, demo, isToday: date === today };
  },
});

// Written by the content pipeline through the /pipeline/brief HTTP route.
// One brief per date; a re-run replaces it.
export const upsertBrief = internalMutation({
  args: briefFields,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('creatorBriefs')
      .withIndex('by_date', (q) => q.eq('date', args.date))
      .unique();
    const doc = { ...args, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.replace('creatorBriefs', existing._id, doc);
      return existing._id;
    }
    return ctx.db.insert('creatorBriefs', doc);
  },
});
