import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { http } from "../api/http";
import { getUser } from "../auth/token";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHero from "../components/ui/PageHero";
import StatCard from "../components/ui/StatCard";
import SectionCard from "../components/ui/SectionCard";
import FeedbackMessage from "../components/ui/FeedbackMessage";
import ActionButton from "../components/ui/ActionButton";
import { formatUiError } from "../utils/uiError";

function formatValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "—";
  return `${value}${suffix}`;
}

function audienceLabel(notification) {
  if (notification.audience === "GROUP") {
    return notification.group?.name ? `Группа: ${notification.group.name}` : "Группа";
  }
  if (notification.audience === "STUDENT") {
    return notification.student?.fullName || notification.student?.email || "Студент";
  }
  return "Весь курс";
}

function cleanNotificationBody(body) {
  const text = String(body || "").trim();
  if (!text) return "Без дополнительного текста";
  return text
    .replace(/\s*\{[^{}]*"kind"\s*:\s*"[^"]+"[^{}]*\}\s*$/s, "")
    .trim() || "Требуется ручная проверка открытого ответа.";
}

export default function CourseGradebook({ embedded = false, refreshKey = 0 }) {
  const { courseId } = useParams();
  const me = getUser();
  const isTeacher = me?.role === "TEACHER" || me?.role === "ADMIN";

  const [data, setData] = useState(null);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notificationsError, setNotificationsError] = useState("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState(null);
  const [deletingNotification, setDeletingNotification] = useState(false);
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [studentFilter, setStudentFilter] = useState("ALL");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    body: "",
    audience: "ALL",
    groupId: "",
    studentId: "",
  });

  async function loadData() {
    if (!isTeacher) return;
    setLoading(true);
    setError("");
    try {
      const [gradebookRes, notificationsRes, groupsRes, studentsRes] = await Promise.all([
        http.get(`/courses/${courseId}/gradebook/full`),
        http.get(`/courses/${courseId}/notifications`),
        http.get("/groups"),
        http.get(`/courses/${courseId}/students`),
      ]);

      setData(gradebookRes.data ?? null);
      setNotifications(notificationsRes.data?.notifications ?? []);
      setGroups(groupsRes.data?.groups ?? []);
      setStudents(studentsRes.data?.students ?? []);
    } catch (err) {
      setError(formatUiError(err, "Не удалось загрузить журнал курса."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, isTeacher, refreshKey]);

  function prefllNotificationForGroup(groupName) {
    const target = groups.find((group) => group.name === groupName);
    setNotificationForm((prev) => ({
      ...prev,
      title: `Уведомление для ${groupName}`,
      audience: "GROUP",
      groupId: target ? String(target.id) : "",
      studentId: "",
    }));
  }

  function prefllNotificationForStudent(studentId, studentName) {
    setNotificationForm((prev) => ({
      ...prev,
      title: `Напоминание: ${studentName}`,
      audience: "STUDENT",
      studentId: String(studentId),
      groupId: "",
    }));
  }

  async function sendNotification(e) {
    e.preventDefault();
    setNotificationsError("");

    if (!notificationForm.title.trim()) return setNotificationsError("Введите заголовок уведомления.");
    if (!notificationForm.body.trim()) return setNotificationsError("Введите текст уведомления.");
    if (notificationForm.audience === "GROUP" && !notificationForm.groupId) return setNotificationsError("Выберите группу для уведомления.");
    if (notificationForm.audience === "STUDENT" && !notificationForm.studentId) return setNotificationsError("Выберите студента для уведомления.");

    try {
      setSendingNotification(true);
      await http.post(`/courses/${courseId}/notifications`, {
        title: notificationForm.title.trim(),
        body: notificationForm.body.trim(),
        audience: notificationForm.audience,
        groupId: notificationForm.audience === "GROUP" ? Number(notificationForm.groupId) : null,
        studentId: notificationForm.audience === "STUDENT" ? Number(notificationForm.studentId) : null,
      });

      setNotificationForm({
        title: "",
        body: "",
        audience: "ALL",
        groupId: "",
        studentId: "",
      });
      await loadData();
    } catch (err) {
      setNotificationsError(formatUiError(err, "Не удалось создать уведомление."));
    } finally {
      setSendingNotification(false);
    }
  }

  async function deleteNotification() {
    if (!notificationToDelete?.id) return;
    try {
      setDeletingNotification(true);
      await http.delete(`/notifications/${notificationToDelete.id}`);
      setNotificationToDelete(null);
      await loadData();
    } catch (err) {
      setNotificationsError(formatUiError(err, "Не удалось удалить уведомление."));
    } finally {
      setDeletingNotification(false);
    }
  }

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const assignments = data?.assignments ?? [];
  const tests = data?.tests ?? [];

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (groupFilter !== "ALL" && row.groupName !== groupFilter) return false;
      if (studentFilter !== "ALL" && String(row.studentId) !== studentFilter) return false;
      if (gradeFilter === "LOW" && ((row.avgAssignmentGrade ?? row.avgTestPercent ?? 101) >= 60)) return false;
      if (gradeFilter === "EMPTY" && row.avgAssignmentGrade != null && row.avgTestPercent != null) return false;
      return true;
    });
  }, [rows, groupFilter, studentFilter, gradeFilter]);

  const stats = useMemo(() => {
    const assignmentAverages = filteredRows.map((row) => row.avgAssignmentGrade).filter((value) => value != null);
    const testAverages = filteredRows.map((row) => row.avgTestPercent).filter((value) => value != null);

    const mean = (items) => {
      if (!items.length) return null;
      return Math.round((items.reduce((sum, value) => sum + value, 0) / items.length) * 10) / 10;
    };

    return {
      students: filteredRows.length,
      groups: new Set(filteredRows.map((row) => row.groupName).filter(Boolean)).size,
      avgAssignments: mean(assignmentAverages),
      avgTests: mean(testAverages),
    };
  }, [filteredRows]);

  if (!isTeacher) {
    return <FeedbackMessage>Журнал курса доступен только преподавателю и администратору.</FeedbackMessage>;
  }

  return (
    <div className={embedded ? "space-y-5" : "mx-auto max-w-[1600px] space-y-6"}>
      {!embedded ? (
        <PageHero
          eyebrow="Журнал оценок"
          title={data?.course?.title || `Курс ${courseId}`}
          description="Сводка по группам, студентам, заданиям, тестам и уведомлениям. Здесь можно быстро найти проблемные зоны и отправить сообщение по контексту."
          chips={["Фильтры по группам", "Уведомления по контексту", "Средние баллы", "Таблица результатов"]}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="blue" label="Студентов в выборке" value={stats.students} description="С учетом текущих фильтров" />
        <StatCard tone="emerald" label="Групп в выборке" value={stats.groups} description="Активные группы в журнале" />
        <StatCard tone="violet" label="Средний балл" value={formatValue(stats.avgAssignments)} description="По заданиям" />
        <StatCard tone="amber" label="Средний %" value={formatValue(stats.avgTests, "%")} description="По тестам" />
      </div>

      <SectionCard title="Фильтры журнала" subtitle="Быстрый отбор">
        <div className="grid gap-3 md:grid-cols-3">
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="rounded-2xl border border-slate-300 bg-white px-4 py-3">
            <option value="ALL">Все группы</option>
            {Array.from(new Set(rows.map((row) => row.groupName).filter(Boolean))).map((groupName) => (
              <option key={groupName} value={groupName}>
                {groupName}
              </option>
            ))}
          </select>
          <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} className="rounded-2xl border border-slate-300 bg-white px-4 py-3">
            <option value="ALL">Все студенты</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.fullName || student.email}
              </option>
            ))}
          </select>
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="rounded-2xl border border-slate-300 bg-white px-4 py-3">
            <option value="ALL">Все записи</option>
            <option value="LOW">Низкие результаты</option>
            <option value="EMPTY">Без результатов</option>
          </select>
        </div>
      </SectionCard>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Уведомления группам и студентам" subtitle="Коммуникация">
          <form onSubmit={sendNotification} className="grid gap-3">
            <input
              value={notificationForm.title}
              onChange={(e) => setNotificationForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Заголовок уведомления"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
            />
            <textarea
              value={notificationForm.body}
              onChange={(e) => setNotificationForm((prev) => ({ ...prev, body: e.target.value }))}
              rows={4}
              placeholder="Текст уведомления"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
            />
            <div className="grid gap-3 md:grid-cols-[0.9fr_1fr_auto]">
              <select
                value={notificationForm.audience}
                onChange={(e) => setNotificationForm((prev) => ({ ...prev, audience: e.target.value }))}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
              >
                <option value="ALL">Всем студентам курса</option>
                <option value="GROUP">Конкретной группе</option>
                <option value="STUDENT">Конкретному студенту</option>
              </select>

              {notificationForm.audience === "GROUP" ? (
                <select
                  value={notificationForm.groupId}
                  onChange={(e) => setNotificationForm((prev) => ({ ...prev, groupId: e.target.value }))}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                >
                  <option value="">Выберите группу</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              ) : notificationForm.audience === "STUDENT" ? (
                <select
                  value={notificationForm.studentId}
                  onChange={(e) => setNotificationForm((prev) => ({ ...prev, studentId: e.target.value }))}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                >
                  <option value="">Выберите студента</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName || student.email}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Получатели: все записанные студенты
                </div>
              )}

              <ActionButton type="submit" tone="dark" disabled={sendingNotification}>
                {sendingNotification ? "Отправка..." : "Создать уведомление"}
              </ActionButton>
            </div>
            {notificationsError ? <FeedbackMessage>{notificationsError}</FeedbackMessage> : null}
          </form>
        </SectionCard>

        <SectionCard title="Лента курса" subtitle="Последние уведомления">
          <div className="max-h-[540px] space-y-3 overflow-x-hidden overflow-y-auto pr-3">
            {notifications.map((notification) => (
              <div key={notification.id} className="max-w-full rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">{notification.title}</div>
                    <div className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs text-slate-600">{audienceLabel(notification)}</div>
                  </div>
                  <ActionButton tone="danger" onClick={() => setNotificationToDelete(notification)}>
                    Удалить
                  </ActionButton>
                </div>
                <div className="mt-2 break-words text-sm leading-6 text-slate-600">{cleanNotificationBody(notification.body)}</div>
                <div className="mt-3 text-xs text-slate-500">
                  {notification.createdBy?.fullName || notification.createdBy?.email || "Автор"} • {new Date(notification.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
            {notifications.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Уведомлений пока нет.</div> : null}
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Группы, студенты, задания и тесты" subtitle="Таблица результатов">
        {error ? <FeedbackMessage className="mb-4">{error}</FeedbackMessage> : null}
        {loading ? <div className="py-8 text-slate-500">Загрузка журнала...</div> : null}
        {!loading && !error && filteredRows.length === 0 ? <div className="py-10 text-center text-slate-500">В журнале пока нет данных.</div> : null}

        {!loading && !error && filteredRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1240px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold">Группа</th>
                  <th className="sticky left-[160px] z-10 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold">Студент</th>
                  {assignments.map((assignment) => (
                    <th key={`assignment-${assignment.id}`} className="border-b border-slate-200 px-4 py-3 text-center font-semibold">
                      {assignment.title}
                    </th>
                  ))}
                  {tests.map((test) => (
                    <th key={`test-${test.id}`} className="border-b border-slate-200 px-4 py-3 text-center font-semibold">
                      {test.title}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-4 py-3 text-center font-semibold">Средний балл</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-center font-semibold">Средний %</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-center font-semibold">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={row.studentId} className={index % 2 ? "bg-slate-50/70" : "bg-white"}>
                    <td className="sticky left-0 border-b border-slate-100 bg-inherit px-4 py-3 text-slate-600">{row.groupName || "Без группы"}</td>
                    <td className="sticky left-[160px] border-b border-slate-100 bg-inherit px-4 py-3">
                      <div className="font-semibold text-slate-900">{row.fullName || row.email}</div>
                      <div className="text-xs text-slate-500">{row.email}</div>
                    </td>
                    {(row.assignments || []).map((cell) => (
                      <td key={`assignment-cell-${row.studentId}-${cell.assignmentId}`} className="border-b border-slate-100 px-4 py-3 text-center">
                        {formatValue(cell.grade)}
                      </td>
                    ))}
                    {(row.tests || []).map((cell) => (
                      <td key={`test-cell-${row.studentId}-${cell.testId}`} className="border-b border-slate-100 px-4 py-3 text-center">
                        {formatValue(cell.percent, "%")}
                      </td>
                    ))}
                    <td className="border-b border-slate-100 px-4 py-3 text-center font-semibold">{formatValue(row.avgAssignmentGrade)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-center font-semibold">{formatValue(row.avgTestPercent, "%")}</td>
                    <td className="border-b border-slate-100 px-4 py-3">
                      <div className="flex flex-wrap justify-center gap-2">
                        {row.groupName ? (
                          <ActionButton className="px-3 py-2 text-xs" onClick={() => prefllNotificationForGroup(row.groupName)}>
                            Напомнить группе
                          </ActionButton>
                        ) : null}
                        <ActionButton className="px-3 py-2 text-xs" tone="primary" onClick={() => prefllNotificationForStudent(row.studentId, row.fullName || row.email)}>
                          Напомнить студенту
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>

      <ConfirmDialog
        open={!!notificationToDelete}
        title="Удаление уведомления"
        message={`Удалить уведомление "${notificationToDelete?.title || ""}"?`}
        confirmLabel="Удалить уведомление"
        busy={deletingNotification}
        onCancel={() => setNotificationToDelete(null)}
        onConfirm={deleteNotification}
      />
    </div>
  );
}
