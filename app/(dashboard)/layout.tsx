import { Suspense } from "react";
import { AuthSessionGate } from "@/components/auth-session-gate";
import { SupportShell } from "@/components/novya/shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionGate>
      <Suspense fallback={<div className="nv-loading">Loading your work…</div>}>
        <SupportShell>{children}</SupportShell>
      </Suspense>
    </AuthSessionGate>
  );
}
