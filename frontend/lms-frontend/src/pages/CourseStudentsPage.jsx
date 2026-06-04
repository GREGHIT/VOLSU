import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http";
import { getUser } from "../auth/token";
import ActionButton from "../components/ui/ActionButton";
import ConfirmDialog from "../components/ConfirmDialog";
import Modal from "../components/Modal";

export default function CourseStudentsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const isManager = user?.role === "TEACHER" || user?.role === "ADMIN";

  const [course, setCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [enrolled, setEnrolled] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [busyStudentId, setBusyStudentId] = useState(null);
  const [busyGroupAction, setBusyGroupAction] = useState("");
  const [pendingGroupAction, setPendingGroupAction] = useState("");
  const [groupPassword, setGroupPassword] = useState("");
  const [groupPasswordError, setGroupPasswordError] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setError("");
    try {
      const requests = [http.get(`/courses/${courseId}`), http.get(`/courses/${courseId}/students`)];
      if (isManager) {
        requests.push(http.get("/students"), http.get("/groups"));
      }

      const [courseRes, enrolledRes, studentsRes, groupsRes] = await Promise.all(requests);
      setCourse(courseRes.data?.course ?? null);
      setEnrolled(enrolledRes.data?.students ?? []);
      setStudents(studentsRes?.data?.students ?? []);
      setGroups(groupsRes?.data?.groups ?? []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось загрузить состав курса.");
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, isManager]);

  const enrolledIds = useMemo(() => new Set(enrolled.map((student) => student.id)), [enrolled]);

  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        enrolledCount: enrolled.filter((student) => Number(student.groupId) === Number(group.id)).length,
      })),
    [groups, enrolled]
  );

  const selectedGroup = groupOptions.find((group) => String(group.id) === String(selectedGroupId)) ?? null;

  const availableStudents = useMemo(() => {
    const term = query.trim().toLowerCase();
    return students.filter((student) => {
      if (!term) return true;
      return [student.fullName, student.email, student.studentCode, student.groupName, student.faculty]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [students, query]);

  async function toggleStudent(student) {
    if (!isManager) return;

    setError("");
    setBusyStudentId(student.id);
    try {
      if (enrolledIds.has(student.id)) {
        await http.post(`/courses/${courseId}/unenroll`, { studentId: student.id });
      } else {
        await http.post(`/courses/${courseId}/enroll`, { studentEmail: student.email });
      }
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось обновить состав курса.");
    } finally {
      setBusyStudentId(null);
    }
  }

  async function applyGroupAction(mode) {
    if (!selectedGroupId) return;

    setError("");
    setBusyGroupAction(mode);
    try {
      const endpoint = mode === "add" ? "bulk" : "group-remove";
      await http.post(`/courses/${courseId}/enrollments/${endpoint}`, { groupId: Number(selectedGroupId) });
      setPendingGroupAction("");
      setGroupPassword("");
      setGroupPasswordError("");
      await loadData();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err.message ||
          (mode === "add" ? "Не удалось добавить группу на курс." : "Не удалось убрать группу с курса.")
      );
    } finally {
      setBusyGroupAction("");
    }
  }

  async function confirmGroupRemovalWithPassword(e) {
    e.preventDefault();
    if (!selectedGroup) return;

    setGroupPasswordError("");
    if (!groupPassword.trim()) {
      setGroupPasswordError("Введите пароль для подтверждения.");
      return;
    }

    try {
      await http.post("/auth/login", { email: user?.email, password: groupPassword });
      await applyGroupAction("remove");
    } catch (err) {
      setGroupPasswordError(err?.response?.data?.error || err.message || "Не удалось подтвердить удаление группы.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-2 py-3 lg:px-4">
      <ActionButton
        tone="secondary"
        className="relative z-10"
        onClick={() => navigate(`/courses/${courseId}/assignments`)}
      >
        ← Назад к курсу
      </ActionButton>

      {error ? <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-gray-300 bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Состав курса</div>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">{course?.title || `Курс ${courseId}`}</h1>
        <p className="mt-3 max-w-3xl text-gray-600">
          Здесь можно собирать состав курса по группам и по отдельным студентам, а также быстро убирать лишние записи.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-medium text-blue-700">На курсе</div>
            <div className="mt-2 text-3xl font-bold text-gray-950">{enrolled.length}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm font-medium text-emerald-700">В реестре</div>
            <div className="mt-2 text-3xl font-bold text-gray-950">{students.length}</div>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <div className="text-sm font-medium text-violet-700">Групп доступно</div>
            <div className="mt-2 text-3xl font-bold text-gray-950">{groups.length}</div>
          </div>
        </div>
      </section>

      <div className={`grid items-stretch gap-6 ${isManager ? "xl:grid-cols-[0.9fr_1.1fr]" : ""}`}>
        <section className="flex h-[78vh] min-h-[720px] max-h-[900px] flex-col rounded-2xl border border-gray-300 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500">Текущий список</div>
              <div className="mt-1 text-2xl font-bold text-gray-950">{enrolled.length}</div>
            </div>
          </div>

          <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {enrolled.map((student) => (
              <div key={student.id} className="rounded-2xl border border-gray-300 bg-gray-50 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">{student.fullName || student.email}</div>
                    <div className="mt-1 text-sm text-gray-500">
                      {student.groupName || "Без группы"} {student.studentCode ? `• ${student.studentCode}` : ""}
                    </div>
                    <div className="text-sm text-gray-500">{student.faculty || "Факультет не указан"}</div>
                    <div className="mt-1 text-sm text-gray-500">{student.email}</div>
                  </div>

                  {isManager ? (
                    <ActionButton
                      tone="danger"
                      className="relative z-10 shrink-0"
                      disabled={busyStudentId === student.id}
                      onClick={() => toggleStudent(student)}
                    >
                      {busyStudentId === student.id ? "Убираем..." : "Убрать"}
                    </ActionButton>
                  ) : null}
                </div>
              </div>
            ))}

            {enrolled.length === 0 ? <div className="text-sm text-gray-500">На курс пока никто не записан.</div> : null}
          </div>
        </section>

        {isManager ? (
          <section className="flex h-[78vh] min-h-[720px] max-h-[900px] flex-col rounded-2xl border border-gray-300 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500">Набор студентов</div>
                <div className="mt-1 text-2xl font-bold text-gray-950">Группы и ручной отбор</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
                >
                  <option value="">Выберите группу</option>
                  {groupOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                      {group.faculty ? ` • ${group.faculty}` : ""}
                      {typeof group.enrolledCount === "number" ? ` • на курсе: ${group.enrolledCount}` : ""}
                    </option>
                  ))}
                </select>

                <ActionButton
                  tone="dark"
                  disabled={!!busyGroupAction || !selectedGroupId}
                  onClick={() => setPendingGroupAction("add")}
                >
                  {busyGroupAction === "add" ? "Добавление..." : "Добавить группу"}
                </ActionButton>

                <ActionButton
                  tone="danger"
                  disabled={!!busyGroupAction || !selectedGroupId}
                  onClick={() => setPendingGroupAction("remove-confirm")}
                >
                  {busyGroupAction === "remove" ? "Удаление..." : "Удалить группу"}
                </ActionButton>
              </div>
            </div>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по ФИО, почте, группе, факультету или зачетке"
              className="mt-5 w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
            />

            <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {availableStudents.map((student) => {
                const onCourse = enrolledIds.has(student.id);
                return (
                  <div key={student.id} className="rounded-2xl border border-gray-300 bg-gray-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900">{student.fullName || student.email}</div>
                        <div className="mt-1 text-sm text-gray-500">
                          {student.groupName || "Без группы"} {student.studentCode ? `• ${student.studentCode}` : ""}
                        </div>
                        <div className="text-sm text-gray-500">{student.faculty || "Факультет не указан"}</div>
                        <div className="mt-1 text-sm text-gray-500">{student.email}</div>
                      </div>

                      <ActionButton
                        tone={onCourse ? "danger" : "primary"}
                        className="relative z-10 shrink-0"
                        disabled={busyStudentId === student.id}
                        onClick={() => toggleStudent(student)}
                      >
                        {busyStudentId === student.id ? "..." : onCourse ? "Убрать" : "Добавить"}
                      </ActionButton>
                    </div>
                  </div>
                );
              })}

              {availableStudents.length === 0 ? (
                <div className="text-sm text-gray-500">Подходящие студенты не найдены.</div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingGroupAction === "add"}
        title="Добавить группу на курс"
        message="Все студенты выбранной группы будут добавлены в курс. Уже записанные студенты останутся без изменений."
        onCancel={() => setPendingGroupAction("")}
        onConfirm={() => applyGroupAction("add")}
        busy={busyGroupAction === "add"}
        confirmLabel="Добавить группу"
      />

      <ConfirmDialog
        open={pendingGroupAction === "remove-confirm"}
        title="Удалить группу с курса"
        message="Все студенты выбранной группы будут убраны из этого курса. Сама группа в реестре студентов сохранится."
        onCancel={() => setPendingGroupAction("")}
        onConfirm={() => {
          setPendingGroupAction("remove-password");
          setGroupPassword("");
          setGroupPasswordError("");
        }}
        confirmLabel="Продолжить"
        tone="danger"
      />

      <Modal open={pendingGroupAction === "remove-password"} title="Подтвердите удаление группы" onClose={() => setPendingGroupAction("")}>
        <form className="grid gap-4" onSubmit={confirmGroupRemovalWithPassword}>
          <div className="text-sm leading-6 text-slate-600">
            {selectedGroup
              ? `Введите пароль, чтобы убрать группу "${selectedGroup.name}" с курса.`
              : "Введите пароль для подтверждения удаления группы с курса."}
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">Пароль</span>
            <input
              type="password"
              value={groupPassword}
              onChange={(e) => setGroupPassword(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400"
              placeholder="Введите пароль"
            />
          </label>

          {groupPasswordError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{groupPasswordError}</div>
          ) : null}

          <div className="flex justify-end gap-2">
            <ActionButton tone="secondary" onClick={() => setPendingGroupAction("")}>
              Отмена
            </ActionButton>
            <ActionButton type="submit" tone="solidDanger" disabled={busyGroupAction === "remove"}>
              {busyGroupAction === "remove" ? "Удаление..." : "Удалить группу"}
            </ActionButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
