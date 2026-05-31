import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { http } from "../api/http";
import { useTranslation } from "react-i18next";

export default function CourseStudentsModal({ courseId, open, onClose }) {
  const { t } = useTranslation();

  const [students, setStudents] = useState([]);
  const [enrolledIds, setEnrolledIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  async function loadAll() {
    setError("");
    setLoading(true);
    try {
      const [sRes, eRes] = await Promise.all([
        http.get(`/students`),
        http.get(`/courses/${courseId}/enrollments`),
      ]);

      const allStudents = sRes.data?.students ?? sRes.data ?? [];
      const enrollments = eRes.data?.enrollments ?? eRes.data ?? [];

      setStudents(Array.isArray(allStudents) ? allStudents : []);
      setEnrolledIds(new Set((enrollments || []).map((e) => e.studentId)));
    } catch (err) {
      setError(err?.response?.data?.error || err.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, courseId]);

  async function enroll(student) {
    setError("");
    setBusyId(student.id);
    try {
      await http.post(`/courses/${courseId}/enroll`, { studentEmail: student.email });
      setEnrolledIds((prev) => new Set(prev).add(student.id));
    } catch (err) {
      setError(err?.response?.data?.error || err.message || t("students.enrollFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function unenroll(student) {
    setError("");
    setBusyId(student.id);
    try {
      await http.post(`/courses/${courseId}/unenroll`, { studentId: student.id });
      setEnrolledIds((prev) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
    } catch (err) {
      setError(err?.response?.data?.error || err.message || t("students.unenrollFailed"));
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return students;
    return students.filter((s) => String(s.email).toLowerCase().includes(term));
  }, [students, q]);

  return (
    <Modal open={open} title={t("students.title")} onClose={onClose}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            style={{ width: "100%", padding: 10 }}
            placeholder={t("students.search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button onClick={loadAll} disabled={loading} style={{ padding: 10, cursor: "pointer" }}>
            {loading ? t("common.loading") : t("common.refresh")}
          </button>
        </div>

        {error && (
          <div style={{ color: "crimson", background: "#ffecec", padding: 10, borderRadius: 10 }}>
            {error}
          </div>
        )}

        {loading && <div>{t("common.loading")}</div>}

        {!loading && (
          <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid #eee", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>
                    {t("students.email")}
                  </th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>
                    {t("students.onCourse")}
                  </th>
                  <th style={{ padding: 10, borderBottom: "1px solid #eee" }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const onCourse = enrolledIds.has(s.id);
                  const busy = busyId === s.id;

                  return (
                    <tr key={s.id}>
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>{s.email}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                        {onCourse ? t("common.yes") : t("common.no")}
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3", textAlign: "right" }}>
                        {onCourse ? (
                          <button
                            onClick={() => unenroll(s)}
                            disabled={busy}
                            style={{ padding: "8px 10px", cursor: "pointer" }}
                          >
                            {busy ? t("common.loading") : t("students.remove")}
                          </button>
                        ) : (
                          <button
                            onClick={() => enroll(s)}
                            disabled={busy}
                            style={{ padding: "8px 10px", cursor: "pointer" }}
                          >
                            {busy ? t("common.loading") : t("students.add")}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: 12, opacity: 0.7 }}>
                      {t("students.notFound")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
