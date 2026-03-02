/**
 * Processes an audio Blob (likely from MediaRecorder) and extracts a resampled,
 * mono Float32Array ready for the Basic Pitch model.
 */
export async function extractMonoFloat32Array(blob: Blob, targetSampleRate = 22050): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();

    // Create an AudioContext to decode whatever format the browser recorded
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Resample if necessary, down to Mono (1 channel)
    const offlineCtx = new OfflineAudioContext(
        1,
        Math.ceil(decodedBuffer.duration * targetSampleRate),
        targetSampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const resampledBuffer = await offlineCtx.startRendering();

    // We can finally grab the raw Float32 data
    return resampledBuffer.getChannelData(0);
}

/**
 * Executes the MIDI conversion in our background Web Worker
 */
export async function convertAudioToMidiInWorker(float32Array: Float32Array): Promise<any[]> {
    return new Promise((resolve, reject) => {
        // Instantiate the worker using Vite's syntax
        const worker = new Worker(new URL('../workers/basicPitch.worker.ts', import.meta.url), { type: 'module' });

        worker.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'RESULT') {
                resolve(payload);
                worker.terminate();
            } else if (type === 'ERROR') {
                reject(new Error(payload));
                worker.terminate();
            } else if (type === 'STATUS' || type === 'PROGRESS') {
                // We can optionally hook this up to a UI status bar later
                console.log(`Basic Pitch: [${type}]`, payload);
            }
        };

        worker.onerror = (err) => {
            reject(err);
            worker.terminate();
        };

        // Fire off the processing command with our float array
        worker.postMessage({ type: 'PROCESS_AUDIO', payload: float32Array });
    });
}
