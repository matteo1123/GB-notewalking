'use node';

import { action } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import Stripe from 'stripe';

// Creates a Stripe Checkout Session for the $9.99 one-time unlock and returns
// the redirect URL. The frontend should `window.location.assign(url)` on it.
//
// Env vars (set on Convex, not Cloudflare):
//   STRIPE_SECRET_KEY   — sk_live_… or sk_test_…
//   STRIPE_PRICE_ID     — price_… for the $9.99 product
//   APP_URL             — public site URL (e.g. https://guitarbrain.org)
export const createCheckoutSession = action({
  args: {
    successPath: v.optional(v.string()),
    cancelPath: v.optional(v.string()),
  },
  handler: async (ctx, { successPath, cancelPath }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not signed in');

    const userId = await ctx.runMutation(internal.users.ensureUserInternal, {
      clerkId: identity.subject,
      email: identity.email,
    });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-03-25.dahlia',
    });

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      customer_email: identity.email,
      success_url: `${appUrl}${successPath ?? '/?paid=1'}`,
      cancel_url: `${appUrl}${cancelPath ?? '/unlock'}`,
      client_reference_id: identity.subject,
      metadata: { clerkId: identity.subject, convexUserId: userId },
    });

    await ctx.runMutation(internal.purchases.recordPendingPurchase, {
      userId,
      stripeSessionId: session.id,
    });

    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return session.url;
  },
});
