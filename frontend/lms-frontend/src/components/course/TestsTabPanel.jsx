import ActionButton from "../ui/ActionButton";
import FeedbackMessage from "../ui/FeedbackMessage";
import SectionCard from "../ui/SectionCard";

function isBlocked(test) {
  if (test?.canStart === false) return true;
  const limit = Number(test?.attemptLimit);
  const used = Number(test?.attemptsUsed);
  const remaining = Number(test?.remainingAttempts);
  if (Number.isFinite(remaining) && remaining <= 0) return true;
  if (Number.isFinite(limit) && Number.isFinite(used) && limit > 0 && used >= limit) return true;
  return false;
}

function canRequestExtraAttempt(test) {
  const reason = decodeBrokenText(String(test?.startBlockedReason || "")).toLowerCase();
  const limit = Number(test?.attemptLimit);
  const used = Number(test?.attemptsUsed);
  return (
    isBlocked(test) &&
    ((reason.includes("лимит") || reason.includes("попыт")) || (Number.isFinite(limit) && limit > 0 && Number.isFinite(used) && used >= limit))
  );
}

function decodeBrokenText(value) {
  if (typeof value !== "string") return value ?? "";
  try {
    const decoded = decodeURIComponent(escape(value));
    if ((/[РС]/.test(value) || value.includes("Ð") || value.includes("Ñ")) && /[А-Яа-яЁё]/.test(decoded)) {
      return decoded;
    }
    return value;
  } catch {
    return value;
  }
}

export default function TestsTabPanel({
  testsError,
  isTeacher,
  isReadOnlyStudentView = false,
  tests,
  testsLoaded,
  getTestId,
  onOpenCreate,
  onUnpublish,
  onPublish,
  onEdit,
  onDelete,
  onStart,
  onRequestAttempt,
  onInspect,
  t,
}) {
  return (
    <SectionCard
      className="lg:p-6"
      actions={
        isTeacher && !isReadOnlyStudentView ? (
          <ActionButton tone="primary" onClick={onOpenCreate}>
            + {t("tests.create", { defaultValue: "Создать тест" })}
          </ActionButton>
        ) : null
      }
    >
      {testsError ? <FeedbackMessage className="mb-4">{testsError}</FeedbackMessage> : null}

      {tests.length > 0 ? (
        <div className="grid gap-2.5">
          {tests.map((test) => {
            const testId = getTestId(test);
            const startBlocked = isBlocked(test);
            const hasUnlimitedAttempts = Number(test?.attemptLimit) === 0;

            return (
              <div key={testId ?? JSON.stringify(test)} className="rounded-2xl border border-slate-300 bg-slate-50/70 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="break-words text-[0.98rem] font-bold text-slate-900">
                      {test.title ?? test.name ?? t("tests.test", { defaultValue: "Тест" })}
                    </div>
                    {test.description || test.summary ? (
                      <div className="mt-1 break-words text-sm text-slate-600">{test.description ?? test.summary}</div>
                    ) : null}
                    {"isPublished" in test ? (
                      <div className="mt-2 text-sm text-slate-500">
                        {t("tests.published", { defaultValue: "Опубликован" })}:{" "}
                        {test.isPublished ? t("common.yes", { defaultValue: "Да" }) : t("common.no", { defaultValue: "Нет" })}
                      </div>
                    ) : null}
                    {test.availableFrom ? (
                      <div className="mt-1 text-xs text-slate-500">Открытие: {new Date(test.availableFrom).toLocaleString()}</div>
                    ) : null}
                    {!isTeacher && (test.attemptLimit !== undefined && test.attemptLimit !== null) ? (
                      <div className="mt-1 text-xs text-slate-500">
                        Попытки: {hasUnlimitedAttempts ? "без лимита" : `${test.attemptsUsed ?? 0}/${test.attemptLimit}`}
                        {Number(test?.extraAttempts || 0) > 0 ? ` (+${test.extraAttempts})` : ""}
                      </div>
                    ) : null}
                  </div>

                  {isTeacher && !isReadOnlyStudentView ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {test.isPublished ? (
                        <ActionButton onClick={() => onUnpublish(testId)}>Скрыть</ActionButton>
                      ) : (
                        <ActionButton tone="primary" className="border-green-500 bg-green-500 hover:border-green-600 hover:bg-green-600" onClick={() => onPublish(testId)}>
                          Опубликовать
                        </ActionButton>
                      )}
                      <ActionButton onClick={() => onEdit(test)}>Редактировать</ActionButton>
                      <ActionButton tone="success" onClick={() => onInspect(testId)}>Смотреть с ответами</ActionButton>
                      <ActionButton tone="solidDanger" onClick={() => onDelete(test)}>Удалить</ActionButton>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      {isReadOnlyStudentView ? (
                        <ActionButton tone="success" onClick={() => onInspect(testId)}>Открыть просмотр с ответами</ActionButton>
                      ) : (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {canRequestExtraAttempt(test) ? (
                              <ActionButton tone="secondary" onClick={() => onRequestAttempt?.(test)}>
                                Подать запрос на прохождение
                              </ActionButton>
                            ) : null}
                            <ActionButton tone="primary" disabled={startBlocked && !test.activeAttemptId} onClick={() => onStart(test)}>
                              {test.activeAttemptId ? "Продолжить" : "Пройти тест"}
                            </ActionButton>
                          </div>
                          {startBlocked && test.startBlockedReason ? (
                            <div className="max-w-[260px] text-right text-xs text-amber-600">{decodeBrokenText(test.startBlockedReason)}</div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center text-lg text-slate-500">
          {testsLoaded ? t("common.empty", { defaultValue: "Пусто" }) : t("common.loading", { defaultValue: "Загрузка..." })}
        </div>
      )}
    </SectionCard>
  );
}
