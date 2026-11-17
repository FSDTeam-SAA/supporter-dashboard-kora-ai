"use client";
// Kora entry points shared by every page (design p42 Ask Kora, p43 Plus menu, p44 Chat slide-in).
import api from "@/lib/axios";
import { errorMessage } from "@/lib/format";
import { firstName, greeting, supportPath, type Conversation } from "@/lib/support";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText, MoreHorizontal, Plus, Sparkles, Activity, X } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Markdown } from "./markdown";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

type KoraState = {
  pageLabel: string;
  setPageLabel: (s: string) => void;
  openAsk: () => void;
  openChat: (prompt?: string) => void;
};
const KoraContext = createContext<KoraState | null>(null);
export const useKora = () => {
  const c = useContext(KoraContext);
  if (!c) throw new Error("useKora must be used inside <KoraProvider>");
  return c;
};

/** Removes the "[Current page: …]" context prefix added to stored user prompts. */
export const stripPage = (s: string) => s.replace(/^\[Current page: [^\]]*\]\s*/, "");

/** Send one message to personal Kora chat; returns the updated conversation. */
async function askKora(message: string, conversationId?: string, page?: string) {
  const prompt = page ? `[Current page: ${page}] ${message}` : message;
  return (await api.post(supportPath("/chat"), { message: prompt, conversation_id: conversationId })).data.data as Conversation;
}

/* ---------------- Speech (Hold to speak) ---------------- */
type Recognition = { start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; lang: string; interimResults: boolean };
function useSpeech(onText: (t: string) => void) {
  const rec = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const start = () => {
    const W = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) return toast.info("Voice input is not available in this browser. Type your question instead.");
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };
  const stop = () => rec.current?.stop();
  return { listening, start, stop };
}

function HoldToSpeak({ onText, compact = false }: { onText: (t: string) => void; compact?: boolean }) {
  const { listening, start, stop } = useSpeech(onText);
  return (
    <button
      type="button"
      className={`nv-hold ${listening ? "listening" : ""}`}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={() => listening && stop()}
      aria-label="Hold to speak"
    >
      {compact && <Activity size={12} />}
      {compact ? "Hold" : listening ? "Listening…" : "Hold to speak"}
    </button>
  );
}

/* ---------------- Ask Kora popup ---------------- */
function AskKora({ onClose, onContinue, page }: { onClose: () => void; onContinue: (c: Conversation) => void; page: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      onContinue(await askKora(text.trim(), undefined, page));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="nv-ask-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="nv-ask" role="dialog" aria-modal="true" aria-label="Ask Kora">
        <div className="nv-ask-head">
          <div>
            <h2>Ask Kora</h2>
            <small>Context · Current page</small>
          </div>
          <button onClick={onClose} aria-label="Close Ask Kora">
            <X size={18} />
          </button>
        </div>
        <div className="nv-ask-hero">
          <span className="nv-kora-dot" />
          <div>
            <strong>What can I help you with?</strong>
            <span>Speak naturally or type a quick instruction.</span>
          </div>
        </div>
        <form className="nv-ask-input" onSubmit={submit}>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask anything about this page..."
            aria-label="Ask Kora"
            disabled={busy}
          />
          {busy ? (
            <span className="nv-chat-typing" aria-label="Kora is thinking"><i /><i /><i /></span>
          ) : (
            <HoldToSpeak onText={setText} />
          )}
        </form>
        <div className="nv-ask-foot">Kora uses the current page and selected object as context.</div>
      </div>
    </div>
  );
}

