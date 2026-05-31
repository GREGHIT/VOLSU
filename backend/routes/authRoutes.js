module.exports = function registerAuthRoutes(app, deps) {
  const { prisma, signToken, hashPassword, verifyPassword, authRequired, mapStudent, safeParseJsonNumberArray } = deps;

  app.get("/", (req, res) => {
    res.send("LMS server is running");
  });

  app.post("/auth/register", async (req, res) => {
    try {
      const { email, password, role, fullName, studentCode, faculty, groupId } = req.body;

      if (!email || !password) {
        return res.status(400).json({ ok: false, error: "Укажите email и пароль." });
      }

      const normalizedRole = (role ?? "STUDENT").toUpperCase();
      const allowedRoles = ["STUDENT", "TEACHER", "ADMIN"];
      if (!allowedRoles.includes(normalizedRole)) {
        return res.status(400).json({ ok: false, error: "Некорректная роль." });
      }

      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          email: String(email).toLowerCase().trim(),
          passwordHash,
          role: normalizedRole,
          fullName: fullName ? String(fullName).trim() : null,
          studentCode: studentCode ? String(studentCode).trim() : null,
          faculty: faculty ? String(faculty).trim() : null,
          groupId: Number.isInteger(groupId) ? groupId : null,
        },
        include: { group: true },
      });

      return res.json({ ok: true, user: mapStudent(user) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: String(err) });
    }
  });

  app.post("/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ ok: false, error: "Укажите email и пароль." });
      }

      const user = await prisma.user.findUnique({
        where: { email: String(email).toLowerCase().trim() },
      });

      if (!user) {
        return res.status(401).json({ ok: false, error: "invalid credentials" });
      }

      const okPass = await verifyPassword(password, user.passwordHash);
      if (!okPass) {
        return res.status(401).json({ ok: false, error: "invalid credentials" });
      }

      const accessSystems = (() => {
        try {
          const parsed = JSON.parse(user.accessSystemsJson || "[]");
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();

      const permissions = (() => {
        try {
          const parsed = JSON.parse(user.permissionsJson || "[]");
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();

      const managedGroupIds = safeParseJsonNumberArray(user.managedGroupIdsJson);
      const token = signToken(user);

      return res.json({
        ok: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName ?? "",
          studentCode: user.studentCode ?? "",
          faculty: user.faculty ?? "",
          groupId: user.groupId ?? null,
          createdAt: user.createdAt,
          staffTitle: user.staffTitle ?? "",
          staffCategory: user.staffCategory ?? "",
          accessSystems,
          permissions,
          managedGroupIds,
        },
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.get("/me", authRequired, (req, res) => {
    res.json({ ok: true, auth: req.auth });
  });
};
