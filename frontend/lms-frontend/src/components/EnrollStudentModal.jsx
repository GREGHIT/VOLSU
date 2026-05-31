import { useState } from "react";
import Modal from "./Modal";
import { http } from "../api/http";
import { useTranslation } from "react-i18next";

export default function EnrollStudentModal({ courseId, open, onClose, onEnrolled }) {
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function enroll(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const v = email.trim().toLowerCase();
    if (!v) {
      setError(t("enroll.enterEmail"));
      return;
    }

    try {
      setSaving(true);
      await http.post(`/courses/${courseId}/enroll`, { studentEmail: v });
      setEmail("");
      onEnrolled?.();
      setSuccess(t("enroll.success"));
    } catch (err) {
      setError(err?.response?.data?.error || err.message || t("enroll.failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title={t("enroll.title")} onClose={onClose}>
      <form onSubmit={enroll} style={{ display: "grid", gap: 10 }}>
        <label>
          {t("enroll.email")}
          <input
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student1@lms.local"
          />
        </label>

        {error && (
          <div style={{ color: "crimson", background: "#ffecec", padding: 10, borderRadius: 10 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ color: "#166534", background: "#ecfdf5", padding: 10, borderRadius: 10 }}>
            {success}
          </div>
        )}

        <button disabled={saving} style={{ padding: 10, cursor: "pointer" }}>
          {saving ? t("common.loading") : t("enroll.submit")}
        </button>
      </form>
    </Modal>
  );
}
