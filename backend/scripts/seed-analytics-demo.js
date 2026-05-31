const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function ensureEnrollment(courseId, studentId) {
  await prisma.enrollment.upsert({
    where: { courseId_studentId: { courseId, studentId } },
    update: {},
    create: { courseId, studentId },
  });
}

async function ensureSubmission(assignmentId, studentId, grade, contentText, createdAtOffsetDays) {
  const createdAt = new Date(Date.now() - createdAtOffsetDays * 24 * 60 * 60 * 1000);
  await prisma.submission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    update: { grade, feedback: grade < 60 ? "Нужно подтянуть решение и оформление." : "Хорошая работа.", gradedAt: new Date(), contentText },
    create: {
      assignmentId,
      studentId,
      contentText,
      grade,
      feedback: grade < 60 ? "Нужно подтянуть решение и оформление." : "Хорошая работа.",
      gradedAt: new Date(),
      createdAt,
    },
  });
}

async function ensureAttempt(testId, studentId, score, maxScore, offsetDays) {
  const finishedAt = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  const existing = await prisma.attempt.findFirst({
    where: { testId, studentId, finishedAt: { not: null } },
  });
  if (existing) {
    await prisma.attempt.update({
      where: { id: existing.id },
      data: { score, maxScore, finishedAt },
    });
    return;
  }

  await prisma.attempt.create({
    data: {
      testId,
      studentId,
      score,
      maxScore,
      startedAt: new Date(finishedAt.getTime() - 25 * 60 * 1000),
      finishedAt,
    },
  });
}

async function main() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { id: "asc" },
  });
  const courses = await prisma.course.findMany({
    where: { teacherId: 1 },
    include: { assignments: true, tests: true },
    orderBy: { id: "asc" },
  });

  if (!students.length || !courses.length) {
    console.log("Недостаточно данных для демо-аналитики.");
    return;
  }

  const targetCourses = courses.slice(0, 3);
  const targetStudents = students.slice(0, 6);

  for (const course of targetCourses) {
    for (const student of targetStudents) {
      await ensureEnrollment(course.id, student.id);
    }

    let assignments = course.assignments;
    if (!assignments.length) {
      assignments = [
        await prisma.assignment.create({
          data: {
            courseId: course.id,
            teacherId: course.teacherId,
            title: `Практикум по курсу ${course.title}`,
            description: "Демо-задание для аналитики.",
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          },
        }),
      ];
    }

    let tests = course.tests;
    if (!tests.length) {
      tests = [
        await prisma.test.create({
          data: {
            courseId: course.id,
            teacherId: course.teacherId,
            title: `Контрольный тест по курсу ${course.title}`,
            description: "Демо-тест для аналитики.",
            isPublished: true,
          },
        }),
      ];
    }

    const baseGrades = [94, 87, 72, 58, 81, 66];
    const basePercents = [96, 88, 74, 52, 79, 61];

    for (let index = 0; index < targetStudents.length; index += 1) {
      const student = targetStudents[index];
      const assignment = assignments[index % assignments.length];
      const test = tests[index % tests.length];

      if (index !== 4) {
        await ensureSubmission(
          assignment.id,
          student.id,
          baseGrades[index],
          `Демо-решение студента ${student.email}`,
          index + 1
        );
      }

      if (index !== 3) {
        await ensureAttempt(test.id, student.id, basePercents[index], 100, index + 2);
      }
    }
  }

  console.log("Демо-аналитика подготовлена.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
