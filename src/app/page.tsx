import Link from "next/link";
import Image from "next/image";
import { ScrollStory, type StoryScene } from "@/components/ScrollStory";
import { BuildingsIcon, UsersThreeIcon, SealCheckIcon } from "@phosphor-icons/react/dist/ssr";

// The five landing scenes. One person, one couch, five apartments: the person
// and couch hold their exact position across the set so the transition videos
// can rebuild the room around them without anything appearing to jump.
const SCENES: StoryScene[] = [
  {
    src: "/story/scene-1.png?v=2",
    alt: "A person seen from behind on a green couch in a tiny brick-walled studio",
    headline: "You. A couch. No place yet.",
    sub: "Roomly starts where you are: looking for a home and the people to share it with.",
  },
  {
    src: "/story/scene-2.png?v=2",
    alt: "Same person and couch in a bright Scandinavian apartment, a roommate waving from the doorway",
    headline: "Swipe real apartments.",
    sub: "Curated listings in your city. Liking one unlocks the verified people who want it too.",
  },
  {
    src: "/story/scene-3.png?v=2",
    alt: "Same person and couch in an industrial loft, roommates playing a board game",
    headline: "Match with verified people.",
    sub: "Everyone is confirmed before they can message you. No fakes, no ghosts.",
  },
  {
    src: "/story/scene-4.png?v=2",
    alt: "Same person and couch in a cozy attic apartment, friends cooking and a golden retriever nearby",
    headline: "Chat, meet, decide together.",
    sub: "Group chats around the place you all liked. Meet up, compare notes, choose.",
  },
  {
    src: "/story/scene-5.png?v=2",
    alt: "Same person and couch on moving-in day, boxes and keys, roommates unpacking",
    headline: "Move in. That's the whole point.",
    sub: "Keys on the table, boxes on the floor, people you actually chose.",
  },
];

export default function Home() {
  return (
    <main className="relative bg-[#faf7f2] flex flex-1 flex-col text-stone-900">
      {/* Nav floats inside the scene, not above it */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <span className="roomly-mark h-9 w-9 text-base">R</span>
            <span className="font-display text-xl font-bold tracking-tight text-white">
              Roomly
            </span>
          </div>
          <nav className="flex items-center gap-2 text-sm font-semibold sm:gap-5">
            <Link
              href="/safety"
              className="hidden text-stone-200 transition-colors hover:text-white sm:block"
            >
              How we verify
            </Link>
            <Link
              href="/login"
              className="text-stone-200 transition-colors hover:text-white"
            >
              Log in
            </Link>
            <Link href="/signup" className="roomly-btn h-10 px-5 text-sm">
              Sign up free
            </Link>
          </nav>
        </div>
      </header>

      {/* Scroll story: the person stays, the rooms deconstruct and rebuild */}
      <ScrollStory
        scenes={SCENES}
        transitions={[
          "/story/transition-1-2.mp4",
          "/story/transition-2-3.mp4",
          "/story/transition-3-4.mp4",
          "/story/transition-4-5.mp4",
        ]}
      />

      {/* Features: asymmetric bento in the new palette */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <h2 className="max-w-lg text-3xl font-bold tracking-tight sm:text-4xl">
          The apartment comes first. The people come with it.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-3xl border border-stone-200 bg-white p-8 md:col-span-2">
            <BuildingsIcon size={32} weight="duotone" className="text-brick-600" aria-hidden />
            <h3 className="mt-4 text-xl font-bold">Real apartments, curated</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-stone-600">
              Real listings in your city. No scraped fakes, no dead links, no bait pricing.
            </p>
          </div>
          <div className="rounded-3xl bg-emerald-700 p-8 text-emerald-50">
            <UsersThreeIcon size={32} weight="duotone" aria-hidden />
            <h3 className="mt-4 text-xl font-bold">See who wants it too</h3>
            <p className="mt-2 text-sm leading-6 text-emerald-100/90">
              Liking a place unlocks the verified people looking there. Match, chat, move in.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-stone-200 bg-white p-8 md:col-span-3">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-md">
                <SealCheckIcon size={32} weight="duotone" className="text-emerald-600" aria-hidden />
                <h3 className="mt-4 text-xl font-bold">Verified, for free</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Every person is confirmed before they can message you. The thing other
                  apps charge for is the default here.
                </p>
              </div>
              <Link
                href="/safety"
                className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border-2 border-stone-300 px-6 text-sm font-semibold text-stone-800 transition-colors hover:border-stone-400 hover:bg-stone-100"
              >
                How we verify
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              seed: "face-1",
              quote: "Found my apartment and both roommates in nine days.",
              name: "Amara Osei",
              role: "Grad student, Austin",
            },
            {
              seed: "face-2",
              quote: "The verification part is what sold me. Nobody sketchy, at all.",
              name: "Dev Malhotra",
              role: "Nurse, Chicago",
            },
            {
              seed: "face-3",
              quote: "We liked the same loft, matched, and split it three ways.",
              name: "Lena Vargas",
              role: "Barista, Portland",
            },
          ].map((t) => (
            <figure
              key={t.name}
              className="rounded-3xl border border-stone-200 bg-white p-6"
            >
              <blockquote className="text-base font-medium leading-7">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="relative h-10 w-10 overflow-hidden rounded-full">
                  <Image
                    src={`/story/${t.seed}.png?v=2`}
                    alt={`Portrait of ${t.name}`}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </span>
                <span className="text-sm">
                  <span className="block font-semibold">{t.name}</span>
                  <span className="text-stone-500">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Brick CTA band */}
      <section className="bg-brick-700 text-brick-50">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-6 py-20 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="max-w-md text-3xl font-bold tracking-tight sm:text-4xl">
              Your people are already looking.
            </h2>
            <p className="mt-3 max-w-md text-brick-100/90">
              Free verification, real listings, and roommates who are actually
              confirmed.
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex h-14 shrink-0 items-center justify-center rounded-full bg-white px-9 text-base font-bold text-brick-700 shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
          >
            Sign up free
          </Link>
        </div>
      </section>

      <footer className="border-t border-stone-200">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8 text-sm text-stone-500">
          <div className="flex items-center gap-2">
            <span className="roomly-mark h-6 w-6 rounded-lg text-xs">R</span>
            <span className="font-semibold text-stone-600">Roomly</span>
          </div>
          <div className="flex items-center gap-5 font-medium">
            <Link href="/safety" className="transition-colors hover:text-stone-800">
              How we verify
            </Link>
            <Link href="/login" className="transition-colors hover:text-stone-800">
              Log in
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
