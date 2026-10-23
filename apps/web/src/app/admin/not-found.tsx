import Link from "next/link";

export default function AdminNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-6xl font-semibold text-gradient">404</p>
      <h1 className="text-2xl font-semibold">Страницата не е намерена</h1>
      <Link href="/admin" className="text-cyan-300">
        ← Към таблото
      </Link>
    </main>
  );
}
