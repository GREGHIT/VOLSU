import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import AppIcon from "./ui/AppIcon";
import { clearAuth, getUser, USER_CHANGED_EVENT } from "../auth/token";
import { http } from "../api/http";
import { LANGUAGE_OPTIONS } from "../i18n";
import volguLogo from "../assets/volgu-logo.png";

const MotionLink = motion(Link);

const BASE_NAV_ITEMS = [
  { to: "/courses", label: "Курсы", icon: "courses" },
  { to: "/grades", label: "Оценки", icon: "grades" },
  { to: "/library", label: "Библиотека", icon: "library" },
  { to: "/schedule", label: "Расписание", icon: "schedule" },
  { to: "/analytics", label: "Аналитика", icon: "analytics" },
];

const COURSE_FILTER_FIELDS = [
  { key: "courseNumber", label: "Номер курса", optionKey: "courseNumbers" },
  { key: "subjectName", label: "Предмет", optionKey: "subjectNames" },
  { key: "subjectCode", label: "Код предмета", optionKey: "subjectCodes" },
  { key: "semester", label: "Семестр", optionKey: "semesters" },
  { key: "department", label: "Кафедра", optionKey: "departments" },
  { key: "studyYear", label: "Учебный год", optionKey: "studyYears" },
  { key: "format", label: "Формат", optionKey: "formats" },
  { key: "campus", label: "Кампус", optionKey: "campuses" },
];

const THEME_OPTIONS = [
  { value: "light", label: "Светлая", activeClass: "border-blue-400/80 bg-blue-500 shadow-[0_0_24px_rgba(59,130,246,0.35)]" },
  { value: "dark", label: "Темная", activeClass: "border-violet-400/70 bg-violet-600/90 shadow-[0_0_24px_rgba(139,92,246,0.34)]" },
  { value: "glass", label: "Стекло", activeClass: "border-amber-300/80 bg-orange-500/90 shadow-[0_0_28px_rgba(251,146,60,0.42)]" },
];

const MOTION_OPTIONS = [
  { value: "simple", label: "Простейший", activeClass: "border-slate-400/70 bg-slate-600/90 shadow-[0_0_22px_rgba(148,163,184,0.24)]" },
  { value: "medium", label: "Средний", activeClass: "border-blue-300/70 bg-sky-500/90 shadow-[0_0_24px_rgba(56,189,248,0.32)]" },
  { value: "full", label: "Полный", activeClass: "border-fuchsia-300/75 bg-fuchsia-500/90 shadow-[0_0_28px_rgba(217,70,239,0.34)]" },
];

const ROLE_LABELS = {
  STUDENT: "Студент",
  TEACHER: "Преподаватель",
  ADMIN: "Админ",
};
const ACTIVE_TEST_KEY = "lms-active-test";

function getStoredTheme() {
  return localStorage.getItem("lms-theme") || "light";
}

function getStoredSidebarHidden() {
  return localStorage.getItem("lms-sidebar-collapsed") === "true";
}

function getStoredMotionMode() {
  return localStorage.getItem("lms-motion-mode") || "full";
}

