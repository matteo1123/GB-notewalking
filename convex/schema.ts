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

  // One row per user — captures progress so users can switch between phone
  // and desktop. The completedNodes array is bounded (~22 max — total
  // skill-tree node count), well under Convex's 8192/row limit. We store node
  // IDs as strings so the schema stays decoupled from data/skillTree.ts.
  userProgress: defineTable({
    userId: v.id('users'),
    totalXp: v.number(),
    completedNodes: v.array(v.string()),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),
});
