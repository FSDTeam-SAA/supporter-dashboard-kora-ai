"use client";
// Tasks (p34–p36), Queue + Live Assist (p37–p38), Workflows (p45–p48).
import { useKora } from "@/components/novya/kora";
import { Markdown } from "@/components/novya/markdown";
import { Button, DataState, Empty, Field, Modal } from "@/components/novya/ui";
import api from "@/lib/axios";
import { errorMessage, label } from "@/lib/format";
import { date, supportPath, time, useSupport, useSupportMutation, type Doc } from "@/lib/support";
import { asArray } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, ChevronRight, MoreHorizontal, Plus, Search, Send, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

type Person = { _id: string; name: string } | string | null | undefined;
const nameOf = (p: Person) => (p && typeof p === "object" ? p.name : "");
const S = (v: unknown) => String(v ?? "");

function Head({ title, description, actions, crumb }: { title: string; description: string; actions?: ReactNode; crumb?: ReactNode }) {
  return (
    <div className="sa-head">
      <div>{crumb}<h1>{title}</h1><p>{description}</p></div>
      {actions && <div className="sw-actions">{actions}</div>}
    </div>
  );
}

/* =============================== TASKS =============================== */
type Task = Doc & { title: string; description?: string; status: string; priority: string; dueDate?: string; source?: string; assignee_id?: Person; assignedBy?: Person; subtasks?: { title: string; done: boolean }[]; comments?: { authorName?: string; text: string; at?: string }[]; history?: { status?: string; at?: string; reason?: string }[]; links?: { type: string; ref: string; label: string }[] };
type TaskList = { items: Task[]; stats: { open: number; dueToday: number; overdue: number; completed: number }; sources: { self: number; kora: number; lead: number; system: number } };
const pill = (t: Task) => (t.status === "done" ? "Done" : t.status === "in_progress" ? "In progress" : t.priority === "high" || t.priority === "urgent" ? "High" : t.dueDate && new Date(t.dueDate) > new Date(Date.now() + 86400000) ? "Planned" : label(t.status === "todo" ? "upcoming" : t.status));

export function TasksPage({ id, mine = true }: { id?: string; mine?: boolean }) {
  if (id === "new") return <CreateTask />;
  if (id) return <TaskDetail id={id} />;
  return <MyTasks mine={mine} />;
}

function TaskRow({ t, onToggle }: { t: Task; onToggle: () => void }) {
  return (
    <div className="sw-task">
      <button className={`sw-check ${t.status === "done" ? "on" : ""}`} onClick={onToggle} aria-label="Toggle complete">{t.status === "done" && <Check size={11} />}</button>
      <Link href={`/tasks/${t._id}`} className="sw-task-main">
        <b>{t.title}</b>
        <small>Due {t.dueDate ? `${date(t.dueDate)} ${time(t.dueDate)}` : "—"} · {t.source === "kora" ? "Kora" : nameOf(t.assignedBy) && nameOf(t.assignedBy) !== nameOf(t.assignee_id) ? "Teamleader" : "Self"}</small>
      </Link>
      <span className={`sw-pill ${pill(t) === "High" ? "amber" : ""}`}>{pill(t)}</span>
      <MoreHorizontal size={14} className="sw-faint" />
    </div>
  );
}

