import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { http } from "../api/http";
import { getUser } from "../auth/token";
import ActionButton from "../components/ui/ActionButton";
import PageHero from "../components/ui/PageHero";
import SectionCard from "../components/ui/SectionCard";
import PageSkeleton from "../components/ui/Skeleton";

const SEMESTERS = [
  { value: "current", key: "schedule.firstSemester" },
  { value: "next", key: "schedule.secondSemester" },
];

const CURRENT_SLICE_BUTTON_ACCENTS = {
  nav: "border-sky-300/60 bg-sky-500/14 text-sky-50 hover:border-sky-300/80 hover:bg-sky-500/20 theme-readable-strong",
  base: "border-rose-300/60 bg-rose-500/14 text-rose-50 hover:border-rose-300/80 hover:bg-rose-500/20 theme-readable-strong",
  semester: "border-indigo-300/60 bg-indigo-500/14 text-indigo-50 hover:border-indigo-300/80 hover:bg-indigo-500/20 theme-readable-strong",
  view: "border-amber-300/60 bg-amber-500/14 text-amber-50 hover:border-amber-300/80 hover:bg-amber-500/20 theme-readable-strong",
};

const CURRENT_SLICE_SELECTED_ACCENT =
  "current-slice-selected border-sky-300/85 bg-sky-400/20 hover:border-sky-300 hover:bg-sky-400/24";

const LOCALE_MAP = {
  ru: "ru-RU",
  en: "en-US",
  fr: "fr-FR",
  zh: "zh-CN",
};

function parseDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function sortEvents(items) {
  return [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.pairIndex || 0) - (b.pairIndex || 0) || String(a.startTime).localeCompare(String(b.startTime));
  });
}

function isoWeekNumber(date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  return 1 + Math.round((target - firstThursday) / 604800000);
}

function isoWeekParityLabel(date, t) {
  return isoWeekNumber(date) % 2 === 0 ? t("schedule.secondParity") : t("schedule.firstParity");
}

function EmptySlot() {
  const { t } = useTranslation();
  return (
    <div className="schedule-glass-inner rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm theme-readable-soft">
      {t("schedule.freeSlot", { defaultValue: "Свободное окно." })}
    </div>
  );
}

function EventCard({ item }) {
  const { i18n, t } = useTranslation();
  const locale = LOCALE_MAP[i18n.resolvedLanguage] || "ru-RU";
  const meta = [item.location || t("schedule.noAuditorium", { defaultValue: "Без аудитории" }), item.primaryGroupName || t("analytics.noGroup", { defaultValue: "Без группы" }), item.type]
    .filter(Boolean)
    .join(" • ");
  const rhythm =
    item.parity === "ODD"
      ? t("schedule.firstParity", { defaultValue: "числитель" })
      : item.parity === "EVEN"
        ? t("schedule.secondParity", { defaultValue: "знаменатель" })
        : t("schedule.everyWeek", { defaultValue: locale.startsWith("ru") ? "Каждая неделя" : "Every week" });

  return (
    <div className="schedule-glass-inner rounded-2xl border border-slate-300 px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-black theme-readable-strong">{item.title}</div>
          <div className="mt-2 text-sm theme-readable-soft">{meta}</div>
          <div className="mt-1 text-sm theme-readable-soft">
            {item.format} • {rhythm}
          </div>
          {item.mergedGroupNames?.length ? (
            <div className="mt-1 text-sm theme-readable-soft">
              {locale.startsWith("ru") ? `Совмещено с: ${item.mergedGroupNames.join(", ")}` : `Combined with: ${item.mergedGroupNames.join(", ")}`}
            </div>
          ) : null}
          {item.courseTitle ? <div className="mt-1 text-sm theme-readable-soft">{item.courseTitle}</div> : null}
        </div>
        <div className="theme-glass-chip rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold theme-readable-muted">
          {item.startTime}
        </div>
      </div>
    </div>
  );
}

