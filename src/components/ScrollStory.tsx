"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { DemoButton } from "@/components/DemoButton";

export type StoryScene = {
  headline: string;
  sub: string;
};

/**
 * One flat sequence carrying each room into the next, two runs deep. The rate
 * is deliberately low: this is a short animation, not a video, and stop-motion
 * reads better chunky than smooth. Phones get fewer frames at a smaller size.
 */
const SETS = {
  full: { count: 48, dir: "frames" },
  small: { count: 32, dir: "frames-sm" },
} as const;

const framePath = (dir: string, i: number) =>
  `/story/${dir}/f${String(i + 1).padStart(3, "0")}.webp`;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Full-bleed scroll story played as a frame sequence.
 *
 * Scroll position maps to a frame index and that frame is painted to a canvas.
 * Video was the wrong tool twice over: scrubbing it made the browser seek
 * faster than it could decode, and letting it play took control away from the
 * scroll. Discrete frames do neither — the image on screen is always exactly
 * the one the scroll position asks for, and the low frame rate is the point,
 * since the art is stop-motion.
 *
 * The canvas is drawn with a cover fit computed by hand, so the framing can be
 * tuned per device: full-screen desktop shows the whole 16:9 plate, and a
 * portrait phone crops toward the right side of the frame where the sofa and
 * the doorway the story needs actually are.
 */
