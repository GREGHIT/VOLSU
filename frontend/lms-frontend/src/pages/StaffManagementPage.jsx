import { useEffect, useMemo, useState } from "react";
import { getUser, setUser } from "../auth/token";
import { http } from "../api/http";
import PageHero from "../components/ui/PageHero";
import SectionCard from "../components/ui/SectionCard";
import { formatUiError } from "../utils/uiError";

const emptyStaffForm = {
  email: "",
  password: "123456",
  fullName: "",
  faculty: "",
  role: "TEACHER",
  staffTitle: "",
  staffCategory: "TEACHER",
  accessSystems: [],
  permissions: [],
  managedGroupIds: [],
};

const ACCESS_PRESETS = {
  TEACHER: {
    label: "Преподаватель",
    role: "TEACHER",
    staffCategory: "TEACHER",
    permissions: ["GRADES_EDIT", "GRADES_EXPORT", "TESTS_VIEW", "TESTS_EDIT", "TESTS_INSPECT", "COURSES_VIEW", "COURSES_EDIT", "ANALYTICS_VIEW", "STUDENTS_MANAGE"],
    accessSystems: ["LMS Core", "Content Library", "Schedule Editor", "Analytics Console", "Notifications"],
  },
  ADMIN: {
    label: "Администратор",
    role: "ADMIN",
    staffCategory: "DEVELOPER",
    permissions: ["COURSES_VIEW", "COURSES_EDIT", "TESTS_VIEW", "TESTS_EDIT", "TESTS_INSPECT", "SCHEDULE_EDIT", "ANALYTICS_VIEW", "ANALYTICS_EXPORT", "GRADES_EDIT", "GRADES_EXPORT", "STUDENTS_MANAGE", "STAFF_MANAGE", "SYSTEMS_MANAGE"],
    accessSystems: ["LMS Core", "Schedule Editor", "Analytics Console", "Content Library", "Notifications", "Audit Log", "Database Tools", "Deployment"],
  },
};

const ROLE_LABELS = {
  ADMIN: "Администратор",
  TEACHER: "Преподаватель",
  STUDENT: "Студент",
};

const CATEGORY_LABELS = {
  TEACHER: "Преподаватель",
  DEVELOPER: "Разработчик",
  SUPPORT: "Поддержка",
  ADMINISTRATION: "Администрация",
  STAFF: "Сотрудник",
};

const SYSTEM_LABELS = {
  "LMS Core": "Базовая LMS",
  "Schedule Editor": "Редактор расписания",
  "Analytics Console": "Консоль аналитики",
  "Content Library": "Библиотека материалов",
  Notifications: "Уведомления",
  "Audit Log": "Журнал аудита",
  "Database Tools": "Инструменты базы данных",
  Deployment: "Публикация и развёртывание",
};

const PERMISSION_LABELS = {
  COURSES_VIEW: "Просмотр курсов",
  COURSES_EDIT: "Редактирование курсов",
  TESTS_VIEW: "Просмотр тестов",
  TESTS_EDIT: "Редактирование тестов",
  TESTS_INSPECT: "Осмотр тестов с ответами",
  SCHEDULE_EDIT: "Редактирование расписания",
  ANALYTICS_VIEW: "Просмотр аналитики",
  ANALYTICS_EXPORT: "Экспорт аналитики",
  GRADES_EDIT: "Редактирование оценок",
  GRADES_EXPORT: "Экспорт оценок",
  STUDENTS_MANAGE: "Управление студентами",
  STAFF_MANAGE: "Управление персоналом",
  SYSTEMS_MANAGE: "Управление системами",
  GRADEBOOK_VIEW: "Просмотр журнала оценок",
  GRADEBOOK_EDIT: "Редактирование журнала оценок",
  TEST_MANAGE: "Создание и настройка тестов",
  REPORT_EXPORT: "Экспорт отчётов",
};

function toggleValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function translatedSystemLabel(value) {
  return `${SYSTEM_LABELS[value] || value} (${value})`;
}

function translatedPermissionLabel(value) {
  return `${PERMISSION_LABELS[value] || value} (${value})`;
}

