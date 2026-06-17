"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { deriveVerificationStatus } from "@/lib/verification";

type Steps = { email: boolean; phone: boolean; id: boolean };

export default function VerifyPage() {
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [steps, setSteps] = useState<Steps>({ email: false, phone: false, id: false });
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { setLoading(false); return; }
      setAuthed(true);
      const { data: p } = await supabase.from("profiles").select("email_verified, phone_verified, id_verified").eq("id", data.user.id).single();
      setSteps({
        email: !!data.user.email_confirmed_at || !!p?.email_verified,
        phone: !!p?.phone_verified,
        id: !!p?.id_verified,
      });
      setLoading(false);
    })();
  }, []);

  async function persist(next: Steps) {
    setSteps(next);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const status = deriveVerificationStatus(next);
    await supabase.from("profiles").upsert({
      id: data.user.id,
      email_verified: next.email,
      phone_verified: next.phone,
      id_verified: next.id,
      verification_status: status,
      verified_at: status === "verified" ? new Date().toISOString() : null,
    });
  }

  async function sendPhoneCode() {
    setBusy(true); setNote(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ phone });
    setBusy(false);
    if (error) { setNote("Phone verification isn't enabled on this project yet — add an SMS provider in Supabase to turn it on."); return; }
    setPhoneSent(true);
  }

  async function confirmPhoneCode() {
    setBusy(true); setNote(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "phone_change" });
    setBusy(false);
    if (error) { setNote("That code didn't match. Try again."); return; }
    await persist({ ...steps, phone: true });
  }

  async function completeId() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600)); // placeholder for a real provider check
    await persist({ ...steps, id: true });
    setBusy(false);
  }

  if (loading) return <Centered>Loading…</Centered>;
  if (!supabaseConfigured) return <Centered>Accounts aren&apos;t connected yet — see SETUP.md.</Centered>;
  if (!authed) return (
    <Centered>
      <p className="text-zinc-600 dark:text-zinc-400">Log in to verify your identity.</p>
      <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">Go to log in</Link>
    </Centered>
  );

  const status = deriveVerificationStatus(steps);

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="roomly-mark h-8 w-8 text-sm">R</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Roomly</span>
        </Link>
        <Link href="/discover" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Discover
        </Link>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Get verified</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Roomly is verified-only. Finish all three steps to start matching and messaging.
        </p>

        <div className="mt-6 space-y-3">
          <StepCard n={1} title="Email" done={steps.email}>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {steps.email ? "Your email is confirmed." : "Confirm your email from the link we sent at sign-up, then refresh."}
            </p>
          </StepCard>

          <StepCard n={2} title="Phone" done={steps.phone}>
            {steps.phone ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Phone verified.</p>
            ) : !phoneSent ? (
              <div className="flex gap-2">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" className="h-11 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                <button type="button" disabled={busy || !phone} onClick={sendPhoneCode} className="roomly-btn h-11 px-4 text-sm">Send code</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="h-11 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                <button type="button" disabled={busy || !code} onClick={confirmPhoneCode} className="roomly-btn h-11 px-4 text-sm">Confirm</button>
              </div>
            )}
          </StepCard>

          <StepCard n={3} title="Photo ID + selfie" done={steps.id}>
            {steps.id ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Identity confirmed.</p>
            ) : (
              <>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Secure identity check — provider coming soon. For now this completes instantly.</p>
                <button type="button" disabled={busy} onClick={completeId} className="roomly-btn mt-3 h-11 px-4 text-sm">Run identity check</button>
              </>
            )}
          </StepCard>
        </div>

        {note && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{note}</p>}

        {status === "verified" && (
          <div className="mt-6 rounded-2xl bg-green-50 px-4 py-4 text-center dark:bg-green-950/40">
            <p className="font-semibold text-green-700 dark:text-green-300">You&apos;re verified! 🎉</p>
            <Link href="/discover" className="roomly-btn mt-3 inline-flex h-11 items-center px-6 text-sm">Start matching</Link>
          </div>
        )}
      </div>
    </main>
  );
}

function StepCard({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white/80 p-5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-green-600 text-white" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"}`}>
          {done ? "✓" : n}
        </span>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="roomly-page flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </main>
  );
}
