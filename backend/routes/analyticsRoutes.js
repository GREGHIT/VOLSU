function average(values) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = typeof key === "function" ? key(item) : item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

module.exports = function registerAnalyticsRoutes(app, deps) {
  const { prisma, authRequired, requireRole } = deps;

  app.get("/analytics/overview", authRequired, requireRole("STUDENT", "TEACHER", "ADMIN"), async (req, res) => {
    try {
      const requestedScope = String(req.query.scope || "university");
      const requestedGroupId = Number(req.query.groupId);
      const requestedStudentId = Number(req.query.studentId);
      const viewerRole = req.auth.role;
      const effectiveScope = viewerRole === "STUDENT" ? "student" : requestedScope;
      const effectiveGroupId = viewerRole === "STUDENT" ? null : requestedGroupId;
      const effectiveStudentId = viewerRole === "STUDENT" ? req.auth.sub : requestedStudentId;

      let courses = [];
      if (viewerRole === "STUDENT") {
        const ownEnrollments = await prisma.enrollment.findMany({
          where: { studentId: req.auth.sub },
          select: { courseId: true },
        });
        const ownCourseIds = [...new Set(ownEnrollments.map((item) => item.courseId))];
        courses = ownCourseIds.length
          ? await prisma.course.findMany({
              where: { id: { in: ownCourseIds } },
              select: {
                id: true,
                title: true,
                subjectName: true,
                tests: { select: { id: true, title: true, isPublished: true, createdAt: true } },
                assignments: { select: { id: true, title: true, dueDate: true, createdAt: true } },
              },
              orderBy: { createdAt: "desc" },
            })
          : [];
      } else {
        const courseWhere = viewerRole === "ADMIN" ? {} : { teacherId: req.auth.sub };
        courses = await prisma.course.findMany({
          where: courseWhere,
          select: {
            id: true,
            title: true,
            subjectName: true,
            tests: { select: { id: true, title: true, isPublished: true, createdAt: true } },
            assignments: { select: { id: true, title: true, dueDate: true, createdAt: true } },
          },
          orderBy: { createdAt: "desc" },
        });
      }

      const courseIds = courses.map((course) => course.id);
      if (!courseIds.length) {
        return res.json({
          ok: true,
          scope: effectiveScope,
          groups: [],
          students: [],
          metrics: {
            averageAssignmentGrade: null,
            averageTestPercent: null,
            activeStudentsPercent: 0,
            riskStudentsCount: 0,
            publishedTestsCount: 0,
            assignmentsCount: 0,
          },
          facts: [],
          triggers: [],
          groupInsights: [],
          studentInsights: [],
          leaderboard: [],
        });
      }

      const enrollments = await prisma.enrollment.findMany({
        where: { courseId: { in: courseIds } },
        include: {
          course: { select: { id: true, title: true } },
          student: {
            include: {
              group: { select: { id: true, name: true, faculty: true } },
            },
          },
        },
      });

      let scopedEnrollments = enrollments;
      if (effectiveScope === "group" && Number.isInteger(effectiveGroupId)) {
        scopedEnrollments = scopedEnrollments.filter((item) => item.student.groupId === effectiveGroupId);
      }
      if (effectiveScope === "student" && Number.isInteger(effectiveStudentId)) {
        scopedEnrollments = scopedEnrollments.filter((item) => item.studentId === effectiveStudentId);
      }

      const scopedStudents = uniqueBy(scopedEnrollments.map((item) => item.student), "id");
      const scopedStudentIds = scopedStudents.map((student) => student.id);

      const assignments = courses.flatMap((course) =>
        course.assignments.map((assignment) => ({
          ...assignment,
          courseId: course.id,
          courseTitle: course.title,
        }))
      );
      const tests = courses.flatMap((course) =>
        course.tests.map((test) => ({
          ...test,
          courseId: course.id,
          courseTitle: course.title,
        }))
      );

      const assignmentIds = assignments.map((assignment) => assignment.id);
      const testIds = tests.map((test) => test.id);

      const submissions = assignmentIds.length
        ? await prisma.submission.findMany({
            where: {
              assignmentId: { in: assignmentIds },
              studentId: scopedStudentIds.length ? { in: scopedStudentIds } : undefined,
            },
            include: {
              assignment: { select: { id: true, title: true, courseId: true, dueDate: true } },
              student: { include: { group: true } },
            },
          })
        : [];

      const attempts = testIds.length
        ? await prisma.attempt.findMany({
            where: {
              testId: { in: testIds },
              finishedAt: { not: null },
              studentId: scopedStudentIds.length ? { in: scopedStudentIds } : undefined,
            },
            include: {
              test: { select: { id: true, title: true, courseId: true } },
              student: { include: { group: true } },
            },
          })
        : [];

      const assignmentGrades = submissions.filter((item) => item.grade != null).map((item) => item.grade);
      const testPercents = attempts
        .filter((item) => item.maxScore > 0)
        .map((item) => Math.round((item.score / item.maxScore) * 1000) / 10);

      const activityCutoff = Date.now() - 1000 * 60 * 60 * 24 * 14;
      const activeStudents = new Set();
      for (const submission of submissions) {
        if (new Date(submission.createdAt).getTime() >= activityCutoff) activeStudents.add(submission.studentId);
      }
      for (const attempt of attempts) {
        if (attempt.finishedAt && new Date(attempt.finishedAt).getTime() >= activityCutoff) activeStudents.add(attempt.studentId);
      }

      const submissionsByStudent = new Map();
      for (const submission of submissions) {
        const list = submissionsByStudent.get(submission.studentId) ?? [];
        list.push(submission);
        submissionsByStudent.set(submission.studentId, list);
      }

      const attemptsByStudent = new Map();
      for (const attempt of attempts) {
        const list = attemptsByStudent.get(attempt.studentId) ?? [];
        list.push(attempt);
        attemptsByStudent.set(attempt.studentId, list);
      }

      const studentInsights = scopedStudents.map((student) => {
        const ownSubmissions = submissionsByStudent.get(student.id) ?? [];
        const ownAttempts = attemptsByStudent.get(student.id) ?? [];
        const ownAssignmentAvg = average(ownSubmissions.filter((item) => item.grade != null).map((item) => item.grade));
        const ownTestAvg = average(
          ownAttempts.filter((item) => item.maxScore > 0).map((item) => Math.round((item.score / item.maxScore) * 1000) / 10)
        );
        const lastActivity = [...ownSubmissions.map((item) => item.createdAt), ...ownAttempts.map((item) => item.finishedAt)]
          .filter(Boolean)
          .sort()
          .slice(-1)[0] ?? null;
        const missingAssignments = Math.max(assignments.length - ownSubmissions.length, 0);
        const missingTests = Math.max(
          tests.filter((test) => test.isPublished).length - ownAttempts.length,
          0
        );
        const attention = [];

        if (ownAssignmentAvg != null && ownAssignmentAvg >= 85) {
          attention.push("Стабильно сильные результаты по заданиям.");
        }
        if (ownTestAvg != null && ownTestAvg >= 85) {
          attention.push("Уверенно проходит тесты выше среднего.");
        }
        if ((ownAssignmentAvg != null && ownAssignmentAvg < 60) || (ownTestAvg != null && ownTestAvg < 60)) {
          attention.push("Нужна дополнительная поддержка по ключевым темам.");
        }
        if (missingAssignments >= 2) {
          attention.push(`Не хватает сдач: пропущено ${missingAssignments} заданий.`);
        }
        if (missingTests >= 1) {
          attention.push(`Остались непройденные тесты: ${missingTests}.`);
        }
        if (!lastActivity || new Date(lastActivity).getTime() < activityCutoff) {
          attention.push("Давно не было активности в курсе.");
        }

        return {
          studentId: student.id,
          fullName: student.fullName || student.email,
          email: student.email,
          groupId: student.groupId ?? null,
          groupName: student.group?.name ?? "Без группы",
          faculty: student.faculty || student.group?.faculty || "",
          assignmentAverage: ownAssignmentAvg,
          testAverage: ownTestAvg,
          missingAssignments,
          missingTests,
          lastActivity,
          attention,
        };
      });

      const groupsMap = new Map();
      for (const item of studentInsights) {
        const key = item.groupId ?? `nogroup-${item.studentId}`;
        const entry = groupsMap.get(key) ?? {
          groupId: item.groupId ?? null,
          groupName: item.groupName,
          faculty: item.faculty,
          students: [],
        };
        entry.students.push(item);
        groupsMap.set(key, entry);
      }

      const groupInsights = Array.from(groupsMap.values()).map((group) => {
        const assignmentAverage = average(group.students.map((student) => student.assignmentAverage).filter((value) => value != null));
        const testAverage = average(group.students.map((student) => student.testAverage).filter((value) => value != null));
        const risks = group.students.filter(
          (student) =>
            student.missingAssignments >= 2 ||
            student.missingTests >= 1 ||
            (student.assignmentAverage != null && student.assignmentAverage < 60) ||
            (student.testAverage != null && student.testAverage < 60)
        ).length;

        const strengths = [];
        if (assignmentAverage != null && assignmentAverage >= 82) strengths.push("Сильная динамика по практическим заданиям.");
        if (testAverage != null && testAverage >= 80) strengths.push("Группа уверенно проходит тесты.");
        if (!strengths.length) strengths.push("Есть потенциал для точечной донастройки тем и дедлайнов.");

        return {
          groupId: group.groupId,
          groupName: group.groupName,
          faculty: group.faculty,
          studentsCount: group.students.length,
          assignmentAverage,
          testAverage,
          riskStudentsCount: risks,
          strengths,
        };
      });

      const facts = [];
      const triggers = [];

      if (groupInsights.length) {
        const strongestGroup = [...groupInsights]
          .filter((group) => group.testAverage != null)
          .sort((a, b) => (b.testAverage ?? 0) - (a.testAverage ?? 0))[0];
        if (strongestGroup) {
          facts.push({
            title: "Лучшая группа по тестам",
            detail: `${strongestGroup.groupName} держит средний результат ${strongestGroup.testAverage}% по завершенным попыткам.`,
            tone: "emerald",
          });
        }

        const weakestGroup = [...groupInsights]
          .filter((group) => group.assignmentAverage != null)
          .sort((a, b) => (a.assignmentAverage ?? 999) - (b.assignmentAverage ?? 999))[0];
        if (weakestGroup) {
          facts.push({
            title: "Зона методической поддержки",
            detail: `${weakestGroup.groupName} проседает по заданиям: средняя оценка ${weakestGroup.assignmentAverage}.`,
            tone: "amber",
          });
        }
      }

      const staleStudents = studentInsights.filter(
        (student) => !student.lastActivity || new Date(student.lastActivity).getTime() < activityCutoff
      );
      if (staleStudents.length) {
        triggers.push({
          title: "Низкая вовлеченность",
          detail: `${staleStudents.length} студентов давно не проявляли активности. Стоит проверить контакт и дедлайны.`,
          severity: "high",
          count: staleStudents.length,
          students: staleStudents.map((student) => ({
            id: student.studentId,
            fullName: student.fullName,
            email: student.email,
            groupName: student.groupName,
            note: student.lastActivity
              ? `Последняя активность: ${new Date(student.lastActivity).toLocaleDateString("ru-RU")}`
              : "Активность в курсе не зафиксирована",
          })),
        });
      }

      const atRiskStudents = studentInsights.filter(
        (student) =>
          student.missingAssignments >= 2 ||
          student.missingTests >= 1 ||
          (student.assignmentAverage != null && student.assignmentAverage < 60) ||
          (student.testAverage != null && student.testAverage < 60)
      );
      if (atRiskStudents.length) {
        triggers.push({
          title: "Сигнал риска по результатам",
          detail: `${atRiskStudents.length} студентов требуют внимания по пропускам или низким средним баллам.`,
          severity: "medium",
          count: atRiskStudents.length,
          students: atRiskStudents.map((student) => ({
            id: student.studentId,
            fullName: student.fullName,
            email: student.email,
            groupName: student.groupName,
            note: [
              student.assignmentAverage != null ? `Задания: ${student.assignmentAverage}` : null,
              student.testAverage != null ? `Тесты: ${student.testAverage}%` : null,
              student.missingAssignments ? `Несдано заданий: ${student.missingAssignments}` : null,
              student.missingTests ? `Непройдено тестов: ${student.missingTests}` : null,
            ]
              .filter(Boolean)
              .join(" • "),
          })),
        });
      }

      const strongStudents = studentInsights
        .filter((student) => (student.assignmentAverage ?? 0) >= 85 || (student.testAverage ?? 0) >= 85)
        .slice(0, 4);
      for (const student of strongStudents) {
        facts.push({
          title: "Сильный индивидуальный профиль",
          detail: `${student.fullName} показывает устойчивые результаты: задания ${student.assignmentAverage ?? "—"}, тесты ${student.testAverage ?? "—"}%.`,
          tone: "blue",
        });
      }

      const leaderboard = [...studentInsights]
        .map((student) => ({
          ...student,
          compositeScore: average([student.assignmentAverage, student.testAverage].filter((value) => value != null)) ?? 0,
        }))
        .sort((a, b) => b.compositeScore - a.compositeScore)
        .slice(0, 8);

      return res.json({
        ok: true,
        scope: effectiveScope,
        groups: uniqueBy(
          enrollments
            .map((item) => item.student.group)
            .filter(Boolean)
            .map((group) => ({ id: group.id, name: group.name, faculty: group.faculty })),
          "id"
        ),
        students: uniqueBy(
          enrollments.map((item) => ({
            id: item.student.id,
            fullName: item.student.fullName || item.student.email,
            email: item.student.email,
            groupId: item.student.groupId ?? null,
            groupName: item.student.group?.name ?? "Без группы",
          })),
          "id"
        ),
        metrics: {
          averageAssignmentGrade: average(assignmentGrades),
          averageTestPercent: average(testPercents),
          activeStudentsPercent: scopedStudents.length ? Math.round((activeStudents.size / scopedStudents.length) * 100) : 0,
          riskStudentsCount: atRiskStudents.length,
          publishedTestsCount: tests.filter((test) => test.isPublished).length,
          assignmentsCount: assignments.length,
        },
        facts,
        triggers,
        groupInsights,
        studentInsights,
        leaderboard,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });
};
