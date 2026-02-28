import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useNotePlayer(audioContext: AudioContext | null) {
  const audioBufferCache = useRef<Record<string, AudioBuffer>>({});

  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const playNote = useCallback(
    async (note: string, volume: number = 1.0) => {
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

        // Create a gain node for volume control
        const gainNode = audioContext.createGain();
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        source.start(0);
        currentSourceRef.current = source;
      } catch (error) {
        console.error(`Failed to play note ${note}`, error);
      }
    },
    [audioContext]
  );

  const preloadNotes = useCallback(
    async (notes: string[]) => {
      if (!audioContext) return;

      const promises = notes.map(async (note) => {
        const noteUrl = `https://idsufbsfywgmcrhldqxq.supabase.co/storage/v1/object/public/Piano/${note}.mp3`;
        if (audioBufferCache.current[noteUrl]) return;

        try {
          const response = await fetch(noteUrl);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBufferCache.current[noteUrl] = buffer;
        } catch (error) {
          console.error(`Failed to preload note ${note}`, error);
        }
      });

      await Promise.all(promises);
    },
    [audioContext]
  );

  const playChord = useCallback(
    async (chord: string, volume: number = 1.0) => {
      if (!audioContext) return;

      // Ensure proper formatting for sharps/flats if needed. The Guitar bucket has files like C.mp3, Cm.mp3, Db.mp3, Bbm.mp3
      const formattedChord = chord.replace('#', 'b');

      try {
        let buffer;
        if (audioBufferCache.current[formattedChord]) {
          buffer = audioBufferCache.current[formattedChord];
        } else {
          // Guitar bucket is public — use getPublicUrl for direct access
          const { data } = supabase.storage.from('Guitar').getPublicUrl(`${formattedChord}.mp3`);
          if (!data?.publicUrl) {
            console.error(`Failed to get public URL for chord ${formattedChord}`);
            return;
          }

          const response = await fetch(data.publicUrl);
          const arrayBuffer = await response.arrayBuffer();
          buffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBufferCache.current[formattedChord] = buffer;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        source.start(0);
        // We do not overwrite currentSourceRef so that drone/chord does not immediately stop if playSequence or something else is running concurrently, 
        //, but keeping track of it could be useful if they want to stop it. 
        // For drone notes, we usually let them ring out. 
      } catch (error) {
        console.error(`Failed to play chord ${chord}`, error);
      }
    },
    [audioContext]
  );

  const preloadChords = useCallback(
    async (chords: string[]) => {
      if (!audioContext) return;

      const promises = chords.map(async (chord) => {
        const formattedChord = chord.replace('#', 'b');
        if (audioBufferCache.current[formattedChord]) return;

        try {
          const { data } = supabase.storage.from('Guitar').getPublicUrl(`${formattedChord}.mp3`);
          if (!data?.publicUrl) return;

          const response = await fetch(data.publicUrl);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBufferCache.current[formattedChord] = buffer;
        } catch (error) {
          console.error(`Failed to preload chord ${chord}`, error);
        }
      });

      await Promise.all(promises);
    },
    [audioContext]
  );

  const playSequence = useCallback(
    async (
      notes: { string: number; fret: number }[],
      tempo: number = 1.0,
      volume: number = 1.0,
      onNoteStart?: (index: number) => void,
      onComplete?: () => void
    ) => {
      if (!audioContext || notes.length === 0) return;

      const getNoteFromFret = (stringNum: number, fret: number): string => {
        const standardTuning = ["E", "B", "G", "D", "A", "E"];
        const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const openNotes = ["E4", "B3", "G3", "D3", "A2", "E2"];

        const openNote = openNotes[stringNum - 1];
        const noteMatch = openNote.match(/([A-G]#?)(\d)/);
        if (!noteMatch) return "C4";

        const [, noteName, octaveStr] = noteMatch;
        let octave = parseInt(octaveStr);
        let noteIndex = notes.indexOf(noteName);

        noteIndex = (noteIndex + fret) % 12;
        octave += Math.floor((notes.indexOf(noteName) + fret) / 12);

        const finalNote = `${notes[noteIndex]}${octave}`;

        // Convert sharps to flats for file naming (# breaks URLs)
        return finalNote.replace('C#', 'Db')
          .replace('D#', 'Eb')
          .replace('F#', 'Gb')
          .replace('G#', 'Ab')
          .replace('A#', 'Bb');
      };

      const noteDuration = 600 / tempo; // Base duration in ms

      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        const noteName = getNoteFromFret(note.string, note.fret);

        onNoteStart?.(i);
        await playNote(noteName, volume);

        await new Promise(resolve => setTimeout(resolve, noteDuration));
      }

      onComplete?.();
    },
    [audioContext, playNote]
  );

  const stop = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      currentSourceRef.current = null;
    }
  }, []);

  return { playNote, playChord, playSequence, preloadNotes, preloadChords, stop };
}