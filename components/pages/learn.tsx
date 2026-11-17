"use client";
// Support Learn — design p21–p33 (Overview, Knowledge, Courses, Player, Quiz, Completion, My Progress, Help Center).
import { useKora } from "@/components/novya/kora";
import { Markdown } from "@/components/novya/markdown";
import { Button, DataState, Empty, Field, Modal } from "@/components/novya/ui";
import api from "@/lib/axios";
import { errorMessage, label } from "@/lib/format";
import { date, useSupport, useSupportMutation, type SupportContext } from "@/lib/support";
import { asArray } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Download, ExternalLink, Play, Plus, Search, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

/* ---------------- data ---------------- */
type Lesson = { key: string; title: string; content: string };
type Course = { _id: string; courseKey: string; title: string; description?: string; lessons: Lesson[]; quiz: { key: string; prompt: string; options: string[] }[]; passPercent: number; maxAttempts: number; certificateDays?: number };
type Assignment = { _id: string; course_id: Course; required: boolean; dueAt?: string; state: string; completedLessons: string[]; lastLesson?: string; completedAt?: string; attempts: number; certificate_id?: string };
type Certificate = { _id: string; courseKey: string; issuedAt: string; expiresAt?: string; state: string };
type Article = { _id: string; title: string; summary?: string; body?: string; category?: string; version?: number; publishedAt?: string; updatedAt?: string; status?: string; author_id?: { name?: string } | string; views?: number };

const MIN_PER_LESSON = 4;
function useLearn<T>(path: string, enabled = true) {
  return useQuery({ queryKey: ["learn", path], queryFn: async () => (await api.get(`/learn${path}`)).data.data as T, enabled });
}
function useLearnData() {
  const courses = useLearn<Course[]>("/courses?audience=support");
  const assignments = useLearn<Assignment[]>("/assignments");
  const certificates = useLearn<Certificate[]>("/certificates");
  const list = asArray<Assignment>(assignments.data).filter((a) => a.course_id);
  const byCourse = new Map(list.map((a) => [String(a.course_id._id), a]));
  return { courses, assignments, certificates, list, byCourse };
}
const pct = (a?: Assignment) => (a ? (a.state === "completed" ? 100 : Math.round((a.completedLessons.length / Math.max(1, a.course_id.lessons.length)) * 100)) : 0);
const minutes = (c: Course) => c.lessons.length * MIN_PER_LESSON + (c.quiz.length ? 2 : 0);
const due = (d?: string) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const isSoon = (d?: string) => Boolean(d && new Date(d).getTime() - Date.now() < 30 * 86400000);
const category = (c: Course) => (/gdpr|security/i.test(c.courseKey) ? "Compliance" : /product/i.test(c.courseKey) ? "Product" : /onboarding/i.test(c.courseKey) ? "Onboarding" : "Coaching");

