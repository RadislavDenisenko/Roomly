"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { pickIcebreakers } from "@/lib/icebreakers";

type Msg = {
  id: number;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

type Profile = { id: string; full_name: string | null; avatar_url: string | null };

export default function ConversationPage() {
  const params = useParams();
  const otherId = params.id as string;
  const [me, setMe] = useState<string | null>(null);
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  // Seed from supabaseConfigured (a stable build-time constant) so we never need a
  // synchronous setLoading(false) in the effect when accounts aren't connected.
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const load = useCallback(
    async (supabase: ReturnType<typeof createClient>, myId: string) => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${myId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${myId})`,
        )
        .order("created_at", { ascending: true });
      setMessages((data ?? []) as Msg[]);
    },
    [otherId],
  );

  // Opening (or receiving in) this chat marks it read for the unread badges.
  const markRead = useCallback(
    async (supabase: ReturnType<typeof createClient>, myId: string) => {
      await supabase
        .from("chat_reads")
        .upsert({ user_id: myId, peer_id: otherId, last_read_at: new Date().toISOString() });
    },
    [otherId],
  );

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    let poll: ReturnType<typeof setInterval> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setLoading(false);
        return;
      }
      setAuthed(true);
      const myId = u.user.id;
      setMe(myId);
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", otherId)
        .single();
      setOther((prof as Profile) ?? null);
      await load(supabase, myId);
      setLoading(false);
      void markRead(supabase, myId);

      // Live messages via Realtime; RLS scopes the stream to rows I can read.
      channel = supabase
        .channel(`chat-${otherId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${myId}` },
          (payload) => {
            const m = payload.new as Msg;
            if (m.sender_id !== otherId) return;
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
            void markRead(supabase, myId);
          },
        )
        .subscribe((status) => {
          // Installs without the realtime publication still work: fall back to polling.
          if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !poll) {
            poll = setInterval(() => load(supabase, myId), 5000);
          }
        });
    })();
    return () => {
      if (poll) clearInterval(poll);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [otherId, load, markRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !me) return;
    setText("");
    setSendError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: me, recipient_id: otherId, body })
      .select()
      .single();
    if (error || !data) {
      setSendError("Could not send — you can only message people you have matched with.");
      return;
    }
    const sent = data as Msg;
    setMessages((prev) => (prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]));
  }

  async function unmatch() {
    if (!me) return;
    setMenuOpen(false);
    setActionError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("unmatch_user", { other_id: otherId });
    if (error) {
      setActionError("Could not unmatch — please try again.");
      return;
    }
    router.push("/matches");
  }

  async function block() {
    if (!me) return;
    setMenuOpen(false);
    setActionError(null);
    const supabase = createClient();
    const { error: blockError } = await supabase.from("blocks").insert({ blocker_id: me, blocked_id: otherId });
    if (blockError) {
      setActionError("Could not block — please try again.");
      return;
    }
    await supabase.rpc("unmatch_user", { other_id: otherId });
    router.push("/matches");
  }

  async function submitReport() {
    if (!me) return;
    setReportError(null);
    const supabase = createClient();
    const { error } = await supabase.from("reports").insert({ reporter_id: me, reported_id: otherId, reason: reportReason || "unspecified" });
    if (error) {
      setReportError("Could not submit report — please try again.");
      return;
    }
    setReporting(false);
    setReportReason("");
    setMenuOpen(false);
  }

  if (loading) return <Centered>Loading…</Centered>;
  if (!supabaseConfigured)
    return <Centered>Accounts aren&apos;t connected yet — see SETUP.md.</Centered>;
  if (!authed)
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">Log in to view messages.</p>
        <Link
          href="/login"
          className="roomly-btn mt-4 h-11 px-6 text-sm"
        >
          Go to log in
        </Link>
      </Centered>
    );

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-200 bg-white/90 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <Link href="/matches" className="text-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ←
        </Link>
        {other?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={other.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-sm font-bold text-white">
            {(other?.full_name ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
          {other?.full_name ?? "Roommate"}
        </span>
        <Link
          href={`/places/together?with=${otherId}`}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
        >
          🏠 Find a place together
        </Link>
        <div className="relative">
          <button type="button" aria-label="Conversation options" onClick={() => setMenuOpen((o) => !o)} className="px-2 text-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">⋯</button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <button type="button" onClick={unmatch} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">Unmatch</button>
              <button type="button" onClick={block} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">Block</button>
              <button type="button" onClick={() => { setReporting(true); setMenuOpen(false); }} className="block w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Report</button>
            </div>
          )}
        </div>
      </header>

      {actionError && (
        <p className="mx-auto w-full max-w-md px-4 pt-2 text-center text-xs text-red-600">
          {actionError}
        </p>
      )}

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-2 px-4 py-6">
        {messages.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-zinc-400">Break the ice 👋</p>
            <div className="flex flex-col gap-2">
              {pickIcebreakers(3).map((q) => (
                <button key={q} type="button" onClick={() => setText(q)} className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">{q}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm ${
                    mine
                      ? "bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white"
                      : "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={send}
        className="sticky bottom-0 mx-auto flex w-full max-w-md items-center gap-2 border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          className="h-11 flex-1 rounded-full border border-zinc-300 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="submit"
          className="roomly-btn h-11 w-11 shrink-0 text-lg"
        >
          ↑
        </button>
      </form>
      {sendError && (
        <p className="mx-auto w-full max-w-md px-4 pb-2 text-center text-xs text-red-600">
          {sendError}
        </p>
      )}
      {reporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setReporting(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Report {other?.full_name ?? "this person"}</h3>
            <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} rows={3} placeholder="What's going on?" className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setReporting(false)} className="h-10 flex-1 rounded-full border border-zinc-300 text-sm font-semibold dark:border-zinc-700">Cancel</button>
              <button type="button" onClick={submitReport} className="roomly-btn h-10 flex-1 text-sm">Send report</button>
            </div>
            {reportError && (
              <p className="mt-2 text-center text-xs text-red-600">{reportError}</p>
            )}
            <p className="mt-3 text-center text-xs text-zinc-400">See our <Link href="/safety" className="underline">safety guidelines</Link>.</p>
          </div>
        </div>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="roomly-page flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </main>
  );
}