export function ScrollStory({ scenes }: { scenes: StoryScene[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const drawnRef = useRef(-1);
  const reduced = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);
  const setRef = useRef<{ count: number; dir: string }>(SETS.full);

  // Decode frames up front. The first handful gate the reveal; the rest stream
  // in behind it so scrolling early never lands on a blank canvas.
  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    const imgs: HTMLImageElement[] = [];
    let leadLoaded = 0;
    const LEAD = 10;

    // Chosen once, at mount: swapping sets on a resize would throw away every
    // frame already decoded to serve a window drag.
    const set = window.innerWidth < 820 ? SETS.small : SETS.full;
    setRef.current = set;

    for (let i = 0; i < set.count; i++) {
      const img = new Image();
      img.decoding = "async";
      img.src = framePath(set.dir, i);
      if (i < LEAD) {
        img.onload = () => {
          leadLoaded += 1;
          if (!cancelled && leadLoaded >= LEAD) setReady(true);
        };
        img.onerror = () => {
          leadLoaded += 1;
          if (!cancelled && leadLoaded >= LEAD) setReady(true);
        };
      }
      imgs[i] = img;
    }
    imagesRef.current = imgs;
    return () => {
      cancelled = true;
    };
  }, [reduced]);

  useEffect(() => {
    if (reduced || !ready) return;
    const host = wrapRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let frame = 0;

    const decoded = (i: number) => {
      const img = imagesRef.current[i];
      return img && img.complete && img.naturalWidth > 0 ? img : null;
    };

    // The wanted frame may not have decoded yet on a slow connection. Falling
    // back to the nearest one that has beats leaving the canvas blank — the
    // sequence simply holds on a neighbouring frame until the real one lands.
    const nearestDecoded = (index: number) => {
      const direct = decoded(index);
      if (direct) return { img: direct, at: index };
      const total = setRef.current.count;
      for (let step = 1; step < total; step++) {
        const back = decoded(index - step);
        if (back) return { img: back, at: index - step };
        const fwd = decoded(index + step);
        if (fwd) return { img: fwd, at: index + step };
      }
      return null;
    };

    const paint = (index: number, force = false) => {
      if (index === drawnRef.current && !force) return;
      const hit = nearestDecoded(index);
      if (!hit) return;
      const img = hit.img;
      // Record the frame actually drawn, so a later repaint still corrects it.
      drawnRef.current = hit.at === index ? index : -1;

      const cw = canvas.width;
      const ch = canvas.height;
      const portrait = cw / ch < 0.9;

      ctx.fillStyle = "#0c0a09";
      ctx.fillRect(0, 0, cw, ch);

      if (portrait) {
        // A 16:9 plate cannot fill a phone without cropping away most of the
        // room, and the room changing is the whole story. So on portrait the
        // frame runs full width in a band across the top two thirds and the
        // copy gets the space underneath it, uncontested.
        const w = cw;
        const h = w / (img.naturalWidth / img.naturalHeight);
        ctx.drawImage(img, 0, ch * 0.3 - h / 2, w, h);
      } else {
        const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      paint(Math.max(drawnRef.current, 0), true);
    };

    const apply = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const span = host.offsetHeight - vh;
      const progress = span > 0 ? clamp(-host.getBoundingClientRect().top / span, 0, 1) : 0;

      paint(Math.round(progress * (setRef.current.count - 1)));

      // Exactly one beat is on screen at any moment, everywhere. Whichever room
      // is nearest owns the copy and keeps it until the next one takes over, so
      // the reader is never left staring at a headline-less frame mid-rebuild.
      // Only the handover itself is animated: the outgoing line lifts away as
      // the incoming one rises into place.
      const beatPos = progress * (scenes.length - 1);
      const nearest = Math.round(beatPos);
      const drift = beatPos - nearest; // -0.5..0.5 through the handover
      for (let i = 0; i < scenes.length; i++) {
        const beat = beatRefs.current[i];
        if (!beat) continue;
        const on = i === nearest;
        beat.style.opacity = on ? "1" : "0";
        beat.style.transform = on ? `translateY(${(drift * -1.2).toFixed(3)}rem)` : "";
        beat.style.visibility = on ? "visible" : "hidden";
        beat.style.pointerEvents = on ? "auto" : "none";
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    // A hidden tab does not run animation frames, so nothing repaints while it
    // is away and the canvas can be left cleared by a resize. Repaint on the
    // way back, and again as late frames finish decoding.
    const refresh = () => {
      drawnRef.current = -1;
      apply();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const decodeTimer = window.setInterval(() => {
      if (imagesRef.current.every((img) => img.complete)) {
        window.clearInterval(decodeTimer);
      }
      refresh();
    }, 400);

    resize();
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearInterval(decodeTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced, ready, scenes.length]);

  if (reduced) {
    return (
      <>
        <section className="relative flex min-h-[100dvh] items-end lg:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={framePath(SETS.full.dir, 0)} alt="A person on a green couch in an attic apartment" className="absolute inset-0 h-full w-full object-cover" />
          <Scrim />
          <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-20 lg:pb-0">
            <Beat scene={scenes[0]} first />
          </div>
        </section>
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="flex flex-col gap-12">
            {scenes.slice(1).map((s) => (
              <div key={s.headline}>
                <h2 className="text-3xl font-bold tracking-tight">{s.headline}</h2>
                <p className="mt-3 max-w-md text-lg leading-8 text-stone-600">{s.sub}</p>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  // Roughly one viewport of scroll per room keeps the whole story inside five
  // screens while still giving each frame run room to read.
  return (
    <div ref={wrapRef} className="relative" style={{ height: `${scenes.length * 100}vh` }}>
      <div className="sticky top-0 h-[100dvh] w-full overflow-hidden bg-stone-950">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
        <span className="sr-only">
          A person sits on a green couch while the apartment around them is rebuilt and a new
          roommate arrives in each room.
        </span>

        <Scrim />

        <div className="absolute inset-0 z-10 flex items-end lg:items-center">
          <div className="mx-auto w-full max-w-6xl px-6 pb-16 lg:pb-0">
            <div className="relative min-h-[20rem] lg:min-h-[18rem]">
              {scenes.map((s, i) => (
                <div
                  key={s.headline}
                  ref={(el) => {
                    beatRefs.current[i] = el;
                  }}
                  className="absolute inset-x-0 bottom-0 transition-opacity duration-300 will-change-[opacity,transform] lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2"
                  style={{ opacity: i === 0 ? 1 : 0 }}
                >
                  <Beat scene={s} first={i === 0} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Readability gradient burned into the scene, not a box around it */
function Scrim() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-stone-950/75 via-stone-950/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-stone-950/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-stone-950/90 via-stone-950/50 to-transparent lg:h-24 lg:from-stone-950/70 lg:via-transparent" />
    </>
  );
}

function Beat({ scene, first }: { scene: StoryScene; first: boolean }) {
  return (
    <div className="max-w-xl lg:max-w-lg">
      <h2 className="text-4xl font-bold leading-[1.04] tracking-tight text-white lg:text-6xl">
        {scene.headline}
      </h2>
      <p className="mt-4 max-w-md text-lg leading-8 text-stone-200">{scene.sub}</p>
      {first && (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <DemoButton className="roomly-btn h-13 px-8 text-base" />
          <Link
            href="/signup"
            className="inline-flex h-13 items-center justify-center rounded-full border-2 border-white/40 px-8 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:border-white/70 hover:bg-white/10"
          >
            Sign up free
          </Link>
        </div>
      )}
    </div>
  );
}
