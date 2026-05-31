import Modal from "../components/Modal";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { http } from "../api/http";
import { getUser } from "../auth/token";
import { useTranslation } from "react-i18next";
import { formatUiError } from "../utils/uiError";
import SectionCard from "../components/ui/SectionCard";

const MotionLink = motion(Link);
const MotionDiv = motion.div;

const COURSE_TAG_FIELDS = [
  { key: "subjectName", optionKey: "subjectNames" },
  { key: "subjectCode", optionKey: "subjectCodes" },
  { key: "courseNumber", optionKey: "courseNumbers" },
  { key: "semester", optionKey: "semesters" },
  { key: "department", optionKey: "departments" },
  { key: "studyYear", optionKey: "studyYears" },
  { key: "format", optionKey: "formats" },
  { key: "campus", optionKey: "campuses" },
];

const emptyCourseDraft = {
  title: "",
  subjectName: "",
  subjectCode: "",
  courseNumber: "",
  semester: "",
  department: "",
  studyYear: "",
  format: "",
  campus: "",
};

function buildCourseTags(course, fields) {
  return fields.map((field) => {
    const value = course?.[field.key];
    if (value == null || value === "") return null;
    return `${field.label}: ${value}`;
  }).filter(Boolean);
}

function toDraft(course) {
  return {
    title: String(course?.title ?? ""),
    subjectName: String(course?.subjectName ?? ""),
    subjectCode: String(course?.subjectCode ?? ""),
    courseNumber: course?.courseNumber == null ? "" : String(course.courseNumber),
    semester: String(course?.semester ?? ""),
    department: String(course?.department ?? ""),
    studyYear: String(course?.studyYear ?? ""),
    format: String(course?.format ?? ""),
    campus: String(course?.campus ?? ""),
  };
}

