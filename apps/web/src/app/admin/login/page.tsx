import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/LoginForm";
import { LogoMark } from "@/components/layout/Logo";
import { safeAdminRedirect } from "@/lib/admin-api";
import { checkAdminSession } from "@/lib/server-api";

export const metadata: Metadata = { title: "Вход" };

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const check = await checkAdminSession();
  if (check.state === "ok") redirect(safeAdminRedirect(nextPath));

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-16">
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="h-12 w-12" />
          <h1 className="mt-5 text-2xl font-semibold">Вход за администратори</h1>
          <p className="mt-2 text-sm text-slate-400">Достъпът е само за упълномощени служители.</p>
        </div>
        <div className="glass rounded-2xl p-6">
          {check.state === "unavailable" && (
            <p role="alert" className="mb-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
              API услугата не отговаря. Входът може да е недостъпен.
            </p>
          )}
          <LoginForm next={nextPath} />
        </div>
        <Link href="/" className="mt-6 block text-center text-sm text-slate-500 hover:text-slate-300">
          ← Към сайта
        </Link>
      </div>
    </main>
  );
}
