// Placeholder stock photos for profiles until real uploads exist.
// Everything here is deterministic from the profile id, so a given person
// always shows the same photos across the app.

const PORTRAIT_COUNT = 100; // randomuser.me has portraits 0–99 per gender

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// A stable stock portrait (a real face) for a given profile id.
export function portraitFor(id: string): string {
  const h = hashString(id);
  const gender = h % 2 === 0 ? "men" : "women";
  const idx = h % PORTRAIT_COUNT;
  return `https://randomuser.me/api/portraits/${gender}/${idx}.jpg`;
}

type PhotoSource = {
  id: string;
  avatar_url: string | null;
  photos?: string[] | null;
};

// The single photo shown on cards and as the profile hero. Prefer real
// uploads (first gallery photo, then legacy avatar), else a stock portrait.
export function mainPhoto(p: PhotoSource): string {
  return p.photos?.[0] || p.avatar_url || portraitFor(p.id);
}

// Photos for the full-profile gallery. Use their real uploads if they have
// any; otherwise fall back to a stock face + a couple of lifestyle shots.
export function galleryPhotos(p: PhotoSource): string[] {
  if (p.photos && p.photos.length > 0) return p.photos;
  const seed = encodeURIComponent(p.id);
  return [
    mainPhoto(p),
    `https://picsum.photos/seed/${seed}-room/800/1000`,
    `https://picsum.photos/seed/${seed}-city/800/1000`,
  ];
}
