"use client";
import api from "@/lib/axios";
import { errorMessage } from "@/lib/format";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Headphones,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Brand } from "./brand";
import { Button, Field } from "./ui";

export type AuthMode = "login" | "forgot-password" | "verify-otp" | "reset-password" | "activate";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="nv-auth">
      <aside className="nv-auth-story">
        <Brand href="/login" />
        <div>
          <div className="nv-eyebrow">YOUR SUPPORT WORK, CONNECTED</div>
          <h1>
            A calmer queue.
            <br />
            <span>Clearer answers.</span>
          </h1>
          <p>Your queue, cases, customers and callbacks — together in one focused place.</p>
          <div className="nv-auth-features">
            <div>
              <Headphones size={17} />
              Every customer, clearly owned
            </div>
            <div>
              <Timer size={17} />
              Queue, SLA and callbacks in one view
            </div>
            <div>
              <Sparkles size={17} />
              Kora, ready with verified evidence
            </div>
          </div>
        </div>
        <footer className="nv-auth-footer">
          NOVYA · Support
          <br />
          Built for the people who keep customers moving.
        </footer>
      </aside>
      <section className="nv-auth-form">
        <div>{children}</div>
      </section>
    </div>
  );
}

const errors: Record<string, string> = {
  mfa_required: "Enter a fresh code from your authenticator app.",
  role_not_allowed:
    "An active Supporter or Support Team Lead membership is required. Contact your administrator.",
  wrong_password: "The password is incorrect.",
  user_not_found: "We could not find this work account.",
  email_not_verified: "Verify your work email before signing in.",
  account_blocked: "This account is blocked. Contact your administrator.",
  missing_credentials: "Enter your work email and password.",
  invalid_credentials: "Could not sign in. Check your credentials.",
  session_required: "Sign in to continue.",
  session_expired: "Your session expired. Sign in again.",
  auth_service_unavailable: "The sign-in service is unavailable. Please try again.",
};

