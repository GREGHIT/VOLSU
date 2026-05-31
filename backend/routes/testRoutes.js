const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");

const QUESTION_TYPES = [
  "SINGLE",
  "MULTI",
  "OPEN",
  "ORDER",
  "MATCH",
  "CATEGORY",
  "KEYWORD",
  "FORMULA",
  "TABLE",
  "CODE",
  "SQL",
];

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringifyJson(value) {
  return JSON.stringify(value ?? {});
}

function safeParseJsonArray(value) {
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sanitizeFilenamePart(value, fallback = "file") {
  const normalized = String(value || fallback)
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function ensureUploadsRoot(uploadsRoot) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

function removeStoredAttachments(attachments) {
  for (const file of attachments || []) {
    if (!file?.relativePath) continue;
    const absolutePath = path.join(__dirname, "..", file.relativePath);
    try {
      if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    } catch {
      // ignore cleanup issues
    }
  }
}

function normalizeIncomingAttachments(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((file) => {
      if (!file || typeof file !== "object") return null;
      const dataUrl = typeof file.dataUrl === "string" ? file.dataUrl : "";
      if (!dataUrl.startsWith("data:")) return null;
      const commaIndex = dataUrl.indexOf(",");
      if (commaIndex < 0) return null;
      const encoded = dataUrl.slice(commaIndex + 1);
      const buffer = Buffer.from(encoded, "base64");
      if (!buffer.length) return null;
      return {
        originalName: sanitizeFilenamePart(file.originalName || file.name || "file"),
        mimeType: String(file.mimeType || file.type || "application/octet-stream"),
        size: Number(file.size || buffer.length),
        buffer,
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

function persistAttachments(uploadsRoot, answerId, studentId, questionId, attachments) {
  ensureUploadsRoot(uploadsRoot);
  return attachments.map((file, index) => {
    const ext = path.extname(file.originalName || "") || "";
    const basename = sanitizeFilenamePart(path.basename(file.originalName, ext), "file");
    const filename = `${Date.now()}_${studentId}_${answerId}_${questionId}_${index}_${basename}${ext}`;
    const absolutePath = path.join(uploadsRoot, filename);
    fs.writeFileSync(absolutePath, file.buffer);
    return {
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      relativePath: path.join("uploads", "test-answers", filename).replace(/\\/g, "/"),
      url: `/uploads/test-answers/${filename}`,
    };
  });
}

function repairBrokenText(value) {
  if (typeof value !== "string") return value ?? "";
  const text = String(value);
  if (!/[РСЁёЇїІіЄєҐґÐÑ]/.test(text) && !text.includes("пїЅ") && !text.includes("вЂ") && !text.includes("в†")) {
    return text;
  }
  try {
    const decoded = iconv.decode(iconv.encode(text, "win1251"), "utf8");
    const decodedCyrillic = (decoded.match(/[А-Яа-яЁё]/g) || []).length;
    const originalCyrillic = (text.match(/[А-Яа-яЁё]/g) || []).length;
    if (decoded.includes("�")) return text;
    return decodedCyrillic > originalCyrillic ? decoded : text;
  } catch {
    return text;
  }
}

function normalizeText(value) {
  return repairBrokenText(value).trim();
}

function normalizeLoose(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizeFormula(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
}

function normalizeLooseRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [normalizeLoose(key), item]));
}

function cleanStringArray(values) {
  return Array.isArray(values) ? values.map(normalizeText).filter(Boolean) : [];
}

function clampInt(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function sanitizePayload(payload) {
  if (Array.isArray(payload)) return payload.map(sanitizePayload);
  if (payload && typeof payload === "object") {
    return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, sanitizePayload(value)]));
  }
  return typeof payload === "string" ? normalizeText(payload) : payload;
}

function normalizeTabSwitchLimit(value) {
  return clampInt(value, 0, 50, 3);
}

function normalizeAttemptLimit(value) {
  return clampInt(value, 0, 5, 1);
}

async function getAttemptAllowance(prisma, testId, studentId) {
  const allowance = await prisma.testAttemptAllowance.findUnique({
    where: {
      testId_studentId: { testId, studentId },
    },
  });
  return Math.max(0, Number(allowance?.extraAttempts || 0));
}

async function findActiveAttempt(prisma, studentId, testId = null) {
  const where = {
    studentId,
    finishedAt: null,
    ...(Number.isInteger(testId) ? { testId } : {}),
  };
  const attempt = await prisma.attempt.findFirst({
    where,
    include: { test: true },
    orderBy: { startedAt: "desc" },
  });
  if (!attempt) return null;

  const expiresAt = computeAttemptDeadline(attempt);
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    await finalizeAttempt(prisma, attempt.id, true);
    return null;
  }

  return attempt;
}

function validateChoiceOptions(options, type) {
  const cleaned = Array.isArray(options)
    ? options
        .map((option) => ({
          text: normalizeText(option?.text),
          isCorrect: !!option?.isCorrect,
        }))
        .filter((option) => option.text)
    : [];

  if (cleaned.length < 2) {
    return "Р”РѕР±Р°РІСЊС‚Рµ РјРёРЅРёРјСѓРј РґРІР° РІР°СЂРёР°РЅС‚Р° РѕС‚РІРµС‚Р°.";
  }

  const correctCount = cleaned.filter((option) => option.isCorrect).length;
  if (!correctCount) return "РћС‚РјРµС‚СЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ РїСЂР°РІРёР»СЊРЅС‹Р№ РІР°СЂРёР°РЅС‚ РѕС‚РІРµС‚Р°.";
  if (type === "SINGLE" && correctCount !== 1) {
    return "Р”Р»СЏ РѕРґРёРЅРѕС‡РЅРѕРіРѕ РІС‹Р±РѕСЂР° РЅСѓР¶РµРЅ СЂРѕРІРЅРѕ РѕРґРёРЅ РїСЂР°РІРёР»СЊРЅС‹Р№ РІР°СЂРёР°РЅС‚.";
  }

  return null;
}

function buildStoredConfig(type, rawConfig) {
  const config = rawConfig && typeof rawConfig === "object" ? rawConfig : {};

  if (type === "OPEN") {
    return {
      prompt: normalizeText(config.prompt),
    };
  }

  if (type === "ORDER") {
    return {
      prompt: normalizeText(config.prompt),
      items: cleanStringArray(config.items),
    };
  }

  if (type === "MATCH") {
    return {
      prompt: normalizeText(config.prompt),
      pairs: Array.isArray(config.pairs)
        ? config.pairs
            .map((pair) => ({
              left: normalizeText(pair?.left),
              right: normalizeText(pair?.right),
            }))
            .filter((pair) => pair.left && pair.right)
        : [],
    };
  }

  if (type === "CATEGORY") {
    return {
      prompt: normalizeText(config.prompt),
      categories: Array.isArray(config.categories)
        ? config.categories
            .map((category) => ({
              name: normalizeText(category?.name),
              items: cleanStringArray(category?.items),
            }))
            .filter((category) => category.name)
        : [],
    };
  }

  if (type === "KEYWORD") {
    return {
      prompt: normalizeText(config.prompt),
      mask: normalizeText(config.mask),
      caseSensitive: !!config.caseSensitive,
      answers: cleanStringArray(config.answers),
    };
  }

  if (type === "FORMULA") {
    return {
      prompt: normalizeText(config.prompt),
      placeholder: normalizeText(config.placeholder),
      answers: cleanStringArray(config.answers),
    };
  }

  if (type === "TABLE") {
    const columns = Array.isArray(config.columns)
      ? config.columns
          .map((column) => ({
            key: normalizeText(column?.key),
            label: normalizeText(column?.label),
          }))
          .filter((column) => column.key && column.label)
      : [];
    const rows = Array.isArray(config.rows)
      ? config.rows
          .map((row) => ({
            key: normalizeText(row?.key),
            label: normalizeText(row?.label),
          }))
          .filter((row) => row.key && row.label)
      : [];
    const answers = {};
    for (const row of rows) {
      answers[row.key] = {};
      for (const column of columns) {
        answers[row.key][column.key] = normalizeText(config?.answers?.[row.key]?.[column.key] || "");
      }
    }
    return {
      prompt: normalizeText(config.prompt),
      placeholder: normalizeText(config.placeholder),
      columns,
      rows,
      answers,
    };
  }

  if (type === "CODE" || type === "SQL") {
    return {
      prompt: normalizeText(config.prompt),
      language: normalizeText(config.language || (type === "SQL" ? "sql" : "text")),
      placeholder: normalizeText(config.placeholder),
      starterCode: String(config.starterCode || ""),
      expectedKeywords: cleanStringArray(config.expectedKeywords),
      forbiddenKeywords: cleanStringArray(config.forbiddenKeywords),
    };
  }

  return {};
}

function validateQuestionPayload(type, text, points, order, options, rawConfig) {
  const normalizedType = String(type || "").toUpperCase();
  if (!QUESTION_TYPES.includes(normalizedType)) return "РќРµРїРѕРґРґРµСЂР¶РёРІР°РµРјС‹Р№ С‚РёРї РІРѕРїСЂРѕСЃР°.";
  if (normalizeText(text).length < 3) return "РўРµРєСЃС‚ РІРѕРїСЂРѕСЃР° РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ РјРёРЅРёРјСѓРј 3 СЃРёРјРІРѕР»Р°.";

  const numericPoints = Number(points);
  if (!Number.isFinite(numericPoints) || numericPoints <= 0) {
    return "Р‘Р°Р»Р»С‹ РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ РїРѕР»РѕР¶РёС‚РµР»СЊРЅС‹Рј С‡РёСЃР»РѕРј.";
  }

  const numericOrder = Number(order);
  if (!Number.isFinite(numericOrder) || numericOrder < 0) {
    return "РџРѕСЂСЏРґРѕРє РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ С‡РёСЃР»РѕРј РЅРµ РјРµРЅСЊС€Рµ 0.";
  }

  if (normalizedType === "SINGLE" || normalizedType === "MULTI") {
    return validateChoiceOptions(options, normalizedType);
  }

  const config = buildStoredConfig(normalizedType, rawConfig);

  if (normalizedType === "ORDER" && config.items.length < 2) {
    return "Р”Р»СЏ СЂР°СЃСЃС‚Р°РЅРѕРІРєРё С€Р°РіРѕРІ РЅСѓР¶РЅС‹ РјРёРЅРёРјСѓРј РґРІР° С€Р°РіР°.";
  }

  if (normalizedType === "MATCH" && config.pairs.length < 2) {
    return "Р”Р»СЏ СЃРѕРїРѕСЃС‚Р°РІР»РµРЅРёСЏ РЅСѓР¶РЅС‹ РјРёРЅРёРјСѓРј РґРІРµ РїР°СЂС‹.";
  }

  if (normalizedType === "CATEGORY") {
    const categories = config.categories || [];
    const totalItems = categories.reduce((sum, category) => sum + (category.items?.length || 0), 0);
    if (categories.length < 2 || totalItems < 2) {
      return "Р”Р»СЏ СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ РїРѕ РєР°С‚РµРіРѕСЂРёСЏРј РЅСѓР¶РЅС‹ РјРёРЅРёРјСѓРј РґРІРµ РєР°С‚РµРіРѕСЂРёРё Рё РґРІР° РѕР±СЉРµРєС‚Р°.";
    }
  }

  if (normalizedType === "KEYWORD" && !(config.answers || []).length) {
    return "РЈРєР°Р¶РёС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕ РєР»СЋС‡РµРІРѕРµ СЃР»РѕРІРѕ.";
  }

  if (normalizedType === "FORMULA" && !(config.answers || []).length) {
    return "РЈРєР°Р¶РёС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅСѓ РїСЂР°РІРёР»СЊРЅСѓСЋ С„РѕСЂРјСѓР»Сѓ.";
  }

  if (normalizedType === "TABLE" && (!(config.columns || []).length || !(config.rows || []).length)) {
    return "Р”Р»СЏ С‚Р°Р±Р»РёС‡РЅРѕРіРѕ РІРѕРїСЂРѕСЃР° РЅСѓР¶РЅС‹ СЃС‚СЂРѕРєРё Рё СЃС‚РѕР»Р±С†С‹.";
  }

  if ((normalizedType === "CODE" || normalizedType === "SQL") && !(config.expectedKeywords || []).length) {
    return "Р”Р»СЏ РєРѕРґР° РёР»Рё SQL СѓРєР°Р¶РёС‚Рµ РѕР¶РёРґР°РµРјС‹Рµ РєР»СЋС‡РµРІС‹Рµ СЌР»РµРјРµРЅС‚С‹ СЂРµС€РµРЅРёСЏ.";
  }

  return null;
}

function shuffleArray(values) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function sanitizeQuestionForStudent(question) {
  const config = parseJson(question.configJson, {});
  const safe = {
    id: question.id,
    type: question.type,
    text: question.text,
    points: question.points,
    order: question.order,
    config: {},
    options: [],
  };

  if (question.type === "SINGLE" || question.type === "MULTI") {
    safe.options = (question.options || []).map((option) => ({ id: option.id, text: option.text }));
    return safe;
  }

  if (question.type === "OPEN") {
    safe.config = {
      prompt: config.prompt || "",
    };
    return safe;
  }

  if (question.type === "ORDER") {
    safe.config = {
      prompt: config.prompt || "",
      items: shuffleArray(Array.isArray(config.items) ? config.items : []),
    };
    return safe;
  }

  if (question.type === "MATCH") {
    const pairs = Array.isArray(config.pairs) ? config.pairs : [];
    safe.config = {
      prompt: config.prompt || "",
      leftItems: pairs.map((pair) => pair.left),
      rightItems: shuffleArray(pairs.map((pair) => pair.right)),
    };
    return safe;
  }

  if (question.type === "CATEGORY") {
    const categories = Array.isArray(config.categories) ? config.categories : [];
    safe.config = {
      prompt: config.prompt || "",
      categories: categories.map((category) => ({ name: category.name })),
      items: shuffleArray(
        categories.flatMap((category) =>
          (category.items || []).map((item) => ({ label: item, id: normalizeLoose(item) }))
        )
      ),
    };
    return safe;
  }

  if (question.type === "KEYWORD") {
    safe.config = {
      prompt: config.prompt || "",
      mask: config.mask || "",
      caseSensitive: !!config.caseSensitive,
    };
    return safe;
  }

  if (question.type === "FORMULA") {
    safe.config = {
      prompt: config.prompt || "",
      placeholder: config.placeholder || "",
    };
    return safe;
  }

  if (question.type === "TABLE") {
    safe.config = {
      prompt: config.prompt || "",
      placeholder: config.placeholder || "",
      columns: Array.isArray(config.columns) ? config.columns : [],
      rows: Array.isArray(config.rows) ? config.rows : [],
    };
    return safe;
  }

  if (question.type === "CODE" || question.type === "SQL") {
    safe.config = {
      prompt: config.prompt || "",
      language: config.language || (question.type === "SQL" ? "sql" : "text"),
      placeholder: config.placeholder || "",
      starterCode: config.starterCode || "",
    };
    return safe;
  }

  return safe;
}

function hydrateTeacherQuestion(question) {
  return {
    ...question,
    config: parseJson(question.configJson, {}),
  };
}

function getAnswerText(answer) {
  const response = parseJson(answer?.responseJson, {});
  return String(response.value || answer?.textAnswer || "");
}

function summarizeAnswer(question, answer) {
  const config = parseJson(question.configJson, {});
  const response = parseJson(answer?.responseJson, {});

  if (!answer) {
    return { kind: "empty", text: "Ответ не сохранён." };
  }

  if (question.type === "SINGLE" || question.type === "MULTI") {
    const selectedIds = new Set((answer.selections || []).map((selection) => selection.optionId));
    const selected = (question.options || []).filter((option) => selectedIds.has(option.id)).map((option) => option.text);
    return {
      kind: "choices",
      text: selected.length ? selected.join(", ") : "Р’Р°СЂРёР°РЅС‚С‹ РЅРµ РІС‹Р±СЂР°РЅС‹.",
      selected,
    };
  }

  if (question.type === "ORDER") {
    return {
      kind: "list",
      text: Array.isArray(response.items) && response.items.length ? response.items.join(" -> ") : "РџРѕСЂСЏРґРѕРє РЅРµ Р·Р°РґР°РЅ.",
      items: Array.isArray(response.items) ? response.items : [],
    };
  }

  if (question.type === "MATCH") {
    const pairs = response.pairs && typeof response.pairs === "object" ? response.pairs : {};
    return {
      kind: "mapping",
      text:
        Object.keys(pairs).length > 0
          ? Object.entries(pairs)
              .map(([left, right]) => `${left}: ${right}`)
              .join("; ")
          : "РЎРѕРѕС‚РІРµС‚СЃС‚РІРёСЏ РЅРµ РІС‹Р±СЂР°РЅС‹.",
      pairs,
    };
  }

  if (question.type === "CATEGORY") {
    const mapping = response.mapping && typeof response.mapping === "object" ? response.mapping : {};
    return {
      kind: "mapping",
      text:
        Object.keys(mapping).length > 0
          ? Object.entries(mapping)
              .map(([item, category]) => `${item}: ${category}`)
              .join("; ")
          : "РљР°С‚РµРіРѕСЂРёРё РЅРµ РІС‹Р±СЂР°РЅС‹.",
      mapping,
    };
  }

  if (question.type === "TABLE") {
    const cells = response.cells && typeof response.cells === "object" ? response.cells : {};
    const preview = [];
    for (const row of config.rows || []) {
      for (const column of config.columns || []) {
        const value = String(cells?.[row.key]?.[column.key] || "").trim();
        if (value) preview.push(`${row.label} / ${column.label}: ${value}`);
      }
    }
    return {
      kind: "table",
      text: preview.length ? preview.join("; ") : "РўР°Р±Р»РёС†Р° РЅРµ Р·Р°РїРѕР»РЅРµРЅР°.",
      cells,
    };
  }

  return {
    kind: "text",
    text: getAnswerText(answer) || "РћС‚РІРµС‚ РЅРµ Р·Р°РїРѕР»РЅРµРЅ.",
  };
}

function isReviewableQuestion(questionType) {
  return questionType === "OPEN";
}

function resolveManualScore(question, answer, score, maxScore, auto, reason, details) {
  if (answer?.manualScore == null) {
    return {
      score,
      maxScore,
      auto,
      reason,
      details,
      reviewStatus: answer?.reviewStatus || (auto ? "AUTO" : "MANUAL_REQUIRED"),
      reviewComment: answer?.reviewComment || "",
      reviewReason: answer?.reviewReason || "",
      pendingReview: !auto,
    };
  }

  const boundedManual = Math.min(Math.max(0, Number(answer.manualScore || 0)), maxScore);
  return {
    score: boundedManual,
    maxScore,
    auto: false,
    reason: answer?.reviewComment || "Баллы скорректированы преподавателем вручную.",
    details,
    reviewStatus: answer?.reviewStatus || "MANUAL_REVIEWED",
    reviewComment: answer?.reviewComment || "",
    reviewReason: answer?.reviewReason || "",
    pendingReview: false,
  };
}

function evaluateQuestion(question, answer) {
  const config = parseJson(question.configJson, {});
  const response = parseJson(answer?.responseJson, {});
  const points = Number(question.points || 0);

  if (question.type === "OPEN") {
    const manualScore = Math.min(Math.max(0, Number(answer?.openScore || 0)), points);
    return resolveManualScore(
      question,
      answer,
      manualScore,
      points,
      false,
      manualScore >= points ? "Развернутый ответ проверен без потери баллов." : "Развернутый ответ требует ручной проверки преподавателем.",
      []
    );
  }

  if (question.type === "SINGLE" || question.type === "MULTI") {
    const correctIds = new Set((question.options || []).filter((option) => option.isCorrect).map((option) => option.id));
    const selectedIds = new Set((answer?.selections || []).map((selection) => selection.optionId));
    const ok =
      selectedIds.size === correctIds.size &&
      Array.from(selectedIds).every((optionId) => correctIds.has(optionId));
    return resolveManualScore(
      question,
      answer,
      ok ? points : 0,
      points,
      true,
      ok ? "Выбран точный набор правильных вариантов." : "Набор выбранных вариантов не совпал с эталоном.",
      []
    );
  }

  if (question.type === "ORDER") {
    const expected = (config.items || []).map(normalizeLoose);
    const actual = Array.isArray(response.items) ? response.items.map(normalizeLoose) : [];
    const mismatchIndex = expected.findIndex((value, index) => value !== actual[index]);
    const ok = expected.length > 0 && expected.length === actual.length && mismatchIndex === -1;
    return resolveManualScore(
      question,
      answer,
      ok ? points : 0,
      points,
      true,
      ok
        ? "Шаги расположены в правильном порядке."
        : mismatchIndex >= 0
          ? `Порядок расходится с эталоном примерно на позиции ${mismatchIndex + 1}.`
          : "Порядок не совпал с ожидаемой последовательностью.",
      []
    );
  }

  if (question.type === "MATCH") {
    const expected = new Map((config.pairs || []).map((pair) => [normalizeLoose(pair.left), normalizeLoose(pair.right)]));
    const actual = normalizeLooseRecord(response.pairs);
    const mismatches = Array.from(expected.entries()).filter(([left, right]) => normalizeLoose(actual[left] || "") !== right);
    const ok = expected.size > 0 && mismatches.length === 0;
    return resolveManualScore(
      question,
      answer,
      ok ? points : 0,
      points,
      true,
      ok
        ? "Все пары сопоставлены верно."
        : `Есть ошибки в ${mismatches.length} сопоставлен${mismatches.length === 1 ? "ии" : "иях"}.`,
      mismatches.map(([left, right]) => ({ left, expected: right, actual: normalizeLoose(actual[left] || "") }))
    );
  }

  if (question.type === "CATEGORY") {
    const expectedMap = new Map();
    for (const category of config.categories || []) {
      for (const item of category.items || []) {
        expectedMap.set(normalizeLoose(item), normalizeLoose(category.name));
      }
    }
    const actual = normalizeLooseRecord(response.mapping);
    const mismatches = Array.from(expectedMap.entries()).filter(([item, category]) => normalizeLoose(actual[item] || "") !== category);
    const ok = expectedMap.size > 0 && mismatches.length === 0;
    return resolveManualScore(
      question,
      answer,
      ok ? points : 0,
      points,
      true,
      ok
        ? "Все объекты распределены по верным категориям."
        : `Есть ошибки в ${mismatches.length} распределени${mismatches.length === 1 ? "и" : "ях"} по категориям.`,
      mismatches.map(([item, category]) => ({ item, expected: category, actual: normalizeLoose(actual[item] || "") }))
    );
  }

  if (question.type === "KEYWORD") {
    const normalize = config.caseSensitive ? normalizeText : normalizeLoose;
    const typed = String(response.value || answer?.textAnswer || "");
    const ok = (config.answers || []).some((candidate) => normalize(candidate) === normalize(typed));
    return resolveManualScore(
      question,
      answer,
      ok ? points : 0,
      points,
      true,
      ok ? "Ключевое слово совпало с эталоном." : "Ключевое слово не совпало с допустимыми вариантами.",
      []
    );
  }

  if (question.type === "FORMULA") {
    const typed = String(response.value || answer?.textAnswer || "");
    const ok = (config.answers || []).some((candidate) => normalizeFormula(candidate) === normalizeFormula(typed));
    return resolveManualScore(
      question,
      answer,
      ok ? points : 0,
      points,
      true,
      ok ? "Формула распознана как корректная." : "Формула не совпала с допустимыми записями.",
      []
    );
  }

  if (question.type === "TABLE") {
    const expectedCells = config.answers || {};
    const actualCells = response.cells && typeof response.cells === "object" ? response.cells : {};
    let ok = true;
    const mismatches = [];
    for (const row of config.rows || []) {
      for (const column of config.columns || []) {
        const expectedValue = normalizeLoose(expectedCells?.[row.key]?.[column.key] || "");
        const actualValue = normalizeLoose(actualCells?.[row.key]?.[column.key] || "");
        if (expectedValue !== actualValue) {
          ok = false;
          mismatches.push({
            row: row.label,
            column: column.label,
            expected: expectedValue,
            actual: actualValue,
          });
        }
      }
    }
    return resolveManualScore(
      question,
      answer,
      ok ? points : 0,
      points,
      true,
      ok ? "Таблица заполнена корректно." : `Найдены расхождения в ${mismatches.length} ячейках таблицы.`,
      mismatches
    );
  }

  if (question.type === "CODE" || question.type === "SQL") {
    const code = String(response.value || answer?.textAnswer || "").toLowerCase();
    const expectedKeywords = (config.expectedKeywords || []).map((item) => item.toLowerCase());
    const forbiddenKeywords = (config.forbiddenKeywords || []).map((item) => item.toLowerCase());
    const missing = expectedKeywords.filter((item) => !code.includes(item));
    const forbidden = forbiddenKeywords.filter((item) => code.includes(item));
    const ok = expectedKeywords.length > 0 && missing.length === 0 && forbidden.length === 0;
    return resolveManualScore(
      question,
      answer,
      ok ? points : 0,
      points,
      true,
      ok
        ? "Код прошёл автопроверку по ключевым конструкциям."
        : `Автопроверка нашла ${missing.length ? "недостающие ключевые элементы" : ""}${missing.length && forbidden.length ? " и " : ""}${forbidden.length ? "запрещенные конструкции" : ""}.`,
      [{ missing, forbidden }]
    );
  }

  return resolveManualScore(question, answer, 0, points, true, "Ответ не прошёл проверку.", []);
}

function buildAttemptFeedback(attempt) {
  const answersByQuestion = new Map((attempt.answers || []).map((answer) => [answer.questionId, answer]));
  let reviewPendingCount = 0;

  const questions = (attempt.test?.questions || []).map((question) => {
    const answer = answersByQuestion.get(question.id) || null;
    const evaluation = evaluateQuestion(question, answer);
    if (evaluation.pendingReview) reviewPendingCount += 1;
    return {
      questionId: question.id,
      order: question.order,
      type: question.type,
      text: question.text,
      points: question.points,
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      auto: evaluation.auto,
      reason: evaluation.reason,
      details: evaluation.details,
      reviewStatus: evaluation.reviewStatus,
      reviewComment: evaluation.reviewComment,
      reviewReason: evaluation.reviewReason,
      pendingReview: evaluation.pendingReview,
      answer: summarizeAnswer(question, answer),
    };
  });

  return {
    summary: {
      totalQuestions: questions.length,
      reviewPendingCount,
      manualAdjustedCount: questions.filter((question) => question.reviewStatus === "MANUAL_REVIEWED").length,
    },
    questions,
  };
}

function computeAttemptDeadline(attempt) {
  const minutes = Number(attempt?.test?.timeLimitMinutes || 0);
  if (!minutes || minutes <= 0) return null;
  return new Date(new Date(attempt.startedAt).getTime() + minutes * 60 * 1000);
}

function mapAttemptMeta(attempt) {
  const expiresAt = computeAttemptDeadline(attempt);
  return {
    id: attempt.id,
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    autoSubmittedAt: attempt.autoSubmittedAt,
    score: attempt.score,
    maxScore: attempt.maxScore,
    tabSwitchCount: attempt.tabSwitchCount,
    activityLog: parseJson(attempt.activityLogJson, []),
    expiresAt,
  };
}

function buildAttemptReviewNotificationBody(attempt) {
  const payload = {
    kind: "TEST_REVIEW_REQUIRED",
    attemptId: attempt.id,
    testId: attempt.testId,
    studentId: attempt.studentId,
  };
  const studentLabel = attempt.student?.fullName || attempt.student?.email || `Студент #${attempt.studentId}`;
  const testTitle = attempt.test?.title || `Тест #${attempt.testId}`;
  return `Студент ${studentLabel} завершил тест "${testTitle}". Требуется ручная проверка открытого ответа.\n${JSON.stringify(payload)}`;
}

async function syncAttemptReviewNotification(prisma, attempt) {
  if (!attempt?.test?.courseId) return;

  const feedback = buildAttemptFeedback(attempt);
  const existingNotifications = await prisma.notification.findMany({
    where: {
      courseId: attempt.test.courseId,
      audience: "TEACHERS",
    },
  });

  const matchingNotifications = existingNotifications.filter((notification) =>
    String(notification.body || "").includes(`"kind":"TEST_REVIEW_REQUIRED"`) &&
    String(notification.body || "").includes(`"attemptId":${attempt.id}`)
  );

  if (feedback.summary.reviewPendingCount > 0) {
    if (matchingNotifications.length) return;
    await prisma.notification.create({
      data: {
        title: "Нужна проверка теста",
        body: buildAttemptReviewNotificationBody(attempt),
        audience: "TEACHERS",
        courseId: attempt.test.courseId,
        createdById: attempt.studentId,
      },
    });
    return;
  }

  if (matchingNotifications.length) {
    await prisma.notification.deleteMany({
      where: {
        id: {
          in: matchingNotifications.map((notification) => notification.id),
        },
      },
    });
  }
}

async function finalizeAttempt(prisma, attemptId, forced = false) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      test: {
        include: {
          questions: {
            include: {
              options: true,
            },
            orderBy: { order: "asc" },
          },
        },
      },
      student: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      answers: {
        include: {
          selections: true,
        },
      },
    },
  });

  if (!attempt) return null;

  const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
  let score = 0;
  let maxScore = 0;

  for (const question of attempt.test.questions) {
    const result = evaluateQuestion(question, answersByQuestion.get(question.id));
    score += result.score;
    maxScore += result.maxScore;
  }

  const updated = await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      finishedAt: attempt.finishedAt || new Date(),
      autoSubmittedAt: forced && !attempt.autoSubmittedAt ? new Date() : attempt.autoSubmittedAt,
      score,
      maxScore,
    },
    include: {
      test: {
        include: {
          questions: {
            include: {
              options: true,
            },
            orderBy: { order: "asc" },
          },
        },
      },
      student: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      answers: {
        include: {
          selections: true,
        },
      },
    },
  });

  await syncAttemptReviewNotification(prisma, updated);
  return updated;
}