/* ---------------- Chat slide-in ---------------- */
const QUICK = ["Review queue", "Draft callback notes", "Today's support schedule"];
function ChatPanel({ onClose, initial, page }: { onClose: () => void; initial: Conversation | null; page: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  // The provider remounts this panel (via `key`) when a new conversation is handed over.
  const [conv, setConv] = useState<Conversation | null>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight, behavior: "smooth" });
  }, [conv, busy]);
  const send = async (message: string) => {
    if (!message.trim() || busy) return;
    setBusy(true);
    setText("");
    setConv((c) => ({ ...(c || { _id: "", title: message }), messages: [...(c?.messages || []), { role: "user", content: message }] }));
    try {
      const next = await askKora(message.trim(), conv?._id || undefined, page);
      setConv(next);
      qc.invalidateQueries({ queryKey: ["support", "/conversations"] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <aside className="nv-chat-panel" aria-label="Chat with Kora">
      <button className="nv-chat-collapse" onClick={onClose} aria-label="Close chat">
        <ChevronLeft size={20} />
      </button>
      <div className="nv-chat-head">
        <div className="nv-chat-head-icon">
          <Sparkles size={20} />
        </div>
        <span>
          <strong>Chat with Kora</strong>
          <small>Context · {page}</small>
        </span>
        <div style={{ position: "relative" }}>
          <button className="nv-icon-button" style={{ border: 0, background: "transparent" }} onClick={() => setMenu(!menu)} aria-label="Chat options">
            <MoreHorizontal size={18} />
          </button>
          {menu && (
            <div className="nv-menu" style={{ right: 0, top: 38, position: "absolute", minWidth: 190, zIndex: 3 }}>
              <button onClick={() => { setConv(null); setMenu(false); }}>New chat</button>
              {conv?._id && (
                <button onClick={() => { setMenu(false); onClose(); router.push(`/assistant/c/${conv._id}`); }}>Open in Assistant</button>
              )}
              <button onClick={() => { setMenu(false); onClose(); }}>Close</button>
            </div>
          )}
        </div>
      </div>
      <div className="nv-chat-body" ref={body}>
        <div className="nv-chat-bubble">
          <b>{greeting()}, {firstName(session?.user?.name)}.</b>
          Ask about your queue, cases, callbacks or this page. Kora separates evidence from inference and asks before anything changes.
        </div>
        {(conv?.messages || []).map((m, i) => (
          <div key={m._id || i} className={`nv-chat-bubble ${m.role === "user" ? "user" : ""}`}>
            <b>{m.role === "user" ? "You" : "NOVYA"}</b>
            {m.role === "user" ? stripPage(m.content) : <Markdown text={m.content} />}
          </div>
        ))}
        {busy && (
          <div className="nv-chat-bubble">
            <b>NOVYA</b>
            <span className="nv-chat-typing"><i /><i /><i /></span>
          </div>
        )}
      </div>
      <div className="nv-chat-quick">
        <span>Quick actions</span>
        <div>
          {QUICK.map((q) => (
            <button key={q} onClick={() => send(q)} disabled={busy}>
              {q}
            </button>
          ))}
        </div>
      </div>
      <form className="nv-chat-compose" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything about this page..." aria-label="Message Kora" />
        <Link href="/assistant" onClick={onClose} aria-label="Open full Assistant" style={{ color: "#c9cfda" }}>
          <FileText size={16} />
        </Link>
        <HoldToSpeak onText={setText} compact />
      </form>
      <div className="nv-chat-note">Preview or approval is requested before sensitive actions.</div>
    </aside>
  );
}

/* ---------------- Provider ---------------- */
export function KoraProvider({ children, defaultLabel }: { children: ReactNode; defaultLabel: string }) {
  // A page may set a more specific label (e.g. "Case · Billing correction"); it resets on navigation.
  const [override, setOverride] = useState<{ for: string; label: string } | null>(null);
  const pageLabel = override && override.for === defaultLabel ? override.label : defaultLabel;
  const setPageLabel = useCallback((label: string) => setOverride({ for: defaultLabel, label }), [defaultLabel]);
  const [ask, setAsk] = useState(false);
  const [chat, setChat] = useState(false);
  const [conv, setConv] = useState<Conversation | null>(null);
  const openAsk = useCallback(() => { setChat(false); setAsk(true); }, []);
  const openChat = useCallback(() => { setAsk(false); setChat(true); }, []);
  const value = useMemo(() => ({ pageLabel, setPageLabel, openAsk, openChat }), [pageLabel, setPageLabel, openAsk, openChat]);
  return (
    <KoraContext.Provider value={value}>
      {children}
      {ask && (
        <AskKora
          page={pageLabel}
          onClose={() => setAsk(false)}
          onContinue={(c) => { setConv(c); setAsk(false); setChat(true); }}
        />
      )}
      {chat && <ChatPanel key={conv?._id || "new"} page={pageLabel} initial={conv} onClose={() => { setChat(false); setConv(null); }} />}
    </KoraContext.Provider>
  );
}

/* ---------------- Plus menu (page-level "+") ---------------- */
export function PlusMenu({ onCreate, createLabel = "Manual, with Kora or template" }: { onCreate?: () => void; createLabel?: string }) {
  const [open, setOpen] = useState(false);
  const kora = useKora();
  const items: { key: string; title: string; text: string; color: string; icon: ReactNode; run: () => void }[] = [
    { key: "ask", title: "Ask Kora", text: "Speak or type with page context", color: "#8f5cf6", icon: "K", run: kora.openAsk },
    { key: "chat", title: "Chat", text: "Open the full Kora assistant", color: "#5b74f6", icon: "CH", run: () => kora.openChat() },
    ...(onCreate ? [{ key: "create", title: "Create", text: createLabel, color: "#6366f1", icon: <Plus size={14} />, run: onCreate }] : []),
  ];
  return (
    <div className="nv-plus-anchor">
      <button className="nv-plus-circle" aria-label={open ? "Close menu" : "Create or ask Kora"} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? <X size={19} /> : <Plus size={19} />}
      </button>
      {open && (
        <>
          <button className="nv-menu-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="nv-plus-menu">
            {items.map((i) => (
              <button key={i.key} className="nv-plus-option" onClick={() => { setOpen(false); i.run(); }}>
                <span className="nv-plus-option-icon" style={{ background: i.color }}>{i.icon}</span>
                <span>
                  <strong>{i.title}</strong>
                  <small>{i.text}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
