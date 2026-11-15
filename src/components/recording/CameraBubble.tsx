// The player's face while recording: a small round bubble they drag wherever it covers the
// least of the app (remembered, separately for holding the phone upright or sideways).
// A tap makes it big in the middle (talk mode: explaining to the camera); another tap puts
// it back. In the Android app the phone records the screen, bubble and all (the web
// recorder still draws its own picture-in-picture instead).
import React, { useEffect, useRef, useState } from 'react';

const SIZE = 'clamp(84px, 22vmin, 140px)';
const key = () => `gb.camBubble.${window.innerWidth > window.innerHeight ? 'wide' : 'tall'}`;

type Spot = { x: number; y: number }; // the bubble's centre, as a fraction of the screen

function savedSpot(): Spot {
  try {
    const s = JSON.parse(localStorage.getItem(key()) || 'null') as Spot | null;
    if (s && s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1) return s;
  } catch { /* the default */ }
  return { x: 0.12, y: 0.8 };
}

export const CameraBubble: React.FC<{ stream: MediaStream; talk: boolean; onTap: () => void }> = ({ stream, talk, onTap }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [spot, setSpot] = useState<Spot>(savedSpot);
  const drag = useRef<{ id: number; sx: number; sy: number; moved: boolean; start: Spot } | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.srcObject = stream;
    void v.play().catch(() => {});
  }, [stream]);

  // turning the phone: that shape's own spot
  useEffect(() => {
    const onTurn = () => setSpot(savedSpot());
    window.addEventListener('resize', onTurn);
    return () => window.removeEventListener('resize', onTurn);
  }, []);

  /** keep the whole bubble on screen */
  const clamp = (s: Spot): Spot => {
    const el = boxRef.current;
    const hw = el ? el.offsetWidth / 2 / window.innerWidth : 0.06;
    const hh = el ? el.offsetHeight / 2 / window.innerHeight : 0.06;
    return { x: Math.min(1 - hw, Math.max(hw, s.x)), y: Math.min(1 - hh, Math.max(hh, s.y)) };
  };

  const onDown = (e: React.PointerEvent) => {
    if (talk) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, start: spot };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 8) return;   // still a tap
    d.moved = true;
    setSpot(clamp({ x: d.start.x + dx / window.innerWidth, y: d.start.y + dy / window.innerHeight }));
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (talk) { onTap(); return; }
    if (!d || d.id !== e.pointerId) return;
    if (d.moved) {
      try { localStorage.setItem(key(), JSON.stringify(spot)); } catch { /* not remembered */ }
    } else onTap();
  };

  const style: React.CSSProperties = talk
    ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(72vw, 72vh, 560px)', aspectRatio: '3 / 4', borderRadius: 18 }
    : { left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, transform: 'translate(-50%, -50%)', width: SIZE, aspectRatio: '1', borderRadius: '50%' };

  return (
    <div
      ref={boxRef}
      data-gb-bubble={talk ? 'talk' : 'round'}
      data-gb-nocopy=""
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => { drag.current = null; }}
      title={talk ? 'Tap to shrink back' : 'Drag to move · tap to talk to the camera'}
      style={{
        position: 'fixed',
        zIndex: 900,
        overflow: 'hidden',
        border: '2px solid rgba(255, 255, 255, 0.55)',
        boxShadow: '0 8px 22px rgba(0, 0, 0, 0.5)',
        background: '#070913',
        touchAction: 'none',
        cursor: talk ? 'pointer' : 'grab',
        ...style,
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', pointerEvents: 'none' }}
      />
    </div>
  );
};
