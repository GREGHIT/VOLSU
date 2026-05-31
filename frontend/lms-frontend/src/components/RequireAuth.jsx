import { Navigate } from "react-router-dom";
import { getToken } from "../auth/token";
import { useTranslation } from "react-i18next";

export default function RequireAuth({ children }) {
  const { t } = useTranslation();
  const token = getToken();

  if (!token) {
    // можно показать текст, но Navigate сразу редиректит
    return <Navigate to="/login" replace state={{ reason: t("auth.needLogin") }} />;
  }

  return children;
}
