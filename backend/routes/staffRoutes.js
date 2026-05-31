const DEFAULT_SYSTEMS = [
  "LMS Core",
  "Schedule Editor",
  "Analytics Console",
  "Content Library",
  "Notifications",
  "Audit Log",
  "Database Tools",
  "Deployment",
];

const DEFAULT_PERMISSIONS = [
  "COURSES_VIEW",
  "COURSES_EDIT",
  "TESTS_VIEW",
  "TESTS_EDIT",
  "TESTS_INSPECT",
  "SCHEDULE_EDIT",
  "ANALYTICS_VIEW",
  "ANALYTICS_EXPORT",
  "GRADES_EDIT",
  "GRADES_EXPORT",
  "STUDENTS_MANAGE",
  "STAFF_MANAGE",
  "SYSTEMS_MANAGE",
];

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function normalizeNumberList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => Number(value)).filter(Number.isInteger))];
}

module.exports = function registerStaffRoutes(app, deps) {
  const { prisma, authRequired, requireCapability, hashPassword, mapStaff, listAuditEntries, appendAuditEntry, ok, error } = deps;

  const canManageStaff = requireCapability({ roles: ["ADMIN"], permissions: ["STAFF_MANAGE"] });
  const canViewStaff = requireCapability({ roles: ["TEACHER", "ADMIN"], permissions: ["STAFF_MANAGE"] });

  app.get("/staff/options", authRequired, canManageStaff, async (req, res) => {
    const groups = await prisma.studentGroup.findMany({
      orderBy: [{ faculty: "asc" }, { name: "asc" }],
      select: { id: true, name: true, faculty: true },
    });

    return ok(res, {
      systems: DEFAULT_SYSTEMS,
      permissions: DEFAULT_PERMISSIONS,
      categories: ["TEACHER", "DEVELOPER", "SUPPORT", "ADMINISTRATION"],
      titles: ["Преподаватель", "Старший преподаватель", "Методист", "Разработчик", "DevOps", "Системный администратор", "Администратор LMS"],
      groups,
    });
  });

  app.get("/staff", authRequired, canViewStaff, async (req, res) => {
    try {
      const staff = await prisma.user.findMany({
        where: { role: { in: ["TEACHER", "ADMIN"] } },
        orderBy: [{ role: "asc" }, { fullName: "asc" }, { email: "asc" }],
      });

      return ok(res, {
        staff: staff.map(mapStaff),
      });
    } catch (err) {
      return error(res, 500, String(err?.message || err));
    }
  });

  app.post("/staff", authRequired, canManageStaff, async (req, res) => {
    try {
      const {
        email,
        password,
        fullName,
        faculty,
        role = "TEACHER",
        staffTitle = "",
        staffCategory = "",
        accessSystems = [],
        permissions = [],
        managedGroupIds = [],
      } = req.body || {};

      const normalizedRole = String(role || "TEACHER").toUpperCase();
      if (!["TEACHER", "ADMIN"].includes(normalizedRole)) {
        return error(res, 400, "Допустимы только роли TEACHER и ADMIN.");
      }
      if (!email || !password || !fullName) {
        return error(res, 400, "Укажите email, пароль и ФИО сотрудника.");
      }

      const user = await prisma.user.create({
        data: {
          email: normalizeText(email).toLowerCase(),
          passwordHash: await hashPassword(password),
          role: normalizedRole,
          fullName: normalizeText(fullName),
          faculty: normalizeText(faculty) || null,
          staffTitle: normalizeText(staffTitle) || null,
          staffCategory: normalizeText(staffCategory) || null,
          accessSystemsJson: JSON.stringify(normalizeStringList(accessSystems)),
          permissionsJson: JSON.stringify(normalizeStringList(permissions)),
          managedGroupIdsJson: JSON.stringify(normalizeNumberList(managedGroupIds)),
        },
      });

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: "STAFF_CREATED",
        entityType: "staff",
        entityId: user.id,
        summary: `Создан сотрудник ${user.fullName || user.email}`,
        meta: {
          role: user.role,
          systems: normalizeStringList(accessSystems),
          permissions: normalizeStringList(permissions),
          managedGroupIds: normalizeNumberList(managedGroupIds),
        },
      });

      return ok(res, { staff: mapStaff(user) });
    } catch (err) {
      return error(res, 400, String(err?.message || err));
    }
  });

  app.put("/staff/:staffId", authRequired, canManageStaff, async (req, res) => {
    try {
      const staffId = Number(req.params.staffId);
      if (!Number.isInteger(staffId)) {
        return error(res, 400, "Некорректный сотрудник.");
      }

      const { fullName, faculty, role, staffTitle, staffCategory, accessSystems, permissions, managedGroupIds } = req.body || {};
      const existing = await prisma.user.findUnique({ where: { id: staffId } });
      if (!existing || !["TEACHER", "ADMIN"].includes(existing.role)) {
        return error(res, 404, "Сотрудник не найден.");
      }

      const normalizedRole = role ? String(role).toUpperCase() : existing.role;
      if (!["TEACHER", "ADMIN"].includes(normalizedRole)) {
        return error(res, 400, "Допустимы только роли TEACHER и ADMIN.");
      }

      const updated = await prisma.user.update({
        where: { id: staffId },
        data: {
          role: normalizedRole,
          fullName: fullName != null ? normalizeText(fullName) : undefined,
          faculty: faculty != null ? normalizeText(faculty) || null : undefined,
          staffTitle: staffTitle != null ? normalizeText(staffTitle) || null : undefined,
          staffCategory: staffCategory != null ? normalizeText(staffCategory) || null : undefined,
          accessSystemsJson: accessSystems != null ? JSON.stringify(normalizeStringList(accessSystems)) : undefined,
          permissionsJson: permissions != null ? JSON.stringify(normalizeStringList(permissions)) : undefined,
          managedGroupIdsJson: managedGroupIds != null ? JSON.stringify(normalizeNumberList(managedGroupIds)) : undefined,
        },
      });

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: "STAFF_UPDATED",
        entityType: "staff",
        entityId: updated.id,
        summary: `Обновлены права и доступы для ${updated.fullName || updated.email}`,
        meta: {
          role: updated.role,
          systems: accessSystems != null ? normalizeStringList(accessSystems) : undefined,
          permissions: permissions != null ? normalizeStringList(permissions) : undefined,
          managedGroupIds: managedGroupIds != null ? normalizeNumberList(managedGroupIds) : undefined,
        },
      });

      return ok(res, { staff: mapStaff(updated) });
    } catch (err) {
      return error(res, 400, String(err?.message || err));
    }
  });

  app.get("/staff/:staffId/audit", authRequired, canManageStaff, async (req, res) => {
    try {
      const staffId = Number(req.params.staffId);
      if (!Number.isInteger(staffId)) return error(res, 400, "Некорректный сотрудник.");

      const member = await prisma.user.findUnique({ where: { id: staffId } });
      if (!member) return error(res, 404, "Сотрудник не найден.");

      const history = await listAuditEntries({ actorId: staffId });
      return ok(res, { history });
    } catch (err) {
      return error(res, 500, String(err?.message || err));
    }
  });
};
