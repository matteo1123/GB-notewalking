// Drum sounds for the metronome, synthesized once into AudioBuffers.
//
// These used to be WAV samples in Supabase storage; that project is gone, the
// fetches failed, and the metronome silently fell back to its oscillator
// click. Synthesizing them means no files to host, no bandwidth, and nothing
// to break: the buffers exist as soon as there's an AudioContext.

type Fill = (t: number, i: number) => number;

function render(ctx: BaseAudioContext, seconds: number, fill: Fill): AudioBuffer {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.ceil(seconds * rate), rate);
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    data[i] = fill(i / rate, i);
    peak = Math.max(peak, Math.abs(data[i]));
  }
  // Normalize, and fade the last 5 ms so the tail never clicks.
  const gain = peak > 0 ? 0.9 / peak : 1;
  const fade = Math.floor(0.005 * rate);
  for (let i = 0; i < data.length; i++) {
    const tail = data.length - i < fade ? (data.length - i) / fade : 1;
    data[i] *= gain * tail;
  }
  return buffer;
}

// Deterministic noise, so every page load sounds the same.
function noise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x80000000 - 1;
  };
}

/** Kick: a sine sweeping 150 Hz → 45 Hz with a short beater click. */
function kick(ctx: BaseAudioContext): AudioBuffer {
  let phase = 0;
  const rate = ctx.sampleRate;
  const rnd = noise(7);
  return render(ctx, 0.45, (t) => {
    const f = 45 + 105 * Math.exp(-t * 30);
    phase += (2 * Math.PI * f) / rate;
    const body = Math.sin(phase) * Math.exp(-t * 7);
    const click = rnd() * Math.exp(-t * 400) * 0.35;
    return body + click;
  });
}

/** Snare: a 185 Hz drum tone under a bright burst of noise. */
function snare(ctx: BaseAudioContext): AudioBuffer {
  const rnd = noise(11);
  let prev = 0;
  return render(ctx, 0.25, (t) => {
    const n = rnd();
    const bright = n - prev; // first difference: a cheap high-pass, the snare wires
    prev = n;
    const wires = bright * Math.exp(-t * 18) * 0.6;
    const tone = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 30) * 0.5;
    return wires + tone;
  });
}

/** Ride: inharmonic metallic partials plus a soft wash of high noise. */
function ride(ctx: BaseAudioContext): AudioBuffer {
  const partials = [3150, 4230, 5380, 6820, 8170, 9400];
  const rnd = noise(23);
  let prev = 0;
  return render(ctx, 0.5, (t) => {
    let ping = 0;
    for (let k = 0; k < partials.length; k++) ping += Math.sin(2 * Math.PI * partials[k] * t + k);
    const n = rnd();
    const hiss = (n - prev) * 0.5;
    prev = n;
    const attack = Math.min(1, t / 0.002);
    return attack * ((ping / partials.length) * Math.exp(-t * 9) + hiss * Math.exp(-t * 14));
  });
}

export interface DrumKit {
  ride: AudioBuffer;
  kick: AudioBuffer;
  snare: AudioBuffer;
}

export function synthesizeDrumKit(ctx: BaseAudioContext): DrumKit {
  return { ride: ride(ctx), kick: kick(ctx), snare: snare(ctx) };
}
