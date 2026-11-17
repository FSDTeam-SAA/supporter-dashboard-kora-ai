"use client";
// Support Team Lead — design p98–p116.
import { CreateTask } from "@/components/pages/work";
import { useKora } from "@/components/novya/kora";
import { Button, DataState, Empty, Field, Modal } from "@/components/novya/ui";
import { label } from "@/lib/format";
import { date, time, useSupport, useSupportMutation, type Doc } from "@/lib/support";
import { asArray } from "@/lib/utils";
import { ArrowLeft, ChevronLeft, ChevronRight, MoreHorizontal, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

const S = (v: unknown) => String(v ?? "");
type Person = { _id?: string; name?: string } | string | null | undefined;
const nameOf = (p: Person) => (p && typeof p === "object" ? S(p.name) : "");
const initials = (n: string) => n.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
type Member = { _id: string; user_id: string; name: string; email?: string; title?: string; status?: string; activeCases: number; resolved90: number; openTasks: number; quality: number; sla: number; capacity: number; creditLimit: number };

function Head({ title, description, actions, crumb }: { title: string; description: string; actions?: ReactNode; crumb?: ReactNode }) {
  return <div className="sa-head"><div>{crumb}<h1>{title}</h1><p>{description}</p></div><div className="sw-actions">{actions}</div></div>;
}
function Plus2({ href }: { href: string }) {
  return <Link href={href} className="nv-plus-circle" aria-label="Create"><Plus size={18} /></Link>;
}
function Bar({ v, tone = "" }: { v: number; tone?: string }) {
  return <span className={`sl-bar ${tone}`} style={{ marginTop: 0 }}><i style={{ width: `${Math.min(100, v)}%` }} /></span>;
}

/* ---------------- Overview (p98) ---------------- */
function TeamOverview() {
  const o = useSupport<{ stats: { members: number; active: number; openCases: number; resolvedMonth: number; teamSla: number }; attention: Doc[]; capacity: { available: number; atLimit: number } }>("/team/overview");
  const members = useSupport<Member[]>("/team/members");
  const d = o.data;
  return (
    <div className="sa-page">
      <Head title="Teamleader" description="Lead your assigned support team, balance queues and coach service quality." actions={<Plus2 href="/team/tasks/new" />} />
      <DataState pending={o.isPending} error={o.error} retry={() => o.refetch()}>
        {d && (
          <>
            <div className="sa-stats four">
              {[["Team members", d.stats.members, `${d.stats.active} active`, "Supporters assigned to your leadership scope"], ["Open cases", d.stats.openCases, "", "Open workload across your team"], ["Resolved this month", d.stats.resolvedMonth, "", "Cases resolved by your team this month"], ["Team SLA", `${d.stats.teamSla}%`, "", "First-response SLA attainment"]].map(([l, n, b, s]) => (
                <div key={S(l)} className="sa-stat"><small className="sw-cap">{S(l)}</small><b>{S(n)} {b && <em className="st-mini">{S(b)}</em>}</b><span>{S(s)}</span></div>
              ))}
            </div>
            <div className="st-grid3">
              <section className="sa-panel">
                <div className="sw-row-between"><h3 className="sw-h3">Team attention</h3><span className="sw-sub">{d.attention.length} items need review</span></div>
                <div className="sl-table">
                  <div className="sl-thead st-att"><span>Supporter / Case</span><span>Queue state</span><span>Supporter</span><span>Priority</span><span>Status</span></div>
                  {d.attention.map((a) => (
                    <Link key={S(a._id)} href={`/workspace/support/cases/${a._id}`} className="sl-trow st-att"><span className="sh-user"><span className="sw-avatar small">{initials(S(a.title))}</span><span><b>{S(a.title)}</b><small>{S(a.sub)}</small></span></span><span>{label(S(a.status))}</span><span>{S(a.owner)}</span><span>{label(S(a.priority))}</span><span><span className={`sw-pill ${a.priority === "urgent" ? "amber" : "green"}`}>{a.priority === "urgent" ? "Urgent" : "Active"}</span></span></Link>
                  ))}
                  {!d.attention.length && <Empty title="All clear" description="No open cases need attention." />}
                </div>
              </section>
              <section className="sa-panel">
                <h3 className="sw-h3">SLA health</h3><b className="sh-big">{d.stats.teamSla}%</b>
                {asArray<Member>(members.data).map((m) => <div key={m._id} className="st-meter"><span>{m.name}</span><em>{m.sla}%</em><Bar v={m.sla} tone={m.sla >= 90 ? "green" : "amber"} /></div>)}
              </section>
              <section className="sa-panel">
                <h3 className="sw-h3">Team capacity</h3>
                <div className="st-cap"><b>{d.capacity.available}</b><small>available</small><b className="red">{d.capacity.atLimit}</b><small>at capacity</small></div>
                {asArray<Member>(members.data).map((m) => <div key={m._id} className="st-meter"><span>{m.name}</span><em>{m.capacity}%</em><Bar v={m.capacity} /></div>)}
                <Button href="/team/queue-assignments">Open queue</Button>
              </section>
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}

/* ---------------- Preferences (p99) ---------------- */
const PREFS: [string, string][] = [["slaBreach", "SLA breach"], ["queueCapacity", "Queue capacity"], ["unassignedCases", "Unassigned cases"], ["caseEscalation", "Case escalation"], ["shiftCoverage", "Shift coverage"], ["coachingSummary", "Coaching summary"], ["approvalDeputy", "Approval deputy"], ["creditAlerts", "Credit alerts"]];
function TeamPreferences() {
  const p = useSupport<Record<string, string>>("/team/preferences");
  const m = useSupportMutation();
  const set = (k: string, v: string) => m.mutate({ path: "/team/preferences", method: "put", body: { [k]: v } });
  return (
    <div className="sa-page">
      <Head title="Team Preferences" description="Configure team alerts, delegation, queue capacity and escalation defaults." actions={<span className="sw-tag">Support leadership</span>} />
      <div className="sa-stats four">
        <div className="sa-stat"><small className="sw-cap">Team coverage</small><b>Covered</b><span className="green">Active</span></div>
        <div className="sa-stat"><small className="sw-cap">Team alerts</small><b>{PREFS.length}</b><span className="green">Active</span></div>
        <div className="sa-stat"><small className="sw-cap">Deputy</small><b>{p.data?.deputy || "Not set"}</b><span>Optional</span></div>
        <div className="sa-stat"><small className="sw-cap">Escalations</small><b>4 rules</b><span>Inherited</span></div>
      </div>
      <div className="sa-split">
        <section className="sa-panel">
          <h3 className="sw-h3">Support Team Preferences</h3><p className="sw-sub">SLA alerts, queue thresholds, case escalation and shift coverage defaults.</p>
          <div className="sl-table">
            <div className="sl-thead st-pref"><span>Setting</span><span>Current</span><span>Auto</span><span>Ask</span><span>Off</span></div>
            {PREFS.map(([k, l]) => {
              const v = p.data?.[k] || "current";
              return (
                <div key={k} className="sl-trow st-pref"><span><b>{l}</b><small>Immediate</small></span>
                  {["current", "auto", "ask", "off"].map((opt) => <span key={opt}><button className={`st-radio ${v === opt ? "on" : ""}`} onClick={() => set(k, opt)} aria-label={`${l} ${opt}`} /></span>)}
                </div>
              );
            })}
          </div>
          <p className="st-note">Team preferences never override Admin permissions or approval rules.</p>
        </section>
        <aside className="sw-stack">
          <section className="sa-panel"><h3 className="sw-h3">Leadership routing</h3><p className="sw-sub">Team scope, temporary cover and inherited policy</p>
            <div className="sw-kv"><div><span>Support team</span><b>Team scope</b></div><div><span>Temporary deputy</span><b>{p.data?.deputy || "Not set"}</b></div><div><span>Admin policy</span><b>Inherited</b></div></div>
            <form className="sw-inline" onSubmit={(e) => { e.preventDefault(); set("deputy", S(new FormData(e.currentTarget).get("deputy"))); }}><input className="nv-input" name="deputy" placeholder="Set temporary deputy" /><Button type="submit">Save</Button></form>
          </section>
          <section className="sa-panel"><h3 className="sw-h3">Inherited guardrails</h3><p className="sw-sub">Global permissions and security inherited from Admin</p>
            <div className="sw-kv"><div><span>Member scope</span><b>Blocked</b></div><div><span>Data access</span><b>Ask first</b></div><div><span>Approval boundary</span><b>Off</b></div><div><span>Kora limits</span><b>Approval</b></div></div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- Tasks (p100–p103) ---------------- */
type Week = { from: string; members: { user_id: string; name: string; title: string; days: { date: string; total: number; open: number; overdue: number; done: number }[] }[] };
function TeamTasks() {
  const [from, setFrom] = useState<string>("");
  const w = useSupport<Week>(`/tasks/week${from ? `?from=${encodeURIComponent(from)}` : ""}`);
  const t = useSupport<{ stats: { open: number; dueToday: number; overdue: number; completed: number } }>("/tasks?view=all&team=true");
  const start = w.data ? new Date(w.data.from) : null;
  const shift = (days: number) => start && setFrom(new Date(start.getTime() + days * 86400000).toISOString());
  return (
    <div className="sa-page">
      <Head title="Tasks" description="Weekly task coverage across your assigned support team." actions={<><span className="sl-seg"><Link href="/tasks">My Tasks</Link><Link href="/team/tasks" className="on">Team</Link></span><Plus2 href="/team/tasks/new" /></>} />
      <div className="sa-stats four">
        {[["Open", t.data?.stats.open, "Across your team"], ["Due today", t.data?.stats.dueToday, "Need attention"], ["Overdue", t.data?.stats.overdue, "People need support"], ["Completion", t.data ? `${Math.round(((t.data.stats.completed || 0) / Math.max(1, (t.data.stats.open || 0) + (t.data.stats.completed || 0))) * 100)}%` : "–", "Last 7 days"]].map(([l, n, s]) => <div key={S(l)} className="sa-stat"><small className="sw-cap">{S(l)}</small><b>{S(n ?? "–")}</b><span>{S(s)}</span></div>)}
      </div>
      <section className="sa-panel">
        <div className="sa-toolbar"><button className="sa-chip" onClick={() => shift(-7)}><ChevronLeft size={12} /></button><span className="sw-tag">{start ? `${date(start)} – ${date(new Date(start.getTime() + 6 * 86400000))}` : "This week"}</span><button className="sa-chip" onClick={() => shift(7)}><ChevronRight size={12} /></button><button className="sa-chip" onClick={() => setFrom("")}>Today</button><Link className="sa-chip on" href="/team/tasks/new">+ Assign task</Link></div>
        <DataState pending={w.isPending} error={w.error} retry={() => w.refetch()}>
          <div className="st-week">
            <div className="st-week-head"><span>Team member</span>{Array.from({ length: 7 }, (_, i) => <span key={i}>{start ? new Date(start.getTime() + i * 86400000).toLocaleDateString("en-US", { weekday: "short", day: "numeric" }) : ""}</span>)}</div>
            {asArray<Week["members"][number]>(w.data?.members).map((m) => (
              <div key={m.user_id} className="st-week-row">
                <span className="sh-user"><span className="sw-avatar small">{initials(m.name)}</span><span><b>{m.name}</b><small>{m.title}</small></span></span>
                {m.days.map((d, i) => (
                  <Link key={i} href={`/team/tasks/day/${m.user_id}/${new Date(d.date).toISOString().slice(0, 10)}`} className={`st-cell ${d.overdue ? "risk" : ""}`}><b>{d.total}</b><small>{d.total ? (d.overdue ? "Overdue" : d.open ? "In progress" : "Done") : "No tasks"}</small></Link>
                ))}
              </div>
            ))}
          </div>
        </DataState>
      </section>
    </div>
  );
}
function DayDetail({ member, day }: { member: string; day: string }) {
  const members = useSupport<Member[]>("/team/members");
  const ctx = useSupport<{ name: string; memberId: string }>("/context");
  const t = useSupport<{ items: Doc[] }>(`/tasks?team=true&view=all&member=${member}&date=${day}`);
  const m = useSupportMutation();
  const kora = useKora();
  const who = asArray<Member>(members.data).find((x) => x.user_id === member)?.name || ctx.data?.name || "Team member";
  const items = asArray<Doc>(t.data?.items);
  const open = items.filter((x) => x.status !== "done");
  return (
    <div className="sa-page">
      <Head crumb={<Link href="/team/tasks" className="sl-back"><ArrowLeft size={12} /> Team tasks</Link>} title={`${who} · ${new Date(day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`} description="Selected day detail · Review, support and reassign tasks." />
      <div className="sa-stats four">{[["Total tasks", items.length], ["Open", open.length], ["Overdue", open.filter((x) => new Date(S(x.dueDate)) < new Date()).length], ["Completed", items.length - open.length]].map(([l, n]) => <div key={S(l)} className="sa-stat"><small className="sw-cap">{S(l)}</small><b>{S(n)}</b></div>)}</div>
      <div className="sa-split">
        <section className="sa-panel"><h3 className="sw-h3">{new Date(day).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</h3>
          <div className="sw-tasks">{items.map((x) => <div key={S(x._id)} className="sw-task"><span className={`sw-check ${x.status === "done" ? "on" : ""}`} /><span className="sw-task-main"><b>{S(x.title)}</b><small>Due {time(S(x.dueDate))} · {nameOf(x.assignedBy as Person)}</small></span><span className={`sw-pill ${x.priority === "high" ? "amber" : ""}`}>{label(S(x.status))}</span>
            <select className="sl-select" defaultValue="" onChange={(e) => e.target.value && m.mutate({ path: `/tasks/${x._id}`, method: "patch", body: { assignee_id: e.target.value, reason: "Rebalanced by Teamleader" } })}><option value="">Reassign…</option>{asArray<Member>(members.data).filter((p) => p.user_id !== member).map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}</select></div>)}
            {!items.length && <Empty title="No tasks this day" description="Assign one from Team Tasks." />}
          </div>
        </section>
        <aside className="sw-stack">
          <section className="sa-panel"><h3 className="sw-h3">Member &amp; day</h3><p className="sw-sub">{items.length - open.length} of {items.length} tasks completed</p><Bar v={items.length ? ((items.length - open.length) / items.length) * 100 : 0} /><Button onClick={() => kora.openChat()}>Review with Kora</Button></section>
          <section className="sa-panel"><h3 className="sw-h3">Day summary</h3><p className="sw-sub">Only the selected member and day are shown.</p></section>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- Supporters (p104–p109) ---------------- */
function Supporters() {
  const ms = useSupport<Member[]>("/team/members");
  const [q, setQ] = useState("");
  const list = asArray<Member>(ms.data).filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  const cap = list.length ? Math.round(list.reduce((n, m) => n + m.capacity, 0) / list.length) : 0;
  return (
    <div className="sa-page">
      <Head title="Supporters" description="Manage the supporters assigned to your team, their workload, shifts and coaching signals." actions={<Plus2 href="/team/tasks/new" />} />
      <div className="sh-strip"><div><small>Support team</small><b>{list.length} assigned supporters</b></div><div><small>Team capacity</small><b>{cap}% utilized</b></div><div><small>SLA &amp; quality</small><b>{list.length ? Math.round(list.reduce((n, m) => n + m.sla, 0) / list.length) : 0}% SLA · {list.length ? Math.round(list.reduce((n, m) => n + m.quality, 0) / list.length) : 0} quality</b></div></div>
      <div className="sa-toolbar"><label className="sa-search"><Search size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search supporters..." /></label></div>
      <section className="sa-panel">
        <div className="sw-row-between"><h3 className="sw-h3">Support team</h3><span className="sw-sub">{list.length} supporters</span></div>
        <DataState pending={ms.isPending} error={ms.error} retry={() => ms.refetch()}>
          <div className="sl-table">
            <div className="sl-thead st-sup"><span>Supporter</span><span>Role</span><span>Capacity</span><span>Active cases</span><span>Quality</span><span>SLA</span><span>Credit limit</span><span>Status</span></div>
            {list.map((m) => (
              <Link key={m._id} href={`/team/supporters/${m.user_id}`} className="sl-trow st-sup"><span className="sh-user"><span className="sw-avatar small">{initials(m.name)}</span><span><b>{m.name}</b><small>{m.email}</small></span></span><span>{S(m.title).split("·")[1]?.trim() || m.title}</span><span className="st-capcell"><Bar v={m.capacity} /><small>{m.capacity}%</small></span><span>{m.activeCases}</span><span>{m.quality}%</span><span>{m.sla}%</span><span>Up to €{m.creditLimit}</span><span><span className={`sw-pill ${m.capacity >= 100 ? "amber" : "green"}`}>{m.capacity >= 100 ? "At capacity" : label(m.status || "active")}</span></span></Link>
            ))}
            {!list.length && <Empty title="No direct reports" description="Supporters whose manager is you appear here." />}
          </div>
        </DataState>
      </section>
    </div>
  );
}
type MemberDetail = Member & { member_code?: string; employment?: { startDate?: string }; cases: Doc[]; portfolios: Doc[]; credits: Doc[] };
function SupporterRecord({ id, tab }: { id: string; tab: string }) {
  const r = useSupport<MemberDetail>(`/team/members/${id}`);
  const m = useSupportMutation();
  const [coach, setCoach] = useState(false);
  const d = r.data;
  const tabs: [string, string][] = [["overview", "Overview"], ["cases", "Assigned Cases"], ["portfolios", "Partner Portfolios"], ["performance", "Performance & Coaching"], ["credits", "Credit Approval"]];
  return (
    <DataState pending={r.isPending} error={r.error} retry={() => r.refetch()}>
      {d && (
        <div className="sa-page">
          <Link href="/team/supporters" className="sl-back"><ArrowLeft size={12} /> Back to supporters</Link>
          <section className="sa-panel st-profile">
            <span className="sw-avatar big">{initials(d.name)}</span>
            <span><b>{d.name} <span className="sw-pill green">{label(d.status || "active")}</span></b><small>{d.title} · Employee ID {d.member_code}</small></span>
            <span><small className="sw-cap">Shift</small><b>{S(d.title).split("·")[1]?.trim() || "Support"}</b></span>
            <span><small className="sw-cap">Current credit limit</small><b>Up to €{d.creditLimit} per case</b></span>
            <span><small className="sw-cap">Joined</small><b>{d.employment?.startDate ? date(d.employment.startDate) : "—"}</b></span>
          </section>
          <div className="sl-seg">{tabs.map(([k, l]) => <Link key={k} href={`/team/supporters/${id}${k === "overview" ? "" : `?tab=${k}`}`} className={tab === k ? "on" : ""}>{l}</Link>)}</div>
          {(tab === "overview" || tab === "performance") && (
            <div className="sa-split">
              <section className="sa-panel"><h3 className="sw-h3">Supporter performance &amp; coaching</h3><p className="sw-sub">Service quality, coaching signals and assigned case workload</p>
                <div className="sa-stats four">{[["Active cases", d.activeCases], ["Quality", `${d.quality}%`], ["SLA & quality", `${d.sla}% · ${d.quality}`], ["Resolved · 90 days", d.resolved90]].map(([l, n]) => <div key={S(l)} className="sa-stat"><small className="sw-cap">{S(l)}</small><b>{S(n)}</b></div>)}</div>
                <h4 className="sl-h4">Assigned case workload</h4>
                <div className="sw-tasks">{d.cases.slice(0, 5).map((c) => <Link key={S(c._id)} href={`/workspace/support/cases/${c._id}`} className="sw-task"><span className="sw-avatar small">{initials(S(c.subjectName || c.title))}</span><span className="sw-task-main"><b>{S(c.subjectName) || S(c.title)}</b><small>{S(c.title)}</small></span><span>{label(S(c.status))}</span><span className={`sw-pill ${c.priority === "urgent" ? "amber" : ""}`}>{label(S(c.priority))}</span></Link>)}</div>
              </section>
              <aside className="sa-panel"><h3 className="sw-h3">Supporter operating profile</h3><p className="sw-sub">Leadership view; private chats, Brain and quiz answers stay private.</p>
                <div className="sw-kv"><div><span>Active tasks</span><b>{d.openTasks}</b></div><div><span>Case capacity</span><b>{d.capacity}% allocated</b></div><div><span>Credit limit</span><b>Up to €{d.creditLimit}</b></div></div>
                <div className="sw-summary"><b>Kora support insight</b><p>{d.capacity > 80 ? "Capacity is near its limit. Consider reassigning new cases before automatic assignment." : "Capacity is healthy; quality and SLA are within target."}</p></div>
                <div className="sw-actions"><Button onClick={() => setCoach(true)}>Create coaching note</Button><Button href="/workflows/teamlead_review">Request account support</Button></div>
              </aside>
            </div>
          )}
          {tab === "cases" && (
            <section className="sa-panel"><h3 className="sw-h3">Assigned Cases</h3><p className="sw-sub">{d.cases.length} active assignments · sorted by next action</p>
              <div className="sl-table"><div className="sl-thead st-cases"><span>Case</span><span>Status</span><span>Priority</span><span>Next step</span></div>
                {d.cases.map((c) => <Link key={S(c._id)} href={`/workspace/support/cases/${c._id}`} className="sl-trow st-cases"><span><b>{S(c.subjectName) || S(c.title)}</b><small>{S(c.case_code)} · {S(c.title)}</small></span><span>{label(S(c.status))}</span><span>{label(S(c.priority))}</span><span>{c.nextActionAt ? date(S(c.nextActionAt)) : "—"}</span></Link>)}
              </div>
            </section>
          )}
          {tab === "portfolios" && (
            <section className="sa-panel"><h3 className="sw-h3">Assigned partner portfolios</h3>
              <div className="sw-tasks">{d.portfolios.map((p) => <Link key={S(p._id)} href={`/team/portfolios/${p._id}`} className="sw-task"><span className="sw-task-main"><b>{S(p.partnerName)}</b><small>{S(p.name)} · {S(p.customers)} customers</small></span><span>€{Number(p.customers) * Number(p.bonusPerCustomer)} / month</span></Link>)}{!d.portfolios.length && <Empty title="No portfolios" description="Assign one from Partner Portfolios." />}</div>
            </section>
          )}
          {tab === "credits" && (
            <section className="sa-panel"><h3 className="sw-h3">Credits &amp; approval scope</h3><p className="sw-sub">Admin-managed thresholds · read-only</p>
              <div className="sa-stats three">{[["Goodwill", "Up to €100"], ["Service recovery", "Up to €250"], ["Refund exception", "Up to €500"]].map(([l, v]) => <div key={l} className="sa-stat"><small className="sw-cap">{l}</small><b>{v}</b></div>)}</div>
              <div className="sw-tasks">{d.credits.map((c) => <div key={S(c._id)} className="sw-task"><span className="sw-task-main"><b>€{S(c.amount)} · {label(S(c.kind))}</b><small>{S(c.reason)}</small></span><span className={`sw-pill ${c.status === "approved" ? "green" : "amber"}`}>{label(S(c.status))}</span></div>)}{!d.credits.length && <p className="nv-caption">No credit requests.</p>}</div>
            </section>
          )}
          <Modal open={coach} onClose={() => setCoach(false)} title="Coaching note" description="Becomes a follow-up task for the supporter with correct visibility.">
            <form onSubmit={async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); await m.mutateAsync({ path: "/team/coaching", body: { ...f, member_id: id } }); setCoach(false); toast.success("Coaching note created"); }}>
              <Field label="Title" name="title" required defaultValue="Coaching follow-up" /><Field label="Note" name="note" type="textarea" /><Field label="Due" name="dueDate" type="date" />
              <div className="nv-modal-footer"><Button onClick={() => setCoach(false)}>Cancel</Button><Button type="submit" primary>Create</Button></div>
            </form>
          </Modal>
        </div>
      )}
    </DataState>
  );
}

/* ---------------- Queue assignments (p110) + Team cases (p111) ---------------- */
type QA = { items: Doc[]; cases: Doc[]; members: { user_id: string; name: string }[] };
function QueueAssignments() {
  const d = useSupport<QA>("/team/queue-assignments");
  const m = useSupportMutation();
  const [q, setQ] = useState("");
  const rows = [...asArray<Doc>(d.data?.items).map((i) => ({ kind: "queue", _id: S(i._id), name: S((i.conversation_id as Doc)?.customerName), email: S((i.conversation_id as Doc)?.customerEmail), source: label(S((i.conversation_id as Doc)?.channel)), status: S(i.status), owner: nameOf(i.owner_id as Person), at: S(i.updatedAt) })), ...asArray<Doc>(d.data?.cases).map((c) => ({ kind: "case", _id: S(c._id), name: S(c.subjectName || c.title), email: S(c.case_code), source: "Case", status: S(c.status), owner: nameOf(c.owner_id as Person), at: S(c.updatedAt) }))].filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="sa-page">
      <Head title="Queue Assignments" description="Assign and rebalance Cases across your team within queue and capacity rules." actions={<Plus2 href="/team/tasks/new" />} />
      <div className="sa-toolbar"><label className="sa-search"><Search size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cases..." /></label><span className="sw-tag">All stages</span><span className="sw-tag">Case sources</span><Link className="sa-chip" href="/team/cases">Case flow</Link></div>
      <section className="sa-panel">
        <div className="sw-row-between"><h3 className="sw-h3">Team assignments</h3><span className="sw-sub">{rows.length} active assignments</span></div>
        <DataState pending={d.isPending} error={d.error} retry={() => d.refetch()}>
          <div className="sl-table">
            <div className="sl-thead st-qa"><span>Case</span><span>Source</span><span>Status</span><span>Last update</span><span>Assigned supporter</span></div>
            {rows.map((r) => (
              <div key={r.kind + r._id} className="sl-trow st-qa"><span className="sh-user"><span className="sw-avatar small">{initials(r.name || "?")}</span><span><b>{r.name}</b><small>{r.email}</small></span></span><span>{r.source}</span><span><span className="sw-pill">{label(r.status)}</span></span><span>{date(r.at)} · {time(r.at)}</span>
                <span><select className="sl-select" value="" onChange={(e) => e.target.value && m.mutate({ path: "/team/assign", body: { kind: r.kind, id: r._id, owner_id: e.target.value, reason: "Teamleader rebalance" } }, { onSuccess: () => toast.success("Reassigned — SLA unchanged") })}><option value="">{r.owner || "Unassigned"}</option>{asArray<{ user_id: string; name: string }>(d.data?.members).map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}</select></span></div>
            ))}
            {!rows.length && <Empty title="Nothing to assign" description="Open queue items and cases appear here." />}
          </div>
        </DataState>
      </section>
    </div>
  );
}
function TeamCases() {
  const d = useSupport<QA>("/team/queue-assignments");
  const cols: [string, string[]][] = [["New · Team", ["new", "open"]], ["Contacted · Team", ["assigned"]], ["Triaged · Team", ["triaged"]], ["Investigation · Team", ["in_progress", "waiting", "reopened"]], ["Resolved / Lost · Team", ["resolved", "closed"]]];
  const cases = asArray<Doc>(d.data?.cases);
  return (
    <div className="sa-page">
      <Head title="Team Cases" description="View and coach every Case across your assigned support team." actions={<Plus2 href="/team/tasks/new" />} />
      <DataState pending={d.isPending} error={d.error} retry={() => d.refetch()}>
        <div className="st-board">
          {cols.map(([l, st]) => {
            const list = cases.filter((c) => st.includes(S(c.status)));
            return (
              <div key={l} className="st-col"><div className="sh-col-head"><span>{l}</span><small>{list.length}</small></div>
                {list.map((c) => <Link key={S(c._id)} href={`/workspace/support/cases/${c._id}`} className="sh-flow-card"><b>{S(c.subjectName || c.title)}</b><small>{S(c.title)}</small><small>Supporter · {nameOf(c.owner_id as Person)}</small><small>{label(S(c.status))}</small></Link>)}
              </div>
            );
          })}
        </div>
      </DataState>
    </div>
  );
}

/* ---------------- Partner portfolios (p112–p114) ---------------- */
type Portfolio = Doc & { name: string; partnerName?: string; partnerRole?: string; customers: number; capacity: number; bonusPerCustomer: number; status: string; primary_id?: Person; secondary_id?: Person; routing?: string; fallback?: string; history?: { at: string; text: string; by: string }[] };
function Portfolios() {
  const d = useSupport<{ items: Portfolio[]; stats: { customers: number; bonus: number; perSupporter: number; review: number } }>("/team/portfolios");
  return (
    <div className="sa-page">
      <Head title="Partner Portfolios" description="Assign Salespartner portfolios to supporters and balance customer ownership." actions={<Button href="/team/portfolios/new">Assign portfolio</Button>} />
      <section className="sa-panel">
        <DataState pending={d.isPending} error={d.error} retry={() => d.refetch()}>
          <div className="sl-table">
            <div className="sl-thead st-port"><span>Salespartner</span><span>Primary supporter</span><span>Customers</span><span>Capacity</span><span>Monthly bonus</span><span>Status</span></div>
            {asArray<Portfolio>(d.data?.items).map((p) => <Link key={p._id} href={`/team/portfolios/${p._id}`} className="sl-trow st-port"><span><b>{p.partnerName}</b><small>{p.partnerRole}</small></span><span><b>{nameOf(p.primary_id)}</b><small>Primary owner</small></span><span>{p.customers}</span><span>{Math.round((p.customers / Math.max(1, p.capacity)) * 100)}%</span><span>€{p.customers * p.bonusPerCustomer}</span><span className={p.status === "healthy" ? "green" : "amber"}>{label(p.status)}</span></Link>)}
            {!asArray(d.data?.items).length && <Empty title="No portfolios yet" description="Assign a Salespartner portfolio to a supporter." action={<Button href="/team/portfolios/new">Assign portfolio</Button>} />}
          </div>
          <div className="sh-strip" style={{ marginTop: 16 }}><div><small>Active customers</small><b>{d.data?.stats.customers ?? 0}</b></div><div><small>Monthly support bonus</small><b>€{d.data?.stats.bonus ?? 0}</b></div><div><small>Cases / supporter</small><b>{d.data?.stats.perSupporter ?? 0}</b></div><div><small>Capacity review</small><b>{d.data?.stats.review ?? 0}</b></div></div>
        </DataState>
      </section>
    </div>
  );
}
function PortfolioDetail({ id }: { id: string }) {
  const p = useSupport<Portfolio>(`/team/portfolios/${id}`);
  const d = p.data;
  return (
    <DataState pending={p.isPending} error={p.error} retry={() => p.refetch()}>
      {d && (
        <div className="sa-page">
          <Link href="/team/portfolios" className="sl-back"><ArrowLeft size={12} /> Back to portfolios</Link>
          <section className="sa-panel st-profile"><span><b>{d.name}</b><small>{d.customers} active customers · €{d.customers * d.bonusPerCustomer} monthly support bonus</small></span><span><small className="sw-cap">Assigned supporter</small><b>{nameOf(d.primary_id)}</b></span><span><small className="sw-cap">Salespartner</small><b>{d.partnerName} · {d.partnerRole}</b></span><span><small className="sw-cap">Customer capacity</small><b>{d.customers} of {d.capacity} · {Math.round((d.customers / d.capacity) * 100)}%</b></span></section>
          <div className="sa-split">
            <section className="sa-panel"><h3 className="sw-h3">Portfolio overview</h3>
              <div className="sa-stats four">{[["Active customers", d.customers], ["Capacity", `${d.capacity}`], ["Bonus / customer", `€${d.bonusPerCustomer}`], ["Monthly bonus", `€${d.customers * d.bonusPerCustomer}`]].map(([l, n]) => <div key={S(l)} className="sa-stat"><small className="sw-cap">{S(l)}</small><b>{S(n)}</b></div>)}</div>
              <h4 className="sl-h4">Responsibility chain</h4>
              <div className="sh-map"><span><small>Salespartner</small><b>{d.partnerName}</b></span><ChevronRight size={14} /><span><small>Portfolio</small><b>{d.customers} customers</b></span><ChevronRight size={14} /><span><small>Primary support</small><b>{nameOf(d.primary_id)}</b></span><ChevronRight size={14} /><span><small>Fallback</small><b>{d.fallback}</b></span></div>
              <h4 className="sl-h4">History</h4><div className="sw-timeline">{asArray<{ at: string; text: string; by: string }>(d.history).map((h, i) => <div key={i}><small>{date(h.at)}</small><span>{h.text} · {h.by}</span></div>)}</div>
            </section>
            <aside className="sa-panel"><h3 className="sw-h3">Portfolio operating rules</h3><p className="sw-sub">Salespartner keeps commercial ownership. Teamleaders manage supporter assignments and capacity.</p>
              <div className="sw-kv"><div><span>Assigned supporter</span><b>{nameOf(d.primary_id)}</b></div><div><span>Secondary</span><b>{nameOf(d.secondary_id) || "—"}</b></div><div><span>Routing mode</span><b>{d.routing}</b></div><div><span>Fallback</span><b>{d.fallback}</b></div></div>
              <p className="sw-sub">No duplicate supporter assignment detected.</p>
            </aside>
          </div>
        </div>
      )}
    </DataState>
  );
}
function NewPortfolio() {
  const members = useSupport<Member[]>("/team/members");
  const m = useSupportMutation();
  const router = useRouter();
  const steps = ["Salespartner", "Customers", "Supporter", "Review"];
  return (
    <div className="sa-page">
      <Link href="/team/portfolios" className="sl-back"><ArrowLeft size={12} /> Back to portfolios</Link>
      <div className="sw-stepper">{steps.map((s, i) => <span key={s} className={i === 0 ? "on" : ""}><i />{s}</span>)}</div>
      <form className="sa-split" onSubmit={async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); const p = await m.mutateAsync({ path: "/team/portfolios", body: f }); toast.success("Portfolio assigned"); router.push(`/team/portfolios/${p._id}`); }}>
        <section className="sa-panel"><h3 className="sw-h3">Configure partner portfolio</h3><p className="sw-sub">Review the partner, customer scope and supporter capacity before assigning.</p>
          <div className="sw-grid2"><Field label="Salespartner" name="partnerName" required placeholder="Daniel Krüger" /><Field label="Role" name="partnerRole" defaultValue="Growth Partner" /></div>
          <Field label="Portfolio name" name="name" required placeholder="Daniel Krüger · Customer Portfolio" />
          <div className="sw-grid2"><Field label="Active customers" name="customers" type="number" required /><Field label="Capacity" name="capacity" type="number" defaultValue={35} /></div>
          <div className="sw-grid2"><Field label="Primary supporter" name="primary_id" options={asArray<Member>(members.data).map((x) => ({ value: x.user_id, label: `${x.name} · ${x.capacity}% load` }))} required /><Field label="Secondary supporter" name="secondary_id" options={asArray<Member>(members.data).map((x) => ({ value: x.user_id, label: x.name }))} /></div>
          <Field label="Bonus per customer (€)" name="bonusPerCustomer" type="number" defaultValue={5} />
        </section>
        <aside className="sa-panel"><h3 className="sw-h3">Portfolio configuration</h3><p className="sw-sub">Assignment becomes active after scope and capacity validation.</p><div className="sw-kv"><div><span>Fallback</span><b>Support Team Queue</b></div><div><span>Validation</span><b>Teamleader · duplicate check</b></div></div>
          <div className="nv-modal-footer"><Button href="/team/portfolios">Cancel</Button><Button type="submit" primary disabled={m.isPending}>Assign portfolio</Button></div></aside>
      </form>
    </div>
  );
}

/* ---------------- Performance (p115) + Credits (p116) ---------------- */
function Performance() {
  const p = useSupport<{ stats: { quality: number; resolved: number; target: number; capacity: number }; trend: { actual: number; target: number }[]; people: (Member & { name: string })[] }>("/team/performance");
  const d = p.data;
  return (
    <div className="sa-page">
      <Head title="Performance & Coaching" description="Review team performance, identify coaching priorities and prepare supporter reviews." actions={<Plus2 href="/team/tasks/new" />} />
      <DataState pending={p.isPending} error={p.error} retry={() => p.refetch()}>
        {d && (
          <>
            <section className="sa-panel">
              <div className="sw-row-between"><div><h3 className="sw-h3">Team performance trend</h3><p className="sw-sub">SLA, resolution quality and active workload compared with the team target.</p></div></div>
              <div className="sa-stats four">{[["Team quality", `${d.stats.quality}%`], ["Resolved · 90 days", d.stats.resolved], ["Target attainment", `${d.stats.target}%`], ["Capacity health", `${d.stats.capacity}%`]].map(([l, n]) => <div key={S(l)} className="sa-stat"><small className="sw-cap">{S(l)}</small><b>{S(n)}</b></div>)}</div>
              <svg viewBox="0 0 600 140" className="sh-spark tall" preserveAspectRatio="none"><polyline fill="none" stroke="#e7ebf5" strokeWidth="2" points={d.trend.map((v, i) => `${(i / 11) * 600},${140 - (v.actual - 70) * 4}`).join(" ")} /><polyline fill="none" stroke="#7d86a0" strokeDasharray="4 4" strokeWidth="1.5" points={d.trend.map((v, i) => `${(i / 11) * 600},${140 - (v.target - 70) * 4}`).join(" ")} /></svg>
            </section>
            <section className="sa-panel"><h3 className="sw-h3">Coaching priorities</h3><p className="sw-sub">Signals that should shape the next coaching sessions.</p>
              <div className="st-grid3">{d.people.map((x) => <div key={x.name} className="st-meter"><span>{x.name}</span><em>{x.sla}% · {x.quality}</em><Bar v={x.quality} tone={x.quality >= 90 ? "green" : "amber"} /></div>)}</div>
              <p className="st-note">Kora · Focus the next review on response speed, evidence quality and capacity. Scores are coaching signals, not employment decisions.</p>
            </section>
          </>
        )}
      </DataState>
    </div>
  );
}
function Credits() {
  const c = useSupport<{ items: Doc[]; limits: Record<string, number>; stats: { members: number; approvedThisMonth: number; pending: number } }>("/team/credits");
  const m = useSupportMutation();
  const decide = (id: string, decision: string) => m.mutate({ path: `/team/credits/${id}/decide`, body: { decision } }, { onSuccess: (r) => toast.success(r.status === "needs_finance" ? "Above your limit — sent to Finance" : `Credit ${label(S(r.status))}`) });
  return (
    <div className="sa-page">
      <Head title="Credits & Approvals" description="Review limited refund and credit requests. Rules remain Admin-managed; final financial decisions remain with Finance." />
      <section className="sa-panel">
        <div className="sh-strip"><div><small>Team members</small><b>{c.data?.stats.members ?? 0}</b></div><div><small>Approved credit amount</small><b>€{c.data?.stats.approvedThisMonth ?? 0}</b></div><div><small>Pending</small><b>{c.data?.stats.pending ?? 0}</b></div><div><small>Limits</small><b>€{c.data?.limits.goodwill}/{c.data?.limits.service_recovery}/{c.data?.limits.refund_exception}</b></div></div>
        <DataState pending={c.isPending} error={c.error} retry={() => c.refetch()}>
          <div className="sl-table">
            <div className="sl-thead st-cred"><span>Supporter</span><span>Request type</span><span>Eligible limit</span><span>Requested</span><span>Customer</span><span>Status</span><span /></div>
            {asArray<Doc>(c.data?.items).map((x) => (
              <div key={S(x._id)} className="sl-trow st-cred"><span className="sh-user"><span className="sw-avatar small">{initials(nameOf(x.requested_by as Person))}</span><span><b>{nameOf(x.requested_by as Person)}</b><small>{S(x.reason).slice(0, 40)}</small></span></span><span>{label(S(x.kind))}</span><span>Up to €{c.data?.limits[S(x.kind)]}</span><span>€{S(x.amount)}</span><span>{S(x.customerName) || "—"}</span><span className={x.status === "approved" ? "green" : "amber"}>{label(S(x.status))}</span>
                <span>{x.status === "pending" ? <span className="sw-actions"><Button onClick={() => decide(S(x._id), "approved")}>Approve</Button><Button onClick={() => decide(S(x._id), "rejected")}>Reject</Button></span> : <MoreHorizontal size={13} />}</span></div>
            ))}
            {!asArray(c.data?.items).length && <Empty title="No credit requests" description="Supporters request credits from the case workspace." />}
          </div>
        </DataState>
        <p className="st-note">Finance validates approved refunds and credits. Teamleaders cannot change thresholds or financial rules.</p>
      </section>
    </div>
  );
}

/* ---------------- Router ---------------- */
export function TeamPage({ parts, search }: { parts: string[]; search: URLSearchParams }) {
  const [section, id, a, b] = parts;
  if (section === "preferences") return <TeamPreferences />;
  if (section === "tasks") return id === "new" ? <CreateTask team /> : id === "day" ? <DayDetail member={a} day={b} /> : <TeamTasks />;
  if (section === "supporters") return id ? <SupporterRecord id={id} tab={search.get("tab") || "overview"} /> : <Supporters />;
  if (section === "queue-assignments") return <QueueAssignments />;
  if (section === "cases") return <TeamCases />;
  if (section === "portfolios") return id === "new" ? <NewPortfolio /> : id ? <PortfolioDetail id={id} /> : <Portfolios />;
  if (section === "performance") return <Performance />;
  if (section === "credits") return <Credits />;
  return <TeamOverview />;
}
