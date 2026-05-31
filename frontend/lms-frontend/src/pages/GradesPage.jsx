import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { http } from "../api/http";
import { getUser } from "../auth/token";
import ActionButton from "../components/ui/ActionButton";
import FeedbackMessage from "../components/ui/FeedbackMessage";
import PageHero from "../components/ui/PageHero";
import SectionCard from "../components/ui/SectionCard";
import StatCard from "../components/ui/StatCard";
import { formatUiError } from "../utils/uiError";

function average(values) {
  const filtered = values.filter((value) => value != null);
  if (!filtered.length) return null;
  return Math.round((filtered.reduce((sum, value) => sum + value, 0) / filtered.length) * 10) / 10;
}

function sanitizeScore(value) {
  if (value === "" || value == null) return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return Math.max(0, Math.min(100, numeric));
}

export default function GradesPage() {
  const [searchParams] = useSearchParams();
  const user = getUser();
  const isStudent = user?.role === "STUDENT";
  const canEdit = user?.role === "TEACHER" || user?.role === "ADMIN";

  const [courses, setCourses] = useState([]);
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedGroupName, setSelectedGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadOverview(courseId = selectedCourseId) {
    setLoading(true);
    setError("");
    try {
      const res = await http.get("/grades/overview", {
        params: courseId ? { courseId } : {},
      });
      const nextRows = res.data?.rows ?? [];
      setCourses(res.data?.courses ?? []);
      setRows(nextRows);
      setDrafts(
        Object.fromEntries(
          nextRows.map((row) => [
            row.id,
            {
              module1Score: row.module1Score ?? "",
              module2Score: row.module2Score ?? "",
              module3Score: row.module3Score ?? "",
              notes: row.notes || "",
            },
          ])
        )
      );
    } catch (err) {
      setError(formatUiError(err, "Не удалось загрузить раздел оценок."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialCourseId = searchParams.get("courseId") || "";
    if (initialCourseId) {
      setSelectedCourseId(initialCourseId);
    }
    loadOverview(initialCourseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    loadOverview(selectedCourseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  function updateDraft(rowId, key, value) {
    setDrafts((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [key]: key === "notes" ? value : sanitizeScore(value),
      },
    }));
    setSuccess("");
  }

  const groupOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.student?.groupName || "").filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedGroupName && (row.student?.groupName || "") !== selectedGroupName) return false;
      return true;
    });
  }, [rows, selectedGroupName]);

  const dirtyRowIds = useMemo(() => {
    return rows
      .filter((row) => {
        const draft = drafts[row.id];
        if (!draft) return false;
        return ["module1Score", "module2Score", "module3Score", "notes"].some((key) => String(draft[key] ?? "") !== String(row[key] ?? ""));
      })
      .map((row) => row.id);
  }, [drafts, rows]);

  async function saveChanges() {
    if (!dirtyRowIds.length) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await Promise.all(
        dirtyRowIds.map((rowId) =>
          http.put(`/grades/${rowId}`, {
            module1Score: drafts[rowId]?.module1Score === "" ? null : Number(drafts[rowId]?.module1Score),
            module2Score: drafts[rowId]?.module2Score === "" ? null : Number(drafts[rowId]?.module2Score),
            module3Score: drafts[rowId]?.module3Score === "" ? null : Number(drafts[rowId]?.module3Score),
            notes: drafts[rowId]?.notes || "",
          })
        )
      );
      setSuccess("Изменения сохранены.");
      await loadOverview(selectedCourseId);
    } catch (err) {
      setError(formatUiError(err, "Не удалось сохранить модульные оценки."));
    } finally {
      setSaving(false);
    }
  }

  async function exportReport(format) {
    try {
      setExportingFormat(format);
      const response = await http.get("/grades/export", {
        params: {
          ...(selectedCourseId ? { courseId: selectedCourseId } : {}),
          format,
        },
        responseType: "blob",
      });
      const mimeType = format === "word" ? "application/msword" : "application/vnd.ms-excel";
      const extension = format === "word" ? "doc" : "xls";
      const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `grades-report-${selectedCourseId || "all"}.${extension}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(formatUiError(err, "Не удалось сформировать отчет."));
    } finally {
      setExportingFormat("");
    }
  }

  const stats = useMemo(() => {
    const testAverages = filteredRows.map((row) => row.testAverage).filter((value) => value != null);
    const moduleAverages = filteredRows.map((row) => row.moduleAverage).filter((value) => value != null);
    return {
      students: filteredRows.length,
      courses: new Set(filteredRows.map((row) => row.courseId)).size,
      tests: average(testAverages),
      modules: average(moduleAverages),
    };
  }, [filteredRows]);

  return (
    <div className="mx-auto w-full max-w-[1720px] space-y-6">
      <PageHero
        eyebrow="Оценки"
        title={isStudent ? "Мои результаты по курсам" : "Оценки, модули и отчеты"}
        description={
          isStudent
            ? "Здесь собраны автоматические средние результаты по тестам и модульные оценки, которые выставляет преподаватель."
            : "Раздел объединяет автоматическую тестовую оценку и ручные модульные оценки по каждому студенту курса."
        }
        chips={["Тестовый средний балл", "3 модуля в семестре", isStudent ? "Только мои результаты" : "Экспорт в Word и Excel"]}
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-3">
              <ActionButton tone="secondary" onClick={() => exportReport("word")} disabled={exportingFormat === "word"}>
                {exportingFormat === "word" ? "Готовим Word..." : "Скачать Word"}
              </ActionButton>
              <ActionButton tone="primary" onClick={() => exportReport("excel")} disabled={exportingFormat === "excel"}>
                {exportingFormat === "excel" ? "Готовим Excel..." : "Скачать Excel"}
              </ActionButton>
            </div>
          ) : null
        }
      />

      {error ? <FeedbackMessage>{error}</FeedbackMessage> : null}
      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{success}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="blue" label="Записей в выборке" value={stats.students} description="Студенты и курсы" />
        <StatCard tone="violet" label="Курсов" value={stats.courses} description="Активный контур оценивания" />
        <StatCard tone="emerald" label="Средний тестовый балл" value={stats.tests == null ? "—" : `${stats.tests}%`} description="Формируется автоматически" />
        <StatCard tone="amber" label="Средний модульный балл" value={stats.modules == null ? "—" : stats.modules} description="По трем ручным модулям" />
      </div>

      <SectionCard title="Фильтры" subtitle="Курс и группа">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,420px)_minmax(260px,420px)_auto] lg:items-center">
          <select
            value={selectedCourseId}
            onChange={(event) => setSelectedCourseId(event.target.value)}
            className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 bg-white px-4 py-3"
          >
            <option value="">Все доступные курсы</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>

          <select
            value={selectedGroupName}
            onChange={(event) => setSelectedGroupName(event.target.value)}
            className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 bg-white px-4 py-3"
          >
            <option value="">Все группы</option>
            {groupOptions.map((groupName) => (
              <option key={groupName} value={groupName}>
                {groupName}
              </option>
            ))}
          </select>

          {selectedCourseId || selectedGroupName ? (
            <ActionButton
              tone="secondary"
              onClick={() => {
                setSelectedCourseId("");
                setSelectedGroupName("");
              }}
            >
              Сбросить фильтры
            </ActionButton>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title={isStudent ? "Мои оценки" : "Таблица оценок"}
        subtitle={isStudent ? "По тестам и модулям" : "Автоматические и ручные показатели"}
        actions={
          canEdit ? (
            <ActionButton tone="primary" onClick={saveChanges} disabled={saving || !dirtyRowIds.length}>
              {saving ? "Сохраняем..." : dirtyRowIds.length ? `Сохранить изменения (${dirtyRowIds.length})` : "Изменений нет"}
            </ActionButton>
          ) : null
        }
      >
        {loading ? <div className="py-8 text-sm theme-readable-soft">Загружаем оценки...</div> : null}
        {!loading && filteredRows.length === 0 ? <div className="py-10 text-center text-sm theme-readable-soft">Пока нет данных для выбранной выборки.</div> : null}

        {!loading && filteredRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1280px] w-full text-sm">
              <thead className="grade-table-head">
                <tr>
                  {!isStudent ? <th className="px-4 py-3 text-left font-semibold">Студент</th> : null}
                  <th className="px-4 py-3 text-left font-semibold">Курс</th>
                  {!isStudent ? <th className="px-4 py-3 text-left font-semibold">Группа</th> : null}
                  <th className="px-4 py-3 text-center font-semibold">Тесты, %</th>
                  <th className="px-4 py-3 text-center font-semibold">Модуль 1</th>
                  <th className="px-4 py-3 text-center font-semibold">Модуль 2</th>
                  <th className="px-4 py-3 text-center font-semibold">Модуль 3</th>
                  <th className="px-4 py-3 text-center font-semibold">Средний модульный</th>
                  <th className="px-4 py-3 text-left font-semibold">Примечания</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => {
                  const draft = drafts[row.id] || {};
                  return (
                    <tr key={row.id} className={index % 2 ? "grade-table-row grade-table-row-alt" : "grade-table-row"}>
                      {!isStudent ? (
                        <td className="border-b border-slate-100 px-4 py-3">
                          <div className="font-semibold text-slate-900">{row.student.fullName || row.student.email}</div>
                          <div className="text-xs text-slate-500">{row.student.email}</div>
                        </td>
                      ) : null}
                      <td className="border-b border-slate-100 px-4 py-3">{row.course.title}</td>
                      {!isStudent ? <td className="border-b border-slate-100 px-4 py-3">{row.student.groupName || "—"}</td> : null}
                      <td className="border-b border-slate-100 px-4 py-3 text-center font-semibold">{row.testAverage == null ? "—" : `${row.testAverage}%`}</td>
                      {[1, 2, 3].map((moduleNumber) => {
                        const key = `module${moduleNumber}Score`;
                        return (
                          <td key={`${row.id}-${key}`} className="border-b border-slate-100 px-4 py-3 text-center">
                            {canEdit ? (
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={draft[key] ?? ""}
                                className="theme-surface-button theme-readable-strong w-24 rounded-xl border border-slate-300 px-3 py-2 text-center"
                                onChange={(event) => updateDraft(row.id, key, event.target.value)}
                              />
                            ) : (
                              row[key] ?? "—"
                            )}
                          </td>
                        );
                      })}
                      <td className="border-b border-slate-100 px-4 py-3 text-center font-semibold">{row.moduleAverage ?? "—"}</td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        {canEdit ? (
                          <textarea
                            rows={2}
                            value={draft.notes ?? ""}
                            className="theme-surface-button theme-readable-strong min-w-[220px] rounded-xl border border-slate-300 px-3 py-2"
                            onChange={(event) => updateDraft(row.id, "notes", event.target.value)}
                          />
                        ) : (
                          row.notes || "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
