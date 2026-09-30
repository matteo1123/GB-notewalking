# Session Recording + Share

Code: `src/components/recording/`. It's mounted in the practice sidebar (`NotewalkingExercise.tsx`), which passes it the mic stream from `usePitchDetection`, the stage element ref and the key/focused node. It doesn't modify the practice engine, pitch detection or chord playback.

| File | Role |
| --- | --- |
| `RecordingEngine.ts` | Streams, 30fps canvas compositor, audio mix, MediaRecorder, full cleanup |
| `appAudioTap.ts` | Captures chord/metronome/drum output (see below) |
| `useSessionRecording.ts` | State machine, countdown, timer, leave-page guards |
| `SessionRecorder.tsx` | Record/Stop control, setup dialog, 3-2-1 overlay |
| `RecordingPreviewDialog.tsx` | Preview, Share, Download, upload links, Discard |
| `recordingUtils.ts` | MIME choice, filename, capability checks, share URLs |

## How it works

- **Screen:** `getDisplayMedia({ preferCurrentTab: true })`. The practice view is DOM/SVG, not a canvas, so tab capture is the only option. On Chromium, Region Capture (`cropTo`) crops the video to the practice stage, so the app header isn't in it.
- **App audio:** every player connects per-chord/per-beat nodes straight to `ctx.destination`, and no Web Audio API can read a destination. While recording, `AudioNode.prototype.connect` is wrapped so any connection to a destination is also mirrored into a `MediaStreamDestination`. Playback itself is untouched, and the wrapper is removed on stop. This works in every browser and doesn't depend on the "share tab audio" checkbox.
- **Mic:** reuses pitch detection's stream through a separate mixing `AudioContext`. It's never stopped here. If the user turns the mic off and on during a recording, the new stream is picked up.
- **Performance:** if drawing frames gets slow, the compositor steps down from 30 to 24, 20, then 15fps. Resolution stays at 1080p.
- **Filename:** `guitarbrain_key-E_shape-C-top_2026-09-29.mp4`. The app has no day counter, so `day-NNN` is omitted. `shape` is included only in Focus mode. `#` becomes `sharp` (e.g. `key-Fsharp`).
- **Facebook group button:** set `VITE_FACEBOOK_GROUP_URL`. The button is hidden when it's unset.

## Browser limitations

- **Mobile (iOS Safari, Android Chrome):** no `getDisplayMedia`, so the screen can't be recorded. The feature falls back to a camera-only recording with guitar and app audio. Because the screen goes landscape on phones, recording is realistically a desktop feature. The share sheet is most useful on phones for files moved there later.
- **Safari (macOS):** MediaRecorder writes MP4 (H.264/AAC) only. `preferCurrentTab` is ignored, so users pick a window. There's no Region Capture, so the full window is recorded. Web Share with files works on macOS 13 and later.
- **Firefox:** MediaRecorder can't write MP4, so it falls back to WebM (VP8/VP9 + Opus). YouTube and Drive accept it; Facebook usually does but is less reliable. `preferCurrentTab` is ignored and there's no Region Capture. `navigator.share` isn't available on desktop, so only Download and the upload links show.
- **Chrome/Edge 126 and later:** MP4 (H.264 + AAC) output, tab pre-selected, cropped to the stage. Older versions fall back to WebM. Edge/Chrome on Windows show the Share button because they have a native share sheet.
- **WebM duration:** WebM from MediaRecorder has no duration in its header, so the preview works around it by seeking to find the length. Uploaded files are fine because platforms re-encode.
- **Long sessions:** 1-second chunks keep the encoder from holding one giant buffer, but the finished video is still a Blob in the browser (about 60MB per minute at 1080p/8Mbps). Chromium pages large Blobs to disk; Safari holds more in RAM. For multi-hour sessions, streaming chunks to OPFS/IndexedDB would be the next step.
- **What's in the video:** the recording indicator in the sidebar is part of the captured page, so it appears in the video. The 3-2-1 countdown and the dialogs don't.
- **Leaving the page:** closing or reloading the tab shows the browser's native warning. In-app links show a confirm while recording, but the browser Back button can't be intercepted (BrowserRouter has no blocker). In that case the recording is cleaned up (camera light off) and discarded.
- **Verified:** headless Chromium with fake devices produced a 1920×1080 and a 1080×1920 H.264/AAC MP4 with mixed mic and app audio, restored `connect`, and left the mic live. Not tested by hand yet in Safari, Firefox or on a phone.
