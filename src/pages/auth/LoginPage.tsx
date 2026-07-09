// v2
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { authApi } from "@/api/client";
import { DEMO_PLATFORM_USER } from "@/lib/demoData";
import { APP_NAME, APP_TAGLINE, MODULE_ICON_MAP } from "@/lib/constants";
import { Leaf, LogIn, Eye, EyeOff, AlertCircle, Info, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter,
} from "@/components/ui/dialog";

const LOGIN_MODULES = [
  { key: "energy",    icon_name: "Zap",      color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Energy" },
  { key: "emissions", icon_name: "Wind",     color: "#94a3b8", bg: "rgba(148,163,184,0.12)", label: "Emissions" },
  { key: "water",     icon_name: "Droplets", color: "#38bdf8", bg: "rgba(56,189,248,0.12)",  label: "Water" },
  { key: "waste",     icon_name: "Trash2",   color: "#4ade80", bg: "rgba(74,222,128,0.12)",  label: "Waste" },
];

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [mounted, setMounted]   = useState(false);

  const navigate  = useNavigate();
  const { login } = useAuthStore();
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async () => {
    if (!email || !password) { setError("Please enter email and password"); return; }
    setError("");
    setLoading(true);

    const wantsPlatform = demoMode && email.toLowerCase().includes("platform");

    const loginTenant = async () => {
      const { data } = await authApi.tenantLogin(email, password);
      login({ ...data.user, user_type: "tenant" }, data.access_token, data.refresh_token);
      navigate("/app");
    };

    const loginPlatform = async () => {
      const { data } = await authApi.platformLogin(email, password);
      login({ ...data.user, user_type: "platform" }, data.access_token, data.refresh_token);
      navigate("/platform");
    };

    try {
      if (wantsPlatform) {
        await loginPlatform();
        return;
      }
      await loginTenant();
      return;
    } catch (tenantErr: any) {
      if (demoMode) {
        setError("Demo login failed. For platform admin use an email containing \"platform\".");
        setLoading(false);
        return;
      }
      const status = tenantErr.response?.status;
      if (status !== 401 && status !== 403 && status !== 422) {
        setError(tenantErr.response?.data?.detail || "Login failed. Please check your credentials.");
        setLoading(false);
        return;
      }
    }
    try {
      await loginPlatform();
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex">

      {/* ── Background: image + layered overlays ── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/login-bg.png')" }}
      />
      {/* Gradient overlay — left darker for left-panel text, right for card */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(105deg,
              rgba(6,14,28,0.88) 0%,
              rgba(10,20,40,0.82) 40%,
              rgba(8,18,34,0.78) 100%
            )
          `,
        }}
      />
      {/* Fallback gradient if image not found */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 10% 45%, rgba(14,165,233,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 70% 60% at 75% 65%, rgba(20,184,166,0.14) 0%, transparent 55%),
            radial-gradient(ellipse 50% 45% at 50% 5%,  rgba(14,165,233,0.10) 0%, transparent 50%),
            linear-gradient(140deg, #05101e 0%, #091828 40%, #0c1d30 70%, #081520 100%)
          `,
        }}
      />

      {/* Animated subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(148,163,184,1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          animation: "gridMove 25s linear infinite",
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[45vw] h-[45vw] rounded-full bg-sky-500/8 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[20%] w-[35vw] h-[35vw] rounded-full bg-teal-500/8 blur-[100px] pointer-events-none" />


      {/* ═══════════════════════════════════════════ */}
      {/* LEFT — Brand panel                          */}
      {/* ═══════════════════════════════════════════ */}
      <div
        className={`
          hidden lg:flex flex-col justify-between flex-1 px-14 py-12 relative z-10
          transition-all duration-800 ease-out
          ${mounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-teal to-brand-accent flex items-center justify-center shadow-lg shadow-brand-accent/25 ring-1 ring-white/10">
            <Leaf size={22} className="text-white" />
          </div>
          <div>
            <div className="text-[21px] font-bold text-white tracking-tight">{APP_NAME}</div>
            <div className="text-[9.5px] text-slate-400 tracking-[2.5px] uppercase mt-0.5">{APP_TAGLINE}</div>
          </div>
        </div>

        {/* Hero copy */}
        <div className="max-w-[500px]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse" />
            <span className="text-[11px] text-slate-300 font-medium tracking-wide">Built for Indian ESG & BRSR reporting</span>
          </div>

          <h2 className="text-[50px] font-bold text-white leading-[1.08] tracking-tight mb-5">
            ESG Reporting,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-accent via-sky-300 to-brand-teal">
              Reimagined.
            </span>
          </h2>

          <p className="text-[15px] text-slate-400 leading-relaxed mb-12 max-w-[400px]">
            Track energy, emissions, water and waste across every site — BRSR-compliant, audit-trail enabled, built for scale.
          </p>

          {/* Module capability pills */}
          <div className="flex flex-wrap gap-2.5">
            {LOGIN_MODULES.map((m) => {
              const Icon = MODULE_ICON_MAP[m.icon_name];
              return (
                <div
                  key={m.key}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08]"
                  style={{ background: m.bg }}
                >
                  {Icon && <Icon size={13} style={{ color: m.color }} />}
                  <span className="text-[12px] font-semibold text-slate-200">{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-slate-600">
          © {new Date().getFullYear()} {APP_NAME} · All rights reserved
        </p>
      </div>


      {/* ═══════════════════════════════════════════ */}
      {/* RIGHT — Login card                          */}
      {/* ═══════════════════════════════════════════ */}
      <div className="relative z-10 flex items-center justify-center w-full lg:w-[500px] xl:w-[540px] flex-shrink-0 px-6 py-10 lg:px-12">

        <div
          className={`
            w-full max-w-[420px]
            transition-all duration-700 ease-out delay-100
            ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}
          `}
        >
          {/* Card shell */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(28px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: `
                0 0 0 1px rgba(255,255,255,0.03) inset,
                0 32px 80px rgba(0,0,0,0.55),
                0 8px 24px rgba(0,0,0,0.35)
              `,
            }}
          >
            {/* Card top accent bar */}
            <div
              className="h-[3px] w-full"
              style={{ background: "linear-gradient(90deg, #0ea5e9, #14b8a6, #0ea5e9)" }}
            />

            <div className="px-8 py-9">
              {/* Mobile logo */}
              <div className="flex items-center gap-3 mb-8 lg:hidden">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-teal to-brand-accent flex items-center justify-center">
                  <Leaf size={18} className="text-white" />
                </div>
                <div>
                  <div className="text-[17px] font-bold text-white">{APP_NAME}</div>
                  <div className="text-[9px] text-slate-400 tracking-[2px] uppercase">{APP_TAGLINE}</div>
                </div>
              </div>

              {/* Heading */}
              <div className="mb-8">
                <h1 className="text-[26px] font-bold text-white tracking-tight">Welcome back</h1>
                <p className="text-[13px] text-slate-400 mt-1.5 leading-snug">
                  Sign in to continue to your workspace
                </p>
                {demoMode && (
                  <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5 text-[12px] text-emerald-200 space-y-1">
                    <p className="font-semibold text-emerald-100">Demo mode — any password works</p>
                    <p><span className="font-medium">Company portal:</span> any email (e.g. <code className="text-emerald-50">demo@esmos.com</code>)</p>
                    <p><span className="font-medium">Platform admin:</span> email must include <code className="text-emerald-50">platform</code> (e.g. <code className="text-emerald-50">{DEMO_PLATFORM_USER.email}</code>)</p>
                  </div>
                )}
              </div>

              {/* Fields */}
              <div className="flex flex-col gap-5">

                {/* Email */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="email" className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[1.5px]">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="you@company.com"
                    className="login-field"
                  />
                </div>

                {/* Password */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[1.5px]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="text-[11.5px] text-brand-accent font-semibold hover:text-brand-teal transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      placeholder="••••••••••"
                      className="login-field pr-11"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2.5 py-3 px-4 rounded-xl text-[12px] font-medium text-red-400"
                    style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)" }}>
                    <AlertCircle size={14} className="flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  id="login-submit"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="login-btn"
                >
                  {loading ? (
                    <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <LogIn size={16} />
                      Sign In
                    </span>
                  )}
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 my-7">
                <div className="flex-1 h-px bg-white/[0.07]" />
                <ShieldCheck size={13} className="text-slate-600" />
                <div className="flex-1 h-px bg-white/[0.07]" />
              </div>

              {/* Trust line */}
              <p className="text-center text-[11px] text-slate-600 leading-relaxed">
                Enterprise-grade security · BRSR compliant · Audit trail enabled
              </p>
            </div>
          </div>

          {/* Below-card copyright (mobile) */}
          <p className="text-[11px] text-slate-700 text-center mt-6 lg:hidden">
            © {new Date().getFullYear()} {APP_NAME}
          </p>
        </div>
      </div>


      {/* ── Forgot Password Dialog ── */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                <Info size={18} className="text-brand-accent" />
              </div>
              <div>
                <DialogTitle>Forgot Password?</DialogTitle>
                <DialogDescription>Password reset assistance</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogBody className="pt-0">
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
              <p className="text-[12px] text-slate-700 leading-relaxed mb-3">
                Password resets are managed by your administrator. Please reach out to:
              </p>
              <ul className="flex flex-col gap-2.5">
                <li className="flex items-start gap-2 text-[12px] text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-accent mt-1.5 flex-shrink-0" />
                  <span>
                    <span className="font-semibold text-brand-navy">Company Admin</span> — Your
                    organisation's ESMOS administrator can reset your password from the User Management page.
                  </span>
                </li>
                <li className="flex items-start gap-2 text-[12px] text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-teal mt-1.5 flex-shrink-0" />
                  <span>
                    <span className="font-semibold text-brand-navy">Platform Support</span> — If you are a
                    Company Admin, contact the platform support team for assistance.
                  </span>
                </li>
              </ul>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setForgotOpen(false)} className="w-full">Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyframes */}
      <style>{`
        @keyframes gridMove {
          from { background-position: 0 0; }
          to   { background-position: 64px 64px; }
        }

        .login-field {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border-radius: 10px;
          font-size: 14px;
          color: #f1f5f9;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          -webkit-font-smoothing: antialiased;
        }
        .login-field::placeholder {
          color: rgba(148,163,184,0.45);
        }
        .login-field:focus {
          background: rgba(255,255,255,0.09);
          border-color: rgba(14,165,233,0.55);
          box-shadow: 0 0 0 3px rgba(14,165,233,0.12), 0 1px 3px rgba(0,0,0,0.3);
        }

        .login-btn {
          width: 100%;
          height: 50px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          font-size: 14.5px;
          font-weight: 700;
          color: white;
          letter-spacing: 0.01em;
          background: linear-gradient(110deg, #0ea5e9 0%, #14b8a6 100%);
          box-shadow: 0 4px 20px rgba(14,165,233,0.30), 0 1px 4px rgba(0,0,0,0.4);
          transition: filter 0.2s, box-shadow 0.2s, transform 0.15s;
          margin-top: 4px;
        }
        .login-btn:hover:not(:disabled) {
          filter: brightness(1.08);
          box-shadow: 0 6px 28px rgba(14,165,233,0.42), 0 2px 6px rgba(0,0,0,0.4);
        }
        .login-btn:active:not(:disabled) {
          transform: scale(0.985);
        }
        .login-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .login-btn:focus-visible {
          outline: 2px solid rgba(14,165,233,0.7);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
