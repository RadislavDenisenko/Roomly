import Link from "next/link";

export const metadata = {
  title: "How Roomly keeps you safe",
};

export default function SafetyPage() {
  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="roomly-mark h-8 w-8 text-sm">
            R
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Roomly
          </span>
        </Link>
        <Link
          href="/signup"
          className="roomly-btn px-4 py-2 text-sm"
        >
          Get started
        </Link>
      </header>

      <article className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          How we keep Roomly safe
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Most roommate scams start with a fake profile or a fake listing.
          Roomly is built to stop both — and we do it transparently, so you know
          exactly what we check.
        </p>

        <Section title="Every profile is verified — for free">
          Unlike other apps that hide verification behind a paywall, every Roomly
          member confirms their email and phone number before they can message
          anyone. Verified members get a badge, so you can see who is real at a
          glance.
        </Section>

        <Section title="We verify listings, not just people">
          Fake apartment listings cause billions of dollars in fraud every year.
          Landlords and owners who post a place on Roomly verify the listing
          itself, and we check photos for signs they were stolen from elsewhere.
        </Section>

        <Section title="What we will never do">
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Sell or share your personal information.</li>
            <li>Run secret background checks or store copies of your ID.</li>
            <li>
              Hold your money — never wire a deposit through anyone you meet
              here.
            </li>
          </ul>
        </Section>

        <Section title="Smart safety, built in">
          We automatically flag messages that ask you to wire money, pay with
          crypto, or send gift cards, and we warn you about listings priced
          suspiciously below market. You can block or report anyone in one tap.
        </Section>

        <div className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <strong className="font-semibold">A quick promise:</strong> we will
          always tell you the truth about what we check. If we say a profile is
          verified, it really is.
        </div>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      <div className="mt-2 text-base leading-7 text-zinc-600 dark:text-zinc-400">
        {children}
      </div>
    </section>
  );
}
