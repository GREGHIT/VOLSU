import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { http } from "../api/http";

function reviewInputClassName() {
  return "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400";
}

function buildAbsoluteUrl(url) {
  if (!url) return "";
  try {
    return new URL(url, http.defaults.baseURL).toString();
  } catch {
    return url;
  }
}

export default function AttemptReviewModal({ attemptId, open, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState({});
  const [reasons, setReasons] = useState({});

  const reviewItems = useMemo(() => data?.reviewItems || [], [data]);
  const openQuestion = reviewItems[0] || null;

  async function load() {
    if (!attemptId) return;
    setErr("");
    setLoading(true);
    try {
      const res = await http.get(`/attempts/${attemptId}/review`);
      const payload = res.data;
      setData(payload);

      const nextScores = {};
      const nextComments = {};
      const nextReasons = {};
      for (const item of payload.reviewItems || []) {
        nextScores[item.questionId] = item.manualScore ?? item.openScore ?? item.finalScore ?? 0;
        nextComments[item.questionId] = item.reviewComment || "";
        nextReasons[item.questionId] = item.reviewReason || "";
      }
      setScores(nextScores);
      setComments(nextComments);
      setReasons(nextReasons);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Не удалось загрузить данные для проверки.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attemptId]);

  function setOne(mapSetter, qId, value) {
    mapSetter((prev) => ({ ...prev, [qId]: value }));
  }

  async function save() {
    if (!attemptId || !openQuestion) return;
    setErr("");
    setSaving(true);
    try {
      await http.post(`/attempts/${attemptId}/review`, {
        reviewItems: [
          {
            questionId: Number(openQuestion.questionId),
            score: Number(scores[openQuestion.questionId] ?? 0),
            reviewComment: String(comments[openQuestion.questionId] || ""),
            reviewReason: String(reasons[openQuestion.questionId] || ""),
          },
        ],
      });
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Не удалось сохранить оценку.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title={attemptId ? `Проверка ответа #${attemptId}` : "Проверка ответа"} onClose={onClose}>
      {loading ? <div>Загрузка...</div> : null}
      {err ? <div style={{ color: "crimson" }}>{err}</div> : null}

      {data && !loading ? (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ opacity: 0.9, display: "grid", gap: 4 }}>
            <div>
              <b>Студент:</b> {data.student?.fullName || data.student?.email || "—"}
            </div>
            <div>
              <b>Тест:</b> {data.test?.title || "—"}
            </div>
            <div>
              <b>Текущий итог:</b> {data.attempt?.score} / {data.attempt?.maxScore}
            </div>
          </div>

          {!openQuestion ? (
            <div style={{ opacity: 0.75 }}>В этой попытке нет открытых вопросов, которые требуют ручной проверки.</div>
          ) : (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, display: "grid", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div style={{ fontWeight: 800, fontSize: 20 }}>Открытый вопрос</div>
                <div style={{ opacity: 0.75 }}>
                  Баллы за вопрос: {openQuestion.points}
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 700 }}>Формулировка</div>
                <div>{openQuestion.text}</div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 700 }}>Ответ студента</div>
                <div
                  className="attempt-review-answer-box"
                  style={{
                    whiteSpace: "pre-wrap",
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  {openQuestion.answerSummary?.text || openQuestion.textAnswer || <span style={{ opacity: 0.6 }}>Ответ не введён.</span>}
                </div>
              </div>

              {Array.isArray(openQuestion.attachments) && openQuestion.attachments.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>Прикреплённые файлы</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {openQuestion.attachments.map((file, index) => (
                      <div
                        className="attempt-review-attachment-card"
                        key={`${file.relativePath || file.originalName || "attachment"}-${index}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          padding: 12,
                          borderRadius: 14,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, wordBreak: "break-word" }}>{file.originalName || `Файл ${index + 1}`}</div>
                          <div style={{ opacity: 0.7, fontSize: 13 }}>{file.size ? `${Math.max(1, Math.round(file.size / 1024))} КБ` : "Файл"}</div>
                        </div>
                        <a
                          href={buildAbsoluteUrl(file.url)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            whiteSpace: "nowrap",
                            padding: "10px 14px",
                            borderRadius: 12,
                            border: "1px solid #cbd5e1",
                            textDecoration: "none",
                            color: "#0f172a",
                            fontWeight: 600,
                          }}
                        >
                          Скачать
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700 }}>Оценка</span>
                  <input
                    type="number"
                    min="0"
                    max={openQuestion.points}
                    value={scores[openQuestion.questionId] ?? 0}
                    onChange={(e) => setOne(setScores, openQuestion.questionId, e.target.value)}
                    className={reviewInputClassName()}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700 }}>Комментарий преподавателя</span>
                  <input
                    value={comments[openQuestion.questionId] ?? ""}
                    onChange={(e) => setOne(setComments, openQuestion.questionId, e.target.value)}
                    className={reviewInputClassName()}
                    placeholder="Например: ответ верный, но не раскрыт полностью"
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700 }}>Причина снижения балла</span>
                  <input
                    value={reasons[openQuestion.questionId] ?? ""}
                    onChange={(e) => setOne(setReasons, openQuestion.questionId, e.target.value)}
                    className={reviewInputClassName()}
                    placeholder="Коротко укажите, чего не хватило в ответе"
                  />
                </label>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onClose} style={{ padding: 10, cursor: "pointer" }}>
              Закрыть
            </button>

            {openQuestion ? (
              <button onClick={save} disabled={saving} style={{ padding: 10, cursor: "pointer" }}>
                {saving ? "Сохранение..." : "Сохранить оценку"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
