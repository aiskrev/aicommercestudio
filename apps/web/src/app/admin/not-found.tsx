import Link from "next/link";

import { getAdminDictionary } from "@/lib/admin-locale";

export default async function AdminNotFound() {
  const t = (await getAdminDictionary()).errorPage;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-6xl font-semibold text-gradient">404</p>
      <h1 className="text-2xl font-semibold">{t.notFound}</h1>
      <Link href="/admin" className="text-cyan-300">
        {t.notFoundBack}
      </Link>
    </main>
  );
}
