import { useEffect, useMemo, useState } from "react";
import { getUser } from "../auth/token";
import { http } from "../api/http";

const emptyStudentForm = {
  email: "",
  password: "123456",
  fullName: "",
  studentCode: "",
  faculty: "",
  groupId: "",
};

export default function StudentsManagementPage() {
  const user = getUser();
  const isManager = user?.role === "TEACHER" || user?.role === "ADMIN";

  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [query, setQuery] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [groupForm, setGroupForm] = useState({ name: "", faculty: "" });
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [error, setError] = useState("");
  const [savingStudent, setSavingStudent] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);

  async function loadData() {
    setError("");
    try {
      const [studentsRes, groupsRes] = await Promise.all([http.get("/students"), http.get("/groups")]);
      setStudents(studentsRes.data?.students ?? []);
      setGroups(groupsRes.data?.groups ?? []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось загрузить данные.");
    }
  }

  useEffect(() => {
    if (isManager) {
      loadData();
    }
  }, [isManager]);

  async function createGroup(event) {
    event.preventDefault();
    setError("");
    try {
      setSavingGroup(true);
      await http.post("/groups", groupForm);
      setGroupForm({ name: "", faculty: "" });
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось создать группу.");
    } finally {
      setSavingGroup(false);
    }
  }

  async function saveStudent(event) {
    event.preventDefault();
    setError("");

    const payload = {
      ...studentForm,
      groupId: studentForm.groupId ? Number(studentForm.groupId) : null,
    };

    try {
      setSavingStudent(true);
      if (editingStudentId) {
        await http.put(`/students/${editingStudentId}`, {
          fullName: payload.fullName,
          studentCode: payload.studentCode,
          faculty: payload.faculty,
          groupId: payload.groupId,
        });
      } else {
        await http.post("/students", payload);
      }

      setEditingStudentId(null);
      setStudentForm(emptyStudentForm);
      await loadData();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err.message ||
          (editingStudentId ? "Не удалось обновить студента." : "Не удалось создать студента.")
      );
    } finally {
      setSavingStudent(false);
    }
  }

  function startEdit(student) {
    setEditingStudentId(student.id);
    setStudentForm({
      email: student.email || "",
      password: "123456",
      fullName: student.fullName || "",
      studentCode: student.studentCode || "",
      faculty: student.faculty || "",
      groupId: student.groupId ? String(student.groupId) : "",
    });
  }

  function resetStudentForm() {
    setEditingStudentId(null);
    setStudentForm(emptyStudentForm);
  }

  const filteredStudents = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return students;
    return students.filter((student) =>
      [student.fullName, student.email, student.studentCode, student.groupName, student.faculty]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [students, query]);

  const filteredGroups = useMemo(() => {
    const term = groupQuery.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((group) =>
      [group.name, group.faculty]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [groupQuery, groups]);

  const stats = useMemo(() => {
    const faculties = new Set(groups.map((group) => group.faculty).filter(Boolean));
    return {
      students: students.length,
      groups: groups.length,
      faculties: faculties.size,
    };
  }, [groups, students]);

  if (!isManager) {
    return <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">Доступ запрещен.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-2 py-3 lg:px-4">
      {error ? <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Управление контингентом</div>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">Реестр студентов и групп</h1>
        <p className="mt-3 max-w-4xl text-gray-600">
          Здесь преподаватель или администратор может вести общий список студентов вуза, создавать учебные группы и
          быстро подбирать состав для курсов.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="text-sm font-medium text-blue-700">Студенты</div>
            <div className="mt-2 text-3xl font-bold text-gray-950">{stats.students}</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-sm font-medium text-emerald-700">Группы</div>
            <div className="mt-2 text-3xl font-bold text-gray-950">{stats.groups}</div>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
            <div className="text-sm font-medium text-violet-700">Факультеты</div>
            <div className="mt-2 text-3xl font-bold text-gray-950">{stats.faculties}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500">Все студенты</div>
              <div className="mt-1 text-2xl font-bold text-gray-950">{filteredStudents.length}</div>
            </div>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по ФИО, почте, зачетке, группе или факультету"
              className="w-full max-w-md rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200">
            <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr_auto] gap-3 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">
              <div>Студент</div>
              <div>Email</div>
              <div>Группа</div>
              <div>Факультет</div>
              <div className="text-right">Действия</div>
            </div>

            <div className="max-h-[560px] overflow-y-auto">
              {filteredStudents.map((student) => (
                <div key={student.id} className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr_auto] gap-3 border-t border-gray-100 px-4 py-3 text-sm">
                  <div>
                    <div className="font-semibold text-gray-900">{student.fullName || "Без имени"}</div>
                    <div className="text-gray-500">{student.studentCode || "Номер зачетки не задан"}</div>
                  </div>
                  <div className="break-all text-gray-700">{student.email}</div>
                  <div className="text-gray-700">{student.groupName || "—"}</div>
                  <div className="text-gray-700">{student.faculty || "—"}</div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(student)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-100"
                    >
                      Изменить
                    </button>
                  </div>
                </div>
              ))}

              {filteredStudents.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">Подходящие студенты не найдены.</div>
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid gap-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500">Добавить группу</div>
            <form onSubmit={createGroup} className="mt-4 grid gap-3">
              <input
                value={groupForm.name}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Например: ИС-21-1"
                className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
              />
              <input
                value={groupForm.faculty}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, faculty: event.target.value }))}
                placeholder="Факультет"
                className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
              />
              <button
                type="submit"
                disabled={savingGroup}
                className="rounded-xl bg-gray-900 px-4 py-2.5 font-semibold text-white transition hover:bg-black disabled:opacity-50"
              >
                {savingGroup ? "Сохранение..." : "Создать группу"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500">
                {editingStudentId ? "Редактирование студента" : "Добавить студента"}
              </div>
              {editingStudentId ? (
                <button
                  type="button"
                  onClick={resetStudentForm}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                >
                  Отменить
                </button>
              ) : null}
            </div>

            <form onSubmit={saveStudent} className="mt-4 grid gap-3">
              <input
                value={studentForm.fullName}
                onChange={(event) => setStudentForm((prev) => ({ ...prev, fullName: event.target.value }))}
                placeholder="ФИО"
                className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
              />
              <input
                value={studentForm.email}
                onChange={(event) => setStudentForm((prev) => ({ ...prev, email: event.target.value }))}
                disabled={!!editingStudentId}
                placeholder="Email"
                className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-blue-400 disabled:bg-gray-50"
              />
              <input
                value={studentForm.studentCode}
                onChange={(event) => setStudentForm((prev) => ({ ...prev, studentCode: event.target.value }))}
                placeholder="Номер зачетки"
                className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
              />
              <input
                value={studentForm.faculty}
                onChange={(event) => setStudentForm((prev) => ({ ...prev, faculty: event.target.value }))}
                placeholder="Факультет"
                className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
              />
              <select
                value={studentForm.groupId}
                onChange={(event) => setStudentForm((prev) => ({ ...prev, groupId: event.target.value }))}
                className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
              >
                <option value="">Без группы</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                    {group.faculty ? ` • ${group.faculty}` : ""}
                  </option>
                ))}
              </select>

              {!editingStudentId ? (
                <input
                  value={studentForm.password}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Пароль"
                  className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
                />
              ) : null}

              <button
                type="submit"
                disabled={savingStudent}
                className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {savingStudent
                  ? editingStudentId
                    ? "Сохранение..."
                    : "Создание..."
                  : editingStudentId
                    ? "Сохранить изменения"
                    : "Создать студента"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500">Список групп</div>
              <input
                value={groupQuery}
                onChange={(event) => setGroupQuery(event.target.value)}
                placeholder="Поиск по группе или факультету"
                className="w-full max-w-sm rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
              />
            </div>

            <div className="mt-4 max-h-[360px] overflow-y-auto pr-1">
              <div className="grid gap-2">
                {filteredGroups.map((group) => (
                  <div key={group.id} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="font-semibold text-gray-900">{group.name}</div>
                    <div className="text-sm text-gray-500">
                      {group.faculty || "Факультет не указан"} • студентов: {group.studentsCount}
                    </div>
                  </div>
                ))}

                {filteredGroups.length === 0 ? <div className="text-sm text-gray-500">Подходящие группы не найдены.</div> : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
