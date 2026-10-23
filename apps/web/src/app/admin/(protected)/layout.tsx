import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { ErrorState } from "@/components/admin/ui";
import { getAdminDictionary } from "@/lib/admin-locale";
import { routes } from "@/lib/routes";
import { checkAdminSession } from "@/lib/server-api";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const check = await checkAdminSession();
  if (check.state === "anonymous") redirect(routes.adminLogin);
  if (check.state === "unavailable") {
    const t = await getAdminDictionary();
    return (
      <main className="mx-auto max-w-xl px-4 py-24">
        <ErrorState message={t.shell.apiUnavailable} />
      </main>
    );
  }
  return <AdminShell userName={check.session.user.full_name}>{children}</AdminShell>;
}
