import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { http } from "../api/http";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { getUser } from "../auth/token";
import CourseGradebook from "./CourseGradebook";
import CourseWorkspaceHeader from "../components/course/CourseWorkspaceHeader";
import CourseOverviewGrid from "../components/course/CourseOverviewGrid";
import CourseTabNav from "../components/course/CourseTabNav";
import AssignmentsTabPanel from "../components/course/AssignmentsTabPanel";
import TestsTabPanel from "../components/course/TestsTabPanel";
import SubmissionsTabPanel from "../components/course/SubmissionsTabPanel";
import AttemptReviewModal from "../components/AttemptReviewModal";
import ActionButton from "../components/ui/ActionButton";

const MotionDiv = motion.div;
const COURSE_TAG_FIELDS = [
  { key: "subjectName", label: "Предмет", optionKey: "subjectNames" },
  { key: "subjectCode", label: "Код предмета", optionKey: "subjectCodes" },
  { key: "courseNumber", label: "Номер курса", optionKey: "courseNumbers" },
  { key: "semester", label: "Семестр", optionKey: "semesters" },
  { key: "department", label: "Кафедра", optionKey: "departments" },
  { key: "studyYear", label: "Учебный год", optionKey: "studyYears" },
  { key: "format", label: "Формат", optionKey: "formats" },
  { key: "campus", label: "Кампус", optionKey: "campuses" },
];

function buildCourseMetaChips(course) {
  return COURSE_TAG_FIELDS.map((field) => {
    const value = course?.[field.key];
    if (value == null || value === "") return null;
    return `${field.label}: ${value}`;
  }).filter(Boolean);
}

function emptyQuestionOption() {
  return { text: "", isCorrect: false };
}

function parseReviewNotification(notification) {
  const payloadLine = String(notification?.body || "")
    .split("\n")
    .find((line) => line.includes('"kind":"TEST_REVIEW_REQUIRED"'));
  if (!payloadLine) return null;
  try {
    const jsonStart = payloadLine.indexOf("{");
    const jsonEnd = payloadLine.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < jsonStart) return null;
    return JSON.parse(payloadLine.slice(jsonStart, jsonEnd + 1));
  } catch {
    return null;
  }
}

function validateQuestionPayload(type, text, points, order, options) {
  const qText = String(text ?? "").trim();
  if (qText.length < 3) return "Текст вопроса: минимум 3 символа";
  const p = Number(points);
  if (!Number.isFinite(p) || p <= 0) return "Баллы должны быть положительным числом";
  const o = Number(order);
  if (!Number.isFinite(o) || o < 0) return "Порядок должен быть числом >= 0";

  const isChoice = type === "SINGLE" || type === "MULTI";
  if (isChoice) {
    const cleaned = (options || [])
      .map((x) => ({ text: String(x.text ?? "").trim(), isCorrect: !!x.isCorrect }))
      .filter((x) => x.text.length > 0);
    if (cleaned.length < 2) return "Для SINGLE/MULTI нужно минимум 2 варианта";
    const correctCount = cleaned.filter((x) => x.isCorrect).length;
    if (correctCount === 0) return "Отметьте хотя бы один правильный вариант";
    if (type === "SINGLE" && correctCount !== 1) return "Для SINGLE должен быть ровно один правильный вариант";
  }
  return null;
}

