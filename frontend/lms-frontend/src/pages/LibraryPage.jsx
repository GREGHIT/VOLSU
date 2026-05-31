import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { http } from "../api/http";
import { getUser } from "../auth/token";
import ConfirmDialog from "../components/ConfirmDialog";
import Modal from "../components/Modal";
import ActionButton from "../components/ui/ActionButton";
import PageHero from "../components/ui/PageHero";
import SectionCard from "../components/ui/SectionCard";
import PageSkeleton from "../components/ui/Skeleton";
import StatCard from "../components/ui/StatCard";
import useDebouncedValue from "../utils/useDebouncedValue";

const EMPTY_FORM = {
  title: "",
  description: "",
  section: "PUBLIC",
  audience: "SELF",
  courseId: "",
  groupId: "",
};

function formatFileSize(size) {
  if (!size) return "—";
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function LibraryPage() {
  const { t } = useTranslation();
  const user = getUser();
  const canManage = user?.role === "TEACHER" || user?.role === "ADMIN";

  const [materials, setMaterials] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [section, setSection] = useState("PUBLIC");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploadForm, setUploadForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const debouncedQuery = useDebouncedValue(query, 250);

  const sectionOptions = useMemo(
    () => [
      { value: "PUBLIC", label: t("library.public", { defaultValue: "Общая библиотека" }) },
      { value: "PRIVATE", label: t("library.private", { defaultValue: "Личные материалы" }) },
      { value: "GROUP", label: t("library.group", { defaultValue: "Библиотека группы" }) },
    ],
    [t]
  );

  const audienceOptions = useMemo(
    () => [
      { value: "SELF", label: t("library.audience.self", { defaultValue: "Только я" }) },
      { value: "ALL_TEACHERS", label: t("library.audience.allTeachers", { defaultValue: "Все преподаватели" }) },
      { value: "COURSE", label: t("library.audience.course", { defaultValue: "Студенты курса" }) },
      { value: "GROUP", label: t("library.audience.group", { defaultValue: "Конкретная группа" }) },
    ],
    [t]
  );

  function sectionLabel(value) {
    return sectionOptions.find((option) => option.value === value)?.label || value;
  }

  function audienceLabel(value) {
    return audienceOptions.find((option) => option.value === value)?.label || value;
  }

  async function loadLibrary() {
    if (hasLoaded) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [materialsRes, metaRes] = await Promise.all([http.get("/library/materials"), http.get("/library/meta")]);
      setMaterials(materialsRes.data?.materials ?? []);
      setGroups(metaRes.data?.groups ?? []);
      setCourses(metaRes.data?.courses ?? []);
      setHasLoaded(true);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось загрузить библиотеку.");
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadLibrary();
  }, []);

  const visibleMaterials = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();
    return materials.filter((material) => {
      if (section && material.section !== section) return false;
      if (groupFilter && String(material.groupId || "") !== String(groupFilter)) return false;
      if (courseFilter && String(material.courseId || "") !== String(courseFilter)) return false;
      if (!term) return true;
      return [material.title, material.description, material.fileName, material.groupName, material.courseTitle, material.uploadedByName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [courseFilter, debouncedQuery, groupFilter, materials, section]);

  const stats = useMemo(() => {
    const total = materials.length;
    return {
      total,
      publicCount: materials.filter((item) => item.section === "PUBLIC").length,
      privateCount: materials.filter((item) => item.section === "PRIVATE").length,
      groupCount: materials.filter((item) => item.section === "GROUP").length,
    };
  }, [materials]);

  if (loading && !hasLoaded) {
    return <PageSkeleton sections={3} />;
  }

  async function submitUpload(e) {
    e.preventDefault();
    if (!files.length) {
      setError("Добавьте хотя бы один файл.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const preparedFiles = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          base64: await fileToBase64(file),
        }))
      );

      await http.post("/library/materials", {
        title: uploadForm.title,
        description: uploadForm.description,
        section: uploadForm.section,
        audience: uploadForm.section === "PRIVATE" ? uploadForm.audience : uploadForm.section,
        courseId: uploadForm.courseId ? Number(uploadForm.courseId) : null,
        groupId: uploadForm.groupId ? Number(uploadForm.groupId) : null,
        files: preparedFiles,
      });

      setIsUploadOpen(false);
      setUploadForm(EMPTY_FORM);
      setFiles([]);
      await loadLibrary();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось загрузить материалы.");
    } finally {
      setUploading(false);
    }
  }

  function beginEdit(material) {
    setEditing(material);
    setEditForm({
      title: material.title || "",
      description: material.description || "",
      section: material.section || "PUBLIC",
      audience: material.audience || "SELF",
      courseId: material.courseId ? String(material.courseId) : "",
      groupId: material.groupId ? String(material.groupId) : "",
    });
  }

  async function saveMaterialChanges(e) {
    e.preventDefault();
    if (!editing) return;

    setSavingEdit(true);
    setError("");
    try {
      await http.put(`/library/materials/${editing.id}`, {
        title: editForm.title,
        description: editForm.description,
        section: editForm.section,
        audience: editForm.section === "PRIVATE" ? editForm.audience : editForm.section,
        courseId: editForm.courseId ? Number(editForm.courseId) : null,
        groupId: editForm.groupId ? Number(editForm.groupId) : null,
      });

      setEditing(null);
      setEditForm(EMPTY_FORM);
      await loadLibrary();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось обновить материал.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeMaterial() {
    if (!deleteTarget) return;
    try {
      await http.delete(`/library/materials/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadLibrary();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось удалить материал.");
    }
  }

  function openMaterial(material) {
    const url = `${http.defaults.baseURL}${material.downloadUrl}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function previewMaterial(material) {
    try {
      const res = await http.get(`/library/materials/${material.id}/preview`);
      setPreview(res.data?.preview || null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось открыть предпросмотр.");
    }
  }

  const scenarioCards = [
    {
      title: "1. Общая библиотека материалов",
      detail: "Презентации, методички, книги, таблицы, сканы и справочные файлы, которые удобно хранить в одном общем каталоге.",
    },
    {
      title: "2. Личные материалы с настраиваемым доступом",
      detail: "Файлы, которые можно оставить только себе, открыть всем преподавателям, конкретному курсу или отдельной группе.",
    },
    {
      title: "3. Библиотека группы",
      detail: "Материалы для конкретной группы: лабораторные, раздатки, локальные тестовые файлы, рабочие инструкции и чек-листы.",
    },
  ];

  return (
    <div className="mx-auto max-w-[1760px] space-y-6">
      <PageHero
        eyebrow={t("library.eyebrow", { defaultValue: "Центр материалов" })}
        title={t("library.title", { defaultValue: "Библиотека курсов, групп и личных подборок" })}
        description={t("library.description", {
          defaultValue:
            "Здесь можно вести общую библиотеку материалов, личные документы с настраиваемым кругом доступа и отдельные пакеты для конкретных групп.",
        })}
        chips={["PDF", "DOCX", "PPTX", "XLSX", "CSV", "Изображения", "Архивы", "Сканы"]}
        actions={
          canManage ? (
            <ActionButton tone="primary" onClick={() => setIsUploadOpen(true)}>
              + {t("library.addMaterials", { defaultValue: "Добавить материалы" })}
            </ActionButton>
          ) : null
        }
      />

      {refreshing ? (
        <div className="theme-surface-inset theme-readable-soft rounded-2xl border border-slate-300 px-4 py-3 text-sm">
          Обновляем библиотеку и сохраняем текущий список на экране...
        </div>
      ) : null}

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="blue" label={t("library.total", { defaultValue: "Всего материалов" })} value={stats.total} description="Общая медиатека" />
        <StatCard tone="violet" label={t("library.public", { defaultValue: "Общая библиотека" })} value={stats.publicCount} description="Открытые материалы" />
        <StatCard tone="emerald" label={t("library.private", { defaultValue: "Личные материалы" })} value={stats.privateCount} description="С ограничением доступа" />
        <StatCard tone="amber" label={t("library.group", { defaultValue: "Библиотека группы" })} value={stats.groupCount} description="Под отдельные потоки и группы" />
      </div>

      <SectionCard title={t("library.navTitle", { defaultValue: "Навигация по библиотеке" })} subtitle={t("library.navSubtitle", { defaultValue: "Разделы и быстрый поиск" })}>
        <div className="grid gap-4 xl:grid-cols-[minmax(520px,0.95fr)_220px_220px_minmax(320px,1fr)] xl:items-center">
          <div className="grid gap-2 sm:grid-cols-3">
            {sectionOptions.map((option) => (
              <ActionButton
                key={option.value}
                tone={section === option.value ? "primary" : "secondary"}
                className="justify-center"
                onClick={() => setSection(option.value)}
              >
                {option.label}
              </ActionButton>
            ))}
          </div>

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400"
          >
            <option value="">{t("library.allGroups", { defaultValue: "Все группы" })}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400"
          >
            <option value="">{t("library.allCourses", { defaultValue: "Все курсы" })}</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("library.searchPlaceholder", { defaultValue: "Поиск по названию, описанию, файлу, курсу, группе или автору" })}
            className="theme-surface-button theme-readable-strong rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400"
          />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <SectionCard title={t("library.materialsTitle", { defaultValue: "Материалы" })} subtitle={t("library.materialsSubtitle", { defaultValue: "Файлы и доступ" })}>
          <div className="grid gap-3">
            {visibleMaterials.map((material) => (
              <div key={material.id} className="rounded-2xl border border-slate-300 bg-white px-4 py-4 shadow-sm theme-glass-cardInset">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 theme-glass-strongText">{material.title}</div>
                    <div className="mt-1 text-sm text-slate-500 theme-glass-softText">
                      {material.fileName} • {material.extension || material.mimeType} • {formatFileSize(material.size)}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-600 theme-glass-softText">
                      {material.description || t("library.noDescription", { defaultValue: "Без дополнительного описания." })}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 font-semibold text-slate-700 theme-glass-chip">
                        {sectionLabel(material.section)}
                      </span>
                      {material.section === "PRIVATE" ? (
                        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 font-semibold text-slate-700 theme-glass-chip">
                          {t("library.access", { defaultValue: "Доступ" })}: {audienceLabel(material.audience)}
                        </span>
                      ) : null}
                      {material.courseTitle ? (
                        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 font-semibold text-slate-700 theme-glass-chip">
                          {material.courseTitle}
                        </span>
                      ) : null}
                      {material.groupName ? (
                        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 font-semibold text-slate-700 theme-glass-chip">
                          {material.groupName}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 font-semibold text-slate-700 theme-glass-chip">
                        {material.uploadedByName}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <ActionButton tone="secondary" onClick={() => previewMaterial(material)}>Предпросмотр</ActionButton>
                    <ActionButton onClick={() => openMaterial(material)}>{t("library.open", { defaultValue: "Открыть" })}</ActionButton>
                    {canManage ? (
                      <ActionButton tone="secondary" onClick={() => beginEdit(material)}>
                        {t("library.edit", { defaultValue: "Редактировать" })}
                      </ActionButton>
                    ) : null}
                    {canManage ? (
                      <ActionButton tone="danger" onClick={() => setDeleteTarget(material)}>
                        {t("library.delete", { defaultValue: "Удалить" })}
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {visibleMaterials.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-slate-500 shadow-sm theme-glass-cardInset theme-glass-softText">
                {t("library.noMaterials", { defaultValue: "В выбранном разделе пока нет материалов." })}
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title={t("library.scenariosTitle", { defaultValue: "Как устроены разделы" })} subtitle={t("library.scenariosSubtitle", { defaultValue: "Сценарии использования" })}>
          <div className="grid gap-3">
            {scenarioCards.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-4 shadow-sm theme-glass-cardInset">
                <div className="font-bold text-slate-900 theme-glass-strongText">{item.title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600 theme-glass-softText">{item.detail}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <Modal open={isUploadOpen} title="Загрузка материалов" onClose={() => setIsUploadOpen(false)}>
        <form className="grid gap-4" onSubmit={submitUpload}>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-700">Название набора</span>
              <input
                value={uploadForm.title}
                onChange={(e) => setUploadForm((prev) => ({ ...prev, title: e.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
                placeholder="Например, лабораторные для группы ПМИ-22-2"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-700">Раздел библиотеки</span>
              <select
                value={uploadForm.section}
                onChange={(e) => setUploadForm((prev) => ({ ...prev, section: e.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
              >
                {sectionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">Описание</span>
            <textarea
              value={uploadForm.description}
              onChange={(e) => setUploadForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
              placeholder="Коротко опишите, для чего нужны эти материалы."
            />
          </label>

          {uploadForm.section === "PRIVATE" ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Круг доступа</span>
                <select
                  value={uploadForm.audience}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, audience: e.target.value }))}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
                >
                  {audienceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Курс</span>
                <select
                  value={uploadForm.courseId}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, courseId: e.target.value }))}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
                >
                  <option value="">{t("library.unassigned", { defaultValue: "Без привязки" })}</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Группа</span>
                <select
                  value={uploadForm.groupId}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, groupId: e.target.value }))}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
                >
                  <option value="">{t("library.unassigned", { defaultValue: "Без привязки" })}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {uploadForm.section === "GROUP" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Группа</span>
                <select
                  value={uploadForm.groupId}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, groupId: e.target.value }))}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
                >
                  <option value="">Выберите группу</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Курс</span>
                <select
                  value={uploadForm.courseId}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, courseId: e.target.value }))}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
                >
                  <option value="">{t("library.unassigned", { defaultValue: "Без привязки" })}</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">Файлы</span>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.rtf,.zip,.rar,.7z,.png,.jpg,.jpeg,.webp,.gif,.svg"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="rounded-xl border border-slate-300 px-4 py-3 theme-glass-cardInset theme-glass-strongText"
            />
          </label>

          {files.length ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 theme-glass-cardInset">
              <div className="text-sm font-semibold text-slate-700 theme-glass-strongText">Будут загружены:</div>
              <div className="mt-3 grid gap-2">
                {files.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600 theme-glass-cardInset theme-glass-softText">
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0">{formatFileSize(file.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <ActionButton tone="secondary" onClick={() => setIsUploadOpen(false)}>
              {t("common.cancel", { defaultValue: "Отмена" })}
            </ActionButton>
            <ActionButton type="submit" tone="primary" disabled={uploading}>
              {uploading ? "Загружаем..." : "Загрузить материалы"}
            </ActionButton>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} title="Редактирование материала" onClose={() => setEditing(null)}>
        <form className="grid gap-4" onSubmit={saveMaterialChanges}>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">Название</span>
            <input
              value={editForm.title}
              onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">Описание</span>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-700">Раздел</span>
              <select
                value={editForm.section}
                onChange={(e) => setEditForm((prev) => ({ ...prev, section: e.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
              >
                {sectionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {editForm.section === "PRIVATE" ? (
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Круг доступа</span>
                <select
                  value={editForm.audience}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, audience: e.target.value }))}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
                >
                  {audienceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {(editForm.section === "PRIVATE" || editForm.section === "GROUP") && (
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Курс</span>
                <select
                  value={editForm.courseId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, courseId: e.target.value }))}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
                >
                  <option value="">{t("library.unassigned", { defaultValue: "Без привязки" })}</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Группа</span>
                <select
                  value={editForm.groupId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, groupId: e.target.value }))}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-400 theme-glass-cardInset theme-glass-strongText"
                >
                  <option value="">{t("library.unassigned", { defaultValue: "Без привязки" })}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <ActionButton tone="secondary" onClick={() => setEditing(null)}>
              {t("common.cancel", { defaultValue: "Отмена" })}
            </ActionButton>
            <ActionButton type="submit" tone="primary" disabled={savingEdit}>
              {savingEdit ? "Сохраняем..." : t("common.save", { defaultValue: "Сохранить" })}
            </ActionButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить материал"
        message={deleteTarget ? `Удалить "${deleteTarget.fileName}" из библиотеки?` : ""}
        confirmLabel={t("library.delete", { defaultValue: "Удалить" })}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeMaterial}
      />

      <Modal open={!!preview} title={preview?.title || "Предпросмотр"} onClose={() => setPreview(null)}>
        {preview ? (
          <div className="grid gap-4">
            <div className="text-sm text-slate-500">{preview.fileName}</div>
            {preview.type === "pdf" ? (
              <iframe title={preview.title} src={`${http.defaults.baseURL}${preview.downloadUrl}`} className="h-[70vh] w-full rounded-2xl border border-slate-200" />
            ) : null}
            {preview.type === "image" ? (
              <img src={`${http.defaults.baseURL}${preview.downloadUrl}`} alt={preview.title} className="max-h-[70vh] w-full rounded-2xl border border-slate-200 object-contain" />
            ) : null}
            {preview.type === "text" ? (
              <pre className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                {preview.textPreview || "Файл пуст или недоступен для текстового предпросмотра."}
              </pre>
            ) : null}
            {preview.type === "docx" || preview.type === "pptx" || preview.type === "download" ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Для этого формата включён быстрый встроенный просмотр метаданных. Полный файл можно открыть в новой вкладке без отдельного скачивания.
              </div>
            ) : null}
            <div className="flex justify-end">
              <ActionButton onClick={() => window.open(`${http.defaults.baseURL}${preview.downloadUrl}`, "_blank", "noopener,noreferrer")}>
                Открыть файл
              </ActionButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