export default function StaffManagementPage() {
  const user = getUser();
  const canManage = user?.role === "ADMIN" || user?.permissions?.includes("STAFF_MANAGE");
  const canView = canManage || user?.role === "TEACHER" || user?.role === "ADMIN";

  const [staff, setStaff] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyStaffForm);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [accessPreset, setAccessPreset] = useState("TEACHER");
  const [options, setOptions] = useState({
    systems: [],
    permissions: [],
    categories: [],
    titles: [],
    groups: [],
  });

  async function loadData() {
    setError("");
    try {
      const staffRes = await http.get("/staff");
      setStaff(staffRes.data?.staff ?? []);

      if (canManage) {
        const optionsRes = await http.get("/staff/options");
        setOptions({
          systems: optionsRes.data?.systems ?? [],
          permissions: optionsRes.data?.permissions ?? [],
          categories: optionsRes.data?.categories ?? [],
          titles: optionsRes.data?.titles ?? [],
          groups: optionsRes.data?.groups ?? [],
        });
      }
    } catch (err) {
      setError(formatUiError(err, "Не удалось загрузить реестр персонала."));
    }
  }

  useEffect(() => {
    if (canView) {
      loadData();
    }
  }, [canManage, canView]);

  function resetForm() {
    setEditingStaffId(null);
    setForm(emptyStaffForm);
    setAccessPreset("TEACHER");
    setHistory([]);
    setHistoryQuery("");
    setGroupQuery("");
  }

  async function loadHistory(staffId) {
    if (!canManage) return;
    setHistoryLoading(true);
    try {
      const res = await http.get(`/staff/${staffId}/audit`);
      setHistory(res.data?.history ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function startEdit(member) {
    if (!canManage) return;
    setEditingStaffId(member.id);
    setForm({
      email: member.email || "",
      password: "123456",
      fullName: member.fullName || "",
      faculty: member.faculty || "",
      role: member.role || "TEACHER",
      staffTitle: member.staffTitle || "",
      staffCategory: member.staffCategory || "TEACHER",
      accessSystems: member.accessSystems || [],
      permissions: member.permissions || [],
      managedGroupIds: member.managedGroupIds || [],
    });
    setAccessPreset(member.role === "ADMIN" ? "ADMIN" : "TEACHER");
    setHistoryQuery("");
    setGroupQuery("");
    loadHistory(member.id);
  }

  function applyPreset(presetKey) {
    const preset = ACCESS_PRESETS[presetKey];
    if (!preset) return;
    setAccessPreset(presetKey);
    setForm((prev) => ({
      ...prev,
      role: preset.role,
      staffCategory: preset.staffCategory,
      permissions: [...preset.permissions],
      accessSystems: [...preset.accessSystems],
    }));
  }

  async function saveStaff(event) {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        faculty: form.faculty,
        role: form.role,
        staffTitle: form.staffTitle,
        staffCategory: form.staffCategory,
        accessSystems: form.accessSystems,
        permissions: form.permissions,
        managedGroupIds: form.managedGroupIds,
      };

      if (editingStaffId) {
        await http.put(`/staff/${editingStaffId}`, payload);
        if (editingStaffId === user?.sub) {
          setUser({
            ...user,
            fullName: payload.fullName,
            email: payload.email,
            role: payload.role,
            permissions: payload.permissions,
            accessSystems: payload.accessSystems,
            managedGroupIds: payload.managedGroupIds,
            staffTitle: payload.staffTitle,
            staffCategory: payload.staffCategory,
          });
        }
      } else {
        await http.post("/staff", payload);
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(formatUiError(err, "Не удалось сохранить карточку сотрудника."));
    } finally {
      setSaving(false);
    }
  }

  const filteredStaff = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return staff;
    return staff.filter((member) =>
      [member.fullName, member.email, member.role, member.staffTitle, member.staffCategory, member.faculty]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [query, staff]);

  const filteredHistory = useMemo(() => {
    const term = historyQuery.trim().toLowerCase();
    if (!term) return history;
    return history.filter((entry) =>
      [entry.summary, entry.action, JSON.stringify(entry.meta || {})]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [history, historyQuery]);

  const visibleGroups = useMemo(() => {
    const term = groupQuery.trim().toLowerCase();
    if (!term) return options.groups;
    return options.groups.filter((group) =>
      [group.name, group.faculty].filter(Boolean).some((value) => String(value).toLowerCase().includes(term))
    );
  }, [groupQuery, options.groups]);

  const stats = useMemo(() => {
    const teachers = staff.filter((member) => member.role === "TEACHER").length;
    const developers = staff.filter((member) => member.staffCategory === "DEVELOPER").length;
    const admins = staff.filter((member) => member.role === "ADMIN").length;
    return { total: staff.length, teachers, developers, admins };
  }, [staff]);

  if (!canView) {
    return <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">Доступ к разделу персонала закрыт.</div>;
  }

  return (
    <div className="grid gap-6">
      <PageHero
        eyebrow="Персонал"
        title="Реестр сотрудников и доступов"
        description="Здесь собраны преподаватели, разработчики и системные роли. Преподаватели могут просматривать состав персонала, а редактирование доступно только администраторам и сотрудникам с расширенными правами."
        chips={[
          `${stats.total} сотрудников`,
          `${stats.teachers} преподавателей`,
          `${stats.developers} разработчиков`,
          `${stats.admins} администраторов`,
        ]}
      />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className={`grid gap-6 ${canManage ? "xl:grid-cols-[1.18fr_0.82fr]" : ""}`}>
        <SectionCard title="Реестр персонала" subtitle="Преподаватели, разработчики и системные роли">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold uppercase tracking-[0.12em] theme-readable-soft">Всего записей: {filteredStaff.length}</div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по ФИО, почте, должности, роли или категории"
              className="theme-surface-button theme-readable-strong w-full max-w-md rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-300">
            <div className="grid grid-cols-[1.2fr_1fr_0.8fr_1fr_auto] gap-3 bg-slate-50 px-4 py-3 text-sm font-semibold theme-readable-soft">
              <div>Сотрудник</div>
              <div>Email</div>
              <div>Роль</div>
              <div>Доступные системы</div>
              <div className="text-right">Действия</div>
            </div>

            <div className="max-h-[620px] overflow-y-auto">
              {filteredStaff.map((member) => (
                <div
                  key={member.id}
                  className={`grid grid-cols-[1.2fr_1fr_0.8fr_1fr_auto] gap-3 border-t border-slate-200 px-4 py-3 text-sm ${canManage ? "cursor-pointer transition hover:bg-slate-50/80" : ""}`}
                  onClick={() => {
                    if (canManage) startEdit(member);
                  }}
                >
                  <div>
                    <div className="font-semibold theme-readable-strong">{member.fullName || "Без имени"}</div>
                    <div className="theme-readable-soft">
                      {[member.staffTitle, CATEGORY_LABELS[member.staffCategory] || member.staffCategory, member.faculty].filter(Boolean).join(" • ") || "Карточка без уточняющих меток"}
                    </div>
                  </div>
                  <div className="break-all theme-readable-soft">{member.email}</div>
                  <div className="theme-readable-soft">{ROLE_LABELS[member.role] || member.role}</div>
                  <div className="theme-readable-soft">
                    {member.accessSystems?.length ? member.accessSystems.slice(0, 2).map((item) => SYSTEM_LABELS[item] || item).join(", ") : "—"}
                  </div>
                  <div className="text-right">
                    {canManage ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startEdit(member);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        Изменить
                      </button>
                    ) : (
                      <span className="theme-readable-soft text-xs uppercase tracking-[0.12em]">Доступ ограничен</span>
                    )}
                  </div>
                </div>
              ))}

              {filteredStaff.length === 0 ? <div className="px-4 py-8 text-center text-sm theme-readable-soft">Подходящие сотрудники не найдены.</div> : null}
            </div>
          </div>
        </SectionCard>

        {canManage ? (
          <div className="grid gap-6">
            <SectionCard title={editingStaffId ? "Редактирование сотрудника" : "Добавить сотрудника"} subtitle="Должность, системы, группы и набор прав">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold uppercase tracking-[0.12em] theme-readable-soft">
                  {editingStaffId ? "Изменяем существующую запись" : "Новая запись персонала"}
                </div>
                {editingStaffId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Отменить
                  </button>
                ) : null}
              </div>

              <form onSubmit={saveStaff} className="mt-4 grid gap-4">
                <div className="rounded-2xl border border-slate-300 p-4">
                  <div className="text-sm font-semibold uppercase tracking-[0.12em] theme-readable-soft">Шаблон доступа</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(ACCESS_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => applyPreset(key)}
                        className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                          accessPreset === key
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "theme-surface-button theme-readable-strong border-slate-300 hover:border-blue-300"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAccessPreset("CUSTOM")}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                        accessPreset === "CUSTOM"
                          ? "border-violet-500 bg-violet-500 text-white"
                          : "theme-surface-button theme-readable-strong border-slate-300 hover:border-violet-300"
                      }`}
                    >
                      Кастомно
                    </button>
                  </div>
                  <div className="mt-3 text-sm theme-readable-soft">
                    Выберите готовый набор прав или перейдите в кастомный режим и настройте доступ вручную.
                  </div>
                </div>

                <input
                  value={form.fullName}
                  onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                  placeholder="ФИО"
                  className="theme-surface-button theme-readable-strong rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
                />
                <input
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  disabled={!!editingStaffId}
                  placeholder="Email"
                  className="theme-surface-button theme-readable-strong rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-blue-400 disabled:opacity-70"
                />
                {!editingStaffId ? (
                  <input
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="Пароль"
                    className="theme-surface-button theme-readable-strong rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
                  />
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    value={form.role}
                    onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                    className="theme-surface-button theme-readable-strong rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
                  >
                    <option value="TEACHER">Преподаватель</option>
                    <option value="ADMIN">Администратор</option>
                  </select>
                  <select
                    value={form.staffCategory}
                    onChange={(event) => setForm((prev) => ({ ...prev, staffCategory: event.target.value }))}
                    className="theme-surface-button theme-readable-strong rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
                  >
                    {options.categories.map((category) => (
                      <option key={category} value={category}>
                        {CATEGORY_LABELS[category] || category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    value={form.staffTitle}
                    onChange={(event) => setForm((prev) => ({ ...prev, staffTitle: event.target.value }))}
                    list="staff-title-options"
                    placeholder="Должность"
                    className="theme-surface-button theme-readable-strong rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
                  />
                  <input
                    value={form.faculty}
                    onChange={(event) => setForm((prev) => ({ ...prev, faculty: event.target.value }))}
                    placeholder="Подразделение / кафедра"
                    className="theme-surface-button theme-readable-strong rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
                  />
                </div>

                <datalist id="staff-title-options">
                  {options.titles.map((title) => (
                    <option key={title} value={title} />
                  ))}
                </datalist>

                <div className="grid gap-4">
                  <div className="rounded-2xl border border-slate-300 p-4">
                    <div className="text-sm font-semibold uppercase tracking-[0.12em] theme-readable-soft">Доступные системы</div>
                    <div className="mt-3 grid gap-2">
                      {options.systems.map((system) => (
                        <label key={system} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 theme-surface-inset">
                          <input
                            type="checkbox"
                            checked={form.accessSystems.includes(system)}
                            onChange={() => setForm((prev) => ({ ...prev, accessSystems: toggleValue(prev.accessSystems, system) }))}
                          />
                          <span className="theme-readable-strong text-sm">{translatedSystemLabel(system)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-300 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold uppercase tracking-[0.12em] theme-readable-soft">Закреплённые группы</div>
                      <input
                        value={groupQuery}
                        onChange={(event) => setGroupQuery(event.target.value)}
                        placeholder="Поиск группы"
                        className="theme-surface-button theme-readable-strong w-full max-w-xs rounded-xl border border-slate-300 px-4 py-2 outline-none transition focus:border-blue-400"
                      />
                    </div>
                    <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                      {visibleGroups.map((group) => (
                        <label key={group.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 theme-surface-inset">
                          <input
                            type="checkbox"
                            checked={form.managedGroupIds.includes(group.id)}
                            onChange={() => setForm((prev) => ({ ...prev, managedGroupIds: toggleValue(prev.managedGroupIds, group.id) }))}
                          />
                          <span className="theme-readable-strong text-sm">
                            {group.name}
                            {group.faculty ? ` — ${group.faculty}` : ""}
                          </span>
                        </label>
                      ))}
                      {!visibleGroups.length ? <div className="text-sm theme-readable-soft">Подходящие группы не найдены.</div> : null}
                    </div>
                    <div className="mt-3 text-sm theme-readable-soft">
                      Если группы назначены, преподаватель сможет работать только с этими студентами и их оценками.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-300 p-4">
                    <div className="text-sm font-semibold uppercase tracking-[0.12em] theme-readable-soft">Права и действия</div>
                    <div className="mt-3 grid gap-2">
                      {options.permissions.map((permission) => (
                        <label key={permission} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 theme-surface-inset">
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(permission)}
                            onChange={() => setForm((prev) => ({ ...prev, permissions: toggleValue(prev.permissions, permission) }))}
                          />
                          <span className="theme-readable-strong text-sm">{translatedPermissionLabel(permission)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Сохраняем..." : editingStaffId ? "Сохранить изменения" : "Создать сотрудника"}
                </button>
              </form>
            </SectionCard>

            <SectionCard title="История действий" subtitle="Аудит по выбранному сотруднику">
              {editingStaffId == null ? (
                <div className="text-sm theme-readable-soft">Выберите сотрудника в реестре, чтобы посмотреть его действия и изменения прав.</div>
              ) : historyLoading ? (
                <div className="text-sm theme-readable-soft">Загружаем историю...</div>
              ) : (
                <div className="space-y-3">
                  <input
                    value={historyQuery}
                    onChange={(event) => setHistoryQuery(event.target.value)}
                    placeholder="Поиск по действиям и описанию аудита"
                    className="theme-surface-button theme-readable-strong w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-blue-400"
                  />
                  <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                    {filteredHistory.length ? (
                      filteredHistory.map((entry) => (
                        <div key={entry.id} className="theme-surface-inset rounded-2xl border border-slate-200 px-4 py-3">
                          <div className="font-semibold theme-readable-strong">{entry.summary || entry.action}</div>
                          <div className="mt-1 text-xs theme-readable-soft">
                            {new Date(entry.createdAt).toLocaleString()} • {entry.action}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm theme-readable-soft">Подходящие записи аудита не найдены.</div>
                    )}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        ) : null}
      </div>
    </div>
  );
}
