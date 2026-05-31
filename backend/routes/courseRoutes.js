module.exports = function registerCourseRoutes(app, deps) {
  const { prisma, authRequired, requireRole, mapCourse, COURSE_TAG_PRESETS, appendAuditEntry, listAuditEntries, ok, error } = deps;

app.get('/course-tag-options', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  return res.json({ ok: true, options: COURSE_TAG_PRESETS });
});

app.post('/courses', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const { title, subjectName, subjectCode, courseNumber, semester, department, studyYear, format, campus } = req.body;

    if (!title || String(title).trim().length < 3) {
      return res.status(400).json({ ok: false, error: 'Название курса должно содержать минимум 3 символа.' });
    }

    const course = await prisma.course.create({
      data: {
        title: String(title).trim(),
        subjectName: subjectName ? String(subjectName).trim() : '',
        subjectCode: subjectCode ? String(subjectCode).trim() : '',
        courseNumber: Number.isInteger(courseNumber) ? courseNumber : null,
        semester: semester ? String(semester).trim() : '',
        department: department ? String(department).trim() : '',
        studyYear: studyYear ? String(studyYear).trim() : '',
        format: format ? String(format).trim() : '',
        campus: campus ? String(campus).trim() : '',
        teacherId: req.auth.sub,
      },
    });

    await appendAuditEntry({
      actorId: req.auth.sub,
      actorRole: req.auth.role,
      action: 'COURSE_CREATED',
      entityType: 'course',
      entityId: course.id,
      courseId: course.id,
      summary: `Создан курс "${course.title}"`,
    });

    return ok(res, { course: mapCourse(course) });
  } catch (err) {
    return error(res, 500, String(err));
  }
});

// Список моих курсов (пр�µпод�°РІР°т�µР»ь/�°дмин)
app.get('/courses', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      where: req.auth.role === 'ADMIN' ? {} : { teacherId: req.auth.sub },
      orderBy: { createdAt: 'desc' },
    });

    return ok(res, { courses: courses.map(mapCourse) });
  } catch (err) {
    return error(res, 500, String(err));
  }
});

// Р—Р°пис�°ть студ�µнт�° РЅР° курс (то�»ько пр�µпод�°РІР°т�µР»ь/�°дмин)
app.get('/courses/:courseId', authRequired, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ ok: false, error: 'invalid courseId' });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        subjectName: true,
        subjectCode: true,
        courseNumber: true,
        semester: true,
        department: true,
        studyYear: true,
        format: true,
        campus: true,
        teacherId: true,
        createdAt: true,
      },
    });
    if (!course) return res.status(404).json({ ok: false, error: 'course not found' });

    if (req.auth.role === 'STUDENT') {
      const enrolled = await prisma.enrollment.findFirst({
        where: { courseId, studentId: req.auth.sub },
      });
      if (!enrolled) return res.status(403).json({ ok: false, error: 'not enrolled' });
    } else if (req.auth.role !== 'ADMIN' && course.teacherId !== req.auth.sub) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    return ok(res, { course: mapCourse(course) });
  } catch (err) {
    return error(res, 500, String(err));
  }
});

app.post('/courses/:courseId/duplicate', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const sourceCourseId = Number(req.params.courseId);
    const {
      title,
      semester,
      studyYear,
      copyAssignments = true,
      copyTests = true,
    } = req.body || {};

    if (!Number.isInteger(sourceCourseId)) {
      return error(res, 400, 'invalid courseId');
    }

    const sourceCourse = await prisma.course.findUnique({
      where: { id: sourceCourseId },
      include: {
        assignments: true,
        tests: {
          include: {
            questions: {
              include: { options: true },
            },
          },
        },
      },
    });

    if (!sourceCourse) return error(res, 404, 'course not found');
    if (req.auth.role !== 'ADMIN' && sourceCourse.teacherId !== req.auth.sub) {
      return error(res, 403, 'forbidden');
    }

    const duplicated = await prisma.$transaction(async (tx) => {
      const nextCourse = await tx.course.create({
        data: {
          title: String(title || `${sourceCourse.title} - новый семестр`).trim(),
          subjectName: sourceCourse.subjectName,
          subjectCode: sourceCourse.subjectCode,
          courseNumber: sourceCourse.courseNumber,
          semester: semester != null ? String(semester).trim() : sourceCourse.semester,
          department: sourceCourse.department,
          studyYear: studyYear != null ? String(studyYear).trim() : sourceCourse.studyYear,
          format: sourceCourse.format,
          campus: sourceCourse.campus,
          teacherId: sourceCourse.teacherId,
        },
      });

      if (copyAssignments) {
        for (const assignment of sourceCourse.assignments) {
          await tx.assignment.create({
            data: {
              title: assignment.title,
              description: assignment.description,
              dueDate: assignment.dueDate,
              courseId: nextCourse.id,
              teacherId: sourceCourse.teacherId,
            },
          });
        }
      }

      if (copyTests) {
        for (const sourceTest of sourceCourse.tests) {
          const nextTest = await tx.test.create({
            data: {
              title: sourceTest.title,
              description: sourceTest.description,
              instructions: sourceTest.instructions,
              isPublished: false,
              timeLimitMinutes: sourceTest.timeLimitMinutes,
              tabSwitchLimit: sourceTest.tabSwitchLimit,
              attemptLimit: sourceTest.attemptLimit,
              courseId: nextCourse.id,
              teacherId: sourceCourse.teacherId,
            },
          });

          for (const sourceQuestion of sourceTest.questions) {
            await tx.question.create({
              data: {
                type: sourceQuestion.type,
                text: sourceQuestion.text,
                configJson: sourceQuestion.configJson,
                points: sourceQuestion.points,
                order: sourceQuestion.order,
                testId: nextTest.id,
                options: sourceQuestion.options?.length
                  ? {
                      create: sourceQuestion.options.map((option) => ({
                        text: option.text,
                        isCorrect: option.isCorrect,
                      })),
                    }
                  : undefined,
              },
            });
          }
        }
      }

      return nextCourse;
    });

    await appendAuditEntry({
      actorId: req.auth.sub,
      actorRole: req.auth.role,
      action: 'COURSE_DUPLICATED',
      entityType: 'course',
      entityId: duplicated.id,
      courseId: duplicated.id,
      summary: `Курс "${sourceCourse.title}" продублирован в "${duplicated.title}"`,
      meta: {
        sourceCourseId,
        copyAssignments: !!copyAssignments,
        copyTests: !!copyTests,
      },
    });

    return ok(res, { course: mapCourse(duplicated) });
  } catch (err) {
    return error(res, 400, String(err?.message || err));
  }
});

