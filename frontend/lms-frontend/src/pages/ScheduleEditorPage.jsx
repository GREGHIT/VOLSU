import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { http } from "../api/http";
import ConfirmDialog from "../components/ConfirmDialog";
import Modal from "../components/Modal";
import ActionButton from "../components/ui/ActionButton";
import PageHero from "../components/ui/PageHero";
import SectionCard from "../components/ui/SectionCard";
import PageSkeleton from "../components/ui/Skeleton";
import { formatUiError } from "../utils/uiError";

const WEEK_DAYS = [
  { value: 1, label: "Понедельник" },
  { value: 2, label: "Вторник" },
  { value: 3, label: "Среда" },
  { value: 4, label: "Четверг" },
  { value: 5, label: "Пятница" },
  { value: 6, label: "Суббота" },
  { value: 7, label: "Воскресенье" },
];

const PARITY_OPTIONS = [
  { value: "BOTH", label: "Каждую неделю" },
  { value: "ODD", label: "Только по числителю" },
  { value: "EVEN", label: "Только по знаменателю" },
];

const TYPE_OPTIONS = ["Лекция", "Практика", "Лабораторная", "Консультация", "Экзамен", "Зачет", "Рабочий слот", "Событие"];
const FORMAT_OPTIONS = ["Очное", "Онлайн", "Смешанный"];
const SEMESTER_OPTIONS = [
  { value: "current", label: "Первый семестр" },
  { value: "next", label: "Второй семестр" },
];

const EMPTY_FORM = {
  title: "",
  type: "Лекция",
  format: "Очное",
  location: "",
  parity: "BOTH",
  courseId: "",
  isCombined: false,
  mergedGroupIds: [],
  notes: "",
};

function byPair(a, b) {
  return a.pairIndex - b.pairIndex;
}

function uniqueTemplates(templates) {
  const seen = new Set();
  return templates.filter((template) => {
    if (seen.has(template.id)) return false;
    seen.add(template.id);
    return true;
  });
}

