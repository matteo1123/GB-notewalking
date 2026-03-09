import { BasicPitch, noteFramesToTime, addPitchBendsToNoteEvents } from "@spotify/basic-pitch";

let basicPitch: BasicPitch | null = null;
let isInitializing = false;

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/model/model.json";

async function initModel() {
    if (basicPitch) return;
    if (isInitializing) {
        while (isInitializing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return;
    }

    isInitializing = true;
    try {
        self.postMessage({ type: 'STATUS', payload: 'Initializing pitch model...' });
        basicPitch = new BasicPitch(MODEL_URL);
        self.postMessage({ type: 'STATUS', payload: 'Pitch model ready.' });
    } catch (err: any) {
        console.error("BasicPitch init error:", err);
        self.postMessage({ type: 'ERROR', payload: 'Failed to load MIDI model: ' + err.message });
    } finally {
        isInitializing = false;
    }
}

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'INIT') {
        await initModel();
    } else if (type === 'PROCESS_AUDIO') {
        try {
            await initModel();

            if (!basicPitch) {
                throw new Error("Model not initialized");
            }

            self.postMessage({ type: 'STATUS', payload: 'Analyzing audio...' });

            // payload in PROCESS_AUDIO is expected to be a Float32Array containing mono, 22050Hz
            const frames: number[][] = [];
            const onsets: number[][] = [];
            const contours: number[][] = [];

            await basicPitch.evaluateModel(
                payload,
                (f: number[][], o: number[][], c: number[][]) => {
                    frames.push(...f);
                    onsets.push(...o);
                    contours.push(...c);
                },
                (percent: number) => {
                    self.postMessage({ type: 'PROGRESS', payload: percent });
                }
            );

            // Convert raw frames to note events using Spotify's utility functions
            // @ts-ignore - Spotify types mismatch with their own utility signature occasionally
            const baseEvents = noteFramesToTime(frames, onsets);
            // @ts-ignore
            const withBends = addPitchBendsToNoteEvents(contours, baseEvents);
            // @ts-ignore
            const noteEvents = noteFramesToTime(withBends);

            self.postMessage({ type: 'RESULT', payload: noteEvents });

        } catch (error: any) {
            console.error("Worker processing error:", error);
            self.postMessage({ type: 'ERROR', payload: error.message || "Unknown processing error" });
        }
    }
};
