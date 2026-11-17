"use client";
// Support Assistant — design p02–p20.
import { useKora } from "@/components/novya/kora";
import { Markdown } from "@/components/novya/markdown";
import { stripPage } from "@/components/novya/kora";
import { Badge, Button, DataState, Empty, Field, Modal } from "@/components/novya/ui";
import api from "@/lib/axios";
import { errorMessage, label } from "@/lib/format";
import { date, supportPath, time, useSupport, useSupportMutation, type Conversation } from "@/lib/support";
import { asArray } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Download, Folder as FolderIcon, MessageSquare, Mic, MoreHorizontal,
  Plus, Search, Sparkles, Upload, X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

/* ---------------- shared bits ---------------- */
type Folder = { _id: string; name: string; description?: string; conversationCount?: number; updatedAt?: string };
type Investigation = {
  _id: string; inv_code: string; title: string; subjectName?: string; status: string; summary?: string;
  owner_id?: { _id: string; name: string } | string; updatedAt?: string; createdAt?: string;
  findings?: { label: string; detail: string; severity: string }[]; recommendedSteps?: string[];
  timeline?: { at: string; text: string; by: string }[]; sourcesVerified?: number; sourcesTotal?: number;
  conversation?: Conversation | null; case?: { _id: string; case_code: string; title: string; subjectName?: string; status: string; priority: string } | null;
};
type Action = { _id: string; title: string; subjectName?: string; description?: string; status: string; updatedAt?: string; createdAt?: string; requested_by_id?: { name?: string } | string; result?: { decidedBy?: string } };

const ago = (s?: string) => {
  if (!s) return "";
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return date(s);
};
const ownerName = (o: Investigation["owner_id"]) => (typeof o === "object" && o ? o.name : "");

function Head({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="sa-head">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Stat({ n, label: l }: { n: ReactNode; label: string }) {
  return (
    <div className="sa-stat">
      <b>{n}</b>
      <span>{l}</span>
    </div>
  );
}
function Filters<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <>
      {options.map(([v, l]) => (
        <button key={v} className={`sa-chip ${value === v ? "on" : ""}`} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </>
  );
}
function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="sa-search">
      <Search size={14} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}
export function KoraOrb({ size = 128 }: { size?: number }) {
  return <span className="sa-orb" style={{ width: size, height: size }} aria-hidden />;
}

/* ---------------- Home (p02) ---------------- */
const STARTERS = ["Prioritize my queue", "Show today's support tasks", "Analyze SLA risks", "Draft a customer reply"];
function AssistantHome() {
  const router = useRouter();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (message: string) => {
    if (!message.trim() || busy) return;
    setBusy(true);
    try {
      const c = (await api.post(supportPath("/chat"), { message })).data.data as Conversation;
      qc.invalidateQueries({ queryKey: ["support", "/conversations"] });
      router.push(`/assistant/c/${c._id}`);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <div className="sa-home">
      <h1>Kora Assistant</h1>
      <p>Your AI support assistant across assigned queues, cases and customer records.</p>
      <KoraOrb />
      <h2>How can I help with support today?</h2>
      <form className="sa-home-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Kora anything..." aria-label="Ask Kora anything" disabled={busy} />
        <button type="button" className="sa-mic" aria-label="Voice input" onClick={() => toast.info("Hold to speak is available in the Ask Kora popup.")}>
          <Mic size={14} />
        </button>
        <button type="submit" className="sa-send" aria-label="Send" disabled={busy || !text.trim()}>
          {busy ? <span className="nv-chat-typing"><i /><i /><i /></span> : <ArrowRight size={15} />}
        </button>
      </form>
      <div className="sa-starters">
        {STARTERS.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={busy}>
            <Sparkles size={11} /> {s}
          </button>
        ))}
      </div>
      <small>Kora can work with assigned conversations, cases, customer records, tasks and internal knowledge.</small>
    </div>
  );
}

/* ---------------- Conversation (p03–p07, p13) ---------------- */
function MoveToFolder({ open, onClose, conversation }: { open: boolean; onClose: () => void; conversation: Conversation }) {
  const folders = useSupport<Folder[]>("/folders", open);
  const m = useSupportMutation();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const list = asArray<Folder>(folders.data).filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
  const move = async (folderId: string) => {
    await m.mutateAsync({ path: `/conversations/${conversation._id}`, method: "patch", body: { folder_id: folderId } });
    toast.success("Conversation moved");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Move to folder" description="Choose where this conversation should appear.">
      <input className="nv-input" placeholder="Search folders..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="sa-folder-pick">
        {list.map((f) => (
          <button key={f._id} onClick={() => move(f._id)} className={conversation.folder_id === f._id ? "on" : ""}>
            <span>{f.name}</span>
            <small>{f.conversationCount || 0}</small>
          </button>
        ))}
        {!list.length && <p className="nv-caption">No folders yet.</p>}
      </div>
      {creating ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name") || "");
            const f = await m.mutateAsync({ path: "/folders", body: { name } });
            await move(f._id);
          }}
          className="sa-inline-form"
        >
          <input className="nv-input" name="name" placeholder="Folder name" required autoFocus />
          <Button type="submit" primary>Create & move</Button>
        </form>
      ) : (
        <button className="sa-link" onClick={() => setCreating(true)}>
          <Plus size={12} /> Create new folder
        </button>
      )}
      <div className="nv-modal-footer">
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

function keyFindings(messages: Conversation["messages"]) {
  const last = [...(messages || [])].reverse().find((m) => m.role === "kora");
  if (!last) return [];
  return last.content
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").replace(/\*\*/g, "").trim())
    .filter((l, i, arr) => l && l.length < 140 && arr.indexOf(l) === i && /^[A-Z0-9]/.test(l) && !/:$/.test(l))
    .slice(0, 3);
}