const RESET_KEY = "novya-support-reset";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const params = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [show, setShow] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [success, setSuccess] = useState(false);

  const login = mode === "login",
    forgot = mode === "forgot-password",
    otp = mode === "verify-otp",
    activate = mode === "activate",
    reset = mode === "reset-password";

  const title = login
    ? mfa
      ? "Verify it's you"
      : "Welcome back"
    : forgot
      ? "Forgot your password?"
      : otp
        ? "Check your email"
        : activate
          ? "Your support workspace is ready"
          : "Create a new password";
  const description = login
    ? mfa
      ? "Enter the 6-digit code from your authenticator app."
      : "Sign in to your NOVYA Support account."
    : forgot
      ? "Enter your work email and we'll send a recovery code."
      : otp
        ? `Enter the recovery code sent to ${params.get("email") || "your work email"}.`
        : activate
          ? "Activate your invited work account using the temporary password provided by your administrator."
          : "Choose a strong password to protect your work account.";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (login) {
        const out = await signIn("credentials", {
          email: b.email,
          password: b.password,
          mfaCode: b.mfaCode,
          redirect: false,
          redirectTo: "/dashboard",
        });
        const code = out?.code || out?.error;
        if (code) {
          if (code === "mfa_required") setMfa(true);
          throw new Error(errors[code] || errors.invalid_credentials);
        }
        const callbackUrl = params.get("callbackUrl");
        router.replace(callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard");
        router.refresh();
      } else if (forgot) {
        await api.post("/auth/forget-password", { email: b.email });
        router.push(`/verify-otp?email=${encodeURIComponent(b.email)}`);
      } else if (otp) {
        await api.post("/auth/verify-reset-otp", { email: b.email, otp: b.otp });
        sessionStorage.setItem(RESET_KEY, JSON.stringify({ email: b.email, otp: b.otp }));
        router.push(`/reset-password?email=${encodeURIComponent(b.email)}`);
      } else if (activate) {
        if (b.password !== b.confirmPassword) throw new Error("Passwords do not match.");
        await api.post("/auth/activate-staff", { ...b, scope: "support" });
        setSuccess(true);
      } else {
        let saved: { email?: string; otp?: string } = {};
        try {
          saved = JSON.parse(sessionStorage.getItem(RESET_KEY) || "{}");
        } catch {}
        if (b.password !== b.confirmPassword) throw new Error("Passwords do not match.");
        await api.post("/auth/reset-password", {
          email: b.email || saved.email,
          otp: b.otp || saved.otp,
          password: b.password,
          confirmPassword: b.confirmPassword,
        });
        sessionStorage.removeItem(RESET_KEY);
        setSuccess(true);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/forget-password", { email: params.get("email") || "" });
      setNotice("A new recovery code has been sent.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (success)
    return (
      <>
        <div className="nv-success-icon">
          <Check size={28} />
        </div>
        <h1>{activate ? "You're ready to begin" : "Password updated"}</h1>
        <p>
          {activate
            ? "Your Support account is active. Sign in to start your workday."
            : "Your new password is ready. Sign in to continue."}
        </p>
        <Button href="/login" primary>
          Back to sign in <ArrowRight size={15} />
        </Button>
      </>
    );

  const urlError = params.get("error");
  return (
    <>
      {!login && (
        <Link className="nv-back" href="/login">
          <ArrowLeft size={13} />
          Back to sign in
        </Link>
      )}
      <div className="nv-auth-mark">
        {login ? <ShieldCheck size={23} /> : forgot || otp ? <Mail size={23} /> : <LockKeyhole size={23} />}
      </div>
      <div className="nv-eyebrow" style={{ marginTop: 24 }}>
        NOVYA SUPPORT
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
      {(error || (urlError && login)) && (
        <div role="alert" className="nv-auth-error">
          {error || errors[urlError || ""] || errors.session_required}
        </div>
      )}
      {notice && (
        <div role="status" className="nv-auth-error" style={{ borderColor: "#2e6b58", color: "#8fe0c4" }}>
          {notice}
        </div>
      )}
      <form onSubmit={submit}>
        <Field
          label="Work email"
          name="email"
          type="email"
          required
          defaultValue={params.get("email") || ""}
        />
        {activate && <Field label="Temporary password" name="temporaryPassword" type="password" required />}
        {(login || reset || activate) && (
          <>
            <div className="nv-settings-row" style={{ border: 0, padding: "0 0 2px" }}>
              <span className="nv-caption">{reset || activate ? "New password" : "Password"}</span>
              {login && <Link href="/forgot-password">Forgot password?</Link>}
            </div>
            <div className="nv-inline">
              <input
                className="nv-input"
                aria-label={login ? "Password" : "New password"}
                name="password"
                type={show ? "text" : "password"}
                required
                minLength={login ? 1 : 10}
                autoComplete={login ? "current-password" : "new-password"}
              />
              <button type="button" className="nv-caption" onClick={() => setShow(!show)}>
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </>
        )}
        {(reset || activate) && (
          <Field label="Confirm password" name="confirmPassword" type="password" required />
        )}
        {otp && <Field label="Recovery code" name="otp" required placeholder="6-digit code" />}
        {login && mfa && (
          <Field label="Authenticator code" name="mfaCode" required placeholder="6-digit code" />
        )}
        {reset && (
          <Field label="Recovery code" name="otp" placeholder="Leave empty to use your verified code" />
        )}
        <Button type="submit" primary disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}{" "}
          {login
            ? mfa
              ? "Verify & sign in"
              : "Sign in"
            : forgot
              ? "Send recovery code"
              : otp
                ? "Verify code"
                : activate
                  ? "Activate account"
                  : "Update password"}
        </Button>
      </form>
      {otp && (
        <Button disabled={busy} onClick={resend}>
          Resend recovery code
        </Button>
      )}
      <div className="nv-auth-hint">
        {login ? (
          <>
            Invited to NOVYA? <Link href="/activate">Activate your account</Link>
          </>
        ) : (
          "Your work account is protected by NOVYA security policies."
        )}
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 12 }}>
          <ShieldCheck size={11} />
          Secure access · Assigned role and scope
        </span>
      </div>
    </>
  );
}