export default function CoursesPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const me = getUser();
  const isTeacher = me?.role === "TEACHER" || me?.role === "ADMIN";
  const isStudent = me?.role === "STUDENT";

  const [courses, setCourses] = useState([]);
  const [tagOptions, setTagOptions] = useState({});
  const [error, setError] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCourse, setNewCourse] = useState(emptyCourseDraft);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [selectionMode, setSelectionMode] = useState(null);

  const [courseToDelete, setCourseToDelete] = useState(null);
  const [deleteStep, setDeleteStep] = useState("confirm");
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [courseToEdit, setCourseToEdit] = useState(null);
  const [editDraft, setEditDraft] = useState(emptyCourseDraft);
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [dashboard, setDashboard] = useState({ tasks: [], progress: [], schedulePreview: [] });
  const [historyCourse, setHistoryCourse] = useState(null);
  const [courseHistory, setCourseHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [duplicateBusyId, setDuplicateBusyId] = useState(null);

  const courseTagFields = useMemo(
    () => [
      { ...COURSE_TAG_FIELDS[0], label: t("layout.filterFields.subjectName", { defaultValue: "Subject" }) },
      { ...COURSE_TAG_FIELDS[1], label: t("layout.filterFields.subjectCode", { defaultValue: "Subject code" }) },
      { ...COURSE_TAG_FIELDS[2], label: t("layout.filterFields.courseNumber", { defaultValue: "Course number" }) },
      { ...COURSE_TAG_FIELDS[3], label: t("layout.filterFields.semester", { defaultValue: "Semester" }) },
      { ...COURSE_TAG_FIELDS[4], label: t("layout.filterFields.department", { defaultValue: "Department" }) },
      { ...COURSE_TAG_FIELDS[5], label: t("layout.filterFields.studyYear", { defaultValue: "Academic year" }) },
      { ...COURSE_TAG_FIELDS[6], label: t("layout.filterFields.format", { defaultValue: "Format" }) },
      { ...COURSE_TAG_FIELDS[7], label: t("layout.filterFields.campus", { defaultValue: "Campus" }) },
    ],
    [t]
  );

  async function loadCourses() {
    setError("");
    try {
      const currentUser = getUser();
      const isStudent = currentUser?.role === "STUDENT";
      const res = await http.get(isStudent ? "/my/courses" : "/courses");
      setCourses(res.data?.courses || res.data || []);
    } catch (err) {
      setError(formatUiError(err, t("common.error")));
    }
  }

  async function loadTagOptions() {
    try {
      const res = await http.get("/course-tag-options");
      setTagOptions(res.data?.options ?? {});
    } catch {
      setTagOptions({});
    }
  }

  useEffect(() => {
    loadCourses();
    loadTagOptions();
    if (isStudent) {
      loadDashboard();
    }
  }, [isStudent]);

  async function loadDashboard() {
    try {
      const res = await http.get("/dashboard/today");
      setDashboard({
        tasks: res.data?.tasks ?? [],
        progress: res.data?.progress ?? [],
        schedulePreview: res.data?.schedulePreview ?? [],
      });
    } catch {
      setDashboard({ tasks: [], progress: [], schedulePreview: [] });
    }
  }

  function getCourseProgress(courseId) {
    return dashboard.progress.find((item) => item.course?.id === courseId) || null;
  }

  const filteredCourses = useMemo(() => {
    return courses.filter((course) =>
      courseTagFields.every((field) => {
        const selected = searchParams.get(field.key);
        if (!selected) return true;
        return String(course?.[field.key] ?? "") === selected;
      })
    );
  }, [courseTagFields, courses, searchParams]);

  function updateDraft(key, value) {
    setNewCourse((prev) => ({ ...prev, [key]: value }));
  }

  function updateEditDraft(key, value) {
    setEditDraft((prev) => ({ ...prev, [key]: value }));
  }

  function resetSelectionMode() {
    setSelectionMode(null);
    closeDeleteDialog();
    closeEditDialog();
  }

  async function createCourse(e) {
    e.preventDefault();
    setCreateError("");

    if (!newCourse.title.trim()) {
      setCreateError("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043a\u0443\u0440\u0441\u0430.");
      return;
    }

    try {
      setCreating(true);
      await http.post("/courses", {
        title: newCourse.title.trim(),
        subjectName: newCourse.subjectName,
        subjectCode: newCourse.subjectCode,
        courseNumber: newCourse.courseNumber ? Number(newCourse.courseNumber) : null,
        semester: newCourse.semester,
        department: newCourse.department,
        studyYear: newCourse.studyYear,
        format: newCourse.format,
        campus: newCourse.campus,
      });
      setIsCreateOpen(false);
      setNewCourse(emptyCourseDraft);
      await loadCourses();
    } catch (err) {
      setCreateError(formatUiError(err, t("common.error")));
    } finally {
      setCreating(false);
    }
  }

  function openDeleteConfirm(course) {
    setCourseToDelete(course);
    setDeleteStep("confirm");
    setPassword("");
    setDeleteError("");
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setCourseToDelete(null);
    setDeleteStep("confirm");
    setPassword("");
    setDeleteError("");
  }

  function openEditDialog(course) {
    setCourseToEdit(course);
    setEditDraft(toDraft(course));
    setEditError("");
  }

  function closeEditDialog() {
    if (savingEdit) return;
    setCourseToEdit(null);
    setEditDraft(emptyCourseDraft);
    setEditError("");
  }

  async function finalDeleteCourse(e) {
    e.preventDefault();
    if (!courseToDelete) return;

    setDeleteError("");
    if (!password) {
      setDeleteError("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043f\u0430\u0440\u043e\u043b\u044c.");
      return;
    }

    try {
      setDeleting(true);
      await http.post("/auth/login", { email: me.email, password });
      await http.delete(`/courses/${courseToDelete.id}`);
      closeDeleteDialog();
      setSelectionMode(null);
      await loadCourses();
    } catch (err) {
      setDeleteError(formatUiError(err, t("common.error")));
    } finally {
      setDeleting(false);
    }
  }

  async function saveCourseChanges(e) {
    e.preventDefault();
    if (!courseToEdit) return;

    setEditError("");
    if (!editDraft.title.trim()) {
      setEditError("\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043a\u0443\u0440\u0441\u0430 \u043d\u0435 \u0434\u043e\u043b\u0436\u043d\u043e \u0431\u044b\u0442\u044c \u043f\u0443\u0441\u0442\u044b\u043c.");
      return;
    }

    try {
      setSavingEdit(true);
      await http.put(`/courses/${courseToEdit.id}`, {
        title: editDraft.title.trim(),
        subjectName: editDraft.subjectName,
        subjectCode: editDraft.subjectCode,
        courseNumber: editDraft.courseNumber ? Number(editDraft.courseNumber) : null,
        semester: editDraft.semester,
        department: editDraft.department,
        studyYear: editDraft.studyYear,
        format: editDraft.format,
        campus: editDraft.campus,
      });
      closeEditDialog();
      setSelectionMode(null);
      await loadCourses();
      if (isStudent) {
        await loadDashboard();
      }
    } catch (err) {
      setEditError(formatUiError(err, t("common.error")));
    } finally {
      setSavingEdit(false);
    }
  }

  function toggleMode(mode) {
    if (selectionMode === mode) {
      resetSelectionMode();
      return;
    }
    setSelectionMode(mode);
    closeDeleteDialog();
    closeEditDialog();
  }

  async function duplicateCourse(course) {
    try {
      setDuplicateBusyId(course.id);
      await http.post(`/courses/${course.id}/duplicate`, {
        title: `${course.title} - \u043d\u043e\u0432\u044b\u0439 \u0441\u0435\u043c\u0435\u0441\u0442\u0440`,
      });
      await loadCourses();
      if (isStudent) {
        await loadDashboard();
      }
    } catch (err) {
      setError(formatUiError(err, "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u0440\u043e\u0434\u0443\u0431\u043b\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043a\u0443\u0440\u0441."));
    } finally {
      setDuplicateBusyId(null);
    }
  }

  async function openHistory(course) {
    try {
      setHistoryLoading(true);
      setHistoryCourse(course);
      const res = await http.get(`/courses/${course.id}/history`);
      setCourseHistory(res.data?.history ?? []);
    } catch (err) {
      setError(formatUiError(err, "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0438\u0441\u0442\u043e\u0440\u0438\u044e \u043a\u0443\u0440\u0441\u0430."));
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="w-full">
      {error && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 p-2.5 text-red-700">{error}</div>}

      {isStudent ? (
        <div className="mb-5">
          <SectionCard title={"\u0427\u0442\u043e \u0441\u0434\u0435\u043b\u0430\u0442\u044c \u0441\u0435\u0433\u043e\u0434\u043d\u044f"} subtitle={"\u0415\u0434\u0438\u043d\u0430\u044f \u043b\u0435\u043d\u0442\u0430 \u0437\u0430\u0434\u0430\u0447 \u0438 \u0431\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0445 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439"}>
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {(dashboard.tasks || []).slice(0, 6).map((task, index) => {
                const accentPalette = [
                  { border: "rgba(59,130,246,0.58)", glow: "rgba(59,130,246,0.2)" },
                  { border: "rgba(168,85,247,0.58)", glow: "rgba(168,85,247,0.2)" },
                  { border: "rgba(245,158,11,0.58)", glow: "rgba(245,158,11,0.2)" },
                  { border: "rgba(16,185,129,0.58)", glow: "rgba(16,185,129,0.2)" },
                ];
                const accent = accentPalette[index % accentPalette.length];
                return (
                <div
                  key={task.id}
                  className="theme-surface-inset rounded-2xl border bg-slate-50/80 p-4"
                  style={{ borderColor: accent.border, boxShadow: `0 0 0 1px ${accent.border}, 0 12px 28px -22px ${accent.glow}` }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="theme-readable-strong font-bold text-slate-900">{task.title}</div>
                      <div className="theme-readable-soft mt-1 text-sm text-slate-500">{task.courseTitle || task.studentName || "\u0411\u0435\u0437 \u043a\u0443\u0440\u0441\u0430"}</div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
                        task.priority === "urgent"
                          ? "border border-red-200 bg-red-50 text-red-700"
                          : task.priority === "soon"
                            ? "border border-amber-200 bg-amber-50 text-amber-700"
                            : "theme-surface-button theme-readable-soft border border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {task.priority === "urgent" ? "\u0421\u0440\u043e\u0447\u043d\u043e" : task.priority === "soon" ? "\u0421\u043a\u043e\u0440\u043e" : "\u041c\u043e\u0436\u043d\u043e \u043f\u043e\u0437\u0436\u0435"}
                    </span>
                  </div>
                  {task.dueAt ? <div className="theme-readable-soft mt-2 text-sm text-slate-600">{"\u0421\u0440\u043e\u043a"}: {new Date(task.dueAt).toLocaleString()}</div> : null}
                </div>
              )})}
              {!dashboard.tasks?.length ? <div className="theme-readable-soft text-sm text-slate-500">{"\u041d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u043d\u0435\u0442 \u043d\u043e\u0432\u044b\u0445 \u0441\u0440\u043e\u0447\u043d\u044b\u0445 \u0437\u0430\u0434\u0430\u0447."}</div> : null}
            </div>
          </SectionCard>
        </div>
      ) : null}

      <div className="relative">
        <div className={`min-w-0 transition-[width,padding] duration-300 ${isTeacher ? "lg:pr-[17.5rem]" : ""}`}>
          <div className="grid gap-3">
            {filteredCourses.map((course) => {
              const tags = buildCourseTags(course, courseTagFields);
              const progress = getCourseProgress(course.id);
              const isDeleteMode = selectionMode === "delete";
              const isEditMode = selectionMode === "edit";
              const selectionTone = isDeleteMode
                ? "course-delete-shake border-red-200 ring-1 ring-red-100/80"
                : isEditMode
                  ? "border-emerald-200 ring-1 ring-emerald-100/80"
                  : "block hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl";
              const cardClass = [
                "lazy-render-card min-h-[104px] rounded-xl border border-gray-300 bg-white p-4 text-inherit no-underline shadow-md transition duration-200",
                selectionTone,
              ].join(" ");

              const openCoursePath = `/courses/${course.id}/assignments`;
              const previewStudentPath = `/courses/${course.id}/assignments?preview=student`;

              const content = (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-lg font-bold text-gray-950">{course.title}</div>
                    <div className="mt-1 text-sm text-gray-500">
                      {t("courses.courseId")}: {course.id}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
                          {tag}
                        </span>
                      ))}
                      {tags.length === 0 && (
                        <span className="rounded-full border border-dashed border-gray-300 bg-gray-50 px-3 py-1 text-xs text-gray-500">
                          {"\u0422\u0435\u0433\u0438 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u044b"}
                        </span>
                      )}
                    </div>

                    {isStudent && progress ? (
                      <div className="mt-4 max-w-xl">
                        <div className="theme-readable-soft mb-1 flex items-center justify-between gap-3 text-sm text-slate-600">
                          <span>{"\u041f\u0440\u043e\u0433\u0440\u0435\u0441\u0441 \u043f\u043e \u043a\u0443\u0440\u0441\u0443"}</span>
                          <span>{progress.progressPercent}%</span>
                        </div>
                        <div className="course-progress-track h-2 rounded-full bg-slate-200">
                          <div className="course-progress-fill h-2 rounded-full transition-[width] duration-300" style={{ width: `${progress.progressPercent}%` }} />
                        </div>
                      </div>
                    ) : null}

                    {isTeacher && !isDeleteMode && !isEditMode ? (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Link
                          to={openCoursePath}
                          className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-400 hover:bg-blue-100"
                        >
                          Открыть курс
                        </Link>
                        <Link
                          to={previewStudentPath}
                          className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100"
                        >
                          Смотреть как студент
                        </Link>
                      </div>
                    ) : null}

                  </div>

                  {(isDeleteMode || isEditMode) && (
                    <button
                      type="button"
                      onClick={() => (isDeleteMode ? openDeleteConfirm(course) : openEditDialog(course))}
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition ${
                        isDeleteMode
                          ? "border-red-300 bg-red-50 text-red-600 hover:border-red-500 hover:bg-red-100"
                          : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-100"
                      }`}
                      aria-label={`${isDeleteMode ? "Delete" : "Edit"} course ${course.title}`}
                    >
                      <span className="h-4 w-4 rounded-sm border-2 border-current bg-white" />
                    </button>
                  )}
                </>
              );

              if (isDeleteMode || isEditMode) {
                return (
                  <MotionDiv
                    key={course.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className={`${cardClass} flex items-center justify-between gap-4`}
                  >
                    {content}
                  </MotionDiv>
                );
              }

              if (isTeacher) {
                return (
                  <MotionDiv
                    key={course.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className={`${cardClass} flex items-center justify-between gap-4`}
                  >
                    {content}
                  </MotionDiv>
                );
              }

              return (
                <MotionLink
                  key={course.id}
                  to={openCoursePath}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className={`${cardClass} flex items-center justify-between gap-4`}
                >
                  {content}
                </MotionLink>
              );
            })}

            {filteredCourses.length === 0 && !error && (
              <div className="rounded-xl border border-gray-300 bg-white px-4 py-5 text-gray-600">
                {courses.length === 0 && me?.role === "ADMIN"
                  ? "Курсы не найдены. Если вы вошли как администратор, перезапустите backend, чтобы он подхватил режим просмотра всех курсов."
                  : t("courses.noResults", { defaultValue: "По текущим фильтрам курсы не найдены." })}
              </div>
            )}
          </div>
        </div>

        {isTeacher && (
          <div
            className="mt-8 flex flex-col gap-3 lg:fixed lg:top-5 lg:z-[5] lg:mt-0"
            style={{ right: "344px" }}
          >
            <motion.button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              whileTap={{ scale: 0.98 }}
              className="flex h-[80px] w-64 items-center justify-center rounded-xl border border-blue-400 bg-blue-500 text-lg font-semibold text-white shadow-md transition hover:scale-[1.02] hover:bg-blue-600"
            >
              {t("courses.createAction", { defaultValue: "+ Создать курс" })}
            </motion.button>

            <motion.button
              type="button"
              onClick={() => toggleMode("delete")}
              disabled={courses.length === 0}
              whileTap={{ scale: 0.98 }}
              className={`flex h-[80px] w-64 items-center justify-center rounded-xl border text-lg font-semibold text-white shadow-md transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${
                selectionMode === "delete"
                  ? "border-gray-700 bg-gray-700 hover:bg-gray-800"
                  : "border-red-400 bg-red-500 hover:bg-red-600"
              }`}
            >
              {selectionMode === "delete" ? t("courses.cancelDelete", { defaultValue: "Отменить удаление" }) : t("courses.deleteAction", { defaultValue: "Удалить курс" })}
            </motion.button>

            <motion.button
              type="button"
              onClick={() => toggleMode("edit")}
              disabled={courses.length === 0}
              whileTap={{ scale: 0.98 }}
              className={`flex h-[80px] w-64 items-center justify-center rounded-xl border text-lg font-semibold text-white shadow-md transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${
                selectionMode === "edit"
                  ? "border-gray-700 bg-gray-700 hover:bg-gray-800"
                  : "border-emerald-400 bg-emerald-500 hover:bg-emerald-600"
              }`}
            >
              {selectionMode === "edit" ? t("courses.cancelEdit", { defaultValue: "Отменить редактирование" }) : t("courses.editAction", { defaultValue: "Изменить курс" })}
            </motion.button>
          </div>
        )}
      </div>

      {isTeacher && (
        <Modal open={isCreateOpen} title={t("courses.create")} onClose={() => setIsCreateOpen(false)}>
          <form onSubmit={createCourse} className="grid gap-3">
            <label className="grid gap-1.5">
              <span>{t("courses.title")}</span>
              <input
                className="w-full rounded-xl border border-gray-300 p-2.5"
                value={newCourse.title}
                onChange={(e) => updateDraft("title", e.target.value)}
                placeholder={t("courses.titlePlaceholder")}
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              {courseTagFields.map((field) => {
                const options = tagOptions?.[field.optionKey] ?? [];
                return (
                  <label key={field.key} className="grid gap-1.5">
                    <span>{field.label}</span>
                    <select
                      value={newCourse[field.key]}
                      onChange={(e) => updateDraft(field.key, e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white p-2.5"
                    >
                      <option value="">{t("layout.anyValue", { defaultValue: "Any value" })}</option>
                      {options.map((value) => (
                        <option key={String(value)} value={String(value)}>
                          {String(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>

            {createError && <div className="rounded-xl border border-red-100 bg-red-50 p-2.5 text-red-700">{createError}</div>}

            <button
              type="submit"
              disabled={creating}
              className="cursor-pointer rounded-xl border border-blue-400 bg-blue-500 px-4 py-2.5 text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {creating ? t("common.loading") : t("common.save")}
            </button>
          </form>
        </Modal>
      )}

      {isTeacher && (
        <Modal open={!!courseToDelete} title={deleteStep === "confirm" ? "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f" : "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043f\u0430\u0440\u043e\u043b\u044c"} onClose={closeDeleteDialog}>
          {deleteStep === "confirm" ? (
            <div className="grid gap-4">
              <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-800">
                <div className="text-lg font-semibold">{"\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u0443\u0440\u0441?"}</div>
                <div className="mt-1">
                  {courseToDelete?.title} (ID: {courseToDelete?.id})
                </div>
                <div className="mt-3 text-sm">
                  {"\u0412\u043c\u0435\u0441\u0442\u0435 \u0441 \u043a\u0443\u0440\u0441\u043e\u043c \u0443\u0434\u0430\u043b\u044f\u0442\u0441\u044f \u0437\u0430\u0434\u0430\u043d\u0438\u044f, \u0442\u0435\u0441\u0442\u044b, \u043f\u043e\u043f\u044b\u0442\u043a\u0438, \u043e\u0446\u0435\u043d\u043a\u0438 \u0438 \u0437\u0430\u043f\u0438\u0441\u0438 \u0441\u0442\u0443\u0434\u0435\u043d\u0442\u043e\u0432."}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeleteDialog}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 transition hover:bg-gray-100"
                >
                  {"\u041d\u0435\u0442"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteStep("password");
                    setDeleteError("");
                  }}
                  className="rounded-lg border border-red-400 bg-red-500 px-4 py-2 text-white transition hover:bg-red-600"
                >
                  {"\u0414\u0430"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={finalDeleteCourse} className="grid gap-3">
              <div className="text-sm text-gray-600">{"\u0414\u043b\u044f \u043e\u043a\u043e\u043d\u0447\u0430\u0442\u0435\u043b\u044c\u043d\u043e\u0433\u043e \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043f\u0430\u0440\u043e\u043b\u044c \u043f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044f."}</div>

              <label className="grid gap-1.5">
                <span>{"\u041f\u0430\u0440\u043e\u043b\u044c"}</span>
                <input
                  type="password"
                  className="w-full rounded-xl border border-gray-300 p-2.5"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={deleting}
                  autoFocus
                />
              </label>

              {deleteError && <div className="rounded-xl border border-red-100 bg-red-50 p-2.5 text-red-700">{deleteError}</div>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteStep("confirm");
                    setDeleteError("");
                  }}
                  disabled={deleting}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 transition hover:bg-gray-100 disabled:opacity-50"
                >
                  {"\u041d\u0430\u0437\u0430\u0434"}
                </button>
                <button
                  type="submit"
                  disabled={deleting}
                  className="rounded-lg border border-red-400 bg-red-500 px-4 py-2 text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  {deleting ? t("common.loading") : "\u041e\u043a\u043e\u043d\u0447\u0430\u0442\u0435\u043b\u044c\u043d\u043e \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u0443\u0440\u0441"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {isTeacher && (
        <Modal open={!!courseToEdit} title={"\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u043e\u0432 \u043a\u0443\u0440\u0441\u0430"} onClose={closeEditDialog}>
          <form onSubmit={saveCourseChanges} className="grid gap-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
              <div className="text-lg font-semibold">{"\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u043a\u0443\u0440\u0441\u0430"}</div>
              <div className="mt-1">
                {courseToEdit?.title} (ID: {courseToEdit?.id})
              </div>
            </div>

            <label className="grid gap-1.5">
              <span>{"\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043a\u0443\u0440\u0441\u0430"}</span>
              <input
                className="w-full rounded-xl border border-gray-300 p-2.5"
                value={editDraft.title}
                onChange={(e) => updateEditDraft("title", e.target.value)}
                placeholder={"\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043a\u0443\u0440\u0441\u0430"}
                autoFocus
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              {courseTagFields.map((field) => {
                const options = tagOptions?.[field.optionKey] ?? [];
                return (
                  <label key={field.key} className="grid gap-1.5">
                    <span>{field.label}</span>
                    <select
                      value={editDraft[field.key]}
                      onChange={(e) => updateEditDraft(field.key, e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white p-2.5"
                    >
                      <option value="">{t("layout.anyValue", { defaultValue: "Any value" })}</option>
                      {options.map((value) => (
                        <option key={String(value)} value={String(value)}>
                          {String(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>

            {editError && <div className="rounded-xl border border-red-100 bg-red-50 p-2.5 text-red-700">{editError}</div>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditDialog}
                disabled={savingEdit}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 transition hover:bg-gray-100 disabled:opacity-50"
              >
                {"\u041e\u0442\u043c\u0435\u043d\u0430"}
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-lg border border-emerald-400 bg-emerald-500 px-4 py-2 text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                {savingEdit ? "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c..." : "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <Modal open={!!historyCourse} title={historyCourse ? `\u0418\u0441\u0442\u043e\u0440\u0438\u044f: ${historyCourse.title}` : "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439"} onClose={() => setHistoryCourse(null)}>
        <div className="grid gap-3">
          {historyLoading ? <div className="text-sm text-slate-500">{"\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e \u0438\u0441\u0442\u043e\u0440\u0438\u044e..."}</div> : null}
          {!historyLoading && courseHistory.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="font-semibold text-slate-900">{entry.summary}</div>
              <div className="mt-1 text-sm text-slate-500">
                {new Date(entry.createdAt).toLocaleString()} • {entry.action}
              </div>
            </div>
          ))}
          {!historyLoading && !courseHistory.length ? <div className="text-sm text-slate-500">{"\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442."}</div> : null}
        </div>
      </Modal>
    </div>
  );
}
