import { useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { http } from "../api/http";
import { clearAuth, setToken, setUser } from "../auth/token";
import { formatUiError } from "../utils/uiError";
import loginBackground from "../assets/login-background.png";
import volguLogo from "../assets/volgu-logo.png";

function EyeIcon({ crossed = false }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M2 12c2.3-4 5.63-6 10-6s7.7 2 10 6c-2.3 4-5.63 6-10 6S4.3 16 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      {crossed ? <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> : null}
    </svg>
  );
}

function decodeUserFromToken(token) {
  try {
    const payload = jwtDecode(token);
    return {
      id: payload?.id ?? payload?.sub ?? null,
      email: payload?.email ?? "",
      role: payload?.role ?? "",
      fullName: payload?.fullName ?? "",
      studentCode: payload?.studentCode ?? "",
      faculty: payload?.faculty ?? "",
      groupId: payload?.groupId ?? null,
    };
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("teacher1@lms.local");
  const [password, setPassword] = useState("123456");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const redirectTo = location.state?.from?.pathname || "/courses";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      setError("Укажите email и пароль.");
      return;
    }

    try {
      setSubmitting(true);
      clearAuth();

      const response = await http.post("/auth/login", {
        email: normalizedEmail,
        password: normalizedPassword,
      });

      const token = response.data?.token;
      const nextUser = response.data?.user || decodeUserFromToken(token);

      if (!token || !nextUser) {
        throw new Error("Не удалось получить данные сессии.");
      }

      setToken(token);
      setUser(nextUser);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      clearAuth();
      setError(formatUiError(err, "Не удалось выполнить вход. Попробуйте еще раз."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#15336f] text-slate-950">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${loginBackground})` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-95"
        style={{
          background: [
            "radial-gradient(circle at 18% 18%, rgba(74, 222, 255, 0.42) 0%, rgba(74, 222, 255, 0.14) 26%, transparent 52%)",
            "radial-gradient(circle at 84% 18%, rgba(255, 78, 184, 0.4) 0%, rgba(192, 38, 211, 0.18) 24%, transparent 48%)",
            "radial-gradient(circle at 52% 84%, rgba(56, 189, 248, 0.34) 0%, rgba(56, 189, 248, 0.14) 24%, transparent 48%)",
            "linear-gradient(132deg, rgba(18, 51, 122, 0.44) 0%, rgba(37, 87, 216, 0.24) 42%, rgba(109, 52, 218, 0.28) 72%, rgba(219, 39, 119, 0.22) 100%)",
          ].join(", "),
          backgroundSize: "132% 132%, 128% 128%, 124% 124%, 164% 164%",
          animation: "loginBackgroundFlow 4.8s ease-in-out infinite alternate",
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-[520px] rounded-[34px] border border-white/35 bg-[linear-gradient(180deg,rgba(229,241,255,0.78),rgba(215,231,255,0.6))] p-5 shadow-[0_26px_100px_rgba(9,28,74,0.28)] backdrop-blur-[18px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-[28px] border border-white/55 bg-[linear-gradient(180deg,rgba(246,250,255,0.92),rgba(232,240,255,0.86))] px-8 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]"
          >
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-blue-500">
              {t("auth.account", { defaultValue: "Учетная запись" })}
            </div>
            <div className="mt-3 flex items-center gap-0">
              <img
                src={volguLogo}
                alt="Логотип ВолГУ"
                className="relative z-10 h-14 w-14 shrink-0 object-contain drop-shadow-[0_10px_24px_rgba(40,92,214,0.22)]"
              />
              <svg
                viewBox="0 0 700 92"
                aria-label="СДО ВОЛГУ"
                className="-ml-4 h-[3.32rem] w-[27.1rem] shrink-0 overflow-visible"
              >
                <defs>
                  <linearGradient id="volguLoginTitleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#2258ff" />
                    <stop offset="42%" stopColor="#4f7dff" />
                    <stop offset="68%" stopColor="#6a5cff" />
                    <stop offset="100%" stopColor="#8b3dff" />
                  </linearGradient>
                  <filter id="volguLoginTitleGlow" x="-10%" y="-20%" width="120%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(88, 92, 255, 0.16)" />
                  </filter>
                </defs>
                <text
                  x="0"
                  y="75"
                  fill="url(#volguLoginTitleGradient)"
                  stroke="rgba(21, 36, 92, 0.72)"
                  strokeWidth="1.35"
                  paintOrder="stroke"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="76"
                  fontWeight="900"
                  letterSpacing="1.9"
                  filter="url(#volguLoginTitleGlow)"
                >
                  СДО ВОЛГУ
                </text>
              </svg>
            </div>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              {t("auth.subtitle", {
                defaultValue: "Используйте корпоративную почту и пароль, чтобы открыть личное рабочее пространство в системе.",
              })}
            </p>

            <div className="mt-10 space-y-7">
              <label className="block">
                <span className="mb-3 block text-lg font-semibold text-slate-700">
                  {t("auth.email", { defaultValue: "Электронная почта" })}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  className="w-full rounded-[20px] border border-white/70 bg-white/64 px-5 py-4 text-[1.15rem] text-slate-900 shadow-[inset_0_1px_1px_rgba(255,255,255,0.82)] outline-none transition focus:border-blue-300 focus:bg-white/82"
                  placeholder="teacher1@lms.local"
                />
              </label>

              <label className="block">
                <span className="mb-3 block text-lg font-semibold text-slate-700">
                  {t("auth.password", { defaultValue: "Пароль" })}
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    className="w-full rounded-[20px] border border-white/70 bg-white/64 px-5 py-4 pr-16 text-[1.15rem] text-slate-900 shadow-[inset_0_1px_1px_rgba(255,255,255,0.82)] outline-none transition focus:border-blue-300 focus:bg-white/82"
                    placeholder={t("auth.passwordPlaceholder", { defaultValue: "Введите пароль" })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-2xl border border-slate-200/85 bg-white/80 text-slate-500 transition hover:text-blue-600"
                    aria-label={
                      showPassword
                        ? t("auth.hidePassword", { defaultValue: "Скрыть пароль" })
                        : t("auth.showPassword", { defaultValue: "Показать пароль" })
                    }
                  >
                    <EyeIcon crossed={!showPassword} />
                  </button>
                </div>
              </label>
            </div>

            {error ? (
              <div className="mt-7 rounded-[18px] border border-rose-300/55 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-8 inline-flex w-full items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#2d74ff_0%,#4a88ff_52%,#386eff_100%)] px-6 py-4 text-xl font-bold text-white shadow-[0_18px_40px_rgba(41,95,255,0.34)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-75"
            >
              {submitting ? t("auth.loading", { defaultValue: "Вход..." }) : t("auth.submit", { defaultValue: "Войти" })}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes loginBackgroundFlow {
          0% {
            background-position: 6% 12%, 88% 16%, 46% 86%, 0% 50%;
            filter: saturate(1.02) hue-rotate(0deg);
          }
          50% {
            background-position: 11% 18%, 81% 12%, 54% 76%, 50% 50%;
            filter: saturate(1.12) hue-rotate(-5deg);
          }
          100% {
            background-position: 15% 10%, 76% 22%, 42% 92%, 100% 50%;
            filter: saturate(1.2) hue-rotate(5deg);
          }
        }
      `}</style>
    </div>
  );
}