function SegmentedToggle({ value, onChange, options, motionMode, shellClass }) {
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const transition =
    motionMode === "simple"
      ? { duration: 0 }
      : motionMode === "medium"
        ? { type: "spring", stiffness: 250, damping: 30 }
        : { type: "spring", stiffness: 320, damping: 26 };

  return (
    <div className={`relative grid grid-cols-3 gap-2 rounded-2xl border p-1 ${shellClass}`}>
      <motion.div
        className={`absolute bottom-1 top-1 rounded-[14px] border ${options[activeIndex]?.activeClass ?? options[0].activeClass}`}
        animate={{ left: `calc(${activeIndex} * 33.333% + 4px)` }}
        transition={transition}
        style={{ width: "calc(33.333% - 8px)" }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`relative z-10 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            value === option.value ? "text-white" : "text-inherit"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterOptions, setFilterOptions] = useState({});
  const [isSidebarHidden, setIsSidebarHidden] = useState(getStoredSidebarHidden);
  const [theme, setTheme] = useState(getStoredTheme);
  const [motionMode, setMotionMode] = useState(getStoredMotionMode);
  const [language, setLanguage] = useState(i18n.resolvedLanguage || i18n.language || "ru");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  const [user, setUser] = useState(() => getUser());
  const [activeTestReminder, setActiveTestReminder] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ACTIVE_TEST_KEY) || "null");
    } catch {
      return null;
    }
  });
  const isCoursesListPage = location.pathname === "/courses";
  const showCourseFilters = isCoursesListPage && (user?.role === "TEACHER" || user?.role === "ADMIN");
  const sidebarWidth = 280;
  const isDark = theme === "dark";
  const isGlass = theme === "glass";
  const navMotionEnabled = motionMode !== "simple";
  const isFullMotion = motionMode === "full";

  const navItems = useMemo(() => {
    const items = BASE_NAV_ITEMS.map((item) => ({
      ...item,
      label: t(`layout.nav.${item.icon}`, { defaultValue: item.label }),
    }));
    if (user?.role === "TEACHER" || user?.role === "ADMIN") {
      const extended = [...items, { to: "/students", label: t("layout.nav.students"), icon: "students" }];
      extended.push({ to: "/staff", label: "Персонал", icon: "staff" });
      return extended;
    }
    return items;
  }, [t, user?.role]);

  const translatedFilterFields = useMemo(
    () =>
      COURSE_FILTER_FIELDS.map((field) => ({
        ...field,
        label: t(`layout.filterFields.${field.key}`),
      })),
    [t]
  );

  const translatedThemeOptions = useMemo(
    () =>
      THEME_OPTIONS.map((option) => ({
        ...option,
        label:
          option.value === "light"
            ? t("settings.themeLight")
            : option.value === "dark"
              ? t("settings.themeDark")
              : t("settings.themeGlass"),
      })),
    [t]
  );

  const translatedMotionOptions = useMemo(
    () =>
      MOTION_OPTIONS.map((option) => ({
        ...option,
        label:
          option.value === "simple"
            ? t("settings.motionSimple")
            : option.value === "medium"
              ? t("settings.motionMedium")
              : t("settings.motionFull"),
      })),
    [t]
  );

  const userRoleLabel = ROLE_LABELS[user?.role] || "Пользователь";
  const longUserName = String(user?.fullName || user?.email || "").length > 24;

  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", isDark);
    document.documentElement.classList.toggle("theme-glass", isGlass);
    document.documentElement.dataset.motionMode = motionMode;
    localStorage.setItem("lms-theme", theme);
  }, [isDark, isGlass, motionMode, theme]);

  useEffect(() => {
    localStorage.setItem("lms-sidebar-collapsed", String(isSidebarHidden));
    document.documentElement.dataset.sidebarHidden = isSidebarHidden ? "true" : "false";
    window.dispatchEvent(new CustomEvent("sidebar-visibility-changed", { detail: { hidden: isSidebarHidden } }));
  }, [isSidebarHidden]);

  useEffect(() => {
    localStorage.setItem("lms-motion-mode", motionMode);
  }, [motionMode]);

  useEffect(() => {
    localStorage.setItem("lms-language", language);
    i18n.changeLanguage(language);
  }, [i18n, language]);

  useEffect(() => {
    function syncUser() {
      setUser(getUser());
    }

    window.addEventListener(USER_CHANGED_EVENT, syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener(USER_CHANGED_EVENT, syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  useEffect(() => {
    function syncActiveTest() {
      try {
        setActiveTestReminder(JSON.parse(localStorage.getItem(ACTIVE_TEST_KEY) || "null"));
      } catch {
        setActiveTestReminder(null);
      }
    }

    window.addEventListener("storage", syncActiveTest);
    window.addEventListener("lms-active-test-changed", syncActiveTest);
    return () => {
      window.removeEventListener("storage", syncActiveTest);
      window.removeEventListener("lms-active-test-changed", syncActiveTest);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isCoursesListPage) {
      setFilterOptions({});
      return undefined;
    }

    (async () => {
      try {
        const res = await http.get("/course-tag-options");
        if (!cancelled) setFilterOptions(res.data?.options ?? {});
      } catch {
        if (!cancelled) setFilterOptions({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isCoursesListPage]);

  function logout() {
    clearAuth();
    window.location.href = "/login";
  }

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  function resetFilters() {
    setSearchParams(new URLSearchParams());
  }

  const shellClass = isGlass ? "bg-transparent text-slate-100" : isDark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900";
  const sidebarClass = isGlass
    ? "border-white/12 bg-white/[0.08] text-white shadow-[18px_0_48px_-34px_rgba(15,23,42,0.65)] backdrop-blur-2xl"
    : isDark
      ? "border-slate-800/90 bg-slate-950 text-white shadow-[18px_0_48px_-34px_rgba(15,23,42,0.85)]"
      : "border-slate-300/90 bg-slate-100 text-slate-900 shadow-[18px_0_48px_-34px_rgba(148,163,184,0.4)]";
  const inactiveNavClass = isGlass
    ? "border-white/12 bg-white/[0.07] text-white/95 hover:border-white/20 hover:bg-white/[0.11]"
    : isDark
      ? "border-white/10 bg-white/5 text-white/90 hover:border-white/20 hover:bg-white/10"
      : "border-slate-300 bg-white/90 text-slate-800 hover:border-blue-300 hover:bg-blue-50";
  const inactiveNavIconClass = isGlass
    ? "border-white/12 bg-white/[0.11] text-white/90"
    : isDark
      ? "border-white/10 bg-white/10 text-white/85"
      : "border-slate-300 bg-slate-50 text-slate-700";
  const settingsButtonClass = isGlass
    ? "border-white/12 bg-white/[0.08] text-white/95 hover:bg-white/[0.12]"
    : isDark
      ? "border-white/10 bg-white/5 text-white/90 hover:bg-white/10"
      : "border-slate-300 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50";
  const userCardClass = isGlass ? "border-white/12 bg-white/[0.09] backdrop-blur-2xl" : isDark ? "border-white/10 bg-white/5" : "border-slate-300 bg-white";
  const secondaryTextClass = isGlass ? "text-white/78" : isDark ? "text-slate-300" : "text-slate-500";
  const headerClass = isGlass ? "border-white/12 bg-white/[0.08] shadow-[0_18px_44px_-36px_rgba(15,23,42,0.75)]" : isDark ? "border-slate-800/90 bg-slate-950/88" : "border-slate-300/80 bg-white/88";
  const filtersClass = isGlass ? "border-white/12 bg-white/[0.08]" : isDark ? "border-slate-800/90 bg-slate-950/95" : "border-slate-300/80 bg-white/95";
  const filterTitleClass = isGlass ? "text-white" : isDark ? "text-slate-100" : "text-slate-950";
  const filterLabelClass = isGlass ? "text-white/94" : isDark ? "text-slate-200" : "text-slate-700";
  const filterInputClass = isGlass
    ? "border-white/16 bg-white/[0.1] text-white focus:border-white/30"
    : isDark
      ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-blue-400"
      : "border-slate-300 bg-white text-slate-900 focus:border-blue-400";
  const filterResetButtonClass = isGlass
    ? "border-white/12 bg-white/[0.08] text-white hover:border-white/20 hover:bg-white/[0.12]"
    : isDark
      ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-blue-400 hover:bg-slate-800"
      : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50";
  const settingsSectionClass = isGlass ? "border-white/12 bg-white/[0.08] backdrop-blur-2xl" : isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-50";
  const settingsRowClass = isGlass ? "border-white/12 bg-white/[0.07]" : isDark ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-white";
  const segmentedShellClass = isGlass
    ? "border-white/12 bg-white/[0.06] text-white/88"
    : isDark
      ? "border-slate-700 bg-slate-950 text-slate-200"
      : "border-slate-200 bg-white text-slate-700";

  const glassMotionVars =
    motionMode === "simple"
      ? { "--glass-drift-duration": "0s", "--glass-glow-duration": "0s", "--glass-wave-duration": "0s" }
      : motionMode === "medium"
        ? { "--glass-drift-duration": "56s", "--glass-glow-duration": "36s", "--glass-wave-duration": "48s" }
        : { "--glass-drift-duration": "26s", "--glass-glow-duration": "18s", "--glass-wave-duration": "24s" };

  const contentLeft = isSidebarHidden ? 0 : sidebarWidth;
  const hiddenTabLeft = isCoursesListPage ? 12 : 14;
  const filtersRight = showCourseFilters ? 320 : 0;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${shellClass}`}>
      <div
        aria-hidden="true"
        className={`glass-sunset-backdrop pointer-events-none transition-opacity duration-500 ${isGlass ? "opacity-100" : "opacity-0"}`}
        style={glassMotionVars}
      >
        <div className="glass-sunset-backdrop__sky" />
        <div className="glass-sunset-backdrop__sun" />
        <div className="glass-sunset-backdrop__haze" />
        <div className="glass-sunset-backdrop__ocean" />
        <div className="glass-sunset-backdrop__sheen" />
      </div>

      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen w-[280px] flex-col border-r transition-transform duration-300 ${sidebarClass}`}
        style={{ transform: isSidebarHidden ? "translateX(calc(-100% + 18px))" : "translateX(0)" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
          <div className="flex flex-1 items-center justify-center gap-2.5">
            <div className="flex items-center gap-2.5">
              <img
                src={volguLogo}
                alt="Логотип ВолГУ"
                className="h-11 w-11 shrink-0 object-contain drop-shadow-[0_6px_16px_rgba(44,94,214,0.18)]"
              />
              <div
                className="text-[2.08rem] leading-none tracking-[0.16em] text-transparent"
                style={{
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontWeight: 900,
                  backgroundImage: "linear-gradient(135deg, #2258ff 0%, #4f7dff 42%, #6a5cff 68%, #8b3dff 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  WebkitTextStroke: "0.9px rgba(21, 36, 92, 0.72)",
                  textShadow: "0 4px 14px rgba(88, 92, 255, 0.16)",
                }}
              >
                МЕНЮ
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSidebarHidden(true)}
            className={`grid h-12 w-12 place-items-center rounded-2xl border-2 transition ${settingsButtonClass}`}
            style={{ borderColor: "rgba(59, 130, 246, 0.6)", boxShadow: "0 0 0 1px rgba(147, 197, 253, 0.42), 0 8px 22px rgba(59, 130, 246, 0.12)" }}
            title={t("layout.hideMenu")}
          >
            <AppIcon name="chevronLeft" className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col px-3">
          {navItems.map((item, index) => {
            const pathname = location.pathname;
            const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
            const navAnimation = navMotionEnabled ? { x: isActive ? 4 : 0, scale: isActive && isFullMotion ? 1.02 : 1 } : {};
            const navHover = navMotionEnabled ? (isFullMotion ? { x: 3 } : { x: 1.5 }) : {};
            const navTransition = motionMode === "simple" ? { duration: 0 } : motionMode === "medium" ? { duration: 0.14, delay: index * 0.01 } : { duration: 0.2, delay: index * 0.02 };

            return (
              <MotionLink
                key={item.to}
                to={item.to}
                initial={false}
                animate={navAnimation}
                whileHover={navHover}
                transition={navTransition}
                className={`sidebar-nav-item mb-2 flex min-h-[60px] items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-semibold shadow-sm transition ${
                  isActive
                    ? isGlass
                      ? "border-white/18 bg-gradient-to-r from-white/[0.22] via-sky-300/[0.22] to-fuchsia-300/[0.18] text-white shadow-[0_20px_42px_-26px_rgba(251,146,60,0.42)]"
                      : "border-blue-400/50 bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                    : inactiveNavClass
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${
                    isActive ? "border-white/15 bg-white/15 text-white" : inactiveNavIconClass
                  }`}
                >
                  <AppIcon name={item.icon} className="h-[18px] w-[18px]" />
                </span>
                <span className="truncate">{item.label}</span>
              </MotionLink>
            );
          })}
        </nav>

        {user?.role === "STUDENT" && activeTestReminder ? (
          <div className="px-3 pb-3">
            <div className={`rounded-2xl border px-3 py-3 ${isGlass ? "border-red-200/30 bg-red-500/14 text-red-50" : isDark ? "border-red-400/25 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>
              <div className="text-xs font-semibold uppercase tracking-[0.16em]">Незавершенный тест</div>
              <div className="mt-2 text-sm font-semibold">{activeTestReminder.title || "Тест"}</div>
              <div className={`mt-1 text-xs ${isGlass ? "text-red-100/90" : isDark ? "text-red-200/85" : "text-red-600"}`}>
                Времени осталось: {activeTestReminder.remaining || "—"}
              </div>
              <div className={`mt-1 text-xs ${isGlass ? "text-red-100/90" : isDark ? "text-red-200/85" : "text-red-600"}`}>
                Отвечено вопросов: {activeTestReminder.answeredCount ?? 0}
              </div>
              {activeTestReminder.testId && activeTestReminder.attemptId ? (
                <Link
                  to={`/tests/${activeTestReminder.testId}/attempts/${activeTestReminder.attemptId}`}
                  className={`mt-3 flex w-full items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${isGlass ? "border-red-100/30 bg-white/10 text-white hover:bg-white/14" : isDark ? "border-red-300/20 bg-red-500/8 text-red-100 hover:bg-red-500/12" : "border-red-200 bg-white text-red-700 hover:bg-red-50"}`}
                >
                  Вернуться к попытке
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={`mt-auto border-t p-3 ${isGlass ? "border-white/12" : isDark ? "border-white/10" : "border-slate-300/80"}`}>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={`mb-3 flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${settingsButtonClass}`}
            title={t("layout.settings")}
          >
            <span className={`grid h-8 w-8 place-items-center rounded-xl border ${isGlass ? "border-white/12 bg-white/[0.1]" : isDark ? "border-white/10 bg-white/10" : "border-slate-300 bg-slate-50"}`}>
              <AppIcon name="settings" className="h-[18px] w-[18px]" />
            </span>
            <span>{t("layout.settings")}</span>
          </button>

          <div className={`rounded-2xl border p-3 ${userCardClass}`}>
              <div className={`text-xs uppercase tracking-[0.16em] ${secondaryTextClass}`}>{userRoleLabel}</div>
              <div className={`mt-2 break-words font-semibold ${longUserName ? "text-[0.8rem] leading-[1.25rem]" : "text-[0.88rem] leading-5"} ${isGlass ? "text-white" : isDark ? "text-white" : "text-slate-900"}`}>
                {user?.fullName || user?.email || t("layout.unnamed")}
              </div>
              {user?.email ? <div className={`mt-1 break-all text-[0.95rem] ${secondaryTextClass}`}>{user.email}</div> : null}
            <button
              type="button"
              onClick={() => setIsLogoutOpen(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
            >
              <AppIcon name="logout" className="h-5 w-5" />
              <span>{t("auth.logout")}</span>
            </button>
          </div>
        </div>
      </aside>

      {isSidebarHidden ? (
        <button
          type="button"
          onClick={() => setIsSidebarHidden(false)}
          className={`fixed left-3 top-20 z-40 flex items-center gap-2 rounded-r-2xl rounded-l-xl border px-3 py-2.5 shadow-sm transition ${
            isGlass
              ? "border-white/18 bg-white/[0.12] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_12px_30px_-20px_rgba(251,146,60,0.34)] hover:bg-white/[0.16]"
              : isDark
                ? "border-blue-300/50 bg-slate-900 text-blue-100 shadow-[0_0_0_1px_rgba(96,165,250,0.18),0_12px_30px_-20px_rgba(59,130,246,0.42)] hover:bg-slate-800"
                : "border-blue-300 bg-white text-blue-700 shadow-[0_10px_26px_-20px_rgba(59,130,246,0.35)] hover:bg-blue-50"
          }`}
          style={{ left: hiddenTabLeft }}
          title={t("layout.showMenu")}
        >
          <AppIcon name="menuTab" className="h-5 w-5" />
        </button>
      ) : null}

      <div
        className={`flex min-h-screen flex-col transition-[margin] duration-300 ${showCourseFilters ? "mr-[320px]" : ""}`}
        style={{ marginLeft: contentLeft }}
      >
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {showCourseFilters ? (
        <aside className={`fixed bottom-0 right-0 top-0 z-10 w-[320px] border-l px-5 pt-6 pb-4 shadow-[-14px_0_40px_-34px_rgba(15,23,42,0.25)] backdrop-blur ${filtersClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${secondaryTextClass}`}>{t("layout.navigator")}</div>
              <div className={`mt-1 text-2xl font-black tracking-tight ${filterTitleClass}`}>{t("layout.filtersTitle")}</div>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${filterResetButtonClass}`}
            >
              {t("layout.reset")}
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {translatedFilterFields.map((field) => (
              <label key={field.key} className="block">
                <div className={`mb-1.5 text-sm font-medium ${filterLabelClass}`}>{field.label}</div>
                <select
                  value={searchParams.get(field.key) ?? ""}
                  onChange={(e) => updateFilter(field.key, e.target.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${filterInputClass}`}
                >
                  <option value="">{t("layout.anyValue")}</option>
                  {(filterOptions?.[field.optionKey] ?? []).map((value) => (
                    <option key={String(value)} value={String(value)}>
                      {String(value)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </aside>
      ) : null}

      <Modal open={isSettingsOpen} title={t("settings.interfaceTitle")} onClose={() => setIsSettingsOpen(false)}>
        <div className="grid gap-5">
          <section className={`rounded-2xl border p-4 ${settingsSectionClass}`}>
            <div className={`text-sm font-semibold uppercase tracking-[0.12em] ${secondaryTextClass}`}>{t("settings.appearance")}</div>
            <div className="mt-3">
              <SegmentedToggle
                value={theme}
                onChange={setTheme}
                options={translatedThemeOptions}
                motionMode={motionMode}
                shellClass={segmentedShellClass}
              />
            </div>
          </section>

          <section className={`rounded-2xl border p-4 ${settingsSectionClass}`}>
            <div className={`text-sm font-semibold uppercase tracking-[0.12em] ${secondaryTextClass}`}>{t("settings.motion")}</div>
            <div className="mt-3">
              <SegmentedToggle
                value={motionMode}
                onChange={setMotionMode}
                options={translatedMotionOptions}
                motionMode={motionMode}
                shellClass={segmentedShellClass}
              />
            </div>
            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-6 ${settingsRowClass}`}>
              {motionMode === "simple"
                ? t("settings.motionSimpleHint")
                : motionMode === "medium"
                  ? t("settings.motionMediumHint")
                  : t("settings.motionFullHint")}
            </div>
          </section>

          <section className={`rounded-2xl border p-4 ${settingsSectionClass}`}>
            <div className={`text-sm font-semibold uppercase tracking-[0.12em] ${secondaryTextClass}`}>{t("settings.language")}</div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`mt-3 w-full rounded-2xl border px-4 py-3 text-sm font-medium outline-none transition ${filterInputClass}`}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-6 ${settingsRowClass}`}>{t("settings.languageHint")}</div>
          </section>

          <section className={`rounded-2xl border p-4 ${settingsSectionClass}`}>
            <div className={`text-sm font-semibold uppercase tracking-[0.12em] ${secondaryTextClass}`}>{t("settings.behavior")}</div>
            <label className={`mt-3 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${settingsRowClass}`}>
              <div>
                <div className={`font-semibold ${isGlass ? "text-white" : isDark ? "text-slate-100" : "text-slate-900"}`}>{t("settings.hideMenuByDefault")}</div>
                <div className={`text-sm ${secondaryTextClass}`}>{t("settings.hideMenuDescription")}</div>
              </div>
              <input type="checkbox" checked={isSidebarHidden} onChange={(e) => setIsSidebarHidden(e.target.checked)} className="h-5 w-5" />
            </label>
          </section>
        </div>
      </Modal>

      <Modal open={isLogoutOpen} title={t("settings.logoutTitle")} onClose={() => setIsLogoutOpen(false)}>
        <div className="grid gap-4">
          <div className="flex items-start gap-4">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${isGlass ? "border border-red-300/20 bg-red-400/10 text-red-100" : isDark ? "border border-red-400/25 bg-red-500/10 text-red-300" : "border border-red-200 bg-red-50 text-red-500"}`}>
              <AppIcon name="logout" className="h-6 w-6" />
            </div>
            <div>
              <div className={`text-lg font-black ${isGlass ? "text-white" : isDark ? "text-slate-100" : "text-slate-950"}`}>{t("settings.logoutQuestion")}</div>
              <div className={`mt-2 text-sm leading-7 ${isGlass ? "text-white/72" : isDark ? "text-slate-300" : "text-slate-600"}`}>
                {t("settings.logoutDescription")}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsLogoutOpen(false)}
              className={`rounded-xl border px-4 py-2.5 font-semibold transition ${
                isGlass
                  ? "border-white/12 bg-white/[0.08] text-white hover:bg-white/[0.12]"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t("settings.stay")}
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-red-400 bg-red-500 px-4 py-2.5 font-semibold text-white transition hover:bg-red-600"
            >
              {t("auth.logout")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


