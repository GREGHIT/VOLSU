export const QUESTION_TYPE_OPTIONS = [
  { value: "SINGLE", label: "Один правильный ответ", hint: "Классический выбор одного варианта." },
  { value: "MULTI", label: "Несколько правильных ответов", hint: "Подходит для составных проверок." },
  { value: "OPEN", label: "Открытый ответ", hint: "Развёрнутый текст с ручной проверкой." },
  { value: "ORDER", label: "Этапы процесса", hint: "Студент расставляет шаги в верном порядке." },
  { value: "MATCH", label: "Сопоставление", hint: "Термины и определения, понятия и свойства." },
  { value: "CATEGORY", label: "Распределение по категориям", hint: "Разложить объекты по группам." },
  { value: "KEYWORD", label: "Ключевое слово", hint: "Короткий ответ, как мини-кроссворд." },
  { value: "FORMULA", label: "Формула", hint: "Ввод математической записи в специальном поле." },
  { value: "TABLE", label: "Заполнение таблицы", hint: "Строки, столбцы и проверяемые ячейки." },
];

export const TYPE_LABELS = {
  ...Object.fromEntries(QUESTION_TYPE_OPTIONS.map((item) => [item.value, item.label])),
  CODE: "Код",
  SQL: "SQL-запрос",
};

export function emptyOption() {
  return { text: "", isCorrect: false };
}

export function defaultConfigByType(type) {
  switch (type) {
    case "OPEN":
      return { prompt: "" };
    case "ORDER":
      return { prompt: "", items: ["", ""] };
    case "MATCH":
      return { prompt: "", pairs: [{ left: "", right: "" }, { left: "", right: "" }] };
    case "CATEGORY":
      return {
        prompt: "",
        categories: [
          { name: "Категория 1", items: [""] },
          { name: "Категория 2", items: [""] },
        ],
      };
    case "KEYWORD":
      return { prompt: "", mask: "", caseSensitive: false, answers: [""] };
    case "FORMULA":
      return { prompt: "", placeholder: "Например: F=ma", answers: [""] };
    case "TABLE":
      return {
        prompt: "",
        placeholder: "",
        columns: [
          { key: "col_1", label: "Столбец 1" },
          { key: "col_2", label: "Столбец 2" },
        ],
        rows: [
          { key: "row_1", label: "Строка 1" },
          { key: "row_2", label: "Строка 2" },
        ],
        answers: {
          row_1: { col_1: "", col_2: "" },
          row_2: { col_1: "", col_2: "" },
        },
      };
    case "CODE":
      return {
        prompt: "",
        language: "python",
        starterCode: "",
        placeholder: "Напишите фрагмент кода",
        expectedKeywords: [""],
        forbiddenKeywords: [],
      };
    case "SQL":
      return {
        prompt: "",
        language: "sql",
        starterCode: "SELECT *\nFROM table_name\nWHERE ...;",
        placeholder: "Напишите SQL-запрос",
        expectedKeywords: ["select", "from"],
        forbiddenKeywords: [],
      };
    default:
      return {};
  }
}

export function normalizeEditorConfig(type, config) {
  const base = defaultConfigByType(type);
  if (!config || typeof config !== "object") return base;

  if (type === "OPEN") {
    return { prompt: String(config.prompt || "") };
  }

  if (type === "ORDER") {
    return {
      prompt: String(config.prompt || ""),
      items: Array.isArray(config.items) && config.items.length ? config.items.map((item) => String(item || "")) : ["", ""],
    };
  }

  if (type === "MATCH") {
    return {
      prompt: String(config.prompt || ""),
      pairs:
        Array.isArray(config.pairs) && config.pairs.length
          ? config.pairs.map((pair) => ({ left: String(pair?.left || ""), right: String(pair?.right || "") }))
          : [{ left: "", right: "" }, { left: "", right: "" }],
    };
  }

  if (type === "CATEGORY") {
    return {
      prompt: String(config.prompt || ""),
      categories:
        Array.isArray(config.categories) && config.categories.length
          ? config.categories.map((category) => ({
              name: String(category?.name || ""),
              items: Array.isArray(category?.items) && category.items.length ? category.items.map((item) => String(item || "")) : [""],
            }))
          : [
              { name: "Категория 1", items: [""] },
              { name: "Категория 2", items: [""] },
            ],
    };
  }

  if (type === "KEYWORD") {
    return {
      prompt: String(config.prompt || ""),
      mask: String(config.mask || ""),
      caseSensitive: !!config.caseSensitive,
      answers: Array.isArray(config.answers) && config.answers.length ? config.answers.map((value) => String(value || "")) : [""],
    };
  }

  if (type === "FORMULA") {
    return {
      prompt: String(config.prompt || ""),
      placeholder: String(config.placeholder || "Например: F=ma"),
      answers: Array.isArray(config.answers) && config.answers.length ? config.answers.map((value) => String(value || "")) : [""],
    };
  }

  if (type === "TABLE") {
    const columns = Array.isArray(config.columns) && config.columns.length ? config.columns : base.columns;
    const rows = Array.isArray(config.rows) && config.rows.length ? config.rows : base.rows;
    const answers = {};
    rows.forEach((row) => {
      answers[row.key] = {};
      columns.forEach((column) => {
        answers[row.key][column.key] = String(config?.answers?.[row.key]?.[column.key] || "");
      });
    });
    return {
      prompt: String(config.prompt || ""),
      placeholder: String(config.placeholder || ""),
      columns: columns.map((column) => ({ key: String(column.key || ""), label: String(column.label || "") })),
      rows: rows.map((row) => ({ key: String(row.key || ""), label: String(row.label || "") })),
      answers,
    };
  }

  if (type === "CODE" || type === "SQL") {
    return {
      prompt: String(config.prompt || ""),
      language: String(config.language || (type === "SQL" ? "sql" : "text")),
      starterCode: String(config.starterCode || ""),
      placeholder: String(config.placeholder || ""),
      expectedKeywords:
        Array.isArray(config.expectedKeywords) && config.expectedKeywords.length
          ? config.expectedKeywords.map((value) => String(value || ""))
          : [""],
      forbiddenKeywords: Array.isArray(config.forbiddenKeywords) ? config.forbiddenKeywords.map((value) => String(value || "")) : [],
    };
  }

  return base;
}

