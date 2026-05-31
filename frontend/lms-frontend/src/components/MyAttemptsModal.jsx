import { useEffect, useState } from "react";
import Modal from "./Modal";
import { http } from "../api/http";
import { useTranslation } from "react-i18next";

export default function MyAttemptsModal({ testId, open, onClose }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [attemptLimit, setAttemptLimit] = useState(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);

  async function load() {
    if (!testId) return;
    setErr("");
    setLoading(true);
    try {
      const res = await http.get(`/tests/${testId}/my-attempts`);
      const data = res.data?.attempts ?? res.data ?? [];
      setAttempts(Array.isArray(data) ? data : []);
      setAttemptLimit(res.data?.attemptLimit ?? null);
      setAttemptsUsed(res.data?.attemptsUsed ?? 0);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, testId]);

  return (
    <Modal open={open} title={`${t("myAttempts.title")} #${testId}`} onClose={onClose}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ opacity: 0.8 }}>
            {t("myAttempts.count")}: {attempts.length}
            {attemptLimit ? ` · ${attemptsUsed}/${attemptLimit}` : ""}
          </div>
          <button onClick={load} disabled={loading} style={{ padding: 8, cursor: "pointer" }}>
            {loading ? t("common.loading") : t("common.refresh")}
          </button>
        </div>

        {err && (
          <div style={{ color: "crimson", background: "#ffecec", padding: 10, borderRadius: 10 }}>
            {err}
          </div>
        )}

        {loading && <div>{t("common.loading")}</div>}

        {!loading && !err && attempts.length === 0 && <div style={{ opacity: 0.7 }}>{t("myAttempts.none")}</div>}

        {!loading && attempts.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>{t("myAttempts.status")}</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>{t("myAttempts.started")}</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>{t("myAttempts.finished")}</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>{t("myAttempts.score")}</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>{t("myAttempts.percent")}</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => {
                  const finished = !!a.finishedAt;
                  const percent = a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : null;

                  return (
                    <tr key={a.id}>
                      <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>
                        {finished ? t("myAttempts.finishedStatus") : t("myAttempts.inProgressStatus")}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>
                        {a.startedAt ? new Date(a.startedAt).toLocaleString() : "-"}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>
                        {a.finishedAt ? new Date(a.finishedAt).toLocaleString() : "-"}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>
                        {a.score} / {a.maxScore}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>
                        {percent === null ? "-" : `${percent}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>{t("myAttempts.note")}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
