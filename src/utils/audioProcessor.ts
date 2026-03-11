/**
 * Processes an audio Blob (likely from MediaRecorder) and extracts a resampled,
 * mono Float32Array ready for the Basic Pitch model.
 * 
 * NOTE: Basic Pitch struggles with long audio (>15s), so we limit to max 15 seconds
 * from the middle of the recording for better reliability.
 */
export async function extractMonoFloat32Array(blob: Blob, targetSampleRate = 22050): Promise<Float32Array> {
    console.log('[AudioProcessor] Starting extraction, blob size:', blob.size, 'bytes');
    const arrayBuffer = await blob.arrayBuffer();
    console.log('[AudioProcessor] Array buffer loaded, size:', arrayBuffer.byteLength);

    // Create an AudioContext to decode whatever format the browser recorded
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    console.log('[AudioProcessor] Decoding audio data...');
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    console.log('[AudioProcessor] Audio decoded, duration:', decodedBuffer.duration, 's, channels:', decodedBuffer.numberOfChannels, 'sampleRate:', decodedBuffer.sampleRate);
    
    // Limit to 15 seconds max - Basic Pitch struggles with longer audio
    const MAX_DURATION_SECONDS = 15;
    let startOffset = 0;
    let duration = decodedBuffer.duration;
    
    if (duration > MAX_DURATION_SECONDS) {
        // Take the middle 15 seconds
        startOffset = (duration - MAX_DURATION_SECONDS) / 2;
        duration = MAX_DURATION_SECONDS;
        console.log('[AudioProcessor] Limiting to', MAX_DURATION_SECONDS, 'seconds from offset', startOffset);
    }

    // Resample if necessary, down to Mono (1 channel)
    console.log('[AudioProcessor] Resampling to', targetSampleRate, 'Hz mono...');
    const offlineCtx = new OfflineAudioContext(
        1,
        Math.ceil(duration * targetSampleRate),
        targetSampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start(0, startOffset, duration);

    const resampledBuffer = await offlineCtx.startRendering();
    console.log('[AudioProcessor] Resampling complete, output samples:', resampledBuffer.length);

    // We can finally grab the raw Float32 data
    return resampledBuffer.getChannelData(0);
}

/**
 * Executes the MIDI conversion in our background Web Worker
 */
import BasicPitchWorker from '../workers/basicPitch.worker?worker';

export async function convertAudioToMidiInWorker(float32Array: Float32Array): Promise<any[]> {
    console.log('[AudioProcessor] Starting MIDI conversion in worker, samples:', float32Array.length);
    return new Promise((resolve, reject) => {
        // Instantiate the worker using Vite's syntax
        const worker = new BasicPitchWorker();
        console.log('[AudioProcessor] Worker instantiated');
        
        // Set a timeout for the entire operation
        const timeoutId = setTimeout(() => {
            console.error('[AudioProcessor] Worker timeout - killing worker');
            worker.terminate();
            reject(new Error('MIDI conversion timeout - Basic Pitch model may have failed'));
        }, 60000); // 60 second timeout

        worker.onmessage = (e) => {
            const { type, payload } = e.data;
            console.log('[AudioProcessor] Worker message:', type, payload);
            if (type === 'RESULT') {
                clearTimeout(timeoutId);
                console.log('[AudioProcessor] Worker returned', payload.length, 'notes');
                resolve(payload);
                worker.terminate();
            } else if (type === 'ERROR') {
                clearTimeout(timeoutId);
                console.error('[AudioProcessor] Worker error:', payload);
                reject(new Error(payload));
                worker.terminate();
            } else if (type === 'STATUS' || type === 'PROGRESS') {
                // We can optionally hook this up to a UI status bar later
                console.log(`[AudioProcessor] Basic Pitch: [${type}]`, payload);
            }
        };

        worker.onerror = (err) => {
            clearTimeout(timeoutId);
            console.error('[AudioPitch] Worker onerror:', err);
            console.error('[AudioPitch] Worker error message:', err.message);
            console.error('[AudioPitch] Worker error filename:', err.filename);
            console.error('[AudioPitch] Worker error lineno:', err.lineno);
            reject(err);
            worker.terminate();
        };

        // Fire off the processing command with our float array
        console.log('[AudioProcessor] Sending PROCESS_AUDIO to worker');
        try {
            worker.postMessage({ type: 'PROCESS_AUDIO', payload: float32Array });
        } catch (postErr: any) {
            clearTimeout(timeoutId);
            console.error('[AudioProcessor] Failed to post message to worker:', postErr);
            reject(postErr);
            worker.terminate();
        }
    });
}
