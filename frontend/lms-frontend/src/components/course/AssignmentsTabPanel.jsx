import ActionButton from "../ui/ActionButton";
import FeedbackMessage from "../ui/FeedbackMessage";
import SectionCard from "../ui/SectionCard";
import { http } from "../../api/http";

function formatAttachmentSize(size) {
  const value = Number(size || 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} КБ`;
  return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
}

function resolveAttachmentUrl(file) {
  if (!file?.url) return "#";
  return new URL(file.url, http.defaults.baseURL).toString();
}

export default function AssignmentsTabPanel({
  error,
  items,
  getAssignmentId,
  localSubmissions,
  isStudent,
  isReadOnlyStudentView = false,
  isTeacher,
  inlineDrafts,
  setInlineDrafts,
  inlineFilesById,
  onSelectFiles,
  clearSelectedFiles,
  inlineSubmittingId,
  submitAssignmentInline,
  successFlashId,
  inlineErrorById,
  onDeleteAssignment,
  t,
}) {
  return (
    <SectionCard className="lg:p-6">
      {error ? <FeedbackMessage className="mb-4">{error}</FeedbackMessage> : null}

      <div className="grid gap-3">
        {items.map((assignment) => {
          const assignmentId = getAssignmentId(assignment);
          const submission = assignmentId ? localSubmissions[assignmentId] : null;
          const attachments = submission?.attachments || [];
          const selectedFiles = assignmentId ? inlineFilesById[assignmentId] || [] : [];
          const isLocallySubmitted = Boolean(submission?.submittedAt || attachments.length || submission?.contentText);

          return (
            <div key={assignmentId ?? JSON.stringify(assignment)} className="rounded-2xl border border-slate-300 bg-slate-50/70 p-4 shadow-sm">
              <div className="flex justify-between gap-4">
                <div className="min-w-0">
                  <div className="break-words text-lg font-bold text-slate-900">{assignment.title}</div>
                  {assignment.dueDate ? (
                    <div className="mt-1 text-sm text-slate-500">
                      {t("assignments.due", { defaultValue: "Дедлайн" })}: {new Date(assignment.dueDate).toLocaleString()}
                    </div>
                  ) : null}
                  {isStudent ? (
                    <div className="mt-2 text-sm text-slate-600">
                      {t("assignments.status", { defaultValue: "Статус" })}:{" "}
                      {isReadOnlyStudentView
                        ? "Просмотр без отправки"
                        : isLocallySubmitted
                          ? t("assignments.submitted", { defaultValue: "Сдано" })
                          : t("assignments.notSubmitted", { defaultValue: "Не сдано" })}
                    </div>
                  ) : null}
                </div>

                {isTeacher ? (
                  <ActionButton tone="danger" onClick={() => onDeleteAssignment(assignment)}>
                    Удалить
                  </ActionButton>
                ) : null}
              </div>

              {isStudent ? (
                <div className="mt-4 space-y-4">
                  <textarea
                    value={assignmentId ? inlineDrafts[assignmentId] ?? "" : ""}
                    onChange={(event) => {
                      if (!assignmentId || isReadOnlyStudentView) return;
                      setInlineDrafts((prev) => ({ ...prev, [assignmentId]: event.target.value }));
                    }}
                    disabled={isReadOnlyStudentView || !assignmentId || inlineSubmittingId === assignmentId}
                    rows={4}
                    className="w-full max-w-2xl rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
                    placeholder={isReadOnlyStudentView ? "В режиме просмотра отправка задания отключена." : "Добавьте текстовый ответ, комментарий или пояснение к файлам."}
                  />

                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-slate-700">Файлы к заданию</div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-400 hover:text-blue-600">
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          disabled={isReadOnlyStudentView || !assignmentId || inlineSubmittingId === assignmentId}
                          accept=".doc,.docx,.xls,.xlsx,.txt,.rtf,.png,.jpg,.jpeg,.gif,.webp,.bmp"
                          onChange={(event) => onSelectFiles(assignmentId, Array.from(event.target.files || []))}
                        />
                        Прикрепить файлы
                      </label>
                      {selectedFiles.length ? (
                        <button
                          type="button"
                          className="text-sm font-medium text-slate-500 underline underline-offset-4"
                          onClick={() => clearSelectedFiles(assignmentId)}
                        >
                          Очистить выбор
                        </button>
                      ) : null}
                    </div>

                    {selectedFiles.length ? (
                      <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Будут отправлены</div>
                        <div className="grid gap-2">
                          {selectedFiles.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white/80 px-3 py-2 text-sm text-slate-700">
                              <span className="truncate">{file.name}</span>
                              <span className="shrink-0 text-slate-500">{formatAttachmentSize(file.size)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {attachments.length ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Уже отправлено</div>
                        <div className="grid gap-2">
                          {attachments.map((file, index) => (
                            <a
                              key={`${file.url}-${index}`}
                              href={resolveAttachmentUrl(file)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-white/80 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:border-emerald-300 hover:text-emerald-900"
                            >
                              <span className="truncate">{file.originalName}</span>
                              <span className="shrink-0 text-emerald-700">{formatAttachmentSize(file.size)}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {!isReadOnlyStudentView ? (
                      <ActionButton onClick={() => submitAssignmentInline(assignment)} disabled={!assignmentId || inlineSubmittingId === assignmentId}>
                        {inlineSubmittingId === assignmentId
                          ? t("common.loading", { defaultValue: "Загрузка..." })
                          : t("assignments.submit", { defaultValue: "Сдать" })}
                      </ActionButton>
                    ) : (
                      <span className="text-sm font-medium text-slate-500">Отправка выключена для режима просмотра.</span>
                    )}

                    {successFlashId === assignmentId ? (
                      <span className="text-sm font-medium text-emerald-700">{t("common.success", { defaultValue: "Успешно" })}</span>
                    ) : null}
                  </div>

                  {assignmentId && inlineErrorById[assignmentId] ? (
                    <FeedbackMessage className="mt-3">{inlineErrorById[assignmentId]}</FeedbackMessage>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}

        {items.length === 0 && !error ? (
          <div className="flex h-32 items-center justify-center text-lg text-slate-500">{t("common.empty", { defaultValue: "Пусто" })}</div>
        ) : null}
      </div>
    </SectionCard>
  );
}
