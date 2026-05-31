const fs = require("fs");
const path = require("path");

const templatesFile = path.join(__dirname, "..", "data", "schedule-weekly-templates.json");

function parseTemplates() {
  try {
    if (!fs.existsSync(templatesFile)) return [];
    return JSON.parse(fs.readFileSync(templatesFile, "utf8") || "[]");
  } catch {
    return [];
  }
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function endOfToday() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now;
}

function priorityForDate(dateValue) {
  if (!dateValue) return "later";
  const now = Date.now();
  const dueTs = new Date(dateValue).getTime();
  const diffHours = (dueTs - now) / (1000 * 60 * 60);
  if (diffHours <= 24) return "urgent";
  if (diffHours <= 72) return "soon";
  return "later";
}

module.exports = function registerDashboardRoutes(app, deps) {
  const { prisma, authRequired, requireRole, mapCourse } = deps;

  app.get("/dashboard/today", authRequired, requireRole("STUDENT", "TEACHER", "ADMIN"), async (req, res) => {
    try {
      const userId = req.auth.sub;
      const role = req.auth.role;
      const todayStart = startOfToday();
      const todayEnd = endOfToday();

      if (role === "STUDENT") {
        const enrollments = await prisma.enrollment.findMany({
          where: { studentId: userId },
          include: {
            course: {
              include: {
                assignments: true,
                tests: true,
              },
            },
          },
        });

        const assignmentIds = enrollments.flatMap((item) => item.course.assignments.map((assignment) => assignment.id));
        const testIds = enrollments.flatMap((item) => item.course.tests.map((test) => test.id));

        const submissions = assignmentIds.length
          ? await prisma.submission.findMany({
              where: { studentId: userId, assignmentId: { in: assignmentIds } },
            })
          : [];
        const attempts = testIds.length
          ? await prisma.attempt.findMany({
              where: { studentId: userId, testId: { in: testIds }, finishedAt: { not: null } },
            })
          : [];

        const submittedIds = new Set(submissions.map((item) => item.assignmentId));
        const finishedAttemptsByTest = attempts.reduce((acc, item) => {
          acc.set(item.testId, (acc.get(item.testId) || 0) + 1);
          return acc;
        }, new Map());

        const tasks = [];
        const courseProgress = enrollments.map((item) => {
          const course = item.course;
          const assignments = course.assignments || [];
          const tests = (course.tests || []).filter((test) => test.isPublished);

          assignments.forEach((assignment) => {
            if (submittedIds.has(assignment.id)) return;
            tasks.push({
              id: `assignment-${assignment.id}`,
              type: "assignment",
              title: assignment.title,
              courseId: course.id,
              courseTitle: course.title,
              dueAt: assignment.dueDate,
              priority: priorityForDate(assignment.dueDate),
            });
          });

          tests.forEach((test) => {
            const attemptsUsed = finishedAttemptsByTest.get(test.id) || 0;
            const attemptsLeft = Math.max(0, Number(test.attemptLimit || 1) - attemptsUsed);
            if (attemptsLeft <= 0) return;
            tasks.push({
              id: `test-${test.id}`,
              type: "test",
              title: test.title,
              courseId: course.id,
              courseTitle: course.title,
              dueAt: null,
              priority: attemptsLeft === 1 ? "soon" : "later",
              attemptsLeft,
            });
          });

          const totalUnits = assignments.length + tests.length;
          const completedUnits =
            assignments.filter((assignment) => submittedIds.has(assignment.id)).length +
            tests.filter((test) => (finishedAttemptsByTest.get(test.id) || 0) > 0).length;

          return {
            course: mapCourse(course),
            progressPercent: totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0,
            totalUnits,
            completedUnits,
          };
        });

        const todaySchedule = parseTemplates().filter((template) => {
          const weekday = new Date().getDay() || 7;
          return template.weekday === weekday;
        });

        return res.json({
          ok: true,
          role,
          tasks: tasks.sort((a, b) => {
            const priorityWeight = { urgent: 0, soon: 1, later: 2 };
            return (priorityWeight[a.priority] || 9) - (priorityWeight[b.priority] || 9);
          }),
          progress: courseProgress,
          schedulePreview: todaySchedule.map((item) => ({
            id: item.id,
            title: item.title,
            startTime: item.startTime,
            endTime: item.endTime,
            location: item.location || "",
            courseTitle: item.courseTitle || "",
          })),
        });
      }

      const teacherCourses = await prisma.course.findMany({
        where: role === "ADMIN" ? {} : { teacherId: userId },
        include: {
          assignments: true,
          tests: true,
        },
      });

      const courseIds = teacherCourses.map((course) => course.id);
      const assignmentIds = teacherCourses.flatMap((course) => course.assignments.map((assignment) => assignment.id));
      const testIds = teacherCourses.flatMap((course) => course.tests.map((test) => test.id));

      const submissions = assignmentIds.length
        ? await prisma.submission.findMany({
            where: {
              assignmentId: { in: assignmentIds },
              OR: [{ grade: null }, { createdAt: { gte: todayStart, lte: todayEnd } }],
            },
            include: {
              assignment: { select: { id: true, title: true, courseId: true } },
              student: { select: { id: true, fullName: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
          })
        : [];

      const reviewAttempts = testIds.length
        ? await prisma.attempt.findMany({
            where: {
              testId: { in: testIds },
              finishedAt: { not: null },
              answers: {
                some: {
                  reviewStatus: { in: ["REVIEW_REQUESTED", "MANUAL_REQUIRED", "AUTO"] },
                },
              },
            },
            include: {
              test: { select: { id: true, title: true, courseId: true } },
              student: { select: { id: true, fullName: true, email: true } },
              answers: { select: { reviewStatus: true } },
            },
            orderBy: { finishedAt: "desc" },
          })
        : [];

      const tasks = [
        ...submissions.map((submission) => ({
          id: `submission-${submission.id}`,
          type: "submission-review",
          title: submission.assignment?.title || "Непроверенная сдача",
          studentName: submission.student?.fullName || submission.student?.email || "Студент",
          courseId: submission.assignment?.courseId || null,
          priority: submission.grade == null ? "urgent" : "soon",
          dueAt: submission.createdAt,
        })),
        ...reviewAttempts.map((attempt) => ({
          id: `attempt-review-${attempt.id}`,
          type: "test-review",
          title: attempt.test?.title || "Тест требует проверки",
          studentName: attempt.student?.fullName || attempt.student?.email || "Студент",
          courseId: attempt.test?.courseId || null,
          priority: "urgent",
          dueAt: attempt.finishedAt,
        })),
      ];

      const progress = teacherCourses.map((course) => ({
        course: mapCourse(course),
        progressPercent: course.assignments.length || course.tests.length ? 100 : 0,
        totalUnits: course.assignments.length + course.tests.length,
        completedUnits: course.assignments.length + course.tests.length,
        pendingReviews:
          submissions.filter((submission) => submission.assignment?.courseId === course.id && submission.grade == null).length +
          reviewAttempts.filter((attempt) => attempt.test?.courseId === course.id).length,
      }));

      return res.json({
        ok: true,
        role,
        tasks,
        progress,
        schedulePreview: [],
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: String(err.message || err),
        message: String(err.message || err),
      });
    }
  });
};
