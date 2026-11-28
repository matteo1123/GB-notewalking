import { internalMutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getUserFromAuth } from './users';

/** Friends given Notewalking by the creator: GIFT_EMAILS on the deployment, comma-separated. */
function gifted(email: string | undefined): boolean {
  if (!email) return false;
  const list = (process.env.GIFT_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

// Drives the in-app paywall gate. Returns true if the signed-in user has any
// `paid` purchase row, or was given it (GIFT_EMAILS). Unauthenticated → false.
export const isPurchased = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const user = await getUserFromAuth(ctx);
    if (gifted(user?.email ?? identity.email)) return true;
    if (!user) return false;
    const paid = await ctx.db
      .query('purchases')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .filter((q) => q.eq(q.field('status'), 'paid'))
      .first();
    return !!paid;
  },
});

// Called from the Stripe checkout action right after creating a Session, so
// we can recognize the webhook later. Internal — never exposed to the client.
export const recordPendingPurchase = internalMutation({
  args: {
    userId: v.id('users'),
    stripeSessionId: v.string(),
  },
  handler: async (ctx, { userId, stripeSessionId }) => {
    return ctx.db.insert('purchases', {
      userId,
      stripeSessionId,
      status: 'pending',
    });
  },
});

// Called from the Stripe webhook handler when checkout.session.completed
// fires. Marks the matching pending row as paid.
export const markSessionPaid = internalMutation({
  args: {
    stripeSessionId: v.string(),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, { stripeSessionId, amount }) => {
    const row = await ctx.db
      .query('purchases')
      .withIndex('by_session', (q) => q.eq('stripeSessionId', stripeSessionId))
      .unique();
    if (!row) return;
    await ctx.db.patch(row._id, {
      status: 'paid',
      amount,
      paidAt: Date.now(),
    });
  },
});
