import type { CagedShape } from '@/lib/cagedSystem';
import { assetUrl } from '@/lib/assetUrl';

export type ShapeId = CagedShape;

export type NodeId =
  | 'landing-video'
  | 'hub-intro'
  | `${ShapeId}-top`
  | `${ShapeId}-bot`
  | `${ShapeId}-full`
  | 'connect-CA'
  | 'connect-AG'
  | 'connect-GE'
  | 'connect-ED'
  | 'connect-DC';

export type UnlockKind = 'landing' | 'intro' | 'top' | 'bot' | 'full' | 'connect';

// Free entry-point video grants this much XP the first time it's watched —
// just enough to make the unlocked CAGED hub feel earned, not given.
export const LANDING_VIDEO_XP_REWARD = 5;

export interface SkillNode {
  id: NodeId;
  title: string;
  subtitle: string;
  tagline: string;
  description: string;
  videoSrc: string;
  prerequisites: NodeId[];
  shape?: ShapeId;
  kind: UnlockKind;
  connectPair?: [ShapeId, ShapeId];
  /** Grid position (fractional cells allowed). Rendered via gap * cell → px. */
  gridRow: number;
  gridCol: number;
  unlockCost: number;
}

export const UNLOCK_COST: Record<UnlockKind, number> = {
  landing: 0,
  intro: 0,
  top: 10,
  bot: 15,
  full: 25,
  connect: 40,
};

const SHAPES: ShapeId[] = ['C', 'A', 'G', 'E', 'D'];

// Compass angle per shape (0 = north, clockwise, degrees)
const SHAPE_COMPASS: Record<ShapeId, number> = {
  C: 0,
  A: 72,
  G: 144,
  E: 216,
  D: 288,
};

const POD_R = 3;
const FULL_R = 5.2;

function polarGrid(compassDeg: number, r: number) {
  const rad = (compassDeg * Math.PI) / 180;
  return {
    col: r * Math.sin(rad),
    row: -r * Math.cos(rad),
  };
}

const flavor: Record<ShapeId, { name: string; teaser: string }> = {
  C: { name: 'C Shape', teaser: 'The foundation stone. Your first territory.' },
  A: { name: 'A Shape', teaser: 'Sturdy ground. The bass-rooted barre.' },
  G: { name: 'G Shape', teaser: 'Wide and ringing. The open-voice sprawl.' },
  E: { name: 'E Shape', teaser: 'The heavy one. Every rock lick lives here.' },
  D: { name: 'D Shape', teaser: 'High and bright. The treble outpost.' },
};

const halfFlavor = {
  top: { suffix: 'Top Half', tagline: 'Strings 1·2·3 — the treble voice sings.' },
  bot: { suffix: 'Bottom Half', tagline: 'Strings 4·5·6 — the bass voice rumbles.' },
  full: { suffix: 'Full Shape', tagline: 'Unite both realms into one shape.' },
};

function buildShapeNodes(): SkillNode[] {
  const nodes: SkillNode[] = [];
  SHAPES.forEach((shape) => {
    const compass = SHAPE_COMPASS[shape];
    const topG = polarGrid(compass - 18, POD_R);
    const botG = polarGrid(compass + 18, POD_R);
    const fullG = polarGrid(compass, FULL_R);

    const { name, teaser } = flavor[shape];

    // Progression order per shape: bottom → top → full. The bass strings are
    // the first contact most learners make with a CAGED shape (root note,
    // bass-rooted barre), so each shape's pod opens with its bottom half.
    nodes.push({
      id: `${shape}-bot`,
      title: `${name} — Bottom`,
      subtitle: `${name}: ${halfFlavor.bot.suffix}`,
      tagline: halfFlavor.bot.tagline,
      description: `Learn the bass side of the ${name.toLowerCase()}. ${teaser}`,
      videoSrc: assetUrl(`/videos/${shape.toLowerCase()}-bot.mp4`),
      prerequisites: ['hub-intro'],
      shape,
      kind: 'bot',
      gridRow: botG.row,
      gridCol: botG.col,
      unlockCost: UNLOCK_COST.bot,
    });

    nodes.push({
      id: `${shape}-top`,
      title: `${name} — Top`,
      subtitle: `${name}: ${halfFlavor.top.suffix}`,
      tagline: halfFlavor.top.tagline,
      description: `Learn the treble side of the ${name.toLowerCase()}. ${teaser}`,
      videoSrc: assetUrl(`/videos/${shape.toLowerCase()}-top.mp4`),
      prerequisites: [`${shape}-bot`],
      shape,
      kind: 'top',
      gridRow: topG.row,
      gridCol: topG.col,
      unlockCost: UNLOCK_COST.top,
    });

    nodes.push({
      id: `${shape}-full`,
      title: `${name} — Full`,
      subtitle: `${name}: ${halfFlavor.full.suffix}`,
      tagline: halfFlavor.full.tagline,
      description: `Unite top and bottom halves of the ${name.toLowerCase()} into a single musical voice.`,
      videoSrc: assetUrl(`/videos/${shape.toLowerCase()}-full.mp4`),
      prerequisites: [`${shape}-top`],
      shape,
      kind: 'full',
      gridRow: fullG.row,
      gridCol: fullG.col,
      unlockCost: UNLOCK_COST.full,
    });
  });
  return nodes;
}

