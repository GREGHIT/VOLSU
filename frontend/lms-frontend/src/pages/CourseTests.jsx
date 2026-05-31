import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { http } from "../api/http";
import { getUser } from "../auth/token";
import Modal from "../components/Modal";
import TestQuestionsModal from "../components/TestQuestionsModal";
import AttemptReviewModal from "../components/AttemptReviewModal";
import MyAttemptsModal from "../components/MyAttemptsModal";
import SegmentedToggle from "../components/ui/SegmentedToggle";
import ActionButton from "../components/ui/ActionButton";
import ConfirmDialog from "../components/ConfirmDialog";
import useDebouncedValue from "../utils/useDebouncedValue";
import { formatUiError } from "../utils/uiError";
import { sanitizeDomText } from "../utils/textEncoding";

function decodeBrokenText(value) {
  if (typeof value !== "string") return value ?? "";
  try {
    const decoded = decodeURIComponent(escape(value));
    if ((value.includes("\u0420") || value.includes("\u0421") || value.includes("?") || value.includes("?")) && /[\u0400-\u04FF]/.test(decoded)) return decoded;
    return value;
  } catch {
    return value;
  }
}


export default function CourseTests() {
  const { t } = useTranslation();
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const me = getUser();
  const isStudent = me?.role === "STUDENT";
  const isTeacher = me?.role === "TEACHER" || me?.role === "ADMIN";
  const isStudentPreview = isTeacher && searchParams.get("preview") === "student";

  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAvailableFrom, setNewAvailableFrom] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [publishingId, setPublishingId] = useState(null);
  const [publishDialogTest, setPublishDialogTest] = useState(null);
  const [publishMode, setPublishMode] = useState("now");
  const [publishAvailableFrom, setPublishAvailableFrom] = useState("");
  const [publishError, setPublishError] = useState("");
  const [startingId, setStartingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const [attemptsOpen, setAttemptsOpen] = useState(false);
  const [attemptsTestId, setAttemptsTestId] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [attemptsErr, setAttemptsErr] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewAttemptId, setReviewAttemptId] = useState(null);

  const [myOpen, setMyOpen] = useState(false);
  const [myTestId, setMyTestId] = useState(null);
  const [startConfirmTest, setStartConfirmTest] = useState(null);
  const rootRef = useRef(null);

  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [activeTestId, setActiveTestId] = useState(null);

  async function load() {
    setError("");
    try {
      const res = await http.get(`/courses/${courseId}/tests`);
      setItems(res.data?.tests || res.data || []);
    } catch (err) {
      setError(formatUiError(err, "Не удалось загрузить тесты курса."));
    }
  }

  useEffect(() => {
    load();
  }, [courseId]);

  useEffect(() => {
    sanitizeDomText(rootRef.current);
  }, [items, error, successMessage, createError, publishError, attemptsErr, query, teacherFilter, isCreateOpen, publishDialogTest, attemptsOpen, myOpen, reviewOpen]);

  async function createTest(e) {
    e.preventDefault();
    setCreateError("");
    const title = newTitle.trim();

    if (!title) {
      setCreateError("Введите название теста.");
      return;
    }
    if (title.length < 3) {
      setCreateError("Название теста должно содержать минимум 3 символа.");
      return;
    }

    try {
      setCreating(true);
      await http.post(`/courses/${courseId}/tests`, {
        title,
        availableFrom: newAvailableFrom ? new Date(newAvailableFrom).toISOString() : null,
      });
      setIsCreateOpen(false);
      setNewTitle("");
      setNewAvailableFrom("");
      await load();
    } catch (err) {
      setCreateError(formatUiError(err, "Не удалось создать тест."));
    } finally {
      setCreating(false);
    }
  }

  async function togglePublish(test) {
    if (!test.isPublished) {
      setPublishDialogTest(test);
      setPublishMode("now");
      setPublishAvailableFrom("");
      setPublishError("");
      return;
    }
    setError("");
    setPublishingId(test.id);
    try {
      await http.post(`/tests/${test.id}/unpublish`);
      await load();
    } catch (err) {
      setError(formatUiError(err, "Не удалось обновить публикацию теста."));
    } finally {
      setPublishingId(null);
    }
  }

  async function confirmPublishTest() {
    if (!publishDialogTest) return;
    if (publishMode === "scheduled" && !publishAvailableFrom) {
      setPublishError("Укажите дату и время открытия теста.");
      return;
    }

    setError("");
    setPublishingId(publishDialogTest.id);
    try {
      await http.post(`/tests/${publishDialogTest.id}/publish`, {
        availableFrom: publishMode === "scheduled" ? new Date(publishAvailableFrom).toISOString() : null,
      });
      setPublishDialogTest(null);
      setPublishMode("now");
      setPublishAvailableFrom("");
      await load();
    } catch (err) {
      setPublishError(formatUiError(err, "Не удалось опубликовать тест."));
    } finally {
      setPublishingId(null);
    }
  }

  async function startTest(test) {
    if (test?.activeAttemptId) {
      navigate(`/tests/${test.id}/attempts/${test.activeAttemptId}`);
      return;
    }
    setError("");
    setStartingId(test.id);
    try {
      const res = await http.post(`/tests/${test.id}/start`);
      const attempt = res.data?.attempt || res.data;
      navigate(`/tests/${test.id}/attempts/${attempt.id}`);
    } catch (err) {
      setError(formatUiError(err, "Не удалось начать попытку."));
    } finally {
      setStartingId(null);
    }
  }

  async function confirmStartTest() {
    if (!startConfirmTest) return;
    const nextTest = startConfirmTest;
    setStartConfirmTest(null);
    await startTest(nextTest);
  }

  async function requestExtraAttempt(test) {
    setError("");
    try {
      await http.post(`/tests/${test.id}/request-attempt`);
      setSuccessMessage("\u0417\u0430\u043f\u0440\u043e\u0441 \u043d\u0430 \u0434\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u0443\u044e \u043f\u043e\u043f\u044b\u0442\u043a\u0443 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d \u043f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044e.");
      await load();
    } catch (err) {
      setError(formatUiError(err, "Не удалось отправить запрос на дополнительную попытку."));
    }
  }

  async function openAttempts(testId) {
    setAttemptsErr("");
    setAttempts([]);
    setAttemptsTestId(testId);
    setAttemptsOpen(true);
    try {
      const res = await http.get(`/tests/${testId}/attempts`);
      setAttempts(res.data?.attempts || []);
    } catch (err) {
      setAttemptsErr(formatUiError(err, "Не удалось загрузить попытки."));
    }
  }

  function openQuestions(testId) {
    setActiveTestId(testId);
    setQuestionsOpen(true);
  }

  function openReview(attemptId) {
    setReviewAttemptId(attemptId);
    setReviewOpen(true);
  }

  function openInspection(testId) {
    navigate(`/tests/${testId}/inspect`);
  }

  async function duplicateTest(testId) {
    setError("");
    try {
      await http.post(`/tests/${testId}/duplicate`);
      await load();
    } catch (err) {
      setError(formatUiError(err, "Не удалось продублировать тест."));
    }
  }

  async function runBatch(action) {
    if (!selectedIds.length) return;
    setError("");
    try {
      await http.post(`/courses/${courseId}/tests/batch`, { action, ids: selectedIds });
      setSelectedIds([]);
      await load();
    } catch (err) {
      setError(formatUiError(err, "Не удалось выполнить массовое действие."));
    }
  }

  const visibleItems = useMemo(() => {
    const search = debouncedQuery.trim().toLowerCase();
    return items.filter((test) => {
      const matchesSearch =
        !search ||
        [test.title, test.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));

      if (!matchesSearch) return false;
      if (isStudentPreview) return !!test.isPublished;
      if (!isTeacher) return true;
      if (teacherFilter === "published") return !!test.isPublished;
      if (teacherFilter === "draft") return !test.isPublished;
      if (teacherFilter === "retake") return Number(test.attemptLimit || 1) > 1;
      if (teacherFilter === "manual") return Number(test.pendingReviewCount || 0) > 0;
      return true;
    });
  }, [debouncedQuery, isStudentPreview, isTeacher, items, teacherFilter]);

  function isStartBlocked(test) {
    if (test?.canStart === false) return true;
    const limit = Number(test?.attemptLimit);
    const used = Number(test?.attemptsUsed);
    const remaining = Number(test?.remainingAttempts);
    return (Number.isFinite(limit) && Number.isFinite(used) && limit > 0 && used >= limit) || (Number.isFinite(remaining) && remaining <= 0);
  }

  function canRequestExtraAttempt(test) {
    const reason = String(test?.startBlockedReason || "").toLowerCase();
    return isStartBlocked(test) && (reason.includes("\u043b\u0438\u043c\u0438\u0442") || reason.includes("\u043f\u043e\u043f\u044b\u0442"));
  }

  return (
    <div ref={rootRef}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("tests.title")}</h2>
        {isTeacher && !isStudentPreview ? (
          <button onClick={() => { setNewAvailableFrom(""); setIsCreateOpen(true); }} style={{ padding: 10, cursor: "pointer" }}>
            + {t("tests.create")}
          </button>
        ) : null}
      </div>

      {error ? <div style={{ color: "crimson", marginTop: 10 }}>{error}</div> : null}
      {successMessage ? <div style={{ color: "#047857", marginTop: 10, fontWeight: 700 }}>{successMessage}</div> : null}

      {isStudentPreview ? (
        <div style={{ marginTop: 12, borderRadius: 14, border: "1px solid #86efac", background: "#ecfdf5", padding: 14, color: "#166534" }}>
          Режим просмотра от лица студента. Здесь видны только опубликованные тесты, запуск попытки отключен, а кнопка открывает просмотр с правильными ответами.
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию или описанию теста"
          style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
        />

        {isTeacher && !isStudentPreview ? (
          <>
            <SegmentedToggle
              value={teacherFilter}
              onChange={setTeacherFilter}
              options={[
                { value: "all", label: "Все" },
                { value: "published", label: "Опубликованы" },
                { value: "draft", label: "Черновики" },
                { value: "retake", label: "Пересдача" },
                { value: "manual", label: "Спорные" },
              ]}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => runBatch("publish")} disabled={!selectedIds.length} style={{ padding: 10, cursor: "pointer" }}>
                Опубликовать выбранные
              </button>
              <button onClick={() => runBatch("unpublish")} disabled={!selectedIds.length} style={{ padding: 10, cursor: "pointer" }}>
                Снять с публикации
              </button>
              <button onClick={() => runBatch("delete")} disabled={!selectedIds.length} style={{ padding: 10, cursor: "pointer" }}>
                Удалить выбранные
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {visibleItems.map((test) => (
          <div
            key={test.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              {isTeacher && !isStudentPreview ? (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(test.id)}
                  onChange={(e) =>
                    setSelectedIds((prev) => (e.target.checked ? [...prev, test.id] : prev.filter((id) => id !== test.id)))
                  }
                  style={{ marginBottom: 8 }}
                />
              ) : null}
              <div style={{ fontWeight: 700 }}>{test.title}</div>
              {"isPublished" in test ? (
                <div style={{ opacity: 0.7 }}>
                  {t("tests.published", { defaultValue: "Опубликован" })}: {test.isPublished ? t("common.yes", { defaultValue: "Да" }) : t("common.no", { defaultValue: "Нет" })}
                </div>
              ) : null}
              <div style={{ opacity: 0.7 }}>
                Пересдача: {Number(test.attemptLimit || 1) > 1 ? `до ${test.attemptLimit} попыток` : "выключена"}
              </div>
              <div style={{ opacity: 0.7 }}>Вопросов: {test.questionCount || 0}</div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {isTeacher && "isPublished" in test && !isStudentPreview ? (
                <>
                  <button onClick={() => togglePublish(test)} disabled={publishingId === test.id} style={{ padding: 10, cursor: "pointer" }}>
                    {publishingId === test.id ? t("common.loading") : test.isPublished ? t("tests.unpublish") : t("tests.publish")}
                  </button>
                  <button onClick={() => openQuestions(test.id)} style={{ padding: 10, cursor: "pointer" }}>
                    {t("tests.questions")}
                  </button>
                  <button onClick={() => openAttempts(test.id)} style={{ padding: 10, cursor: "pointer" }}>
                    {t("tests.attempts")}
                  </button>
                  <ActionButton tone="success" onClick={() => openInspection(test.id)} className="min-w-[230px]">
                    Проверить как студент
                  </ActionButton>
                  <button onClick={() => duplicateTest(test.id)} style={{ padding: 10, cursor: "pointer" }}>
                    Дублировать
                  </button>
                </>
              ) : null}

              {isStudentPreview ? (
                <ActionButton tone="success" onClick={() => openInspection(test.id)} className="min-w-[250px]">
                  Открыть просмотр с ответами
                </ActionButton>
              ) : null}

              {isStudent && (!("isPublished" in test) || test.isPublished) ? (
                <>
                  {canRequestExtraAttempt(test) ? (
                    <button onClick={() => requestExtraAttempt(test)} style={{ padding: 10, cursor: "pointer" }}>
                      Подать запрос на прохождение
                    </button>
                  ) : null}
                  <button
                    onClick={() => setStartConfirmTest(test)}
                    disabled={startingId === test.id || (isStartBlocked(test) && !test.activeAttemptId)}
                    title={isStartBlocked(test) && !test.activeAttemptId ? test.startBlockedReason || "\u0422\u0435\u0441\u0442 \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d." : ""}
                    style={{ padding: 10, cursor: isStartBlocked(test) && !test.activeAttemptId ? "not-allowed" : "pointer", opacity: isStartBlocked(test) && !test.activeAttemptId ? 0.6 : 1 }}
                  >
                    {startingId === test.id ? t("common.loading") : test.activeAttemptId ? "\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c" : t("tests.start")}
                  </button>
                  {isStartBlocked(test) && test.startBlockedReason ? (
                    <div style={{ maxWidth: 240, fontSize: 12, color: "#d97706" }}>{decodeBrokenText(test.startBlockedReason)}</div>
                  ) : null}
                  <button onClick={() => { setMyTestId(test.id); setMyOpen(true); }} style={{ padding: 10, cursor: "pointer" }}>
                    {t("tests.myResults")}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}

        {visibleItems.length === 0 && !error ? <div style={{ opacity: 0.7 }}>{t("common.empty")}</div> : null}
      </div>

      {isTeacher ? (
        <Modal open={isCreateOpen} title={t("tests.create")} onClose={() => setIsCreateOpen(false)}>
          <form onSubmit={createTest} style={{ display: "grid", gap: 10 }}>
            <label>
              {t("tests.titleLabel")}
              <input
                style={{ width: "100%", padding: 10, marginTop: 6 }}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("tests.titlePlaceholder")}
              />
            </label>

            <label>
              Дата открытия теста
              <input
                type="datetime-local"
                style={{ width: "100%", padding: 10, marginTop: 6 }}
                value={newAvailableFrom}
                onChange={(e) => setNewAvailableFrom(e.target.value)}
              />
            </label>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Оставьте поле пустым, если тест должен открыться сразу после публикации.</div>

            {createError ? (
              <div style={{ color: "crimson", background: "#ffecec", padding: 10, borderRadius: 10 }}>
                {createError}
              </div>
            ) : null}

            <button disabled={creating} style={{ padding: 10, cursor: "pointer" }}>
              {creating ? t("common.loading") : t("common.save")}
            </button>
          </form>
        </Modal>
      ) : null}

      {isTeacher ? (
        <Modal
          open={!!publishDialogTest}
          title="Публикация теста"
          onClose={() => {
            setPublishDialogTest(null);
            setPublishMode("now");
            setPublishAvailableFrom("");
            setPublishError("");
          }}
        >
          <div style={{ display: "grid", gap: 12 }}>
            {publishError ? <div style={{ color: "crimson" }}>{publishError}</div> : null}
            <label style={{ display: "flex", gap: 10, padding: 12, border: "1px solid #d1d5db", borderRadius: 12 }}>
              <input type="radio" name="publish-mode" checked={publishMode === "now"} onChange={() => setPublishMode("now")} />
              <div>
                <div style={{ fontWeight: 700 }}>Открыть сейчас</div>
                <div style={{ opacity: 0.75, fontSize: 13 }}>Тест станет доступен студентам сразу после публикации.</div>
              </div>
            </label>
            <label style={{ display: "flex", gap: 10, padding: 12, border: "1px solid #d1d5db", borderRadius: 12 }}>
              <input type="radio" name="publish-mode" checked={publishMode === "scheduled"} onChange={() => setPublishMode("scheduled")} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>Открыть по дате</div>
                <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 8 }}>Студенты увидят тест только в указанное время.</div>
                <input
                  type="datetime-local"
                  style={{ width: "100%", padding: 10, opacity: publishMode === "scheduled" ? 1 : 0.6 }}
                  value={publishAvailableFrom}
                  onChange={(e) => setPublishAvailableFrom(e.target.value)}
                  disabled={publishMode !== "scheduled"}
                />
              </div>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={() => setPublishDialogTest(null)} style={{ padding: 10, cursor: "pointer" }}>
                Отмена
              </button>
              <button type="button" onClick={confirmPublishTest} disabled={publishingId === publishDialogTest?.id} style={{ padding: 10, cursor: "pointer" }}>
                {publishingId === publishDialogTest?.id ? t("common.loading") : "Опубликовать"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {isTeacher ? (
        <TestQuestionsModal
          testId={activeTestId}
          open={questionsOpen}
          onClose={() => {
            setQuestionsOpen(false);
            setActiveTestId(null);
          }}
        />
      ) : null}

      {isTeacher ? (
        <Modal
          open={attemptsOpen}
          title={`${t("tests.attempts")} (ID: ${attemptsTestId})`}
          onClose={() => {
            setAttemptsOpen(false);
            setAttemptsTestId(null);
            setAttempts([]);
            setAttemptsErr("");
          }}
        >
          {attemptsErr ? <div style={{ color: "crimson" }}>{attemptsErr}</div> : null}
          {attempts.length === 0 && !attemptsErr ? <div style={{ opacity: 0.7 }}>{t("tests.noAttempts")}</div> : null}

          {attempts.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {attempts.map((attempt) => (
                <div
                  key={attempt.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{attempt.student?.fullName || attempt.student?.email || `Попытка #${attempt.id}`}</div>
                    <div style={{ opacity: 0.75 }}>
                      Балл: {attempt.score ?? 0}/{attempt.maxScore ?? 0}
                    </div>
                    <div style={{ opacity: 0.75 }}>
                      Статус: {attempt.finishedAt ? "завершена" : "в процессе"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => navigate(`/tests/${attempt.testId || attemptsTestId}/attempts/${attempt.id}`)} style={{ padding: 10, cursor: "pointer" }}>
                      Открыть
                    </button>
                    <button onClick={() => openReview(attempt.id)} style={{ padding: 10, cursor: "pointer" }}>
                      Проверка
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Modal>
      ) : null}

      <AttemptReviewModal
        attemptId={reviewAttemptId}
        open={reviewOpen}
        onClose={() => {
          setReviewOpen(false);
          setReviewAttemptId(null);
        }}
        onSaved={async () => {
          await load();
          if (attemptsTestId) {
            await openAttempts(attemptsTestId);
          }
        }}
      />

      <MyAttemptsModal
        testId={myTestId}
        open={myOpen}
        onClose={() => {
          setMyOpen(false);
          setMyTestId(null);
        }}
      />

      <ConfirmDialog
        open={!!startConfirmTest}
        title="Начать тест"
        message={
          startConfirmTest
            ? `Вы собираетесь начать тест "${startConfirmTest.title}". После старта сразу откроется попытка, а таймер начнет отсчет. Продолжить?`
            : ""
        }
        tone="primary"
        confirmLabel="Начать тест"
        cancelLabel="Пока нет"
        busy={startingId === startConfirmTest?.id}
        onCancel={() => setStartConfirmTest(null)}
        onConfirm={confirmStartTest}
      />
    </div>
  );
}
