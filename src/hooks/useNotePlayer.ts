import { useCallback, useRef } from "react";

export function useNotePlayer(audioContext: AudioContext | null) {
  const audioBufferCache = useRef<Record<string, AudioBuffer>>({});

  const playNote = useCallback(
    async (note: string) => {
      if (!audioContext) return;

      const noteUrl = `https://idsufbsfywgmcrhldqxq.supabase.co/storage/v1/object/public/Piano/${note}.mp3`;
      console.log("Fetching note from:", noteUrl);

      try {
        let buffer;
        if (audioBufferCache.current[noteUrl]) {
          buffer = audioBufferCache.current[noteUrl];
        } else {
          const response = await fetch(noteUrl);
          const arrayBuffer = await response.arrayBuffer();
          buffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBufferCache.current[noteUrl] = buffer;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
      } catch (error) {
        console.error(`Failed to play note ${note}`, error);
      }
    },
    [audioContext]
  );

  return { playNote };
}