async function ensureTeacherAccess(prisma, testId, user) {
  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) return { error: { status: 404, message: "РўРµСЃС‚ РЅРµ РЅР°Р№РґРµРЅ." } };
  if (user.role !== "ADMIN" && test.teacherId !== user.sub) {
    return { error: { status: 403, message: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ." } };
  }
  return { test };
}

module.exports = function registerTestRoutes(app, deps) {
  const { prisma, authRequired, requireRole, appendAuditEntry, ok, error } = deps;
  const uploadsRoot = path.join(__dirname, "..", "uploads", "test-answers");

  app.use((req, res, next) => {
    const path = req.path || "";
    const isTestPath =
      path.startsWith("/tests") ||
      path.startsWith("/attempts") ||
      path.startsWith("/my-attempts") ||
      /\/courses\/\d+\/tests(?:\/|$)/.test(path);

    if (!isTestPath) return next();

    const originalJson = res.json.bind(res);
    res.json = (payload) => originalJson(sanitizePayload(payload));
    next();
  });

  app.post("/courses/:courseId/tests", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const courseId = Number(req.params.courseId);
      const {
        title,
        description = "",
        instructions = "",
        timeLimitMinutes = 20,
        tabSwitchLimit = 3,
        attemptLimit = 1,
        availableFrom = null,
      } = req.body || {};

      if (!Number.isInteger(courseId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РєСѓСЂСЃР°." });
      }

      if (normalizeText(title).length < 3) {
        return res.status(400).json({ ok: false, error: "РќР°Р·РІР°РЅРёРµ С‚РµСЃС‚Р° РґРѕР»Р¶РЅРѕ СЃРѕРґРµСЂР¶Р°С‚СЊ РјРёРЅРёРјСѓРј 3 СЃРёРјРІРѕР»Р°." });
      }

      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return res.status(404).json({ ok: false, error: "РљСѓСЂСЃ РЅРµ РЅР°Р№РґРµРЅ." });
      if (req.auth.role !== "ADMIN" && course.teacherId !== req.auth.sub) {
        return res.status(403).json({ ok: false, error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ." });
      }

      const test = await prisma.test.create({
        data: {
          title: normalizeText(title),
          description: String(description || ""),
          instructions: String(instructions || ""),
          timeLimitMinutes: Math.max(1, Number(timeLimitMinutes) || 20),
          tabSwitchLimit: normalizeTabSwitchLimit(tabSwitchLimit),
          attemptLimit: normalizeAttemptLimit(attemptLimit),
          availableFrom: availableFrom ? new Date(availableFrom) : null,
          courseId,
          teacherId: course.teacherId,
        },
      });

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: "TEST_CREATED",
        entityType: "test",
        entityId: test.id,
        courseId,
        summary: `РЎРѕР·РґР°РЅ С‚РµСЃС‚ "${test.title}"`,
      });

      return ok(res, { test });
    } catch (err) {
      return error(res, 400, String(err.message || err));
    }
  });

  app.put("/tests/:testId", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const testId = Number(req.params.testId);
      if (!Number.isInteger(testId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ С‚РµСЃС‚Р°." });
      }

      const access = await ensureTeacherAccess(prisma, testId, req.auth);
      if (access.error) return res.status(access.error.status).json({ ok: false, error: access.error.message });

      const {
        title,
        description = "",
        instructions = "",
        timeLimitMinutes = 20,
        tabSwitchLimit = 3,
        attemptLimit = 1,
        availableFrom = null,
      } = req.body || {};

      if (normalizeText(title).length < 3) {
        return res.status(400).json({ ok: false, error: "РќР°Р·РІР°РЅРёРµ С‚РµСЃС‚Р° РґРѕР»Р¶РЅРѕ СЃРѕРґРµСЂР¶Р°С‚СЊ РјРёРЅРёРјСѓРј 3 СЃРёРјРІРѕР»Р°." });
      }

      const test = await prisma.test.update({
        where: { id: testId },
        data: {
          title: normalizeText(title),
          description: String(description || ""),
          instructions: String(instructions || ""),
          timeLimitMinutes: Math.max(1, Number(timeLimitMinutes) || 20),
          tabSwitchLimit: normalizeTabSwitchLimit(tabSwitchLimit),
          attemptLimit: normalizeAttemptLimit(attemptLimit),
          availableFrom: availableFrom ? new Date(availableFrom) : null,
        },
      });

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: "TEST_UPDATED",
        entityType: "test",
        entityId: test.id,
        courseId: access.test.courseId,
        summary: `РћР±РЅРѕРІР»С‘РЅ С‚РµСЃС‚ "${test.title}"`,
      });

      return ok(res, { test });
    } catch (err) {
      return error(res, 400, String(err.message || err));
    }
  });

  app.post("/tests/:testId/duplicate", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const testId = Number(req.params.testId);
      const { title, courseId } = req.body || {};
      if (!Number.isInteger(testId)) {
        return error(res, 400, "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ С‚РµСЃС‚Р°.");
      }

      const access = await ensureTeacherAccess(prisma, testId, req.auth);
      if (access.error) return error(res, access.error.status, access.error.message);

      const source = await prisma.test.findUnique({
        where: { id: testId },
        include: {
          questions: {
            include: { options: true },
            orderBy: { order: "asc" },
          },
        },
      });

      const targetCourseId = Number.isInteger(courseId) ? courseId : source.courseId;
      const duplicated = await prisma.$transaction(async (tx) => {
        const nextTest = await tx.test.create({
          data: {
            title: normalizeText(title || `${source.title} (РєРѕРїРёСЏ)`),
            description: source.description,
            instructions: source.instructions,
            isPublished: false,
            timeLimitMinutes: source.timeLimitMinutes,
            tabSwitchLimit: source.tabSwitchLimit,
            attemptLimit: source.attemptLimit,
            courseId: targetCourseId,
            teacherId: source.teacherId,
          },
        });

        for (const question of source.questions) {
          await tx.question.create({
            data: {
              type: question.type,
              text: question.text,
              configJson: question.configJson,
              points: question.points,
              order: question.order,
              testId: nextTest.id,
              options: question.options?.length
                ? {
                    create: question.options.map((option) => ({
                      text: option.text,
                      isCorrect: option.isCorrect,
                    })),
                  }
                : undefined,
            },
          });
        }

        return nextTest;
      });

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: "TEST_DUPLICATED",
        entityType: "test",
        entityId: duplicated.id,
        courseId: duplicated.courseId,
        summary: `РўРµСЃС‚ "${source.title}" РїСЂРѕРґСѓР±Р»РёСЂРѕРІР°РЅ РІ "${duplicated.title}"`,
      });

      return ok(res, { test: duplicated });
    } catch (err) {
      return error(res, 400, String(err.message || err));
    }
  });

  app.post("/courses/:courseId/tests/batch", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const courseId = Number(req.params.courseId);
      const { ids = [], action } = req.body || {};
      if (!Number.isInteger(courseId)) return error(res, 400, "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РєСѓСЂСЃР°.");
      if (!Array.isArray(ids) || !ids.length) return error(res, 400, "Р’С‹Р±РµСЂРёС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ С‚РµСЃС‚.");

      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return error(res, 404, "РљСѓСЂСЃ РЅРµ РЅР°Р№РґРµРЅ.");
      if (req.auth.role !== "ADMIN" && course.teacherId !== req.auth.sub) return error(res, 403, "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ.");

      const normalizedIds = ids.map(Number).filter(Number.isInteger);
      if (action === "publish") {
        await prisma.test.updateMany({ where: { id: { in: normalizedIds }, courseId }, data: { isPublished: true } });
      } else if (action === "unpublish") {
        await prisma.test.updateMany({ where: { id: { in: normalizedIds }, courseId }, data: { isPublished: false } });
      } else if (action === "delete") {
        const answers = await prisma.answer.findMany({
          where: { attempt: { testId: { in: normalizedIds } } },
          select: { id: true, attachmentsJson: true },
        });
        answers.forEach((answer) => removeStoredAttachments(safeParseJsonArray(answer.attachmentsJson)));
        const answerIds = answers.map((item) => item.id);
        if (answerIds.length) {
          await prisma.answerSelection.deleteMany({ where: { answerId: { in: answerIds } } });
        }
        await prisma.answer.deleteMany({ where: { attempt: { testId: { in: normalizedIds } } } });
        await prisma.attempt.deleteMany({ where: { testId: { in: normalizedIds } } });
        await prisma.option.deleteMany({ where: { question: { testId: { in: normalizedIds } } } });
        await prisma.question.deleteMany({ where: { testId: { in: normalizedIds } } });
        await prisma.test.deleteMany({ where: { id: { in: normalizedIds }, courseId } });
      } else {
        return error(res, 400, "РќРµРєРѕСЂСЂРµРєС‚РЅРѕРµ РјР°СЃСЃРѕРІРѕРµ РґРµР№СЃС‚РІРёРµ.");
      }

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: "TEST_BATCH_UPDATED",
        entityType: "test",
        entityId: null,
        courseId,
        summary: `РњР°СЃСЃРѕРІРѕРµ РґРµР№СЃС‚РІРёРµ РЅР°Рґ С‚РµСЃС‚Р°РјРё: ${action}`,
        meta: { ids: normalizedIds },
      });

      return ok(res);
    } catch (err) {
      return error(res, 400, String(err.message || err));
    }
  });

  app.delete("/tests/:testId", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const testId = Number(req.params.testId);
      if (!Number.isInteger(testId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ С‚РµСЃС‚Р°." });
      }

      const access = await ensureTeacherAccess(prisma, testId, req.auth);
      if (access.error) return res.status(access.error.status).json({ ok: false, error: access.error.message });

      const answers = await prisma.answer.findMany({
        where: { attempt: { testId } },
        select: { id: true, attachmentsJson: true },
      });
      answers.forEach((answer) => removeStoredAttachments(safeParseJsonArray(answer.attachmentsJson)));
      const answerIds = answers.map((answer) => answer.id);

      if (answerIds.length) {
        await prisma.answerSelection.deleteMany({ where: { answerId: { in: answerIds } } });
      }
      await prisma.testAttemptAllowance.deleteMany({ where: { testId } });
      await prisma.answer.deleteMany({ where: { attempt: { testId } } });
      await prisma.attempt.deleteMany({ where: { testId } });
      await prisma.option.deleteMany({ where: { question: { testId } } });
      await prisma.question.deleteMany({ where: { testId } });
      await prisma.test.delete({ where: { id: testId } });

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: "TEST_DELETED",
        entityType: "test",
        entityId: testId,
        courseId: access.test.courseId,
        summary: `РЈРґР°Р»С‘РЅ С‚РµСЃС‚ "${access.test.title}"`,
      });

      return ok(res);
    } catch (err) {
      return error(res, 400, String(err.message || err));
    }
  });

  app.post("/tests/:testId/publish", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const testId = Number(req.params.testId);
      if (!Number.isInteger(testId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ С‚РµСЃС‚Р°." });
      }
      const access = await ensureTeacherAccess(prisma, testId, req.auth);
      if (access.error) return res.status(access.error.status).json({ ok: false, error: access.error.message });

      const { availableFrom = null } = req.body || {};
      const published = await prisma.test.update({
        where: { id: testId },
        data: {
          isPublished: true,
          availableFrom: availableFrom ? new Date(availableFrom) : null,
        },
      });
      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: "TEST_PUBLISHED",
        entityType: "test",
        entityId: published.id,
        courseId: published.courseId,
        summary: `РћРїСѓР±Р»РёРєРѕРІР°РЅ С‚РµСЃС‚ "${published.title}"`,
      });
      return ok(res, { test: published });
    } catch (err) {
      return error(res, 400, String(err.message || err));
    }
  });

  app.post("/tests/:testId/unpublish", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const testId = Number(req.params.testId);
      if (!Number.isInteger(testId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ С‚РµСЃС‚Р°." });
      }
      const access = await ensureTeacherAccess(prisma, testId, req.auth);
      if (access.error) return res.status(access.error.status).json({ ok: false, error: access.error.message });

      const unpublished = await prisma.test.update({
        where: { id: testId },
        data: { isPublished: false },
      });
      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: "TEST_UNPUBLISHED",
        entityType: "test",
        entityId: unpublished.id,
        courseId: unpublished.courseId,
        summary: `РЎРЅСЏС‚ СЃ РїСѓР±Р»РёРєР°С†РёРё С‚РµСЃС‚ "${unpublished.title}"`,
      });
      return ok(res, { test: unpublished });
    } catch (err) {
      return error(res, 400, String(err.message || err));
    }
  });

  app.post("/tests/:testId/questions", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const testId = Number(req.params.testId);
      if (!Number.isInteger(testId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ С‚РµСЃС‚Р°." });
      }

      const access = await ensureTeacherAccess(prisma, testId, req.auth);
      if (access.error) return res.status(access.error.status).json({ ok: false, error: access.error.message });

      const {
        type,
        text,
        points = 1,
        order = 0,
        options = [],
        config = {},
      } = req.body || {};

      const error = validateQuestionPayload(type, text, points, order, options, config);
      if (error) return res.status(400).json({ ok: false, error });

      const normalizedType = String(type).toUpperCase();
      const storedConfig = buildStoredConfig(normalizedType, config);

      const question = await prisma.question.create({
        data: {
          testId,
          type: normalizedType,
          text: normalizeText(text),
          points: Number(points),
          order: Number(order),
          configJson: stringifyJson(storedConfig),
          options:
            normalizedType === "SINGLE" || normalizedType === "MULTI"
              ? {
                  create: options
                    .map((option) => ({
                      text: normalizeText(option?.text),
                      isCorrect: !!option?.isCorrect,
                    }))
                    .filter((option) => option.text),
                }
              : undefined,
        },
        include: { options: true },
      });

      return res.json({ ok: true, question: hydrateTeacherQuestion(question) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.put("/questions/:questionId", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const questionId = Number(req.params.questionId);
      if (!Number.isInteger(questionId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РІРѕРїСЂРѕСЃР°." });
      }

      const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: { test: true, options: true },
      });
      if (!question) return res.status(404).json({ ok: false, error: "Р’РѕРїСЂРѕСЃ РЅРµ РЅР°Р№РґРµРЅ." });
      if (req.auth.role !== "ADMIN" && question.test.teacherId !== req.auth.sub) {
        return res.status(403).json({ ok: false, error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ." });
      }

      const {
        type,
        text,
        points = 1,
        order = 0,
        options = [],
        config = {},
      } = req.body || {};

      const error = validateQuestionPayload(type, text, points, order, options, config);
      if (error) return res.status(400).json({ ok: false, error });

      const normalizedType = String(type).toUpperCase();
      const storedConfig = buildStoredConfig(normalizedType, config);

      await prisma.option.deleteMany({ where: { questionId } });
      const updated = await prisma.question.update({
        where: { id: questionId },
        data: {
          type: normalizedType,
          text: normalizeText(text),
          points: Number(points),
          order: Number(order),
          configJson: stringifyJson(storedConfig),
          options:
            normalizedType === "SINGLE" || normalizedType === "MULTI"
              ? {
                  create: options
                    .map((option) => ({
                      text: normalizeText(option?.text),
                      isCorrect: !!option?.isCorrect,
                    }))
                    .filter((option) => option.text),
                }
              : undefined,
        },
        include: { options: true },
      });

      return res.json({ ok: true, question: hydrateTeacherQuestion(updated) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.delete("/questions/:questionId", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const questionId = Number(req.params.questionId);
      if (!Number.isInteger(questionId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РІРѕРїСЂРѕСЃР°." });
      }

      const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: { test: true },
      });
      if (!question) return res.status(404).json({ ok: false, error: "Р’РѕРїСЂРѕСЃ РЅРµ РЅР°Р№РґРµРЅ." });
      if (req.auth.role !== "ADMIN" && question.test.teacherId !== req.auth.sub) {
        return res.status(403).json({ ok: false, error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ." });
      }

      const answers = await prisma.answer.findMany({
        where: { questionId },
        select: { id: true, attachmentsJson: true },
      });
      answers.forEach((answer) => removeStoredAttachments(safeParseJsonArray(answer.attachmentsJson)));
      const answerIds = answers.map((answer) => answer.id);
      if (answerIds.length) {
        await prisma.answerSelection.deleteMany({ where: { answerId: { in: answerIds } } });
      }
      await prisma.answer.deleteMany({ where: { questionId } });
      await prisma.option.deleteMany({ where: { questionId } });
      await prisma.question.delete({ where: { id: questionId } });

      return res.json({ ok: true });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.get("/courses/:courseId/tests", authRequired, async (req, res) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!Number.isInteger(courseId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РєСѓСЂСЃР°." });
      }

      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return res.status(404).json({ ok: false, error: "РљСѓСЂСЃ РЅРµ РЅР°Р№РґРµРЅ." });

      if (req.auth.role === "TEACHER" && course.teacherId !== req.auth.sub) {
        return res.status(403).json({ ok: false, error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ." });
      }

      if (req.auth.role === "STUDENT") {
        const enrolled = await prisma.enrollment.findFirst({
          where: { courseId, studentId: req.auth.sub },
        });
        if (!enrolled) return res.status(403).json({ ok: false, error: "Р’С‹ РЅРµ Р·Р°РїРёСЃР°РЅС‹ РЅР° СЌС‚РѕС‚ РєСѓСЂСЃ." });
      }

      const activeAttempt = req.auth.role === "STUDENT"
        ? await findActiveAttempt(prisma, req.auth.sub)
        : null;

      const tests = await prisma.test.findMany({
        where: {
          courseId,
          ...(req.auth.role === "STUDENT" ? { isPublished: true } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          questions: true,
        },
      });

      return res.json({
        ok: true,
        tests: await Promise.all(
          tests.map(async (test) => {
            if (req.auth.role !== "STUDENT") {
              const finishedAttempts = await prisma.attempt.findMany({
                where: {
                  testId: test.id,
                  finishedAt: { not: null },
                },
                include: {
                  test: {
                    include: {
                      questions: {
                        include: {
                          options: true,
                        },
                        orderBy: { order: "asc" },
                      },
                    },
                  },
                  answers: {
                    include: {
                      selections: true,
                    },
                  },
                },
              });
              return {
                ...test,
                questionCount: test.questions.length,
                availableFrom: test.availableFrom,
                pendingReviewCount: finishedAttempts.filter((attempt) => buildAttemptFeedback(attempt).summary.reviewPendingCount > 0).length,
              };
            }

            const attempts = await prisma.attempt.findMany({
              where: { testId: test.id, studentId: req.auth.sub },
              select: { id: true, finishedAt: true },
            });

            const extraAttempts = await getAttemptAllowance(prisma, test.id, req.auth.sub);
            const attemptsUsed = attempts.filter((attempt) => !!attempt.finishedAt).length;
            const baseAttemptLimit = normalizeAttemptLimit(test.attemptLimit);
            const hasUnlimitedAttempts = baseAttemptLimit === 0;
            const activeAttemptId = attempts.find((attempt) => !attempt.finishedAt)?.id || null;
            const attemptLimit = hasUnlimitedAttempts ? 0 : baseAttemptLimit + extraAttempts;
            const now = Date.now();
            const availableFromTime = test.availableFrom ? new Date(test.availableFrom).getTime() : null;
            const dateBlocked = availableFromTime != null && availableFromTime > now;
            const attemptsBlocked = !hasUnlimitedAttempts && attemptsUsed >= attemptLimit;
            const blockedByOtherAttempt = !!activeAttempt && activeAttempt.testId !== test.id;

            return {
              ...test,
              questionCount: test.questions.length,
              attemptsUsed,
              baseAttemptLimit,
              extraAttempts,
              activeAttemptId,
              attemptLimit,
              remainingAttempts: hasUnlimitedAttempts ? null : Math.max(0, attemptLimit - attemptsUsed),
              canStart: !dateBlocked && !attemptsBlocked && !blockedByOtherAttempt,
              startBlockedReason: blockedByOtherAttempt
                ? `Сначала завершите или продолжите текущий тест "${activeAttempt.test.title}".`
                : dateBlocked
                  ? `Тест откроется ${new Date(test.availableFrom).toLocaleString("ru-RU")}.`
                  : attemptsBlocked
                    ? `Лимит попыток исчерпан: ${attemptsUsed} из ${attemptLimit}.`
                    : "",
            };
          })
        ),
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.get("/tests/:testId", authRequired, async (req, res) => {
    try {
      const testId = Number(req.params.testId);
      if (!Number.isInteger(testId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ С‚РµСЃС‚Р°." });
      }

      const test = await prisma.test.findUnique({
        where: { id: testId },
        include: {
          questions: {
            include: { options: true },
            orderBy: { order: "asc" },
          },
        },
      });

      if (!test) return res.status(404).json({ ok: false, error: "РўРµСЃС‚ РЅРµ РЅР°Р№РґРµРЅ." });

      if (req.auth.role === "STUDENT") {
        const enrolled = await prisma.enrollment.findFirst({
          where: { courseId: test.courseId, studentId: req.auth.sub },
        });
        if (!enrolled) return res.status(403).json({ ok: false, error: "Р’С‹ РЅРµ Р·Р°РїРёСЃР°РЅС‹ РЅР° СЌС‚РѕС‚ РєСѓСЂСЃ." });
        if (!test.isPublished) return res.status(404).json({ ok: false, error: "РўРµСЃС‚ РїРѕРєР° РЅРµ РѕРїСѓР±Р»РёРєРѕРІР°РЅ." });
        if (test.availableFrom && new Date(test.availableFrom).getTime() > Date.now()) {
          return res.status(403).json({ ok: false, error: `РўРµСЃС‚ РѕС‚РєСЂРѕРµС‚СЃСЏ ${new Date(test.availableFrom).toLocaleString("ru-RU")}.` });
        }
        return res.json({
          ok: true,
          test: {
            ...test,
            questions: test.questions.map(sanitizeQuestionForStudent),
          },
        });
      }

      if (req.auth.role === "TEACHER" && test.teacherId !== req.auth.sub) {
        return res.status(403).json({ ok: false, error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ." });
      }

      return res.json({
        ok: true,
        test: {
          ...test,
          questions: test.questions.map(hydrateTeacherQuestion),
        },
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.post("/tests/:testId/start", authRequired, requireRole("STUDENT"), async (req, res) => {
    try {
      const testId = Number(req.params.testId);
      if (!Number.isInteger(testId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ С‚РµСЃС‚Р°." });
      }

      const test = await prisma.test.findUnique({ where: { id: testId } });
      if (!test || !test.isPublished) {
        return res.status(404).json({ ok: false, error: "РўРµСЃС‚ РЅРµ РЅР°Р№РґРµРЅ РёР»Рё РµС‰Рµ РЅРµ РѕРїСѓР±Р»РёРєРѕРІР°РЅ." });
      }
      if (test.availableFrom && new Date(test.availableFrom).getTime() > Date.now()) {
        return res.status(400).json({ ok: false, error: `РўРµСЃС‚ РѕС‚РєСЂРѕРµС‚СЃСЏ ${new Date(test.availableFrom).toLocaleString("ru-RU")}.` });
      }

      const enrolled = await prisma.enrollment.findFirst({
        where: { courseId: test.courseId, studentId: req.auth.sub },
      });
      if (!enrolled) return res.status(403).json({ ok: false, error: "Р’С‹ РЅРµ Р·Р°РїРёСЃР°РЅС‹ РЅР° СЌС‚РѕС‚ РєСѓСЂСЃ." });

      const existingAttempt = await findActiveAttempt(prisma, req.auth.sub, testId);
      if (existingAttempt) {
        return res.json({ ok: true, attempt: mapAttemptMeta(existingAttempt), resumed: true });
      }

      const activeAttempt = await findActiveAttempt(prisma, req.auth.sub);

      if (activeAttempt) {
        return res.status(400).json({
          ok: false,
          error: `Сначала завершите или продолжите текущий тест "${activeAttempt.test.title}".`,
          code: "ACTIVE_ATTEMPT_EXISTS",
          activeAttemptId: activeAttempt.id,
          activeTestId: activeAttempt.testId,
        });
      }

      const finishedAttemptsCount = await prisma.attempt.count({
        where: {
          testId,
          studentId: req.auth.sub,
          finishedAt: { not: null },
        },
      });

      const extraAttempts = await getAttemptAllowance(prisma, testId, req.auth.sub);
      const baseAttemptLimit = normalizeAttemptLimit(test.attemptLimit);
      const hasUnlimitedAttempts = baseAttemptLimit === 0;
      const allowedAttempts = hasUnlimitedAttempts ? 0 : baseAttemptLimit + extraAttempts;
      if (!hasUnlimitedAttempts && finishedAttemptsCount >= allowedAttempts) {
        return res.status(400).json({
          ok: false,
          error: `Р›РёРјРёС‚ РїРѕРїС‹С‚РѕРє РёСЃС‡РµСЂРїР°РЅ: ${finishedAttemptsCount} РёР· ${allowedAttempts}.`,
          code: "ATTEMPTS_EXHAUSTED",
          attemptsUsed: finishedAttemptsCount,
          attemptLimit: allowedAttempts,
          baseAttemptLimit,
          extraAttempts,
        });
      }

      const created = await prisma.attempt.create({
        data: {
          testId,
          studentId: req.auth.sub,
        },
        include: { test: true },
      });

      return res.json({
        ok: true,
        attempt: mapAttemptMeta(created),
        attemptsUsed: finishedAttemptsCount,
        attemptLimit: allowedAttempts,
        baseAttemptLimit,
        extraAttempts,
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.get("/attempts/:attemptId/state", authRequired, requireRole("STUDENT"), async (req, res) => {
    try {
      const attemptId = Number(req.params.attemptId);
      if (!Number.isInteger(attemptId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ РїРѕРїС‹С‚РєР°." });
      }

      const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
          test: true,
          answers: {
            include: { selections: true },
          },
        },
      });

      if (!attempt) return res.status(404).json({ ok: false, error: "РџРѕРїС‹С‚РєР° РЅРµ РЅР°Р№РґРµРЅР°." });
      if (attempt.studentId !== req.auth.sub) return res.status(403).json({ ok: false, error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ." });

      const expiresAt = computeAttemptDeadline(attempt);
      if (!attempt.finishedAt && expiresAt && expiresAt.getTime() <= Date.now()) {
        const finalized = await finalizeAttempt(prisma, attempt.id, true);
        return res.json({
          ok: true,
          attempt: mapAttemptMeta(finalized),
          answers: {},
          feedback: buildAttemptFeedback(finalized),
          autoFinished: true,
        });
      }

      const answers = Object.fromEntries(
        attempt.answers.map((answer) => [
          answer.questionId,
          {
            textAnswer: answer.textAnswer,
            response: parseJson(answer.responseJson, {}),
            attachments: safeParseJsonArray(answer.attachmentsJson),
            optionIds: answer.selections.map((selection) => selection.optionId),
            openScore: answer.openScore || 0,
          },
        ])
      );

      return res.json({
        ok: true,
        attempt: mapAttemptMeta(attempt),
        answers,
        feedback: attempt.finishedAt
          ? buildAttemptFeedback({
              ...attempt,
              test: {
                ...attempt.test,
                questions: await prisma.question.findMany({
                  where: { testId: attempt.testId },
                  include: { options: true },
                  orderBy: { order: "asc" },
                }),
              },
            })
          : null,
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.post("/attempts/:attemptId/activity", authRequired, requireRole("STUDENT"), async (req, res) => {
    try {
      const attemptId = Number(req.params.attemptId);
      const type = normalizeText(req.body?.type || "TAB_SWITCH") || "TAB_SWITCH";
      if (!Number.isInteger(attemptId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ РїРѕРїС‹С‚РєР°." });
      }

      const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: { test: true },
      });

      if (!attempt) return res.status(404).json({ ok: false, error: "РџРѕРїС‹С‚РєР° РЅРµ РЅР°Р№РґРµРЅР°." });
      if (attempt.studentId !== req.auth.sub) return res.status(403).json({ ok: false, error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ." });
      if (attempt.finishedAt) return res.json({ ok: true, attempt: mapAttemptMeta(attempt), locked: true });

      const nextLog = [...parseJson(attempt.activityLogJson, []), { type, createdAt: new Date().toISOString() }];
      const nextCount = type === "TAB_SWITCH" ? Number(attempt.tabSwitchCount || 0) + 1 : Number(attempt.tabSwitchCount || 0);

      const updated = await prisma.attempt.update({
        where: { id: attemptId },
        data: {
          tabSwitchCount: nextCount,
          activityLogJson: stringifyJson(nextLog),
        },
        include: { test: true },
      });

      const tabSwitchLimit = normalizeTabSwitchLimit(updated.test.tabSwitchLimit);
      if (type === "TAB_SWITCH" && tabSwitchLimit > 0 && nextCount >= tabSwitchLimit) {
        const finalized = await finalizeAttempt(prisma, attemptId, true);
        return res.json({ ok: true, attempt: mapAttemptMeta(finalized), locked: true, autoFinished: true });
      }

      return res.json({ ok: true, attempt: mapAttemptMeta(updated), locked: false });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.post("/attempts/:attemptId/answer", authRequired, requireRole("STUDENT"), async (req, res) => {
    try {
      const attemptId = Number(req.params.attemptId);
      const { questionId, optionIds = [], textAnswer = "", response = {}, attachments = [] } = req.body || {};

      if (!Number.isInteger(attemptId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ РїРѕРїС‹С‚РєР°." });
      }
      if (!Number.isInteger(Number(questionId))) {
        return res.status(400).json({ ok: false, error: "Р’С‹Р±РµСЂРёС‚Рµ РІРѕРїСЂРѕСЃ." });
      }

      const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: { test: true },
      });
      if (!attempt) return res.status(404).json({ ok: false, error: "РџРѕРїС‹С‚РєР° РЅРµ РЅР°Р№РґРµРЅР°." });
      if (attempt.studentId !== req.auth.sub) return res.status(403).json({ ok: false, error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ." });
      if (attempt.finishedAt) return res.status(400).json({ ok: false, error: "РџРѕРїС‹С‚РєР° СѓР¶Рµ Р·Р°РІРµСЂС€РµРЅР°." });

      const expiresAt = computeAttemptDeadline(attempt);
      if (expiresAt && expiresAt.getTime() <= Date.now()) {
        const finalized = await finalizeAttempt(prisma, attempt.id, true);
        return res.status(400).json({
          ok: false,
          error: "Р’СЂРµРјСЏ С‚РµСЃС‚Р° РёСЃС‚РµРєР»Рѕ.",
          attempt: mapAttemptMeta(finalized),
          autoFinished: true,
        });
      }

      const question = await prisma.question.findUnique({
        where: { id: Number(questionId) },
        include: { options: true },
      });
      if (!question) return res.status(404).json({ ok: false, error: "Р’РѕРїСЂРѕСЃ РЅРµ РЅР°Р№РґРµРЅ." });
      if (question.testId !== attempt.testId) {
        return res.status(400).json({ ok: false, error: "Р’РѕРїСЂРѕСЃ РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє СЌС‚РѕР№ РїРѕРїС‹С‚РєРµ." });
      }

      const existingAnswer = await prisma.answer.findUnique({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId: Number(questionId),
          },
        },
      });

      const answer = await prisma.answer.upsert({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId: Number(questionId),
          },
        },
        update: {
          textAnswer:
            question.type === "OPEN" ||
            question.type === "KEYWORD" ||
            question.type === "FORMULA" ||
            question.type === "CODE" ||
            question.type === "SQL"
              ? String(textAnswer || "")
              : "",
          responseJson: stringifyJson(response || {}),
          attachmentsJson: question.type === "OPEN" ? existingAnswer?.attachmentsJson || "[]" : "[]",
        },
        create: {
          attemptId,
          questionId: Number(questionId),
          textAnswer:
            question.type === "OPEN" ||
            question.type === "KEYWORD" ||
            question.type === "FORMULA" ||
            question.type === "CODE" ||
            question.type === "SQL"
              ? String(textAnswer || "")
              : "",
          responseJson: stringifyJson(response || {}),
          attachmentsJson: "[]",
        },
      });

      if (question.type === "OPEN") {
        const previousAttachments = safeParseJsonArray(existingAnswer?.attachmentsJson);
        const preservedRelativePaths = new Set(
          Array.isArray(attachments)
            ? attachments
                .map((file) => (file?.relativePath && file?.url ? String(file.relativePath) : ""))
                .filter((relativePath) => previousAttachments.some((item) => item.relativePath === relativePath))
            : []
        );
        const preservedAttachments = previousAttachments.filter((file) => preservedRelativePaths.has(file.relativePath));
        const attachmentsToRemove = previousAttachments.filter((file) => !preservedRelativePaths.has(file.relativePath));
        const incomingAttachments = normalizeIncomingAttachments(attachments);
        const trimmedText = String(textAnswer || "").trim();
        if (attachmentsToRemove.length) {
          removeStoredAttachments(attachmentsToRemove);
        }
        if (!trimmedText && preservedAttachments.length === 0 && incomingAttachments.length === 0) {
          await prisma.answer.update({
            where: { id: answer.id },
            data: { attachmentsJson: "[]" },
          });
        } else if (incomingAttachments.length > 0 || attachmentsToRemove.length > 0 || preservedAttachments.length !== previousAttachments.length) {
          const storedAttachments = persistAttachments(uploadsRoot, answer.id, attempt.studentId, Number(questionId), incomingAttachments);
          await prisma.answer.update({
            where: { id: answer.id },
            data: { attachmentsJson: JSON.stringify([...preservedAttachments, ...storedAttachments]) },
          });
        }
      }

      await prisma.answerSelection.deleteMany({ where: { answerId: answer.id } });
      if (question.type === "SINGLE" || question.type === "MULTI") {
        const validOptionIds = Array.isArray(optionIds)
          ? optionIds.map(Number).filter((id) => Number.isInteger(id))
          : [];
        const allowed = new Set((question.options || []).map((option) => option.id));
        const finalIds = validOptionIds.filter((optionId) => allowed.has(optionId));
        if (finalIds.length) {
          await prisma.answerSelection.createMany({
            data: finalIds.map((optionId) => ({
              answerId: answer.id,
              optionId,
            })),
          });
        }
      }

      return res.json({ ok: true, answerId: answer.id });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.post("/attempts/:attemptId/finish", authRequired, requireRole("STUDENT"), async (req, res) => {
    try {
      const attemptId = Number(req.params.attemptId);
      if (!Number.isInteger(attemptId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ РїРѕРїС‹С‚РєР°." });
      }

      const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
      if (!attempt) return res.status(404).json({ ok: false, error: "РџРѕРїС‹С‚РєР° РЅРµ РЅР°Р№РґРµРЅР°." });
      if (attempt.studentId !== req.auth.sub) return res.status(403).json({ ok: false, error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ." });

      const updated = await finalizeAttempt(prisma, attemptId, false);
      return res.json({
        ok: true,
        attempt: mapAttemptMeta(updated),
        feedback: buildAttemptFeedback(updated),
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.get("/tests/:testId/my-attempts", authRequired, requireRole("STUDENT"), async (req, res) => {
    try {
      const testId = Number(req.params.testId);
      if (!Number.isInteger(testId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ С‚РµСЃС‚Р°." });
      }

      const test = await prisma.test.findUnique({ where: { id: testId } });
      if (!test) return res.status(404).json({ ok: false, error: "РўРµСЃС‚ РЅРµ РЅР°Р№РґРµРЅ." });

      const enrolled = await prisma.enrollment.findFirst({
        where: { courseId: test.courseId, studentId: req.auth.sub },
      });
      if (!enrolled) return res.status(403).json({ ok: false, error: "Р’С‹ РЅРµ Р·Р°РїРёСЃР°РЅС‹ РЅР° СЌС‚РѕС‚ РєСѓСЂСЃ." });

      const attempts = await prisma.attempt.findMany({
        where: { testId, studentId: req.auth.sub },
        orderBy: { startedAt: "desc" },
      });

      const baseAttemptLimit = normalizeAttemptLimit(test.attemptLimit);
      const extraAttempts = await getAttemptAllowance(prisma, testId, req.auth.sub);

      return res.json({
        ok: true,
        attempts: attempts.map(mapAttemptMeta),
        attemptLimit: baseAttemptLimit === 0 ? 0 : baseAttemptLimit + extraAttempts,
        attemptsUsed: attempts.filter((attempt) => !!attempt.finishedAt).length,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.post("/tests/:testId/request-attempt", authRequired, requireRole("STUDENT"), async (req, res) => {
    try {
      const testId = Number(req.params.testId);
      if (!Number.isInteger(testId)) {
        return res.status(400).json({ ok: false, error: "Некорректный идентификатор теста." });
      }

      const test = await prisma.test.findUnique({
        where: { id: testId },
        include: { course: true },
      });
      if (!test || !test.isPublished) {
        return res.status(404).json({ ok: false, error: "Тест не найден или еще не опубликован." });
      }

      const student = await prisma.user.findUnique({ where: { id: req.auth.sub } });
      const enrolled = await prisma.enrollment.findFirst({
        where: { courseId: test.courseId, studentId: req.auth.sub },
      });
      if (!enrolled) {
        return res.status(403).json({ ok: false, error: "Вы не записаны на этот курс." });
      }

      const attemptsUsed = await prisma.attempt.count({
        where: {
          testId,
          studentId: req.auth.sub,
          finishedAt: { not: null },
        },
      });
      const extraAttempts = await getAttemptAllowance(prisma, testId, req.auth.sub);
      const baseAttemptLimit = normalizeAttemptLimit(test.attemptLimit);
      if (baseAttemptLimit === 0) {
        return res.status(400).json({ ok: false, error: "Для этого теста количество попыток не ограничено." });
      }
      const allowedAttempts = baseAttemptLimit + extraAttempts;
      if (attemptsUsed < allowedAttempts) {
        return res.status(400).json({ ok: false, error: "У вас еще есть доступные попытки." });
      }

      const marker = `ATTEMPT_REQUEST:test=${testId}:student=${req.auth.sub}`;
      const alreadyRequested = await prisma.notification.findFirst({
        where: {
          courseId: test.courseId,
          audience: "TEACHERS",
          body: { contains: marker },
        },
      });
      if (alreadyRequested) {
        return res.status(400).json({ ok: false, error: "Запрос уже отправлен." });
      }

      const payload = {
        kind: "ATTEMPT_REQUEST",
        marker,
        testId,
        studentId: req.auth.sub,
        courseId: test.courseId,
      };

      const notification = await prisma.notification.create({
        data: {
          title: "Запрос на дополнительную попытку",
          body: `${student?.fullName || student?.email || "Студент"} просит дать еще одну попытку для теста "${test.title}".
${marker}
${JSON.stringify(payload)}`,
          audience: "TEACHERS",
          courseId: test.courseId,
          createdById: req.auth.sub,
          studentId: req.auth.sub,
        },
      });

      return res.json({ ok: true, notification });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });
  app.get("/tests/:testId/attempts", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const testId = Number(req.params.testId);
      if (!Number.isInteger(testId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ С‚РµСЃС‚Р°." });
      }

      const access = await ensureTeacherAccess(prisma, testId, req.auth);
      if (access.error) return res.status(access.error.status).json({ ok: false, error: access.error.message });

      const attempts = await prisma.attempt.findMany({
        where: { testId, finishedAt: { not: null } },
        include: {
          student: {
            select: { id: true, email: true, fullName: true },
          },
          test: {
            include: {
              questions: {
                include: {
                  options: true,
                },
                orderBy: { order: "asc" },
              },
            },
          },
          answers: {
            include: {
              selections: true,
            },
          },
        },
        orderBy: { finishedAt: "desc" },
      });

      return res.json({
        ok: true,
        attempts: attempts.map((attempt) => ({
          ...mapAttemptMeta(attempt),
          student: attempt.student,
          needsReview: buildAttemptFeedback(attempt).summary.reviewPendingCount > 0,
        })),
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.get("/attempts/:attemptId/review", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const attemptId = Number(req.params.attemptId);
      if (!Number.isInteger(attemptId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ РїРѕРїС‹С‚РєР°." });
      }

      const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
          student: { select: { id: true, email: true, fullName: true } },
          test: {
            include: {
              questions: {
                include: { options: true },
                orderBy: { order: "asc" },
              },
            },
          },
          answers: {
            include: { selections: true },
          },
        },
      });

      if (!attempt) return res.status(404).json({ ok: false, error: "РџРѕРїС‹С‚РєР° РЅРµ РЅР°Р№РґРµРЅР°." });
      if (!attempt.finishedAt) return res.status(400).json({ ok: false, error: "РџРѕРїС‹С‚РєР° РµС‰Рµ РЅРµ Р·Р°РІРµСЂС€РµРЅР°." });
      if (req.auth.role !== "ADMIN" && attempt.test.teacherId !== req.auth.sub) {
        return res.status(403).json({ ok: false, error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ." });
      }

      const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
      const reviewItems = attempt.test.questions
        .filter((question) => isReviewableQuestion(question.type))
        .map((question) => {
          const answer = answersByQuestion.get(question.id) || null;
          const evaluation = evaluateQuestion(question, answer);
          return {
            questionId: question.id,
            order: question.order,
            type: question.type,
            text: question.text,
            points: question.points,
            answerId: answer?.id || null,
            textAnswer: answer?.textAnswer || "",
            openScore: answer?.openScore || 0,
            manualScore: answer?.manualScore,
            reviewComment: answer?.reviewComment || "",
            reviewReason: answer?.reviewReason || "",
            reviewStatus: answer?.reviewStatus || evaluation.reviewStatus,
            autoScore: evaluation.auto ? evaluation.score : Number(answer?.openScore || 0),
            finalScore: evaluation.score,
            auto: evaluation.auto,
            evaluationReason: evaluation.reason,
            attachments: safeParseJsonArray(answer?.attachmentsJson),
            answerSummary: summarizeAnswer(question, answer),
          };
        });

      return res.json({
        ok: true,
        attempt: mapAttemptMeta(attempt),
        student: attempt.student,
        test: {
          id: attempt.test.id,
          title: attempt.test.title,
          tabSwitchLimit: attempt.test.tabSwitchLimit,
          timeLimitMinutes: attempt.test.timeLimitMinutes,
        },
        reviewItems,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.post("/attempts/:attemptId/review", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const attemptId = Number(req.params.attemptId);
      const { reviewItems = [] } = req.body || {};

      if (!Number.isInteger(attemptId)) {
        return res.status(400).json({ ok: false, error: "РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ РїРѕРїС‹С‚РєР°." });
      }
      if (!Array.isArray(reviewItems)) {
        return res.status(400).json({ ok: false, error: "РћС†РµРЅРєРё РґРѕР»Р¶РЅС‹ РїСЂРёР№С‚Рё РјР°СЃСЃРёРІРѕРј." });
      }

      const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
          test: {
            include: {
              questions: {
                include: { options: true },
              },
            },
          },
          answers: {
            include: { selections: true },
          },
        },
      });

      if (!attempt) return res.status(404).json({ ok: false, error: "РџРѕРїС‹С‚РєР° РЅРµ РЅР°Р№РґРµРЅР°." });
      if (!attempt.finishedAt) return res.status(400).json({ ok: false, error: "РџРѕРїС‹С‚РєР° РµС‰Рµ РЅРµ Р·Р°РІРµСЂС€РµРЅР°." });
      if (req.auth.role !== "ADMIN" && attempt.test.teacherId !== req.auth.sub) {
        return res.status(403).json({ ok: false, error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ." });
      }

      const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));

      for (const item of reviewItems) {
        const questionId = Number(item?.questionId);
        const score = Number(item?.score);
        if (!Number.isInteger(questionId) || !Number.isFinite(score) || score < 0) continue;

        const question = attempt.test.questions.find((candidate) => candidate.id === questionId);
        if (!question || !isReviewableQuestion(question.type)) continue;

        const boundedScore = Math.min(Math.max(0, Math.round(score)), Number(question.points || 0));
        const answer = answersByQuestion.get(questionId);
        const commonData = {
          reviewComment: String(item?.reviewComment || ""),
          reviewReason: String(item?.reviewReason || ""),
          reviewStatus: "MANUAL_REVIEWED",
          reviewedAt: new Date(),
          reviewedById: req.auth.sub,
        };

        if (answer) {
          await prisma.answer.update({
            where: { id: answer.id },
            data:
              question.type === "OPEN"
                ? { ...commonData, openScore: boundedScore, manualScore: boundedScore }
                : { ...commonData, manualScore: boundedScore },
          });
        } else {
          await prisma.answer.create({
            data: {
              attemptId,
              questionId,
              openScore: question.type === "OPEN" ? boundedScore : 0,
              manualScore: boundedScore,
              ...commonData,
              textAnswer: "",
              responseJson: "{}",
            },
          });
        }
      }

      const updated = await finalizeAttempt(prisma, attemptId, false);
      return res.json({
        ok: true,
        attempt: mapAttemptMeta(updated),
        feedback: buildAttemptFeedback(updated),
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });
};

