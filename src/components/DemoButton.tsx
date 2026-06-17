"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

export function DemoButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function tryDemo() {
    if (!supabaseConfigured) {
      router.push("/login");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: "sample.maya@roomly.test",
      password: "Sample123!",
    });
    if (error) {
      setBusy(false);
      router.push("/login");
      return;
    }
    router.push("/discover");
  }

  return (
    <button
      type="button"
      onClick={tryDemo}
      disabled={busy}
      className={className ?? "roomly-btn h-12 px-6 text-sm"}
    >
      {busy ? "Loading demo…" : "Try the demo"}
    </button>
  );
}
