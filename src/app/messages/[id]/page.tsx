"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

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
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    let timer: ReturnType<typeof setInterval> | undefined;
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
      timer = setInterval(() => load(supabase, myId), 3000);
    })();
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [otherId]);

  async function load(supabase: ReturnType<typeof createClient>, myId: string) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${myId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${myId})`,
      )
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as Msg[]);
  }

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
    const { error } = await supabase
      .from("messages")
      .insert({ sender_id: me, recipient_id: otherId, body });
    if (error) {
      setSendError("Could not send — you can only message people you have matched with.");
      return;
    }
    await load(supabase, me);
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
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Go to log in
        </Link>
      </Centered>
    );

  return (
    <main className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-200 bg-white/90 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <Link href="/matches" className="text-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ←
        </Link>
        {other?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={other.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">
            {(other?.full_name ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
          {other?.full_name ?? "Roommate"}
        </span>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-2 px-4 py-6">
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-zinc-400">
            Say hi 👋 — this is the start of your conversation.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm ${
                    mine
                      ? "bg-emerald-600 text-white"
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
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-lg text-white hover:bg-emerald-700"
        >
          ↑
        </button>
      </form>
      {sendError && (
        <p className="mx-auto w-full max-w-md px-4 pb-2 text-center text-xs text-red-600">
          {sendError}
        </p>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </main>
  );
}
