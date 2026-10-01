// Timestamped log of what the app does during a recording, saved next to the
// video as JSON so tools (or an AI editor) can find moments to cut.
//
// The host calls add() freely; it's a no-op unless a recording is running.
// Timestamps are milliseconds from the moment the encoder started, i.e. the
// video's first frame (within ~0.1s of encoder start-up).

export interface SessionLogEvent {
  t: number;
  type: string;
  [field: string]: unknown;
}

export class SessionEventLog {
  private events: SessionLogEvent[] = [];
  private startedAt: number | null = null;

  get active() {
    return this.startedAt !== null;
  }

  /** `at` must be on the performance.now() clock. */
  start(at: number) {
    this.events = [];
    this.startedAt = at;
  }

  add(type: string, data: Record<string, unknown> = {}) {
    if (this.startedAt === null) return;
    const t = Math.max(0, Math.round(performance.now() - this.startedAt));
    this.events.push({ t, type, ...data });
  }

  /** Stop logging and hand back what was collected. */
  stop(): SessionLogEvent[] {
    const events = this.events;
    this.events = [];
    this.startedAt = null;
    return events;
  }

  clear() {
    this.events = [];
    this.startedAt = null;
  }
}

/** Pretty header, one event per line — readable by people and easy to stream-parse. */
export function serializeSessionLog(meta: Record<string, unknown>, events: SessionLogEvent[]): string {
  const head = JSON.stringify({ ...meta, events: [] }, null, 2);
  if (events.length === 0) return head;
  const body = events.map((e) => `    ${JSON.stringify(e)}`).join(',\n');
  return head.replace(/"events": \[\]/, () => `"events": [\n${body}\n  ]`);
}
