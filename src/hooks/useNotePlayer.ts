import { useCallback, useRef } from 'react';
import { assetUrl } from '@/lib/assetUrl';

const SHARP_TO_FLAT: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
};

function sharpToFlat(chord: string): string {
  const match = chord.match(/^([A-G])(#|b)?(m|dim|maj7|m7|7)?$/);
  if (!match) return chord;
  const [, root, accidental = '', quality = ''] = match;
  const pitch = root + accidental;
  return (SHARP_TO_FLAT[pitch] ?? pitch) + quality;
}

export function useNotePlayer(audioContext: AudioContext | null) {
  const bufferCache = useRef<Record<string, AudioBuffer>>({});
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const loadBuffer = useCallback(
    async (chord: string): Promise<AudioBuffer | null> => {
      if (!audioContext) return null;
      const formatted = sharpToFlat(chord);
      if (bufferCache.current[formatted]) return bufferCache.current[formatted];
      const url = assetUrl(`/chords/${formatted}.mp3`);
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.error(`Missing chord audio: ${url}`);
          return null;
        }
        const arr = await res.arrayBuffer();
        const buf = await audioContext.decodeAudioData(arr);
        bufferCache.current[formatted] = buf;
        return buf;
      } catch (err) {
        console.error(`Failed to load chord ${formatted}`, err);
        return null;
      }
    },
    [audioContext],
  );

  const playChord = useCallback(
    async (chord: string, volume = 1.0) => {
      if (!audioContext) return;
      const buffer = await loadBuffer(chord);
      if (!buffer) return;

      const source = audioContext.createBufferSource();
      source.buffer = buffer;

      const gain = audioContext.createGain();
      gain.gain.value = volume;

      source.connect(gain);
      gain.connect(audioContext.destination);
      source.start(0);

      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      };
    },
    [audioContext, loadBuffer],
  );

  const preloadChords = useCallback(
    async (chords: string[]) => {
      if (!audioContext) return;
      await Promise.all(chords.map((c) => loadBuffer(c)));
    },
    [audioContext, loadBuffer],
  );

  const stop = useCallback(() => {
    activeSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        // already stopped
      }
    });
    activeSourcesRef.current = [];
  }, []);

  const playNote = useCallback(async () => {
    // no-op: pedal/single-note playback removed in the slim build
  }, []);

  return { playChord, preloadChords, stop, playNote };
}