function GroupSelect({ value, onChange, options, showLabel = true, className = "" }) {
  const { t } = useTranslation();
  return (
    <div className={`w-full max-w-[260px] ${className}`.trim()}>
      {showLabel ? (
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] theme-readable-soft">
          {t("schedule.viewLabel", { defaultValue: "Просмотр расписания" })}
        </div>
      ) : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="theme-surface-button theme-readable-strong min-h-[38px] w-full rounded-[12px] border border-slate-300 px-4 py-2 text-[13px] font-semibold shadow-sm transition focus:border-blue-400 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function SchedulePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = LOCALE_MAP[i18n.resolvedLanguage] || "ru-RU";
  const user = getUser();
  const isManager = user?.role === "TEACHER" || user?.role === "ADMIN";

  const [meta, setMeta] = useState({ semesters: SEMESTERS, groups: [] });
  const [viewMode, setViewMode] = useState("week");
  const [semester, setSemester] = useState("current");
  const [cursorDate, setCursorDate] = useState(new Date(2026, 3, 20));
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");

  const viewModes = useMemo(
    () => [
      { value: "day", label: t("schedule.day", { defaultValue: "День" }) },
      { value: "week", label: t("schedule.week", { defaultValue: "Неделя" }) },
      { value: "month", label: t("schedule.month", { defaultValue: "Месяц" }) },
      { value: "year", label: t("schedule.year", { defaultValue: "Год" }) },
    ],
    [t]
  );

  const range = useMemo(() => {
    if (viewMode === "day") {
      const start = new Date(cursorDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(cursorDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (viewMode === "month") return { start: startOfMonth(cursorDate), end: endOfMonth(cursorDate) };
    if (viewMode === "year") return { start: startOfYear(cursorDate), end: endOfYear(cursorDate) };
    return { start: startOfWeek(cursorDate), end: endOfWeek(cursorDate) };
  }, [cursorDate, viewMode]);

  const selectedGroup = useMemo(
    () => meta.groups.find((group) => String(group.id) === String(selectedGroupId)) || null,
    [meta.groups, selectedGroupId]
  );

  const groupOptions = useMemo(() => {
    if (!isManager) return [];
    return [
      { value: "", label: t("schedule.allGroups", { defaultValue: "Все группы вуза" }) },
      ...(meta.groups || []).map((group) => ({ value: String(group.id), label: group.name })),
    ];
  }, [isManager, meta.groups, t]);

  const visibleYear = range.start.getFullYear();
  const weekStart = startOfWeek(cursorDate);
  const weekParity = useMemo(() => isoWeekParityLabel(weekStart, t), [t, weekStart]);

  function formatRange(start, end) {
    return (
      new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(start) +
      " - " +
      new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(end)
    );
  }

  const weekRangeLabel = `${formatRange(range.start, range.end)} (${weekParity})`;

  function formatShortDate(date) {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(date);
  }

  function formatMonth(date) {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
  }

  async function loadSchedule(nextSemester = semester, nextRange = range, nextGroupId = selectedGroupId, options = {}) {
    const silent = options.silent && hasLoaded;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const params = {
        semester: nextSemester,
        from: toIsoDate(nextRange.start),
        to: toIsoDate(nextRange.end),
        calendarYear: nextRange.start.getFullYear(),
      };
      if (nextGroupId) params.groupId = nextGroupId;

      const [metaRes, eventsRes] = await Promise.all([http.get("/schedule/meta"), http.get("/schedule/generated", { params })]);

      setMeta({
        semesters: metaRes.data?.semesters?.length ? metaRes.data.semesters : SEMESTERS,
        groups: metaRes.data?.groups ?? [],
      });
      setEvents(sortEvents(eventsRes.data?.events ?? []));
      setHasLoaded(true);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || t("common.error", { defaultValue: "Ошибка" }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadSchedule(semester, range, selectedGroupId, { silent: hasLoaded });
  }, [semester, range.start.getTime(), range.end.getTime(), selectedGroupId]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursorDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = toIsoDate(date);
      return { id: iso, date, items: events.filter((item) => item.date === iso) };
    });
  }, [cursorDate, events]);

  const monthGrid = useMemo(() => {
    const first = startOfMonth(cursorDate);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const iso = toIsoDate(date);
      return {
        id: iso,
        date,
        currentMonth: date.getMonth() === cursorDate.getMonth(),
        items: events.filter((item) => item.date === iso),
      };
    });
  }, [cursorDate, events]);

  const yearCards = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const date = new Date(cursorDate.getFullYear(), index, 1);
        const count = events.filter((item) => parseDate(item.date).getMonth() === index).length;
        return { id: index, date, count };
      }),
    [cursorDate, events]
  );

  function shiftCursor(direction) {
    const next = new Date(cursorDate);
    if (viewMode === "day") next.setDate(next.getDate() + direction);
    else if (viewMode === "month") next.setMonth(next.getMonth() + direction);
    else if (viewMode === "year") next.setFullYear(next.getFullYear() + direction);
    else next.setDate(next.getDate() + 7 * direction);
    setCursorDate(next);
  }

  if (loading && !hasLoaded) {
    return <PageSkeleton includeStats={false} sections={3} />;
  }

  return (
    <div className="mx-auto max-w-[1760px] space-y-6">
      <PageHero
        eyebrow={t("schedule.eyebrow", { defaultValue: "Календарь вуза" })}
        title={t("schedule.title", { year: visibleYear, defaultValue: `Расписание (${visibleYear})` })}
        description={t("schedule.description", {
          defaultValue:
            "Здесь видно, как выглядит выбранная учебная неделя после разворачивания недельных шаблонов. Преподаватель и администратор могут переключаться между общим обзором и конкретной группой, а для настройки постоянной сетки используется отдельный редактор.",
        })}
        chips={[
          t(SEMESTERS.find((item) => item.value === semester)?.key || "schedule.firstSemester", { defaultValue: "Первый семестр" }),
          selectedGroup
            ? `${t("schedule.viewLabel", { defaultValue: "Просмотр расписания" })}: ${selectedGroup.name}`
            : `${t("schedule.viewLabel", { defaultValue: "Просмотр расписания" })}: ${t("schedule.allGroups", { defaultValue: "Все группы вуза" })}`,
          viewModes.find((item) => item.value === viewMode)?.label,
        ].filter(Boolean)}
      />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-red-700">{error}</div> : null}

      <div className="schedule-glass-panel w-full rounded-[28px] border border-slate-300 px-5 py-5 shadow-sm">
        <div className="flex min-h-[174px] flex-col gap-6">
          <div className="flex max-w-[760px] flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] theme-readable-soft">{t("schedule.currentSlice", { defaultValue: "Актуальный срез" })}</div>
            <div className="text-2xl font-black leading-tight theme-readable-strong xl:pt-1 xl:text-[2rem]">
              {viewMode === "week" ? weekRangeLabel : formatRange(range.start, range.end)}
            </div>
          </div>

          <div className="flex w-full flex-col items-start justify-start gap-4">
            {refreshing ? (
              <div className="theme-surface-inset theme-readable-soft rounded-2xl border border-slate-300 px-4 py-3 text-sm">
                Обновляем расписание без сброса текущего окна...
              </div>
            ) : null}
            <div className="flex flex-wrap justify-start gap-3">
                <ActionButton className={`min-h-[38px] rounded-[12px] px-4 py-2 text-[13px] ${CURRENT_SLICE_BUTTON_ACCENTS.nav}`} tone="secondary" onClick={() => shiftCursor(-1)}>
                  {t("schedule.back", { defaultValue: "Назад" })}
                </ActionButton>
                <ActionButton className={`min-h-[38px] rounded-[12px] px-4 py-2 text-[13px] ${CURRENT_SLICE_BUTTON_ACCENTS.base}`} tone="secondary" onClick={() => setCursorDate(new Date(2026, 3, 20))}>
                  {t("schedule.baseWeek", { defaultValue: "Базовая неделя" })}
                </ActionButton>
                <ActionButton className={`min-h-[38px] rounded-[12px] px-4 py-2 text-[13px] ${CURRENT_SLICE_BUTTON_ACCENTS.nav}`} tone="secondary" onClick={() => shiftCursor(1)}>
                  {t("schedule.forward", { defaultValue: "Вперед" })}
                </ActionButton>
                {SEMESTERS.map((option) => (
                  <ActionButton
                    key={option.value}
                    className={`min-h-[38px] rounded-[12px] px-4 py-2 text-[13px] ${semester === option.value ? CURRENT_SLICE_SELECTED_ACCENT : CURRENT_SLICE_BUTTON_ACCENTS.semester}`}
                    tone="secondary"
                    onClick={() => setSemester(option.value)}
                  >
                    {t(option.key, { defaultValue: option.value === "current" ? "Первый семестр" : "Второй семестр" })}
                  </ActionButton>
                ))}
                {viewModes.map((option) => (
                  <ActionButton
                    key={option.value}
                    className={`min-h-[38px] rounded-[12px] px-4 py-2 text-[13px] ${viewMode === option.value ? CURRENT_SLICE_SELECTED_ACCENT : CURRENT_SLICE_BUTTON_ACCENTS.view}`}
                    tone="secondary"
                    onClick={() => setViewMode(option.value)}
                  >
                    {option.label}
                  </ActionButton>
                ))}
            </div>

            {isManager ? (
              <div className="flex w-full flex-wrap items-center justify-start gap-4 xl:flex-nowrap">
                <ActionButton className={`min-h-[38px] rounded-[12px] px-4 py-2 text-[13px] ${CURRENT_SLICE_SELECTED_ACCENT}`} tone="secondary" onClick={() => navigate("/schedule/editor")}>
                  {t("schedule.editor", { defaultValue: "Зайти в редактор расписания" })}
                </ActionButton>
                <GroupSelect value={selectedGroupId} onChange={setSelectedGroupId} options={groupOptions} showLabel={false} className="max-w-[300px]" />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? (
        <SectionCard title={t("common.loading", { defaultValue: "Загрузка..." })} subtitle={t("layout.nav.schedule", { defaultValue: "Расписание" })}>
          <div className="theme-surface-inset theme-readable-soft rounded-2xl border border-slate-300 px-4 py-5 text-sm">
            {t("schedule.loadingHint", {
              defaultValue: locale.startsWith("ru") ? "Подтягиваем расписание и разворачиваем базовую неделю в выбранный календарный диапазон..." : "Loading schedule and expanding weekly templates...",
            })}
          </div>
        </SectionCard>
      ) : null}

      {!loading && viewMode === "week" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {weekDays.map((day) => {
            const weekdayLabel = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(day.date);
            return (
              <section key={day.id} className="schedule-glass-panel rounded-[28px] border border-slate-300 px-5 py-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-2xl font-black theme-readable-strong">{weekdayLabel}</div>
                  <div className="text-sm font-semibold theme-readable-soft">{formatShortDate(day.date)}</div>
                </div>
                <div className="grid gap-4">
                  {day.items.length ? day.items.map((item) => <EventCard key={item.id} item={item} />) : <EmptySlot />}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {!loading && viewMode === "day" ? (
        <SectionCard title={new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(cursorDate)} subtitle={t("schedule.day", { defaultValue: "День" })}>
          <div className="grid gap-4">{events.length ? events.map((item) => <EventCard key={item.id} item={item} />) : <EmptySlot />}</div>
        </SectionCard>
      ) : null}

      {!loading && viewMode === "month" ? (
        <SectionCard title={formatMonth(cursorDate)} subtitle={t("schedule.month", { defaultValue: "Месяц" })}>
          <div className="grid grid-cols-7 gap-3">
            {Array.from({ length: 7 }, (_, index) => {
              const date = new Date(2026, 3, 20 + index);
              return (
                <div key={index} className="px-2 text-center text-xs font-semibold uppercase tracking-[0.14em] theme-readable-soft">
                  {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date)}
                </div>
              );
            })}
            {monthGrid.map((cell) => (
              <div
                key={cell.id}
                className={`schedule-glass-inner min-h-[140px] rounded-2xl border p-3 ${cell.currentMonth ? "border-slate-300" : "border-slate-200 opacity-70"}`}
              >
                <div className={`mb-2 text-sm font-semibold ${sameDay(cell.date, new Date()) ? "theme-readable-accent" : "theme-readable-soft"}`}>
                  {cell.date.getDate()}
                </div>
                <div className="grid gap-2">
                  {cell.items.slice(0, 2).map((item) => (
                    <div key={item.id} className="theme-glass-chip rounded-xl border border-slate-300 px-3 py-2 text-xs theme-readable-strong">
                      <div className="truncate font-semibold">{item.title}</div>
                      <div className="mt-1 theme-readable-soft">{item.startTime}</div>
                    </div>
                  ))}
                  {cell.items.length > 2 ? (
                    <div className="text-xs font-semibold theme-readable-soft">
                      {locale.startsWith("ru") ? `Еще ${cell.items.length - 2}` : `${cell.items.length - 2} more`}
                    </div>
                  ) : null}
                  {!cell.items.length ? <EmptySlot /> : null}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {!loading && viewMode === "year" ? (
        <SectionCard title={`${t("schedule.year", { defaultValue: "Год" })} ${visibleYear}`} subtitle={t("schedule.year", { defaultValue: "Год" })}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {yearCards.map((card) => (
              <div key={card.id} className="schedule-glass-inner rounded-[24px] border border-slate-300 p-4">
                <div className="text-lg font-black theme-readable-strong">{formatMonth(card.date)}</div>
                <div className="mt-2 text-sm theme-readable-soft">
                  {card.count
                    ? t("schedule.eventsInTemplate", {
                        count: card.count,
                        defaultValue: locale.startsWith("ru") ? `${card.count} событий в шаблоне` : `${card.count} events in template`,
                      })
                    : t("schedule.noEventsYet", {
                        defaultValue: locale.startsWith("ru") ? "Пока без занятий" : "No classes yet",
                      })}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
