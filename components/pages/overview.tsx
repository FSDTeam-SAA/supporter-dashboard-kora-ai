"use client";
// Support Overview — design p01.
import { PageHead } from "@/components/novya/page-head";
import { DataState } from "@/components/novya/ui";
import { label } from "@/lib/format";
import { firstName, greeting, time, useSupport, type SupportContext } from "@/lib/support";
import { asArray } from "@/lib/utils";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type OverviewData = {
  refreshedAt: string;
  scope: { role: string; title: string; queues: string[] };
  pulse: { open: number; slaRisks: number; inProgress: number; withinSla: number };
  myQueue: { total: number; new: number; assigned: number; inProgress: number; waiting: number; escalated: number };
  today: { _id: string; kind: string; title: string; subtitle: string; at: string; priority: string; href: string }[];
  priorityCases: { _id: string; code: string; title: string; subject?: string; priority: string; status: string; waitingReason?: string; slaRisk: boolean; ageMinutes: number | null }[];
  queues: { _id: string; name: string; open: number; slaRisk: number }[];
  sla: { current: number; target: number };
};

const age = (m: number | null) => (m == null ? "" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`);

/** Status column + action column for a case row (design p01 "Priority cases"). */
function caseSignal(c: OverviewData["priorityCases"][number]): { status: string; action: string; tone: string } {
  if (c.slaRisk) return { status: "SLA risk", action: "Take over", tone: "amber" };
  if (c.priority === "urgent") return { status: "Critical", action: "Today", tone: "green" };
  if (c.status === "waiting") return { status: "Waiting", action: "Review", tone: "muted" };
  if (c.status === "in_progress") return { status: "In progress", action: "Open", tone: "green" };
  return { status: label(c.status), action: "Open", tone: "green" };
}

function todayTone(i: number, at: string) {
  const isTime = new Date(at).getHours() + new Date(at).getMinutes() > 0;
  if (!isTime) return { tone: "muted", text: "Today" };
  return { tone: i === 0 ? "amber" : "green", text: time(at) };
}

export function OverviewPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const ctx = useSupport<SupportContext>("/context");
  const q = useSupport<OverviewData>("/overview", true, 60_000);
  const d = q.data;
  const roleLabel = ctx.data?.teamLead ? "Support Team Lead" : "Supporter";
  const queues = asArray<OverviewData["queues"][number]>(d?.queues);
  const conversations = queues.reduce((n, x) => n + x.open, 0);

  return (
    <div className="sp-overview">
      <PageHead
        eyebrow="Support"
        title={`${greeting()}, ${firstName(ctx.data?.name || session?.user?.name)}`}
        description="Your queues, cases and customer conversations in one focused workspace."
        chip={`${roleLabel} · Customer Operations`}
        onCreate={() => router.push("/tasks/new")}
        createLabel="Task, callback or case note"
      />
      <DataState pending={q.isPending} error={q.error} retry={() => q.refetch()}>
        {d && (
          <div className="sp-overview-grid">
            <section className="nv-card sp-pulse">
              <div className="sp-card-top">
                <h2>Today&apos;s support pulse</h2>
                <span>Updated live</span>
              </div>
              <div className="sp-pulse-main">
                <strong>{d.pulse.open} open</strong>
                <span>across assigned queues</span>
              </div>
              <div className="sp-bar" aria-label={`${d.pulse.withinSla}% within SLA`}>
                <i style={{ width: `${d.pulse.withinSla}%` }} />
                <em style={{ left: `${d.pulse.withinSla}%` }}>{d.pulse.withinSla}%</em>
              </div>
              <div className="sp-pulse-stats">
                <div><b>{d.pulse.slaRisks}</b><span>SLA risks</span></div>
                <div><b>{d.pulse.inProgress}</b><span>in progress</span></div>
                <div><b>{d.pulse.withinSla}%</b><span>within SLA</span></div>
              </div>
            </section>

            <section className="nv-card sp-today">
              <div className="sp-card-top">
                <h2>Today</h2>
                <span>{d.today.length} priorities</span>
              </div>
              {d.today.length ? (
                d.today.slice(0, 3).map((t, i) => {
                  const s = todayTone(i, t.at);
                  return (
                    <Link key={t.kind + t._id} href={t.href} className="sp-today-row">
                      <span className={`sp-dot ${i === 0 ? "amber" : i === 1 ? "green" : "muted"}`} />
                      <span>
                        <b>{t.title}</b>
                        <small>{t.subtitle}</small>
                      </span>
                      <em className={s.tone}>{s.text}</em>
                    </Link>
                  );
                })
              ) : (
                <p className="nv-caption">Nothing scheduled for today.</p>
              )}
            </section>

            <section className="nv-card sp-myqueue">
              <h2>My queue</h2>
              <p className="sp-sub">{d.myQueue.total} active conversations · updated live</p>
              <div className="sp-tiles">
                {[
                  ["New", d.myQueue.new, "unassigned", ""],
                  ["Assigned", d.myQueue.assigned, "owned", ""],
                  ["In progress", d.myQueue.inProgress, "active", ""],
                  ["Waiting", d.myQueue.waiting, "customer", ""],
                  ["Escalated", d.myQueue.escalated, "handover", "green"],
                ].map(([name, n, unit, tone]) => (
                  <Link key={String(name)} href="/queue" className="sp-tile">
                    <span>{name}</span>
                    <div>
                      <b>{n}</b>
                      <small className={String(tone)}>{unit}</small>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="sp-list-head">
                <h3>Priority cases</h3>
                <Link href="/queue">Open queue</Link>
              </div>
              {d.priorityCases.length ? (
                d.priorityCases.slice(0, 4).map((c) => {
                  const s = caseSignal(c);
                  return (
                    <Link key={c._id} href={`/workspace/support/cases/${c._id}`} className="sp-case-row">
                      <span className="sp-check" />
                      <span className="sp-case-name">
                        <b>{c.title}</b>
                        <small>{[c.subject, age(c.ageMinutes)].filter(Boolean).join(" · ")}</small>
                      </span>
                      <span className="sp-case-status">{s.status}</span>
                      <em className={s.tone}>{s.action}</em>
                    </Link>
                  );
                })
              ) : (
                <p className="nv-caption" style={{ padding: "14px 0" }}>No open cases assigned to you.</p>
              )}
            </section>

            <section className="nv-card sp-queues">
              <div className="sp-card-top">
                <h2>Assigned queues</h2>
                <span>{conversations} conversations</span>
              </div>
              {queues.length ? (
                queues.map((x) => (
                  <div key={x._id} className="sp-queue-row">
                    <span className={`sp-dot ${x.slaRisk ? "green" : "amber"}`} />
                    <span>
                      <b>{x.name}</b>
                      <small>{x.open} open</small>
                    </span>
                    <em className={x.slaRisk ? "green" : "amber"}>{x.slaRisk ? `${x.slaRisk} SLA risk` : "Stable"}</em>
                  </div>
                ))
              ) : (
                <p className="nv-caption">You are not a member of any queue yet.</p>
              )}
              <Link href="/queue" className="nv-button sp-btn">Open queue</Link>
              <div className="sp-sla">
                <div className="sp-card-top">
                  <h2>SLA performance</h2>
                  <span>Today</span>
                </div>
                <div className="sp-pulse-main">
                  <strong>{d.sla.current}%</strong>
                  <span>within target</span>
                </div>
                <div className="sp-bar"><i style={{ width: `${d.sla.current}%` }} /></div>
                <div className="sp-sla-scale">
                  <span>{d.sla.current}% current</span>
                  <span>{d.sla.target}% target</span>
                </div>
                <div className="sp-sla-actions">
                  <Link href="/workspace/support/quality" className="nv-button">View analytics</Link>
                  <Link href="/calendar" className="nv-button">My schedule</Link>
                </div>
              </div>
            </section>
          </div>
        )}
      </DataState>
    </div>
  );
}
