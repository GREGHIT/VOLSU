import StatCard from "../ui/StatCard";
import ActionButton from "../ui/ActionButton";

function isAttemptRequest(notification) {
  return String(notification?.body || "").includes('"kind":"ATTEMPT_REQUEST"');
}

function decodeBrokenText(value) {
  if (typeof value !== "string") return value ?? "";
  try {
    const decoded = decodeURIComponent(escape(value));
    if (((value.includes("Р") || value.includes("С")) || value.includes("Гђ") || value.includes("Г‘")) && /[А-Яа-яЁё]/.test(decoded)) {
      return decoded;
    }
    return value;
  } catch {
    return value;
  }
}

export default function CourseOverviewGrid({
  isTeacher,
  notificationCount,
  notifications,
  tests,
  submissionsCount,
  onCreateTest,
  formatAudience,
  onResolveAttemptRequest,
  gradebookSummary,
  onOpenGrades,
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <StatCard tone="amber" label="Уведомления" value={notificationCount}>
        <div className="mt-4 space-y-2">
          {notifications.slice(0, 3).map((notification) => (
            <div key={notification.id} className="theme-glass-cardInset rounded-xl bg-white/85 px-3 py-2 text-sm shadow-sm">
              <div className="theme-glass-strongText font-semibold text-slate-900">{decodeBrokenText(notification.title)}</div>
              <div className="theme-glass-softText text-xs text-amber-700">{decodeBrokenText(formatAudience(notification))}</div>
              {isAttemptRequest(notification) ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionButton tone="success" className="px-3 py-2 text-xs" onClick={() => onResolveAttemptRequest?.(notification.id, "approve")}>
                    Одобрить
                  </ActionButton>
                  <ActionButton tone="solidDanger" className="px-3 py-2 text-xs" onClick={() => onResolveAttemptRequest?.(notification.id, "reject")}>
                    Отклонить
                  </ActionButton>
                </div>
              ) : null}
            </div>
          ))}
          {notifications.length === 0 ? (
            <div className="theme-glass-cardInset theme-glass-softText rounded-xl bg-white/85 px-3 py-2 text-sm text-slate-600 shadow-sm">
              Уведомлений пока нет.
            </div>
          ) : null}
        </div>
      </StatCard>

      <StatCard
        tone="blue"
        label="Тесты"
        value={tests.length}
        action={
          isTeacher ? (
            <ActionButton tone="primary" className="h-11 rounded-2xl px-4 py-1.5 text-sm" onClick={onCreateTest}>
              + Тест
            </ActionButton>
          ) : null
        }
      >
        <div className="mt-3 max-h-44 space-y-2 overflow-y-auto px-1 py-1">
          {tests.slice(0, 4).map((test) => (
            <div key={test.id ?? test._id} className="theme-glass-cardInset flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
              <span className="theme-glass-strongText truncate text-[13px] font-semibold text-slate-900">{test.title}</span>
              <span
                className={`theme-glass-chip shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  test.isPublished ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {test.isPublished ? "Открыт" : "Скрыт"}
              </span>
            </div>
          ))}
          {tests.length === 0 ? <div className="theme-glass-softText text-sm text-slate-600">Тестов пока нет.</div> : null}
        </div>
      </StatCard>

      <StatCard
        tone="violet"
        label="Журнал оценок курса"
        value={gradebookSummary?.averageLabel ?? submissionsCount}
        description={gradebookSummary?.description || (isTeacher ? "Краткая сводка по успеваемости группы." : "Личная сводка по курсу.")}
      >
        <div className="mt-4 grid gap-2 text-sm">
          <div className="theme-glass-cardInset rounded-xl bg-white/85 px-3 py-2">
            <div className="theme-glass-softText text-xs uppercase tracking-[0.14em] text-slate-500">Успевают стабильно</div>
            <div className="theme-glass-strongText mt-1 font-semibold text-slate-900">{gradebookSummary?.strongCount ?? 0} студентов</div>
          </div>
          <div className="theme-glass-cardInset rounded-xl bg-white/85 px-3 py-2">
            <div className="theme-glass-softText text-xs uppercase tracking-[0.14em] text-slate-500">Нужна поддержка</div>
            <div className="theme-glass-strongText mt-1 font-semibold text-slate-900">{gradebookSummary?.riskCount ?? 0} студентов</div>
          </div>
          {isTeacher ? (
            <ActionButton tone="secondary" className="mt-1 w-full justify-center" onClick={onOpenGrades}>
              Посмотреть полную успеваемость группы
            </ActionButton>
          ) : null}
        </div>
      </StatCard>
    </div>
  );
}