export function createQuestionForm(type = "SINGLE", order = 0) {
  return {
    id: null,
    type,
    text: "",
    points: 1,
    order,
    options: type === "SINGLE" || type === "MULTI" ? [emptyOption(), emptyOption()] : [],
    config: normalizeEditorConfig(type, defaultConfigByType(type)),
  };
}

export function hydrateQuestionForm(question) {
  const type = String(question?.type || "SINGLE").toUpperCase();
  return {
    id: question.id,
    type,
    text: String(question.text || ""),
    points: Number(question.points || 1),
    order: Number(question.order || 0),
    options:
      type === "SINGLE" || type === "MULTI"
        ? (question.options || []).map((option) => ({
            id: option.id,
            text: String(option.text || ""),
            isCorrect: !!option.isCorrect,
          }))
        : [],
    config: normalizeEditorConfig(type, question.config || {}),
  };
}

export function cleanQuestionPayload(form) {
  const type = String(form.type || "SINGLE").toUpperCase();
  const payload = {
    type,
    text: String(form.text || "").trim(),
    points: Number(form.points || 1),
    order: Number(form.order || 0),
    config: normalizeEditorConfig(type, form.config || {}),
  };

  if (type === "SINGLE" || type === "MULTI") {
    payload.options = (form.options || [])
      .map((option) => ({
        text: String(option.text || "").trim(),
        isCorrect: !!option.isCorrect,
      }))
      .filter((option) => option.text);
  } else {
    payload.options = [];
  }

  return payload;
}

export function createAttemptAnswer(question, saved = null) {
  const response = saved?.response || {};
  const optionIds = Array.isArray(saved?.optionIds) ? saved.optionIds : [];
  const textAnswer = String(saved?.textAnswer || "");
  const attachments = Array.isArray(saved?.attachments) ? saved.attachments : [];

  switch (question.type) {
    case "SINGLE":
    case "MULTI":
      return { optionIds, textAnswer: "", response: {} };
    case "OPEN":
      return {
        optionIds: [],
        textAnswer,
        attachments,
        response: { value: response.value ?? textAnswer },
      };
    case "KEYWORD":
    case "FORMULA":
    case "CODE":
    case "SQL":
      return {
        optionIds: [],
        textAnswer,
        response: { value: response.value ?? textAnswer },
      };
    case "ORDER":
      return {
        optionIds: [],
        textAnswer: "",
        response: {
          items: Array.isArray(response.items) && response.items.length ? response.items : [...(question.config?.items || [])],
        },
      };
    case "MATCH":
      return {
        optionIds: [],
        textAnswer: "",
        response: { pairs: response.pairs || {} },
      };
    case "CATEGORY":
      return {
        optionIds: [],
        textAnswer: "",
        response: { mapping: response.mapping || {} },
      };
    case "TABLE":
      return {
        optionIds: [],
        textAnswer: "",
        response: { cells: response.cells || {} },
      };
    default:
      return { optionIds: [], textAnswer: "", response: {} };
  }
}

export function questionTone(type) {
  if (type === "TABLE" || type === "CATEGORY") return "emerald";
  if (type === "FORMULA" || type === "KEYWORD") return "amber";
  return "blue";
}