function ConversationView({ id }: { id: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const kora = useKora();
  const q = useSupport<Conversation>(`/conversations/${id}`);
  const m = useSupportMutation();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [move, setMove] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmInv, setConfirmInv] = useState(false);
  const c = q.data;
  const findings = useMemo(() => keyFindings(c?.messages), [c?.messages]);
  const send = async (message: string) => {
    if (!message.trim() || busy || !c) return;
    setBusy(true);
    setText("");
    try {
      const next = (await api.post(supportPath("/chat"), { message, conversation_id: c._id })).data.data as Conversation;
      qc.setQueryData(["support", `/conversations/${id}`], next);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const investigate = async () => {
    const inv = await m.mutateAsync({ path: `/conversations/${id}/investigate`, body: { title: c?.title } });
    toast.success("Investigation created");
    router.push(`/assistant/investigations/${inv._id}`);
  };
  const prepareUpdate = async () => {
    await m.mutateAsync({ path: "/actions", body: { title: `Prepare customer update · ${c?.title}`, description: "Draft with Kora for approval.", conversation_id: id, fromKora: true } });
    toast.success("Action sent for approval");
  };
  return (
    <DataState pending={q.isPending} error={q.error} retry={() => q.refetch()}>
      {c && (
        <div className="sa-conv">
          <div className="sa-conv-head">
            <Link href="/assistant" className="sa-round" aria-label="Back">
              <ArrowLeft size={13} />
            </Link>
            <div>
              <h1>
                {c.title} <Badge>{c.status === "working" ? "Working" : "Active"}</Badge>
              </h1>
              <p>Support analysis · Started {date(c.messages?.[0]?.createdAt || c.lastMessageAt)} at {time(c.messages?.[0]?.createdAt || c.lastMessageAt)}</p>
            </div>
            <div className="sa-conv-actions">
              <Button onClick={() => setMove(true)}>Move to folder</Button>
              <Button onClick={() => { navigator.clipboard?.writeText(location.href); toast.success("Link copied (visible only to you)"); }}>Share</Button>
              <div style={{ position: "relative" }}>
                <Button onClick={() => setMenu(!menu)} aria-label="More">
                  <MoreHorizontal size={14} />
                </Button>
                {menu && (
                  <div className="nv-menu" style={{ position: "absolute", right: 0, top: 40, zIndex: 5, minWidth: 210 }}>
                    <button onClick={() => { setMenu(false); setConfirmInv(true); }}>Move to Investigation</button>
                    <button onClick={() => { setMenu(false); kora.openChat(); }}>Open quick chat</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="sa-conv-grid">
            <section className="sa-panel sa-thread">
              <div className="sa-thread-head">
                <div>
                  <strong>Kora support analysis</strong>
                  <small>Using customer, conversation, diagnostics and internal knowledge context</small>
                </div>
                <span>8 support sources connected</span>
              </div>
              <div className="sa-thread-body">
                {(c.messages || []).map((msg, i) => (
                  <div key={msg._id || i} className={`sa-msg ${msg.role === "user" ? "me" : "kora"}`}>
                    <div className="sa-msg-top">
                      <b>{msg.role === "user" ? session?.user?.name?.split(" ")[0] || "You" : "Kora"}</b>
                      <span>{msg.role === "user" ? time(msg.createdAt) : `8 sources · ${time(msg.createdAt)}`}</span>
                    </div>
                    {msg.role === "user" ? <p>{stripPage(msg.content)}</p> : <div className="sp-md"><Markdown text={msg.content} /></div>}
                  </div>
                ))}
                {busy && (
                  <div className="sa-msg kora">
                    <div className="sa-msg-top"><b>Kora</b><span>Working…</span></div>
                    <span className="nv-chat-typing"><i /><i /><i /></span>
                  </div>
                )}
              </div>
              <form className="sa-thread-compose" onSubmit={(e) => { e.preventDefault(); send(text); }}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Kora a follow-up or request an action..." aria-label="Message Kora" />
                <button type="submit" aria-label="Send" disabled={busy || !text.trim()}>
                  <ArrowUpRight size={15} />
                </button>
              </form>
            </section>
            <aside className="sa-panel sa-context">
              <h3>Support case context</h3>
              <div className="sa-context-card">
                <div>
                  <strong>{c.title}</strong>
                  <Badge>Private</Badge>
                </div>
                <small>Personal Kora conversation</small>
                <small>Last activity {ago(c.lastMessageAt)}</small>
              </div>
              <h4>Key findings</h4>
              {findings.length ? (
                findings.map((f, i) => (
                  <div key={i} className="sa-finding">
                    <span className={`sp-dot ${i === 2 ? "blue" : "amber"}`} />
                    <span>{f}</span>
                  </div>
                ))
              ) : (
                <p className="nv-caption">Findings appear after Kora answers.</p>
              )}
              <h4>Prepared actions</h4>
              <button className="sa-prepared" onClick={() => setConfirmInv(true)}>
                <b>Complete support analysis</b>
                <small>Save findings in a linked investigation</small>
              </button>
              <button className="sa-prepared" onClick={prepareUpdate}>
                <b>Prepare customer update</b>
                <small>Draft with Kora for approval</small>
              </button>
              <h4>Connected sources · 8</h4>
              <div className="sa-tags">
                {["Customer", "Diagnostics", "Activity", "Knowledge"].map((t) => <span key={t}>{t}</span>)}
              </div>
            </aside>
          </div>
          <MoveToFolder open={move} onClose={() => setMove(false)} conversation={c} />
          <Modal open={confirmInv} onClose={() => setConfirmInv(false)} title="Turn this into an Investigation?" description="Deeper evidence work moves into a named Investigation with explicit scope. Nothing changes in any customer record.">
            <div className="nv-modal-footer">
              <Button onClick={() => setConfirmInv(false)}>Keep in chat</Button>
              <Button primary onClick={() => { setConfirmInv(false); investigate(); }}>Start investigation</Button>
            </div>
          </Modal>
        </div>
      )}
    </DataState>
  );
}

/* ---------------- Folders (p08–p10) ---------------- */
function CreateFolder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const m = useSupportMutation();
  return (
    <Modal open={open} onClose={onClose} title="Create folder" description="Give the folder a name. You can move conversations into it afterwards.">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await m.mutateAsync({ path: "/folders", body: { name: f.get("name"), description: f.get("description") } });
          toast.success("Folder created");
          onClose();
        }}
      >
        <Field label="Folder name" name="name" required placeholder="e.g. Technical diagnostics" />
        <Field label="Description · optional" name="description" placeholder="Which support conversations belong in this folder?" />
        <div className="nv-modal-footer">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" primary disabled={m.isPending}>Save folder</Button>
        </div>
      </form>
    </Modal>
  );
}

function ConversationRow({ c, folder }: { c: Conversation; folder?: string }) {
  return (
    <Link href={`/assistant/c/${c._id}`} className="sa-conv-row">
      <span className="sa-row-icon"><MessageSquare size={13} /></span>
      <span>
        <b>{c.title}</b>
        <small>{stripPage(c.messages?.[0]?.content || "Kora support conversation").slice(0, 90)}</small>
      </span>
      <span className="sa-row-meta">
        <small>{folder || "Private"}</small>
        <small>{ago(c.lastMessageAt || c.updatedAt)}</small>
      </span>
      <span className="sa-round"><MoreHorizontal size={12} /></span>
    </Link>
  );
}

function FoldersView() {
  const folders = useSupport<Folder[]>("/folders");
  const convs = useSupport<Conversation[]>("/conversations");
  const [q, setQ] = useState("");
  const [create, setCreate] = useState(false);
  const list = asArray<Folder>(folders.data);
  const names = Object.fromEntries(list.map((f) => [f._id, f.name]));
  const recent = asArray<Conversation>(convs.data).filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="sa-page">
      <Head title="Folders" description="Organize support conversations by customer, topic, and responsibility." action={<Button onClick={() => setCreate(true)}><Plus size={13} /> Create folder</Button>} />
      <div className="sa-toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search folders and conversations" />
        <button className="sa-chip on">Last updated <ChevronDown size={11} /></button>
      </div>
      <h3 className="sa-section">Chat folders</h3>
      <DataState pending={folders.isPending} error={folders.error} retry={() => folders.refetch()}>
        <div className="sa-folder-grid">
          {list.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).map((f) => (
            <Link key={f._id} href={`/assistant/folders/${f._id}`} className="sa-folder">
              <div><FolderIcon size={18} /> <b>{f.name}</b></div>
              <small>{f.description || "Personal conversation collection"}</small>
              <div className="sa-folder-foot"><span>{f.conversationCount || 0} conversations</span><ArrowUpRight size={12} /></div>
            </Link>
          ))}
          {!list.length && <Empty title="No folders yet" description="Create a folder to organize your Kora conversations." />}
        </div>
      </DataState>
      <h3 className="sa-section">Recent conversations</h3>
      <div className="sa-two-col">
        {recent.slice(0, 10).map((c) => <ConversationRow key={c._id} c={c} folder={c.folder_id ? names[c.folder_id] : undefined} />)}
      </div>
      <CreateFolder open={create} onClose={() => setCreate(false)} />
    </div>
  );
}

