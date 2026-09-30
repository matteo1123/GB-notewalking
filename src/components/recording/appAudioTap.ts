// Captures the app's own audio output (chord playback, metronome, drums)
// without touching the code that produces it.
//
// Every player in the app creates short-lived nodes per chord/beat and wires
// them straight to `ctx.destination`, and there's no Web Audio API for
// reading what a destination receives. So while a recording is running we
// wrap AudioNode.prototype.connect: any connection to an AudioDestinationNode
// is left exactly as it was (the user still hears it) and ALSO mirrored into
// a MediaStreamAudioDestinationNode for that context. One tap per context;
// each new tap's stream is handed to `onStream` for mixing.
//
// The wrapper is installed only between start and stop, and is fully
// restored afterwards. Audio already ringing when the tap starts isn't
// captured — in practice that's covered by the 3-2-1 countdown.

type ConnectFn = AudioNode['connect'];

let originalConnect: ConnectFn | null = null;

export function startAppAudioTap(onStream: (stream: MediaStream) => void): () => void {
  if (originalConnect) {
    // Already tapping (shouldn't happen — one recording at a time).
    return () => {};
  }
  const original = AudioNode.prototype.connect;
  originalConnect = original;
  const taps = new Map<BaseAudioContext, MediaStreamAudioDestinationNode>();

  function tappedConnect(this: AudioNode, ...args: unknown[]) {
    const result = (original as (...a: unknown[]) => unknown).apply(this, args);
    const [destination, output] = args;
    const ctx = this.context;
    if (
      destination instanceof AudioDestinationNode &&
      typeof AudioContext !== 'undefined' &&
      ctx instanceof AudioContext &&
      ctx.state !== 'closed'
    ) {
      try {
        let tap = taps.get(ctx);
        if (!tap) {
          tap = ctx.createMediaStreamDestination();
          taps.set(ctx, tap);
          onStream(tap.stream);
        }
        if (typeof output === 'number') original.call(this, tap, output);
        else original.call(this, tap);
      } catch (err) {
        // Never let recording break playback.
        console.warn('[recording] app audio tap failed', err);
      }
    }
    return result;
  }

  AudioNode.prototype.connect = tappedConnect as ConnectFn;

  return () => {
    if (AudioNode.prototype.connect === (tappedConnect as ConnectFn)) {
      AudioNode.prototype.connect = original;
    }
    originalConnect = null;
    taps.forEach((tap) => {
      tap.stream.getTracks().forEach((t) => t.stop());
      try {
        tap.disconnect();
      } catch {
        // context may already be closed
      }
    });
    taps.clear();
  };
}