function buildConnectNodes(): SkillNode[] {
  const pairs: [ShapeId, ShapeId][] = [
    ['C', 'A'],
    ['A', 'G'],
    ['G', 'E'],
    ['E', 'D'],
    ['D', 'C'],
  ];
  return pairs.map(([a, b]) => {
    const angleA = SHAPE_COMPASS[a];
    let angleB = SHAPE_COMPASS[b];
    if (Math.abs(angleB - angleA) > 180) {
      angleB += angleB < angleA ? 360 : -360;
    }
    const bisector = (angleA + angleB) / 2;
    const g = polarGrid(bisector, FULL_R * 0.82);
    return {
      id: `connect-${a}${b}` as NodeId,
      title: `${a} → ${b}`,
      subtitle: `Connect ${flavor[a].name} → ${flavor[b].name}`,
      tagline: 'Bridge two territories. Move between shapes without breaking the line.',
      description: `Master the seam between ${flavor[a].name} and ${flavor[b].name}. Practice lines that cross the boundary cleanly in both directions.`,
      videoSrc: assetUrl(`/videos/connect-${a.toLowerCase()}${b.toLowerCase()}.mp4`),
      prerequisites: [`${a}-full`, `${b}-full`],
      kind: 'connect' as UnlockKind,
      connectPair: [a, b] as [ShapeId, ShapeId],
      gridRow: g.row,
      gridCol: g.col,
      unlockCost: UNLOCK_COST.connect,
    };
  });
}

const HUB_INTRO_NODE: SkillNode = {
  id: 'hub-intro',
  title: 'CAGED Overview',
  subtitle: 'The full course unlocks here',
  tagline: 'A 90-second tour of the map — and the gateway to the whole course.',
  description:
    "Short intro to how the tree works: practice earns XP, XP unlocks video lessons, and lessons reveal more of the fretboard. When you're ready, unlock C Shape — Top to start.",
  videoSrc: assetUrl('/videos/hub-intro.mp4'),
  prerequisites: ['landing-video'],
  kind: 'intro',
  gridRow: 0,
  gridCol: 0,
  unlockCost: UNLOCK_COST.intro,
};

// Landing video — south of the hub, no prereqs, free to watch. Watching it
// grants LANDING_VIDEO_XP_REWARD and unlocks the CAGED hub, which then becomes
// the paywall trigger.
const LANDING_VIDEO_NODE: SkillNode = {
  id: 'landing-video',
  title: 'Watch the Intro',
  subtitle: 'Welcome to GuitarBrain',
  tagline: 'A two-minute look at what this app does.',
  description:
    'Quick intro video — no account needed. Watch it to earn 5 XP and reveal the CAGED course above.',
  videoSrc: assetUrl('/videos/landing-intro.mp4'),
  prerequisites: [],
  kind: 'landing',
  gridRow: 2.4,
  gridCol: 0,
  unlockCost: UNLOCK_COST.landing,
};

export const SKILL_NODES: SkillNode[] = [
  LANDING_VIDEO_NODE,
  HUB_INTRO_NODE,
  ...buildShapeNodes(),
  ...buildConnectNodes(),
];

export const SKILL_NODE_BY_ID: Record<NodeId, SkillNode> = SKILL_NODES.reduce(
  (acc, n) => {
    acc[n.id] = n;
    return acc;
  },
  {} as Record<NodeId, SkillNode>,
);

export const TOTAL_NODES = SKILL_NODES.length;

export interface ShapeTheme {
  id: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  text: string;
  label: string;
  gradId: string;
}

/** Per-shape theme — mirrors Course.tsx category themes. */
export const SHAPE_THEMES: Record<ShapeId, ShapeTheme> = {
  C: {
    id: 'C',
    color: '#3b82f6',
    bg: 'bg-blue-600',
    border: 'border-blue-500',
    glow: 'shadow-[0_0_50px_rgba(59,130,246,0.6)]',
    text: 'text-blue-400',
    label: 'C Shape Realm',
    gradId: 'grad-shape-C',
  },
  A: {
    id: 'A',
    color: '#ec4899',
    bg: 'bg-pink-600',
    border: 'border-pink-500',
    glow: 'shadow-[0_0_50px_rgba(236,72,153,0.6)]',
    text: 'text-pink-400',
    label: 'A Shape Void',
    gradId: 'grad-shape-A',
  },
  G: {
    id: 'G',
    color: '#10b981',
    bg: 'bg-emerald-600',
    border: 'border-emerald-500',
    glow: 'shadow-[0_0_50px_rgba(16,185,129,0.6)]',
    text: 'text-emerald-400',
    label: 'G Shape Spire',
    gradId: 'grad-shape-G',
  },
  E: {
    id: 'E',
    color: '#a855f7',
    bg: 'bg-purple-600',
    border: 'border-purple-500',
    glow: 'shadow-[0_0_50px_rgba(168,85,247,0.6)]',
    text: 'text-purple-400',
    label: 'E Shape Temple',
    gradId: 'grad-shape-E',
  },
  D: {
    id: 'D',
    color: '#f97316',
    bg: 'bg-orange-600',
    border: 'border-orange-500',
    glow: 'shadow-[0_0_50px_rgba(249,115,22,0.6)]',
    text: 'text-orange-400',
    label: 'D Shape Territory',
    gradId: 'grad-shape-D',
  },
};

export const HUB_THEME: ShapeTheme = {
  id: 'main',
  color: '#4f46e5',
  bg: 'bg-indigo-600',
  border: 'border-indigo-500',
  glow: 'shadow-[0_0_50px_rgba(79,70,229,0.6)]',
  text: 'text-indigo-400',
  label: 'Core Hub',
  gradId: 'grad-shape-main',
};

export function themeOf(node: SkillNode): ShapeTheme {
  if (node.shape) return SHAPE_THEMES[node.shape];
  if (node.connectPair) return SHAPE_THEMES[node.connectPair[0]];
  return HUB_THEME;
}
