"use client";
// Workspace overview (p49) + Support Hub (p50–p65): Cases, Users/User Record, Escalations, Diagnostics, Quality & SLA.
import { AssistantPage } from "@/components/pages/assistant";
import { useKora } from "@/components/novya/kora";
import { Markdown } from "@/components/novya/markdown";
import { Button, DataState, Empty, Field, Modal } from "@/components/novya/ui";
import api from "@/lib/axios";
import { errorMessage, label } from "@/lib/format";
import { date, supportPath, time, useSupport, useSupportMutation, type Doc } from "@/lib/support";
import { asArray } from "@/lib/utils";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronRight, Plus, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

const S = (v: unknown) => String(v ?? "");
type Person = { _id?: string; name?: string } | string | null | undefined;
const nameOf = (p: Person) => (p && typeof p === "object" ? S(p.name) : "");
const initials = (n: string) => n.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();

function Head({ eyebrow, title, description, actions, crumb }: { eyebrow?: string; title: ReactNode; description: string; actions?: ReactNode; crumb?: ReactNode }) {
  return (
    <div className="sa-head">
      <div>{crumb}{eyebrow && <div className="sh-eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>
      {actions && <div className="sw-actions">{actions}</div>}
    </div>
  );
}
function Strip({ items }: { items: [string, ReactNode, ReactNode?][] }) {
  return (
    <div className="sh-strip">
      {items.map(([l, v, sub]) => <div key={l}><small>{l}</small><b>{v}</b>{sub && <em>{sub}</em>}</div>)}
    </div>
  );
}

/* =============================== WORKSPACE (p49) =============================== */
type HubOverview = { stats: { active: number; slaRisk: number; investigations: number; callbacks: number }; flow: Record<string, Doc[]>; slaPulse: number[]; within: number; koraWatch: Doc[] };
export function WorkspaceOverview() {
  const h = useSupport<HubOverview>("/hub/overview");
  const learn = useSupport<Doc>("/brain/summary");
  const d = h.data;
  const attention = [...asArray<Doc>(d?.flow?.escalated), ...asArray<Doc>(d?.flow?.waiting)].slice(0, 4);
  return (
    <div className="sa-page">
      <Head eyebrow="Support operations" title="Workspace" description="Cases, diagnostics and shared support work. Guides and training live in Learn." actions={<span className="sw-tag">Support Workspace</span>} />
      <DataState pending={h.isPending} error={h.error} retry={() => h.refetch()}>
        {d && (
          <>
            <section className="sa-panel sh-today">
              <div><h3 className="sw-h3">Today in Support</h3><p className="sw-sub">Your current cases, risks and scheduled support work</p></div>
              {[["Active cases", d.stats.active, `${d.flow.new?.length || 0} need attention`], ["SLA risks", d.stats.slaRisk, "Check before breach"], ["Investigations", d.stats.investigations, "Ready for review"], ["Callbacks", d.stats.callbacks, "Scheduled today"]].map(([l, n, s]) => (
                <div key={S(l)} className="sa-stat"><b>{S(n)}</b><span>{S(l)}</span><em className="green">{S(s)}</em></div>
              ))}
            </section>
            <div className="sa-split">
              <section className="sa-panel">
                <h3 className="sw-h3">Current work</h3><p className="sw-sub">Continue priority support work without leaving your workspace.</p>
                <div className="sh-current">
                  {[["Active cases", d.stats.active, "Open conversations", "/workspace/support/cases"], ["Investigations", d.stats.investigations, "Open analyses", "/workspace/support/investigations"], ["Callbacks", d.stats.callbacks, "Scheduled callbacks", "/calendar"], ["Learn", Number(learn.data?.total || 0), "Required modules", "/learn"]].map(([t, n, s, href]) => (
                    <Link key={S(t)} href={S(href)} className="sh-current-card"><div><span className="sp-dot blue" /> <b>{S(t)}</b><em>Open →</em></div><strong>{S(n)}</strong><small>{S(s)}</small></Link>
                  ))}
                </div>
              </section>
              <section className="sa-panel">
                <div className="sw-row-between"><h3 className="sw-h3">Needs attention</h3><span className="sw-tag">{attention.length} items</span></div>
                <div className="sw-tasks">
                  {attention.map((c) => (
                    <Link key={S(c._id)} href={`/workspace/support/cases/${c._id}`} className="sh-attn"><small className="amber">{S(c.priority) === "urgent" ? "SLA" : "Support"}</small><span><b>{S(c.title)}</b><small>{S(c.subjectName)} · {label(S(c.status))}</small></span><em>Open case →</em></Link>
                  ))}
                  {!attention.length && <p className="nv-caption">Nothing needs attention.</p>}
                </div>
              </section>
            </div>
            <section className="sa-panel">
              <h3 className="sw-h3">Workspace tools</h3><p className="sw-sub">Open support tools, evidence and shared documents.</p>
              <div className="sh-tools">
                {[["Support Hub", "Cases, diagnostics and escalations", `${d.stats.active} active cases`, "/workspace/support"], ["Customer Lookup", "Scoped records and customer context", "Search users", "/workspace/support/users"], ["Diagnostics", "Provider checks and sync jobs", "Safe checks", "/workspace/support/diagnostics"], ["Learn", "Courses, guides and runbooks", "Required learning", "/learn"], ["Office", "Docs, sheets and presentations", "Recent files", "/workspace/office"], ["Media", "Screenshots and shared evidence", "Recent files", "/workspace/media"]].map(([t, s, m, href]) => (
                  <Link key={S(t)} href={S(href)} className="sh-tool"><span className="sh-plus"><Plus size={14} /></span><b>{S(t)}</b><small>{S(s)}</small><em>{S(m)}</em><small>Open →</small></Link>
                ))}
              </div>
            </section>
          </>
        )}
      </DataState>
    </div>
  );
}

/* =============================== HUB OVERVIEW (p50) =============================== */
function HubOverviewPage() {
  const h = useSupport<HubOverview>("/hub/overview", true, 30000);
  const d = h.data;
  const cols: [string, string][] = [["new", "New"], ["inProgress", "In progress"], ["waiting", "Waiting"], ["escalated", "Escalated"]];
  return (
    <div className="sa-page">
      <Head title="Support Hub" description="Cases, investigations, diagnostics and support quality in one place." actions={<Button href="/workspace/support/cases">Open cases</Button>} />
      <DataState pending={h.isPending} error={h.error} retry={() => h.refetch()}>
        {d && (
          <>
            <Strip items={[["Active cases", `${d.stats.active} cases`, `${d.flow.new?.length || 0} need attention`], ["SLA risk", `${d.stats.slaRisk} cases`, "Before breach"], ["Investigations", `${d.stats.investigations} open`, "Ready for review"], ["Callbacks", `${d.stats.callbacks} scheduled`, "Today"]]} />
            <section className="sa-panel">
              <div className="sw-row-between"><h3 className="sw-h3">Current case flow</h3><span className="sw-sub">{d.stats.active} active · updated live</span></div>
              <div className="sh-flow">
                {cols.map(([k, l]) => (
                  <div key={k} className="sh-col">
                    <div className="sh-col-head"><span>{l}</span><small>{asArray(d.flow[k]).length}</small></div>
                    {asArray<Doc>(d.flow[k]).slice(0, 3).map((c) => (
                      <Link key={S(c._id)} href={`/workspace/support/cases/${c._id}`} className="sh-flow-card"><b><span className="sp-dot blue" /> {S(c.title)}</b><small>{S(c.subjectName)}</small><em>{label(S(c.priority))} <ChevronRight size={11} /></em></Link>
                    ))}
                  </div>
                ))}
              </div>
            </section>
            <div className="sa-split">
              <section className="sa-panel">
                <div className="sw-row-between"><div><h3 className="sw-h3">SLA pulse</h3><p className="sw-sub">My first response · last 12 hours</p></div><b className="sh-big">{d.within}%</b></div>
                <svg viewBox="0 0 400 90" className="sh-spark" preserveAspectRatio="none"><polyline fill="none" stroke="#c9d3ff" strokeWidth="2" points={d.slaPulse.map((v, i) => `${(i / (d.slaPulse.length - 1)) * 400},${90 - (v - 70) * 3}`).join(" ")} /></svg>
              </section>
              <section className="sa-panel">
                <h3 className="sw-h3">Kora investigation watch</h3><p className="sw-sub">Patterns and evidence from your active cases</p>
                <div className="sw-tasks">
                  {asArray<Doc>(d.koraWatch).map((i) => <Link key={S(i._id)} href={`/assistant/investigations/${i._id}`} className="sh-attn"><span className="sp-dot amber" /><span><b>{S(i.title)}</b><small>{S(i.summary).slice(0, 70)}</small></span><em>Continue →</em></Link>)}
                  {!asArray(d.koraWatch).length && <p className="nv-caption">No open investigations.</p>}
                </div>
              </section>
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}

/* =============================== CASES (p51–p52) =============================== */
type Case = Doc & { case_code: string; title: string; subjectName?: string; status: string; priority: string; summary?: string; waitingReason?: string; owner_id?: Person; sla?: { resolutionDueAt?: string; breached?: boolean }; evidence?: { label: string; kind?: string; ref?: string }[]; conversation_ids?: Doc[]; investigation_id?: Doc | null; escalations?: Doc[]; tasks?: Doc[]; user?: Doc | null; org?: Doc | null; createdAt?: string; updatedAt?: string; resolution?: { summary?: string } };
function CasesPage() {
  const [scope, setScope] = useState<"mine" | "all">("all");
  const [q, setQ] = useState("");
  const [create, setCreate] = useState(false);
  const cases = useSupport<Case[]>(`/cases?status=open${scope === "mine" ? "&mine=true" : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const m = useSupportMutation();
  const router = useRouter();
  return (
    <div className="sa-page">
      <Head title="Active Cases" description="Assigned and recently accepted customer cases across phone, WhatsApp, chat and portal." actions={<>
        <button className={`sa-chip ${scope === "mine" ? "on" : ""}`} onClick={() => setScope(scope === "mine" ? "all" : "mine")}>My cases · {scope === "mine" ? "on" : "off"}</button>
        <label className="sa-search" style={{ minWidth: 200 }}><Search size={12} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cases" /></label>
        <Button onClick={() => setCreate(true)}><Plus size={12} /> New case</Button>
      </>} />
      <DataState pending={cases.isPending} error={cases.error} retry={() => cases.refetch()}>
        <div className="sw-queue-grid">
          {asArray<Case>(cases.data).map((c) => {
            const conv = asArray<Doc>(c.conversation_ids)[0];
            return (
              <div key={c._id} className="sa-panel sw-qcard">
                <div className="sw-qtop"><span className="sw-avatar">{initials(S(conv?.customerName || c.subjectName || "?"))}</span><span><b>{S(conv?.customerName) || c.subjectName}</b><small>{c.subjectName}</small></span><span className={`sw-pill ${c.sla?.breached ? "amber" : "green"}`}>{c.sla?.breached ? "SLA breached" : label(c.priority)}</span></div>
                <div className="sw-qmeta"><small>{c.case_code}</small><small>{label(S(conv?.channel || "case"))}</small></div>
                <div className="sw-cap">Case type</div><b className="sw-b">{c.title}</b><p className="sw-sub">{c.summary}</p>
                <div className="sw-qfoot"><div><small className="sw-cap">{label(c.status)}{c.waitingReason ? ` · ${c.waitingReason}` : ""}</small><small>Assigned · {nameOf(c.owner_id)}</small></div><Link className="sw-link" href={`/workspace/support/cases/${c._id}`}>Open case <ArrowRight size={11} /></Link></div>
              </div>
            );
          })}
          {!asArray(cases.data).length && <Empty title="No open cases" description="Cases you own or your team owns appear here." />}
        </div>
      </DataState>
      <Modal open={create} onClose={() => setCreate(false)} title="New case" description="Create one canonical case for a material customer issue.">
        <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const c = await m.mutateAsync({ path: "/cases", body: Object.fromEntries(f) }); setCreate(false); router.push(`/workspace/support/cases/${c._id}`); }}>
          <Field label="Issue" name="title" required placeholder="Billing correction" />
          <Field label="Organization or customer" name="subjectName" />
          <Field label="Priority" name="priority" defaultValue="medium" options={["low", "medium", "high", "urgent"].map((v) => ({ value: v, label: label(v) }))} />
          <Field label="Summary" name="summary" type="textarea" />
          <div className="nv-modal-footer"><Button onClick={() => setCreate(false)}>Cancel</Button><Button type="submit" primary>Create case</Button></div>
        </form>
      </Modal>
    </div>
  );
}
const NEXT: Record<string, string[]> = { new: ["triaged"], open: ["triaged"], triaged: ["in_progress"], assigned: ["in_progress", "waiting"], in_progress: ["waiting", "resolved"], waiting: ["in_progress", "resolved"], monitoring: ["resolved"], resolved: ["closed", "reopened"], closed: ["reopened"], reopened: ["in_progress"] };
function CaseWorkspace({ id }: { id: string }) {
  const c = useSupport<Case>(`/cases/${id}`);
  const m = useSupportMutation();
  const kora = useKora();
  const router = useRouter();
  const [state, setState] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [esc, setEsc] = useState(false);
  const [credit, setCredit] = useState(false);
  const d = c.data;
  const conv = asArray<Doc>(d?.conversation_ids)[0];
  return (
    <DataState pending={c.isPending} error={c.error} retry={() => c.refetch()}>
      {d && (
        <div className="sa-page">
          <Head crumb={<div className="sl-crumbs">Cases / Active case</div>} title={`${d.subjectName || ""} · ${d.title}`} description={`${d.case_code} · ${label(d.status)} · ${label(d.priority)} priority · owner ${nameOf(d.owner_id)}`} actions={<>
            <Button onClick={() => kora.openChat()}><Sparkles size={12} /> Ask Kora</Button>
            <Button onClick={async () => { const inv = await m.mutateAsync({ path: "/investigations", body: { title: `${d.title} · ${d.subjectName || ""}`, case_id: id } }); router.push(`/assistant/investigations/${inv._id}`); }}>Start investigation</Button>
          </>} />
          <div className="sw-live">
            <section className="sa-panel">
              <h3 className="sw-h3">Recognized person</h3>
              <div className="sw-person"><span className="sw-avatar">{initials(S(d.user?.name || conv?.customerName || d.subjectName))}</span><span><b>{S(d.user?.name || conv?.customerName || "Unlinked")}</b><small>{d.user ? "Linked system user" : "No user linked"}</small></span></div>
              <div className="sw-kv small">
                <div><span>Email</span><b>{S(d.user?.email) || "—"}</b></div>
                <div><span>Organization</span><b>{S(d.org?.name || d.subjectName) || "—"}</b></div>
                <div><span>Customer ID</span><b>{S(d.org?.org_code) || "—"}</b></div>
                <div><span>SLA due</span><b className={d.sla?.breached ? "amber" : ""}>{d.sla?.resolutionDueAt ? `${date(d.sla.resolutionDueAt)} ${time(d.sla.resolutionDueAt)}` : "—"}</b></div>
              </div>
              {d.user && <Button href={`/workspace/support/users/${d.user._id}`}>Open user record</Button>}
            </section>
            <section className="sa-panel sw-transcript-panel">
              <h3 className="sw-h3">Case timeline</h3>
              {d.summary && <div className="sw-summary"><b>Summary</b><p>{d.summary}</p></div>}
              <div className="sw-transcript">
                {asArray<Doc>(conv?.messages).map((msg, k) => <div key={k} className={`sw-msg ${S(msg.from)}`}><small>{S(msg.authorName || msg.from)} · {time(S(msg.at))}</small><p>{S(msg.text)}</p></div>)}
                {asArray<{ label: string; kind?: string }>(d.evidence).map((e, k) => <div key={`e${k}`} className="sw-msg internal"><small>{label(e.kind || "note")}</small><p>{e.label}</p></div>)}
              </div>
              <form className="sw-compose" onSubmit={async (e) => { e.preventDefault(); if (!note.trim()) return; await m.mutateAsync({ path: `/cases/${id}/notes`, body: { text: note } }); setNote(""); }}>
                <textarea className="nv-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal case note…" />
                <div className="sw-row-between"><span className="sw-sub">Customer messages are sent from the live interaction.</span><Button type="submit">Add note</Button></div>
              </form>
            </section>
            <aside className="sa-panel">
              <h3 className="sw-h3">Context actions</h3>
              <p className="sw-sub">Based on case, role and available evidence</p>
              <div className="sw-assist">
                {(NEXT[d.status] || []).map((s) => <button key={s} onClick={() => setState(s)}><span><b>Move to {label(s)}</b><small>State change</small></span><ChevronRight size={12} /></button>)}
                <button onClick={() => setCredit(true)}><span><b>Request credit</b><small>Approval</small></span><ChevronRight size={12} /></button>
                <button onClick={() => setEsc(true)}><span><b>Escalate with evidence</b><small>Handoff</small></span><ChevronRight size={12} /></button>
                <button onClick={() => router.push("/tasks/new")}><span><b>Create follow-up task</b><small>Direct</small></span><ChevronRight size={12} /></button>
              </div>
              <div className="sw-cap" style={{ marginTop: 14 }}>Linked work</div>
              {d.investigation_id && <Link className="sw-link" href={`/assistant/investigations/${S((d.investigation_id as Doc)._id)}`}>Investigation · {S((d.investigation_id as Doc).title)}</Link>}
              {asArray<Doc>(d.escalations).map((e) => <Link key={S(e._id)} className="sw-link" href={`/workspace/support/escalations/${e._id}`}>{S(e.esc_code)} · {label(S(e.state))}</Link>)}
            </aside>
          </div>
          <Modal open={Boolean(state)} onClose={() => setState(null)} title={`Move to ${label(state || "")}`} description="State changes keep actor, reason and previous state. Completing work never resolves a case automatically.">
            <form onSubmit={async (e) => { e.preventDefault(); await m.mutateAsync({ path: `/cases/${id}/state`, body: { status: state, ...Object.fromEntries(new FormData(e.currentTarget)) } }); setState(null); toast.success("Case updated"); }}>
              {state === "waiting" && <Field label="Waiting reason" name="waitingReason" required options={["customer", "internal", "provider", "callback", "approval"].map((v) => ({ value: v, label: label(v) }))} />}
              {state === "resolved" && <><Field label="Resolution summary" name="summary" type="textarea" required /><Field label="Resolution code" name="code" defaultValue="resolved" /></>}
              <Field label="Reason" name="reason" required={state === "reopened"} />
              <div className="nv-modal-footer"><Button onClick={() => setState(null)}>Cancel</Button><Button type="submit" primary>Confirm</Button></div>
            </form>
          </Modal>
          <Modal open={esc} onClose={() => setEsc(false)} title="Escalate with evidence" description="The destination owns its decision; Support keeps customer communication.">
            <form onSubmit={async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); await m.mutateAsync({ path: "/escalations", body: { ...f, case_id: id } }); setEsc(false); toast.success("Escalated"); }}>
              <Field label="Title" name="title" required defaultValue={`${d.title} approval`} />
              <Field label="Target team" name="targetTeam" defaultValue="finance" options={["finance", "engineering", "security", "management"].map((v) => ({ value: v, label: label(v) }))} />
              <Field label="Attempted steps and impact" name="summary" type="textarea" required />
              <div className="nv-modal-footer"><Button onClick={() => setEsc(false)}>Cancel</Button><Button type="submit" primary>Escalate</Button></div>
            </form>
          </Modal>
          <Modal open={credit} onClose={() => setCredit(false)} title="Request credit" description="Your Teamleader decides within delegated limits; larger amounts go to Finance.">
            <form onSubmit={async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); await m.mutateAsync({ path: "/credits", body: { ...f, customerName: d.subjectName } }); setCredit(false); toast.success("Credit request sent"); }}>
              <Field label="Type" name="kind" defaultValue="goodwill" options={[["goodwill", "Goodwill · up to €100"], ["service_recovery", "Service recovery · up to €250"], ["refund_exception", "Refund exception · up to €500"]].map(([v, l]) => ({ value: v, label: l }))} />
              <Field label="Amount (€)" name="amount" type="number" required />
              <Field label="Reason" name="reason" type="textarea" required />
              <div className="nv-modal-footer"><Button onClick={() => setCredit(false)}>Cancel</Button><Button type="submit" primary>Send request</Button></div>
            </form>
          </Modal>
        </div>
      )}
    </DataState>
  );
}

/* =============================== USERS (p53–p57) =============================== */
type UserRow = { _id: string; name: string; email: string; role: string; status: string; verification: string; organization: string | null; createdAt: string };
function UsersPage() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const u = useSupport<{ total: number; items: UserRow[] }>(`/users${term ? `?q=${encodeURIComponent(term)}` : ""}`);
  return (
    <div className="sa-page">
      <Head title="Users" description="Search system-wide identities and open the correct support record." />
      <form className="sa-toolbar" onSubmit={(e) => { e.preventDefault(); setTerm(q); }}>
        <label className="sa-search"><Search size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, user ID" /></label>
        <Button type="submit">Search</Button>
        <span className="sw-sub">Searches are purpose-bound and logged. Results are masked.</span>
      </form>
      <section className="sa-panel">
        <div className="sw-row-between"><h3 className="sw-h3">All users</h3><span className="sw-sub">{u.data?.total ?? "–"} users</span></div>
        <DataState pending={u.isPending} error={u.error} retry={() => u.refetch()}>
          <div className="sl-table">
            <div className="sl-thead sh-users"><span>User</span><span>Status</span><span>Organization</span><span>Account type</span><span>Verification</span><span /></div>
            {asArray<UserRow>(u.data?.items).map((x) => (
              <Link key={x._id} href={`/workspace/support/users/${x._id}`} className="sl-trow sh-users">
                <span className="sh-user"><span className="sw-avatar small">{initials(x.name)}</span><span><b>{x.name}</b><small>{x.email}</small></span></span>
                <span><span className={`sw-pill ${x.status === "active" ? "green" : "amber"}`}>{label(x.status)}</span></span>
                <span>{x.organization || "No organization"}</span>
                <span>{label(x.role)}</span>
                <span>{x.verification}</span>
                <span><ArrowUpRight size={12} /></span>
              </Link>
            ))}
            {!asArray(u.data?.items).length && <Empty title="No users found" description="Try a full email or user ID." />}
          </div>
        </DataState>
      </section>
    </div>
  );
}
type UserRecord = { _id: string; code: string; name: string; email: string; phone: string | null; role: string; status: string; mfa: boolean; verified: boolean; createdAt: string; organizations: Doc[]; cases: Doc[]; sessions: { _id: string; device: string; createdAt: string; active: boolean }[]; activity: { at: string; event: string; category: string; actor: string }[] };
function UserRecordPage({ id, tab }: { id: string; tab: string }) {
  const u = useSupport<UserRecord>(`/users/${id}`);
  const m = useSupportMutation();
  const [problem, setProblem] = useState("");
  const [scan, setScan] = useState<{ text: string; events: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const d = u.data;
  const tabs: [string, string][] = [["overview", "Overview"], ["access", "Access & Security"], ["orgs", "Organizations & Records"], ["activity", "Activity"]];
  const runScan = async () => {
    if (!problem.trim()) return toast.error("Describe the problem first");
    setBusy(true);
    try { setScan((await api.post(supportPath(`/users/${id}/scan`), { problem, hours: 24 })).data.data); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <DataState pending={u.isPending} error={u.error} retry={() => u.refetch()}>
      {d && (
        <div className="sa-page">
          <Link href="/workspace/support/users" className="sl-back"><ArrowLeft size={12} /> Back to Users</Link>
          <div className="sa-head"><div className="sh-record"><span className="sw-avatar big">{initials(d.name)}</span><div><h1>{d.name} <span className={`sw-pill ${d.status === "active" ? "green" : "amber"}`}>{label(d.status)}</span></h1><p>System user · {d.code} · Created {date(d.createdAt)}</p></div></div></div>
          <div className="sl-seg">{tabs.map(([k, l]) => <Link key={k} href={`/workspace/support/users/${id}${k === "overview" ? "" : `?tab=${k}`}`} className={tab === k ? "on" : ""}>{l}</Link>)}</div>
          {tab === "overview" && (
            <div className="sa-split">
              <div className="sw-stack">
                <div className="sa-stats three"><div className="sa-stat"><small className="sw-cap">Account status</small><b>{label(d.status)}</b><span className="green">{d.verified ? "Verified identity" : "Not verified"}</span></div><div className="sa-stat"><small className="sw-cap">Linked organizations</small><b>{d.organizations.length}</b><span>{S(d.organizations[0]?.name)}</span></div><div className="sa-stat"><small className="sw-cap">Cases</small><b>{d.cases.length}</b><span>Support history</span></div></div>
                <section className="sa-panel"><h3 className="sw-h3">Account activity &amp; support history</h3><div className="sw-timeline">{d.activity.slice(0, 8).map((a, i) => <div key={i}><small>{date(a.at)} {time(a.at)}</small><span>{a.event} · {label(a.category)}</span></div>)}{!d.activity.length && <p className="nv-caption">No recorded activity.</p>}</div></section>
              </div>
              <section className="sa-panel"><h3 className="sw-h3">User details</h3><div className="sw-kv"><div><span>Email</span><b>{d.email}</b></div><div><span>Phone</span><b>{d.phone || "—"}</b></div><div><span>Account type</span><b>{label(d.role)}</b></div><div><span>MFA</span><b>{d.mfa ? "Enabled" : "Off"}</b></div></div><p className="sw-sub">Identity fields are masked. Opening this record is logged.</p></section>
            </div>
          )}
          {tab === "access" && (
            <div className="sa-split">
              <div className="sw-stack">
                <div className="sa-stats three"><div className="sa-stat"><small className="sw-cap">Account status</small><b>{label(d.status)}</b></div><div className="sa-stat"><small className="sw-cap">Multi-factor authentication</small><b>{d.mfa ? "Enabled" : "Not enabled"}</b></div><div className="sa-stat"><small className="sw-cap">Active sessions</small><b>{d.sessions.filter((s) => s.active).length}</b></div></div>
                <section className="sa-panel"><h3 className="sw-h3">Active sessions</h3>
                  {d.sessions.map((s) => (
                    <div key={s._id} className="sw-task"><span className="sw-task-main"><b>{s.device}</b><small>Started {date(s.createdAt)} {time(s.createdAt)}</small></span><span className={`sw-pill ${s.active ? "green" : ""}`}>{s.active ? "Active" : "Ended"}</span>
                      {s.active && <Button onClick={() => { const reason = prompt("Reason for revoking this session?"); if (reason) m.mutate({ path: `/users/${id}/revoke-session`, body: { session_id: s._id, reason } }, { onSuccess: () => toast.success("Session revoked and logged") }); }}>Revoke</Button>}
                    </div>
                  ))}
                  {!d.sessions.length && <p className="nv-caption">No sessions.</p>}
                </section>
              </div>
              <section className="sa-panel"><h3 className="sw-h3">Support-safe actions</h3><p className="sw-sub">Sensitive actions require preview or confirmation. Removing MFA, changing roles or merging identities is not available in Support.</p>
                <div className="sw-assist"><button onClick={() => toast.info("Send reset link is requested through the Verify customer identity workflow.")}><span><b>Send recovery link</b><small>Requires verified identity</small></span><ChevronRight size={12} /></button><button onClick={() => toast.info("Select a session on the left to revoke it.")}><span><b>End active session</b><small>Logged with reason</small></span><ChevronRight size={12} /></button></div>
              </section>
            </div>
          )}
          {tab === "orgs" && (
            <div className="sa-split">
              <section className="sa-panel"><h3 className="sw-h3">Linked organization</h3>
                {d.organizations.map((o) => <div key={S(o._id)} className="sw-person"><span className="sw-avatar">{initials(S(o.name))}</span><span><b>{S(o.name)}</b><small>{S(o.org_code)} · {label(S(o.status))} · {S(o.country)}</small></span></div>)}
                {!d.organizations.length && <p className="nv-caption">No organization linked.</p>}
                <h3 className="sw-h3" style={{ marginTop: 20 }}>Identity mapping</h3>
                <div className="sh-map"><span><small>System user</small><b>{d.code}</b></span><ArrowRight size={14} /><span><small>Customer record</small><b>{S(d.organizations[0]?.org_code) || "—"}</b></span><ArrowRight size={14} /><span><small>Match status</small><b className="green">{d.organizations.length ? "Verified" : "None"}</b></span></div>
              </section>
              <section className="sa-panel"><h3 className="sw-h3">Linked records</h3><p className="sw-sub">Records remain in their source systems.</p>{d.cases.map((c) => <Link key={S(c._id)} href={`/workspace/support/cases/${c._id}`} className="sw-link">{S(c.case_code)} · {S(c.title)} · {label(S(c.status))}</Link>)}{!d.cases.length && <p className="nv-caption">No support cases.</p>}</section>
            </div>
          )}
          {tab === "activity" && (
            <div className="sa-split">
              <section className="sa-panel"><h3 className="sw-h3">Activity console</h3><p className="sw-sub">Read-only, authorized events for this user</p>
                <div className="sl-table"><div className="sl-thead sh-act"><span>Time</span><span>Event</span><span>Context</span><span>Status</span></div>
                  {d.activity.map((a, i) => <div key={i} className="sl-trow sh-act"><span>{time(a.at)}</span><span>{a.event}</span><span>{a.actor}</span><span className="green">{label(a.category)}</span></div>)}
                  {!d.activity.length && <Empty title="No events" description="No authorized events in the retained range." />}
                </div>
              </section>
              <aside className="sa-panel"><h3 className="sw-h3">Ask Kora</h3><p className="sw-sub">Describe the user&apos;s problem. Kora searches the authorized events read-only.</p>
                <textarea className="nv-input" rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="The customer cannot sign in after an MFA reset." />
                <Button onClick={runScan} disabled={busy}>{busy ? "Scanning…" : "Quick Scan"}</Button>
                {scan && <div className="sw-summary"><b>Findings · {scan.events} events</b><Markdown text={scan.text} /></div>}
              </aside>
            </div>
          )}
        </div>
      )}
    </DataState>
  );
}

/* =============================== ESCALATIONS (p60–p61) =============================== */
type Esc = Doc & { esc_code: string; title: string; state: string; targetTeam: string; priority: string; summary?: string; decisionDueAt?: string; supportOwner_id?: Person; evidence?: { label: string; ref?: string }[]; timeline?: { at: string; text: string; by: string }[]; requestedDecision?: { title?: string; amount?: number } };
function EscalationsPage() {
  const e = useSupport<Esc[]>("/escalations");
  const list = asArray<Esc>(e.data);
  return (
    <div className="sa-page">
      <Head title="Escalations" description="Track cases handed to another team while Support retains customer communication and case ownership." />
      <Strip items={[["Active", `${list.filter((x) => !["closed", "returned"].includes(x.state)).length} escalations`], ["Responded", `${list.filter((x) => x.state === "decided").length} today`], ["SLA at risk", `${list.filter((x) => x.decisionDueAt && new Date(x.decisionDueAt) < new Date()).length} cases`], ["Handoff health", list.length ? `${Math.round((list.filter((x) => x.state !== "escalated").length / list.length) * 100)}% accepted` : "—"]]} />
      <section className="sa-panel">
        <h3 className="sw-h3">Escalation register</h3>
        <DataState pending={e.isPending} error={e.error} retry={() => e.refetch()}>
          <div className="sl-table">
            <div className="sl-thead sh-esc"><span>Case</span><span>Target</span><span>Owner</span><span>State</span><span>Due</span></div>
            {list.map((x) => (
              <Link key={x._id} href={`/workspace/support/escalations/${x._id}`} className="sl-trow sh-esc"><span><b>{x.title}</b><small>{x.esc_code}</small></span><span>{label(x.targetTeam)}</span><span>{nameOf(x.supportOwner_id)}</span><span className={x.state === "decided" ? "green" : "amber"}>{label(x.state)}</span><span>{x.decisionDueAt ? time(x.decisionDueAt) : "—"}</span></Link>
            ))}
            {!list.length && <Empty title="No escalations" description="Escalate a case with evidence from the case workspace." />}
          </div>
        </DataState>
      </section>
    </div>
  );
}
function EscalationDetail({ id }: { id: string }) {
  const e = useSupport<Esc>(`/escalations/${id}`);
  const m = useSupportMutation();
  const [note, setNote] = useState("");
  const d = e.data;
  return (
    <DataState pending={e.isPending} error={e.error} retry={() => e.refetch()}>
      {d && (
        <div className="sa-page">
          <Head crumb={<div className="sl-crumbs">Escalations / {d.esc_code}</div>} title={d.title} description={`Customer communication remains with ${nameOf(d.supportOwner_id)}`} actions={<Button href="/workspace/support/escalations"><ArrowLeft size={12} /> Escalations</Button>} />
          <Strip items={[["State", label(d.state)], ["Target", label(d.targetTeam)], ["Support owner", nameOf(d.supportOwner_id)], ["Decision due", d.decisionDueAt ? `${date(d.decisionDueAt)} ${time(d.decisionDueAt)}` : "—"], ["Priority", label(d.priority)]]} />
          <div className="sa-split">
            <section className="sa-panel"><h3 className="sw-h3">Escalation case</h3><div className="sw-summary"><b>Issue summary</b><p>{d.summary}</p></div>
              <div className="sw-cap">Evidence</div>{asArray<{ label: string }>(d.evidence).map((x, i) => <p key={i} className="sw-sub">• {x.label}</p>)}
              <div className="sw-cap" style={{ marginTop: 14 }}>Case timeline</div>
              <div className="sw-timeline">{asArray<{ at: string; text: string; by: string }>(d.timeline).map((t, i) => <div key={i}><small>{time(t.at)}</small><span>{t.text} · {t.by}</span></div>)}</div>
            </section>
            <aside className="sa-panel"><h3 className="sw-h3">Decision &amp; handoff</h3><p className="sw-sub">Support customer communication</p>
              {d.requestedDecision?.title && <div className="sw-summary"><b>Requested decision</b><p>{d.requestedDecision.title}{d.requestedDecision.amount ? ` · €${d.requestedDecision.amount}` : ""}</p></div>}
              <form className="sw-compose" onSubmit={async (ev) => { ev.preventDefault(); if (!note.trim()) return; await m.mutateAsync({ path: `/escalations/${id}/note`, body: { text: note } }); setNote(""); }}>
                <textarea className="nv-input" rows={3} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Add evidence or a customer update note" /><Button type="submit">Add to timeline</Button>
              </form>
            </aside>
          </div>
        </div>
      )}
    </DataState>
  );
}

/* =============================== DIAGNOSTICS (p62–p63) =============================== */
type Diag = Doc & { code: string; check: string; target?: string; status: string; result?: string; case_id?: Doc | null; createdAt?: string };
function DiagnosticsPage() {
  const d = useSupport<{ checks: { key: string; name: string; detail: string }[]; runs: Diag[]; today: number; actionNeeded: number }>("/diagnostics");
  const cases = useSupport<Doc[]>("/cases?status=open");
  const m = useSupportMutation<Diag>();
  const router = useRouter();
  const [run, setRun] = useState<string | null>(null);
  return (
    <div className="sa-page">
      <Head eyebrow="Support toolkit" title="Diagnostics" description="Run safe, read-only checks for customer accounts, communication paths and connected systems." actions={<><span className="sw-tag">{d.data?.today ?? 0} today</span><span className="sw-tag">{d.data?.actionNeeded ?? 0} need action</span></>} />
      <section className="sa-panel"><div className="sw-row-between"><div><h3 className="sw-h3">Safe diagnostic checks</h3><p className="sw-sub">Read-only checks for active cases and customer conversations</p></div><span className="sw-pill green">Available</span></div>
        <div className="sh-checks">{asArray<{ key: string; name: string; detail: string }>(d.data?.checks).map((c) => <button key={c.key} className="sh-check" onClick={() => setRun(c.key)}><b><span className="sp-dot blue" /> {c.name}</b><small>{c.detail}</small></button>)}</div>
        <p className="sw-sub">Checks never change customer data. Fixes run through Actions or Workflows.</p>
      </section>
      <section className="sa-panel"><div className="sw-row-between"><h3 className="sw-h3">Recent diagnostics</h3><span className="sw-sub">{asArray(d.data?.runs).length} runs</span></div>
        <DataState pending={d.isPending} error={d.error} retry={() => d.refetch()}>
          <div className="sh-runs">{asArray<Diag>(d.data?.runs).map((r) => <Link key={r._id} href={`/workspace/support/diagnostics/${r._id}`} className="sh-run"><b>{r.code} · {S(r.target) || r.check}</b><small>{r.check}</small><span className={`sw-pill ${r.status === "passed" ? "green" : "amber"}`}>{label(r.status)}</span><small>{S(r.result).slice(0, 80)}</small></Link>)}{!asArray(d.data?.runs).length && <Empty title="No diagnostics yet" description="Run a safe check above." />}</div>
        </DataState>
      </section>
      <Modal open={Boolean(run)} onClose={() => setRun(null)} title="Run diagnostic" description="Read-only. Kora reports evidence, result, confidence and next step.">
        <form onSubmit={async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); const r = await m.mutateAsync({ path: "/diagnostics/run", body: { check: run, ...f } }); setRun(null); router.push(`/workspace/support/diagnostics/${r._id}`); }}>
          <Field label="Linked case" name="case_id" options={asArray<Doc>(cases.data).map((c) => ({ value: S(c._id), label: `${S(c.case_code)} · ${S(c.title)}` }))} />
          <Field label="What should be checked?" name="note" type="textarea" />
          <div className="nv-modal-footer"><Button onClick={() => setRun(null)}>Cancel</Button><Button type="submit" primary disabled={m.isPending}>{m.isPending ? "Running…" : "Run check"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
function DiagnosticDetail({ id }: { id: string }) {
  const d = useSupport<Diag>(`/diagnostics/${id}`);
  const x = d.data;
  return (
    <DataState pending={d.isPending} error={d.error} retry={() => d.refetch()}>
      {x && (
        <div className="sa-page">
          <Head crumb={<div className="sl-crumbs">Diagnostics / {x.code}</div>} title={x.check} description={`${S(x.target)} · ${x.case_id ? `Case ${S((x.case_id as Doc).case_code)}` : "No case linked"} · Read only diagnostic`} actions={<><span className="sw-tag">Read only</span><Button href="/workspace/support/diagnostics"><ArrowLeft size={12} /> Diagnostics</Button></>} />
          <div className="sa-split">
            <section className="sa-panel"><div className="sw-row-between"><h3 className="sw-h3">Diagnostic results</h3><span className={`sw-pill ${x.status === "passed" ? "green" : "amber"}`}>{label(x.status)}</span></div><div className="sp-md sw-result"><Markdown text={S(x.result)} /></div></section>
            <aside className="sa-panel"><h3 className="sw-h3">Next actions</h3><p className="sw-sub">Read only results and safe follow-up actions</p>
              <div className="sw-assist">{x.case_id && <Link href={`/workspace/support/cases/${S((x.case_id as Doc)._id)}`}><span><b>Open linked case</b><small>Add evidence</small></span><ChevronRight size={12} /></Link>}<Link href="/workflows/escalate_developer"><span><b>Developer handoff</b><small>Technical issue</small></span><ChevronRight size={12} /></Link><Link href="/workflows/customer_update"><span><b>Update customer</b><small>Preview first</small></span><ChevronRight size={12} /></Link></div>
            </aside>
          </div>
        </div>
      )}
    </DataState>
  );
}

/* =============================== QUALITY (p64–p65) =============================== */
type Quality = { stats: { firstResponse: number; resolution: number; qualityScore: number | null; csat: number }; reviews: Doc[]; trend: number[]; slaWatch: Doc[] };
function QualityPage() {
  const q = useSupport<Quality>("/quality");
  const d = q.data;
  return (
    <div className="sa-page">
      <Head title="Quality & SLA" description="Monitor service targets, review support quality and act before a case breaches SLA." actions={<Button href="/learn/help/gaps">Review feedback</Button>} />
      <DataState pending={q.isPending} error={q.error} retry={() => q.refetch()}>
        {d && (
          <>
            <Strip items={[["First response", `${d.stats.firstResponse}%`, "Within SLA"], ["Resolution SLA", `${d.stats.resolution}%`, "Cases at risk tracked"], ["Quality score", d.stats.qualityScore != null ? `${d.stats.qualityScore} / 100` : "—", "Reviewed cases"], ["CSAT", `${d.stats.csat} / 5`, "Last 30 days"]]} />
            <section className="sa-panel"><h3 className="sw-h3">Review queue</h3>
              <div className="sh-flow">{(["review", "acknowledged", "coaching"] as const).map((k) => (
                <div key={k} className="sh-col"><div className="sh-col-head"><span>{label(k)}</span><small>{asArray<Doc>(d.reviews).filter((r) => (k === "review" ? !r.acknowledgedAt : k === "acknowledged" ? r.acknowledgedAt : Number(r.total) < 80)).length}</small></div>
                  {asArray<Doc>(d.reviews).filter((r) => (k === "review" ? !r.acknowledgedAt : k === "acknowledged" ? r.acknowledgedAt : Number(r.total) < 80)).slice(0, 3).map((r) => <Link key={S(r._id)} href={`/workspace/support/quality/${r._id}`} className="sh-flow-card"><b>{S((r.conversation_id as Doc)?.subject || "Review")}</b><small>{nameOf(r.agent_id as Person)} · {S(r.total)}/100</small></Link>)}
                </div>
              ))}</div>
              {!asArray(d.reviews).length && <p className="nv-caption">No quality reviews yet.</p>}
            </section>
            <div className="sa-split">
              <section className="sa-panel"><div className="sw-row-between"><div><h3 className="sw-h3">Quality trend</h3><p className="sw-sub">My review score · last 12 weeks</p></div><b className="sh-big">{d.stats.qualityScore ?? "—"}%</b></div>
                <svg viewBox="0 0 400 90" className="sh-spark" preserveAspectRatio="none"><polyline fill="none" stroke="#c9d3ff" strokeWidth="2" points={d.trend.map((v, i) => `${(i / (d.trend.length - 1)) * 400},${90 - (v - 75) * 5}`).join(" ")} /></svg>
              </section>
              <section className="sa-panel"><h3 className="sw-h3">SLA risk watch</h3><p className="sw-sub">Cases requiring first response or resolution</p>
                <div className="sw-tasks">{asArray<Doc>(d.slaWatch).map((c) => <Link key={S(c._id)} href={`/workspace/support/cases/${c._id}`} className="sh-attn"><span className="sp-dot amber" /><span><b>{S(c.title)}</b><small>{S(c.subjectName)} · due {time(S((c.sla as Doc)?.resolutionDueAt))}</small></span><em>Open case →</em></Link>)}</div>
              </section>
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
function QualityDetail({ id }: { id: string }) {
  const q = useSupport<Doc>(`/quality/${id}`);
  const d = q.data;
  const scores = (d?.scores || {}) as Record<string, number>;
  return (
    <DataState pending={q.isPending} error={q.error} retry={() => q.refetch()}>
      {d && (
        <div className="sa-page">
          <Head eyebrow="Quality review" title="Case quality review" description={`${S((d.conversation_id as Doc)?.subject)} · reviewed by ${nameOf(d.reviewer_id as Person) || "Support Quality"}`} actions={<Button href="/workspace/support/quality"><ArrowLeft size={12} /> Quality</Button>} />
          <div className="sa-split">
            <section className="sa-panel"><div className="sw-row-between"><h3 className="sw-h3">Quality scorecard</h3><span className="sw-pill">{S(d.total)} / 100</span></div><div className="sa-stats four">{Object.entries(scores).map(([k, v]) => <div key={k} className="sa-stat"><small className="sw-cap">{label(k)}</small><b>{v}%</b></div>)}</div><div className="sw-summary"><b>Findings &amp; review evidence</b><p>{S(d.notes) || "No notes."}</p></div></section>
            <aside className="sa-panel"><h3 className="sw-h3">Feedback &amp; coaching</h3><p className="sw-sub">Clear feedback without changing the original case.</p><p className="sw-sub">Illustrative scores are not employment decisions.</p></aside>
          </div>
        </div>
      )}
    </DataState>
  );
}

/* =============================== ROUTER =============================== */
export function SupportHubPage({ parts, search }: { parts: string[]; search: URLSearchParams }) {
  const [section, id] = parts;
  if (section === "cases") return id ? <CaseWorkspace id={id} /> : <CasesPage />;
  if (section === "users") return id ? <UserRecordPage id={id} tab={search.get("tab") || "overview"} /> : <UsersPage />;
  if (section === "investigations") return <AssistantPage section="investigations" id={id} search={search} />;
  if (section === "escalations") return id ? <EscalationDetail id={id} /> : <EscalationsPage />;
  if (section === "diagnostics") return id ? <DiagnosticDetail id={id} /> : <DiagnosticsPage />;
  if (section === "quality") return id ? <QualityDetail id={id} /> : <QualityPage />;
  return <HubOverviewPage />;
}
