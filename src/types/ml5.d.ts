declare module 'ml5' {
  interface ml5 {
    sound: {
      pitchDetection: (
        model: string,
        audioContext: AudioContext,
        stream: MediaStream,
        callback: () => void
      ) => PitchDetectionModel;
    };
    (callback: () => void): void;
  }

  export interface PitchDetectionModel {
    getPitch: (callback: (err: Error | null, frequency: number | null) => void) => void;
  }

  const ml5: ml5;
  export default ml5;
}