function MyTasks({ mine }: { mine: boolean }) {
  const [view, setView] = useState<"today" | "upcoming" | "all" | "completed">("today");
  const [q, setQ] = useState("");
  const kora = useKora();
  const all = useSupport<TaskList>(`/tasks?view=all${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const m = useSupportMutation();
  const items = asArray<Task>(all.data?.items);
  const today = items.filter((t) => t.status !== "done" && t.status !== "cancelled" && t.dueDate && new Date(t.dueDate) <= new Date(new Date().setHours(23, 59, 59)));
  const upcoming = items.filter((t) => t.status !== "done" && t.status !== "cancelled" && (!t.dueDate || new Date(t.dueDate) > new Date(new Date().setHours(23, 59, 59))));
  const list = view === "today" ? today : view === "upcoming" ? upcoming : view === "completed" ? items.filter((t) => t.status === "done") : items;
  const s = all.data?.stats;
  const focus = today[0];
  const toggle = (t: Task) => m.mutate({ path: `/tasks/${t._id}`, method: "patch", body: { status: t.status === "done" ? "todo" : "done" } });
  return (
    <div className="sa-page">
      <Head title="My Tasks" description="Tasks you created, received or asked Kora to plan for you." actions={<><span className="sw-tag">Personal workspace</span>{!mine && null}<Button href="/tasks/new"><Plus size={13} /> New task</Button></>} />
      <div className="sa-stats four">
        <div className="sa-stat"><small className="sw-cap">Open</small><b>{s?.open ?? "–"}</b><span>Across your current priorities</span></div>
        <div className="sa-stat"><small className="sw-cap">Due today</small><b>{s?.dueToday ?? "–"}</b><span className="amber">{s?.dueToday ? `${s.dueToday} need attention` : "Nothing due"}</span></div>
        <div className="sa-stat"><small className="sw-cap">Overdue</small><b>{s?.overdue ?? "–"}</b><span className="red">{s?.overdue ? "Needs follow-up" : "All on time"}</span></div>
        <div className="sa-stat"><small className="sw-cap">Completed</small><b>{s?.completed ?? "–"}</b><span className="green">This week</span></div>
      </div>
      <div className="sa-toolbar">
        {(["today", "upcoming", "all", "completed"] as const).map((v) => <button key={v} className={`sa-chip ${view === v ? "on" : ""}`} onClick={() => setView(v)}>{label(v)}</button>)}
        <label className="sa-search" style={{ maxWidth: 280 }}><Search size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks or linked records" /></label>
      </div>
      <DataState pending={all.isPending} error={all.error} retry={() => all.refetch()}>
        <div className="sa-split">
          <section className="sa-panel">
            {view === "today" ? (
              <>
                <h3 className="sw-h3">Today</h3><p className="sw-sub">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {today.length} open tasks</p>
                <div className="sw-tasks">{today.map((t) => <TaskRow key={t._id} t={t} onToggle={() => toggle(t)} />)}{!today.length && <p className="nv-caption">Nothing due today.</p>}</div>
                <h3 className="sw-h3" style={{ marginTop: 22 }}>Upcoming</h3>
                <div className="sw-tasks">{upcoming.slice(0, 6).map((t) => <TaskRow key={t._id} t={t} onToggle={() => toggle(t)} />)}</div>
              </>
            ) : (
              <div className="sw-tasks">{list.map((t) => <TaskRow key={t._id} t={t} onToggle={() => toggle(t)} />)}{!list.length && <Empty title="No tasks" description="Create a task or ask Kora to plan one." />}</div>
            )}
          </section>
          <aside className="sw-stack">
            <section className="sa-panel">
              <h3 className="sw-h3">Today&apos;s focus</h3>
              <p className="sw-sub">{today.filter((t) => t.status === "done").length} of {today.length} tasks completed</p>
              <div className="sw-bar"><i style={{ width: `${today.length ? 100 - (today.length / Math.max(1, items.length)) * 100 : 100}%` }} /></div>
              {focus && <><div className="sw-cap" style={{ marginTop: 16 }}>Next best action</div><b className="sw-b">{focus.title}</b><p className="sw-sub">Kora linked the latest records and context for this task.</p></>}
              <Button onClick={() => kora.openChat()}>Open with Kora</Button>
            </section>
            <section className="sa-panel">
              <h3 className="sw-h3">Task sources</h3><p className="sw-sub">Everything in My Tasks belongs to you.</p>
              <div className="sw-sources">
                <div><span>Created by you</span><b>{all.data?.sources.self ?? 0}</b></div>
                <div><span className="green">Created with Kora</span><b>{all.data?.sources.kora ?? 0}</b></div>
                <div><span className="amber">Assigned by Teamleader</span><b>{all.data?.sources.lead ?? 0}</b></div>
                <div><span>System &amp; learning</span><b>{all.data?.sources.system ?? 0}</b></div>
              </div>
            </section>
          </aside>
        </div>
      </DataState>
    </div>
  );
}

function TaskDetail({ id }: { id: string }) {
  const t = useSupport<Task>(`/tasks/${id}`);
  const m = useSupportMutation();
  const kora = useKora();
  const [note, setNote] = useState("");
  const [defer, setDefer] = useState(false);
  const d = t.data;
  const patch = (body: object) => m.mutate({ path: `/tasks/${id}`, method: "patch", body });
  return (
    <DataState pending={t.isPending} error={t.error} retry={() => t.refetch()}>
      {d && (
        <div className="sa-page">
          <Head
            crumb={<Link href="/tasks" className="sl-back"><ArrowLeft size={12} /> Back to My Tasks</Link>}
            title={d.title}
            description={`Personal task · ${nameOf(d.assignedBy) === nameOf(d.assignee_id) ? "Created by you" : `Assigned by ${nameOf(d.assignedBy)}`} · Updated ${date(S(d.updatedAt))}`}
            actions={<>{d.status !== "done" ? <Button onClick={() => patch({ status: "done" })}><Check size={12} /> Mark complete</Button> : <Button onClick={() => patch({ status: "todo", reason: "Reopened" })}>Reopen</Button>}<Button onClick={() => setDefer(true)}>More</Button></>}
          />
          <div className="sa-split">
            <section className="sa-panel">
              <h3 className="sw-h3">Task overview</h3>
              <p className="sw-sub">{d.description || "No description."}</p>
              {asArray(d.links).length > 0 && <div className="sw-kv">{d.links!.map((l, i) => <div key={i}><span>{label(l.type)}</span><b>{l.label}</b></div>)}</div>}
              <h3 className="sw-h3" style={{ marginTop: 20 }}>Checklist</h3>
              <div className="sw-tasks">
                {asArray<{ title: string; done: boolean }>(d.subtasks).map((s, i) => (
                  <button key={i} className="sw-task" onClick={() => patch({ subtasks: d.subtasks!.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}>
                    <span className={`sw-check ${s.done ? "on" : ""}`}>{s.done && <Check size={11} />}</span><span className="sw-task-main"><b>{s.title}</b></span>
                  </button>
                ))}
                <form className="sw-inline" onSubmit={(e) => { e.preventDefault(); const v = S(new FormData(e.currentTarget).get("s")).trim(); if (v) patch({ subtasks: [...asArray(d.subtasks), { title: v, done: false }] }); e.currentTarget.reset(); }}>
                  <input className="nv-input" name="s" placeholder="+ Add checklist item" />
                </form>
              </div>
              <h3 className="sw-h3" style={{ marginTop: 20 }}>Notes &amp; activity</h3>
              <div className="sw-timeline">
                {[...asArray<{ authorName?: string; text: string; at?: string }>(d.comments).map((c) => ({ at: c.at, text: `${c.authorName}: ${c.text}` })), ...asArray<{ status?: string; at?: string; reason?: string }>(d.history).map((h) => ({ at: h.at, text: `${label(h.status)}${h.reason ? ` · ${h.reason}` : ""}` }))]
                  .sort((a, b) => new Date(S(b.at)).getTime() - new Date(S(a.at)).getTime())
                  .map((x, i) => <div key={i}><small>{date(x.at)} {time(x.at)}</small><span>{x.text}</span></div>)}
              </div>
              <form className="sw-inline" onSubmit={(e) => { e.preventDefault(); if (note.trim()) { patch({ comment: note }); setNote(""); } }}>
                <input className="nv-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
                <Button type="submit">Add</Button>
              </form>
            </section>
            <aside className="sw-stack">
              <section className="sa-panel">
                <h3 className="sw-h3">Details</h3>
                <div className="sw-kv">
                  <div><span>Status</span><b>{label(d.status)}</b></div>
                  <div><span>Priority</span><b className={d.priority === "high" || d.priority === "urgent" ? "amber" : ""}>{label(d.priority)}</b></div>
                  <div><span>Due</span><b className="amber">{d.dueDate ? `${date(d.dueDate)} · ${time(d.dueDate)}` : "—"}</b></div>
                  <div><span>Owner</span><b>{nameOf(d.assignee_id)}</b></div>
                  <div><span>Source</span><b>{d.source === "kora" ? "Created with Kora" : "Created manually"}</b></div>
                </div>
              </section>
              <section className="sa-panel">
                <h3 className="sw-h3">Work on this with Kora</h3>
                <p className="sw-sub">Kora already has the linked context of this task.</p>
                <div className="sw-chips">{["Review resolution", "Prepare customer update", "Reschedule callback"].map((x) => <button key={x} onClick={() => kora.openChat()}>{x}</button>)}</div>
              </section>
            </aside>
          </div>
          <Modal open={defer} onClose={() => setDefer(false)} title="Change task" description="Deferring keeps the original commitment visible.">
            <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); patch({ status: f.get("status"), dueDate: f.get("dueDate") || undefined, reason: f.get("reason") }); setDefer(false); }}>
              <Field label="Status" name="status" defaultValue="deferred" options={["in_progress", "blocked", "deferred", "cancelled"].map((v) => ({ value: v, label: label(v) }))} />
              <Field label="New due date" name="dueDate" type="datetime-local" />
              <Field label="Reason" name="reason" />
              <div className="nv-modal-footer"><Button onClick={() => setDefer(false)}>Cancel</Button><Button type="submit" primary>Save</Button></div>
            </form>
          </Modal>
        </div>
      )}
    </DataState>
  );
}

export function CreateTask({ team = false }: { team?: boolean }) {
  const router = useRouter();
  const m = useSupportMutation();
  const ctx = useSupport<{ members: { user_id: string; name: string }[]; name: string }>("/context");
  const [kora, setKora] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ title?: string; description?: string }>({});
  const generate = async () => {
    if (!kora.trim()) return;
    setBusy(true);
    try {
      const c = (await api.post(supportPath("/chat"), { message: `Turn this into a single task. Reply exactly as two lines: "Title: …" and "Description: …". Request: ${kora}` })).data.data;
      const reply: string = c.messages.at(-1).content;
      setDraft({ title: /Title:\s*(.+)/i.exec(reply)?.[1]?.replace(/\*/g, "").trim(), description: /Description:\s*([\s\S]+)/i.exec(reply)?.[1]?.replace(/\*/g, "").trim() });
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <div className="sa-page">
      <Head crumb={<Link href={team ? "/team/tasks" : "/tasks"} className="sl-back"><ArrowLeft size={12} /> Back to {team ? "Team Tasks" : "My Tasks"}</Link>} title={team ? "Create & assign task" : "Create personal task"} description={team ? "Create a task for yourself or assign it to members of your support team." : "Add a task for yourself or let Kora prepare it from context."} />
      <div className="sa-split">
        <form className="sa-panel" key={draft.title || "empty"} onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const t = await m.mutateAsync({ path: "/tasks", body: { title: f.get("title"), description: f.get("description"), dueDate: f.get("dueDate") || undefined, priority: f.get("priority"), assignee_id: f.get("assignee") || undefined, source: draft.title ? "kora" : "manual", links: f.get("context") ? [{ type: "context", ref: S(f.get("context")), label: S(f.get("context")) }] : [] } });
          toast.success("Task created");
          router.push(team ? "/team/tasks" : `/tasks/${t._id}`);
        }}>
          <h3 className="sw-h3">Task setup</h3>
          <Field label="Title" name="title" required defaultValue={draft.title} placeholder="Add a clear task title" />
          <Field label="Description" name="description" type="textarea" defaultValue={draft.description} placeholder="Add details, expected outcome or instructions" />
          <div className="sw-grid2">
            <Field label="Due date" name="dueDate" type="datetime-local" />
            <Field label="Priority" name="priority" defaultValue="medium" options={["low", "medium", "high", "urgent"].map((v) => ({ value: v, label: label(v) }))} />
          </div>
          <Field label="Linked context" name="context" placeholder="Add organization, case or conversation" />
          {team ? (
            <Field label="Owner" name="assignee" options={[{ value: "", label: `${ctx.data?.name || "Me"} (you)` }, ...asArray<{ user_id: string; name: string }>(ctx.data?.members).map((x) => ({ value: x.user_id, label: x.name }))]} />
          ) : (
            <div className="sw-owner"><span className="nv-avatar small" /> <b>{ctx.data?.name} · You</b><small>Personal tasks can only be assigned to yourself.</small></div>
          )}
          <div className="nv-modal-footer"><Button href={team ? "/team/tasks" : "/tasks"}>Cancel</Button><Button type="submit" primary disabled={m.isPending}>{team ? "Create & assign" : "Create task"}</Button></div>
        </form>
        <aside className="sw-stack">
          <section className="sa-panel">
            <h3 className="sw-h3">Create with Kora</h3>
            <p className="sw-sub">Describe the outcome. Kora can suggest the title, due date, checklist and links.</p>
            <textarea className="nv-input" rows={4} value={kora} onChange={(e) => setKora(e.target.value)} placeholder="Prepare a customer callback task for Helio Systems" />
            <Button onClick={generate} disabled={busy}>{busy ? "Generating…" : <><Sparkles size={12} /> Generate task draft</>}</Button>
          </section>
          <section className="sa-panel">
            <h3 className="sw-h3">{team ? "Team assignment rules" : "How personal tasks work"}</h3>
            <ul className="sw-rules">{(team ? ["Assigned team members see the task in My Tasks.", "Kora can prepare a draft when you ask.", "You can reassign tasks within your own team.", "Every task keeps its creator and source visible."] : ["You remain the owner of every task here.", "Kora only creates tasks when you ask.", "Teamleader assignments appear automatically.", "Workflow tasks keep their original source."]).map((x) => <li key={x}>{x}</li>)}</ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* =============================== QUEUE =============================== */
type Conv = { _id: string; customerName?: string; customerEmail?: string; channel?: string; subject?: string; category?: string; priority?: string; koraSummary?: string; messages?: { from: string; authorName?: string; text: string; at?: string }[] };
type QItem = Doc & { status: string; slaDueAt?: string; owner_id?: Person; queue_id?: { name?: string } | string; conversation_id?: Conv; recognition?: { recognized: boolean; user?: { name: string; email: string }; org?: { name: string; org_code?: string; status?: string } }; case_id?: { _id: string; case_code: string; title: string; status: string } | string; recentCases?: { case_code: string; title: string; status: string }[]; history?: { at: string; status: string; reason?: string }[] };
const mins = (d?: string) => (d ? Math.round((Date.now() - new Date(d).getTime()) / 60000) : 0);

export function QueuePage({ id }: { id?: string }) {
  return id ? <LiveAssist id={id} /> : <QueueList />;
}

function QueueList() {
  const q = useSupport<QItem[]>("/queue", true, 15000);
  const [channel, setChannel] = useState("all");
  const items = asArray<QItem>(q.data).filter((i) => channel === "all" || i.conversation_id?.channel === channel);
  return (
    <div className="sa-page">
      <Head title="Support Queue" description="Active customer conversations assigned across phone, WhatsApp, chat and portal." actions={<>
        <span className="sw-tag">All active · {asArray(q.data).length}</span>
        <select className="sl-select" value={channel} onChange={(e) => setChannel(e.target.value)}>{["all", "phone", "whatsapp", "chat", "portal", "email"].map((c) => <option key={c} value={c}>{c === "all" ? "All channels" : label(c)}</option>)}</select>
        <span className="sw-tag">Sort: longest waiting</span>
      </>} />
      <DataState pending={q.isPending} error={q.error} retry={() => q.refetch()}>
        <div className="sw-queue-grid">
          {items.map((i) => {
            const c = i.conversation_id;
            const rec = i.recognition?.recognized;
            const waiting = mins(S(c?.messages?.[0]?.at || i.createdAt));
            return (
              <div key={i._id} className="sa-panel sw-qcard">
                <div className="sw-qtop">
                  <span className="sw-avatar">{S(c?.customerName).split(" ").map((x) => x[0]).join("").slice(0, 2) || "?"}</span>
                  <span><b>{c?.customerName || "Unknown caller"}</b><small>{i.recognition?.org?.name || (rec ? i.recognition?.user?.email : "No organization linked")}</small></span>
                  <span className={`sw-pill ${rec ? "green" : "amber"}`}>{rec ? "Recognized" : "Unknown"}</span>
                </div>
                <div className="sw-qmeta"><small>{rec ? "Matched by email · verified" : "Identity not verified"}</small><small>{label(c?.channel)}</small></div>
                <div className="sw-cap">Current intent</div>
                <b className="sw-b">{c?.subject}</b>
                <p className="sw-sub">{c?.messages?.at(-1)?.text}</p>
                <div className="sw-qfoot">
                  <div><small className="sw-cap">{i.status === "active" ? `Live ${c?.channel === "phone" ? "call" : "chat"} · ${waiting} min` : `Waiting · ${waiting} min`}</small><small>{nameOf(i.owner_id) ? `Assigned · ${nameOf(i.owner_id)}` : "Unassigned"}</small></div>
                  <Link href={`/queue/${i._id}`} className="sw-link">Open Live Assist <ArrowRight size={11} /></Link>
                </div>
              </div>
            );
          })}
          {!items.length && <Empty title="Queue is clear" description="New customer interactions appear here in real time." />}
        </div>
      </DataState>
    </div>
  );
}

function LiveAssist({ id }: { id: string }) {
  const { data: session } = useSession();
  const q = useSupport<QItem>(`/queue/${id}`, true, 10000);
  const m = useSupportMutation();
  const qc = useQueryClient();
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [kora, setKora] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const i = q.data;
  const c = i?.conversation_id;
  const mineNow = i && nameOf(i.owner_id) === session?.user?.name;
  const askKora = async () => {
    setBusy(true);
    try { setKora((await api.post(supportPath(`/queue/${id}/kora`), {})).data.data.text); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const send = async (internal = false) => {
    if (!reply.trim()) return;
    await m.mutateAsync({ path: `/queue/${id}/reply`, body: { text: reply, internal } });
    setReply("");
    qc.invalidateQueries({ queryKey: ["support", `/queue/${id}`] });
  };
  const caseRef = i && typeof i.case_id === "object" ? i.case_id : null;
  return (
    <DataState pending={q.isPending} error={q.error} retry={() => q.refetch()}>
      {i && c && (
        <div className="sa-page">
          <Head crumb={<div className="sl-crumbs">Queue / Active conversation</div>} title={`${c.customerName} · Live ${c.channel === "phone" ? "call" : label(c.channel)}`} description={`${i.recognition?.recognized ? `Recognized by email · ${i.recognition?.org?.name || ""}` : "Unknown caller · verify identity first"} · ${mins(S(c.messages?.[0]?.at))} min`}
            actions={<>
              {caseRef ? <Button href={`/workspace/support/cases/${caseRef._id}`}>Customer record · {caseRef.case_code}</Button> : <Button onClick={() => m.mutate({ path: `/queue/${id}/case`, body: {} }, { onSuccess: () => toast.success("Case created and linked") })}>Create case</Button>}
              {!mineNow && i.status !== "completed" && <Button primary onClick={() => m.mutate({ path: `/queue/${id}/accept` }, { onSuccess: () => toast.success("You now own this interaction") })}>Accept</Button>}
            </>} />
          <div className="sw-live">
            <section className="sa-panel">
              <h3 className="sw-h3">Recognized person</h3>
              <div className="sw-person"><span className="sw-avatar">{S(c.customerName).split(" ").map((x) => x[0]).join("").slice(0, 2)}</span><span><b>{c.customerName}</b><small>{i.recognition?.recognized ? "Owner · Active customer" : "Not verified"}</small></span></div>
              <div className="sw-kv small">
                <div><span>Email</span><b>{i.recognition?.user?.email || "—"}</b></div>
                <div><span>Organization</span><b>{i.recognition?.org?.name || "—"}</b></div>
                <div><span>Customer ID</span><b>{i.recognition?.org?.org_code || "—"}</b></div>
                <div><span>Channel</span><b>{label(c.channel)}</b></div>
                <div><span>Queue</span><b>{typeof i.queue_id === "object" ? i.queue_id?.name : ""}</b></div>
              </div>
              <div className="sw-cap" style={{ marginTop: 14 }}>Recent cases</div>
              {asArray<{ case_code: string; title: string; status: string }>(i.recentCases).map((r) => <p key={r.case_code} className="sw-sub">{r.case_code} · {r.title} · {label(r.status)}</p>)}
              {!asArray(i.recentCases).length && <p className="sw-sub">No previous cases.</p>}
            </section>
            <section className="sa-panel sw-transcript-panel">
              <div className="sw-row-between"><h3 className="sw-h3">Live interaction</h3><span className="sw-pill">{label(c.channel)} · {label(i.status)}</span></div>
              {c.koraSummary && <div className="sw-summary"><b>Kora live summary</b><Markdown text={c.koraSummary} /></div>}
              <div className="sw-transcript">
                {asArray<{ from: string; authorName?: string; text: string; at?: string }>(c.messages).map((msg, k) => (
                  <div key={k} className={`sw-msg ${msg.from}`}><small>{msg.authorName || label(msg.from)} · {time(msg.at)}</small><p>{msg.text}</p></div>
                ))}
              </div>
              <form className="sw-compose" onSubmit={(e) => { e.preventDefault(); send(false); }}>
                <textarea className="nv-input" rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={mineNow ? "Write a reply or ask Kora…" : "Accept the interaction to reply"} disabled={!mineNow} />
                <div className="sw-row-between">
                  <span className="sw-chips"><button type="button" onClick={() => send(true)} disabled={!mineNow}>Internal note</button><button type="button" onClick={askKora} disabled={busy}>{busy ? "Kora…" : "Suggested reply"}</button></span>
                  <Button type="submit" primary disabled={!mineNow}><Send size={12} /> Send</Button>
                </div>
              </form>
            </section>
            <aside className="sa-panel">
              <h3 className="sw-h3">Live Assist</h3>
              <p className="sw-sub">Next best actions within your permissions</p>
              {kora && <div className="sw-summary"><Markdown text={kora} /></div>}
              <div className="sw-assist">
                {[
                  ["Start billing investigation", "Verify invoice and recent history", () => router.push("/assistant/investigations")],
                  ["Request Finance approval", "Approval", () => router.push("/workflows/billing_review")],
                  ["Create follow-up task", "Direct", () => router.push("/tasks/new")],
                  ["Transfer to colleague", "Handover", () => setTransfer(true)],
                  ["Draft reply with Kora", "Preview", askKora],
                  ["Complete interaction", "Case stays open", () => m.mutate({ path: `/queue/${id}/complete`, body: { outcome: "Handled" } }, { onSuccess: () => { toast.success("Interaction completed — the case remains open"); router.push("/queue"); } })],
                ].map(([t, s, fn]) => (
                  <button key={S(t)} onClick={fn as () => void}><span><b>{S(t)}</b><small>{S(s)}</small></span><ChevronRight size={12} /></button>
                ))}
              </div>
              <div className="sw-cap" style={{ marginTop: 14 }}>Secure impersonation</div>
              <p className="sw-sub">Requires reason, customer consent and Teamleader approval. Use the Workflows library to request it.</p>
            </aside>
          </div>
          <Modal open={transfer} onClose={() => setTransfer(false)} title="Transfer interaction" description="The next owner receives the full context; SLA is not reset.">
            <form onSubmit={async (e) => { e.preventDefault(); await m.mutateAsync({ path: `/queue/${id}/transfer`, body: { reason: new FormData(e.currentTarget).get("reason") } }); setTransfer(false); router.push("/queue"); }}>
              <Field label="Reason" name="reason" required placeholder="Needs billing specialist" />
              <div className="nv-modal-footer"><Button onClick={() => setTransfer(false)}>Cancel</Button><Button type="submit" primary>Transfer to queue</Button></div>
            </form>
          </Modal>
        </div>
      )}
    </DataState>
  );
}

/* =============================== WORKFLOWS =============================== */
type WfGroup = { group: string; items: { key: string; letter: string; name: string; description: string }[] };
type Run = Doc & { name: string; status: string; template_key: string; input?: Record<string, string>; result?: { created?: { type: string; ref: string; label: string }[]; error?: string }; impact?: { group?: string; summary?: string }; createdAt?: string; updatedAt?: string; completedAt?: string };

export function WorkflowsPage({ id }: { id?: string }) {
  if (id === "activity") return <WorkflowActivity />;
  if (id) return <WorkflowRun keyName={id} />;
  return <WorkflowLibrary />;
}
function WfTabs({ active }: { active: "start" | "activity" }) {
  return (
    <div className="sl-seg">
      <Link href="/workflows" className={active === "start" ? "on" : ""}>Start workflows</Link>
      <Link href="/workflows/activity" className={active === "activity" ? "on" : ""}>Activity</Link>
    </div>
  );
}
function WorkflowLibrary() {
  const lib = useSupport<WfGroup[]>("/workflows");
  return (
    <div className="sa-page">
      <Head title="Workflows" description="Start guided support and resolution processes without leaving your workspace." actions={<WfTabs active="start" />} />
      <DataState pending={lib.isPending} error={lib.error} retry={() => lib.refetch()}>
        {asArray<WfGroup>(lib.data).map((g) => (
          <div key={g.group}>
            <h3 className="sw-group">{g.group}</h3>
            <div className="sw-wf-grid">
              {g.items.map((w) => (
                <Link key={w.key} href={`/workflows/${w.key}`} className="sw-wf">
                  <span className="sw-letter">{w.letter}</span>
                  <span><b>{w.name}</b><small>{w.description}</small></span>
                  <ChevronRight size={13} />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </DataState>
    </div>
  );
}
function WorkflowActivity() {
  const runs = useSupport<Run[]>("/runs");
  const [q, setQ] = useState("");
  const list = asArray<Run>(runs.data).filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="sa-page">
      <Head title="Workflows" description="Review recent support workflows and continue unresolved cases or handovers." actions={<WfTabs active="activity" />} />
      <section className="sa-panel">
        <div className="sa-toolbar"><label className="sa-search"><Search size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search workflows..." /></label></div>
        <div className="sw-cap">Recent workflows · {list.length} total</div>
        <div className="sl-table">
          <div className="sl-thead sw-runs"><span>Workflow</span><span>Status</span><span>Type</span><span>Updated</span><span>Current step</span><span>Linked</span></div>
          {list.map((r) => (
            <div key={r._id} className="sl-trow sw-runs">
              <span><b>{r.name}</b></span>
              <span className={r.status === "completed" ? "green" : r.status === "review" ? "amber" : ""}>{label(r.status === "review" ? "waiting" : r.status)}</span>
              <span>{r.impact?.group || "Support"}</span>
              <span>{date(r.updatedAt)} · {time(r.updatedAt)}</span>
              <span>{r.status === "review" ? "Confirm preview" : r.status === "completed" ? "Finished" : label(r.status)}</span>
              <span>{r.result?.created?.[0]?.label || "—"}</span>
            </div>
          ))}
          {!list.length && <Empty title="No workflow runs yet" description="Start a workflow from the library." />}
        </div>
      </section>
    </div>
  );
}
const FIELDS: Record<string, [string, string, string?][]> = {
  verify_identity: [["customer", "Customer"], ["organization", "Organization"], ["email", "Email used for verification"], ["notes", "Verification notes", "textarea"]],
  callback: [["title", "Callback title"], ["customer", "Customer"], ["startsAt", "Time", "datetime-local"], ["notes", "Context", "textarea"]],
  schedule_callback: [["title", "Callback title"], ["customer", "Customer"], ["startsAt", "Time", "datetime-local"], ["notes", "Context", "textarea"]],
  block_time: [["title", "Reason"], ["startsAt", "Start", "datetime-local"], ["notes", "Notes", "textarea"]],
  service_credit: [["customer", "Customer"], ["amount", "Amount (€)", "number"], ["notes", "Reason", "textarea"]],
};
function WorkflowRun({ keyName }: { keyName: string }) {
  const lib = useSupport<WfGroup[]>("/workflows");
  const m = useSupportMutation<Run>();
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<Record<string, string>>({});
  const [run, setRun] = useState<Run | null>(null);
  const wf = asArray<WfGroup>(lib.data).flatMap((g) => g.items.map((i) => ({ ...i, group: g.group }))).find((w) => w.key === keyName);
  const fields = FIELDS[keyName] || [["title", "Title"], ["customer", "Customer or case"], ["notes", "Details", "textarea"]];
  const steps = ["Context", keyName === "verify_identity" ? "Verification" : "Details", "Review"];
  if (run?.status === "completed")
    return (
      <div className="sa-page">
        <Head crumb={<div className="sl-crumbs">Workflows / Support</div>} title={keyName === "verify_identity" ? "Identity verified" : `${wf?.name} completed`} description="The workflow is complete and the linked records are saved." actions={<Button href="/workflows">Workflows</Button>} />
        <section className="sa-panel sw-done"><span className="sl-check"><Check size={26} /></span><b>{keyName === "verify_identity" ? `${input.customer || "Customer"} was verified` : run.name}</b><small>{run.run_code as string} · Completed today at {time(run.completedAt)}</small></section>
        <div className="sa-split">
          <section className="sa-panel"><h3 className="sw-h3">Created items</h3><div className="sw-kv">{asArray<{ type: string; label: string }>(run.result?.created).map((c, i) => <div key={i}><span>{c.type}</span><b>{c.label}</b></div>)}</div></section>
          <section className="sa-panel"><h3 className="sw-h3">Workflow summary</h3><div className="sw-kv"><div><span>Steps</span><b>3 completed</b></div><div><span>Created objects</span><b>{asArray(run.result?.created).length}</b></div></div><Button href="/workflows/activity">View activity log</Button></section>
        </div>
      </div>
    );
  return (
    <div className="sa-page">
      <Head crumb={<div className="sl-crumbs">Workflows / {wf?.group}</div>} title={wf?.name || "Workflow"} description={wf?.description || ""} actions={<Button href="/workflows"><ArrowLeft size={12} /> Workflows</Button>} />
      <div className="sw-stepper">{steps.map((s, i) => <span key={s} className={i <= step ? "on" : ""}><i />{s}</span>)}</div>
      <div className="sa-split">
        <section className="sa-panel">
          {step < 2 ? (
            <form onSubmit={(e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; setInput({ ...input, ...f }); setStep(step + 1); }} key={step}>
              <h3 className="sw-h3">{steps[step] === "Context" ? "Customer context" : steps[step]}</h3>
              <p className="sw-sub">Kora checks available context; sensitive data stays masked.</p>
              {(step === 0 ? fields.slice(0, 2) : fields.slice(2)).map(([k, l, t]) => <Field key={k} label={l} name={k} type={t} defaultValue={input[k]} required={step === 0} />)}
              <div className="nv-modal-footer"><span className="sw-sub">Step {step + 1} of 3 · Draft saved automatically</span><Button type="submit" primary>Continue</Button></div>
            </form>
          ) : (
            <>
              <h3 className="sw-h3">Review</h3>
              <div className="sw-kv">{Object.entries(input).filter(([, v]) => v).map(([k, v]) => <div key={k}><span>{label(k)}</span><b>{v}</b></div>)}</div>
              <p className="sw-sub">Nothing runs until you confirm. The result is linked to the owning record.</p>
              <div className="nv-modal-footer">
                <Button onClick={() => setStep(1)}>Back</Button>
                <Button primary disabled={m.isPending} onClick={async () => {
                  const created = run || (await m.mutateAsync({ path: "/runs", body: { key: keyName, input } }));
                  setRun(await m.mutateAsync({ path: `/runs/${created._id}/confirm` }));
                }}>Confirm &amp; run</Button>
              </div>
            </>
          )}
        </section>
        <aside className="sa-panel">
          <h3 className="sw-h3">{keyName === "verify_identity" ? "Verification summary" : "Workflow summary"}</h3>
          <div className="sw-kv"><div><span>Context</span><b>{input.customer ? "Complete" : "Pending"}</b></div><div><span>Owner</span><b>You</b></div><div><span>Group</span><b>{wf?.group}</b></div></div>
          <div className="sw-summary"><b>Kora {keyName === "verify_identity" ? "verification" : "guidance"}</b><p>{keyName === "verify_identity" ? "Phone ownership and the account email must match before sensitive account actions." : "Review the details; Kora never executes this workflow without your confirmation."}</p></div>
        </aside>
      </div>
    </div>
  );
}

