// Polyfill window and document for TensorFlow.js compatibility in Web Workers
// TensorFlow.js checks for these globals even in worker context
(self as any).window = self;
(self as any).document = {
    createElement: () => ({ getContext: () => null }),
    body: { appendChild: () => {}, removeChild: () => {} },
    documentElement: { style: {} },
    head: { appendChild: () => {} },
    createElementNS: () => ({ getContext: () => null }),
    addEventListener: () => {},
    removeEventListener: () => {},
    hidden: false,
    visibilityState: 'visible'
};

// Some TF.js code checks navigator
(self as any).navigator = (self as any).navigator || {
    userAgent: 'Mozilla/5.0 (Worker)',
    platform: 'Worker',
    vendor: ''
};

// Polyfill HTMLCanvasElement for TF.js canvas operations
(self as any).HTMLCanvasElement = class HTMLCanvasElement {};
(self as any).HTMLVideoElement = class HTMLVideoElement {};
(self as any).HTMLImageElement = class HTMLImageElement {};

console.log('[BasicPitch Worker] VERSION 4 - Polyfills applied');

import { BasicPitch, noteFramesToTime, addPitchBendsToNoteEvents } from "@spotify/basic-pitch";

console.log('[BasicPitch Worker] VERSION 4 - Worker script loaded, BasicPitch imported');

// Global error handler for uncaught exceptions in worker
self.onerror = (event) => {
    console.error('[BasicPitch Worker] GLOBAL ERROR:', event);
    self.postMessage({ type: 'ERROR', payload: 'Worker global error: ' + (event.message || 'Unknown') });
    return true; // Prevents the error from bubbling
};

self.onunhandledrejection = (event) => {
    console.error('[BasicPitch Worker] UNHANDLED REJECTION:', event.reason);
    self.postMessage({ type: 'ERROR', payload: 'Worker unhandled rejection: ' + (event.reason?.message || 'Unknown') });
};

let basicPitch: BasicPitch | null = null;
let isInitializing = false;

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/model/model.json";

