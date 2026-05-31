import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http";
import { getUser } from "../auth/token";
import ActionButton from "../components/ui/ActionButton";
import ConfirmDialog from "../components/ConfirmDialog";
import { createAttemptAnswer, TYPE_LABELS } from "../utils/testDesigner";
import { decodeBrokenText, sanitizeDomText } from "../utils/textEncoding";

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTimeSafe(value) {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  return new Date(timestamp).toLocaleString();
}

function inputClassName() {
  return "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 theme-surface-button theme-readable-strong";
}

function buildAbsoluteUrl(url) {
  if (!url) return "";
  try {
    return new URL(url, http.defaults.baseURL).toString();
  } catch {
    return url;
  }
}

function isStoredAttachment(file) {
  return !!file?.relativePath && !!file?.url;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: String(reader.result || ""),
      });
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

function moveArrayItem(items, fromIndex, toIndex) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function isQuestionAnswered(question, answer) {
  if (!answer) return false;

  if (question.type === "SINGLE" || question.type === "MULTI") {
    return Array.isArray(answer.optionIds) && answer.optionIds.length > 0;
  }

  if (question.type === "OPEN") {
    return (
      String(answer.response?.value || answer.textAnswer || "").trim().length > 0 ||
      (Array.isArray(answer.attachments) && answer.attachments.length > 0)
    );
  }

  if (["KEYWORD", "FORMULA", "CODE", "SQL"].includes(question.type)) {
    return String(answer.response?.value || answer.textAnswer || "").trim().length > 0;
  }

  if (question.type === "ORDER") {
    return Array.isArray(answer.response?.items) && answer.response.items.length > 0;
  }

  if (question.type === "MATCH") {
    return Object.values(answer.response?.pairs || {}).some(Boolean);
  }

  if (question.type === "CATEGORY") {
    return Object.keys(answer.response?.mapping || {}).length > 0;
  }

  if (question.type === "TABLE") {
    return Object.values(answer.response?.cells || {}).some((row) => Object.values(row || {}).some((cell) => String(cell || "").trim().length > 0));
  }

  return false;
}

function buildAnswerPayload(question, answer) {
  if (!question || !answer) return null;
  return {
    questionId: question.id,
    optionIds: Array.isArray(answer.optionIds) ? answer.optionIds : [],
    textAnswer: String(answer.textAnswer || answer.response?.value || ""),
    response: answer.response || {},
    attachments: question.type === "OPEN" ? (Array.isArray(answer.attachments) ? answer.attachments : []) : [],
  };
}

function getInspectAnswerLines(question) {
  const config = question?.config || {};
  const options = question?.options || [];

  if (question.type === "SINGLE" || question.type === "MULTI") {
    return options.filter((option) => option.isCorrect).map((option) => option.text);
  }

  if (question.type === "OPEN") {
    return [config.prompt || "Открытый вопрос проверяется преподавателем вручную."];
  }

  if (question.type === "ORDER") {
    return (config.items || []).map((item, index) => `${index + 1}. ${item}`);
  }

  if (question.type === "MATCH") {
    return (config.pairs || []).map((pair) => `${pair.left} -> ${pair.right}`);
  }

  if (question.type === "CATEGORY") {
    return (config.categories || []).flatMap((category) => (category.items || []).map((item) => `${item} -> ${category.name}`));
  }

  if (question.type === "KEYWORD" || question.type === "FORMULA") {
    return (config.answers || []).filter(Boolean);
  }

  if (question.type === "TABLE") {
    const rows = config.rows || [];
    const columns = config.columns || [];
    const cells = config.answers || {};
    return rows.flatMap((row) =>
      columns.map((column) => `${row.label || "Строка"} / ${column.label || "Столбец"}: ${cells?.[row.key]?.[column.key] || "—"}`)
    );
  }

  if (question.type === "CODE" || question.type === "SQL") {
    return [
      ...(config.expectedKeywords || []).filter(Boolean).map((keyword) => `Ожидается: ${keyword}`),
      ...(config.forbiddenKeywords || []).filter(Boolean).map((keyword) => `Запрещено: ${keyword}`),
    ];
  }

  return [];
}

