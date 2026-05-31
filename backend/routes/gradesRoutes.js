function average(items) {
  if (!items.length) return null;
  return Math.round((items.reduce((sum, value) => sum + value, 0) / items.length) * 10) / 10;
}

function normalizeGradeRecord(row) {
  const moduleScores = [row.module1Score, row.module2Score, row.module3Score].filter((value) => value != null);
  const moduleAverage = average(moduleScores);
  return {
    id: row.id,
    courseId: row.courseId,
    studentId: row.studentId,
    module1Score: row.module1Score,
    module2Score: row.module2Score,
    module3Score: row.module3Score,
    moduleAverage,
    notes: row.notes || "",
    updatedAt: row.updatedAt,
    student: {
      id: row.student.id,
      fullName: row.student.fullName || "",
      email: row.student.email,
      faculty: row.student.faculty || "",
      studentCode: row.student.studentCode || "",
      groupName: row.student.group?.name || "",
    },
    course: {
      id: row.course.id,
      title: row.course.title,
      semester: row.course.semester || "",
      subjectName: row.course.subjectName || "",
    },
  };
}

function buildExportTableRows(rows) {
  return rows
    .map(
      (row) => `
        <tr>
          <td>${row.courseTitle}</td>
          <td>${row.studentName}</td>
          <td>${row.groupName}</td>
          <td>${row.testAverage ?? "—"}</td>
          <td>${row.module1 ?? "—"}</td>
          <td>${row.module2 ?? "—"}</td>
          <td>${row.module3 ?? "—"}</td>
          <td>${row.moduleAverage ?? "—"}</td>
          <td>${row.notes}</td>
        </tr>
      `
    )
    .join("");
}