export default function CourseAssignments() {
  const { t } = useTranslation();
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const role = useMemo(() => getUser()?.role ?? null, []);
  const isTeacher = role === "TEACHER" || role === "ADMIN";
  const isStudent = role === "STUDENT";
  const isStudentPreview = isTeacher && searchParams.get("preview") === "student";
  const canTeacherManage = isTeacher && !isStudentPreview;
  const isStudentSurface = isStudent || isStudentPreview;

  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [course, setCourse] = useState(null);
  const [backHoverColor, setBackHoverColor] = useState("#3b82f6");
  const [courseTagOptions, setCourseTagOptions] = useState({});
  const [isCourseSettingsOpen, setIsCourseSettingsOpen] = useState(false);
  const [courseSettingsDraft, setCourseSettingsDraft] = useState({
    title: "",
    subjectName: "",
    subjectCode: "",
    courseNumber: "",
    semester: "",
    department: "",
    studyYear: "",
    format: "",
    campus: "",
  });
  const [courseSettingsError, setCourseSettingsError] = useState("");
  const [savingCourseSettings, setSavingCourseSettings] = useState(false);

  const [localSubmissions, setLocalSubmissions] = useState({});
  const [inlineDrafts, setInlineDrafts] = useState({});
  const [inlineFilesById, setInlineFilesById] = useState({});
  const [inlineSubmittingId, setInlineSubmittingId] = useState(null);
  const [inlineErrorById, setInlineErrorById] = useState({});
  const [successFlashId, setSuccessFlashId] = useState(null);

  const [isSubmissionsOpen, setIsSubmissionsOpen] = useState(false);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsError, setSubsError] = useState("");
  const [submissions, setSubmissions] = useState([]);

  const [isGradeOpen, setIsGradeOpen] = useState(false);
  const [gradeError, setGradeError] = useState("");
  const [grading, setGrading] = useState(false);
  const [currentSubmission, setCurrentSubmission] = useState(null);
  const [gradeValue, setGradeValue] = useState("");
  const [feedbackValue, setFeedbackValue] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [notificationsError, setNotificationsError] = useState("");
  const [reviewAttemptId, setReviewAttemptId] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [gradebookRefreshKey, setGradebookRefreshKey] = useState(0);
  const [courseStudents, setCourseStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    body: "",
    audience: "ALL",
    groupId: "",
    studentId: "",
  });
  const [sendingNotification, setSendingNotification] = useState(false);

  const [activeTab, setActiveTab] = useState("assignments"); // UI only

  const [tests, setTests] = useState([]);
  const [testsError, setTestsError] = useState("");
  const [testsSuccess, setTestsSuccess] = useState("");
  const [testsLoaded, setTestsLoaded] = useState(false);
  const [isCreateTestOpen, setIsCreateTestOpen] = useState(false);
  const [newTestTitle, setNewTestTitle] = useState("");
  const [newTestDescription, setNewTestDescription] = useState("");
  const [newTestAvailableFrom, setNewTestAvailableFrom] = useState("");
  const [creatingTest, setCreatingTest] = useState(false);
  const [createTestError, setCreateTestError] = useState("");
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [testToDelete, setTestToDelete] = useState(null);
  const [pendingStartTestId, setPendingStartTestId] = useState(null);
  const [publishTargetTestId, setPublishTargetTestId] = useState(null);
  const [publishDateMode, setPublishDateMode] = useState("now");
  const [publishAvailableFrom, setPublishAvailableFrom] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishingTest, setPublishingTest] = useState(false);
  const [deletingEntity, setDeletingEntity] = useState("");

  const [editingTestId, setEditingTestId] = useState(null);
  const [editTestDetail, setEditTestDetail] = useState(null);
  const [editTestDetailLoading, setEditTestDetailLoading] = useState(false);
  const [editTestDetailError, setEditTestDetailError] = useState("");
  const [editTestTitleDraft, setEditTestTitleDraft] = useState("");
  const [editTestDescriptionDraft, setEditTestDescriptionDraft] = useState("");
  const [savingTestMeta, setSavingTestMeta] = useState(false);
  const [editQuestionForms, setEditQuestionForms] = useState([]);
  const [newQuestionType, setNewQuestionType] = useState("SINGLE");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionPoints, setNewQuestionPoints] = useState(1);
  const [newQuestionOrder, setNewQuestionOrder] = useState(0);
  const [newQuestionOptions, setNewQuestionOptions] = useState([emptyQuestionOption(), emptyQuestionOption()]);
  const [newQuestionSaving, setNewQuestionSaving] = useState(false);
  const [newQuestionError, setNewQuestionError] = useState("");
  const [editModalBusy, setEditModalBusy] = useState("");

  const getAssignmentId = (a) => a?.id ?? a?._id;
  const getTestId = (test) => test?.id ?? test?._id;

  async function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`Не удалось прочитать файл ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  async function buildAssignmentAttachmentsPayload(files) {
    const selectedFiles = Array.isArray(files) ? files.slice(0, 8) : [];
    return Promise.all(
      selectedFiles.map(async (file) => ({
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
      }))
    );
  }

  function handleSelectAssignmentFiles(assignmentId, files) {
    if (!assignmentId) return;
    setInlineFilesById((prev) => ({ ...prev, [assignmentId]: Array.isArray(files) ? files.slice(0, 8) : [] }));
  }

  function clearSelectedAssignmentFiles(assignmentId) {
    if (!assignmentId) return;
    setInlineFilesById((prev) => ({ ...prev, [assignmentId]: [] }));
  }

async function startTest(testOrId) {
  const id = typeof testOrId === "object" ? getTestId(testOrId) : testOrId;
  const activeAttemptId = typeof testOrId === "object" ? testOrId?.activeAttemptId : null;
  if (activeAttemptId) {
    navigate(`/tests/${id}/attempts/${activeAttemptId}`);
    return;
  }
  if (isStudentSurface && !isStudentPreview) {
    setPendingStartTestId(id);
    return;
  }
  return beginTestAttempt(id);
}

async function beginTestAttempt(id) {
  try {
    const res = await http.post(`/tests/${id}/start`);
    console.log(res.data);

    const attemptId =
      res.data?.attempt?.id ||
      res.data?.id ||
      res.data?.attemptId;

    if (!attemptId) {
      setTestsError("Не удалось открыть тест: сервер не вернул идентификатор попытки.");
      return;
    }

    navigate(`/tests/${id}/attempts/${attemptId}`);
  } catch (err) {
    setTestsError(err?.response?.data?.error || err.message || "Не удалось начать тест.");
  }
}

async function requestExtraAttempt(test) {
  const id = getTestId(test);
  if (!id) return;
  try {
    await http.post(`/tests/${id}/request-attempt`);
    setTestsError("");
    setTestsSuccess("Запрос на дополнительную попытку отправлен преподавателю.");
    await loadAcademicData();
  } catch (err) {
    setTestsSuccess("");
    setTestsError(err?.response?.data?.error || err.message || "Не удалось отправить запрос на дополнительную попытку.");
  }
}

async function resolveAttemptRequest(notificationId, action) {
  try {
    await http.post(`/notifications/${notificationId}/attempt-request`, { action });
    await Promise.all([loadAcademicData(), loadTests()]);
  } catch (err) {
    setNotificationsError(err?.response?.data?.error || err.message || t("common.error"));
  }
}

function openTestReview(attemptId) {
  if (!attemptId) return;
  setReviewAttemptId(attemptId);
  setReviewOpen(true);
}

async function publishTest(id) {
  setPublishTargetTestId(id);
  setPublishDateMode("now");
  setPublishAvailableFrom("");
  setPublishError("");
}

async function unpublishTest(id) {
  try {
    await http.post(`/tests/${id}/unpublish`);
    await loadTests();
  } catch (err) {
    setTestsError(err?.response?.data?.error || err.message || "Не удалось снять тест с публикации.");
  }
}

async function confirmPublishTest() {
  if (!publishTargetTestId) return;
  if (publishDateMode === "scheduled" && !publishAvailableFrom) {
    setPublishError("Укажите дату и время открытия теста.");
    return;
  }

  try {
    setPublishingTest(true);
    setPublishError("");
    await http.post(`/tests/${publishTargetTestId}/publish`, {
      availableFrom: publishDateMode === "scheduled" ? new Date(publishAvailableFrom).toISOString() : null,
    });
    setPublishTargetTestId(null);
    setPublishDateMode("now");
    setPublishAvailableFrom("");
    await loadTests();
  } catch (err) {
    setPublishError(err?.response?.data?.error || err.message || "Не удалось опубликовать тест.");
  } finally {
    setPublishingTest(false);
  }
}

  async function loadAssignments() {
    setError("");
    try {
      const res = await http.get(`/courses/${courseId}/assignments`);
      const data = res?.data?.assignments ?? res?.data ?? [];
      const normalized = Array.isArray(data) ? data : [];
      setItems(normalized);
      if (isStudentSurface) {
        const nextSubmissions = {};
        const nextDrafts = {};
        normalized.forEach((assignment) => {
          const assignmentId = getAssignmentId(assignment);
          if (!assignmentId || !assignment?.mySubmission) return;
          nextSubmissions[assignmentId] = {
            submittedAt: assignment.mySubmission.submittedAt || assignment.mySubmission.createdAt || null,
            contentText: assignment.mySubmission.contentText || "",
            attachments: assignment.mySubmission.attachments || [],
            grade: assignment.mySubmission.grade ?? null,
            feedback: assignment.mySubmission.feedback || "",
          };
          nextDrafts[assignmentId] = assignment.mySubmission.contentText || "";
        });
        setLocalSubmissions(nextSubmissions);
        setInlineDrafts((prev) => ({ ...nextDrafts, ...prev }));
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || t("common.error"));
    }
  }

  async function loadTests() {
    setTestsError("");
    try {
      const res = await http.get(`/courses/${courseId}/tests`);
      const data = res?.data?.tests ?? res?.data ?? [];
      setTests(Array.isArray(data) ? data : []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        setTests([]);
      } else {
        setTestsError(err?.response?.data?.error || err.message || t("common.error"));
        setTests([]);
      }
    } finally {
      setTestsLoaded(true);
    }
  }

  async function loadCourse() {
    try {
      const res = await http.get(`/courses/${courseId}`);
      const nextCourse = res.data?.course ?? null;
      setCourse(nextCourse);
      setCourseSettingsDraft({
        title: String(nextCourse?.title ?? ""),
        subjectName: String(nextCourse?.subjectName ?? ""),
        subjectCode: String(nextCourse?.subjectCode ?? ""),
        courseNumber: nextCourse?.courseNumber == null ? "" : String(nextCourse.courseNumber),
        semester: String(nextCourse?.semester ?? ""),
        department: String(nextCourse?.department ?? ""),
        studyYear: String(nextCourse?.studyYear ?? ""),
        format: String(nextCourse?.format ?? ""),
        campus: String(nextCourse?.campus ?? ""),
      });
    } catch {
      setCourse(null);
    }
  }

  async function loadCourseTagOptions() {
    try {
      const res = await http.get("/course-tag-options");
      setCourseTagOptions(res.data?.options ?? {});
    } catch {
      setCourseTagOptions({});
    }
  }

  async function loadAcademicData() {
    try {
      const [studentsRes, groupsRes, notificationsRes] = await Promise.all([
        http.get(`/courses/${courseId}/students`),
        canTeacherManage ? http.get("/groups") : Promise.resolve({ data: { groups: [] } }),
        http.get(`/courses/${courseId}/notifications`),
      ]);
      setCourseStudents(studentsRes.data?.students ?? []);
      setGroups(groupsRes.data?.groups ?? []);
      setNotifications(notificationsRes.data?.notifications ?? []);
    } catch (err) {
      setNotificationsError(err?.response?.data?.error || err.message || t("common.error"));
    }
  }

  async function createTest(e) {
    e.preventDefault();
    setCreateTestError("");

    const title = newTestTitle.trim();
    if (title.length < 3) {
      setCreateTestError(t("tests.enterTitle", { defaultValue: "Введите название теста (минимум 3 символа)" }));
      return;
    }

    try {
      setCreatingTest(true);
      await http.post(`/courses/${courseId}/tests`, {
        title,
        description: newTestDescription.trim(),
        availableFrom: newTestAvailableFrom ? new Date(newTestAvailableFrom).toISOString() : null,
      });
      setIsCreateTestOpen(false);
      setNewTestTitle("");
      setNewTestDescription("");
      setNewTestAvailableFrom("");
      await loadTests();
    } catch (err) {
      setCreateTestError(err?.response?.data?.error || err.message || t("common.error"));
    } finally {
      setCreatingTest(false);
    }
  }

  async function confirmDeleteTest() {
    const id = getTestId(testToDelete);
    if (!id) return;

    try {
      setDeletingEntity("test");
      await http.delete(`/tests/${id}`);
      setTestToDelete(null);
      await loadTests();
    } catch (err) {
      setTestsError(err?.response?.data?.error || err.message || t("common.error"));
    } finally {
      setDeletingEntity("");
    }
  }

  async function deleteAssignment(assignment) {
    const id = getAssignmentId(assignment);
    if (!id) return;

    try {
      setDeletingEntity("assignment");
      await http.delete(`/assignments/${id}`);
      setAssignmentToDelete(null);
      await loadAssignments();
      await loadSubmissions();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || t("common.error"));
    } finally {
      setDeletingEntity("");
    }
  }

  function openTestEditor(test) {
    const id = getTestId(test);
    if (!id) return;
    navigate(`/courses/${courseId}/tests/${id}/edit`);
  }

  function closeTestEditor() {
    setEditingTestId(null);
    setEditTestDetail(null);
    setEditTestDetailError("");
    setEditTestTitleDraft("");
    setEditQuestionForms([]);
    setNewQuestionError("");
    setEditModalBusy("");
    setNewQuestionType("SINGLE");
    setNewQuestionText("");
    setNewQuestionPoints(1);
    setNewQuestionOrder(0);
    setNewQuestionOptions([emptyQuestionOption(), emptyQuestionOption()]);
  }

  async function refreshEditTestDetail(testId) {
    const res = await http.get(`/tests/${testId}`);
    const data = res?.data?.test ?? res?.data;
    setEditTestDetail(data);
    setEditTestTitleDraft(String(data?.title ?? ""));
    setEditTestDescriptionDraft(String(data?.description ?? ""));
  }

  async function saveTestTitleFromEditor(e) {
    e?.preventDefault?.();
    if (!editingTestId) return;
    const title = editTestTitleDraft.trim();
    if (title.length < 3) {
      setEditTestDetailError(t("tests.enterTitle", { defaultValue: "Введите название теста" }));
      return;
    }
    setEditTestDetailError("");
    try {
      setSavingTestMeta(true);
      await http.put(`/tests/${editingTestId}`, {
        title,
        description: editTestDescriptionDraft.trim(),
      });
      await refreshEditTestDetail(editingTestId);
      await loadTests();
    } catch (err) {
      setEditTestDetailError(err?.response?.data?.error || err.message || t("common.error"));
    } finally {
      setSavingTestMeta(false);
    }
  }

  function setNewQOptionText(idx, value) {
    setNewQuestionOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text: value } : o)));
  }

  function toggleNewQOptionCorrect(idx, type) {
    setNewQuestionOptions((prev) => {
      if (type === "SINGLE") {
        return prev.map((o, i) => ({ ...o, isCorrect: i === idx ? !o.isCorrect : false }));
      }
      return prev.map((o, i) => (i === idx ? { ...o, isCorrect: !o.isCorrect } : o));
    });
  }

  function addNewQOption() {
    setNewQuestionOptions((prev) => [...prev, emptyQuestionOption()]);
  }

  function removeNewQOption(idx) {
    setNewQuestionOptions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length < 2) return [emptyQuestionOption(), emptyQuestionOption()];
      return next;
    });
  }

  function patchQuestionForm(index, patch) {
    setEditQuestionForms((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function setQuestionFormOptionText(qIndex, optIndex, value) {
    setEditQuestionForms((prev) =>
      prev.map((row, i) => {
        if (i !== qIndex) return row;
        const opts = (row.options || []).map((o, j) => (j === optIndex ? { ...o, text: value } : o));
        return { ...row, options: opts };
      })
    );
  }

  function toggleQuestionFormOptionCorrect(qIndex, optIndex) {
    setEditQuestionForms((prev) =>
      prev.map((row, i) => {
        if (i !== qIndex) return row;
        const type = row.type;
        const opts = row.options || [];
        if (type === "SINGLE") {
          return {
            ...row,
            options: opts.map((o, j) => ({ ...o, isCorrect: j === optIndex ? !o.isCorrect : false })),
          };
        }
        return {
          ...row,
          options: opts.map((o, j) => (j === optIndex ? { ...o, isCorrect: !o.isCorrect } : o)),
        };
      })
    );
  }

  function addQuestionFormOption(qIndex) {
    setEditQuestionForms((prev) =>
      prev.map((row, i) =>
        i === qIndex ? { ...row, options: [...(row.options || []), emptyQuestionOption()] } : row
      )
    );
  }

  function removeQuestionFormOption(qIndex, optIndex) {
    setEditQuestionForms((prev) =>
      prev.map((row, i) => {
        if (i !== qIndex) return row;
        let opts = (row.options || []).filter((_, j) => j !== optIndex);
        if (opts.length < 2) opts = [emptyQuestionOption(), emptyQuestionOption()];
        return { ...row, options: opts };
      })
    );
  }

  async function saveQuestionFormRow(index) {
    const row = editQuestionForms[index];
    if (!row?.id || !editingTestId) return;
    setNewQuestionError("");
    setEditTestDetailError("");

    const validation = validateQuestionPayload(row.type, row.text, row.points, row.order, row.options);
    if (validation) {
      setEditTestDetailError(validation);
      return;
    }

    const payload = {
      type: row.type,
      text: String(row.text).trim(),
      points: Number(row.points),
      order: Number(row.order),
    };
    const isChoice = row.type === "SINGLE" || row.type === "MULTI";
    if (isChoice) {
      payload.options = (row.options || [])
        .map((o) => ({ text: String(o.text ?? "").trim(), isCorrect: !!o.isCorrect }))
        .filter((o) => o.text.length > 0);
    }

    try {
      setEditModalBusy(`save-q-${row.id}`);
      const res = await http.put(`/questions/${row.id}`, payload);
      const updated = res?.data?.question ?? res?.data;
      if (updated?.id) {
        setEditQuestionForms((prev) =>
          prev.map((p, i) =>
            i === index
              ? {
                  id: updated.id,
                  type: updated.type,
                  text: updated.text,
                  points: updated.points,
                  order: updated.order,
                  options: (updated.options || []).map((o) => ({
                    id: o.id,
                    text: o.text,
                    isCorrect: !!o.isCorrect,
                  })),
                }
              : p
          )
        );
      }
      await loadTests();
    } catch (err) {
      setEditTestDetailError(err?.response?.data?.error || err.message || t("common.error"));
    } finally {
      setEditModalBusy("");
    }
  }

  async function deleteQuestionFormRow(questionId) {
    if (!questionId) return;
    setEditTestDetailError("");
    try {
      setEditModalBusy(`del-q-${questionId}`);
      await http.delete(`/questions/${questionId}`);
      setEditQuestionForms((prev) => prev.filter((q) => q.id !== questionId));
      await refreshEditTestDetail(editingTestId);
      await loadTests();
    } catch (err) {
      setEditTestDetailError(err?.response?.data?.error || err.message || t("common.error"));
    } finally {
      setEditModalBusy("");
    }
  }

  async function submitNewQuestion(e) {
    e.preventDefault();
    setNewQuestionError("");
    setEditTestDetailError("");

    const validation = validateQuestionPayload(
      newQuestionType,
      newQuestionText,
      newQuestionPoints,
      newQuestionOrder,
      newQuestionOptions
    );
    if (validation) {
      setNewQuestionError(validation);
      return;
    }

    const payload = {
      type: newQuestionType,
      text: newQuestionText.trim(),
      points: Number(newQuestionPoints),
      order: Number(newQuestionOrder),
    };
    const isChoice = newQuestionType === "SINGLE" || newQuestionType === "MULTI";
    if (isChoice) {
      payload.options = newQuestionOptions
        .map((o) => ({ text: String(o.text ?? "").trim(), isCorrect: !!o.isCorrect }))
        .filter((o) => o.text.length > 0);
    }

    try {
      setNewQuestionSaving(true);
      await http.post(`/tests/${editingTestId}/questions`, payload);
      await refreshEditTestDetail(editingTestId);
      setNewQuestionText("");
      setNewQuestionPoints(1);
      setNewQuestionOptions([emptyQuestionOption(), emptyQuestionOption()]);
      await loadTests();
    } catch (err) {
      setNewQuestionError(err?.response?.data?.error || err.message || t("common.error"));
    } finally {
      setNewQuestionSaving(false);
    }
  }

  useEffect(() => {
    loadCourse();
    loadAssignments();
    loadAcademicData();
    if (canTeacherManage) {
      loadCourseTagOptions();
    }
  }, [canTeacherManage, courseId]);

  useEffect(() => {
    if (!courseId) return;
    loadTests();
  }, [courseId]);

  useEffect(() => {
    if (!editingTestId) return;
    let cancelled = false;
    (async () => {
      setEditTestDetailLoading(true);
      setEditTestDetailError("");
      try {
        const res = await http.get(`/tests/${editingTestId}`);
        const data = res?.data?.test ?? res?.data;
        if (!cancelled) {
          setEditTestDetail(data);
          setEditTestTitleDraft(String(data?.title ?? ""));
        }
      } catch (err) {
        if (!cancelled) {
          setEditTestDetailError(err?.response?.data?.error || err.message || t("common.error"));
          setEditTestDetail(null);
        }
      } finally {
        if (!cancelled) setEditTestDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingTestId, t]);

  useEffect(() => {
    const list = editTestDetail?.questions;
    if (!Array.isArray(list)) {
      setEditQuestionForms([]);
      return;
    }
    const sorted = list.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setEditQuestionForms(
      sorted.map((q) => ({
        id: q.id,
        type: q.type,
        text: q.text,
        points: q.points,
        order: q.order,
        options: (q.options || []).map((o) => ({
          id: o.id,
          text: o.text,
          isCorrect: !!o.isCorrect,
        })),
      }))
    );
    const nextOrder = sorted.length + 1;
    setNewQuestionOrder(nextOrder);
  }, [editTestDetail]);

  useEffect(() => {
    if (!courseId || !canTeacherManage) return;
    loadSubmissions();
  }, [canTeacherManage, courseId]);

  useEffect(() => {
    if (!courseId) return;
    if (activeTab !== "gradebook") return;
    if (!canTeacherManage) return;
    loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, activeTab, canTeacherManage]);

  useEffect(() => {
    if (successFlashId == null) return;
    const timer = setTimeout(() => setSuccessFlashId(null), 3000);
    return () => clearTimeout(timer);
  }, [successFlashId]);

  async function createAssignment(e) {
    e.preventDefault();
    setCreateError("");

    if (!newTitle.trim()) {
      setCreateError(t("assignments.enterTitle"));
      return;
    }

    try {
      setCreating(true);
      const payload = { title: newTitle.trim() };
      if (newDescription.trim()) payload.description = newDescription.trim();
      if (newDueDate) payload.dueDate = new Date(newDueDate).toISOString();
      await http.post(`/courses/${courseId}/assignments`, payload);

      setIsCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewDueDate("");
      await loadAssignments();
    } catch (err) {
      setCreateError(err?.response?.data?.error || err.message || t("common.error"));
    } finally {
      setCreating(false);
    }
  }

  async function submitAssignmentInline(assignment) {
    const id = getAssignmentId(assignment);
    if (!id) return;
    const contentText = (inlineDrafts[id] ?? "").trim();
    const selectedFiles = inlineFilesById[id] || [];
    setInlineErrorById((prev) => ({ ...prev, [id]: "" }));

    if (!contentText && selectedFiles.length === 0) {
      setInlineErrorById((prev) => ({
        ...prev,
        [id]: "Добавьте текст ответа или хотя бы один файл.",
      }));
      return;
    }

    try {
      setInlineSubmittingId(id);
      const attachments = await buildAssignmentAttachmentsPayload(selectedFiles);
      const res = await http.post(`/assignments/${id}/submit`, { contentText, attachments });
      const savedSubmission = res?.data?.submission || null;

      setLocalSubmissions((prev) => ({
        ...prev,
        [id]: {
          submittedAt: savedSubmission?.createdAt || new Date().toISOString(),
          contentText: savedSubmission?.contentText || contentText,
          attachments: savedSubmission?.attachments || [],
          grade: savedSubmission?.grade ?? null,
          feedback: savedSubmission?.feedback || "",
        },
      }));
      setSuccessFlashId(id);
      setInlineDrafts((prev) => ({ ...prev, [id]: savedSubmission?.contentText || contentText }));
      setInlineFilesById((prev) => ({ ...prev, [id]: [] }));
      await loadAssignments();
    } catch (err) {
      setInlineErrorById((prev) => ({
        ...prev,
        [id]: err?.response?.data?.error || err.message || t("common.error"),
      }));
    } finally {
      setInlineSubmittingId(null);
    }
  }

  async function loadSubmissions() {
    setSubsError("");
    setSubsLoading(true);
    try {
      const res = await http.get(`/courses/${courseId}/submissions`);
      const data = res?.data?.submissions ?? res?.data ?? [];
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err) {
      setSubsError(err?.response?.data?.error || err.message || t("common.error"));
    } finally {
      setSubsLoading(false);
    }
  }

  function openSubmissionsModal() {
    setIsSubmissionsOpen(true);
    loadSubmissions();
  }

  function openGradeModal(sub) {
    setGradeError("");
    setCurrentSubmission(sub);
    setGradeValue(sub?.grade == null ? "" : String(sub.grade));
    setFeedbackValue(sub?.feedback ?? "");
    setIsGradeOpen(true);
  }

  async function submitGrade(e) {
    e.preventDefault();
    setGradeError("");

    if (!currentSubmission?.id) return;

    let gradePayload = null;
    if (gradeValue !== "") {
      const n = Number(gradeValue);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setGradeError(t("assignments.invalidGrade"));
        return;
      }
      gradePayload = n;
    }

    try {
      setGrading(true);
      await http.post(`/submissions/${currentSubmission.id}/grade`, {
        grade: gradePayload,
        feedback: feedbackValue,
      });

      setIsGradeOpen(false);
      setCurrentSubmission(null);
      setGradeValue("");
      setFeedbackValue("");
      await loadSubmissions();
    } catch (err) {
      setGradeError(err?.response?.data?.error || err.message || t("common.error"));
    } finally {
      setGrading(false);
    }
  }

  async function sendNotification(e) {
    e.preventDefault();
    setNotificationsError("");
    try {
      setSendingNotification(true);
      await http.post(`/courses/${courseId}/notifications`, {
        title: notificationForm.title,
        body: notificationForm.body,
        audience: notificationForm.audience,
        groupId: notificationForm.audience === "GROUP" && notificationForm.groupId ? Number(notificationForm.groupId) : null,
        studentId:
          notificationForm.audience === "STUDENT" && notificationForm.studentId
            ? Number(notificationForm.studentId)
            : null,
      });
      setNotificationForm({ title: "", body: "", audience: "ALL", groupId: "", studentId: "" });
      await loadAcademicData();
    } catch (err) {
      setNotificationsError(err?.response?.data?.error || err.message || t("common.error"));
    } finally {
      setSendingNotification(false);
    }
  }

  async function saveCourseSettings(e) {
    e.preventDefault();
    setCourseSettingsError("");

    if (!courseSettingsDraft.title.trim()) {
      setCourseSettingsError("Введите название курса.");
      return;
    }

    try {
      setSavingCourseSettings(true);
      await http.put(`/courses/${courseId}`, {
        title: courseSettingsDraft.title.trim(),
        subjectName: courseSettingsDraft.subjectName,
        subjectCode: courseSettingsDraft.subjectCode,
        courseNumber: courseSettingsDraft.courseNumber ? Number(courseSettingsDraft.courseNumber) : null,
        semester: courseSettingsDraft.semester,
        department: courseSettingsDraft.department,
        studyYear: courseSettingsDraft.studyYear,
        format: courseSettingsDraft.format,
        campus: courseSettingsDraft.campus,
      });
      setIsCourseSettingsOpen(false);
      await loadCourse();
      window.dispatchEvent(new CustomEvent("course-updated", { detail: { courseId } }));
    } catch (err) {
      setCourseSettingsError(err?.response?.data?.error || err.message || t("common.error"));
    } finally {
      setSavingCourseSettings(false);
    }
  }

  const courseTitle = course?.title || `${t("courses.course", { defaultValue: "Курс" })} ${courseId}`;
  const roleLabel = isStudentPreview ? "Просмотр как студент" : isStudent ? "Студент" : role === "ADMIN" ? "Администратор" : "Преподаватель";
  const visibleTests = isStudentPreview ? tests.filter((test) => test.isPublished) : tests;
  const publishedTestsCount = visibleTests.filter((test) => test.isPublished).length;
  const courseMetaChips = buildCourseMetaChips(course);
  const formatAudience = (notification) => {
    if (notification.audience === "GROUP") return notification.group?.name ? `Группа: ${notification.group.name}` : "Группа";
    if (notification.audience === "STUDENT") {
      return notification.student?.fullName || notification.student?.email || "Студент";
    }
    if (notification.audience === "TEACHERS") return "Преподаватели курса";
    return "Весь курс";
  };
  const reviewRequests = useMemo(
    () =>
      notifications
        .map((notification) => {
          const payload = parseReviewNotification(notification);
          if (!payload?.attemptId) return null;
          return {
            notificationId: notification.id,
            attemptId: payload.attemptId,
            testId: payload.testId,
            studentId: payload.studentId,
            testTitle: notification.body?.match(/тест "([^"]+)"/i)?.[1] || `Тест #${payload.testId}`,
            studentLabel: notification.body?.match(/^Студент\s(.+?)\sзавершил\sтест/i)?.[1] || "Студент",
          };
        })
        .filter(Boolean),
    [notifications]
  );
  const regularNotifications = useMemo(
    () => notifications.filter((notification) => !parseReviewNotification(notification)),
    [notifications]
  );
  const notificationCount = regularNotifications.length || (isStudentSurface ? items.length + publishedTestsCount : 0);
  const gradebookSummary = useMemo(() => {
    const enrolledCount = courseStudents.length;
    const reviewed = submissions.filter((submission) => submission.grade != null);
    const average = reviewed.length
      ? Math.round(reviewed.reduce((sum, submission) => sum + Number(submission.grade || 0), 0) / reviewed.length)
      : null;
    const strongCount = reviewed.filter((submission) => Number(submission.grade || 0) >= 80).length;
    const riskCount = reviewed.filter((submission) => Number(submission.grade || 0) < 60).length;
    return {
      averageLabel: average == null ? "—" : `${average}%`,
      description: enrolledCount
        ? `Оценки и сдачи по ${enrolledCount} студентам курса.`
        : "Студенты появятся здесь после записи на курс.",
      strongCount,
      riskCount,
    };
  }, [courseStudents, submissions]);
  const showLegacyAssignmentsMeta = false;
  const randomBackColor = () => {
    const colors = ["#2563eb", "#7c3aed", "#059669", "#db2777", "#ea580c", "#0891b2"];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 px-2 py-3 lg:px-4">
      <CourseWorkspaceHeader
        courseTitle={courseTitle}
        courseId={courseId}
        roleLabel={roleLabel}
        itemsCount={items.length}
        testsCount={visibleTests.length}
        courseMetaChips={courseMetaChips}
        isTeacher={canTeacherManage}
        onBack={() => navigate("/courses")}
        onBackHover={() => setBackHoverColor(randomBackColor())}
        backHoverColor={backHoverColor}
        onOpenSettings={() => {
          setCourseSettingsError("");
          setIsCourseSettingsOpen(true);
        }}
        onOpenStudents={() => navigate(`/courses/${courseId}/students`)}
        onOpenSubmissions={openSubmissionsModal}
        onCreateAssignment={() => setIsCreateOpen(true)}
      />

      <CourseOverviewGrid
        isStudent={isStudentSurface}
        isTeacher={canTeacherManage}
        notificationCount={notificationCount}
        notifications={regularNotifications}
        tests={visibleTests}
        submissionsCount={submissions.length}
        gradebookSummary={gradebookSummary}
        onCreateTest={() => {
          setNewTestTitle("");
          setCreateTestError("");
          setNewTestAvailableFrom("");
          setIsCreateTestOpen(true);
        }}
        formatAudience={formatAudience}
        onResolveAttemptRequest={resolveAttemptRequest}
        onOpenGrades={() => navigate(`/grades?courseId=${courseId}`)}
      />

      <CourseTabNav
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: "assignments", label: t("assignments.title", { defaultValue: "Задания" }) },
          { key: "tests", label: t("tests.title", { defaultValue: "Тесты" }) },
          ...(canTeacherManage ? [{ key: "gradebook", label: t("journal.title", { defaultValue: "Журнал" }) }] : []),
          ...(canTeacherManage ? [{ key: "submissions", label: t("assignments.submissions", { defaultValue: "Сдачи" }) }] : []),
        ]}
      />

      <AnimatePresence mode="wait">
        <MotionDiv
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:p-6"
        >
          {activeTab === "assignments" ? (
            <>
              <AssignmentsTabPanel
                error={error}
                items={items}
                getAssignmentId={getAssignmentId}
                localSubmissions={localSubmissions}
                isStudent={isStudentSurface}
                isReadOnlyStudentView={isStudentPreview}
                isTeacher={canTeacherManage}
                inlineDrafts={inlineDrafts}
                setInlineDrafts={setInlineDrafts}
                inlineFilesById={inlineFilesById}
                onSelectFiles={handleSelectAssignmentFiles}
                clearSelectedFiles={clearSelectedAssignmentFiles}
                inlineSubmittingId={inlineSubmittingId}
                submitAssignmentInline={submitAssignmentInline}
                successFlashId={successFlashId}
                inlineErrorById={inlineErrorById}
                onDeleteAssignment={setAssignmentToDelete}
                t={t}
              />

              {showLegacyAssignmentsMeta && canTeacherManage && (
                <section className="mt-8 border border-gray-300 rounded-xl p-4">
                  <div className="text-lg font-semibold mb-4">{t("assignments.submissions", { defaultValue: "Сдачи" })}</div>

                  <form onSubmit={sendNotification} className="mb-5 grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
                    <input
                      value={notificationForm.title}
                      onChange={(e) => setNotificationForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Заголовок уведомления"
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none transition focus:border-blue-400 lg:col-span-2"
                    />
                    <select
                      value={notificationForm.audience}
                      onChange={(e) => setNotificationForm((prev) => ({ ...prev, audience: e.target.value }))}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none transition focus:border-blue-400"
                    >
                      <option value="ALL">Всем студентам курса</option>
                      <option value="GROUP">Конкретной группе</option>
                      <option value="STUDENT">Конкретному студенту</option>
                    </select>
                    <button
                      type="submit"
                      disabled={sendingNotification}
                      className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                    >
                      {sendingNotification ? "Отправка..." : "Создать уведомление"}
                    </button>
                    <textarea
                      value={notificationForm.body}
                      onChange={(e) => setNotificationForm((prev) => ({ ...prev, body: e.target.value }))}
                      rows={3}
                      placeholder="Текст уведомления"
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none transition focus:border-blue-400 lg:col-span-3"
                    />
                    {notificationForm.audience === "GROUP" && (
                      <select
                        value={notificationForm.groupId}
                        onChange={(e) => setNotificationForm((prev) => ({ ...prev, groupId: e.target.value }))}
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none transition focus:border-blue-400"
                      >
                        <option value="">Выберите группу</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {notificationForm.audience === "STUDENT" && (
                      <select
                        value={notificationForm.studentId}
                        onChange={(e) => setNotificationForm((prev) => ({ ...prev, studentId: e.target.value }))}
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none transition focus:border-blue-400"
                      >
                        <option value="">Выберите студента</option>
                        {courseStudents.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.fullName || student.email}
                          </option>
                        ))}
                      </select>
                    )}
                  </form>

                  {notificationsError && <div className="mb-4 text-red-600">{notificationsError}</div>}

                  {subsLoading && (
                    <div className="text-gray-500">{t("common.loading", { defaultValue: "Загрузка..." })}</div>
                  )}
                  {subsError && <div className="text-red-600 mt-2">{subsError}</div>}

                  {!subsLoading && !subsError && (
                    <div className="grid gap-3">
                      {submissions.map((s) => (
                        <div key={s.id} className="border border-gray-300 rounded-xl p-4">
                          <div className="text-sm text-gray-700">
                            <span className="font-semibold">{s.student?.email ?? "—"}</span>
                            <span className="mx-2 text-gray-400">•</span>
                            <span className="text-gray-600">{s.assignment?.title ?? "—"}</span>
                          </div>

                          <div className="mt-3 whitespace-pre-wrap break-words text-gray-900">
                            {s.contentText || "—"}
                          </div>

                          {s.grade != null && (
                            <div className="mt-2 text-sm text-gray-700">
                              {t("assignments.grade", { defaultValue: "Оценка" })}: {s.grade}
                            </div>
                          )}
                        </div>
                      ))}

                      {submissions.length === 0 && (
                        <div className="flex justify-center items-center h-32">
                          <p className="text-gray-500 text-lg">{t("common.empty")}</p>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </>
          ) : activeTab === "tests" ? (
            <div className="grid gap-3">
              {testsSuccess ? (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50/85 px-4 py-3 text-sm font-semibold text-emerald-800 theme-surface-button">
                  {testsSuccess}
                </div>
              ) : null}
              <TestsTabPanel
                testsError={testsError}
                isTeacher={canTeacherManage}
                isReadOnlyStudentView={isStudentPreview}
                tests={visibleTests}
                testsLoaded={testsLoaded}
                getTestId={getTestId}
                onOpenCreate={() => {
                  setNewTestTitle("");
                  setNewTestDescription("");
                  setCreateTestError("");
                  setNewTestAvailableFrom("");
                  setIsCreateTestOpen(true);
                }}
                onUnpublish={unpublishTest}
                onPublish={publishTest}
                onEdit={openTestEditor}
                onDelete={setTestToDelete}
                onStart={startTest}
                onRequestAttempt={requestExtraAttempt}
                onInspect={(testId) => navigate(`/tests/${testId}/inspect`)}
                t={t}
              />
            </div>
          ) : activeTab === "gradebook" && canTeacherManage ? (
            <CourseGradebook embedded refreshKey={gradebookRefreshKey} />
          ) : activeTab === "submissions" && canTeacherManage ? (
            <SubmissionsTabPanel
              subsLoading={subsLoading}
              subsError={subsError}
              submissions={submissions}
              reviewRequests={reviewRequests}
              isTeacher={canTeacherManage}
              onGrade={openGradeModal}
              onOpenTestReview={openTestReview}
              t={t}
            />
          ) : (
            <div className="flex justify-center items-center h-32">
              <p className="text-gray-500 text-lg">{t("common.empty", { defaultValue: "Пусто" })}</p>
            </div>
          )}
        </MotionDiv>
      </AnimatePresence>

      <Modal
        open={isCourseSettingsOpen}
        title="Параметры курса"
        onClose={() => {
          if (savingCourseSettings) return;
          setIsCourseSettingsOpen(false);
          setCourseSettingsError("");
        }}
      >
        <form onSubmit={saveCourseSettings} className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-gray-700">Название курса</span>
            <input
              value={courseSettingsDraft.title}
              onChange={(e) => setCourseSettingsDraft((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 p-2.5"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            {COURSE_TAG_FIELDS.map((field) => (
              <label key={field.key} className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">{field.label}</span>
                <select
                  value={courseSettingsDraft[field.key]}
                  onChange={(e) => setCourseSettingsDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 bg-white p-2.5"
                >
                  <option value="">Не выбрано</option>
                  {(courseTagOptions?.[field.optionKey] ?? []).map((value) => (
                    <option key={String(value)} value={String(value)}>
                      {String(value)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {courseSettingsError && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              {courseSettingsError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingCourseSettings}
              className="rounded-xl border border-blue-400 bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {savingCourseSettings ? "Сохранение..." : "Сохранить теги курса"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={isCreateOpen}
        title={t("assignments.create", { defaultValue: "Создать задание" })}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateError("");
        }}
      >
        <form onSubmit={createAssignment} className="space-y-4">
          {createError && <div className="text-red-600">{createError}</div>}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t("assignments.title", { defaultValue: "Название" })}
            </label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              placeholder={t("assignments.enterTitle", { defaultValue: "Введите название" })}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t("assignments.due", { defaultValue: "Дедлайн" })}
            </label>
            <input
              type="datetime-local"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Описание</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              placeholder="Кратко опишите задание и ожидания по выполнению"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                setCreateError("");
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 transition"
            >
              {t("common.cancel", { defaultValue: "Отмена" })}
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-lg border border-blue-500 bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-60"
            >
              {creating ? t("common.loading", { defaultValue: "Загрузка..." }) : t("common.create", { defaultValue: "Создать" })}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={isSubmissionsOpen} title={t("assignments.submissions", { defaultValue: "Сдачи" })} onClose={() => setIsSubmissionsOpen(false)}>
        <div className="space-y-3">
          {subsLoading && <div className="text-gray-500">{t("common.loading", { defaultValue: "Загрузка..." })}</div>}
          {subsError && <div className="text-red-600">{subsError}</div>}

          {!subsLoading && !subsError && (
            <div className="grid gap-3">
              {reviewRequests.map((request) => (
                <div key={`modal-review-${request.notificationId}`} className="submission-review-card rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="submission-review-title font-semibold">Нужна проверка теста</div>
                      <div className="submission-review-meta text-sm">
                        {request.studentLabel} • {request.testTitle}
                      </div>
                    </div>
                    <ActionButton tone="primary" onClick={() => openTestReview(request.attemptId)}>
                      Проверить
                    </ActionButton>
                  </div>
                </div>
              ))}

              {submissions.map((s) => (
                <div key={s.id} className="submission-card rounded-xl border p-4">
                  <div className="text-sm">
                    <span className="submission-student font-semibold">{s.student?.email ?? "—"}</span>
                    <span className="mx-2 text-slate-400">•</span>
                    <span className="submission-assignment">{s.assignment?.title ?? "—"}</span>
                  </div>

                  <div className="submission-answer mt-3 whitespace-pre-wrap break-words">{s.contentText || "—"}</div>

                  {s.attachments?.length ? (
                    <div className="submission-files-box mt-3 rounded-xl border p-3">
                      <div className="submission-files-title mb-2 text-xs font-semibold uppercase tracking-[0.18em]">Файлы студента</div>
                      <div className="grid gap-2">
                        {s.attachments.map((file, index) => (
                          <a
                            key={`${file.url}-${index}`}
                            href={new URL(file.url, http.defaults.baseURL).toString()}
                            target="_blank"
                            rel="noreferrer"
                            className="submission-file-link flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-medium"
                          >
                            <span className="truncate">{file.originalName}</span>
                            <span className="submission-file-size shrink-0">
                              {file.size ? `${Math.max(1, Math.round(file.size / 1024))} КБ` : ""}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="submission-grade text-sm">
                      {t("assignments.grade", { defaultValue: "Оценка" })}: {s.grade == null ? "—" : s.grade}
                    </div>

                    <button
                      type="button"
                      onClick={() => openGradeModal(s)}
                      className="submission-grade-button px-4 py-2 rounded-lg border border-gray-300 bg-gray-100 hover:bg-gray-200 transition"
                    >
                      {t("assignments.gradeAction", { defaultValue: "Оценить" })}
                    </button>
                  </div>
                </div>
              ))}

              {submissions.length === 0 && reviewRequests.length === 0 && (
                <div className="flex justify-center items-center h-32">
                  <p className="text-gray-500 text-lg">{t("common.empty", { defaultValue: "Пусто" })}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={isGradeOpen} title={t("assignments.gradeAction", { defaultValue: "Оценивание" })} onClose={() => setIsGradeOpen(false)}>
        <form onSubmit={submitGrade} className="space-y-4">
          {gradeError && <div className="text-red-600">{gradeError}</div>}

          <div className="text-sm text-gray-700">
            <div className="font-semibold">{currentSubmission?.student?.email ?? "—"}</div>
            <div className="text-gray-600">{currentSubmission?.assignment?.title ?? "—"}</div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t("assignments.grade", { defaultValue: "Оценка (0–100)" })}
            </label>
            <input
              value={gradeValue}
              onChange={(e) => setGradeValue(e.target.value)}
              inputMode="numeric"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              placeholder={t("assignments.grade", { defaultValue: "Оценка" })}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t("assignments.feedback", { defaultValue: "Комментарий" })}
            </label>
            <textarea
              value={feedbackValue}
              onChange={(e) => setFeedbackValue(e.target.value)}
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsGradeOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 transition"
            >
              {t("common.cancel", { defaultValue: "Отмена" })}
            </button>
            <button
              type="submit"
              disabled={grading}
              className="px-4 py-2 rounded-lg border border-blue-500 bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-60"
            >
              {grading ? t("common.loading", { defaultValue: "Загрузка..." }) : t("common.save", { defaultValue: "Сохранить" })}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={isCreateTestOpen}
        title={t("tests.create", { defaultValue: "Создать тест" })}
        onClose={() => {
          setIsCreateTestOpen(false);
          setCreateTestError("");
        }}
      >
        <form onSubmit={createTest} className="space-y-4">
          {createTestError && <div className="text-red-600">{createTestError}</div>}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t("tests.title", { defaultValue: "Название" })}
            </label>
            <input
              value={newTestTitle}
              onChange={(e) => setNewTestTitle(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              placeholder={t("tests.enterTitle", { defaultValue: "Введите название теста" })}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Дата открытия теста</label>
            <input
              type="datetime-local"
              value={newTestAvailableFrom}
              onChange={(e) => setNewTestAvailableFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <div className="text-xs text-gray-500">Оставьте поле пустым, если тест должен открыться сразу после публикации.</div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsCreateTestOpen(false);
                setCreateTestError("");
                setNewTestAvailableFrom("");
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 transition"
            >
              {t("common.cancel", { defaultValue: "Отмена" })}
            </button>
            <button
              type="submit"
              disabled={creatingTest}
              className="px-4 py-2 rounded-lg border border-blue-500 bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-60"
            >
              {creatingTest ? t("common.loading", { defaultValue: "Загрузка..." }) : t("common.create", { defaultValue: "Создать" })}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!publishTargetTestId}
        title="Публикация теста"
        onClose={() => {
          if (publishingTest) return;
          setPublishTargetTestId(null);
          setPublishDateMode("now");
          setPublishAvailableFrom("");
          setPublishError("");
        }}
      >
        <div className="space-y-4">
          {publishError ? <div className="text-red-600">{publishError}</div> : null}

          <div className="grid gap-3">
            <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-4 py-3">
              <input
                type="radio"
                name="publish-mode"
                checked={publishDateMode === "now"}
                onChange={() => setPublishDateMode("now")}
              />
              <div>
                <div className="font-semibold text-slate-900">Открыть сейчас</div>
                <div className="text-sm text-slate-500">Тест станет доступен сразу после публикации.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-300 px-4 py-3">
              <input
                type="radio"
                name="publish-mode"
                checked={publishDateMode === "scheduled"}
                onChange={() => setPublishDateMode("scheduled")}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">Открыть по дате</div>
                <div className="mt-1 text-sm text-slate-500">Тест опубликуется сейчас, но студенты увидят его только в указанное время.</div>
                <input
                  type="datetime-local"
                  value={publishAvailableFrom}
                  onChange={(event) => setPublishAvailableFrom(event.target.value)}
                  className="mt-3 w-full rounded-lg border border-gray-300 p-3 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={publishDateMode !== "scheduled"}
                />
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setPublishTargetTestId(null);
                setPublishDateMode("now");
                setPublishAvailableFrom("");
                setPublishError("");
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 transition hover:bg-gray-100"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={confirmPublishTest}
              disabled={publishingTest}
              className="rounded-lg border border-green-500 bg-green-500 px-4 py-2 font-semibold text-white transition hover:bg-green-600 disabled:opacity-60"
            >
              {publishingTest ? "Публикуем..." : "Опубликовать"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editingTestId}
        title={t("tests.editTitle", { defaultValue: "Редактирование теста" })}
        onClose={closeTestEditor}
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {editTestDetailLoading && (
            <div className="text-gray-500">{t("common.loading", { defaultValue: "Загрузка..." })}</div>
          )}
          {editTestDetailError && <div className="text-red-600">{editTestDetailError}</div>}

          {!editTestDetailLoading && editTestDetail && (
            <>
              <form onSubmit={saveTestTitleFromEditor} className="space-y-3 border-b border-gray-200 pb-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {t("tests.title", { defaultValue: "Название" })}
                  </label>
                  <input
                    value={editTestTitleDraft}
                    onChange={(e) => setEditTestTitleDraft(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Описание</label>
                  <textarea
                    value={editTestDescriptionDraft}
                    onChange={(e) => setEditTestDescriptionDraft(e.target.value)}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingTestMeta || !!editModalBusy}
                  className="px-4 py-2 rounded-lg border border-blue-500 bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-60"
                >
                  {savingTestMeta
                    ? t("common.loading", { defaultValue: "Загрузка..." })
                    : t("tests.saveTitle", { defaultValue: "Сохранить название" })}
                </button>
              </form>

              <div className="space-y-3">
                <div className="text-base font-semibold">
                  {t("questions.existing", { defaultValue: "Вопросы" })}
                </div>

                {editQuestionForms.length === 0 && (
                  <p className="text-gray-500 text-sm">{t("questions.none", { defaultValue: "Пока вопросов нет." })}</p>
                )}

                {editQuestionForms.map((row, index) => {
                  const isChoice = row.type === "SINGLE" || row.type === "MULTI";
                  const savingThis = editModalBusy === `save-q-${row.id}`;
                  const deletingThis = editModalBusy === `del-q-${row.id}`;
                  const anyBusy = !!editModalBusy;
                  return (
                    <div key={row.id} className="border border-gray-300 rounded-xl p-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700">
                            {t("questions.type", { defaultValue: "Тип вопроса" })}
                          </label>
                          <select
                            value={row.type}
                            onChange={(e) => {
                              const next = e.target.value;
                              patchQuestionForm(index, {
                                type: next,
                                options:
                                  next === "OPEN"
                                    ? []
                                    : (row.options || []).length >= 2
                                      ? row.options
                                      : [emptyQuestionOption(), emptyQuestionOption()],
                              });
                            }}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          >
                            <option value="SINGLE">
                              {t("questions.single", { defaultValue: "Один правильный (SINGLE)" })}
                            </option>
                            <option value="MULTI">
                              {t("questions.multi", { defaultValue: "Несколько правильных (MULTI)" })}
                            </option>
                            <option value="OPEN">{t("questions.open", { defaultValue: "Текстовый (OPEN)" })}</option>
                          </select>
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700">
                            {t("questions.text", { defaultValue: "Текст вопроса" })}
                          </label>
                          <textarea
                            value={row.text}
                            onChange={(e) => patchQuestionForm(index, { text: e.target.value })}
                            rows={3}
                            className="w-full p-3 border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            {t("questions.pointsLabel", { defaultValue: "Баллы" })}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={row.points}
                            onChange={(e) => patchQuestionForm(index, { points: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            {t("questions.orderLabel", { defaultValue: "Порядок" })}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={row.order}
                            onChange={(e) => patchQuestionForm(index, { order: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          />
                        </div>
                      </div>

                      {isChoice && (
                        <div className="space-y-2 border border-gray-200 rounded-lg p-3">
                          <div className="flex justify-between items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-700">
                              {t("questions.options", { defaultValue: "Варианты ответа" })}
                            </span>
                            <button
                              type="button"
                              onClick={() => addQuestionFormOption(index)}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm hover:bg-gray-100 transition"
                            >
                              + {t("questions.addOption", { defaultValue: "Вариант" })}
                            </button>
                          </div>
                          {(row.options || []).map((opt, oi) => (
                            <div key={oi} className="flex flex-wrap items-center gap-2">
                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type={row.type === "SINGLE" ? "radio" : "checkbox"}
                                  name={`correct-${row.id}`}
                                  checked={!!opt.isCorrect}
                                  onChange={() => toggleQuestionFormOptionCorrect(index, oi)}
                                />
                                {t("questions.correct", { defaultValue: "Верно" })}
                              </label>
                              <input
                                value={opt.text}
                                onChange={(e) => setQuestionFormOptionText(index, oi, e.target.value)}
                                className="flex-1 min-w-[12rem] p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                                placeholder={t("questions.optionPlaceholder", { defaultValue: "Текст варианта" })}
                              />
                              <button
                                type="button"
                                onClick={() => removeQuestionFormOption(index, oi)}
                                className="px-2 py-1 rounded border border-gray-300 text-sm hover:bg-gray-100 transition"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => saveQuestionFormRow(index)}
                          disabled={anyBusy}
                          className="px-4 py-2 rounded-lg border border-blue-500 bg-blue-500 text-white text-sm hover:bg-blue-600 transition disabled:opacity-60"
                        >
                          {savingThis
                            ? t("common.loading", { defaultValue: "Загрузка..." })
                            : t("common.save", { defaultValue: "Сохранить вопрос" })}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteQuestionFormRow(row.id)}
                          disabled={anyBusy}
                          className="px-4 py-2 rounded-lg border border-red-500 bg-red-500 text-white text-sm hover:bg-red-600 transition disabled:opacity-60"
                        >
                          {deletingThis
                            ? t("common.loading", { defaultValue: "Загрузка..." })
                            : t("common.delete", { defaultValue: "Удалить" })}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-3">
                <div className="text-base font-semibold">
                  {t("questions.add", { defaultValue: "Добавить вопрос" })}
                </div>
                <form onSubmit={submitNewQuestion} className="space-y-3">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {t("questions.type", { defaultValue: "Тип вопроса" })}
                    </label>
                    <select
                      value={newQuestionType}
                      onChange={(e) => {
                        const next = e.target.value;
                        setNewQuestionType(next);
                        if (next === "SINGLE" || next === "MULTI") {
                          setNewQuestionOptions([emptyQuestionOption(), emptyQuestionOption()]);
                        }
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    >
                      <option value="SINGLE">
                        {t("questions.single", { defaultValue: "Один правильный (SINGLE)" })}
                      </option>
                      <option value="MULTI">
                        {t("questions.multi", { defaultValue: "Несколько правильных (MULTI)" })}
                      </option>
                      <option value="OPEN">{t("questions.open", { defaultValue: "Текстовый (OPEN)" })}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {t("questions.text", { defaultValue: "Текст вопроса" })}
                    </label>
                    <textarea
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {t("questions.pointsLabel", { defaultValue: "Баллы" })}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={newQuestionPoints}
                        onChange={(e) => setNewQuestionPoints(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {t("questions.orderLabel", { defaultValue: "Порядок" })}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={newQuestionOrder}
                        onChange={(e) => setNewQuestionOrder(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                      />
                    </div>
                  </div>

                  {(newQuestionType === "SINGLE" || newQuestionType === "MULTI") && (
                    <div className="space-y-2 border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-700">
                          {t("questions.options", { defaultValue: "Варианты ответа" })}
                        </span>
                        <button
                          type="button"
                          onClick={addNewQOption}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm hover:bg-gray-100 transition"
                        >
                          + {t("questions.addOption", { defaultValue: "Вариант" })}
                        </button>
                      </div>
                      {newQuestionOptions.map((opt, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type={newQuestionType === "SINGLE" ? "radio" : "checkbox"}
                              name="new-q-correct"
                              checked={!!opt.isCorrect}
                              onChange={() => toggleNewQOptionCorrect(idx, newQuestionType)}
                            />
                            {t("questions.correct", { defaultValue: "Верно" })}
                          </label>
                          <input
                            value={opt.text}
                            onChange={(e) => setNewQOptionText(idx, e.target.value)}
                            className="flex-1 min-w-[12rem] p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          />
                          <button
                            type="button"
                            onClick={() => removeNewQOption(idx)}
                            className="px-2 py-1 rounded border border-gray-300 text-sm hover:bg-gray-100 transition"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {newQuestionError && <div className="text-red-600 text-sm">{newQuestionError}</div>}

                  <button
                    type="submit"
                    disabled={newQuestionSaving || !!editModalBusy}
                    className="px-4 py-2 rounded-lg border border-blue-500 bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-60"
                  >
                    {newQuestionSaving
                      ? t("common.loading", { defaultValue: "Загрузка..." })
                      : t("questions.create", { defaultValue: "Добавить вопрос" })}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </Modal>

      <AttemptReviewModal
        attemptId={reviewAttemptId}
        open={reviewOpen}
        onClose={() => {
          setReviewOpen(false);
          setReviewAttemptId(null);
        }}
        onSaved={async () => {
          await Promise.all([loadAcademicData(), loadTests(), loadSubmissions()]);
          setGradebookRefreshKey((prev) => prev + 1);
        }}
      />

      <ConfirmDialog
        open={!!assignmentToDelete}
        title="Удаление задания"
        message={`Удалить задание "${assignmentToDelete?.title || ""}"? Все связанные сдачи тоже будут удалены.`}
        confirmLabel="Удалить задание"
        busy={deletingEntity === "assignment"}
        onCancel={() => setAssignmentToDelete(null)}
        onConfirm={() => deleteAssignment(assignmentToDelete)}
      />

      <ConfirmDialog
        open={!!testToDelete}
        title="Удаление теста"
        message={`Удалить тест "${testToDelete?.title || ""}"? Это действие затронет вопросы, попытки и ответы студентов.`}
        confirmLabel="Удалить тест"
        busy={deletingEntity === "test"}
        onCancel={() => setTestToDelete(null)}
        onConfirm={confirmDeleteTest}
      />

      <ConfirmDialog
        open={!!pendingStartTestId}
        title="Начать тест"
        message="Открыть попытку теста сейчас? После подтверждения вы сразу перейдете на страницу прохождения."
        confirmLabel="Начать"
        cancelLabel="Отмена"
        onCancel={() => setPendingStartTestId(null)}
        onConfirm={async () => {
          const nextId = pendingStartTestId;
          setPendingStartTestId(null);
          if (nextId) {
            await beginTestAttempt(nextId);
          }
        }}
      />
    </div>
  );
}