async function initModel() {
    console.log('[BasicPitch Worker] initModel called, basicPitch exists:', !!basicPitch, 'isInitializing:', isInitializing);
    if (basicPitch) {
        console.log('[BasicPitch Worker] Model already initialized');
        return;
    }
    if (isInitializing) {
        console.log('[BasicPitch Worker] Waiting for initialization to complete...');
        while (isInitializing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return;
    }

    isInitializing = true;
    console.log('[BasicPitch Worker] Starting model initialization...');
    console.log('[BasicPitch Worker] Model URL:', MODEL_URL);
    
    // First verify the model is accessible
    try {
        console.log('[BasicPitch Worker] Testing model URL accessibility...');
        const modelCheck = await fetch(MODEL_URL, { method: 'HEAD' });
        console.log('[BasicPitch Worker] Model URL check status:', modelCheck.status);
        if (!modelCheck.ok) {
            throw new Error(`Model URL not accessible: ${modelCheck.status}`);
        }
    } catch (fetchErr: any) {
        console.error('[BasicPitch Worker] Model URL fetch error:', fetchErr);
        self.postMessage({ type: 'ERROR', payload: 'Failed to access model URL: ' + fetchErr.message });
        isInitializing = false;
        return;
    }
    
    try {
        self.postMessage({ type: 'STATUS', payload: 'Initializing pitch model...' });
        console.log('[BasicPitch Worker] Creating BasicPitch instance...');
        basicPitch = new BasicPitch(MODEL_URL);
        console.log('[BasicPitch Worker] BasicPitch instance created, type:', typeof basicPitch);
        console.log('[BasicPitch Worker] BasicPitch methods:', Object.keys(basicPitch || {}));
        
        // Try a warm-up evaluation with silence to verify TF.js is working
        console.log('[BasicPitch Worker] Running warm-up evaluation...');
        const warmupAudio = new Float32Array(22050); // 1 second of silence
        const warmupFrames: number[][] = [];
        const warmupOnsets: number[][] = [];
        const warmupContours: number[][] = [];
        
        await basicPitch.evaluateModel(
            warmupAudio,
            (f: number[][], o: number[][], c: number[][]) => {
                warmupFrames.push(...f);
                warmupOnsets.push(...o);
                warmupContours.push(...c);
            },
            (percent: number) => {
                console.log('[BasicPitch Worker] Warmup progress:', percent);
            }
        );
        console.log('[BasicPitch Worker] Warm-up complete, frames:', warmupFrames.length);
        
        self.postMessage({ type: 'STATUS', payload: 'Pitch model ready.' });
    } catch (err: any) {
        console.error("[BasicPitch Worker] BasicPitch init error:", err);
        console.error("[BasicPitch Worker] Error stack:", err.stack);
        self.postMessage({ type: 'ERROR', payload: 'Failed to load MIDI model: ' + err.message });
        basicPitch = null;
    } finally {
        isInitializing = false;
    }
}

self.onmessage = async (e: MessageEvent) => {
    try {
        const { type, payload } = e.data;
        console.log('[BasicPitch Worker] Received message:', type);

        if (type === 'INIT') {
        console.log('[BasicPitch Worker] INIT command received');
        await initModel();
    } else if (type === 'PROCESS_AUDIO') {
        console.log('[BasicPitch Worker] PROCESS_AUDIO command received, payload length:', payload?.length);
        
        // Add a timeout to detect hanging
        const TIMEOUT_MS = 120000; // 2 minutes max
        const timeoutId = setTimeout(() => {
            console.error('[BasicPitch Worker] TIMEOUT: Processing took longer than', TIMEOUT_MS, 'ms');
            self.postMessage({ type: 'ERROR', payload: 'Processing timeout - audio may be too long or model failed to process' });
        }, TIMEOUT_MS);
        
        try {
            await initModel();

            if (!basicPitch) {
                console.error('[BasicPitch Worker] Model not initialized after initModel()');
                clearTimeout(timeoutId);
                throw new Error("Model not initialized");
            }

            self.postMessage({ type: 'STATUS', payload: 'Analyzing audio...' });
            console.log('[BasicPitch Worker] Starting evaluateModel...');
            console.log('[BasicPitch Worker] Audio sample count:', payload.length);
            console.log('[BasicPitch Worker] Audio duration (seconds):', payload.length / 22050);

            // payload in PROCESS_AUDIO is expected to be a Float32Array containing mono, 22050Hz
            const frames: number[][] = [];
            const onsets: number[][] = [];
            const contours: number[][] = [];
            
            let lastProgress = -1;
            let progressStuckCount = 0;

            console.log('[BasicPitch Worker] About to call evaluateModel...');
            
            // Wrap evaluateModel in a separate promise with more granular error handling
            const evaluatePromise = basicPitch.evaluateModel(
                payload,
                (f: number[][], o: number[][], c: number[][]) => {
                    frames.push(...f);
                    onsets.push(...o);
                    contours.push(...c);
                },
                (percent: number) => {
                    // Detect stuck progress
                    if (percent === lastProgress) {
                        progressStuckCount++;
                        if (progressStuckCount % 100 === 0) {
                            console.warn(`[BasicPitch Worker] Progress stuck at ${percent} for ${progressStuckCount} updates`);
                        }
                    } else {
                        progressStuckCount = 0;
                        lastProgress = percent;
                    }
                    
                    console.log('[BasicPitch Worker] Progress:', percent);
                    self.postMessage({ type: 'PROGRESS', payload: percent });
                }
            );
            
            console.log('[BasicPitch Worker] evaluateModel promise created, awaiting...');
            await evaluatePromise;
            console.log('[BasicPitch Worker] evaluateModel promise resolved');

            clearTimeout(timeoutId);
            console.log('[BasicPitch Worker] evaluateModel complete, frames:', frames.length, 'onsets:', onsets.length, 'contours:', contours.length);

            if (frames.length === 0 || onsets.length === 0) {
                console.warn('[BasicPitch Worker] No frames or onsets detected - returning empty note list');
                self.postMessage({ type: 'RESULT', payload: [] });
                return;
            }

            // Convert raw frames to note events using Spotify's utility functions
            console.log('[BasicPitch Worker] Converting to note events...');
            // @ts-ignore - Spotify types mismatch with their own utility signature occasionally
            const baseEvents = noteFramesToTime(frames, onsets);
            console.log('[BasicPitch Worker] Base events:', baseEvents.length);
            // @ts-ignore
            const withBends = addPitchBendsToNoteEvents(contours, baseEvents);
            console.log('[BasicPitch Worker] With bends:', withBends.length);
            // @ts-ignore
            const noteEvents = noteFramesToTime(withBends);
            console.log('[BasicPitch Worker] Final note events:', noteEvents.length);

            self.postMessage({ type: 'RESULT', payload: noteEvents });
            console.log('[BasicPitch Worker] RESULT sent');

        } catch (error: any) {
            clearTimeout(timeoutId);
            console.error("[BasicPitch Worker] Processing error:", error);
            console.error("[BasicPitch Worker] Error stack:", error.stack);
            self.postMessage({ type: 'ERROR', payload: error.message || "Unknown processing error" });
        }
        } else {
            console.log('[BasicPitch Worker] Unknown message type:', type);
        }
    } catch (globalErr: any) {
        console.error('[BasicPitch Worker] UNCAUGHT ERROR in onmessage:', globalErr);
        console.error('[BasicPitch Worker] Error stack:', globalErr.stack);
        self.postMessage({ type: 'ERROR', payload: 'Worker crashed: ' + (globalErr.message || 'Unknown error') });
    }
};
