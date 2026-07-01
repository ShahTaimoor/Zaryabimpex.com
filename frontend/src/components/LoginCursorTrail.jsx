import { useEffect, useRef, useState } from 'react';

const LERP = 0.11;
const TRAIL_LENGTH = 14;
const MIN_SEGMENT = 2.5;
const TRAIL_FADE_MS = 320;
const ACTIVE_MS = 100;
const IDLE_HIDE_MS = 3000;
const STROKE_WIDTH = 1.75;
const DOT_RADIUS = 2.75;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const buildSmoothPath = (points) => {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    path += ` Q ${current.x.toFixed(1)} ${current.y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }

  const last = points[points.length - 1];
  path += ` T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return path;
};

export const LoginCursorTrail = () => {
  const [frame, setFrame] = useState(0);
  const [active, setActive] = useState(false);

  const targetRef = useRef({ x: -100, y: -100 });
  const smoothRef = useRef({ x: -100, y: -100 });
  const trailRef = useRef([]);
  const lastMoveRef = useRef(0);
  const visibleRef = useRef(false);
  const activeMoveRef = useRef(false);
  const rafRef = useRef(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    if (prefersReduced || coarsePointer) return undefined;

    setActive(true);

    const handleMove = (event) => {
      targetRef.current = { x: event.clientX, y: event.clientY };
      lastMoveRef.current = Date.now();
    };

    const handleLeave = () => {
      targetRef.current = { x: -100, y: -100 };
      trailRef.current = [];
      smoothRef.current = { x: -100, y: -100 };
      visibleRef.current = false;
      activeMoveRef.current = false;
    };

    const animate = () => {
      const now = Date.now();
      const target = targetRef.current;
      const smooth = smoothRef.current;
      const idleFor = now - lastMoveRef.current;
      const isActivelyMoving = idleFor < ACTIVE_MS;
      const isVisible = idleFor < IDLE_HIDE_MS;
      const wasVisible = visibleRef.current;
      visibleRef.current = isVisible;
      activeMoveRef.current = isActivelyMoving;

      if (isActivelyMoving && target.x >= 0) {
        smooth.x += (target.x - smooth.x) * LERP;
        smooth.y += (target.y - smooth.y) * LERP;

        const trail = trailRef.current;
        const last = trail[trail.length - 1];
        if (!last || distance(smooth, last) >= MIN_SEGMENT) {
          trail.push({ x: smooth.x, y: smooth.y, t: now });
          if (trail.length > TRAIL_LENGTH) {
            trail.shift();
          }
        }
      } else {
        trailRef.current = trailRef.current.filter((point) => now - point.t < TRAIL_FADE_MS);
        if (!isVisible) {
          trailRef.current = [];
          smoothRef.current = { x: -100, y: -100 };
        }
      }

      if (isActivelyMoving) {
        trailRef.current = trailRef.current.filter((point) => now - point.t < TRAIL_FADE_MS);
      }

      if (isVisible || wasVisible !== isVisible || trailRef.current.length > 0) {
        setFrame((value) => value + 1);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    window.addEventListener('mousemove', handleMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', handleLeave);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      document.documentElement.removeEventListener('mouseleave', handleLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!active || !visibleRef.current) {
    return null;
  }

  const smooth = smoothRef.current;
  const trail = trailRef.current;
  const path = buildSmoothPath(trail);
  const showDot = activeMoveRef.current;

  if (smooth.x < 0 && trail.length === 0) {
    return null;
  }

  void frame;

  return (
    <div
      className="fixed inset-0 z-[60] pointer-events-none mix-blend-difference"
      aria-hidden
    >
      <svg className="h-full w-full overflow-visible">
        {path && (
          <path
            d={path}
            fill="none"
            stroke="white"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.92"
          />
        )}
        {showDot && smooth.x >= 0 && (
          <circle
            cx={smooth.x}
            cy={smooth.y}
            r={DOT_RADIUS}
            fill="white"
            opacity="0.95"
          />
        )}
      </svg>
    </div>
  );
};
