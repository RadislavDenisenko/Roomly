import Link from "next/link";

// Entry to the no-signup demo: a quick lifestyle quiz at /demo that then drops
// into a live, populated demo account.
export function DemoButton({ className }: { className?: string }) {
  return (
    <Link href="/demo" className={className ?? "roomly-btn h-12 px-6 text-sm"}>
      Try the demo
    </Link>
  );
}
