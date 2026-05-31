const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const dataDir = path.join(__dirname, "..", "data");
const uploadsDir = path.join(__dirname, "..", "uploads", "library");
const materialsFile = path.join(dataDir, "library-materials.json");

async function ensureStorage() {
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.mkdir(uploadsDir, { recursive: true });
  if (!fs.existsSync(materialsFile)) {
    await fsp.writeFile(materialsFile, "[]", "utf8");
  }
}

async function readMaterials() {
  await ensureStorage();
  const raw = await fsp.readFile(materialsFile, "utf8");
  return JSON.parse(raw || "[]");
}

async function writeMaterials(materials) {
  await ensureStorage();
  await fsp.writeFile(materialsFile, JSON.stringify(materials, null, 2), "utf8");
}

function mapMaterial(material) {
  return {
    id: material.id,
    title: material.title,
    description: material.description,
    section: material.section,
    audience: material.audience,
    fileName: material.fileName,
    mimeType: material.mimeType,
    size: material.size,
    extension: material.extension,
    groupId: material.groupId ?? null,
    groupName: material.groupName ?? "",
    courseId: material.courseId ?? null,
    courseTitle: material.courseTitle ?? "",
    createdAt: material.createdAt,
    uploadedById: material.uploadedById,
    uploadedByName: material.uploadedByName,
    downloadUrl: `/uploads/library/${material.storedName}`,
  };
}

async function resolveLabels(prisma, courseId, groupId) {
  let courseTitle = "";
  let groupName = "";

  if (Number.isInteger(courseId)) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });
    if (course) courseTitle = course.title;
  }

  if (Number.isInteger(groupId)) {
    const group = await prisma.studentGroup.findUnique({
      where: { id: groupId },
      select: { id: true, name: true },
    });
    if (group) groupName = group.name;
  }

  return { courseTitle, groupName };
}

function normalizeScope(section, audience) {
  if (section === "PRIVATE") return String(audience || "SELF");
  return section;
}

