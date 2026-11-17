"use client";
// Desktop shell: sidebar + header + Kora entry points (supporter-dashboard.pdf p01).
import api from "@/lib/axios";
import { label } from "@/lib/format";
import { date, useSupport, type Conversation, type Preferences, type SupportContext } from "@/lib/support";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell, ChevronDown, LogOut, Menu, MessageSquare, Search, Settings } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Brand } from "./brand";
import { KoraProvider } from "./kora";
import { accountMenu, areaFor, leadNav, mainNav, titleFor, type NavItem } from "./nav";
import { Avatar, Badge, Button, Empty, Modal, SearchBox } from "./ui";

type SearchHit = { _id: string; kind: string; title: string; subtitle?: string; href: string };
type Notice = { _id: string; title?: string; message?: string; createdAt?: string; isRead?: boolean; link?: string };

function NavLinks({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate: () => void }) {
  // Most specific matching item is active.
  const activeHref = items
    .map((i) => i.href)
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <>
      {items.map(({ href, label: name, icon: Icon }) => (
        <Link key={href} href={href} onClick={onNavigate} className={`nv-nav-link ${activeHref === href ? "active" : ""}`}>
          <Icon size={15} />
          <span>{name}</span>
        </Link>
      ))}
    </>
  );
}

function RecentConversations({ pathname }: { pathname: string }) {
  const conversations = useSupport<Conversation[]>("/conversations");
  const list = Array.isArray(conversations.data) ? conversations.data.slice(0, 5) : [];
  return (
    <div className="nv-recent">
      <div className="nv-recent-head">
        <span>Recent conversations</span>
        <Link href="/assistant/history">View all</Link>
      </div>
      {list.length ? (
        list.map((c) => (
          <Link key={c._id} href={`/assistant/c/${c._id}`} className={`nv-recent-item ${pathname === `/assistant/c/${c._id}` ? "active" : ""}`}>
            <MessageSquare size={12} />
            <span>
              {c.title}
              <small>{date(c.lastMessageAt || c.updatedAt)}</small>
            </span>
          </Link>
        ))
      ) : (
        <p className="nv-caption" style={{ padding: "0 6px" }}>No conversations yet.</p>
      )}
    </div>
  );
}

