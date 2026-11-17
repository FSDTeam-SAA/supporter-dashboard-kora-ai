import { Suspense } from "react";
import { AuthShell } from "@/components/novya/auth";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <Suspense fallback={<p className="nv-caption">Loading…</p>}>{children}</Suspense>
    </AuthShell>
  );
}