function FolderDetail({ id }: { id: string }) {
  const folders = useSupport<Folder[]>("/folders");
  const convs = useSupport<Conversation[]>(`/conversations?folder_id=${id}`);
  const m = useSupportMutation();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(false);
  const folder = asArray<Folder>(folders.data).find((f) => f._id === id);
  const list = asArray<Conversation>(convs.data).filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="sa-page">
      <Head
        title={folder?.name || "Folder"}
        description={`${list.length} conversations in this folder. Select one to continue resolving it with Kora.`}
        action={<Button onClick={() => setEdit(true)}><Plus size={13} /> Edit folder</Button>}
      />
      <div className="sa-toolbar">
        <SearchInput value={q} onChange={setQ} placeholder={`Search conversations in ${folder?.name || "folder"}`} />
        <button className="sa-chip on">Recent <ChevronDown size={11} /></button>
      </div>
      <h3 className="sa-section">Conversations</h3>
      <DataState pending={convs.isPending} error={convs.error} retry={() => convs.refetch()}>
        <div className="sa-stack">
          {list.map((c) => <ConversationRow key={c._id} c={c} folder="Connected sources" />)}
          {!list.length && <Empty title="This folder is empty" description="Use “Move to folder” on a conversation to add it here." />}
        </div>
      </DataState>
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit folder" description="Rename or archive this folder. Archiving never deletes conversations.">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await m.mutateAsync({ path: `/folders/${id}`, method: "patch", body: { name: f.get("name"), description: f.get("description") } });
            setEdit(false);
          }}
        >
          <Field label="Folder name" name="name" required defaultValue={folder?.name} />
          <Field label="Description" name="description" defaultValue={folder?.description} />
          <div className="nv-modal-footer">
            <Button onClick={async () => { await m.mutateAsync({ path: `/folders/${id}`, method: "delete" }); router.push("/assistant/folders"); }}>Archive folder</Button>
            <Button type="submit" primary>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ---------------- Investigations (p11–p12) ---------------- */
type InvList = { stats: { active: number; review: number; completedThisMonth: number }; items: Investigation[]; suggestions: { title: string; detail: string; level: string; subject: string }[] };

function NewInvestigation({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: { title: string; subject: string } }) {
  const m = useSupportMutation();
  const router = useRouter();
  return (
    <Modal open={open} onClose={onClose} title="New investigation" description="Name the problem, target and purpose. Kora gathers authorized evidence; nothing is changed automatically.">
      <form
        key={preset?.title || "new"}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const inv = await m.mutateAsync({ path: "/investigations", body: { title: f.get("title"), subjectName: f.get("subject"), summary: f.get("summary") } });
          onClose();
          router.push(`/assistant/investigations/${inv._id}`);
        }}
      >
        <Field label="Problem" name="title" required defaultValue={preset?.title} placeholder="e.g. Invoice mismatch · Atelier König" />
        <Field label="Area" name="subject" defaultValue={preset?.subject} placeholder="Billing, Access, Voice system…" />
        <Field label="Purpose and scope" name="summary" type="textarea" placeholder="What should be verified, for which customer and time range?" />
        <div className="nv-modal-footer">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" primary disabled={m.isPending}>Start investigation</Button>
        </div>
      </form>
    </Modal>
  );
}

