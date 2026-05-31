import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { http } from "../api/http";
import { getUser } from "../auth/token";
import Modal from "../components/Modal";
import PageHero from "../components/ui/PageHero";
import SectionCard from "../components/ui/SectionCard";
import StatCard from "../components/ui/StatCard";

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function mean(values) {
  const filtered = values.map(Number).filter((value) => Number.isFinite(value));
  if (!filtered.length) return null;
  return Math.round((filtered.reduce((sum, value) => sum + value, 0) / filtered.length) * 10) / 10;
}

function toneBySeverity(severity) {
  if (severity === "high") return "amber";
  if (severity === "medium") return "violet";
  return "blue";
}

function decodeBrokenText(value) {
  if (typeof value !== "string") return value || "";
  if (!/[Р]/.test(value)) return value;
  try {
    return decodeURIComponent(escape(value));
  } catch {
    return value;
  }
}

function cleanupTriggerDetail(value) {
  return decodeBrokenText(value)
    .replace(/^\s*\d+\s*студент(?:а|ов)?\s*/i, "")
    .replace(/^\s*студент(?:а|ов)?\s*/i, "")
    .trim();
}

function MetricCard({ label, value, hint, progress, accent = "from-cyan-400 via-blue-500 to-fuchsia-500" }) {
  const percent = clampPercent(progress);

  return (
    <div className="rounded-[24px] border border-slate-300 bg-white/92 p-5 shadow-sm">
      <div className="flex min-h-[112px] items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-h-[3.1rem] items-start text-sm font-semibold uppercase tracking-[0.12em] theme-readable-soft">{label}</div>
          <div className="mt-2 text-4xl font-black leading-none tracking-tight theme-readable-strong tabular-nums">{value}</div>
        </div>
        <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${accent} opacity-90 shadow-[0_0_24px_rgba(59,130,246,0.22)]`} />
      </div>
      <div className="mt-4">
        <div className="student-metric-track">
          <div
            className={`student-metric-fill bg-gradient-to-r ${accent} shadow-[0_0_18px_rgba(56,189,248,0.28)]`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_3.5rem] items-start gap-3 text-xs font-semibold uppercase tracking-[0.12em] theme-readable-soft">
          <span className="min-h-[2.5rem] leading-5">{hint}</span>
          <span className="pt-0.5 text-right tabular-nums">{percent}%</span>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const user = getUser();
  const isStudent = user?.role === "STUDENT";

  const [scope, setScope] = useState(isStudent ? "student" : "university");
  const [groupId, setGroupId] = useState("");
  const [studentId, setStudentId] = useState(isStudent && user?.sub ? String(user.sub) : "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStudents, setSelectedStudents] = useState(null);
  const [data, setData] = useState({
    groups: [],
    students: [],
    metrics: {},
    facts: [],
    triggers: [],
    groupInsights: [],
    studentInsights: [],
    leaderboard: [],
  });

  const scopeOptions = useMemo(
    () => [
      { value: "university", label: t("analytics.byUniversity", { defaultValue: "По вузу" }) },
      { value: "group", label: t("analytics.byGroup", { defaultValue: "По группе" }) },
      { value: "student", label: t("analytics.byStudent", { defaultValue: "По студенту" }) },
    ],
    [t]
  );

  async function loadAnalytics(nextScope = scope, nextGroupId = groupId, nextStudentId = studentId) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("scope", nextScope);
      if (nextScope === "group" && nextGroupId) params.set("groupId", nextGroupId);
      if (nextScope === "student" && nextStudentId) params.set("studentId", nextStudentId);

      const res = await http.get(`/analytics/overview?${params.toString()}`);
      setData({
        groups: res.data?.groups ?? [],
        students: res.data?.students ?? [],
        metrics: res.data?.metrics ?? {},
        facts: res.data?.facts ?? [],
        triggers: res.data?.triggers ?? [],
        groupInsights: res.data?.groupInsights ?? [],
        studentInsights: res.data?.studentInsights ?? [],
        leaderboard: res.data?.leaderboard ?? [],
      });
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось загрузить аналитику.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isStudent && user?.sub) {
      setScope("student");
      setStudentId(String(user.sub));
    }
  }, [isStudent, user?.sub]);

  useEffect(() => {
    loadAnalytics(scope, groupId, studentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, groupId, studentId]);

  const scopedStudents = useMemo(() => {
    if (scope === "group" && groupId) {
      return data.students.filter((student) => String(student.groupId) === String(groupId));
    }
    return data.students;
  }, [data.students, groupId, scope]);

  const metricCards = [
    {
      label: t("analytics.assignmentsAvg", { defaultValue: "Средний балл по заданиям" }),
      value:
        data.metrics.averageAssignmentGrade != null
          ? Number(data.metrics.averageAssignmentGrade).toFixed(Number(data.metrics.averageAssignmentGrade) % 1 === 0 ? 0 : 1)
          : "—",
      hint: t("analytics.assignmentsAvgHint", { defaultValue: "По уже оцененным сдачам" }),
      progress:
        Number(data.metrics.averageAssignmentGrade || 0) <= 5
          ? Number(data.metrics.averageAssignmentGrade || 0) * 20
          : Number(data.metrics.averageAssignmentGrade || 0),
      accent: "from-cyan-400 via-blue-500 to-blue-600",
    },
    {
      label: t("analytics.testsAvg", { defaultValue: "Средний результат тестов" }),
      value: data.metrics.averageTestPercent != null ? `${Math.round(Number(data.metrics.averageTestPercent))}%` : "—",
      hint: t("analytics.testsAvgHint", { defaultValue: "По завершенным попыткам" }),
      progress: clampPercent(data.metrics.averageTestPercent),
      accent: "from-cyan-400 via-violet-500 to-fuchsia-500",
    },
    {
      label: t("analytics.activity", { defaultValue: isStudent ? "Активность студента" : "Активность студентов" }),
      value: `${clampPercent(data.metrics.activeStudentsPercent)}%`,
      hint: t("analytics.activityHint", { defaultValue: "Активность за последние 14 дней" }),
      progress: clampPercent(data.metrics.activeStudentsPercent),
      accent: "from-emerald-400 via-lime-400 to-cyan-400",
    },
    {
      label: t("analytics.risks", { defaultValue: isStudent ? "Сигналы риска" : "Студенты под риском" }),
      value: `${data.metrics.riskStudentsCount ?? 0}`,
      hint: t("analytics.risksHint", {
        defaultValue: isStudent ? "Чем меньше сигналов, тем спокойнее картина" : "Пропуски, низкие оценки, незавершенные тесты",
      }),
      progress: clampPercent(100 - Number(data.metrics.riskStudentsCount ?? 0) * 20),
      accent: "from-sky-400 via-blue-400 to-indigo-500",
    },
  ];

  function renderTriggerDescription(trigger) {
    const detail = cleanupTriggerDetail(trigger.detail);
    if (trigger.students?.length && trigger.count) {
      return (
        <div className="space-x-1 leading-6">
          <button
            type="button"
            onClick={() => setSelectedStudents({ title: decodeBrokenText(trigger.title), students: trigger.students })}
            className="font-semibold text-blue-600 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-500"
          >
            {`${trigger.count} студентов`}
          </button>
          {detail ? <span>{detail}</span> : null}
        </div>
      );
    }
    return <div className="leading-6">{detail}</div>;
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-6">
      <PageHero
        eyebrow={t("analytics.eyebrow", { defaultValue: "Аналитическая панель" })}
        title={t("analytics.title", { defaultValue: "Факты, триггеры и сигналы внимания" })}
        description={t("analytics.description", {
          defaultValue:
            "Панель помогает быстро увидеть сильные стороны, слабые места, точки риска и конкретных студентов, которым сейчас нужно внимание преподавателя.",
        })}
        chips={[
          `${data.metrics.assignmentsCount ?? 0} ${t("analytics.assignmentsShort", { defaultValue: "заданий" })}`,
          `${data.metrics.publishedTestsCount ?? 0} ${t("analytics.testsPublishedShort", { defaultValue: "тестов" })}`,
          `${data.groups.length} ${t("analytics.groupsShort", { defaultValue: "групп" })}`,
          `${data.students.length} ${t("analytics.studentsShort", { defaultValue: "студентов" })}`,
        ]}
      />

      {error ? <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">{error}</div> : null}

      <SectionCard title="Выбор уровня наблюдения" subtitle="Срез">
        <div className="grid gap-4 xl:grid-cols-[1fr_420px_420px]">
          <div className="flex flex-wrap gap-2">
            {scopeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setScope(option.value)}
                disabled={isStudent && option.value !== "student"}
                className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition ${
                  scope === option.value
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "theme-surface-button theme-readable-strong border-slate-300 hover:border-blue-300"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <select
            value={groupId}
            onChange={(event) => {
              setGroupId(event.target.value);
              if (scope !== "group") setScope("group");
            }}
            className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400"
          >
            <option value="">{t("analytics.allGroups", { defaultValue: "Все группы" })}</option>
            {data.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
                {group.faculty ? ` • ${group.faculty}` : ""}
              </option>
            ))}
          </select>

          <select
            value={studentId}
            onChange={(event) => {
              setStudentId(event.target.value);
              if (scope !== "student") setScope("student");
            }}
            className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400"
          >
            <option value="">{t("analytics.studentPicker", { defaultValue: isStudent ? "Мой профиль" : "Все студенты" })}</option>
            {scopedStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {decodeBrokenText(student.fullName)}
                {student.groupName ? ` • ${decodeBrokenText(student.groupName)}` : ""}
              </option>
            ))}
          </select>
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Что работает хорошо" subtitle="Сильные стороны">
          <div className="grid gap-3">
            {(data.facts.length
              ? data.facts
              : [
                  {
                    title: "Пока мало сигналов",
                    detail: "Как только появятся оценки и завершенные попытки, здесь возникнут полезные факты.",
                  },
                ]
            ).map((item) => (
              <div key={`${item.title}-${item.detail}`} className="rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-4 shadow-sm">
                <div className="font-bold theme-readable-strong">{decodeBrokenText(item.title)}</div>
                <div className="mt-1 text-sm leading-6 theme-readable-soft">{decodeBrokenText(item.detail)}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Сигналы внимания" subtitle="Что стоит проверить">
          <div className="grid gap-3">
            {(data.triggers.length
              ? data.triggers
              : [
                  {
                    title: "Критичных отклонений не видно",
                    detail: "Если появятся пропуски, просрочки или падение среднего балла, они будут собраны здесь.",
                    severity: "low",
                  },
                ]
            ).map((item) => (
              <StatCard key={`${item.title}-${item.detail}`} tone={toneBySeverity(item.severity)} label={decodeBrokenText(item.title)} value="" description={renderTriggerDescription(item)} />
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6">
        <SectionCard title="Картина по группам" subtitle="Сильные и слабые зоны">
          <div className="grid gap-3">
            {data.groupInsights.map((group) => (
              <div key={group.groupId ?? group.groupName} className="rounded-2xl border border-slate-300 bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-bold theme-readable-strong">{decodeBrokenText(group.groupName)}</div>
                    <div className="mt-1 text-sm theme-readable-soft">
                      {decodeBrokenText(group.faculty) || "Без факультета"} • {group.studentsCount} студентов
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 font-semibold theme-readable-strong">Задания: {group.assignmentAverage ?? "—"}</span>
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 font-semibold theme-readable-strong">Тесты: {group.testAverage != null ? `${group.testAverage}%` : "—"}</span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-700">Внимание: {group.riskStudentsCount}</span>
                  </div>
                </div>
                {group.strengths?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.strengths.map((strength) => (
                      <span key={strength} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                        {decodeBrokenText(strength)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <Modal open={!!selectedStudents} title={selectedStudents?.title || "Список студентов"} onClose={() => setSelectedStudents(null)}>
        <div className="grid gap-3">
          {(selectedStudents?.students ?? []).map((student, index) => (
            <div key={student.studentId ?? `${student.fullName}-${index}`} className="rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-4">
              <div className="font-semibold theme-readable-strong">{decodeBrokenText(student.fullName)}</div>
              <div className="mt-1 theme-readable-soft">
                {decodeBrokenText(student.groupName) || "Без группы"}
                {student.detail ? ` • ${decodeBrokenText(student.detail)}` : ""}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
