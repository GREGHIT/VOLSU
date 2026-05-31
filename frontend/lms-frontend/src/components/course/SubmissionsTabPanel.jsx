import SectionCard from "../ui/SectionCard";
import FeedbackMessage from "../ui/FeedbackMessage";
import ActionButton from "../ui/ActionButton";
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

export default function SubmissionsTabPanel({
  subsLoading,
  subsError,
  submissions,
  reviewRequests = [],
  isTeacher,
  onGrade,
  onOpenTestReview,
  t,
}) {
  return (
    <SectionCard className="lg:p-6">
      {subsLoading ? <div className="theme-readable-soft text-slate-500">{t("common.loading", { defaultValue: "Загрузка..." })}</div> : null}
      {subsError ? <FeedbackMessage className="mb-4">{subsError}</FeedbackMessage> : null}
      {!subsLoading && !subsError ? (
        <div className="grid gap-3">
          {reviewRequests.map((request) => (
            <div key={`review-${request.notificationId}-${request.attemptId}`} className="submission-review-card rounded-2xl border p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="submission-review-title font-semibold">Нужна проверка теста</div>
                  <div className="submission-review-meta text-sm">
                    {request.studentLabel} • {request.testTitle}
                  </div>
                </div>
                {isTeacher ? (
                  <ActionButton tone="primary" onClick={() => onOpenTestReview?.(request.attemptId)}>
                    Проверить
                  </ActionButton>
                ) : null}
              </div>
              <div className="submission-review-note mt-3 text-sm">
                Студент завершил попытку, и итоговая оценка по тесту ждёт ручной проверки преподавателем.
              </div>
            </div>
          ))}

          {submissions.map((submission) => (
            <div key={submission.id} className="submission-card rounded-2xl border p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="submission-student font-semibold">{submission.student?.fullName || submission.student?.email || "Студент"}</div>
                  <div className="submission-assignment text-sm">{submission.assignment?.title || "Задание"}</div>
                </div>
                {isTeacher ? <ActionButton tone="primary" onClick={() => onGrade(submission)}>Оценить</ActionButton> : null}
              </div>

              <div className="submission-answer mt-3 whitespace-pre-wrap">{submission.contentText || "Текстовый ответ не добавлен."}</div>

              {submission.attachments?.length ? (
                <div className="submission-files-box mt-4 rounded-2xl border p-3">
                  <div className="submission-files-title mb-2 text-xs font-semibold uppercase tracking-[0.18em]">Файлы студента</div>
                  <div className="grid gap-2">
                    {submission.attachments.map((file, index) => (
                      <a
                        key={`${file.url}-${index}`}
                        href={resolveAttachmentUrl(file)}
                        target="_blank"
                        rel="noreferrer"
                        className="submission-file-link flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition"
                      >
                        <span className="truncate">{file.originalName}</span>
                        <span className="submission-file-size shrink-0">{formatAttachmentSize(file.size)}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="submission-grade mt-3 text-sm">Оценка: {submission.grade == null ? "—" : submission.grade}</div>
            </div>
          ))}
          {submissions.length === 0 && reviewRequests.length === 0 ? <div className="text-sm text-slate-500 theme-readable-soft">Сдач пока нет.</div> : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