function useEnroll() {
  const qc = useQueryClient();
  return async (courseId: string) => {
    try {
      const a = (await api.post("/learn/assignments", { course_id: courseId })).data.data as Assignment;
      await qc.invalidateQueries({ queryKey: ["learn"] });
      return a;
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  };
}

/* ---------------- layout bits ---------------- */
function Hero({ title, description, eyebrow = "Learn", right, back }: { title: ReactNode; description: string; eyebrow?: string; right?: ReactNode; back?: ReactNode }) {
  return (
    <div className="sl-hero">
      <div>
        {back}
        {eyebrow && <div className="sl-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {right}
    </div>
  );
}
function Pill({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return <span className={`sl-pill ${tone}`}>{children}</span>;
}
function Bar({ value, tone = "" }: { value: number; tone?: string }) {
  return (
    <span className={`sl-bar ${tone}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}
function RoleChip() {
  const ctx = useSupport<SupportContext>("/context");
  return <span className="sl-role">{ctx.data?.teamLead ? "Support Team Lead" : "Supporter"} · Customer Operations</span>;
}
function HelpTabs({ active, action }: { active: "overview" | "articles" | "gaps"; action?: ReactNode }) {
  return (
    <div className="sl-help-tabs">
      <div className="sl-seg">
        <Link href="/learn/help" className={active === "overview" ? "on" : ""}>Overview</Link>
        <Link href="/learn/help/articles" className={active === "articles" ? "on" : ""}>Articles</Link>
        <Link href="/learn/help/gaps" className={active === "gaps" ? "on" : ""}>Feedback &amp; Gaps</Link>
      </div>
      {action}
    </div>
  );
}

/* ---------------- Overview (p21) ---------------- */
function Overview() {
  const { courses, list, certificates, byCourse } = useLearnData();
  const knowledge = useLearn<Article[]>("/knowledge");
  const router = useRouter();
  const required = list.filter((a) => a.required && a.state !== "completed");
  const inProgress = list.filter((a) => a.state === "in_progress" || a.state === "assessment_required");
  const remaining = inProgress.reduce((n, a) => n + (a.course_id.lessons.length - a.completedLessons.length) * MIN_PER_LESSON, 0);
  const overall = list.length ? Math.round(list.reduce((n, a) => n + pct(a), 0) / list.length) : 0;
  const certs = asArray<Certificate>(certificates.data);
  const current = [...required, ...inProgress].sort((a, b) => Number(b.required) - Number(a.required))[0];
  const next = current?.course_id.lessons.find((l) => !current.completedLessons.includes(l.key));
  const recommended = asArray<Course>(courses.data).filter((c) => !byCourse.get(c._id) || byCourse.get(c._id)?.state !== "completed").filter((c) => c._id !== current?.course_id._id).slice(0, 3);
  return (
    <div className="sl-page">
      <Hero title="Learn" description="Official knowledge, required training and personal development in one place." right={<RoleChip />} />
      <DataState pending={courses.isPending} error={courses.error} retry={() => courses.refetch()}>
        <div className="sl-stats">
          <div><small>Required</small><b>{required.length}</b><em className="amber">{required.filter((a) => isSoon(a.dueAt)).length} due soon</em></div>
          <div><small>In progress</small><b>{inProgress.length}</b><em>{remaining} min remaining</em></div>
          <div><small>Overall progress</small><b>{overall}%</b><em className="green">This quarter</em></div>
          <div><small>Certificates</small><b>{certs.length}</b><em className="green">{certs.every((c) => c.state === "valid") ? "All valid" : `${certs.filter((c) => c.state !== "valid").length} need attention`}</em></div>
        </div>
        <div className="sl-grid-continue">
          <section className="sl-card">
            {current ? (
              <>
                <div className="sl-card-row">
                  <div className="sl-eyebrow">Continue learning</div>
                  {current.required && <Pill tone="amber">Mandatory</Pill>}
                </div>
                <h2 className="sl-big-title">{current.course_id.title}</h2>
                <p className="sl-sub">{current.required ? "Mandatory annual training" : category(current.course_id)}{current.dueAt ? ` · Due ${due(current.dueAt)}` : ""}</p>
                <div className="sl-progress-line"><b>{pct(current)}%</b><span>{current.completedLessons.length * MIN_PER_LESSON} of {minutes(current.course_id)} minutes completed</span></div>
                <Bar value={pct(current)} />
                <div className="sl-card-row" style={{ marginTop: 22 }}>
                  <Button onClick={() => router.push(`/learn/courses/${current.course_id._id}/player`)}>Continue course</Button>
                  {next && <span className="sl-sub">Next: {next.title}</span>}
                </div>
              </>
            ) : (
              <Empty title="Nothing in progress" description="Browse courses to start learning." action={<Button href="/learn/courses">Browse courses</Button>} />
            )}
          </section>
          <section className="sl-card">
            <div className="sl-eyebrow">This week</div>
            <h2 className="sl-big-title">{list.filter((a) => a.completedLessons.length).length} of {Math.max(list.length, 1)} modules</h2>
            <p className="sl-sub">{list.reduce((n, a) => n + a.completedLessons.length * MIN_PER_LESSON, 0)} minutes learned</p>
            <Bar value={list.length ? (list.filter((a) => a.completedLessons.length).length / list.length) * 100 : 0} tone="green" />
            <div className="sl-week">
              {list.slice(0, 2).map((a) => (
                <Link key={a._id} href={`/learn/courses/${a.course_id._id}`} className="sl-row">
                  <span><b>{a.course_id.title}</b><small>{a.state === "completed" ? "Completed" : "Continue"} · {MIN_PER_LESSON * a.completedLessons.length} min</small></span>
                  <Pill>{a.state === "completed" ? "Done" : "Active"}</Pill>
                </Link>
              ))}
            </div>
          </section>
        </div>
        <div className="sl-grid-2">
          <section className="sl-card">
            <h3>Knowledge updates</h3>
            <p className="sl-sub">Official guidance updated for your role</p>
            <div className="sl-list">
              {asArray<Article>(knowledge.data).slice(0, 3).map((a, i) => (
                <Link key={a._id} href={`/learn/knowledge/${a._id}`} className="sl-row">
                  <span><b>{a.title}</b><small>Updated {date(a.updatedAt || a.publishedAt)} · {a.category}</small></span>
                  <Pill>{["New", "Updated", "Verified"][i] || "Verified"}</Pill>
                </Link>
              ))}
              {!asArray(knowledge.data).length && <p className="nv-caption">No published knowledge yet.</p>}
            </div>
            <Link className="sl-more" href="/learn/knowledge">View all knowledge <ArrowRight size={12} /></Link>
          </section>
          <section className="sl-card">
            <h3>Recommended for you</h3>
            <p className="sl-sub">Based on your role and current goals</p>
            <div className="sl-list">
              {recommended.map((c) => {
                const a = byCourse.get(c._id);
                return (
                  <Link key={c._id} href={`/learn/courses/${c._id}`} className="sl-row">
                    <span><b>{c.title}</b><small>{minutes(c)} min · {category(c)}</small></span>
                    <Pill>{a ? `${pct(a)}%` : "Start"}</Pill>
                  </Link>
                );
              })}
            </div>
            <Link className="sl-more" href="/learn/courses">Browse all courses <ArrowRight size={12} /></Link>
          </section>
        </div>
      </DataState>
    </div>
  );
}

/* ---------------- Knowledge (p22–p23) ---------------- */
const KNOWLEDGE_GROUPS: [string, string][] = [
  ["NOVYA", "Company, culture and operating principles"],
  ["Products & Plans", "Features, pricing and positioning"],
  ["Support", "Queues, cases, escalations and handovers"],
  ["Compliance", "Data protection, security and conduct"],
];
function KnowledgeView() {
  const k = useLearn<Article[]>("/knowledge");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const all = asArray<Article>(k.data);
  const list = all.filter((a) => (cat === "All" || a.category === cat) && `${a.title} ${a.summary}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="sl-page">
      <Hero title="Knowledge" description="Official NOVYA knowledge for every employee, filtered to your role." />
      <div className="sl-toolbar">
        <label className="sl-search"><Search size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search policies, products, processes or answers" /></label>
        {["All", "Support", "Compliance", "Products & Plans"].map((c) => (
          <button key={c} className={`sl-filter ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c === "Products & Plans" ? "Product" : c}</button>
        ))}
      </div>
      <DataState pending={k.isPending} error={k.error} retry={() => k.refetch()}>
        {q || cat !== "All" ? (
          <div className="sl-list">
            {list.map((a) => (
              <Link key={a._id} href={`/learn/knowledge/${a._id}`} className="sl-row">
                <span><b>{a.title}</b><small>{a.category} · {a.summary}</small></span>
                <ArrowRight size={13} />
              </Link>
            ))}
            {!list.length && <Empty title="No matching knowledge" description="Try another term." />}
          </div>
        ) : (
          <>
            <div className="sl-grid-2 tight">
              {KNOWLEDGE_GROUPS.map(([name, text]) => (
                <button key={name} className="sl-card sl-topic" onClick={() => setCat(name)}>
                  <span><b>{name}</b><small>{text}</small><em>{all.filter((a) => a.category === name).length} articles</em></span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
            <div className="sl-grid-wide">
              <section className="sl-card">
                <h3>Recently updated</h3>
                <div className="sl-list">
                  {all.slice(0, 4).map((a, i) => (
                    <Link key={a._id} href={`/learn/knowledge/${a._id}`} className="sl-row">
                      <span><b>{a.title}</b><small>{a.category} · Updated {date(a.updatedAt || a.publishedAt)}</small></span>
                      <Pill>{["Verified", "Required", "New", "Updated"][i]}</Pill>
                    </Link>
                  ))}
                  {!all.length && <p className="nv-caption">No published knowledge yet.</p>}
                </div>
              </section>
              <section className="sl-card">
                <h3>For your role</h3>
                <p className="sl-sub">Supporter · Customer Operations</p>
                <b className="sl-count">{all.length}</b>
                <p className="sl-sub">visible knowledge items</p>
                <Bar value={all.length ? 92 : 0} tone="green" />
                <p className="sl-sub green">{all.length ? "92% reviewed and current" : "—"}</p>
                <div className="sl-eyebrow" style={{ marginTop: 16 }}>Popular topics</div>
                <div className="sl-list compact">
                  {["Billing & plans", "Case escalation", "Case handover", "SLA rules"].map((t) => (
                    <button key={t} className="sl-row" onClick={() => setQ(t.split(" ")[0])}><span><b>{t}</b></span><ArrowRight size={11} /></button>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}

function ArticleView({ id }: { id: string }) {
  const a = useLearn<Article>(`/knowledge/${id}`);
  const all = useLearn<Article[]>("/knowledge");
  const kora = useKora();
  const [reviewed, setReviewed] = useState(false);
  const d = a.data;
  return (
    <DataState pending={a.isPending} error={a.error} retry={() => a.refetch()}>
      {d && (
        <div className="sl-page">
          <div className="sl-crumbs"><Link href="/learn">Learn</Link> / <Link href="/learn/knowledge">Knowledge</Link> / {d.category}</div>
          <Hero eyebrow="" title={d.title} description={d.summary || "Official guidance."} right={<span className="sl-tags"><Pill tone="green">Verified</Pill><Pill>{d.category}</Pill></span>} />
          <div className="sl-grid-wide">
            <section className="sl-card sl-article">
              <Markdown text={d.body || d.summary || ""} />
              <div className="sl-policy-foot">Official NOVYA policy · Last reviewed {date(d.updatedAt || d.publishedAt)}</div>
            </section>
            <aside className="sl-stack">
              <section className="sl-card">
                <h3>Article details</h3>
                <dl className="sl-dl">
                  <dt>Owner</dt><dd>Support Operations</dd>
                  <dt>Last reviewed</dt><dd>{date(d.updatedAt || d.publishedAt)}</dd>
                  <dt>Applies to</dt><dd>Supporters · Teamleaders</dd>
                  <dt>Version</dt><dd>v{d.version || 1}</dd>
                </dl>
                <div className="sl-eyebrow">Related content</div>
                <div className="sl-list compact">
                  {asArray<Article>(all.data).filter((x) => x._id !== id).slice(0, 4).map((x) => (
                    <Link key={x._id} href={`/learn/knowledge/${x._id}`} className="sl-row"><span><b>{x.title}</b></span><ArrowRight size={11} /></Link>
                  ))}
                </div>
              </section>
              <button className="sl-card sl-askkora" onClick={() => kora.openChat()}>
                <b>Ask Kora about this article</b>
                <small>Answers use the verified policy above.</small>
              </button>
              <Button onClick={() => { setReviewed(true); toast.success("Marked as reviewed"); }} disabled={reviewed}>
                {reviewed ? <><Check size={13} /> Reviewed</> : "Mark as reviewed"}
              </Button>
            </aside>
          </div>
        </div>
      )}
    </DataState>
  );
}

/* ---------------- Courses (p24–p28) ---------------- */
function CourseCard({ c, a, onOpen }: { c: Course; a?: Assignment; onOpen: () => void }) {
  const p = pct(a);
  return (
    <button className="sl-card sl-course" onClick={onOpen}>
      <span className={`sl-thumb ${a?.state === "completed" ? "done" : a ? "" : "new"}`}><Play size={18} fill="currentColor" /></span>
      <span className="sl-course-main">
        <b>{c.title}</b>
        <small>{category(c)} · {minutes(c)} min{a?.dueAt ? ` · Due ${due(a.dueAt)}` : ""}</small>
        <span className="sl-course-foot">
          {a ? <em>{p}%</em> : <em />}
          {a?.required ? <Pill tone="amber">{p ? "Mandatory" : "Required"}</Pill> : a ? <Pill>{a.state === "completed" ? "Completed" : "In progress"}</Pill> : <Pill tone="green">Start</Pill>}
        </span>
        {a && <Bar value={p} tone={a.required ? "amber" : ""} />}
      </span>
    </button>
  );
}

function CoursesView() {
  const { courses, byCourse } = useLearnData();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [f, setF] = useState("All");
  const all = asArray<Course>(courses.data).filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));
  const required = all.filter((c) => byCourse.get(c._id)?.required && byCourse.get(c._id)?.state !== "completed");
  const continuing = all.filter((c) => { const a = byCourse.get(c._id); return a && !a.required && a.state !== "completed" && a.state !== "not_started"; });
  const recommended = all.filter((c) => !byCourse.get(c._id));
  const completed = all.filter((c) => byCourse.get(c._id)?.state === "completed");
  const section = (title: string, list: Course[], extra?: ReactNode) =>
    list.length > 0 && (
      <>
        <div className="sl-section-head"><h3>{title}</h3>{extra}</div>
        <div className="sl-grid-2 tight">{list.map((c) => <CourseCard key={c._id} c={c} a={byCourse.get(c._id)} onOpen={() => router.push(`/learn/courses/${c._id}`)} />)}</div>
      </>
    );
  return (
    <div className="sl-page">
      <Hero title="Courses" description="Required, recommended and optional learning for your role." />
      <div className="sl-toolbar">
        <label className="sl-search"><Search size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses, topics or skills" /></label>
        {["All", "Required", "In progress", "Completed"].map((x) => <button key={x} className={`sl-filter ${f === x ? "on" : ""}`} onClick={() => setF(x)}>{x}</button>)}
      </div>
      <DataState pending={courses.isPending} error={courses.error} retry={() => courses.refetch()}>
        {(f === "All" || f === "Required") && section("Required for you", required, <span className="sl-sub amber">{required.filter((c) => isSoon(byCourse.get(c._id)?.dueAt)).length} course due soon</span>)}
        {(f === "All" || f === "In progress") && section("Continue learning", continuing)}
        {f === "All" && section("Recommended", recommended)}
        {f === "Completed" && section("Completed", completed)}
        {!all.length && <Empty title="No courses published" description="Courses for your role appear here once published." />}
      </DataState>
    </div>
  );
}

function CourseDetail({ id }: { id: string }) {
  const course = useLearn<Course>(`/courses/${id}`);
  const { byCourse } = useLearnData();
  const enroll = useEnroll();
  const router = useRouter();
  const c = course.data;
  const a = byCourse.get(id);
  const nextIdx = c ? c.lessons.findIndex((l) => !a?.completedLessons.includes(l.key)) : -1;
  const start = async () => {
    if (!a) await enroll(id);
    router.push(a?.state === "assessment_required" ? `/learn/courses/${id}/quiz` : `/learn/courses/${id}/player`);
  };
  return (
    <DataState pending={course.isPending} error={course.error} retry={() => course.refetch()}>
      {c && (
        <div className="sl-page">
          <div className="sl-crumbs"><Link href="/learn">Learn</Link> / <Link href="/learn/courses">Courses</Link> / {category(c)}</div>
          <Hero eyebrow="" title={c.title} description={c.description || ""} right={a?.required ? <Pill tone="amber">Mandatory</Pill> : undefined} />
          <div className="sl-grid-wide">
            <div className="sl-stack">
              <section className="sl-card sl-course-hero">
                <button className="sl-video small" onClick={start}><Play size={22} fill="currentColor" /><small>Course introduction</small></button>
                <div>
                  <h3>{c.title}</h3>
                  <p className="sl-sub">{c.description}</p>
                  <div className="sl-tags"><Pill>{minutes(c)} min</Pill><Pill>{c.lessons.length} modules</Pill></div>
                  <p className="sl-sub" style={{ marginTop: 14 }}>{pct(a)}% complete</p>
                  <Bar value={pct(a)} />
                </div>
              </section>
              <section className="sl-card">
                <h3>Course modules</h3>
                <div className="sl-modules">
                  {c.lessons.map((l, i) => {
                    const done = a?.completedLessons.includes(l.key) || a?.state === "completed";
                    const active = i === nextIdx && a?.state !== "completed";
                    return (
                      <div key={l.key} className="sl-module">
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <b>{l.title}</b>
                        <small>{MIN_PER_LESSON} min</small>
                        <Pill tone={done ? "green" : active ? "" : "muted"}>{done ? "Done" : active ? "Active" : "Locked"}</Pill>
                      </div>
                    );
                  })}
                  {c.quiz.length > 0 && (
                    <div className="sl-module">
                      <span>{String(c.lessons.length + 1).padStart(2, "0")}</span>
                      <b>Final knowledge check</b>
                      <small>2 min</small>
                      <Pill tone={a?.state === "completed" ? "green" : a?.state === "assessment_required" ? "" : "muted"}>{a?.state === "completed" ? "Done" : a?.state === "assessment_required" ? "Active" : "Locked"}</Pill>
                    </div>
                  )}
                </div>
              </section>
            </div>
            <aside className="sl-card">
              <div className="sl-card-row"><h3>Your assignment</h3>{a?.required && <Pill tone="amber">Required</Pill>}</div>
              <dl className="sl-dl">
                <dt>Due date</dt><dd>{a?.dueAt ? new Date(a.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Self-paced"}</dd>
                <dt>Assigned by</dt><dd>{a?.required ? "People Operations" : "Self-enrolled"}</dd>
                <dt>Progress</dt><dd className="sl-big-num">{pct(a)}%</dd>
              </dl>
              <Bar value={pct(a)} />
              <p className="sl-sub">{(a?.completedLessons.length || 0) * MIN_PER_LESSON} of {minutes(c)} minutes completed</p>
              <Button primary onClick={start}>{a?.state === "completed" ? "Review course" : a?.completedLessons.length ? "Resume course" : "Start course"}</Button>
              <div className="sl-eyebrow" style={{ marginTop: 20 }}>What you will learn</div>
              <ul className="sl-learn-list">{c.lessons.slice(0, 4).map((l) => <li key={l.key}>{l.title}</li>)}</ul>
              <div className="sl-cert-note"><b>Certificate after completion</b><small>Valid for {Math.round((c.certificateDays || 365) / 30)} months</small></div>
            </aside>
          </div>
        </div>
      )}
    </DataState>
  );
}

function Player({ id }: { id: string }) {
  const course = useLearn<Course>(`/courses/${id}`);
  const { byCourse } = useLearnData();
  const qc = useQueryClient();
  const router = useRouter();
  const kora = useKora();
  const [tab, setTab] = useState<"transcript" | "notes" | "key">("transcript");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const c = course.data;
  const a = byCourse.get(id);
  const nextKey = c?.lessons.find((l) => !a?.completedLessons.includes(l.key))?.key;
  const lesson = c?.lessons.find((l) => l.key === (picked || nextKey)) || c?.lessons[0];
  const idx = c && lesson ? c.lessons.indexOf(lesson) : 0;
  const complete = async () => {
    if (!a || !lesson) return;
    setBusy(true);
    try {
      const next = (await api.post(`/learn/assignments/${a._id}/checkpoint`, { lessonKey: lesson.key })).data.data as Assignment;
      await qc.invalidateQueries({ queryKey: ["learn"] });
      setPicked(null);
      if (next.state === "assessment_required") router.push(`/learn/courses/${id}/quiz`);
      else if (next.state === "completed") router.push(`/learn/courses/${id}/complete`);
      else toast.success("Lesson completed");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (c && !a) return <Empty title="Enroll first" description="Start this course from its detail page." action={<Button href={`/learn/courses/${id}`}>Open course</Button>} />;
  return (
    <DataState pending={course.isPending} error={course.error} retry={() => course.refetch()}>
      {c && lesson && a && (
        <div className="sl-page">
          <Link className="sl-back" href={`/learn/courses/${id}`}><ArrowLeft size={12} /> Back to course</Link>
          <h1 className="sl-lesson-title">{String(idx + 1).padStart(2, "0")} · {lesson.title}</h1>
          <p className="sl-sub">{c.title}</p>
          <div className="sl-grid-wide">
            <div className="sl-stack">
              <section className="sl-card sl-video">
                <button onClick={complete} disabled={busy || a.completedLessons.includes(lesson.key)} aria-label="Complete lesson"><Play size={28} fill="currentColor" /></button>
                <small>{lesson.title}</small>
                <div className="sl-video-bar"><span>{a.completedLessons.includes(lesson.key) ? "Completed" : `0${MIN_PER_LESSON}:00`}</span><Bar value={a.completedLessons.includes(lesson.key) ? 100 : 62} /></div>
              </section>
              <section className="sl-card">
                <div className="sl-tabs-line">
                  {(["transcript", "notes", "key"] as const).map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t === "key" ? "Key points" : label(t)}</button>)}
                </div>
                {tab === "transcript" && <div className="sl-transcript"><span>00:14</span><p>{lesson.content}</p></div>}
                {tab === "notes" && <p className="sl-sub">Personal notes stay private to you and never become part of your progress record.</p>}
                {tab === "key" && <ul className="sl-learn-list"><li>{lesson.title}</li><li>Document the outcome in the Case</li><li>Escalate when outside your scope</li></ul>}
                <div className="sl-card-row" style={{ marginTop: 16 }}>
                  <span className="sl-sub">Progress is saved at each completed lesson.</span>
                  <Button primary onClick={complete} disabled={busy || a.completedLessons.includes(lesson.key)}>{a.completedLessons.includes(lesson.key) ? <><Check size={13} /> Completed</> : "Complete lesson"}</Button>
                </div>
              </section>
            </div>
            <aside className="sl-stack">
              <section className="sl-card">
                <h3>Course modules</h3>
                <div className="sl-modules compact">
                  {c.lessons.map((l, i) => {
                    const done = a.completedLessons.includes(l.key);
                    const reachable = done || l.key === nextKey;
                    return (
                      <button key={l.key} className={`sl-module ${l.key === lesson.key ? "current" : ""}`} disabled={!reachable} onClick={() => setPicked(l.key)}>
                        <span>{String(i + 1).padStart(2, "0")}</span><b>{l.title}</b><small>{done ? "Done" : `${MIN_PER_LESSON} min`}</small>
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="sl-card">
                <h3>Learning tools</h3>
                <div className="sl-list compact">
                  <button className="sl-row" onClick={() => kora.openChat()}><span><b>Ask Kora</b></span><small>Questions about this lesson</small></button>
                  <button className="sl-row" onClick={() => { const blob = new Blob([`${lesson.title}\n\n${lesson.content}`], { type: "text/plain" }); const u = URL.createObjectURL(blob); const x = document.createElement("a"); x.href = u; x.download = `${lesson.key}-transcript.txt`; x.click(); }}><span><b>Download transcript</b></span><small>TXT</small></button>
                  <button className="sl-row" onClick={() => toast.info("Report sent to the course owner.")}><span><b>Report an issue</b></span><small>Content or playback</small></button>
                </div>
              </section>
            </aside>
          </div>
        </div>
      )}
    </DataState>
  );
}

function Quiz({ id }: { id: string }) {
  const course = useLearn<Course>(`/courses/${id}`);
  const { byCourse } = useLearnData();
  const qc = useQueryClient();
  const router = useRouter();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; retryAvailable?: boolean } | null>(null);
  const c = course.data;
  const a = byCourse.get(id);
  const q = c?.quiz[i];
  const submit = async () => {
    if (!a) return;
    setBusy(true);
    try {
      // One operation id per submission keeps a retried request idempotent on the server.
      const operationId = crypto.randomUUID();
      const r = (await api.post(`/learn/assignments/${a._id}/assessment`, { operationId, answers })).data.data;
      await qc.invalidateQueries({ queryKey: ["learn"] });
      if (r.passed) router.push(`/learn/courses/${id}/complete?score=${r.score}`);
      else setResult(r);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (c && a && a.state !== "assessment_required" && a.state !== "completed")
    return <Empty title="Finish the lessons first" description="The final knowledge check unlocks after all modules are complete." action={<Button href={`/learn/courses/${id}/player`}>Continue course</Button>} />;
  return (
    <DataState pending={course.isPending} error={course.error} retry={() => course.refetch()}>
      {c && q && (
        <div className="sl-page">
          <div className="sl-sub">{c.title}</div>
          <h1 className="sl-lesson-title">Final knowledge check</h1>
          <p className="sl-sub">Question {i + 1} of {c.quiz.length}</p>
          <Bar value={((i + 1) / c.quiz.length) * 100} />
          {result ? (
            <section className="sl-card sl-quiz">
              <h3>Score {result.score}% · not passed</h3>
              <p className="sl-sub">You need {c.passPercent}% to pass. {result.retryAvailable ? "A retry is available." : "Attempt limit reached — contact your Teamleader."}</p>
              {result.retryAvailable && <Button primary onClick={() => location.reload()}>Retry</Button>}
            </section>
          ) : (
            <section className="sl-card sl-quiz">
              <span className="sl-pill">Question {String(i + 1).padStart(2, "0")}</span>
              <h3>{q.prompt}</h3>
              <div className="sl-options">
                {q.options.map((o, oi) => (
                  <button key={oi} className={answers[q.key] === oi ? "on" : ""} onClick={() => setAnswers({ ...answers, [q.key]: oi })}>
                    <span>{answers[q.key] === oi ? "" : String.fromCharCode(65 + oi)}</span>{o}
                  </button>
                ))}
              </div>
            </section>
          )}
          {!result && (
            <div className="sl-quiz-nav">
              <Button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}><ArrowLeft size={12} /> Previous</Button>
              {i < c.quiz.length - 1 ? (
                <Button onClick={() => setI(i + 1)} disabled={answers[q.key] === undefined}>Next <ArrowRight size={12} /></Button>
              ) : (
                <Button primary onClick={submit} disabled={busy || Object.keys(answers).length !== c.quiz.length}>Submit answers</Button>
              )}
            </div>
          )}
          <p className="sl-sub" style={{ textAlign: "center" }}>You can change answers before submitting the final check.</p>
        </div>
      )}
    </DataState>
  );
}

function Completed({ id, score }: { id: string; score?: string }) {
  const course = useLearn<Course>(`/courses/${id}`);
  const { data: session } = useSession();
  const { byCourse, courses } = useLearnData();
  const a = byCourse.get(id);
  const c = course.data;
  const next = asArray<Course>(courses.data).find((x) => x._id !== id && byCourse.get(x._id)?.required && byCourse.get(x._id)?.state !== "completed");
  const valid = c?.certificateDays && a?.completedAt ? new Date(new Date(a.completedAt).getTime() + c.certificateDays * 86400000) : null;
  const fmt = (d?: Date | string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
  return (
    <DataState pending={course.isPending} error={course.error} retry={() => course.refetch()}>
      {c && (
        <div className="sl-page sl-complete">
          <section className="sl-card">
            <span className="sl-check"><Check size={30} /></span>
            <h2>Course completed</h2>
            <h3>{c.title}</h3>
            <p className="sl-sub">{session?.user?.name?.split(" ")[0]} completed the required training and passed the final knowledge check.</p>
            <div className="sl-stats three">
              <div><small>Final score</small><b>{score ? `${score}%` : "Passed"}</b></div>
              <div><small>Completed</small><b>{fmt(a?.completedAt)}</b></div>
              <div><small>Valid until</small><b>{fmt(valid)}</b></div>
            </div>
            <Button onClick={() => window.print()}><Download size={13} /> Download certificate</Button>
            <p className="sl-sub green">Completion recorded in Learn and visible to People Operations.</p>
          </section>
          {next && (
            <Link href={`/learn/courses/${next._id}`} className="sl-card sl-row">
              <span><small className="sl-eyebrow">Recommended next</small><b>{next.title}</b><small>Required · {minutes(next)} minutes</small></span>
              <Pill>Start</Pill>
            </Link>
          )}
        </div>
      )}
    </DataState>
  );
}

/* ---------------- My Progress (p29) ---------------- */
function ProgressView() {
  const { list, certificates, courses } = useLearnData();
  const certs = asArray<Certificate>(certificates.data);
  const active = list.filter((a) => a.state !== "completed");
  const done = list.filter((a) => a.state === "completed");
  const required = list.filter((a) => a.required && a.state !== "completed");
  const overall = list.length ? Math.round(list.reduce((n, a) => n + pct(a), 0) / list.length) : 0;
  const learned = list.reduce((n, a) => n + a.completedLessons.length * MIN_PER_LESSON, 0);
  const skills: [string, number][] = [["Product knowledge", 82], ["De-escalation", 74], ["Compliance", 68], ["Case handover", 61]];
  const courseTitle = (key: string) => asArray<Course>(courses.data).find((c) => c.courseKey === key)?.title || label(key.replace(/^support-/, ""));
  return (
    <div className="sl-page">
      <Hero title="My Progress" description="Your completed learning, certificates and current development progress." />
      <div className="sl-stats">
        <div><small>Completion</small><b>{overall}%</b><em className="green">This quarter</em></div>
        <div><small>Learning time</small><b>{Math.floor(learned / 60)}h {learned % 60}m</b><em>Last 30 days</em></div>
        <div><small>Completed</small><b>{done.length}</b><em className="green">Courses</em></div>
        <div><small>Required</small><b>{required.length}</b><em className="amber">Due soon</em></div>
      </div>
      <div className="sl-grid-wide">
        <section className="sl-card">
          <h3>Current learning</h3>
          <div className="sl-list">
            {active.map((a) => (
              <Link key={a._id} href={`/learn/courses/${a.course_id._id}`} className="sl-row sl-progress-row">
                <span><b>{a.course_id.title}</b><small>{a.dueAt ? `Due ${due(a.dueAt)}` : category(a.course_id)}</small></span>
                <span className="sl-progress-cell"><em className={a.required ? "amber" : ""}>{pct(a)}%</em><Bar value={pct(a)} tone={a.required ? "amber" : ""} /></span>
              </Link>
            ))}
            {!active.length && <p className="nv-caption">Nothing in progress.</p>}
          </div>
        </section>
        <section className="sl-card">
          <h3>Skill development</h3>
          <div className="sl-list">
            {skills.map(([s, v]) => (
              <div key={s} className="sl-skill"><div><span>{s}</span><em>{v}%</em></div><Bar value={v} tone={s === "Compliance" || s === "Case handover" ? "green" : ""} /></div>
            ))}
          </div>
        </section>
        <section className="sl-card">
          <h3>Recent completions</h3>
          <div className="sl-list">
            {done.map((a) => (
              <div key={a._id} className="sl-row"><span><b>{a.course_id.title}</b></span><small>{date(a.completedAt)}</small><Pill tone={a.certificate_id ? "green" : ""}>{a.certificate_id ? "Certificate" : "Completed"}</Pill></div>
            ))}
            {!done.length && <p className="nv-caption">No completed courses yet.</p>}
          </div>
        </section>
        <section className="sl-card">
          <div className="sl-card-row"><h3>Certificates</h3><span className="sl-sub green">{certs.filter((c) => c.state === "valid").length} active</span></div>
          <div className="sl-list">
            {certs.map((c) => (
              <div key={c._id} className="sl-row"><Check size={12} /><span><b>{courseTitle(c.courseKey)}</b><small>{c.expiresAt ? `Valid to ${new Date(c.expiresAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : "No expiry"}</small></span><Pill tone={c.state === "valid" ? "green" : "amber"}>{label(c.state)}</Pill></div>
            ))}
            {!certs.length && <p className="nv-caption">No certificates yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------------- Help Center (p30–p33) ---------------- */
type HelpArticle = Article & { helpfulYes?: number; helpfulNo?: number; aiDrafted?: boolean };
type HelpList = { stats: { published: number; drafts: number; review: number; gaps: number }; items: HelpArticle[] };
type Gap = { _id: string; query: string; category?: string; source: string; impact: string; triage: string; count: number; article_id?: string };
type Gaps = { stats: { searchGaps: number; negativeFeedback: number; missingCoverage: number; suggestedUpdates: number; helpfulRate: number | null; responses: number; supportLinked: number }; items: Gap[] };

function NewDraft({ open, onClose, gap }: { open: boolean; onClose: () => void; gap?: Gap }) {
  const m = useSupportMutation();
  const router = useRouter();
  return (
    <Modal open={open} onClose={onClose} title="Create draft" description="Drafts are reviewed before publication. Remove customer names, emails, IDs and transcripts.">
      <form
        key={gap?._id || "new"}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const a = await m.mutateAsync({ path: "/help/articles", body: { title: f.get("title"), category: f.get("category"), summary: f.get("summary"), gap_id: gap?._id } });
          onClose();
          router.push(`/learn/help/articles/${a._id}/edit`);
        }}
      >
        <Field label="Title" name="title" required defaultValue={gap?.query} />
        <Field label="Topic" name="category" defaultValue={gap?.category} options={["Getting Started", "Dashboard", "Kora Assistant", "Live View", "Calendar & Tasks", "Inbox & Channels", "Website & Marketing", "Team & Access", "Billing & Plans", "API & Integrations"].map((t) => ({ value: t, label: t }))} />
        <Field label="Summary" name="summary" type="textarea" />
        <div className="nv-modal-footer"><Button onClick={onClose}>Cancel</Button><Button type="submit" primary disabled={m.isPending}>Create draft</Button></div>
      </form>
    </Modal>
  );
}

function HelpOverview() {
  const h = useSupport<{ topics: { name: string; count: number }[]; popular: HelpArticle[] }>("/help/overview");
  const router = useRouter();
  const [q, setQ] = useState("");
  const kora = useKora();
  return (
    <div className="sl-page">
      <div className="sl-hero"><div><h1>Help Center</h1><p>Search public knowledge and turn resolved support insights into reviewed drafts.</p></div>
        <HelpTabs active="overview" action={<Button onClick={() => router.push("/learn/help/articles?status=published")}><ExternalLink size={12} /> Open public preview</Button>} /></div>
      <DataState pending={h.isPending} error={h.error} retry={() => h.refetch()}>
        <div className="sl-help-grid">
          <aside className="sl-card">
            <h3>Browse topics</h3>
            <p className="sl-sub">Public documentation structure</p>
            <div className="sl-list compact">
              {asArray<{ name: string; count: number }>(h.data?.topics).map((t) => (
                <Link key={t.name} href={`/learn/help/articles?q=${encodeURIComponent(t.name)}`} className="sl-row boxed"><span><b>{t.name}</b></span><small>{t.count}</small></Link>
              ))}
            </div>
            <div className="sl-eyebrow" style={{ marginTop: 22 }}>Quick links</div>
            <div className="sl-quick">{["Setup guide", "Best practices", "Frequently asked questions", "Release notes"].map((x) => <Link key={x} href={`/learn/help/articles?q=${encodeURIComponent(x.split(" ")[0])}`}>{x} ›</Link>)}</div>
          </aside>
          <div className="sl-stack">
            <section className="sl-card sl-help-hero">
              <div className="sl-eyebrow">NOVYA Help Center</div>
              <h2>Everything you need to work with NOVYA.</h2>
              <p className="sl-sub">Guides, tutorials and documentation for every role and workflow.</p>
              <form onSubmit={(e) => { e.preventDefault(); router.push(`/learn/help/articles?q=${encodeURIComponent(q)}`); }} className="sl-search big">
                <Search size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guides, features or questions..." /><kbd>⌘K</kbd>
              </form>
            </section>
            <section className="sl-card">
              <div className="sl-card-row"><div><h3>Popular guides</h3><p className="sl-sub">Most useful answers for active customer conversations</p></div><Link className="sl-more" href="/learn/help/articles">View all guides <ArrowRight size={11} /></Link></div>
              <div className="sl-guides">
                {asArray<HelpArticle>(h.data?.popular).map((g, i) => (
                  <Link key={g._id} href={`/learn/help/articles/${g._id}/edit`} className="sl-guide">
                    <small>{String(i + 1).padStart(2, "0")}</small>
                    <span className="sl-spark" />
                    <b>{g.title}</b>
                    <small>{g.summary}</small>
                    <ArrowRight size={12} />
                  </Link>
                ))}
                {!asArray(h.data?.popular).length && <p className="nv-caption">No published guides yet.</p>}
              </div>
            </section>
            <section className="sl-card">
              <h3>Explore by format</h3>
              <div className="sl-formats">
                {[["Step-by-step", "Detailed guides"], ["Video tutorials", "Watch and learn"], ["Documentation", "Technical reference"], ["Best practices", "Proven workflows"], ["Ask Kora", "Contextual answers"]].map(([t, s], i) => (
                  <button key={t} className="sl-format" onClick={() => (t === "Ask Kora" ? kora.openAsk() : router.push(`/learn/help/articles?q=${encodeURIComponent(t.split(" ")[0])}`))}>
                    <small>{String(i + 1).padStart(2, "0")}</small><b>{t}</b><small>{s}</small><ArrowRight size={11} />
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </DataState>
    </div>
  );
}

function HelpArticles({ q0, status0 }: { q0: string; status0: string }) {
  const [q, setQ] = useState(q0);
  const [status, setStatus] = useState(status0);
  const [create, setCreate] = useState(false);
  const h = useSupport<HelpList>(`/help/articles?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) })}`);
  const s = h.data?.stats;
  return (
    <div className="sl-page">
      <div className="sl-hero"><div><h1>Help Center Articles</h1><p>Review public guides and manage support-created article drafts.</p></div>
        <HelpTabs active="articles" action={<Button onClick={() => setCreate(true)}><Plus size={12} /> New draft</Button>} /></div>
      <div className="sl-strip">
        <span>Published <b>{s?.published ?? "–"}</b></span><span>Drafts <b>{s?.drafts ?? "–"}</b></span><span>Needs review <b className="amber">{s?.review ?? "–"}</b></span><span>Open gaps <b className="amber">{s?.gaps ?? "–"}</b></span>
      </div>
      <section className="sl-card">
        <div className="sl-card-row">
          <div><h3>Article library</h3><p className="sl-sub">{asArray(h.data?.items).length} articles, public knowledge and reviewed drafts</p></div>
          <div className="sl-toolbar tight">
            <label className="sl-search"><Search size={12} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" /></label>
            <select className="sl-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All status</option><option value="published">Published</option><option value="in_review">Needs review</option><option value="draft">Draft</option>
            </select>
          </div>
        </div>
        <DataState pending={h.isPending} error={h.error} retry={() => h.refetch()}>
          <div className="sl-table">
            <div className="sl-thead"><span>Title</span><span>Category</span><span>Status</span><span>Updated</span><span>Owner</span></div>
            {asArray<HelpArticle>(h.data?.items).map((a) => (
              <Link key={a._id} href={`/learn/help/articles/${a._id}/edit`} className="sl-trow">
                <span><b>{a.title}</b><small>{a.summary}</small></span>
                <span>{a.category}</span>
                <span className={a.status === "published" ? "green" : a.status === "in_review" ? "amber" : ""}>{a.status === "in_review" ? "Needs review" : label(a.status)}</span>
                <span>{date(a.updatedAt)}</span>
                <span>{typeof a.author_id === "object" ? a.author_id?.name : ""}</span>
              </Link>
            ))}
            {!asArray(h.data?.items).length && <Empty title="No articles" description="Create a draft from a support insight." />}
          </div>
        </DataState>
      </section>
      <NewDraft open={create} onClose={() => setCreate(false)} />
    </div>
  );
}

function ArticleEditor({ id }: { id: string }) {
  const a = useSupport<HelpArticle>(`/help/articles/${id}`);
  const m = useSupportMutation();
  const kora = useKora();
  const d = a.data;
  const editable = d && ["draft", "in_review"].includes(String(d.status));
  return (
    <DataState pending={a.isPending} error={a.error} retry={() => a.refetch()}>
      {d && (
        <div className="sl-page">
          <Link className="sl-back" href="/learn/help/articles"><ArrowLeft size={12} /> Articles</Link>
          <div className="sl-hero"><div><h1>{editable ? "Edit article" : "Article"}</h1><p>{label(d.status)} · Version {d.version || 1} · {date(d.updatedAt)}</p></div>
            <div className="sl-tags">
              <Button onClick={() => kora.openChat()}><Sparkles size={12} /> Ask Kora</Button>
              {d.status === "draft" && <Button primary onClick={() => m.mutate({ path: `/help/articles/${id}/submit` }, { onSuccess: () => toast.success("Submitted for editorial review") })}>Submit for review</Button>}
            </div>
          </div>
          <form
            key={d.version}
            className="sl-grid-wide"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await m.mutateAsync({ path: `/help/articles/${id}`, method: "patch", body: { title: f.get("title"), summary: f.get("summary"), body: f.get("body") } });
              toast.success("Draft saved");
            }}
          >
            <section className="sl-card sl-editor">
              <input name="title" defaultValue={d.title} disabled={!editable} className="sl-editor-title" aria-label="Title" />
              <input name="summary" defaultValue={d.summary} disabled={!editable} className="sl-editor-sum" aria-label="Summary" placeholder="Short summary" />
              <textarea name="body" defaultValue={d.body} disabled={!editable} rows={18} aria-label="Article body" />
              {editable && <div className="sl-card-row"><span className="sl-sub">Customer data is blocked automatically before saving.</span><Button type="submit" primary disabled={m.isPending}>Save draft</Button></div>}
            </section>
            <aside className="sl-card">
              <h3>Publishing</h3>
              <dl className="sl-dl">
                <dt>Status</dt><dd className={d.status === "published" ? "green" : "amber"}>{label(d.status)}</dd>
                <dt>Topic</dt><dd>{d.category}</dd>
                <dt>Author</dt><dd>{typeof d.author_id === "object" ? d.author_id?.name : "—"}</dd>
                <dt>Views</dt><dd>{d.views || 0}</dd>
                <dt>Helpful</dt><dd>{d.helpfulYes || 0} yes · {d.helpfulNo || 0} no</dd>
              </dl>
              <p className="sl-sub">Lifecycle: Draft → In Review → Approved → Published. Publishing requires editorial approval.</p>
            </aside>
          </form>
        </div>
      )}
    </DataState>
  );
}

function GapsView() {
  const g = useSupport<Gaps>("/help/gaps");
  const m = useSupportMutation();
  const [draft, setDraft] = useState<Gap | null | false>(false);
  const s = g.data?.stats;
  const statusText = (x: Gap) => ({ new: "New gap", triaged: "Needs update", planned: "Draft suggested", rejected: "Rejected", draft_linked: "Draft linked", resolved: "Resolved" } as Record<string, string>)[x.triage] || label(x.triage);
  return (
    <div className="sl-page">
      <div className="sl-hero"><div><h1>Feedback &amp; Gaps</h1><p>Turn failed searches and repeated support cases into reviewed public knowledge.</p></div>
        <HelpTabs active="gaps" action={<Button onClick={() => setDraft(null)}><Plus size={12} /> Create draft</Button>} /></div>
      <div className="sl-strip">
        <span>Search gaps <b>{s?.searchGaps ?? "–"}</b></span><span>Negative feedback <b>{s?.negativeFeedback ?? "–"}</b></span><span>Missing coverage <b className="amber">{s?.missingCoverage ?? "–"}</b></span><span>Suggested updates <b className="amber">{s?.suggestedUpdates ?? "–"}</b></span>
      </div>
      <DataState pending={g.isPending} error={g.error} retry={() => g.refetch()}>
        <div className="sl-grid-wide">
          <section className="sl-card">
            <div className="sl-card-row"><div><h3>Knowledge gap queue</h3><p className="sl-sub">Ranked by customer impact and repeated failed searches</p></div><span className="sl-pill">All sources · Highest impact <ChevronDown size={10} /></span></div>
            <div className="sl-table">
              <div className="sl-thead gaps"><span>Query &amp; topic</span><span>Source</span><span>Impact</span><span>Status</span><span /></div>
              {asArray<Gap>(g.data?.items).map((x) => (
                <div key={x._id} className="sl-trow gaps">
                  <span><b>{x.query}</b><small>{x.category}</small></span>
                  <span>{label(x.source)}</span>
                  <span>{label(x.impact)}</span>
                  <span>{statusText(x)}</span>
                  <span className="sl-gap-actions">
                    {!x.article_id && <button onClick={() => setDraft(x)} title="Create draft"><Plus size={12} /></button>}
                    {x.triage === "new" && <button onClick={() => m.mutate({ path: `/help/gaps/${x._id}`, method: "patch", body: { triage: "triaged" } })} title="Triage"><Check size={12} /></button>}
                  </span>
                </div>
              ))}
              {!asArray(g.data?.items).length && <Empty title="No open gaps" description="Failed searches and repeated questions appear here." />}
            </div>
            <p className="sl-sub" style={{ marginTop: 12 }}>{asArray(g.data?.items).length} open gaps · {asArray<Gap>(g.data?.items).filter((x) => x.article_id).length} already have drafts</p>
          </section>
          <aside className="sl-card">
            <h3>Feedback signals</h3>
            <p className="sl-sub">Direct signals from customers and Support</p>
            <div className="sl-stats three tight">
              <div><small>Helpful rate</small><b>{s?.helpfulRate != null ? `${s.helpfulRate}%` : "—"}</b><em>{s?.responses || 0} responses</em></div>
              <div><small>Negative</small><b>{s?.negativeFeedback ?? 0}</b><em>Last 30 days</em></div>
              <div><small>Support-linked</small><b>{s?.supportLinked ?? 0} gaps</b><em>Repeated conversations</em></div>
            </div>
            <h4 className="sl-h4">Recent feedback</h4>
            <div className="sl-list">
              {asArray<Gap>(g.data?.items).slice(0, 3).map((x) => (
                <div key={x._id} className="sl-quote"><small>{label(x.source)}</small><p>“{x.query}”</p><small>{x.category} · {x.count} similar</small></div>
              ))}
            </div>
            {asArray(g.data?.items).length > 0 && (
              <div className="sl-quote">
                <small>Kora recommends</small>
                <b>Create one clarification draft</b>
                <p>It would resolve the highest-impact gap and is linked to repeated customer questions.</p>
                <Button onClick={() => setDraft(asArray<Gap>(g.data?.items)[0])}>Open draft <ArrowUpRight size={11} /></Button>
              </div>
            )}
          </aside>
        </div>
      </DataState>
      <NewDraft open={draft !== false} gap={draft || undefined} onClose={() => setDraft(false)} />
    </div>
  );
}

/* ---------------- Router ---------------- */
export function LearnPage({ parts, search }: { parts: string[]; search: URLSearchParams }) {
  const [section, id, mode] = parts;
  if (section === "knowledge") return id ? <ArticleView id={id} /> : <KnowledgeView />;
  if (section === "courses") {
    if (!id) return <CoursesView />;
    if (mode === "player") return <Player id={id} />;
    if (mode === "quiz") return <Quiz id={id} />;
    if (mode === "complete") return <Completed id={id} score={search.get("score") || undefined} />;
    return <CourseDetail id={id} />;
  }
  if (section === "progress") return <ProgressView />;
  if (section === "help") {
    if (id === "articles") return mode ? <ArticleEditor id={mode} /> : <HelpArticles q0={search.get("q") || ""} status0={search.get("status") || ""} />;
    if (id === "gaps") return <GapsView />;
    return <HelpOverview />;
  }
  return <Overview />;
}