app.delete('/courses/:courseId', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ ok: false, error: 'invalid courseId' });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ ok: false, error: 'course not found' });
    if (req.auth.role !== 'ADMIN' && course.teacherId !== req.auth.sub) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.answerSelection.deleteMany({
        where: { answer: { attempt: { test: { courseId } } } },
      });
      await tx.answer.deleteMany({ where: { attempt: { test: { courseId } } } });
      await tx.attempt.deleteMany({ where: { test: { courseId } } });
      await tx.courseGrade.deleteMany({ where: { courseId } });
      await tx.option.deleteMany({ where: { question: { test: { courseId } } } });
      await tx.question.deleteMany({ where: { test: { courseId } } });
      await tx.test.deleteMany({ where: { courseId } });
      await tx.submission.deleteMany({ where: { assignment: { courseId } } });
      await tx.assignment.deleteMany({ where: { courseId } });
      await tx.enrollment.deleteMany({ where: { courseId } });
      await tx.course.delete({ where: { id: courseId } });
    });

    await appendAuditEntry({
      actorId: req.auth.sub,
      actorRole: req.auth.role,
      action: 'COURSE_DELETED',
      entityType: 'course',
      entityId: course.id,
      courseId: course.id,
      summary: `Удалён курс "${course.title}"`,
    });

    return ok(res);
  } catch (err) {
    return error(res, 400, String(err));
  }
});

app.put('/courses/:courseId', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ ok: false, error: 'invalid courseId' });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ ok: false, error: 'course not found' });
    if (req.auth.role !== 'ADMIN' && course.teacherId !== req.auth.sub) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    const {
      title,
      subjectName,
      subjectCode,
      courseNumber,
      semester,
      department,
      studyYear,
      format,
      campus,
    } = req.body;

    const updated = await prisma.course.update({
      where: { id: courseId },
      data: {
        title: title != null ? String(title).trim() : undefined,
        subjectName: subjectName != null ? String(subjectName).trim() : undefined,
        subjectCode: subjectCode != null ? String(subjectCode).trim() : undefined,
        courseNumber: courseNumber === null ? null : Number.isInteger(courseNumber) ? courseNumber : undefined,
        semester: semester != null ? String(semester).trim() : undefined,
        department: department != null ? String(department).trim() : undefined,
        studyYear: studyYear != null ? String(studyYear).trim() : undefined,
        format: format != null ? String(format).trim() : undefined,
        campus: campus != null ? String(campus).trim() : undefined,
      },
    });

    await appendAuditEntry({
      actorId: req.auth.sub,
      actorRole: req.auth.role,
      action: 'COURSE_UPDATED',
      entityType: 'course',
      entityId: updated.id,
      courseId: updated.id,
      summary: `Обновлён курс "${updated.title}"`,
    });

    return ok(res, { course: mapCourse(updated) });
  } catch (err) {
    return error(res, 400, String(err));
  }
});

app.get('/courses/:courseId/history', authRequired, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId)) {
      return error(res, 400, 'invalid courseId');
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return error(res, 404, 'course not found');

    if (req.auth.role === 'STUDENT') {
      const enrolled = await prisma.enrollment.findFirst({ where: { courseId, studentId: req.auth.sub } });
      if (!enrolled) return error(res, 403, 'not enrolled');
    } else if (req.auth.role !== 'ADMIN' && course.teacherId !== req.auth.sub) {
      return error(res, 403, 'forbidden');
    }

    const history = await listAuditEntries({ courseId });
    return ok(res, { history });
  } catch (err) {
    return error(res, 500, String(err?.message || err));
  }
});

app.get('/my/courses', authRequired, requireRole('STUDENT'), async (req, res) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: req.auth.sub },
      include: { course: true },
      orderBy: { createdAt: 'desc' },
    });

    const courses = enrollments.map(e => mapCourse(e.course));
    return ok(res, { courses });
  } catch (err) {
    return error(res, 500, String(err));
  }
});

};
