const EXACT_ERROR_MAP = new Map([
  ["email and password are required", "Укажите email и пароль."],
  ["email, password and fullName are required", "Укажите email, пароль и ФИО."],
  ["studentEmail is required", "Укажите email студента."],
  ["group name is required", "Укажите название группы."],
  ["studentId is required", "Выберите студента."],
  ["groupId is required", "Выберите группу."],
  ["questionId is required", "Выберите вопрос."],
  ["title is required", "Введите название."],
  ["title is required (min 3 chars)", "Название должно содержать минимум 3 символа."],
  ["text is required", "Введите текст."],
  ["options (min 2) required for SINGLE/MULTI", "Добавьте минимум два варианта ответа."],
  ["at least one correct option required", "Отметьте хотя бы один правильный вариант ответа."],
  ["type must be SINGLE|MULTI|OPEN", "Некорректный тип вопроса."],
  ["invalid courseId", "Некорректный идентификатор курса."],
  ["invalid testId", "Некорректный идентификатор теста."],
  ["invalid questionId", "Некорректный идентификатор вопроса."],
  ["invalid credentials", "Неверный email или пароль."],
  ["invalid token", "Сессия недействительна. Войдите заново."],
  ["missing bearer token", "Сессия не найдена. Войдите заново."],
  ["Unauthorized", "Сессия истекла. Войдите заново."],
  ["forbidden", "Недостаточно прав для этого действия."],
  ["course not found", "Курс не найден."],
  ["test not found", "Тест не найден."],
  ["not enrolled", "Вы не записаны на этот курс."],
  ["user session is outdated, please sign in again", "Сессия устарела. Войдите заново."],
  ["Network Error", "Не удалось связаться с сервером."],
]);

const PARTIAL_ERROR_MAP = [
  ["Foreign key constraint violated", "Связанные данные устарели. Обновите страницу и повторите действие."],
  ["PrismaClientKnownRequestError", "Не удалось сохранить данные. Обновите страницу и повторите действие."],
  ["Invalid `prisma.", "Не удалось выполнить действие на сервере. Проверьте введенные данные и повторите попытку."],
  ["Unique constraint failed", "Такая запись уже существует."],
  ["Argument `", "Некоторые поля заполнены некорректно. Проверьте форму и попробуйте снова."],
  ["connect ECONNREFUSED", "Сервер сейчас недоступен. Попробуйте чуть позже."],
];

function normalizeText(value) {
  return String(value ?? "").trim();
}

export function translateUiMessage(message, fallback = "") {
  const normalized = normalizeText(message);
  if (!normalized) return fallback;

  if (EXACT_ERROR_MAP.has(normalized)) {
    return EXACT_ERROR_MAP.get(normalized);
  }

  const partial = PARTIAL_ERROR_MAP.find(([needle]) => normalized.includes(needle));
  if (partial) {
    return partial[1];
  }

  return normalized;
}

export function formatUiError(error, fallback = "Не удалось выполнить действие.") {
  const raw = error?.response?.data?.message || error?.response?.data?.error || error?.message || "";
  return translateUiMessage(raw, fallback);
}
