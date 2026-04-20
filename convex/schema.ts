import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.optional(v.string()),
  }).index('by_clerk_id', ['clerkId']),

  purchases: defineTable({
    userId: v.id('users'),
    stripeSessionId: v.string(),
    status: v.union(v.literal('pending'), v.literal('paid'), v.literal('refunded')),
    amount: v.optional(v.number()),
    paidAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_session', ['stripeSessionId']),
});