function buildExportDocument(tableRows, title) {
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; }
          h1 { font-size: 20px; margin-bottom: 16px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #eff6ff; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>
              <th>Курс</th>
              <th>Студент</th>
              <th>Группа</th>
              <th>Средний тестовый балл, %</th>
              <th>Модуль 1</th>
              <th>Модуль 2</th>
              <th>Модуль 3</th>
              <th>Средний по модулям</th>
              <th>Примечания</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `;
}

module.exports = function registerGradesRoutes(app, deps) {
  const { prisma, authRequired, requireRole, appendAuditEntry, ok, error } = deps;

  function getManagedGroupIds(auth) {
    return Array.isArray(auth?.managedGroupIds) ? auth.managedGroupIds.map((id) => Number(id)).filter(Number.isInteger) : [];
  }

  async function resolveVisibleCourseIds(req, explicitCourseId) {
    if (req.auth.role === "ADMIN") {
      if (explicitCourseId) return [explicitCourseId];
      const courses = await prisma.course.findMany({ select: { id: true } });
      return courses.map((course) => course.id);
    }

    if (req.auth.role === "TEACHER") {
      const where = explicitCourseId ? { id: explicitCourseId, teacherId: req.auth.sub } : { teacherId: req.auth.sub };
      const courses = await prisma.course.findMany({ where, select: { id: true } });
      return courses.map((course) => course.id);
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        studentId: req.auth.sub,
        ...(explicitCourseId ? { courseId: explicitCourseId } : {}),
      },
      select: { courseId: true },
    });
    return enrollments.map((row) => row.courseId);
  }

  async function ensureGradeRecords(courseIds) {
    if (!courseIds.length) return;

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: { in: courseIds } },
      select: { courseId: true, studentId: true },
    });

    for (const enrollment of enrollments) {
      await prisma.courseGrade.upsert({
        where: {
          courseId_studentId: {
            courseId: enrollment.courseId,
            studentId: enrollment.studentId,
          },
        },
        update: {},
        create: {
          courseId: enrollment.courseId,
          studentId: enrollment.studentId,
        },
      });
    }
  }

  app.get("/grades/overview", authRequired, async (req, res) => {
    try {
      const requestedCourseId = req.query.courseId ? Number(req.query.courseId) : null;
      const courseIds = await resolveVisibleCourseIds(req, Number.isInteger(requestedCourseId) ? requestedCourseId : null);
      await ensureGradeRecords(courseIds);

      const courses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
        orderBy: [{ title: "asc" }],
        select: {
          id: true,
          title: true,
          subjectName: true,
          semester: true,
          teacherId: true,
        },
      });

      const gradeRows = await prisma.courseGrade.findMany({
        where: {
          courseId: { in: courseIds },
          ...(req.auth.role === "STUDENT" ? { studentId: req.auth.sub } : {}),
          ...(req.auth.role === "TEACHER" && getManagedGroupIds(req.auth).length ? { student: { groupId: { in: getManagedGroupIds(req.auth) } } } : {}),
        },
        include: {
          course: true,
          student: { include: { group: true } },
        },
        orderBy: [{ courseId: "asc" }, { student: { fullName: "asc" } }],
      });

      const attempts = await prisma.attempt.findMany({
        where: {
          studentId: req.auth.role === "STUDENT" ? req.auth.sub : undefined,
          ...(req.auth.role === "TEACHER" && getManagedGroupIds(req.auth).length ? { student: { groupId: { in: getManagedGroupIds(req.auth) } } } : {}),
          test: { courseId: { in: courseIds } },
          finishedAt: { not: null },
        },
        include: {
          test: { select: { id: true, courseId: true, title: true } },
        },
      });

      const attemptMap = new Map();
      for (const attempt of attempts) {
        const key = `${attempt.test.courseId}:${attempt.studentId}`;
        const percent = attempt.maxScore > 0 ? Math.round((attempt.score / attempt.maxScore) * 1000) / 10 : 0;
        const bucket = attemptMap.get(key) || [];
        bucket.push(percent);
        attemptMap.set(key, bucket);
      }

      const rows = gradeRows.map((row) => {
        const normalized = normalizeGradeRecord(row);
        const testAverage = average(attemptMap.get(`${row.courseId}:${row.studentId}`) || []);
        return {
          ...normalized,
          testAverage,
        };
      });

      return ok(res, { courses, rows });
    } catch (err) {
      return error(res, 500, String(err?.message || err));
    }
  });

  app.put("/grades/:gradeId", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const gradeId = Number(req.params.gradeId);
      if (!Number.isInteger(gradeId)) return error(res, 400, "Некорректная запись оценок.");

      const grade = await prisma.courseGrade.findUnique({
        where: { id: gradeId },
        include: { course: true, student: true },
      });
      if (!grade) return error(res, 404, "Запись оценок не найдена.");
      if (req.auth.role !== "ADMIN" && grade.course.teacherId !== req.auth.sub) {
        return error(res, 403, "forbidden");
      }

      const managedGroupIds = getManagedGroupIds(req.auth);
      if (req.auth.role === "TEACHER" && managedGroupIds.length && !managedGroupIds.includes(grade.student.groupId)) {
        return error(res, 403, "Преподаватель может менять оценки только своих групп.");
      }

      const toNullableInt = (value) => {
        if (value === "" || value == null) return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : null;
      };

      const updated = await prisma.courseGrade.update({
        where: { id: gradeId },
        data: {
          module1Score: req.body?.module1Score !== undefined ? toNullableInt(req.body.module1Score) : undefined,
          module2Score: req.body?.module2Score !== undefined ? toNullableInt(req.body.module2Score) : undefined,
          module3Score: req.body?.module3Score !== undefined ? toNullableInt(req.body.module3Score) : undefined,
          notes: req.body?.notes !== undefined ? String(req.body.notes || "").trim() : undefined,
        },
        include: {
          course: true,
          student: { include: { group: true } },
        },
      });

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: "GRADE_UPDATED",
        entityType: "grade",
        entityId: updated.id,
        courseId: updated.courseId,
        summary: `Обновлены модульные оценки для ${updated.student.fullName || updated.student.email}`,
        meta: {
          module1Score: updated.module1Score,
          module2Score: updated.module2Score,
          module3Score: updated.module3Score,
        },
      });

      return ok(res, { row: normalizeGradeRecord(updated) });
    } catch (err) {
      return error(res, 400, String(err?.message || err));
    }
  });

  app.get("/grades/export", authRequired, requireRole("TEACHER", "ADMIN"), async (req, res) => {
    try {
      const requestedCourseId = req.query.courseId ? Number(req.query.courseId) : null;
      const format = String(req.query.format || "excel").toLowerCase();
      const courseIds = await resolveVisibleCourseIds(req, Number.isInteger(requestedCourseId) ? requestedCourseId : null);
      await ensureGradeRecords(courseIds);

      const rows = await prisma.courseGrade.findMany({
        where: {
          courseId: { in: courseIds },
          ...(req.auth.role === "TEACHER" && getManagedGroupIds(req.auth).length ? { student: { groupId: { in: getManagedGroupIds(req.auth) } } } : {}),
        },
        include: {
          course: true,
          student: { include: { group: true } },
        },
        orderBy: [{ course: { title: "asc" } }, { student: { fullName: "asc" } }],
      });

      const attempts = await prisma.attempt.findMany({
        where: {
          ...(req.auth.role === "TEACHER" && getManagedGroupIds(req.auth).length ? { student: { groupId: { in: getManagedGroupIds(req.auth) } } } : {}),
          test: { courseId: { in: courseIds } },
          finishedAt: { not: null },
        },
        include: { test: { select: { courseId: true } } },
      });

      const attemptMap = new Map();
      for (const attempt of attempts) {
        const key = `${attempt.test.courseId}:${attempt.studentId}`;
        const percent = attempt.maxScore > 0 ? Math.round((attempt.score / attempt.maxScore) * 1000) / 10 : 0;
        const bucket = attemptMap.get(key) || [];
        bucket.push(percent);
        attemptMap.set(key, bucket);
      }

      const exportRows = rows.map((row) => {
        const moduleScores = [row.module1Score, row.module2Score, row.module3Score].filter((value) => value != null);
        return {
          courseTitle: row.course.title,
          studentName: row.student.fullName || row.student.email,
          groupName: row.student.group?.name || "",
          testAverage: average(attemptMap.get(`${row.courseId}:${row.studentId}`) || []),
          module1: row.module1Score,
          module2: row.module2Score,
          module3: row.module3Score,
          moduleAverage: average(moduleScores),
          notes: row.notes || "",
        };
      });

      const tableRows = buildExportTableRows(exportRows);
      const document = buildExportDocument(tableRows, "Ведомость оценок");

      if (format === "word") {
        res.setHeader("Content-Type", "application/msword; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="grades-report-${Date.now()}.doc"`);
        return res.send(document);
      }

      res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="grades-report-${Date.now()}.xls"`);
      return res.send(document);
    } catch (err) {
      return error(res, 500, String(err?.message || err));
    }
  });
};
