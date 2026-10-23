import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLanguageSwitch } from "@/components/admin/AdminLanguage";
import { LoginForm } from "@/components/admin/LoginForm";
import { LogoMark } from "@/components/layout/Logo";
import { safeAdminRedirect } from "@/lib/admin-api";
import { getAdminDictionary, getAdminLocale } from "@/lib/admin-locale";
import { checkAdminSession } from "@/lib/server-api";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAdminDictionary()).meta.login };
}

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const check = await checkAdminSession();
  if (check.state === "ok") redirect(safeAdminRedirect(nextPath));
  const locale = await getAdminLocale();
  const t = (await getAdminDictionary()).login;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-16">
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="absolute right-4 top-4">
        <AdminLanguageSwitch />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="h-12 w-12" />
          <h1 className="mt-5 text-2xl font-semibold">{t.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{t.subtitle}</p>
        </div>
        <div className="card-accent rounded-2xl p-6">
          {check.state === "unavailable" && (
            <p role="alert" className="mb-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
              {t.apiDown}
            </p>
          )}
          <LoginForm next={nextPath} />
        </div>
        <Link href={`/${locale}`} className="mt-6 block text-center text-sm text-slate-400 hover:text-slate-300">
          {(await getAdminDictionary()).shell.toSite}
        </Link>
      </div>
    </main>
  );
}