export function SupportShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const ctx = useSupport<SupportContext>("/context");
  const preferences = useSupport<Preferences>("/preferences");
  const [mobile, setMobile] = useState(false);
  const [profile, setProfile] = useState(false);
  const [search, setSearch] = useState(false);
  const [term, setTerm] = useState("");
  const [bell, setBell] = useState(false);

  const area = areaFor(pathname);
  const isLead = Boolean(ctx.data?.teamLead ?? session?.user?.isLead);
  const title = titleFor(pathname);
  const display = ctx.data?.name || session?.user?.name || "Supporter";
  const close = () => setMobile(false);

  const hits = useQuery({
    queryKey: ["support", "/search", term],
    queryFn: async () => (await api.get("/support-experience/search", { params: { q: term } })).data.data as SearchHit[],
    enabled: search && term.trim().length >= 2,
  });
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await api.get("/notification", { params: { limit: 15 } });
      const d = r.data?.data;
      return (Array.isArray(d) ? d : Array.isArray(d?.notifications) ? d.notifications : []) as Notice[];
    },
    enabled: bell,
  });

  return (
    <KoraProvider defaultLabel={title}>
      <div
        className="nv-app"
        data-density={String(preferences.data?.density || "comfortable")}
        data-contrast={preferences.data?.highContrast ? "high" : "standard"}
        data-motion={preferences.data?.reducedMotion ? "reduced" : "system"}
      >
        {mobile && <button className="nv-sidebar-overlay" aria-label="Close navigation" onClick={close} />}
        <aside className={`nv-sidebar ${mobile ? "open" : ""}`}>
          <Brand />
          {area?.back?.map((b) => (
            <Link key={b.href + b.label} className="nv-back nv-sidebar-back" href={b.href} onClick={close}>
              <ArrowLeft size={14} />
              {b.label}
            </Link>
          ))}
          <nav aria-label="Main">
            <NavLinks items={area ? area.items : [...mainNav, ...(isLead ? [leadNav] : [])]} pathname={pathname} onNavigate={close} />
            {area?.recentConversations && <RecentConversations pathname={pathname} />}
          </nav>
          <Link href="/settings" onClick={close} className={`nv-nav-link nv-settings-link ${pathname === "/settings" ? "active" : ""}`}>
            <Settings size={15} />
            <span>Settings</span>
          </Link>
        </aside>

        <div className="nv-main">
          <header className="nv-header">
            <button className="nv-mobile-toggle nv-icon-button" aria-label="Open navigation" onClick={() => setMobile(true)}>
              <Menu size={18} />
            </button>
            <strong>{title}</strong>
            <div className="nv-header-actions">
              <button className="nv-icon-button" aria-label="Search" onClick={() => setSearch(true)}>
                <Search size={17} />
              </button>
              <button className="nv-icon-button" aria-label="Notifications" onClick={() => setBell(true)}>
                <Bell size={17} />
              </button>
              <div className="nv-profile-wrap">
                <button className="nv-profile-button" onClick={() => setProfile(!profile)} aria-expanded={profile}>
                  <Avatar name={display} small />
                  <span>{display.split(" ")[0]}</span>
                  <ChevronDown size={12} />
                </button>
                {profile && (
                  <>
                    <button className="nv-menu-backdrop" aria-label="Close account menu" onClick={() => setProfile(false)} />
                    <div className="nv-menu nv-profile-menu">
                      <div className="nv-menu-caption">
                        {display}
                        <small>{label(ctx.data?.role || session?.user?.role)}</small>
                      </div>
                      {accountMenu.map(({ href, label: name, icon: Icon }) => (
                        <Link key={href} href={href} onClick={() => setProfile(false)}>
                          <Icon size={14} />
                          {name}
                        </Link>
                      ))}
                      <button
                        onClick={async () => {
                          try {
                            await api.post("/auth/logout");
                          } catch {
                            // Session is cleared locally even if the server call fails.
                          } finally {
                            await signOut({ callbackUrl: "/login" });
                          }
                        }}
                      >
                        <LogOut size={14} />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>
          <main className="nv-content" key={pathname} style={{ zoom: Number(preferences.data?.textScale || 100) / 100 }}>
            {pathname.startsWith("/team") && !ctx.isPending && !isLead ? (
              <Empty title="Team Lead access required" description="This view is available to your Support Team Lead." />
            ) : (
              children
            )}
          </main>
        </div>

        <Modal open={search} onClose={() => setSearch(false)} title="Search your work" description="Find Cases, queue conversations, Tasks and chats you are allowed to open.">
          <SearchBox value={term} onChange={setTerm} placeholder="Search cases, customers or tasks..." />
          <div className="nv-search-results">
            {term.trim().length < 2 ? (
              <p className="nv-caption">Type at least two characters.</p>
            ) : hits.isPending ? (
              <p className="nv-caption">Searching…</p>
            ) : hits.data?.length ? (
              hits.data.map((x) => (
                <button key={x.kind + x._id} onClick={() => { setSearch(false); router.push(x.href); }}>
                  <span>
                    {x.title}
                    {x.subtitle && <small style={{ display: "block", color: "#7e8796" }}>{x.subtitle}</small>}
                  </span>
                  <Badge>{x.kind}</Badge>
                </button>
              ))
            ) : (
              <Empty title="No matching records" description="Try a case number, customer or task name." />
            )}
          </div>
        </Modal>

        <Modal open={bell} onClose={() => setBell(false)} title="Notifications" description="Updates that need your attention.">
          <div className="nv-search-results">
            {notifications.data?.length ? (
              notifications.data.map((n) => (
                <button
                  key={n._id}
                  onClick={async () => {
                    try { await api.put(`/notification/${n._id}/read`); } catch {}
                    notifications.refetch();
                    if (n.link?.startsWith("/") && !n.link.startsWith("//")) { setBell(false); router.push(n.link); }
                  }}
                >
                  <div>
                    <strong>{n.title || "Update"}</strong>
                    <p>{n.message}</p>
                  </div>
                  <small>{date(n.createdAt)}</small>
                </button>
              ))
            ) : (
              <Empty title="You're all caught up" description="Assignments, SLA warnings and messages appear here." />
            )}
          </div>
          <Button onClick={async () => { try { await api.put("/notification/read-all"); } catch {} notifications.refetch(); }}>Mark all read</Button>
        </Modal>
      </div>
    </KoraProvider>
  );
}
