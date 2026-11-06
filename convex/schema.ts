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

  // One row per user — practice time per "universe|section" bucket (e.g.
  // "I-IV|C-top", "I-V|connect-CA") plus when they opened the Expanse. Kept
  // apart from userProgress because it's written every ~30s while playing,
  // and so older clients calling progress.setProgress can't clobber it.
  // Bounded: 7 universes × 20 sections = 140 keys max.
  practiceTime: defineTable({
    userId: v.id('users'),
    seconds: v.record(v.string(), v.number()),
    expanseOpenedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // Creator-only daily content brief, written by the content pipeline
  // (gb-content-pipeline) via POST /pipeline/brief. Read only through
  // creator.currentBrief, which returns null for everyone but the creator.
  // One row per date; `points` is 2-3 short bullets.
  creatorBriefs: defineTable({
    date: v.string(),
    pillar: v.string(),
    topic: v.string(),
    hook: v.string(),
    points: v.array(v.string()),
    demo: v.string(),
    updatedAt: v.number(),
  }).index('by_date', ['date']),
});