module.exports = function registerLibraryRoutes(app, deps) {
  const { prisma, authRequired, requireRole, appendAuditEntry, ok, error } = deps;

  app.get("/library/meta", authRequired, async (req, res) => {
    try {
      const courseWhere = req.auth.role === "ADMIN" ? {} : req.auth.role === "TEACHER" ? { teacherId: req.auth.sub } : {};

      const courses =
        req.auth.role === "STUDENT"
          ? await prisma.enrollment.findMany({
              where: { studentId: req.auth.sub },
              include: { course: { select: { id: true, title: true } } },
            })
          : await prisma.course.findMany({
              where: courseWhere,
              select: { id: true, title: true },
              orderBy: { title: "asc" },
            });

      const groups =
        req.auth.role === "STUDENT"
          ? []
          : await prisma.studentGroup.findMany({
              select: { id: true, name: true, faculty: true },
              orderBy: [{ faculty: "asc" }, { name: "asc" }],
            });

      return ok(res, {
        courses: req.auth.role === "STUDENT" ? courses.map((item) => item.course) : courses,
        groups,
      });
    } catch (err) {
      return error(res, 500, String(err));
    }
  });

  app.get("/library/materials", authRequired, async (req, res) => {
    try {
      const materials = await readMaterials();
      let visible = materials;

      if (req.auth.role === "STUDENT") {
        const me = await prisma.user.findUnique({
          where: { id: req.auth.sub },
          select: { id: true, groupId: true },
        });
        const enrollments = await prisma.enrollment.findMany({
          where: { studentId: req.auth.sub },
          select: { courseId: true },
        });
        const courseIds = new Set(enrollments.map((item) => item.courseId));

        visible = materials.filter((material) => {
          if (material.section === "PUBLIC") return true;
          if (material.section === "GROUP") return material.groupId != null && material.groupId === me?.groupId;
          if (material.section === "PRIVATE") {
            if (material.audience === "SELF" || material.audience === "ALL_TEACHERS") return false;
            if (material.audience === "COURSE") return material.courseId != null && courseIds.has(material.courseId);
            if (material.audience === "GROUP") return material.groupId != null && material.groupId === me?.groupId;
          }
          return false;
        });
      } else if (req.auth.role === "TEACHER") {
        const ownCourses = await prisma.course.findMany({
          where: { teacherId: req.auth.sub },
          select: { id: true },
        });
        const ownCourseIds = new Set(ownCourses.map((item) => item.id));

        visible = materials.filter((material) => {
          if (material.section === "PUBLIC") return true;
          if (material.uploadedById === req.auth.sub) return true;
          if (material.section === "GROUP") return true;
          if (material.section === "PRIVATE" && material.audience === "ALL_TEACHERS") return true;
          if (material.section === "PRIVATE" && material.audience === "COURSE") {
            return material.courseId != null && ownCourseIds.has(material.courseId);
          }
          return false;
        });
      }

      return ok(res, {
        materials: visible.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(mapMaterial),
      });
    } catch (err) {
      return error(res, 500, String(err));
    }
  });

  app.get("/library/materials/:materialId/preview", authRequired, async (req, res) => {
    try {
      const materialId = String(req.params.materialId);
      const materials = await readMaterials();
      const material = materials.find((item) => item.id === materialId);
      if (!material) return error(res, 404, "Материал не найден.");

      const extension = String(material.extension || "").toLowerCase();
      const previewType =
        material.mimeType === "application/pdf" || extension === "pdf"
          ? "pdf"
          : material.mimeType.startsWith("image/")
            ? "image"
            : ["txt", "csv", "json", "md"].includes(extension)
              ? "text"
              : ["doc", "docx"].includes(extension)
                ? "docx"
                : ["ppt", "pptx"].includes(extension)
                  ? "pptx"
                  : "download";

      let textPreview = null;
      if (previewType === "text") {
        try {
          textPreview = await fsp.readFile(path.join(uploadsDir, material.storedName), "utf8");
        } catch {
          textPreview = null;
        }
      }

      return ok(res, {
        preview: {
          id: material.id,
          type: previewType,
          title: material.title,
          fileName: material.fileName,
          mimeType: material.mimeType,
          downloadUrl: `/uploads/library/${material.storedName}`,
          textPreview,
        },
      });
    } catch (err) {
      return error(res, 500, String(err?.message || err));
    }
  });

  app.post("/library/materials", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const { title, description, section, audience, courseId, groupId, files } = req.body;

      if (!title || String(title).trim().length < 2) {
        return res.status(400).json({ ok: false, error: "Укажите название материала." });
      }
      if (!Array.isArray(files) || !files.length) {
        return res.status(400).json({ ok: false, error: "Добавьте хотя бы один файл." });
      }
      if (!["PUBLIC", "PRIVATE", "GROUP"].includes(section)) {
        return res.status(400).json({ ok: false, error: "Некорректный раздел библиотеки." });
      }

      const normalizedCourseId = Number.isInteger(courseId) ? courseId : null;
      const normalizedGroupId = Number.isInteger(groupId) ? groupId : null;
      const { courseTitle, groupName } = await resolveLabels(prisma, normalizedCourseId, normalizedGroupId);
      const materials = await readMaterials();
      const uploader = await prisma.user.findUnique({
        where: { id: req.auth.sub },
        select: { id: true, fullName: true, email: true },
      });

      const created = [];
      for (const file of files) {
        const originalName = String(file.name || "").trim();
        const mimeType = String(file.mimeType || "application/octet-stream");
        const base64 = String(file.base64 || "");
        const size = Number(file.size || 0);
        if (!originalName || !base64) continue;

        const extension = path.extname(originalName) || "";
        const storedName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
        const buffer = Buffer.from(base64, "base64");
        await fsp.writeFile(path.join(uploadsDir, storedName), buffer);

        const material = {
          id: crypto.randomUUID(),
          title: String(title).trim(),
          description: description ? String(description).trim() : "",
          section,
          audience: normalizeScope(section, audience),
          fileName: originalName,
          mimeType,
          size: Number.isFinite(size) && size > 0 ? size : buffer.length,
          extension: extension.replace(".", "").toUpperCase(),
          storedName,
          groupId: normalizedGroupId,
          groupName,
          courseId: normalizedCourseId,
          courseTitle,
          createdAt: new Date().toISOString(),
          uploadedById: req.auth.sub,
          uploadedByName: uploader?.fullName || uploader?.email || "Преподаватель",
        };

        materials.push(material);
        created.push(mapMaterial(material));
      }

      await writeMaterials(materials);

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: "LIBRARY_MATERIAL_CREATED",
        entityType: "library-material",
        entityId: created[0]?.id || null,
        courseId: normalizedCourseId,
        summary: `Добавлены материалы "${String(title).trim()}"`,
      });

      return ok(res, { materials: created });
    } catch (err) {
      return error(res, 400, String(err));
    }
  });

  app.put("/library/materials/:materialId", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const materialId = String(req.params.materialId);
      const { title, description, section, audience, courseId, groupId } = req.body;
      const materials = await readMaterials();
      const materialIndex = materials.findIndex((item) => item.id === materialId);

      if (materialIndex === -1) {
        return res.status(404).json({ ok: false, error: "Материал не найден." });
      }

      const current = materials[materialIndex];
      if (req.auth.role !== "ADMIN" && current.uploadedById !== req.auth.sub) {
        return res.status(403).json({ ok: false, error: "Недостаточно прав для редактирования." });
      }

      if (!title || String(title).trim().length < 2) {
        return res.status(400).json({ ok: false, error: "Укажите название материала." });
      }
      if (!["PUBLIC", "PRIVATE", "GROUP"].includes(section)) {
        return res.status(400).json({ ok: false, error: "Некорректный раздел библиотеки." });
      }

      const normalizedCourseId = Number.isInteger(courseId) ? courseId : null;
      const normalizedGroupId = Number.isInteger(groupId) ? groupId : null;
      const { courseTitle, groupName } = await resolveLabels(prisma, normalizedCourseId, normalizedGroupId);

      const updated = {
        ...current,
        title: String(title).trim(),
        description: description ? String(description).trim() : "",
        section,
        audience: normalizeScope(section, audience),
        courseId: normalizedCourseId,
        courseTitle,
        groupId: normalizedGroupId,
        groupName,
      };

      materials[materialIndex] = updated;
      await writeMaterials(materials);

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: "LIBRARY_MATERIAL_UPDATED",
        entityType: "library-material",
        entityId: updated.id,
        courseId: normalizedCourseId,
        summary: `Обновлён материал "${updated.title}"`,
      });

      return ok(res, { material: mapMaterial(updated) });
    } catch (err) {
      return error(res, 400, String(err));
    }
  });

  app.delete("/library/materials/:materialId", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const materialId = String(req.params.materialId);
      const materials = await readMaterials();
      const material = materials.find((item) => item.id === materialId);

      if (!material) {
        return res.status(404).json({ ok: false, error: "Материал не найден." });
      }
      if (req.auth.role !== "ADMIN" && material.uploadedById !== req.auth.sub) {
        return res.status(403).json({ ok: false, error: "Недостаточно прав для удаления." });
      }

      const nextMaterials = materials.filter((item) => item.id !== materialId);
      await writeMaterials(nextMaterials);

      try {
        await fsp.unlink(path.join(uploadsDir, material.storedName));
      } catch {}

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: "LIBRARY_MATERIAL_DELETED",
        entityType: "library-material",
        entityId: material.id,
        courseId: material.courseId,
        summary: `Удалён материал "${material.title}"`,
      });

      return ok(res);
    } catch (err) {
      return error(res, 400, String(err));
    }
  });
};
