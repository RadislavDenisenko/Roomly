"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!supabaseConfigured) {
      setMessage({
        kind: "error",
        text: "Accounts aren't connected yet — finish the Supabase setup in SETUP.md to enable sign-up.",
      });
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      setMessage({ kind: "error", text: error.message });
    } else if (data.session) {
      router.push("/profile");
    } else {
      setMessage({
        kind: "success",
        text: "Almost there — check your email to confirm your account.",
      });
    }
  }

  return (
    <main className="roomly-page relative flex flex-1 items-center justify-center overflow-hidden px-6 py-12">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -z-0 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-[3rem] bg-gradient-to-br from-fuchsia-300/30 via-violet-300/25 to-transparent blur-3xl dark:from-fuchsia-500/15 dark:via-violet-500/10"
      />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="roomly-mark h-9 w-9 text-base">
            R
          </span>
          <span className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Roomly
          </span>
        </Link>

        <div className="roomly-card-in rounded-3xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Free to join. Verified in minutes.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="At least 6 characters"
            />

            {message && (
              <p
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.kind === "error"
                    ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                }`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="roomly-btn h-11 w-full text-sm"
            >
              {loading ? "Creating account…" : "Get started"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-emerald-600 hover:text-emerald-700"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
    </label>
  );
}
