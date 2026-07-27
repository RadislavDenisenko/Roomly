"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DemoButton } from "@/components/DemoButton";

gsap.registerPlugin(ScrollTrigger);

export type StoryScene = {
  src: string;
  alt: string;
  headline: string;
  sub: string;
};

// Fraction of each scene's scroll span spent HOLDING on the still (text
// readable) before the transition video starts scrubbing. The rest of the
// span belongs to the video, so a lower value = longer-feeling animation.
const HOLD = 0.25;

// The next scene's still may only fade in during this last slice of the
// transition (the video is visually settled by then). Any earlier and the
// finished room ghosts over the demolition footage.
const HANDOFF = 0.96;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

// The server has no media queries, so it renders the motion version and the
// client corrects on hydration. Reading the query live also means a preference
// toggled mid-session swaps the layout without a reload.
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * Full-bleed scrollytelling. The imagery IS the page: every scene fills the
 * viewport, the copy lives inside the scene, and scrolling scrubs the
 * transition videos where the room deconstructs (floorboards fly off, walls
 * peel away) and the next apartment assembles around the person on the couch.
 * Stills crossfade as fallback wherever a video is missing or not loaded.
 * One scrubbed ScrollTrigger, no scroll listeners, reduced-motion fallback.
 */
export function ScrollStory({
  scenes,
  transitions,
}: {
  scenes: StoryScene[];
  transitions: string[]; // transitions[i] morphs scene i -> i+1
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRefs = useRef<(HTMLDivElement | null)[]>([]);
  const vidRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const host = wrapRef.current;
    if (!host) return;
    const n = scenes.length;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: host,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.35,
        onUpdate(self) {
          const p = self.progress * (n - 1);
          const seg = Math.min(Math.floor(p), n - 2); // active pair index
          const local = p - seg; // 0..1 within the pair

          // Transition videos: active only after the hold phase of their pair
          const segVideo = vidRefs.current[seg];
          const videoLive = !!segVideo && segVideo.readyState >= 2;
          vidRefs.current.forEach((v, i) => {
            if (!v) return;
            const active =
              i === seg && local > HOLD && local < 1 && videoLive;
            v.style.opacity = active ? "1" : "0";
            if (active) {
              const t = ((local - HOLD) / (1 - HOLD)) * (v.duration || 8);
              // fastSeek when available; precise seek otherwise
              if (Math.abs(v.currentTime - t) > 0.04) {
                try {
                  v.currentTime = t;
                } catch {}
              }
            }
          });

          // Stills. With a live video, the current scene's still sits under
          // the footage and the NEXT still only fades in during the handoff
          // slice at the very end (otherwise the finished room would ghost
          // over the demolition). Without a video, plain crossfade fallback.
          imgRefs.current.forEach((el, i) => {
            if (!el) return;
            let vis;
            if (videoLive) {
              if (i === seg) vis = 1;
              else if (i === seg + 1)
                vis = local >= HANDOFF ? (local - HANDOFF) / (1 - HANDOFF) : 0;
              else vis = 0;
            } else {
              vis = Math.max(0, 1 - Math.abs(p - i));
            }
            el.style.opacity = String(vis);
          });

          // Copy beats fly in with their room and out as it deconstructs
          beatRefs.current.forEach((el, i) => {
            if (!el) return;
            const d = p - i;
            const vis = Math.max(0, 1 - Math.abs(d) * 2.2);
            el.style.opacity = String(vis);
            el.style.transform = `translateY(${d * -46}px)`;
            el.style.pointerEvents = vis > 0.5 ? "auto" : "none";
          });
        },
      });
    }, host);

    return () => ctx.revert();
  }, [scenes.length, reduced]);

  if (reduced) {
    return (
      <>
        <section className="relative flex min-h-[100dvh] items-end sm:items-center">
          <Image
            src={scenes[0].src}
            alt={scenes[0].alt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <Scrim />
          <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-20 sm:pb-0">
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

  return (
    // Tall track: each scene owns ~1.85 viewports of scroll distance, most
    // of it spent inside the transition footage.
    <div ref={wrapRef} className="relative" style={{ height: `${scenes.length * 185}vh` }}>
      <div className="sticky top-0 h-[100dvh] w-full overflow-hidden bg-stone-950">
        {/* Still stack (base layer + fallback) */}
        {scenes.map((s, i) => (
          <div
            key={s.src}
            ref={(el) => {
              imgRefs.current[i] = el;
            }}
            className="absolute inset-0"
            style={{ opacity: i === 0 ? 1 : 0 }}
          >
            <Image
              src={s.src}
              alt={s.alt}
              fill
              priority={i <= 1}
              sizes="100vw"
              className="object-cover"
            />
          </div>
        ))}

        {/* Scroll-scrubbed transition videos */}
        {transitions.map((src, i) => (
          <video
            key={src}
            ref={(el) => {
              vidRefs.current[i] = el;
            }}
            src={src}
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-150"
            style={{ opacity: 0 }}
            aria-hidden
          />
        ))}
        <Scrim />

        {/* Copy beats, living inside the scene */}
        <div className="absolute inset-0 z-10 flex items-end sm:items-center">
          <div className="mx-auto w-full max-w-6xl px-6 pb-24 sm:pb-0">
            <div className="relative min-h-[18rem]">
              {scenes.map((s, i) => (
                <div
                  key={s.headline}
                  ref={(el) => {
                    beatRefs.current[i] = el;
                  }}
                  className="absolute inset-x-0 bottom-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-stone-950/70 via-stone-950/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-stone-950/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-stone-950/70 to-transparent sm:h-24" />
    </>
  );
}

function Beat({ scene, first }: { scene: StoryScene; first: boolean }) {
  return (
    <div className="max-w-xl">
      <h2 className="text-4xl font-bold leading-[1.04] tracking-tight text-white sm:text-6xl">
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