function YearToggle({ selectedYear, onChange }) {
  const motionMode = typeof window !== "undefined" ? window.localStorage.getItem("lms-motion-mode") || "full" : "full";
  const years = [selectedYear - 1, selectedYear, selectedYear + 1];
  const [direction, setDirection] = useState(0);
  const motionClass =
    motionMode === "simple"
      ? ""
      : motionMode === "medium"
        ? "transition-transform duration-200"
        : "transition-transform duration-300 ease-out";
  const buttonMotionClass =
    motionMode === "simple"
      ? ""
      : motionMode === "medium"
        ? "duration-200"
        : "duration-300 hover:-translate-y-[1px] active:translate-y-0";

  useEffect(() => {
    if (!direction) return undefined;
    const timer = window.setTimeout(() => setDirection(0), motionMode === "simple" ? 0 : motionMode === "medium" ? 180 : 260);
    return () => window.clearTimeout(timer);
  }, [direction, motionMode]);

  return (
    <div className="theme-surface-inset relative w-full max-w-[306px] rounded-2xl border border-slate-300/80 bg-white/85 p-1 shadow-sm">
      <div
        className={`pointer-events-none absolute bottom-1 left-1/2 top-1 z-0 -translate-x-1/2 rounded-[14px] border border-violet-300/80 bg-violet-500/90 shadow-[0_0_24px_rgba(139,92,246,0.3)] ${motionClass}`}
        style={{
          width: "calc(33.333% - 8px)",
          transform: "translateX(-50%)",
        }}
      />
      <div
        className={`relative z-10 grid h-[44px] grid-cols-3 gap-2 ${motionClass}`}
        style={{ transform: direction ? `translateX(${direction * 12}px)` : "translateX(0)" }}
      >
        {years.map((year) => {
          const isSelected = year === selectedYear;
          return (
            <button
              key={`year-slot-${year}`}
              type="button"
              onClick={() => {
                if (!isSelected) {
                  setDirection(year > selectedYear ? 1 : -1);
                  onChange(year);
                }
              }}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-[transform,color,opacity] ${buttonMotionClass} ${
                isSelected ? "text-white" : "theme-readable-soft"
              }`}
            >
              {year}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GroupSearchSelect({ groups, selectedGroupId, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return groups;
    return groups.filter((group) =>
      [group.name, group.faculty]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    );
  }, [groups, query]);

  const selectedGroup = useMemo(
    () => groups.find((group) => String(group.id) === String(selectedGroupId)) || null,
    [groups, selectedGroupId]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="theme-surface-button theme-readable-strong flex w-full items-center justify-between rounded-2xl border border-slate-300 px-4 py-3 text-left text-sm transition focus:border-blue-400"
      >
        <span className="truncate">
          {selectedGroup ? `${selectedGroup.name}${selectedGroup.faculty ? ` • ${selectedGroup.faculty}` : ""}` : "Выберите группу"}
        </span>
        <span className={`text-xs transition ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open ? (
        <div className="theme-surface-panel absolute z-20 mt-2 w-full rounded-[24px] border border-slate-300 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Начните вводить название группы"
            className="theme-surface-button theme-readable-strong w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
          />
          <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {filteredGroups.length ? (
              filteredGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    onChange(String(group.id));
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    String(group.id) === String(selectedGroupId)
                      ? "border-blue-400 bg-blue-50 text-slate-950"
                      : "theme-surface-button border-slate-300 hover:border-blue-300"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{group.name}</span>
                    <span className="theme-readable-soft mt-1 block truncate text-xs">{group.faculty || "Без факультета"}</span>
                  </span>
                  <span className="theme-readable-soft text-xs">{String(group.id) === String(selectedGroupId) ? "Выбрано" : ""}</span>
                </button>
              ))
            ) : (
              <div className="theme-readable-soft rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm">
                По этому запросу группы не найдены.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GroupSelectionCard({ group, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
        selected
          ? "theme-surface-button border-blue-400 shadow-[0_0_0_1px_rgba(96,165,250,0.35)]"
          : "theme-surface-button theme-readable-soft border-slate-300 hover:border-blue-300"
      }`}
    >
      <div className="min-w-0">
        <div className={`text-sm font-semibold ${selected ? "theme-readable-strong" : "theme-readable-strong"}`}>{group.name}</div>
        <div className="theme-readable-soft mt-1 text-xs opacity-80">{group.faculty || "Без факультета"}</div>
      </div>
      <div
        className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border transition ${
          selected ? "border-blue-500 bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.16)]" : "border-slate-300 theme-surface-button"
        }`}
      />
    </button>
  );
}

export default function ScheduleEditorPage() {
  const navigate = useNavigate();
  const skipNextReloadRef = useRef(false);
  const [meta, setMeta] = useState({ courses: [], groups: [], pairSlots: [] });
  const [templates, setTemplates] = useState([]);
  const [calendarYear, setCalendarYear] = useState(2026);
  const [semester, setSemester] = useState("current");
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function loadEditor(nextSemester = semester, nextGroupId = selectedGroupId, nextYear = calendarYear, options = {}) {
    const preserveContent = options.preserveContent === true && hasLoaded;
    if (preserveContent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("semester", nextSemester);
      params.set("calendarYear", String(nextYear));
      if (nextGroupId) params.set("groupId", nextGroupId);

      const [metaRes, templatesRes] = await Promise.all([
        http.get("/schedule/meta"),
        http.get(`/schedule/templates?${params.toString()}`),
      ]);

      const groups = metaRes.data?.groups ?? [];
      let resolvedGroupId = nextGroupId;
      let resolvedTemplates = templatesRes.data?.templates ?? [];

      if (!resolvedGroupId && groups.length) {
        resolvedGroupId = String(groups[0].id);
        params.set("groupId", resolvedGroupId);
        const retry = await http.get(`/schedule/templates?${params.toString()}`);
        resolvedTemplates = retry.data?.templates ?? [];
      }

      setMeta({
        courses: metaRes.data?.courses ?? [],
        groups,
        pairSlots: metaRes.data?.pairSlots ?? [],
      });
      const normalizedTemplates = uniqueTemplates(resolvedTemplates).sort(byPair);
      setTemplates(normalizedTemplates);
      if (normalizedTemplates.length) {
        const visibleDays = new Set(normalizedTemplates.map((template) => template.weekday));
        if (!visibleDays.has(selectedDay)) {
          setSelectedDay(normalizedTemplates[0].weekday);
        }
      }
      if (resolvedGroupId !== selectedGroupId) {
        if (!nextGroupId) {
          skipNextReloadRef.current = true;
        }
        setSelectedGroupId(resolvedGroupId);
      }
      setHasLoaded(true);
    } catch (err) {
      setError(formatUiError(err, "Не удалось открыть редактор расписания."));
    } finally {
      if (preserveContent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadEditor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!meta.groups.length || !selectedGroupId) return;
    if (skipNextReloadRef.current) {
      skipNextReloadRef.current = false;
      return;
    }
    loadEditor(semester, selectedGroupId, calendarYear, { preserveContent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester, selectedGroupId, calendarYear]);

  const templatesByDay = useMemo(
    () => templates.filter((template) => template.weekday === selectedDay).sort(byPair),
    [selectedDay, templates]
  );

  const selectedGroup = useMemo(
    () => meta.groups.find((group) => String(group.id) === String(selectedGroupId)) || null,
    [meta.groups, selectedGroupId]
  );

  const availableMergedGroups = useMemo(
    () => meta.groups.filter((group) => String(group.id) !== String(selectedGroupId)),
    [meta.groups, selectedGroupId]
  );

  const semesterLabel = SEMESTER_OPTIONS.find((item) => item.value === semester)?.label || "Первый семестр";

  function openCreate(pairSlot) {
    setEditingTemplate({ mode: "create", pairSlot });
    setForm({
      ...EMPTY_FORM,
      isCombined: false,
    });
  }

  function openEdit(template) {
    setEditingTemplate({
      mode: "edit",
      pairSlot: meta.pairSlots.find((item) => item.pairIndex === template.pairIndex),
      templateId: template.id,
    });
    setForm({
      title: template.title || "",
      type: template.type || "Лекция",
      format: template.format || "Очное",
      location: template.location || "",
      parity: template.parity || "BOTH",
      courseId: template.courseId ? String(template.courseId) : "",
      isCombined: Array.isArray(template.mergedGroupIds) && template.mergedGroupIds.length > 0,
      mergedGroupIds: (template.mergedGroupIds || []).map(String),
      notes: template.notes || "",
    });
  }

  function closeEditor() {
    if (saving) return;
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
  }

  function toggleMergedGroup(groupId) {
    setForm((current) => {
      const exists = current.mergedGroupIds.includes(groupId);
      return {
        ...current,
        mergedGroupIds: exists ? current.mergedGroupIds.filter((id) => id !== groupId) : [...current.mergedGroupIds, groupId],
      };
    });
  }

  async function saveTemplate() {
    if (!editingTemplate?.pairSlot || !selectedGroupId) {
      setError("Сначала выберите группу, для которой собирается базовая неделя.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        calendarYear,
        semester,
        weekday: selectedDay,
        pairIndex: editingTemplate.pairSlot.pairIndex,
        title: form.title,
        type: form.type,
        format: form.format,
        location: form.location,
        parity: form.parity,
        courseId: form.courseId ? Number(form.courseId) : null,
        primaryGroupId: Number(selectedGroupId),
        primaryGroupName: selectedGroup?.name || "",
        mergedGroupIds: form.isCombined ? form.mergedGroupIds.map(Number) : [],
        notes: form.notes,
      };

      if (editingTemplate.mode === "create") {
        await http.post("/schedule/templates", payload);
      } else {
        await http.put(`/schedule/templates/${editingTemplate.templateId}`, payload);
      }

      closeEditor();
      await loadEditor(semester, selectedGroupId, calendarYear, { preserveContent: true });
    } catch (err) {
      setError(formatUiError(err, "Не удалось сохранить шаблон расписания."));
    } finally {
      setSaving(false);
    }
  }

  async function removeTemplate() {
    if (!deleteTarget) return;
    setSaving(true);
    setError("");
    try {
      await http.delete(`/schedule/templates/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadEditor(semester, selectedGroupId, calendarYear, { preserveContent: true });
    } catch (err) {
      setError(formatUiError(err, "Не удалось удалить шаблон расписания."));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !hasLoaded) {
    return <PageSkeleton includeStats={false} sections={3} />;
  }

  return (
    <div className="mx-auto max-w-[1760px] space-y-6">
      <PageHero
        eyebrow="Недельный шаблон"
        title={`Редактор расписания (${calendarYear})`}
        description="Слева выбирается день, по центру редактируются пары выбранного дня, а справа задается контекст группы и семестра. Совмещенные группы теперь включаются только явно внутри конкретной пары."
        chips={[
          semesterLabel,
          selectedGroup ? `Группа: ${selectedGroup.name}` : "Группа пока не выбрана",
          selectedGroup?.faculty ? `Факультет: ${selectedGroup.faculty}` : "Выбран весь вуз",
        ]}
        actions={
          <div className="flex w-full max-w-[520px] flex-col gap-3 lg:items-end">
            <YearToggle selectedYear={calendarYear} onChange={setCalendarYear} />
            <ActionButton tone="secondary" onClick={() => navigate("/schedule")}>
              Назад к расписанию
            </ActionButton>
          </div>
        }
      />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-red-700">{error}</div> : null}
      {refreshing ? (
        <div className="theme-surface-inset theme-readable-soft rounded-2xl border border-slate-300 px-4 py-3 text-sm">
          Обновляем шаблоны без сброса текущего дня и выбранной группы...
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)_340px]">
        <SectionCard title="Дни недели" subtitle="Навигация">
          <div className="grid gap-2">
            {WEEK_DAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => setSelectedDay(day.value)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  selectedDay === day.value
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "theme-surface-button theme-readable-muted border-slate-300 hover:border-blue-300"
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={WEEK_DAYS.find((day) => day.value === selectedDay)?.label || "День недели"}
          subtitle={selectedGroup ? `Базовая неделя группы ${selectedGroup.name}` : "Сначала выберите группу справа"}
          actions={
            <ActionButton tone="secondary" onClick={() => loadEditor(semester, selectedGroupId, calendarYear, { preserveContent: true })} disabled={refreshing}>
              Обновить
            </ActionButton>
          }
        >
          {!selectedGroup ? (
            <div className="theme-surface-inset theme-readable-soft rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm">
              Выберите группу справа, и здесь откроется ее собственный недельный шаблон без примеси чужих совмещенных пар.
            </div>
          ) : (
            <div className="grid gap-4">
              {meta.pairSlots.map((slot) => {
                const template = templatesByDay.find((item) => item.pairIndex === slot.pairIndex);
                return (
                  <div key={slot.pairIndex} className="lazy-render-card theme-surface-inset rounded-[24px] border border-slate-300 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="theme-readable-strong text-lg font-black">
                          {slot.label} • {slot.startTime} - {slot.endTime}
                        </div>
                        {template ? (
                          <div className="mt-3 space-y-2">
                            <div className="theme-readable-strong text-base font-semibold">{template.title}</div>
                            <div className="theme-readable-soft text-sm">
                              {template.type} • {template.format} • {template.location || "Без аудитории"}
                            </div>
                            <div className="theme-readable-soft text-sm">
                              {template.parity === "ODD"
                                ? "Только числитель"
                                : template.parity === "EVEN"
                                  ? "Только знаменатель"
                                  : "Каждая неделя"}
                            </div>
                            {template.mergedGroupNames?.length ? (
                              <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-slate-900">
                                Совмещено с: {template.mergedGroupNames.join(", ")}
                              </div>
                            ) : (
                              <div className="theme-readable-soft text-sm">Обычная пара без совмещенных групп.</div>
                            )}
                          </div>
                        ) : (
                          <div className="theme-readable-soft mt-2 text-sm">Слот пока пустой.</div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {template ? (
                          <>
                            <ActionButton tone="secondary" onClick={() => openEdit(template)}>
                              Изменить
                            </ActionButton>
                            <ActionButton tone="danger" onClick={() => setDeleteTarget(template)}>
                              Удалить
                            </ActionButton>
                          </>
                        ) : (
                          <ActionButton tone="primary" onClick={() => openCreate(slot)}>
                            Заполнить
                          </ActionButton>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Контекст недели" subtitle="Группа и семестр">
          <div className="grid gap-4">
            <div>
              <label className="theme-readable-strong mb-2 block text-sm font-semibold">Группа</label>
              <GroupSearchSelect groups={meta.groups} selectedGroupId={selectedGroupId} onChange={setSelectedGroupId} />
            </div>

            <div>
              <label className="theme-readable-strong mb-2 block text-sm font-semibold">Семестр</label>
              <div className="grid gap-2">
                {SEMESTER_OPTIONS.map((option) => (
                  <ActionButton key={option.value} tone={semester === option.value ? "primary" : "secondary"} onClick={() => setSemester(option.value)}>
                    {option.label}
                  </ActionButton>
                ))}
              </div>
            </div>

            <div className="theme-surface-note theme-readable-soft rounded-2xl border border-slate-300 px-4 py-4 text-sm leading-7">
              {selectedGroup
                ? `Сейчас вы редактируете собственную базовую неделю группы ${selectedGroup.name} на ${calendarYear} год. Если нужно сделать совместную пару, включите это внутри конкретного слота и отметьте дополнительные группы.`
                : `Сначала выберите группу. После этого можно спокойно пройтись по дням недели и заполнить пары на ${calendarYear} год.`}
            </div>
          </div>
        </SectionCard>
      </div>

      <Modal
        open={!!editingTemplate}
        title={editingTemplate?.mode === "edit" ? "Редактирование пары" : "Новая пара"}
        onClose={closeEditor}
      >
        <div className="grid gap-5">
          <div className="theme-surface-note rounded-2xl border border-slate-300 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] theme-readable-soft">Контекст пары</div>
            <div className="theme-readable-strong mt-2 text-base font-bold">
              {selectedGroup ? selectedGroup.name : "Группа не выбрана"} • {WEEK_DAYS.find((day) => day.value === selectedDay)?.label}
            </div>
            <div className="theme-readable-soft mt-1 text-sm">
              Основная группа фиксируется по текущему контексту редактора. Это убирает путаницу, из-за которой раньше пары выглядели как “вечно совмещенные”.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="theme-readable-strong text-sm font-semibold">Название</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                placeholder="Например: Базы данных"
              />
            </label>

            <label className="grid gap-2">
              <span className="theme-readable-strong text-sm font-semibold">Курс</span>
              <select
                value={form.courseId}
                onChange={(event) => setForm((current) => ({ ...current, courseId: event.target.value }))}
                className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
              >
                <option value="">Без привязки к курсу</option>
                {meta.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2">
              <span className="theme-readable-strong text-sm font-semibold">Тип</span>
              <select
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="theme-readable-strong text-sm font-semibold">Формат</span>
              <select
                value={form.format}
                onChange={(event) => setForm((current) => ({ ...current, format: event.target.value }))}
                className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
              >
                {FORMAT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="theme-readable-strong text-sm font-semibold">Ритм</span>
              <select
                value={form.parity}
                onChange={(event) => setForm((current) => ({ ...current, parity: event.target.value }))}
                className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
              >
                {PARITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="theme-readable-strong text-sm font-semibold">Аудитория / место</span>
              <input
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                placeholder="Например: 3-214"
              />
            </label>
          </div>

          <div className="theme-surface-note rounded-2xl border border-slate-300 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="theme-readable-strong text-sm font-semibold">Совмещенная пара</div>
                <div className="theme-readable-soft mt-1 text-sm">
                  Включайте только если это один общий слот сразу для нескольких групп.
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    isCombined: !current.isCombined,
                    mergedGroupIds: current.isCombined ? [] : current.mergedGroupIds,
                  }))
                }
                className={`relative inline-flex h-11 w-24 items-center rounded-full border px-1 transition ${
                  form.isCombined ? "border-blue-500 bg-blue-500/90" : "border-slate-300 theme-surface-button"
                }`}
              >
                <span
                  className={`inline-flex h-9 w-11 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-900 shadow-sm transition ${
                    form.isCombined ? "translate-x-11" : "translate-x-0"
                  }`}
                >
                  {form.isCombined ? "Да" : "Нет"}
                </span>
              </button>
            </div>

            {form.isCombined ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {availableMergedGroups.length ? (
                  availableMergedGroups.map((group) => (
                    <GroupSelectionCard
                      key={group.id}
                      group={group}
                      selected={form.mergedGroupIds.includes(String(group.id))}
                      onToggle={() => toggleMergedGroup(String(group.id))}
                    />
                  ))
                ) : (
                  <div className="theme-readable-soft text-sm">Нет доступных дополнительных групп.</div>
                )}
              </div>
            ) : null}
          </div>

          <label className="grid gap-2">
            <span className="theme-readable-strong text-sm font-semibold">Примечание</span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
              placeholder="Дополнительная информация для расписания"
            />
          </label>

          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton tone="secondary" disabled={saving} onClick={closeEditor}>
              Отмена
            </ActionButton>
            <ActionButton tone="primary" disabled={saving || !form.title.trim()} onClick={saveTemplate}>
              {saving ? "Сохраняем..." : editingTemplate?.mode === "edit" ? "Сохранить изменения" : "Создать пару"}
            </ActionButton>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить пару из базовой недели?"
        message={
          deleteTarget
            ? `Пара "${deleteTarget.title}" будет удалена из недельного шаблона для ${selectedGroup?.name || "этой группы"}.`
            : ""
        }
        confirmLabel={saving ? "Удаляем..." : "Удалить пару"}
        cancelLabel="Отмена"
        busy={saving}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeTemplate}
      />
    </div>
  );
}