function OptionCard({ selected, multi, text, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
        selected
          ? "border-blue-400 bg-blue-50 text-blue-900"
          : "border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50/40"
      } theme-surface-button theme-readable-strong disabled:cursor-not-allowed disabled:opacity-70`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-black ${
            selected ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 text-slate-400"
          }`}
        >
          {selected ? (multi ? "✓" : "●") : ""}
        </div>
        <span className="text-sm leading-6">{decodeBrokenText(text)}</span>
      </div>
    </button>
  );
}

function QuestionRenderer({ question, answer, onChange, disabled }) {
  const config = question.config || {};
  const orderDragIndexRef = useRef(null);

  if (question.type === "SINGLE" || question.type === "MULTI") {
    const multi = question.type === "MULTI";
    return (
      <div className="grid gap-4">
        {(question.options || []).map((option) => {
          const selected = (answer.optionIds || []).includes(option.id);
          return (
            <OptionCard
              key={option.id}
              selected={selected}
              multi={multi}
              text={option.text}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                if (multi) {
                  onChange({
                    ...answer,
                    optionIds: selected
                      ? (answer.optionIds || []).filter((optionId) => optionId !== option.id)
                      : [...(answer.optionIds || []), option.id],
                  });
                } else {
                  onChange({ ...answer, optionIds: [option.id] });
                }
              }}
            />
          );
        })}
      </div>
    );
  }

  if (question.type === "OPEN") {
    const attachments = Array.isArray(answer.attachments) ? answer.attachments : [];
    async function handleFilesSelected(event) {
      const files = Array.from(event.target.files || []);
      event.target.value = "";
      if (disabled || !files.length) return;
      const prepared = await Promise.all(files.map(readFileAsDataUrl));
      onChange({
        ...answer,
        attachments: [...attachments, ...prepared].slice(0, 8),
      });
    }

    return (
      <div className="space-y-4">
        {config.prompt ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 theme-surface-inset theme-readable-soft">
            {decodeBrokenText(config.prompt)}
          </div>
        ) : null}
        <textarea
          rows={5}
          className={`${inputClassName()} font-medium`}
          value={answer.response?.value ?? answer.textAnswer ?? ""}
          disabled={disabled}
          placeholder={decodeBrokenText(config.placeholder || "Введите ответ")}
          onChange={(event) =>
            onChange({
              ...answer,
              textAnswer: event.target.value,
              response: { ...answer.response, value: event.target.value },
            })
          }
        />

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 theme-surface-inset">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900 theme-readable-strong">Файлы к открытому ответу</div>
              <div className="mt-1 text-xs text-slate-500 theme-readable-muted">До 8 файлов. Их увидит преподаватель при ручной проверке.</div>
            </div>
            <label className={`inline-flex cursor-pointer items-center rounded-2xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
              Прикрепить
              <input type="file" multiple className="hidden" disabled={disabled || attachments.length >= 8} onChange={handleFilesSelected} />
            </label>
          </div>

          {attachments.length ? (
            <div className="mt-4 grid gap-3">
              {attachments.map((file, index) => (
                <div key={`${file.relativePath || file.originalName || "file"}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 theme-surface-button">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900 theme-readable-strong">{decodeBrokenText(file.originalName || `Файл ${index + 1}`)}</div>
                    <div className="text-xs text-slate-500 theme-readable-muted">
                      {file.size ? `${Math.max(1, Math.round(file.size / 1024))} КБ` : "Файл"}
                      {isStoredAttachment(file) ? " • уже сохранён" : " • будет загружен при сохранении"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isStoredAttachment(file) ? (
                      <a
                        href={buildAbsoluteUrl(file.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                      >
                        Скачать
                      </a>
                    ) : null}
                    <ActionButton
                      tone="secondary"
                      className="px-3 py-2 text-xs"
                      disabled={disabled}
                      onClick={() =>
                        onChange({
                          ...answer,
                          attachments: attachments.filter((_, attachmentIndex) => attachmentIndex !== index),
                        })
                      }
                    >
                      Убрать
                    </ActionButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500 theme-surface-button theme-readable-muted">
              Пока без вложений.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (["KEYWORD", "FORMULA", "CODE", "SQL"].includes(question.type)) {
    return (
      <div className="space-y-3">
        {config.prompt ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 theme-surface-inset theme-readable-soft">
            {decodeBrokenText(config.prompt)}
          </div>
        ) : null}
        <textarea
          rows={question.type === "CODE" || question.type === "SQL" ? 10 : 5}
          className={`${inputClassName()} font-medium ${question.type === "CODE" || question.type === "SQL" ? "font-mono" : ""}`}
          value={answer.response?.value ?? answer.textAnswer ?? ""}
          disabled={disabled}
          placeholder={decodeBrokenText(config.placeholder || "Введите ответ")}
          onChange={(event) =>
            onChange({
              ...answer,
              textAnswer: event.target.value,
              response: { ...answer.response, value: event.target.value },
            })
          }
        />
      </div>
    );
  }

  if (question.type === "ORDER") {
    const items = answer.response?.items || [...(config.items || [])];
    const updateOrderItems = (nextItems) =>
      onChange({
        ...answer,
        response: {
          ...answer.response,
          items: nextItems,
        },
      });
    return (
      <div className="space-y-3">
        {config.prompt ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 theme-surface-inset theme-readable-soft">
            {decodeBrokenText(config.prompt)}
          </div>
        ) : null}
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            draggable={!disabled}
            onDragStart={() => {
              orderDragIndexRef.current = index;
            }}
            onDragOver={(event) => {
              if (disabled) return;
              event.preventDefault();
              const fromIndex = orderDragIndexRef.current;
              if (fromIndex == null || fromIndex === index) return;
              orderDragIndexRef.current = index;
              updateOrderItems(moveArrayItem(items, fromIndex, index));
            }}
            onDragEnd={() => {
              orderDragIndexRef.current = null;
            }}
            onDrop={(event) => {
              event.preventDefault();
              orderDragIndexRef.current = null;
            }}
            className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition ${
              disabled ? "" : "cursor-grab active:cursor-grabbing"
            } theme-surface-button`}
          >
            <div className="min-w-[32px] rounded-full bg-slate-100 px-2 py-1 text-center text-xs font-black text-slate-700">{index + 1}</div>
            <div className="select-none text-slate-400" aria-hidden="true">
              ⋮⋮
            </div>
            <div className="min-w-0 flex-1 text-sm font-medium text-slate-800 theme-readable-strong">{decodeBrokenText(item)}</div>
            <div className="flex gap-2">
              <ActionButton
                tone="secondary"
                className="px-3 py-2 text-xs"
                disabled={disabled || index === 0}
                onClick={() => updateOrderItems(moveArrayItem(items, index, index - 1))}
              >
                Вверх
              </ActionButton>
              <ActionButton
                tone="secondary"
                className="px-3 py-2 text-xs"
                disabled={disabled || index === items.length - 1}
                onClick={() => updateOrderItems(moveArrayItem(items, index, index + 1))}
              >
                Вниз
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "MATCH") {
    const pairs = answer.response?.pairs || {};
    const leftItems = config.leftItems || (config.pairs || []).map((pair) => pair.left);
    const rightItems = config.rightItems || (config.pairs || []).map((pair) => pair.right);
    return (
      <div className="space-y-3">
        {config.prompt ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 theme-surface-inset theme-readable-soft">
            {decodeBrokenText(config.prompt)}
          </div>
        ) : null}
        {leftItems.map((leftItem) => (
          <div key={leftItem} className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 theme-surface-button theme-readable-strong">
              {decodeBrokenText(leftItem)}
            </div>
            <select
              className={inputClassName()}
              value={pairs[leftItem] || ""}
              disabled={disabled}
              onChange={(event) => onChange({ ...answer, response: { pairs: { ...pairs, [leftItem]: event.target.value } } })}
            >
              <option value="">Выберите соответствие</option>
              {rightItems.map((rightItem) => (
                <option key={`${leftItem}-${rightItem}`} value={rightItem}>
                  {decodeBrokenText(rightItem)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "CATEGORY") {
    const mapping = answer.response?.mapping || {};
    const categories = config.categories || [];
    const items = config.items || categories.flatMap((category) => (category.items || []).map((item) => ({ id: item, label: item })));
    return (
      <div className="space-y-3">
        {config.prompt ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 theme-surface-inset theme-readable-soft">
            {decodeBrokenText(config.prompt)}
          </div>
        ) : null}
        {items.map((item) => (
          <div key={item.id || item.label} className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 theme-surface-button theme-readable-strong">
              {decodeBrokenText(item.label)}
            </div>
            <select
              className={inputClassName()}
              value={mapping[item.id || item.label] || ""}
              disabled={disabled}
              onChange={(event) => onChange({ ...answer, response: { mapping: { ...mapping, [item.id || item.label]: event.target.value } } })}
            >
              <option value="">Выберите категорию</option>
              {categories.map((category) => (
                <option key={`${item.id || item.label}-${category.name}`} value={category.name}>
                  {decodeBrokenText(category.name)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "TABLE") {
    const rows = config.rows || [];
    const columns = config.columns || [];
    const cells = answer.response?.cells || {};
    return (
      <div className="space-y-3">
        {config.prompt ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 theme-surface-inset theme-readable-soft">
            {decodeBrokenText(config.prompt)}
          </div>
        ) : null}
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white p-4 theme-surface-panel">
          <table className="min-w-full border-separate border-spacing-3">
            <thead>
              <tr>
                <th className="min-w-[180px] rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-bold text-slate-700">Строка</th>
                {columns.map((column) => (
                  <th key={column.key} className="min-w-[180px] rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-bold text-slate-700">
                    {decodeBrokenText(column.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 theme-surface-inset theme-readable-strong">
                    {decodeBrokenText(row.label)}
                  </td>
                  {columns.map((column) => (
                    <td key={`${row.key}-${column.key}`}>
                      <input
                        className={inputClassName()}
                        disabled={disabled}
                        value={cells?.[row.key]?.[column.key] || ""}
                        placeholder={decodeBrokenText(config.placeholder || "Введите значение")}
                        onChange={(event) =>
                          onChange({
                            ...answer,
                            response: {
                              cells: {
                                ...cells,
                                [row.key]: {
                                  ...(cells[row.key] || {}),
                                  [column.key]: event.target.value,
                                },
                              },
                            },
                          })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
}

function FeedbackPanel({ feedbackItem }) {
  if (!feedbackItem) return null;
  return (
    <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 theme-surface-inset">
      <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 theme-readable-muted">Разбор результата</div>
      <div className="mt-2 text-sm font-semibold text-slate-900 theme-readable-strong">
        {decodeBrokenText(feedbackItem.reason || "Ответ проверен.")}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-blue-200 bg-white px-3 py-1 font-semibold text-blue-700">
          Баллы: {feedbackItem.score}/{feedbackItem.maxScore}
        </span>
        {feedbackItem.pendingReview ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-800">Требуется ручная проверка</span>
        ) : null}
      </div>

      {Array.isArray(feedbackItem.details) && feedbackItem.details.length ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600 theme-surface-button theme-readable-soft">
          {feedbackItem.details.map((detail, index) => (
            <div key={`${feedbackItem.questionId}-detail-${index}`}>{decodeBrokenText(typeof detail === "string" ? detail : JSON.stringify(detail))}</div>
          ))}
        </div>
      ) : null}

      {feedbackItem.answer?.text ? (
        <div className="mt-3 text-sm text-slate-600 theme-readable-soft">
          <span className="font-semibold text-slate-800 theme-readable-strong">Ваш ответ:</span> {decodeBrokenText(feedbackItem.answer.text)}
        </div>
      ) : null}

      {feedbackItem.reviewComment ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Комментарий преподавателя:</span> {decodeBrokenText(feedbackItem.reviewComment)}
        </div>
      ) : null}
    </div>
  );
}

function CorrectAnswerPanel({ question }) {
  const lines = getInspectAnswerLines(question);

  return (
    <div className="test-attempt-success-panel mt-4 rounded-[24px] border p-4 shadow-[0_0_24px_rgba(74,222,128,0.1)]">
      <div className="test-attempt-success-kicker text-xs font-bold uppercase tracking-[0.16em]">Правильный ответ</div>
      {lines.length ? (
        <div className="mt-3 grid gap-2">
          {lines.map((line, index) => (
            <div key={`${question.id}-correct-${index}`} className="test-attempt-success-chip rounded-2xl border px-3 py-2 text-sm font-medium">
              {decodeBrokenText(line)}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-sm leading-6">Для этого типа вопроса преподавательская подсказка с эталонным ответом не задана.</div>
      )}
    </div>
  );
}

export default function TestAttemptPage() {
  const { testId, attemptId } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const isInspectMode = !attemptId;
  const canInspect = user?.role === "TEACHER" || user?.role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [test, setTest] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [dirtyMap, setDirtyMap] = useState({});
  const [savingNow, setSavingNow] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [activityMessage, setActivityMessage] = useState("");
  const [tabWarningOpen, setTabWarningOpen] = useState(false);
  const [tabWarningText, setTabWarningText] = useState("");
  const [nowTs, setNowTs] = useState(Date.now());
  const [inspectStartedAt, setInspectStartedAt] = useState(Date.now());
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);

  const answersRef = useRef({});
  const dirtyRef = useRef({});
  const saveInFlightRef = useRef(false);
  const activityBusyRef = useRef(false);
  const rootRef = useRef(null);

  const questions = useMemo(() => test?.questions || [], [test]);
  const feedbackByQuestion = useMemo(
    () => Object.fromEntries((feedback?.questions || []).map((item) => [item.questionId, item])),
    [feedback]
  );

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    sanitizeDomText(rootRef.current);
  }, [loading, error, activityMessage, test, attempt, result, feedback, answers, tabWarningOpen, tabWarningText]);

  useEffect(() => {
    dirtyRef.current = dirtyMap;
  }, [dirtyMap]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        if (isInspectMode) {
          if (!canInspect) {
            throw new Error("У вас нет доступа к осмотру теста.");
          }
          const testRes = await http.get(`/tests/${testId}`);
          if (!mounted) return;

          const nextTest = testRes.data?.test || null;
          const hydratedAnswers = Object.fromEntries((nextTest?.questions || []).map((question) => [question.id, createAttemptAnswer(question)]));

          setTest(nextTest);
          setAttempt({
            id: `inspect-${testId}`,
            startedAt: new Date().toISOString(),
            expiresAt: null,
            tabSwitchCount: 0,
            finishedAt: null,
          });
          setAnswers(hydratedAnswers);
          setDirtyMap({});
          setResult(null);
          setFeedback(null);
          setInspectStartedAt(Date.now());
          setActivityMessage("Режим осмотра включён: правильные ответы видны сразу, ограничения по времени и переключениям не действуют.");
          return;
        }

        const [testRes, stateRes] = await Promise.all([http.get(`/tests/${testId}`), http.get(`/attempts/${attemptId}/state`)]);
        if (!mounted) return;

        const nextTest = testRes.data?.test || null;
        const nextAttempt = stateRes.data?.attempt || null;
        const savedAnswers = stateRes.data?.answers || {};
        const hydratedAnswers = Object.fromEntries(
          (nextTest?.questions || []).map((question) => [question.id, createAttemptAnswer(question, savedAnswers[question.id])])
        );

        setTest(nextTest);
        setAttempt(nextAttempt);
        setAnswers(hydratedAnswers);
        setDirtyMap({});
        setFeedback(stateRes.data?.feedback || null);
        if (nextAttempt?.finishedAt) {
          setResult(nextAttempt);
        }
        if (stateRes.data?.autoFinished) {
          setActivityMessage("Время попытки истекло, тест завершён автоматически.");
        }
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.error || err.message || "Не удалось загрузить состояние теста.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [attemptId, canInspect, isInspectMode, testId]);

  const remainingMs = useMemo(() => {
    if (isInspectMode) return Math.max(0, nowTs - inspectStartedAt);
    if (!attempt?.expiresAt || result?.finishedAt) return null;
    const expiresAtTs = new Date(attempt.expiresAt).getTime();
    if (!Number.isFinite(expiresAtTs)) return null;
    return Math.max(0, expiresAtTs - nowTs);
  }, [attempt, inspectStartedAt, isInspectMode, result, nowTs]);

  const answeredCount = useMemo(() => questions.filter((question) => isQuestionAnswered(question, answers[question.id])).length, [questions, answers]);

  async function saveQuestion(questionId) {
    const question = questions.find((candidate) => candidate.id === questionId);
    const answer = answersRef.current[questionId];
    const payload = buildAnswerPayload(question, answer);
    if (!payload) return;
    await http.post(`/attempts/${attemptId}/answer`, payload);
  }

  async function saveDirtyAnswers() {
    const ids = Object.keys(dirtyRef.current)
      .filter((key) => dirtyRef.current[key])
      .map(Number)
      .filter((id) => Number.isInteger(id));
    if (isInspectMode || !ids.length || saveInFlightRef.current || result?.finishedAt) return;

    saveInFlightRef.current = true;
    setSavingNow(true);

    try {
      for (const questionId of ids) {
        await saveQuestion(questionId);
      }
      setDirtyMap((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          delete next[id];
        });
        return next;
      });
    } catch (err) {
      if (err?.response?.data?.autoFinished && err?.response?.data?.attempt) {
        setResult(err.response.data.attempt);
        setAttempt(err.response.data.attempt);
        setFeedback(err.response.data.feedback || null);
          setActivityMessage("Тест завершён автоматически, потому что время истекло.");
      } else {
        setError(err?.response?.data?.error || err.message || "Не удалось сохранить ответы.");
      }
    } finally {
      saveInFlightRef.current = false;
      setSavingNow(false);
    }
  }

  useEffect(() => {
    if (isInspectMode) return undefined;
    if (result?.finishedAt) return undefined;
    const dirtyCount = Object.keys(dirtyMap).length;
    if (!dirtyCount) return undefined;
    const timer = setTimeout(() => {
      saveDirtyAnswers();
    }, 900);
    return () => clearTimeout(timer);
  }, [dirtyMap, isInspectMode, result]);

  useEffect(() => {
    if (isInspectMode) {
      const timer = setInterval(() => {
        setNowTs(Date.now());
      }, 1000);
      return () => clearInterval(timer);
    }
    if (result?.finishedAt || !attempt?.expiresAt) return undefined;
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt, isInspectMode, result]);

  useEffect(() => {
    if (isInspectMode) return;
    if (result?.finishedAt || remainingMs == null || remainingMs > 0 || finishBusy) return;
    finishAttempt(true);
  }, [finishBusy, isInspectMode, remainingMs, result]);

  useEffect(() => {
    if (isInspectMode) return undefined;
    if (!attempt || result?.finishedAt) return undefined;

    async function handleVisibilityChange() {
      if (document.visibilityState !== "hidden" || activityBusyRef.current) return;
      activityBusyRef.current = true;
      try {
        const res = await http.post(`/attempts/${attempt.id}/activity`, { type: "TAB_SWITCH" });
        const nextAttempt = res.data?.attempt || null;
        if (nextAttempt) setAttempt(nextAttempt);
        if (res.data?.autoFinished && nextAttempt) {
          setResult(nextAttempt);
          setFeedback(res.data?.feedback || null);
          setActivityMessage("Попытка завершена автоматически из-за превышения лимита переключений вкладки.");
        } else if (nextAttempt) {
          setActivityMessage(
            `Зафиксировано переключение вкладки. Использовано ${nextAttempt.tabSwitchCount} из ${test?.tabSwitchLimit || 3}.`
          );
          setTabWarningText("Во время теста нельзя переключаться между вкладками. Закройте предупреждение и продолжайте только после возвращения к тесту.");
          setTabWarningOpen(true);
        }
      } catch (err) {
        setError(err?.response?.data?.error || err.message || "Не удалось зафиксировать переключение вкладки.");
      } finally {
        activityBusyRef.current = false;
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [attempt, isInspectMode, result, test]);

  useEffect(() => {
    const storageKey = "lms-active-test";
    if (isInspectMode || result?.finishedAt || !attempt) {
      localStorage.removeItem(storageKey);
      window.dispatchEvent(new CustomEvent("lms-active-test-changed"));
      return;
    }

    const reminder = {
      attemptId: attempt.id,
      testId,
      title: test?.title || "Тест",
      remaining: remainingMs == null ? "Без лимита" : formatRemaining(remainingMs),
      answeredCount,
    };
    localStorage.setItem(storageKey, JSON.stringify(reminder));
    window.dispatchEvent(new CustomEvent("lms-active-test-changed"));
  }, [answeredCount, attempt, isInspectMode, remainingMs, result, test, testId]);

  function patchAnswer(questionId, nextAnswer) {
    setAnswers((prev) => ({ ...prev, [questionId]: nextAnswer }));
    if (!isInspectMode) {
      setDirtyMap((prev) => ({ ...prev, [questionId]: true }));
    }
  }

  async function finishAttempt(auto = false) {
    if (isInspectMode) return;
    if (finishBusy || result?.finishedAt) return;

    setFinishBusy(true);
    setError("");
    try {
      await saveDirtyAnswers();
      const res = await http.post(`/attempts/${attemptId}/finish`);
      const finalized = res.data?.attempt || null;
      setResult(finalized);
      setAttempt(finalized);
      setFeedback(res.data?.feedback || null);
      if (auto) {
        setActivityMessage("Тест завершён автоматически.");
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось завершить тест.");
    } finally {
      setFinishBusy(false);
    }
  }

  function requestBack() {
    if (isInspectMode || result?.finishedAt) {
      navigate(-1);
      return;
    }
    setCloseConfirmOpen(true);
  }

  async function confirmFinishAttempt() {
    setFinishConfirmOpen(false);
    await finishAttempt(false);
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[1680px] items-center justify-center px-4 py-8">
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 text-sm font-semibold text-slate-600 shadow-sm theme-surface-panel">
          Подготавливаем тест...
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="test-attempt-page mx-auto w-full max-w-[1780px] space-y-6 px-2 py-3 lg:px-4">
      {tabWarningOpen ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-[2px]">
          <div className="test-attempt-tab-warning w-full max-w-3xl rounded-[28px] border p-5 shadow-[0_24px_60px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em]">Предупреждение</div>
                <div className="mt-3 text-2xl font-black">Нельзя переключаться между вкладками</div>
                <div className="mt-3 text-base leading-7">{tabWarningText}</div>
              </div>
              <button
                type="button"
                onClick={() => setTabWarningOpen(false)}
                className="rounded-2xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/16"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ActionButton tone="secondary" className="relative z-10" onClick={requestBack}>
        Назад
      </ActionButton>

      {error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-700">{decodeBrokenText(error)}</div> : null}
      {activityMessage ? <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-800">{decodeBrokenText(activityMessage)}</div> : null}

      {isInspectMode ? (
        <div className="test-attempt-success-panel rounded-3xl border p-4">
          Режим осмотра: преподаватель или администратор видит структуру теста, правильные ответы и состояние экранов без ограничения по времени.
        </div>
      ) : null}

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm theme-surface-panel">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-4xl">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Тест</div>
            <h1 className="mt-2 text-3xl font-black text-slate-950 theme-readable-strong">{decodeBrokenText(test?.title || "Тест")}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 theme-readable-soft">
              {decodeBrokenText(test?.instructions || "Сохраняйте ответы по мере прохождения и завершите тест только после проверки всех вопросов.")}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Отвечено</div>
              <div className="mt-2 text-3xl font-black text-slate-950">
                {answeredCount}/{questions.length}
              </div>
            </div>
            <div className="rounded-[24px] border border-violet-200 bg-violet-50 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Время</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{remainingMs == null ? "Без лимита" : formatRemaining(remainingMs)}</div>
            </div>
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Переключения</div>
              <div className="mt-2 text-3xl font-black text-slate-950">
                {isInspectMode ? "Без лимита" : `${attempt?.tabSwitchCount || 0}/${test?.tabSwitchLimit || 0 ? test?.tabSwitchLimit : "∞"}`}
              </div>
            </div>
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Баллы</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{result?.score ?? 0}</div>
            </div>
          </div>
        </div>

        {result?.finishedAt ? (
          <div className="test-attempt-success-panel mt-6 rounded-[24px] border p-5">
            <div className="text-sm font-bold uppercase tracking-[0.16em]">Итог</div>
            <div className="mt-2 text-3xl font-black">
              {result.score}/{result.maxScore}
            </div>
            <div className="mt-2 text-sm">
              Тест {result.autoSubmittedAt ? "завершён автоматически" : "завершён вручную"}
              {formatDateTimeSafe(result.finishedAt) ? ` · ${formatDateTimeSafe(result.finishedAt)}` : ""}.
            </div>
            {feedback?.summary ? (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="test-attempt-success-chip rounded-full border px-3 py-1">Вопросов: {feedback.summary.totalQuestions}</span>
                <span className="rounded-full border border-blue-200 bg-white px-3 py-1">
                  Исправлено вручную: {feedback.summary.manualAdjustedCount}
                </span>
                <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
                  Требуют проверки: {feedback.summary.reviewPendingCount}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm theme-surface-panel xl:sticky xl:top-4 xl:self-start">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 theme-readable-muted">Навигация по тесту</div>
            <div className="mt-2 text-sm text-slate-600 theme-readable-soft">Можно переходить между вопросами в любом порядке. Автосохранение следит за изменениями.</div>
          </div>

          <div className="grid gap-2">
            {questions.map((question, index) => {
              const answered = isQuestionAnswered(question, answers[question.id]);
              return (
                <a
                  key={question.id}
                  href={`#question-${question.id}`}
                  className={`rounded-2xl border px-3 py-3 text-sm transition ${
                    answered ? "test-attempt-nav-answered" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                  } theme-surface-inset theme-readable-strong`}
                >
                  <div className="font-bold">
                    {index + 1}. {TYPE_LABELS[question.type] || question.type}
                  </div>
                  <div className="mt-1 text-xs opacity-80">{answered ? "Есть ответ" : "Пока пусто"}</div>
                </a>
              );
            })}
          </div>

          <div className="grid gap-2 pt-2">
            {isInspectMode ? (
              <ActionButton
                tone="secondary"
                onClick={() => {
                  const resetAnswers = Object.fromEntries(questions.map((question) => [question.id, createAttemptAnswer(question)]));
                  setAnswers(resetAnswers);
                  setInspectStartedAt(Date.now());
                  setNowTs(Date.now());
                }}
              >
                Сбросить ответы
              </ActionButton>
            ) : (
              <>
                <ActionButton tone="secondary" disabled={savingNow || !Object.keys(dirtyMap).length || !!result?.finishedAt} onClick={saveDirtyAnswers}>
                  {savingNow ? "Сохранение..." : "Сохранить"}
                </ActionButton>
                <ActionButton tone="primary" disabled={finishBusy || !!result?.finishedAt} onClick={() => setFinishConfirmOpen(true)}>
                  {finishBusy ? "Завершение..." : "Завершить"}
                </ActionButton>
              </>
            )}
          </div>
        </aside>

        <section className="space-y-5">
          {questions.map((question, index) => {
            const answer = answers[question.id] || createAttemptAnswer(question);
            return (
              <article key={question.id} id={`question-${question.id}`} className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm theme-surface-panel">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                      Вопрос {index + 1} · {TYPE_LABELS[question.type] || question.type}
                    </div>
                    <h2 className="mt-3 text-2xl font-black text-slate-950 theme-readable-strong">{decodeBrokenText(question.text)}</h2>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 theme-surface-inset theme-readable-strong">
                    {question.points} {question.points === 1 ? "балл" : question.points < 5 ? "балла" : "баллов"}
                  </div>
                </div>

                <div className="mt-5">
                  <QuestionRenderer
                    question={question}
                    answer={answer}
                    disabled={!isInspectMode && !!result?.finishedAt}
                    onChange={(nextAnswer) => patchAnswer(question.id, nextAnswer)}
                  />
                </div>

                {isInspectMode ? <CorrectAnswerPanel question={question} /> : null}
                {result?.finishedAt ? <FeedbackPanel feedbackItem={feedbackByQuestion[question.id]} /> : null}
              </article>
            );
          })}
        </section>
      </div>

      <ConfirmDialog
        open={closeConfirmOpen}
        title="Выйти из теста"
        message="Если вы выйдете сейчас, незавершённая попытка сохранится и её можно будет продолжить позже."
        tone="primary"
        confirmLabel="Выйти из теста"
        cancelLabel="Остаться"
        onCancel={() => setCloseConfirmOpen(false)}
        onConfirm={() => {
          setCloseConfirmOpen(false);
          navigate(-1);
        }}
      />

      <ConfirmDialog
        open={finishConfirmOpen}
        title="Завершить тест"
        message="После завершения попытки вы больше не сможете изменить ответы в этой попытке."
        tone="primary"
        confirmLabel="Завершить"
        cancelLabel="Продолжить работу"
        onCancel={() => setFinishConfirmOpen(false)}
        onConfirm={confirmFinishAttempt}
      />
    </div>
  );
}