function InvestigationsView() {
  const [filter, setFilter] = useState<"all" | "active" | "review">("all");
  const [q, setQ] = useState("");
  const [create, setCreate] = useState<{ title: string; subject: string } | null | false>(false);
  const data = useSupport<InvList>(`/investigations?status=${filter}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const d = data.data;
  return (
    <div className="sa-page">
      <Head title="Investigations" description="Investigate customer, account and system issues with Kora." action={<Button onClick={() => setCreate(null)}><Plus size={13} /> New investigation</Button>} />
      <div className="sa-split">
        <section className="sa-panel">
          <div className="sa-stats three">
            <Stat n={d?.stats.active ?? "–"} label="Active" />
            <Stat n={d?.stats.review ?? "–"} label="Need review" />
            <Stat n={d?.stats.completedThisMonth ?? "–"} label="Completed this month" />
          </div>
          <div className="sa-toolbar">
            <SearchInput value={q} onChange={setQ} placeholder="Search investigations" />
            <Filters value={filter} onChange={setFilter} options={[["all", "All"], ["active", "Active"], ["review", "Review"]]} />
          </div>
          <div className="sa-list-title"><h3>Active investigations</h3><span>{asArray(d?.items).length} open</span></div>
          <DataState pending={data.isPending} error={data.error} retry={() => data.refetch()}>
            <div className="sa-stack">
              {asArray<Investigation>(d?.items).map((i) => (
                <Link key={i._id} href={`/assistant/investigations/${i._id}`} className="sa-item">
                  <span className="sp-dot blue" />
                  <span className="sa-item-main">
                    <b>{i.title}</b>
                    <small className="sa-item-tag">{i.subjectName || "Support"}</small>
                    <small>{i.summary}</small>
                  </span>
                  <small className="sa-item-meta">{ownerName(i.owner_id).split(" ")[0]} · {ago(i.updatedAt)}</small>
                </Link>
              ))}
              {!asArray(d?.items).length && <Empty title="No investigations" description="Start one from a chat or with “New investigation”." />}
            </div>
          </DataState>
        </section>
        <aside className="sa-panel">
          <h3 className="sa-aside-title">Suggested investigations</h3>
          <p className="sa-aside-sub">Kora detected support patterns that may require deeper verification.</p>
          <div className="sa-stack">
            {asArray<InvList["suggestions"][number]>(d?.suggestions).map((s, i) => (
              <div key={i} className="sa-suggest">
                <div><b>{s.title}</b><span className={`sp-dot ${s.level === "High" ? "amber" : s.level === "Review" ? "amber" : "blue"}`} /></div>
                <small>{s.detail}</small>
                <div className="sa-suggest-foot">
                  <span>{s.level}</span>
                  <button onClick={() => setCreate({ title: s.title, subject: s.subject })}>Investigate <ArrowUpRight size={11} /></button>
                </div>
              </div>
            ))}
            {!asArray(d?.suggestions).length && <p className="nv-caption">No recurring patterns detected.</p>}
          </div>
        </aside>
      </div>
      <NewInvestigation open={create !== false} preset={create || undefined} onClose={() => setCreate(false)} />
    </div>
  );
}

function InvestigationDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const q = useSupport<Investigation>(`/investigations/${id}`);
  const m = useSupportMutation();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const inv = q.data;
  const send = async (message: string) => {
    if (!message.trim() || busy) return;
    setBusy(true);
    setText("");
    try {
      await api.post(supportPath(`/investigations/${id}/messages`), { message });
      await qc.invalidateQueries({ queryKey: ["support", `/investigations/${id}`] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <DataState pending={q.isPending} error={q.error} retry={() => q.refetch()}>
      {inv && (
        <div className="sa-conv">
          <div className="sa-conv-head">
            <Link href="/assistant/investigations" className="sa-round" aria-label="Back"><ArrowLeft size={13} /></Link>
            <div>
              <h1>{inv.title} <Badge>{label(inv.status)}</Badge></h1>
              <p>{inv.subjectName || "Support"} · {inv.inv_code}{inv.case ? ` · Linked case ${inv.case.case_code}` : ""} · Started {date(inv.createdAt)}</p>
            </div>
            <div className="sa-conv-actions">
              <Button onClick={() => { navigator.clipboard?.writeText(location.href); toast.success("Link copied"); }}>Share</Button>
              {inv.status !== "completed" && <Button primary onClick={() => setComplete(true)}><Check size={13} /> Complete</Button>}
            </div>
          </div>
          <div className="sa-conv-grid">
            <section className="sa-panel sa-thread">
              <div className="sa-thread-head">
                <div>
                  <strong>Investigation workbench</strong>
                  <small>Conversation, connected sources, checks and live findings</small>
                </div>
                <span>{inv.sourcesVerified || 0} of {inv.sourcesTotal || 8} sources verified</span>
              </div>
              <div className="sa-thread-body">
                {(inv.conversation?.messages || []).map((msg, i) => (
                  <div key={msg._id || i} className={`sa-msg ${msg.role === "user" ? "me" : "kora"}`}>
                    <div className="sa-msg-top">
                      <b>{msg.role === "user" ? session?.user?.name?.split(" ")[0] || "You" : "Kora"}</b>
                      <span>{time(msg.createdAt)}</span>
                    </div>
                    {msg.role === "user" ? <p>{stripPage(msg.content)}</p> : <div className="sp-md"><Markdown text={msg.content} /></div>}
                  </div>
                ))}
                {!inv.conversation?.messages?.length && !busy && (
                  <div className="sa-msg kora"><div className="sa-msg-top"><b>Kora</b><span>Ready</span></div><p>Describe what to verify. I will separate evidence, inference, confidence and missing sources.</p></div>
                )}
                {busy && <div className="sa-msg kora"><div className="sa-msg-top"><b>Kora</b><span>Analyzing…</span></div><span className="nv-chat-typing"><i /><i /><i /></span></div>}
              </div>
              <form className="sa-thread-compose" onSubmit={(e) => { e.preventDefault(); send(text); }}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Kora a follow-up or request an action..." aria-label="Message Kora" />
                <button type="submit" aria-label="Send" disabled={busy || !text.trim()}><ArrowUpRight size={15} /></button>
              </form>
            </section>
            <aside className="sa-panel sa-context">
              <h3>Investigation summary</h3>
              <div className="sa-context-card">
                <div><strong>{inv.case?.subjectName || inv.subjectName || "Support"}</strong><Badge>{inv.case ? "Case linked" : "No case"}</Badge></div>
                {inv.case && <small>{inv.case.case_code} · {inv.case.title} · {label(inv.case.status)}</small>}
                <small>{inv.summary || "No summary yet"}</small>
              </div>
              <h4>Key findings</h4>
              {(inv.findings || []).length ? (
                inv.findings!.map((f, i) => (
                  <div key={i} className="sa-finding">
                    <span className={`sp-dot ${f.severity === "info" ? "blue" : "amber"}`} />
                    <span><b>{f.label}</b><small>{f.detail}</small></span>
                  </div>
                ))
              ) : <p className="nv-caption">No findings recorded yet.</p>}
              <h4>Completion</h4>
              <button className="sa-prepared" onClick={() => setComplete(true)} disabled={inv.status === "completed"}>
                <b>Complete investigation</b>
                <small>{inv.case ? `Links findings to ${inv.case.case_code}` : "Saves the finding summary"}</small>
              </button>
              <button className="sa-prepared" onClick={async () => { await m.mutateAsync({ path: "/actions", body: { title: `Approval for ${inv.title}`, description: "Prepared from investigation findings", investigation_id: id, fromKora: true } }); toast.success("Sent for approval"); }}>
                <b>Prepare approval</b>
                <small>No action without confirmation</small>
              </button>
              <h4>Connected sources · {inv.sourcesTotal || 8}</h4>
              <div className="sa-tags">{["Usage", "Billing", "Support", "Number history"].map((t) => <span key={t}>{t}</span>)}</div>
            </aside>
          </div>
          <Modal open={complete} onClose={() => setComplete(false)} title="Complete investigation" description="Summarize the supportable conclusion. It is added to the linked case as evidence — it does not change the case state.">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const summary = String(new FormData(e.currentTarget).get("summary"));
                await m.mutateAsync({ path: `/investigations/${id}`, method: "patch", body: { status: "completed", summary } });
                setComplete(false);
                toast.success("Investigation completed");
              }}
            >
              <Field label="Finding summary" name="summary" type="textarea" required defaultValue={inv.summary} />
              <div className="nv-modal-footer">
                <Button onClick={() => setComplete(false)}>Cancel</Button>
                <Button type="submit" primary>Complete</Button>
              </div>
            </form>
          </Modal>
        </div>
      )}
    </DataState>
  );
}

/* ---------------- Actions (p14) ---------------- */
type ActionList = { stats: { needsReview: number; scheduled: number; running: number; completedToday: number }; items: Action[]; approvalQueue: Action[]; canApprove: boolean };
const actionState = (a: Action) =>
  ({ pending_approval: ["Teamleader approval", "Needs review"], approved: ["Approved", "Running"], executed: ["Approved", "Completed"], rejected: ["Decision", "Rejected"], draft: ["Draft", "Draft"], failed: ["Within permissions", "Failed"] } as Record<string, string[]>)[a.status] || ["", label(a.status)];

function ActionsView() {
  const [filter, setFilter] = useState<"all" | "approval" | "running" | "completed">("all");
  const [q, setQ] = useState("");
  const router = useRouter();
  const data = useSupport<ActionList>(`/actions?status=${filter}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const m = useSupportMutation();
  const d = data.data;
  const decide = async (id: string, verb: "approve" | "reject") => {
    await m.mutateAsync({ path: `/actions/${id}/${verb}` });
    toast.success(verb === "approve" ? "Approved" : "Rejected");
  };
  return (
    <div className="sa-page">
      <Head title="Actions" description="Review Kora drafts, approvals, scheduled callbacks and completed support actions." action={<Button onClick={() => router.push("/assistant")}><Sparkles size={13} /> New chat</Button>} />
      <div className="sa-split">
        <section className="sa-panel">
          <div className="sa-stats four">
            <Stat n={d?.stats.needsReview ?? "–"} label="Needs review" />
            <Stat n={d?.stats.scheduled ?? "–"} label="Scheduled" />
            <Stat n={d?.stats.running ?? "–"} label="Running" />
            <Stat n={d?.stats.completedToday ?? "–"} label="Completed today" />
          </div>
          <div className="sa-toolbar">
            <SearchInput value={q} onChange={setQ} placeholder="Search actions" />
            <Filters value={filter} onChange={setFilter} options={[["all", "All"], ["approval", "Approval"], ["running", "Running"], ["completed", "Completed"]]} />
            <button className="sa-chip push">Recent <ChevronDown size={11} /></button>
          </div>
          <div className="sa-list-title"><h3>All Kora actions</h3><span>Select a row to expand its audit context</span></div>
          <DataState pending={data.isPending} error={data.error} retry={() => data.refetch()}>
            <div className="sa-stack">
              {asArray<Action>(d?.items).map((a) => {
                const [who, state] = actionState(a);
                return (
                  <details key={a._id} className="sa-item sa-action">
                    <summary>
                      <span className="sp-dot blue" />
                      <span className="sa-item-main">
                        <b>{a.title}</b>
                        <small className="sa-item-tag">{a.subjectName}</small>
                        <small>{a.description}</small>
                      </span>
                      <span className="sa-action-state"><small>{who}</small><small>{state}</small><small>{ago(a.updatedAt)}</small></span>
                    </summary>
                    <div className="sa-action-audit">
                      <span>Requested {date(a.createdAt)} {time(a.createdAt)}</span>
                      {a.status === "pending_approval" && <Button onClick={() => m.mutate({ path: `/actions/${a._id}/cancel` })}>Cancel request</Button>}
                    </div>
                  </details>
                );
              })}
              {!asArray(d?.items).length && <Empty title="No actions" description="Kora actions you request appear here with their approval state." />}
            </div>
          </DataState>
        </section>
        <aside className="sa-panel">
          <h3 className="sa-aside-title">Approval queue</h3>
          <p className="sa-aside-sub">High-impact support actions Kora cannot execute without approval.</p>
          <div className="sa-stack">
            {asArray<Action>(d?.approvalQueue).map((a) => (
              <div key={a._id} className="sa-suggest">
                <b>{a.title}</b>
                <small>{a.subjectName}</small>
                <small className="sa-faint">Requested by {typeof a.requested_by_id === "object" ? a.requested_by_id?.name : "you"}</small>
                <div className="sa-approve-row">
                  <Button onClick={() => toast.info(a.description || "No further details")}>Review</Button>
                  {d?.canApprove ? (
                    <>
                      <Button onClick={() => decide(a._id, "approve")}>Approve</Button>
                      <Button onClick={() => decide(a._id, "reject")}><X size={12} /></Button>
                    </>
                  ) : (
                    <Badge>Waiting for Teamleader</Badge>
                  )}
                </div>
              </div>
            ))}
            {!asArray(d?.approvalQueue).length && <p className="nv-caption">Nothing waiting for approval.</p>}
          </div>
          <h4 className="sa-policy-title">Execution policy</h4>
          <div className="sa-policy">
            <div><span>Direct</span><small>Within permissions</small></div>
            <div><span>Preview</span><small>Confirm before execution</small></div>
            <div><span>Approval</span><small>Teamleader decision required</small></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- Brain (p15–p19) ---------------- */
type BrainSummary = {
  total: number; sources: number; suggestions: number; conflicts: number; otherCount: number;
  groups: { name: string; description: string; count: number; updatedAt: string | null; coverage: number }[];
  recent: { _id: string; title: string; category: string; updatedAt: string }[];
  files: { _id: string; name: string; updatedAt: string }[];
};
type Memory = { _id: string; title: string; content?: string; category?: string; source?: string; status: string; updatedAt?: string };

function AddKnowledge({ open, onClose, mode }: { open: boolean; onClose: () => void; mode: "write" | "source" }) {
  const m = useSupportMutation();
  const qc = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"write" | "document" | "url">(mode === "source" ? "document" : "write");
  const brain = useSupport<BrainSummary>("/brain/summary", open);
  const groups = asArray<BrainSummary["groups"][number]>(brain.data?.groups).map((g) => g.name);
  return (
    <Modal open={open} onClose={onClose} title={mode === "source" ? "Connect source" : "Add knowledge"} description="Teach Kora verified personal work context. Customer records and case data are never stored here." wide>
      <div className="sa-tabs">
        {(["write", "document", "url"] as const).map((t) => (
          <button key={t} className={`sa-chip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t === "write" ? "Write" : t === "document" ? "Document" : "URL"}</button>
        ))}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (tab === "write") await m.mutateAsync({ path: "/memory", body: { title: f.get("title"), content: f.get("content"), category: f.get("category"), source: "Added manually" } });
          else if (tab === "url") await m.mutateAsync({ path: "/memory/url", body: { url: f.get("url"), title: f.get("title"), category: f.get("category") } });
          else {
            const fd = new FormData();
            const picked = file.current?.files?.[0];
            if (!picked) return toast.error("Choose a file");
            fd.append("file", picked);
            fd.append("category", String(f.get("category")));
            try {
              await api.post(supportPath("/memory/import"), fd, { headers: { "Content-Type": "multipart/form-data" } });
              qc.invalidateQueries({ queryKey: ["support"] });
            } catch (err) {
              return toast.error(errorMessage(err));
            }
          }
          toast.success(tab === "write" ? "Knowledge added" : "Source connected — review the proposed entry");
          onClose();
        }}
      >
        <label className="nv-field">
          <span>Brain block</span>
          <select className="nv-input" name="category" defaultValue={groups[0]}>
            {groups.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        {tab !== "document" && <Field label="Title" name="title" required={tab === "write"} placeholder="Preferred escalation and handover style" />}
        {tab === "write" && <Field label="What should Kora know?" name="content" type="textarea" required placeholder="For complex customer cases, Lena prefers…" />}
        {tab === "url" && <Field label="Source URL" name="url" required placeholder="https://…" />}
        {tab === "document" && (
          <div className="nv-upload-zone" onClick={() => file.current?.click()}>
            <Upload size={18} />
            <b>Drop files here</b>
            <small>PDF, DOCX, TXT · up to 25 MB</small>
            <input ref={file} type="file" hidden accept=".pdf,.docx,.txt,.md" />
          </div>
        )}
        <p className="nv-caption">Visibility: Lena and authorized Teamleaders · Kora mapping preview after saving.</p>
        <div className="nv-modal-footer">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" primary disabled={m.isPending}>{mode === "source" ? "Connect source" : "Add knowledge"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function BrainGraph({ groups }: { groups: BrainSummary["groups"] }) {
  const dots = useMemo(() => Array.from({ length: 70 }, (_, i) => {
    const a = (i * 137.5 * Math.PI) / 180, r = 18 + ((i * 53) % 100) * 1.25;
    return { x: 50 + (Math.cos(a) * r) / 3.4, y: 50 + (Math.sin(a) * r) / 3.4, s: 1.5 + (i % 3) };
  }), []);
  const pos: Record<string, [number, number]> = { "Role & Responsibilities": [18, 22], "Goals & Priorities": [80, 22], Relationships: [18, 72], "Working Style": [80, 72], "Skills & Development": [50, 88] };
  return (
    <div className="sa-graph">
      <div className="sa-graph-ring r1" /><div className="sa-graph-ring r2" />
      {dots.map((d, i) => <i key={i} style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s }} />)}
      <span className="sa-graph-core" />
      {groups.filter((g) => pos[g.name]).map((g) => (
        <Link key={g.name} href={`/assistant/brain/knowledge?block=${encodeURIComponent(g.name)}`} className="sa-graph-node" style={{ left: `${pos[g.name][0]}%`, top: `${pos[g.name][1]}%` }}>
          {g.name}<small>{g.count}</small>
        </Link>
      ))}
    </div>
  );
}

function BrainView() {
  const { data: session } = useSession();
  const b = useSupport<BrainSummary>("/brain/summary");
  const [add, setAdd] = useState<false | "write" | "source">(false);
  const [q, setQ] = useState("");
  const d = b.data;
  const name = session?.user?.name?.split(" ")[0] || "you";
  return (
    <div className="sa-page">
      <Head title="Personal Brain" description={`What Kora knows about ${name}: support role, goals, responsibilities, working style, relationships and development.`} action={<Button onClick={() => setAdd("write")}><Plus size={13} /> Add knowledge</Button>} />
      <DataState pending={b.isPending} error={b.error} retry={() => b.refetch()}>
        {d && (
          <div className="sa-split">
            <section className="sa-panel sa-brain">
              <div className="sa-toolbar">
                <SearchInput value={q} onChange={setQ} placeholder="Search knowledge" />
                <button className="sa-chip on">Graph</button>
                <Link className="sa-chip" href="/assistant/brain/knowledge">Knowledge</Link>
                <button className="sa-chip" onClick={() => setAdd("source")}>Sources</button>
                <button className="sa-chip push">Fit view</button>
              </div>
              <BrainGraph groups={d.groups.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()))} />
              <div className="sa-stats four">
                <Stat n={d.total} label="Personal context items" />
                <Stat n={d.sources} label="Connected sources" />
                <Stat n={d.groups.filter((g) => g.count).length} label="Context groups" />
                <Stat n={d.conflicts} label="Conflicts" />
              </div>
            </section>
            <aside className="sa-panel">
              <h3 className="sa-aside-title">Knowledge</h3>
              <p className="sa-aside-sub">{name}&apos;s personal work context</p>
              <Link href="/assistant/brain/knowledge" className="sa-search"><Search size={14} /><span>Search all knowledge</span></Link>
              <h4>Explore</h4>
              <div className="sa-explore">
                {[
                  ["Knowledge list", d.total, "/assistant/brain/knowledge"],
                  ["Context groups", d.groups.filter((g) => g.count).length, "/assistant/brain/knowledge"],
                  ["Sources", d.sources, "/assistant/brain/knowledge"],
                  ["Suggestions", d.suggestions, "/assistant/brain/knowledge?status=proposed"],
                  ["Conflicts", d.conflicts, "/assistant/brain/knowledge"],
                  ["Brain activity", "Live", "/assistant/history"],
                ].map(([l, n, href]) => (
                  <Link key={String(l)} href={String(href)}><span>{l}</span><small>{n}</small></Link>
                ))}
              </div>
              <h4>Recently updated</h4>
              <div className="sa-stack">
                {d.recent.map((r) => (
                  <Link key={r._id} href={`/assistant/brain/knowledge?block=${encodeURIComponent(r.category)}`} className="sa-mini">
                    <b>{r.title}</b>
                    <small>{r.category} · {ago(r.updatedAt)}</small>
                  </Link>
                ))}
              </div>
              <button className="sa-mini sa-add" onClick={() => setAdd("source")}><Plus size={12} /> Import source</button>
            </aside>
          </div>
        )}
      </DataState>
      <AddKnowledge open={add !== false} mode={add || "write"} onClose={() => setAdd(false)} />
    </div>
  );
}

function KnowledgeList({ block, status }: { block?: string; status?: string }) {
  const { data: session } = useSession();
  const b = useSupport<BrainSummary>("/brain/summary");
  const memory = useSupport<Memory[]>("/memory");
  const m = useSupportMutation();
  const [q, setQ] = useState("");
  const [add, setAdd] = useState<false | "write" | "source">(false);
  const name = session?.user?.name?.split(" ")[0] || "you";
  const items = asArray<Memory>(memory.data);
  const proposed = items.filter((x) => x.status === "proposed");
  if (block) {
    const list = items.filter((x) => x.category === block && x.title.toLowerCase().includes(q.toLowerCase()));
    return (
      <div className="sa-page">
        <Link className="sa-link" href="/assistant/brain/knowledge"><ArrowLeft size={12} /> Personal knowledge</Link>
        <Head title={block} description={`Personal support context · ${list.length} items`} action={<Button onClick={() => setAdd("write")}><Plus size={13} /> Add knowledge</Button>} />
        <div className="sa-toolbar"><SearchInput value={q} onChange={setQ} placeholder="Search this block" /></div>
        <div className="sa-stack">
          {list.map((x) => (
            <div key={x._id} className="sa-item">
              <span className="sp-dot blue" />
              <span className="sa-item-main"><b>{x.title}</b><small>{x.content}</small><small className="sa-faint">{x.source || "Added manually"} · {ago(x.updatedAt)}</small></span>
              <span className="sa-row-btns">
                {x.status === "proposed" && <Button onClick={() => m.mutate({ path: `/memory/${x._id}`, method: "patch", body: { status: "confirmed" } })}>Confirm</Button>}
                <Button onClick={() => m.mutate({ path: `/memory/${x._id}`, method: "patch", body: { status: "removed" } })}>Remove</Button>
              </span>
            </div>
          ))}
          {!list.length && <Empty title="Nothing in this block yet" description="Add personal knowledge so Kora can adapt to you." />}
        </div>
        <AddKnowledge open={add !== false} mode={add || "write"} onClose={() => setAdd(false)} />
      </div>
    );
  }
  const d = b.data;
  return (
    <div className="sa-page">
      <div className="sa-split wide">
        <div>
          <Head title="Personal Knowledge" description={`Manage the personal context Kora uses to support ${name} in daily support work.`} />
          <div className="sa-toolbar">
            <SearchInput value={q} onChange={setQ} placeholder="Search personal context, goals or sources" />
            <button className="sa-chip">All domains <ChevronDown size={11} /></button>
            <Link className="sa-chip on" href="/assistant/brain/knowledge?status=proposed">✦ Review {proposed.length} suggestions</Link>
          </div>
          {status === "proposed" && (
            <div className="sa-stack" style={{ marginBottom: 18 }}>
              {proposed.map((x) => (
                <div key={x._id} className="sa-item">
                  <span className="sp-dot amber" />
                  <span className="sa-item-main"><b>{x.title}</b><small>{x.category} · {x.source}</small></span>
                  <span className="sa-row-btns">
                    <Button onClick={() => m.mutate({ path: `/memory/${x._id}`, method: "patch", body: { status: "confirmed" } })}>Confirm</Button>
                    <Button onClick={() => m.mutate({ path: `/memory/${x._id}`, method: "patch", body: { status: "removed" } })}>Reject</Button>
                  </span>
                </div>
              ))}
              {!proposed.length && <p className="nv-caption">No suggestions waiting.</p>}
            </div>
          )}
          <div className="sa-eyebrow">Personal context</div>
          <DataState pending={b.isPending} error={b.error} retry={() => b.refetch()}>
            <div className="sa-blocks">
              {asArray<BrainSummary["groups"][number]>(d?.groups).filter((g) => g.name.toLowerCase().includes(q.toLowerCase())).map((g) => (
                <div key={g.name} className="sa-block">
                  <div className="sa-block-top">
                    <span className="sa-letter">{g.name[0]}</span>
                    <span><b>{g.name}</b><small>{g.description}</small></span>
                    <em>{g.count} items</em>
                  </div>
                  <div className="sa-block-meta"><small>Updated {g.updatedAt ? ago(g.updatedAt) : "—"}</small></div>
                  <div className="sa-block-foot">
                    <small>Coverage {g.coverage}%</small>
                    <span className="sa-mini-bar"><i style={{ width: `${g.coverage}%` }} /></span>
                    <Link href={`/assistant/brain/knowledge?block=${encodeURIComponent(g.name)}`}>Open block <ArrowRight size={11} /></Link>
                  </div>
                </div>
              ))}
            </div>
          </DataState>
        </div>
        <aside className="sa-panel">
          <h3 className="sa-aside-title">Personal role, goals and authorized context</h3>
          <p className="sa-aside-sub">Feedback, preferences and learning signals</p>
          <div className="sa-subpanel">
            <b>Personal knowledge overview</b>
            <div className="sa-stats three tight">
              <Stat n={d?.total ?? "–"} label="Items" />
              <Stat n={d?.sources ?? "–"} label="Sources" />
              <Stat n="Today" label="Updated" />
            </div>
          </div>
          <div className="sa-subpanel">
            <b>Import personal knowledge</b>
            <small>Kora verifies and connects every authorized personal source.</small>
            <button className="nv-upload-zone" onClick={() => setAdd("source")}>
              <Upload size={16} /><b>Drop files here</b><small>PDF, DOCX, TXT · up to 25 MB</small>
              <span className="nv-button"><Plus size={12} /> Upload documents</span>
            </button>
            <div className="sa-eyebrow">Recent files</div>
            {asArray<BrainSummary["files"][number]>(d?.files).map((f) => (
              <div key={f._id} className="sa-file"><span className="sa-letter small">{f.name.split(".").pop()?.[0]?.toUpperCase()}</span><span><b>{f.name}</b><small>Added {ago(f.updatedAt)}</small></span><Check size={12} /></div>
            ))}
            {!asArray(d?.files).length && <p className="nv-caption">No imported files yet.</p>}
          </div>
          <div className="sa-subpanel">
            <div className="sa-learning"><KoraOrb size={26} /><span><b>Kora learning status</b><small>Continuously learning across authorized NOVYA sources.</small></span></div>
            <div className="sa-sync">● {d?.sources ?? 0} of {d?.sources ?? 0} sources synchronized</div>
          </div>
        </aside>
      </div>
      <AddKnowledge open={add !== false} mode={add || "write"} onClose={() => setAdd(false)} />
    </div>
  );
}

/* ---------------- History (p20) ---------------- */
type History = {
  stats: { eventsToday: number; conversations: number; reviews: number; actions: number };
  byType: Record<string, number>;
  highImpact: { title: string; status: string; at: string }[];
  events: { _id: string; type: string; title: string; subject: string; meta: string; at: string; href: string }[];
  retentionDays: number;
};
function HistoryView() {
  const { data: session } = useSession();
  const h = useSupport<History>("/history");
  const [filter, setFilter] = useState<"all" | "chat" | "review" | "result" | "action">("all");
  const [q, setQ] = useState("");
  const d = h.data;
  const events = asArray<History["events"][number]>(d?.events).filter((e) => (filter === "all" || e.type === filter) && `${e.title} ${e.subject}`.toLowerCase().includes(q.toLowerCase()));
  const exportCsv = () => {
    const rows = [["time", "type", "title", "subject", "reference"], ...asArray<History["events"][number]>(d?.events).map((e) => [e.at, e.type, e.title, e.subject, e.meta])];
    const blob = new Blob([rows.map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kora-history.csv";
    a.click();
  };
  const groups = events.reduce<Record<string, History["events"]>>((acc, e) => {
    const k = new Date(e.at).toDateString() === new Date().toDateString() ? `Today · ${new Date(e.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : new Date(e.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    (acc[k] ||= []).push(e);
    return acc;
  }, {});
  return (
    <div className="sa-page">
      <Head title="History" description="Complete history of Kora conversations, drafts, reviews, personal Brain updates and support actions." action={<Button onClick={exportCsv}><Download size={13} /> Export history</Button>} />
      <DataState pending={h.isPending} error={h.error} retry={() => h.refetch()}>
        {d && (
          <div className="sa-split">
            <section className="sa-panel">
              <div className="sa-stats four">
                <Stat n={d.stats.eventsToday} label="Events today" />
                <Stat n={d.stats.conversations} label="Conversations" />
                <Stat n={d.stats.reviews} label="Reviews" />
                <Stat n={d.stats.actions} label="Actions" />
              </div>
              <div className="sa-toolbar">
                <SearchInput value={q} onChange={setQ} placeholder="Search history" />
                <Filters value={filter} onChange={setFilter} options={[["all", "All"], ["chat", "Chats"], ["review", "Reviews"], ["result", "Results"], ["action", "Actions"]]} />
                <button className="sa-chip push">Recent</button>
              </div>
              {Object.entries(groups).map(([day, list]) => (
                <div key={day}>
                  <div className="sa-list-title"><h3>{day}</h3><span>{list.length} events</span></div>
                  <div className="sa-stack">
                    {list.map((e) => (
                      <Link key={e.type + e._id} href={e.href} className="sa-history">
                        <small>{time(e.at)}</small>
                        <span className="sp-dot blue" />
                        <span className="sa-item-main"><b>{e.title}</b><small className="sa-item-sub">{e.subject}</small><small className="sa-faint">{session?.user?.name?.split(" ")[0]} · {e.meta}</small></span>
                        <em>{({ chat: "Chat", review: "Review", result: "Result", action: "Action", brain: "Brain" } as Record<string, string>)[e.type]}</em>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {!events.length && <Empty title="No history" description="Your Kora activity appears here." />}
            </section>
            <aside className="sa-panel">
              <h3 className="sa-aside-title">Audit summary</h3>
              <p className="sa-aside-sub">Traceable history across {session?.user?.name?.split(" ")[0]}&apos;s assigned support workspace.</p>
              <div className="sa-subpanel"><small>Audit integrity</small><b className="sa-big">Complete</b><small className="sa-faint">Last synchronized just now</small></div>
              <h4>Activity by type</h4>
              <div className="sa-policy plain">
                {[["Conversations", d.byType.conversations], ["Reviews", d.byType.reviews], ["Results", d.byType.results], ["Actions", d.byType.actions], ["Brain updates", d.byType.brain]].map(([l, n]) => (
                  <div key={String(l)}><span>{l}</span><small>{n}</small></div>
                ))}
              </div>
              <h4>High-impact events</h4>
              <div className="sa-stack">
                {d.highImpact.map((x, i) => (
                  <div key={i} className="sa-mini"><b>{x.title}</b><small>{label(x.status)} · {time(x.at)}</small></div>
                ))}
                {!d.highImpact.length && <p className="nv-caption">No high-impact events.</p>}
              </div>
              <div className="sa-mini sa-retention"><b>Retention policy</b><small>{d.retentionDays} days</small></div>
            </aside>
          </div>
        )}
      </DataState>
    </div>
  );
}

/* ---------------- Router ---------------- */
export function AssistantPage({ section, id, search }: { section?: string; id?: string; search: URLSearchParams }) {
  if (section === "c" && id) return <ConversationView id={id} />;
  if (section === "folders") return id ? <FolderDetail id={id} /> : <FoldersView />;
  if (section === "investigations") return id ? <InvestigationDetail id={id} /> : <InvestigationsView />;
  if (section === "actions") return <ActionsView />;
  if (section === "brain") return id === "knowledge" ? <KnowledgeList block={search.get("block") || undefined} status={search.get("status") || undefined} /> : <BrainView />;
  if (section === "history") return <HistoryView />;
  return <AssistantHome />;
}

