"use client";

import { useEffect, useState } from "react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { galleryPhotos } from "@/lib/photos";
import type { VerificationStatus } from "@/lib/verification";
import { isVerified } from "@/lib/verification";
import {
  weekendLabel,
  noiseLabel,
  foodLabel,
  dishesLabel,
  choresLabel,
  overnightLabel,
} from "@/lib/compat";

export type ProfileFull = {
  id: string;
  full_name: string | null;
  age: number | null;
  city: string | null;
  bio: string | null;
  avatar_url: string | null;
  photos?: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  cleanliness: number | null;
  sleep_schedule: string | null;
  smoking: boolean | null;
  pets: boolean | null;
  guests: string | null;
  weekend_style?: string | null;
  home_noise?: string | null;
  food_sharing?: string | null;
  dishes?: string | null;
  chores?: string | null;
  overnight_guests?: string | null;
  move_in_date?: string | null;
  email_verified: boolean | null;
  verification_status?: VerificationStatus | null;
};

export type Reason = { good: boolean; text: string };

const sleepLabel: Record<string, string> = {
  early_bird: "🌅 Early bird",
  night_owl: "🌙 Night owl",
  flexible: "🕒 Flexible hours",
};
const cleanLabel = ["", "Relaxed", "Easygoing", "Tidy", "Very tidy", "Spotless"];
const guestsLabel: Record<string, string> = {
  rarely: "Rarely has guests",
  sometimes: "Sometimes has guests",
  often: "Often has guests",
};

function scoreColor(s: number) {
  if (s >= 70) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (s >= 45) return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

function formatMoveIn(date?: string | null) {
  if (!date) return "Flexible";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Flexible";
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function ProfileDetail({
  profile,
  score,
  why,
  footer,
  onClose,
}: {
  profile: ProfileFull;
  score?: number;
  why?: Reason[];
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  const photos = galleryPhotos(profile);
  const [idx, setIdx] = useState(0);

  // Lock background scroll and allow Escape to close while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const budget =
    profile.budget_min || profile.budget_max
      ? `$${profile.budget_min ?? "?"}–${profile.budget_max ?? "?"}/mo`
      : "—";

  return (
    <div
      className="roomly-fade-in fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.full_name ?? "Roommate"}'s profile`}
    >
      <div
        className="roomly-sheet-in relative flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl dark:bg-zinc-900 sm:max-h-[calc(100vh-3rem)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---- Photo gallery ---- */}
        <div className="relative aspect-[4/5] w-full shrink-0 select-none bg-zinc-200 dark:bg-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[idx]}
            alt={profile.full_name ?? "Profile photo"}
            className="h-full w-full object-cover"
          />

          {/* tap zones: left third = previous, right two-thirds = next */}
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)}
            className="absolute inset-y-0 left-0 w-1/3 cursor-pointer focus:outline-none"
          />
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => setIdx((i) => (i + 1) % photos.length)}
            className="absolute inset-y-0 right-0 w-2/3 cursor-pointer focus:outline-none"
          />

          {/* segmented progress bars */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex gap-1.5 p-2.5">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i === idx ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>

          {/* close */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="absolute right-3 top-6 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-lg text-white backdrop-blur transition-transform hover:scale-105 active:scale-90"
          >
            ✕
          </button>

          {/* identity scrim */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-5 pt-16 text-white">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-2xl font-bold">
                {profile.full_name}
                {profile.age ? `, ${profile.age}` : ""}
              </h2>
              {isVerified(profile) && <VerifiedBadge />}
            </div>
            {profile.city && (
              <p className="mt-0.5 text-sm text-white/80">📍 {profile.city}</p>
            )}
          </div>
        </div>

        {/* ---- Details ---- */}
        <div className="space-y-5 p-5">
          {typeof score === "number" && (
            <section>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Compatibility
                </h3>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${scoreColor(score)}`}>
                  {score}% match
                </span>
              </div>
              {why && why.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {why.map((r, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                        r.good
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      }`}
                    >
                      {r.good ? "✓" : "⚠"} {r.text}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {profile.bio && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                About
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {profile.bio}
              </p>
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Looking for
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-3">
              <DetailItem label="Budget" value={budget} />
              <DetailItem label="Move-in" value={formatMoveIn(profile.move_in_date)} />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Lifestyle
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.cleanliness ? <Chip>🧹 {cleanLabel[profile.cleanliness]}</Chip> : null}
              {profile.sleep_schedule ? <Chip>{sleepLabel[profile.sleep_schedule]}</Chip> : null}
              {profile.dishes ? <Chip>🍽️ {dishesLabel[profile.dishes]}</Chip> : null}
              {profile.food_sharing ? <Chip>🧺 {foodLabel[profile.food_sharing]}</Chip> : null}
              {profile.chores ? <Chip>🧻 {choresLabel[profile.chores]}</Chip> : null}
              {profile.overnight_guests ? <Chip>🛏️ {overnightLabel[profile.overnight_guests]}</Chip> : null}
              {profile.weekend_style ? <Chip>🎉 {weekendLabel[profile.weekend_style]}</Chip> : null}
              {profile.home_noise ? <Chip>🎧 {noiseLabel[profile.home_noise]}</Chip> : null}
              {profile.guests ? <Chip>{guestsLabel[profile.guests]}</Chip> : null}
              <Chip>{profile.smoking ? "🚬 Smoker" : "🚭 Non-smoker"}</Chip>
              <Chip>{profile.pets ? "🐾 Has pets" : "🚫 No pets"}</Chip>
            </div>
          </section>
        </div>

        {footer && (
          <div className="sticky bottom-0 border-t border-zinc-200 bg-white/90 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{value}</dd>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </span>
  );
}
