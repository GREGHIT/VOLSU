const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const dataDir = path.join(__dirname, "..", "data");
const templatesFile = path.join(dataDir, "schedule-weekly-templates.json");

const PAIR_SLOTS = [
  { pairIndex: 1, label: "1 пара", startTime: "08:30", endTime: "10:00" },
  { pairIndex: 2, label: "2 пара", startTime: "10:10", endTime: "11:40" },
  { pairIndex: 3, label: "3 пара", startTime: "12:10", endTime: "13:40" },
  { pairIndex: 4, label: "4 пара", startTime: "13:50", endTime: "15:20" },
  { pairIndex: 5, label: "5 пара", startTime: "15:30", endTime: "17:00" },
  { pairIndex: 6, label: "6 пара", startTime: "17:10", endTime: "18:40" },
  { pairIndex: 7, label: "7 пара", startTime: "18:50", endTime: "20:20" },
];
const SEMESTER_OPTIONS = [
  { value: "current", label: "Первый семестр" },
  { value: "next", label: "Второй семестр" },
];

const SEMESTER_RANGES = {
  current: { start: "2026-04-20", end: "2026-06-30", label: "Первый семестр" },
  next: { start: "2026-09-01", end: "2026-12-31", label: "Второй семестр" },
};

let defaultTemplates = [];
try {
  if (fs.existsSync(templatesFile)) {
    defaultTemplates = JSON.parse(fs.readFileSync(templatesFile, "utf8") || "[]");
  }
} catch {
  defaultTemplates = [];
}

async function ensureStorage() {
  await fsp.mkdir(dataDir, { recursive: true });
  if (!fs.existsSync(templatesFile)) {
    await fsp.writeFile(templatesFile, JSON.stringify(defaultTemplates, null, 2), "utf8");
  }
}

async function readTemplates() {
  await ensureStorage();
  const raw = await fsp.readFile(templatesFile, "utf8");
  return JSON.parse(raw || "[]");
}

async function writeTemplates(templates) {
  await ensureStorage();
  await fsp.writeFile(templatesFile, JSON.stringify(templates, null, 2), "utf8");
}

function parseDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekdayNumber(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function isoWeekParity(date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  const week = 1 + Math.round((target - firstThursday) / 604800000);
  return week % 2 === 0 ? "EVEN" : "ODD";
}

function repairText(value) {
  if (typeof value !== "string") return value;
  const markers = value.match(/[Р С][^\s]/g);
  if (!markers || markers.length < 2) return value;
  try {
    const decoded = Buffer.from(value, "latin1").toString("utf8");
    return decoded.includes("пїЅ") ? value : decoded;
  } catch {
    return value;
  }
}

function normalizeDeep(value) {
  if (Array.isArray(value)) return value.map(normalizeDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizeDeep(entry)]));
  }
  return repairText(value);
}

function mapTemplate(template) {
  return normalizeDeep({
    id: template.id,
    calendarYear: template.calendarYear ?? 2026,
    semester: template.semester,
    weekday: template.weekday,
    pairIndex: template.pairIndex,
    startTime: template.startTime,
    endTime: template.endTime,
    title: template.title,
    type: template.type,
    format: template.format,
    location: template.location,
    parity: template.parity,
    courseId: template.courseId ?? null,
    courseTitle: template.courseTitle ?? "",
    primaryGroupId: template.primaryGroupId ?? null,
    primaryGroupName: template.primaryGroupName ?? "",
    mergedGroupIds: template.mergedGroupIds ?? [],
    mergedGroupNames: template.mergedGroupNames ?? [],
    notes: template.notes ?? "",
    createdById: template.createdById,
    createdByName: template.createdByName,
  });
}

function templateMatchesGroup(template, groupId) {
  if (!groupId) return true;
  return (
    String(template.primaryGroupId || "") === String(groupId) ||
    (template.mergedGroupIds || []).some((id) => String(id) === String(groupId))
  );
}

