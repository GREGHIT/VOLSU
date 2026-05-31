import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { http } from "../api/http";
import { useTranslation } from "react-i18next";

function emptyOption() {
  return { text: "", isCorrect: false };
}

function typeLabel(type, t) {
  if (type === "SINGLE") return t("questions.single", { defaultValue: "SINGLE (один правильный)" });
  if (type === "MULTI") return t("questions.multi", { defaultValue: "MULTI (несколько правильных)" });
  if (type === "OPEN") return t("questions.open", { defaultValue: "OPEN (текстовый ответ)" });
  return type;
}

export default function TestQuestionsModal({ testId, open, onClose }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [test, setTest] = useState(null);

  const [type, setType] = useState("SINGLE");
  const [text, setText] = useState("");
  const [points, setPoints] = useState(1);
  const [order, setOrder] = useState(0);
  const [options, setOptions] = useState([emptyOption(), emptyOption()]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const isChoice = type === "SINGLE" || type === "MULTI";

  async function loadTest() {
    if (!testId) return;
    setLoadError("");
    setLoading(true);
    try {
      const res = await http.get(`/tests/${testId}`);
      const data = res.data?.test ?? res.data;
      setTest(data);
    } catch (err) {
      setLoadError(err?.response?.data?.error || err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  const questions = useMemo(() => {
    const q = test?.questions ?? [];
    const arr = Array.isArray(q) ? q : [];
    return arr.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [test]);

  // reset form + load when opened
  useEffect(() => {
    if (!open) return;

    loadTest();
    setType("SINGLE");
    setText("");
    setPoints(1);
    // удобный дефолт: следующий порядок
    const nextOrder = (questions?.length ?? 0) + 1;
    setOrder(nextOrder);
    setOptions([emptyOption(), emptyOption()]);
    setSaving(false);
    setSaveError("");
    setLoadError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, testId]);

  // when questions loaded, update default order only if order is 0
  useEffect(() => {
    if (!open) return;
    if (order === 0) {
      const nextOrder = (questions?.length ?? 0) + 1;
      setOrder(nextOrder);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length]);

  function setOptionText(idx, value) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text: value } : o)));
  }

  function toggleOptionCorrect(idx) {
    setOptions((prev) => {
      if (type === "SINGLE") {
        // в SINGLE ровно один правильный (или ни одного, если снять галку)
        const next = prev.map((o, i) => ({ ...o, isCorrect: i === idx ? !o.isCorrect : false }));
        return next;
      }
      // MULTI
      return prev.map((o, i) => (i === idx ? { ...o, isCorrect: !o.isCorrect } : o));
    });
  }

  function addOption() {
    setOptions((prev) => [...prev, emptyOption()]);
  }

  function removeOption(idx) {
    setOptions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // держим минимум 2 опции для choice
      if (next.length < 2) return [emptyOption(), emptyOption()];
      return next;
    });
  }

  function validateBeforeSave() {
    const qText = text.trim();
    if (qText.length < 3) return t("questions.validation.text", { defaultValue: "Текст вопроса: минимум 3 символа" });

    const p = Number(points);
    if (!Number.isFinite(p) || p <= 0) return t("questions.validation.points", { defaultValue: "Баллы должны быть положительным числом" });

    const o = Number(order);
    if (!Number.isFinite(o) || o < 0) return t("questions.validation.order", { defaultValue: "Порядок должен быть числом ≥ 0" });

    if (isChoice) {
      const cleaned = options
        .map((o) => ({ text: String(o.text ?? "").trim(), isCorrect: !!o.isCorrect }))
        .filter((o) => o.text.length > 0);

      if (cleaned.length < 2) return t("questions.validation.optionsMin", { defaultValue: "Для SINGLE/MULTI нужно минимум 2 варианта" });

      const correctCount = cleaned.filter((o) => o.isCorrect).length;
      if (correctCount === 0) return t("questions.validation.correctOne", { defaultValue: "Отметьте хотя бы один правильный вариант" });

      if (type === "SINGLE" && correctCount !== 1)
        return t("questions.validation.correctSingle", { defaultValue: "Для SINGLE должен быть ровно один правильный вариант" });
    }

    return null;
  }

  async function createQuestion(e) {
    e.preventDefault();
    setSaveError("");

    const validation = validateBeforeSave();
    if (validation) {
      setSaveError(validation);
      return;
    }

    const payload = {
      type,
      text: text.trim(),
      points: Number(points),
      order: Number(order),
    };

    if (isChoice) {
      payload.options = options
        .map((o) => ({ text: String(o.text ?? "").trim(), isCorrect: !!o.isCorrect }))
        .filter((o) => o.text.length > 0);
    }

    try {
      setSaving(true);
      await http.post(`/tests/${testId}/questions`, payload);
      await loadTest();
      setText("");
      setPoints(1);
      setOrder((questions.length ?? 0) + 2);
      setOptions([emptyOption(), emptyOption()]);
    } catch (err) {
      setSaveError(err?.response?.data?.error || err?.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t("questions.title", { id: testId, defaultValue: `Вопросы теста #${testId}` })}
      onClose={onClose}
    >
      <div style={{ display: "grid", gap: 16 }}>
        {/* Existing questions */}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>{t("questions.existing", { defaultValue: "Существующие вопросы" })}</div>
            <button onClick={loadTest} disabled={loading} style={{ padding: "8px 10px", cursor: "pointer" }}>
              {loading ? t("common.loading", { defaultValue: "Загрузка…" }) : t("common.refresh", { defaultValue: "Обновить" })}
            </button>
          </div>

          {loadError && (
            <div style={{ color: "crimson", background: "#ffecec", padding: 10, borderRadius: 10 }}>
              {loadError}
            </div>
          )}

          {!loading && questions.length === 0 && !loadError && (
            <div style={{ opacity: 0.7 }}>{t("questions.none", { defaultValue: "Пока вопросов нет." })}</div>
          )}

          {questions.map((q) => (
            <div
              key={q.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 12,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700 }}>
                  #{q.order ?? 0} — {typeLabel(q.type, t)} — {q.points}{" "}
                  {t("questions.points", { defaultValue: "баллов" })}
                </div>
                <div style={{ opacity: 0.7 }}>ID: {q.id}</div>
              </div>

              <div>{q.text}</div>

              {(q.options || []).length > 0 && (
                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                  {(q.options || []).map((o) => (
                    <div key={o.id} style={{ display: "flex", gap: 8, alignItems: "center", opacity: 0.9 }}>
                      <span style={{ width: 10 }}>{o.isCorrect ? "✓" : ""}</span>
                      <span>{o.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add question */}
        <div style={{ borderTop: "1px solid #eee", paddingTop: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>
            {t("questions.add", { defaultValue: "Добавить вопрос" })}
          </div>

          <form onSubmit={createQuestion} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>{t("questions.type", { defaultValue: "Тип вопроса" })}</span>
                <select
                  value={type}
                  onChange={(e) => {
                    const next = e.target.value;
                    setType(next);
                    // при смене типа сбросим опции для choice
                    if (next === "SINGLE" || next === "MULTI") {
                      setOptions([emptyOption(), emptyOption()]);
                    }
                  }}
                  style={{ padding: 10 }}
                >
                  <option value="SINGLE">{typeLabel("SINGLE", t)}</option>
                  <option value="MULTI">{typeLabel("MULTI", t)}</option>
                  <option value="OPEN">{typeLabel("OPEN", t)}</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>{t("questions.text", { defaultValue: "Текст вопроса" })}</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  style={{ padding: 10, width: "100%" }}
                  placeholder={t("questions.textPlaceholder", { defaultValue: "Введите текст вопроса…" })}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>{t("questions.pointsLabel", { defaultValue: "Баллы" })}</span>
                  <input
                    type="number"
                    min="1"
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    style={{ padding: 10, width: "100%" }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span>{t("questions.orderLabel", { defaultValue: "Порядок" })}</span>
                  <input
                    type="number"
                    min="0"
                    value={order}
                    onChange={(e) => setOrder(e.target.value)}
                    style={{ padding: 10, width: "100%" }}
                  />
                </label>
              </div>
            </div>

            {isChoice && (
              <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>
                    {t("questions.options", { defaultValue: "Варианты ответа" })}
                  </div>
                  <button type="button" onClick={addOption} style={{ padding: "8px 10px", cursor: "pointer" }}>
                    + {t("questions.addOption", { defaultValue: "Добавить вариант" })}
                  </button>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {options.map((o, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type={type === "SINGLE" ? "radio" : "checkbox"}
                          name={type === "SINGLE" ? "correct_single" : undefined}
                          checked={!!o.isCorrect}
                          onChange={() => toggleOptionCorrect(idx)}
                        />
                        <span style={{ fontSize: 13, opacity: 0.85 }}>
                          {t("questions.correct", { defaultValue: "Правильный" })}
                        </span>
                      </label>

                      <input
                        value={o.text}
                        onChange={(e) => setOptionText(idx, e.target.value)}
                        placeholder={t("questions.optionPlaceholder", { defaultValue: "Текст варианта…" })}
                        style={{ padding: 10, width: "100%" }}
                      />

                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        style={{ padding: "8px 10px", cursor: "pointer" }}
                        title={t("questions.removeOption", { defaultValue: "Удалить вариант" })}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 13, opacity: 0.7 }}>
                  {type === "SINGLE"
                    ? t("questions.hintSingle", { defaultValue: "Для SINGLE отметьте ровно один правильный вариант." })
                    : t("questions.hintMulti", { defaultValue: "Для MULTI можно отметить несколько правильных вариантов." })}
                </div>
              </div>
            )}

            {saveError && (
              <div style={{ color: "crimson", background: "#ffecec", padding: 10, borderRadius: 10 }}>
                {saveError}
              </div>
            )}

            <button disabled={saving} style={{ padding: 10, cursor: "pointer", justifySelf: "start" }}>
              {saving
                ? t("common.saving", { defaultValue: "Сохранение…" })
                : t("questions.create", { defaultValue: "Создать вопрос" })}
            </button>
          </form>
        </div>
      </div>
    </Modal>
  );
}