async function resolveLabels(prisma, req, courseId, primaryGroupId, mergedGroupIds, primaryGroupName) {
  let courseTitle = "";
  let groupName = primaryGroupName ? String(primaryGroupName).trim() : "";
  let mergedGroupNames = [];

  if (Number.isInteger(courseId)) {
    const courseWhere = req.auth.role === "ADMIN" ? { id: courseId } : { id: courseId, teacherId: req.auth.sub };
    const course = await prisma.course.findFirst({
      where: courseWhere,
      select: { id: true, title: true },
    });
    if (!course) throw new Error("Курс для расписания не найден или недоступен.");
    courseTitle = course.title;
  }

  if (Number.isInteger(primaryGroupId)) {
    const group = await prisma.studentGroup.findUnique({
      where: { id: primaryGroupId },
      select: { id: true, name: true },
    });
    if (!group) throw new Error("Основная группа не найдена.");
    groupName = group.name;
  }

  if (mergedGroupIds.length) {
    const groups = await prisma.studentGroup.findMany({
      where: { id: { in: mergedGroupIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    mergedGroupNames = groups.map((group) => group.name);
  }

  return {
    courseTitle,
    primaryGroupName: groupName,
    mergedGroupNames,
  };
}

module.exports = function registerScheduleRoutes(app, deps) {
  const { prisma, authRequired, requireRole } = deps;

  app.get("/schedule/meta", authRequired, async (req, res) => {
    try {
      const courseWhere =
        req.auth.role === "ADMIN" ? {} : req.auth.role === "TEACHER" ? { teacherId: req.auth.sub } : {};

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

      return res.json({
        ok: true,
        courses: req.auth.role === "STUDENT" ? courses.map((item) => item.course) : courses,
        groups,
        pairSlots: PAIR_SLOTS,
        semesters: SEMESTER_OPTIONS,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.get("/schedule/templates", authRequired, async (req, res) => {
    try {
      const semester = String(req.query.semester || "current");
      const groupId = Number(req.query.groupId);
      const courseId = Number(req.query.courseId);
      const calendarYear = Number(req.query.calendarYear || 2026);
      let templates = await readTemplates();

      if (req.auth.role === "TEACHER") {
        templates = templates.filter((template) => template.createdById === req.auth.sub);
      }
      if (semester !== "all") {
        templates = templates.filter((template) => template.semester === semester);
      }
      if (Number.isInteger(calendarYear)) {
        templates = templates.filter((template) => Number(template.calendarYear ?? 2026) === calendarYear);
      }
      if (Number.isInteger(groupId)) {
        templates = templates.filter((template) => String(template.primaryGroupId || "") === String(groupId));
      }
      if (Number.isInteger(courseId)) {
        templates = templates.filter((template) => template.courseId === courseId);
      }

      return res.json({
        ok: true,
        templates: templates.map(mapTemplate),
        pairSlots: PAIR_SLOTS,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.get("/schedule/generated", authRequired, async (req, res) => {
    try {
      const semester = String(req.query.semester || "current");
      const from = String(req.query.from || SEMESTER_RANGES.current.start);
      const to = String(req.query.to || SEMESTER_RANGES.current.end);
      const groupId = Number(req.query.groupId);
      const calendarYear = Number(req.query.calendarYear || parseDate(from).getFullYear());

      let templates = await readTemplates();
      if (req.auth.role === "TEACHER") {
        templates = templates.filter((template) => template.createdById === req.auth.sub);
      }
      if (semester !== "all") {
        templates = templates.filter((template) => template.semester === semester);
      }
      if (Number.isInteger(calendarYear)) {
        templates = templates.filter((template) => Number(template.calendarYear ?? 2026) === calendarYear);
      }
      if (Number.isInteger(groupId)) {
        templates = templates.filter((template) => templateMatchesGroup(template, groupId));
      }

      const rangeStart = parseDate(from);
      const rangeEnd = parseDate(to);
      const generated = [];

      for (let cursor = new Date(rangeStart); cursor <= rangeEnd; cursor.setDate(cursor.getDate() + 1)) {
        const weekday = weekdayNumber(cursor);
        const parity = isoWeekParity(cursor);
        const dateIso = toIsoDate(cursor);

        for (const template of templates) {
          if (template.weekday !== weekday) continue;
          if (template.parity !== "BOTH" && template.parity !== parity) continue;
          generated.push(
            normalizeDeep({
              id: `${template.id}:${dateIso}`,
              templateId: template.id,
              date: dateIso,
              weekday,
              startTime: template.startTime,
              endTime: template.endTime,
              pairIndex: template.pairIndex,
              title: template.title,
              type: template.type,
              format: template.format,
              location: template.location,
              courseId: template.courseId ?? null,
              courseTitle: template.courseTitle ?? "",
              primaryGroupId: template.primaryGroupId ?? null,
              primaryGroupName: template.primaryGroupName ?? "",
              mergedGroupIds: template.mergedGroupIds ?? [],
              mergedGroupNames: template.mergedGroupNames ?? [],
              parity: template.parity,
              notes: template.notes ?? "",
            })
          );
        }
      }

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

        return res.json({
          ok: true,
          events: generated.filter((event) => {
            if (me?.groupId && templateMatchesGroup(event, me.groupId)) return true;
            if (event.courseId && courseIds.has(event.courseId)) return true;
            return !event.primaryGroupId && !event.courseId;
          }),
        });
      }

      return res.json({ ok: true, events: generated });
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.post("/schedule/templates", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const { calendarYear, semester, weekday, pairIndex, title, type, format, location, parity, courseId, primaryGroupId, mergedGroupIds, primaryGroupName, notes } =
        req.body;

      if (!title || String(title).trim().length < 2) {
        return res.status(400).json({ ok: false, error: "Укажите название предмета или события." });
      }
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
        return res.status(400).json({ ok: false, error: "Некорректный день недели." });
      }
      if (!Number.isInteger(pairIndex) || pairIndex < 1 || pairIndex > PAIR_SLOTS.length) {
        return res.status(400).json({ ok: false, error: "Некорректная пара." });
      }
      if (!["current", "next"].includes(String(semester || ""))) {
        return res.status(400).json({ ok: false, error: "Выберите семестр." });
      }
      if (!["BOTH", "ODD", "EVEN"].includes(String(parity || ""))) {
        return res.status(400).json({ ok: false, error: "Выберите режим недели." });
      }

      const normalizedCourseId = Number.isInteger(courseId) ? courseId : null;
      const normalizedPrimaryGroupId = Number.isInteger(primaryGroupId) ? primaryGroupId : null;
      const normalizedMergedGroupIds = Array.isArray(mergedGroupIds)
        ? [...new Set(mergedGroupIds.map(Number).filter(Number.isInteger).filter((id) => id !== normalizedPrimaryGroupId))]
        : [];

      const pair = PAIR_SLOTS.find((item) => item.pairIndex === pairIndex);
      const labels = await resolveLabels(prisma, req, normalizedCourseId, normalizedPrimaryGroupId, normalizedMergedGroupIds, primaryGroupName);
      const templates = await readTemplates();
      const creator = await prisma.user.findUnique({
        where: { id: req.auth.sub },
        select: { fullName: true, email: true },
      });

      const template = {
        id: crypto.randomUUID(),
        calendarYear: Number(calendarYear) || 2026,
        semester: String(semester),
        weekday,
        pairIndex,
        startTime: pair.startTime,
        endTime: pair.endTime,
        title: String(title).trim(),
        type: type ? String(type).trim() : "Лекция",
        format: format ? String(format).trim() : "Очное",
        location: location ? String(location).trim() : "",
        parity: String(parity),
        courseId: normalizedCourseId,
        courseTitle: labels.courseTitle,
        primaryGroupId: normalizedPrimaryGroupId,
        primaryGroupName: labels.primaryGroupName,
        mergedGroupIds: normalizedMergedGroupIds,
        mergedGroupNames: labels.mergedGroupNames,
        notes: notes ? String(notes).trim() : "",
        createdById: req.auth.sub,
        createdByName: creator?.fullName || creator?.email || "Преподаватель",
      };

      templates.push(template);
      await writeTemplates(templates);
      return res.json({ ok: true, template: mapTemplate(template) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.put("/schedule/templates/:templateId", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const templateId = String(req.params.templateId);
      const templates = await readTemplates();
      const index = templates.findIndex((template) => template.id === templateId);
      if (index === -1) {
        return res.status(404).json({ ok: false, error: "Шаблон расписания не найден." });
      }

      const current = templates[index];
      if (req.auth.role !== "ADMIN" && current.createdById !== req.auth.sub) {
        return res.status(403).json({ ok: false, error: "Недостаточно прав для редактирования шаблона." });
      }

      const { calendarYear, semester, weekday, pairIndex, title, type, format, location, parity, courseId, primaryGroupId, mergedGroupIds, primaryGroupName, notes } =
        req.body;

      if (!title || String(title).trim().length < 2) {
        return res.status(400).json({ ok: false, error: "Укажите название предмета или события." });
      }
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
        return res.status(400).json({ ok: false, error: "Некорректный день недели." });
      }

      const normalizedCourseId = Number.isInteger(courseId) ? courseId : null;
      const normalizedPrimaryGroupId = Number.isInteger(primaryGroupId) ? primaryGroupId : null;
      const normalizedMergedGroupIds = Array.isArray(mergedGroupIds)
        ? [...new Set(mergedGroupIds.map(Number).filter(Number.isInteger).filter((id) => id !== normalizedPrimaryGroupId))]
        : [];

      const pair = PAIR_SLOTS.find((item) => item.pairIndex === pairIndex);
      if (!pair) {
        return res.status(400).json({ ok: false, error: "Некорректная пара." });
      }

      const labels = await resolveLabels(prisma, req, normalizedCourseId, normalizedPrimaryGroupId, normalizedMergedGroupIds, primaryGroupName);

      const updated = {
        ...current,
        calendarYear: Number(calendarYear) || current.calendarYear || 2026,
        semester: String(semester),
        weekday,
        pairIndex,
        startTime: pair.startTime,
        endTime: pair.endTime,
        title: String(title).trim(),
        type: type ? String(type).trim() : "Лекция",
        format: format ? String(format).trim() : "Очное",
        location: location ? String(location).trim() : "",
        parity: String(parity),
        courseId: normalizedCourseId,
        courseTitle: labels.courseTitle,
        primaryGroupId: normalizedPrimaryGroupId,
        primaryGroupName: labels.primaryGroupName,
        mergedGroupIds: normalizedMergedGroupIds,
        mergedGroupNames: labels.mergedGroupNames,
        notes: notes ? String(notes).trim() : "",
      };

      templates[index] = updated;
      await writeTemplates(templates);
      return res.json({ ok: true, template: mapTemplate(updated) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.delete("/schedule/templates/:templateId", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const templateId = String(req.params.templateId);
      const templates = await readTemplates();
      const template = templates.find((item) => item.id === templateId);
      if (!template) {
        return res.status(404).json({ ok: false, error: "Шаблон расписания не найден." });
      }
      if (req.auth.role !== "ADMIN" && template.createdById !== req.auth.sub) {
        return res.status(403).json({ ok: false, error: "Недостаточно прав для удаления шаблона." });
      }

      await writeTemplates(templates.filter((item) => item.id !== templateId));
      return res.json({ ok: true });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });
};

