const fs = require('fs');
const path = require('path');

module.exports = function registerAssignmentRoutes(app, deps) {
  const { prisma, authRequired, requireRole, appendAuditEntry, ok, error } = deps;
  const uploadsRoot = path.join(__dirname, '..', 'uploads', 'submissions');

  function safeParseJsonArray(value) {
    if (!value || typeof value !== 'string') return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function sanitizeFilenamePart(value, fallback = 'file') {
    const normalized = String(value || fallback)
      .replace(/[^\p{L}\p{N}._-]+/gu, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    return normalized || fallback;
  }

  function ensureUploadsRoot() {
    fs.mkdirSync(uploadsRoot, { recursive: true });
  }

  function serializeSubmission(submission) {
    return {
      ...submission,
      attachments: safeParseJsonArray(submission.attachmentsJson),
    };
  }

  function removeStoredAttachments(attachments) {
    for (const file of attachments || []) {
      if (!file?.relativePath) continue;
      const absolutePath = path.join(__dirname, '..', file.relativePath);
      try {
        if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
      } catch {
        // ignore cleanup issues
      }
    }
  }

  function normalizeIncomingAttachments(input) {
    if (!Array.isArray(input)) return [];
    return input
      .map((file) => {
        if (!file || typeof file !== 'object') return null;
        const dataUrl = typeof file.dataUrl === 'string' ? file.dataUrl : '';
        if (!dataUrl.startsWith('data:')) return null;
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex < 0) return null;
        const encoded = dataUrl.slice(commaIndex + 1);
        const buffer = Buffer.from(encoded, 'base64');
        if (!buffer.length) return null;
        return {
          originalName: sanitizeFilenamePart(file.originalName || file.name || 'file'),
          mimeType: String(file.mimeType || file.type || 'application/octet-stream'),
          size: Number(file.size || buffer.length),
          buffer,
        };
      })
      .filter(Boolean)
      .slice(0, 8);
  }

  function persistAttachments(assignmentId, studentId, attachments) {
    ensureUploadsRoot();
    return attachments.map((file, index) => {
      const ext = path.extname(file.originalName || '') || '';
      const basename = sanitizeFilenamePart(path.basename(file.originalName, ext), 'file');
      const filename = `${Date.now()}_${studentId}_${assignmentId}_${index}_${basename}${ext}`;
      const absolutePath = path.join(uploadsRoot, filename);
      fs.writeFileSync(absolutePath, file.buffer);
      return {
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        relativePath: path.join('uploads', 'submissions', filename).replace(/\\/g, '/'),
        url: `/uploads/submissions/${filename}`,
      };
    });
  }

  async function ensureCourseAccess(courseId, auth) {
    if (auth.role === 'ADMIN') {
      return prisma.course.findUnique({ where: { id: courseId } });
    }
    if (auth.role === 'TEACHER') {
      return prisma.course.findFirst({ where: { id: courseId, teacherId: auth.sub } });
    }
    return prisma.enrollment.findFirst({ where: { courseId, studentId: auth.sub } });
  }

  app.post('/courses/:courseId/assignments', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
      const courseId = Number(req.params.courseId);
      const { title, description, dueDate } = req.body;

      if (!Number.isInteger(courseId)) {
        return error(res, 400, 'invalid courseId');
      }
      if (!title || String(title).trim().length < 3) {
        return error(res, 400, 'Название задания должно содержать минимум 3 символа.');
      }

      const course = await ensureCourseAccess(courseId, req.auth);
      if (!course) return error(res, 404, 'course not found');

      const assignment = await prisma.assignment.create({
        data: {
          title: String(title).trim(),
          description: description ? String(description) : '',
          dueDate: dueDate ? new Date(dueDate) : null,
          courseId,
          teacherId: req.auth.role === 'ADMIN' ? course.teacherId : req.auth.sub,
        },
      });

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: 'ASSIGNMENT_CREATED',
        entityType: 'assignment',
        entityId: assignment.id,
        courseId,
        summary: `Создано задание "${assignment.title}"`,
      });

      return ok(res, { assignment });
    } catch (err) {
      return error(res, 400, String(err?.message || err));
    }
  });

  app.delete('/assignments/:assignmentId', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
      const assignmentId = Number(req.params.assignmentId);
      if (!Number.isInteger(assignmentId)) return error(res, 400, 'invalid assignmentId');

      const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) return error(res, 404, 'assignment not found');

      const course = await ensureCourseAccess(assignment.courseId, req.auth);
      if (!course) return error(res, 403, 'forbidden');

      const submissions = await prisma.submission.findMany({
        where: { assignmentId },
        select: { attachmentsJson: true },
      });
      submissions.forEach((submission) => removeStoredAttachments(safeParseJsonArray(submission.attachmentsJson)));

      await prisma.submission.deleteMany({ where: { assignmentId } });
      await prisma.assignment.delete({ where: { id: assignmentId } });

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: 'ASSIGNMENT_DELETED',
        entityType: 'assignment',
        entityId: assignmentId,
        courseId: assignment.courseId,
        summary: `Удалено задание "${assignment.title}"`,
      });

      return ok(res);
    } catch (err) {
      return error(res, 400, String(err?.message || err));
    }
  });

  app.post('/assignments/:assignmentId/duplicate', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
      const assignmentId = Number(req.params.assignmentId);
      const { title, dueDate, courseId } = req.body || {};
      if (!Number.isInteger(assignmentId)) return error(res, 400, 'invalid assignmentId');

      const source = await prisma.assignment.findUnique({ where: { id: assignmentId } });
      if (!source) return error(res, 404, 'assignment not found');

      const targetCourseId = Number.isInteger(courseId) ? courseId : source.courseId;
      const course = await ensureCourseAccess(targetCourseId, req.auth);
      if (!course) return error(res, 404, 'course not found');

      const duplicated = await prisma.assignment.create({
        data: {
          title: String(title || `${source.title} (копия)`).trim(),
          description: source.description,
          dueDate: dueDate ? new Date(dueDate) : source.dueDate,
          courseId: targetCourseId,
          teacherId: req.auth.role === 'ADMIN' && course.teacherId ? course.teacherId : source.teacherId,
        },
      });

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: 'ASSIGNMENT_DUPLICATED',
        entityType: 'assignment',
        entityId: duplicated.id,
        courseId: targetCourseId,
        summary: `Задание "${source.title}" продублировано`,
      });

      return ok(res, { assignment: duplicated });
    } catch (err) {
      return error(res, 400, String(err?.message || err));
    }
  });

  app.post('/courses/:courseId/assignments/batch', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
      const courseId = Number(req.params.courseId);
      const { action, ids = [], dueDate = null } = req.body || {};
      if (!Number.isInteger(courseId)) return error(res, 400, 'invalid courseId');
      if (!Array.isArray(ids) || !ids.length) return error(res, 400, 'Выберите хотя бы одно задание.');

      const course = await ensureCourseAccess(courseId, req.auth);
      if (!course) return error(res, 404, 'course not found');

      const normalizedIds = ids.map(Number).filter(Number.isInteger);
      if (!normalizedIds.length) return error(res, 400, 'Выберите хотя бы одно задание.');

      if (action === 'delete') {
        const submissions = await prisma.submission.findMany({
          where: { assignmentId: { in: normalizedIds } },
          select: { attachmentsJson: true },
        });
        submissions.forEach((submission) => removeStoredAttachments(safeParseJsonArray(submission.attachmentsJson)));
        await prisma.submission.deleteMany({ where: { assignmentId: { in: normalizedIds } } });
        await prisma.assignment.deleteMany({ where: { id: { in: normalizedIds }, courseId } });
      } else if (action === 'reschedule') {
        await prisma.assignment.updateMany({
          where: { id: { in: normalizedIds }, courseId },
          data: { dueDate: dueDate ? new Date(dueDate) : null },
        });
      } else {
        return error(res, 400, 'Некорректное массовое действие.');
      }

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: 'ASSIGNMENT_BATCH_UPDATED',
        entityType: 'assignment',
        entityId: null,
        courseId,
        summary: `Массовое действие над заданиями: ${action}`,
        meta: { ids: normalizedIds, dueDate },
      });

      return ok(res);
    } catch (err) {
      return error(res, 400, String(err?.message || err));
    }
  });

  app.get('/courses/:courseId/assignments', authRequired, async (req, res) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!Number.isInteger(courseId)) return error(res, 400, 'invalid courseId');

      const access = await ensureCourseAccess(courseId, req.auth);
      if (!access) {
        if (req.auth.role === 'STUDENT') return error(res, 403, 'not enrolled');
        return error(res, 404, 'course not found');
      }

      const assignments = await prisma.assignment.findMany({
        where: { courseId },
        orderBy: { createdAt: 'desc' },
      });

      if (req.auth.role === 'STUDENT') {
        const submissions = await prisma.submission.findMany({
          where: { studentId: req.auth.sub, assignment: { courseId } },
          select: {
            assignmentId: true,
            contentText: true,
            attachmentsJson: true,
            grade: true,
            feedback: true,
            createdAt: true,
          },
        });
        const submissionMap = new Map(
          submissions.map((submission) => [
            submission.assignmentId,
            {
              contentText: submission.contentText,
              attachments: safeParseJsonArray(submission.attachmentsJson),
              grade: submission.grade,
              feedback: submission.feedback,
              submittedAt: submission.createdAt,
            },
          ])
        );
        return ok(res, {
          assignments: assignments.map((assignment) => ({
            ...assignment,
            mySubmission: submissionMap.get(assignment.id) || null,
          })),
        });
      }

      return ok(res, { assignments });
    } catch (err) {
      return error(res, 500, String(err?.message || err));
    }
  });

  app.post('/assignments/:assignmentId/submit', authRequired, requireRole('STUDENT'), async (req, res) => {
    try {
      const assignmentId = Number(req.params.assignmentId);
      const { contentText, attachments } = req.body || {};
      if (!Number.isInteger(assignmentId)) return error(res, 400, 'invalid assignmentId');

      const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) return error(res, 404, 'assignment not found');

      const enrolled = await prisma.enrollment.findFirst({
        where: { courseId: assignment.courseId, studentId: req.auth.sub },
      });
      if (!enrolled) return error(res, 403, 'not enrolled');

      const incomingAttachments = normalizeIncomingAttachments(attachments);
      const existingSubmission = await prisma.submission.findUnique({
        where: { assignmentId_studentId: { assignmentId, studentId: req.auth.sub } },
      });

      const trimmedText = contentText ? String(contentText) : '';
      if (!trimmedText.trim() && incomingAttachments.length === 0) {
        return error(res, 400, 'Добавьте текст ответа или хотя бы один файл.');
      }

      if (existingSubmission) {
        removeStoredAttachments(safeParseJsonArray(existingSubmission.attachmentsJson));
      }

      const storedAttachments = persistAttachments(assignmentId, req.auth.sub, incomingAttachments);

      const submission = await prisma.submission.upsert({
        where: { assignmentId_studentId: { assignmentId, studentId: req.auth.sub } },
        update: {
          contentText: trimmedText,
          attachmentsJson: JSON.stringify(storedAttachments),
        },
        create: {
          assignmentId,
          studentId: req.auth.sub,
          contentText: trimmedText,
          attachmentsJson: JSON.stringify(storedAttachments),
        },
      });

      return ok(res, { submission: serializeSubmission(submission) });
    } catch (err) {
      return error(res, 400, String(err?.message || err));
    }
  });

  app.post('/submissions/:submissionId/grade', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
      const submissionId = Number(req.params.submissionId);
      const { grade, feedback } = req.body || {};
      if (!Number.isInteger(submissionId)) return error(res, 400, 'invalid submissionId');
      if (grade !== null && grade !== undefined && (typeof grade !== 'number' || grade < 0 || grade > 100)) {
        return error(res, 400, 'grade must be number 0..100');
      }

      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: { assignment: true },
      });
      if (!submission) return error(res, 404, 'submission not found');

      const course = await ensureCourseAccess(submission.assignment.courseId, req.auth);
      if (!course) return error(res, 403, 'forbidden');

      const updated = await prisma.submission.update({
        where: { id: submissionId },
        data: {
          grade: grade ?? null,
          feedback: feedback ? String(feedback) : '',
          gradedAt: new Date(),
        },
      });

      await appendAuditEntry({
        actorId: req.auth.sub,
        actorRole: req.auth.role,
        action: 'SUBMISSION_GRADED',
        entityType: 'submission',
        entityId: updated.id,
        courseId: submission.assignment.courseId,
        summary: `Оценена сдача по заданию "${submission.assignment.title}"`,
        meta: { grade: updated.grade, feedback: updated.feedback },
      });

      return ok(res, { submission: serializeSubmission(updated) });
    } catch (err) {
      return error(res, 400, String(err?.message || err));
    }
  });

  app.get('/courses/:courseId/submissions', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!Number.isInteger(courseId)) return error(res, 400, 'invalid courseId');

      const course = await ensureCourseAccess(courseId, req.auth);
      if (!course) return error(res, 404, 'course not found');

      const submissions = await prisma.submission.findMany({
        where: { assignment: { courseId } },
        include: {
          assignment: { select: { id: true, title: true } },
          student: {
            select: {
              id: true,
              email: true,
              fullName: true,
              studentCode: true,
              faculty: true,
              group: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return ok(res, { submissions: submissions.map(serializeSubmission) });
    } catch (err) {
      return error(res, 500, String(err?.message || err));
    }
  });

  app.get('/courses/:courseId/gradebook', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!Number.isInteger(courseId)) return error(res, 400, 'invalid courseId');

      const course = await ensureCourseAccess(courseId, req.auth);
      if (!course) return error(res, 404, 'course not found');

      const enrollments = await prisma.enrollment.findMany({
        where: { courseId },
        include: { student: { include: { group: true } } },
        orderBy: { createdAt: 'asc' },
      });

      const assignments = await prisma.assignment.findMany({
        where: { courseId },
        select: { id: true, title: true, dueDate: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      const submissions = await prisma.submission.findMany({
        where: { assignment: { courseId } },
        select: {
          id: true,
          assignmentId: true,
          studentId: true,
          grade: true,
          gradedAt: true,
          createdAt: true,
        },
      });

      const submissionIndex = new Map();
      for (const submission of submissions) {
        submissionIndex.set(`${submission.studentId}:${submission.assignmentId}`, submission);
      }

      const rows = enrollments.map((enrollment) => {
        const student = enrollment.student;
        let gradedCount = 0;
        let gradedSum = 0;
        let submittedCount = 0;

        const byAssignment = assignments.map((assignment) => {
          const submission = submissionIndex.get(`${student.id}:${assignment.id}`) || null;
          if (submission) submittedCount += 1;
          if (submission?.grade != null) {
            gradedCount += 1;
            gradedSum += Number(submission.grade);
          }
          return {
            assignmentId: assignment.id,
            submissionId: submission?.id ?? null,
            grade: submission?.grade ?? null,
            submittedAt: submission?.createdAt ?? null,
            gradedAt: submission?.gradedAt ?? null,
          };
        });

        return {
          studentId: student.id,
          email: student.email,
          fullName: student.fullName ?? '',
          groupName: student.group?.name ?? '',
          submittedCount,
          gradedCount,
          avgGrade: gradedCount ? Math.round((gradedSum / gradedCount) * 10) / 10 : null,
          byAssignment,
        };
      });

      return ok(res, {
        course: { id: courseId, title: course.title ?? null },
        assignments,
        rows,
      });
    } catch (err) {
      return error(res, 500, String(err?.message || err));
    }
  });

  app.get('/courses/:courseId/gradebook/full', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!Number.isInteger(courseId)) return error(res, 400, 'invalid courseId');

      const course = await ensureCourseAccess(courseId, req.auth);
      if (!course) return error(res, 404, 'course not found');

      const enrollments = await prisma.enrollment.findMany({
        where: { courseId },
        include: {
          student: {
            include: { group: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      const assignments = await prisma.assignment.findMany({
        where: { courseId },
        select: { id: true, title: true, dueDate: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      const tests = await prisma.test.findMany({
        where: { courseId },
        select: { id: true, title: true, isPublished: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      const submissions = await prisma.submission.findMany({
        where: { assignment: { courseId } },
        select: {
          id: true,
          assignmentId: true,
          studentId: true,
          grade: true,
          gradedAt: true,
          createdAt: true,
        },
      });

      const attempts = await prisma.attempt.findMany({
        where: { test: { courseId }, finishedAt: { not: null } },
        select: {
          id: true,
          testId: true,
          studentId: true,
          score: true,
          maxScore: true,
          finishedAt: true,
        },
      });

      const submissionIndex = new Map();
      submissions.forEach((submission) => {
        submissionIndex.set(`${submission.studentId}:${submission.assignmentId}`, submission);
      });

      const bestAttemptIndex = new Map();
      attempts.forEach((attempt) => {
        const key = `${attempt.studentId}:${attempt.testId}`;
        const previous = bestAttemptIndex.get(key);
        const previousRatio = previous && previous.maxScore > 0 ? previous.score / previous.maxScore : -1;
        const currentRatio = attempt.maxScore > 0 ? attempt.score / attempt.maxScore : 0;
        if (!previous || currentRatio > previousRatio) {
          bestAttemptIndex.set(key, attempt);
        }
      });

      const rows = enrollments.map((enrollment) => {
        const student = enrollment.student;
        const assignmentCells = assignments.map((assignment) => {
          const submission = submissionIndex.get(`${student.id}:${assignment.id}`) || null;
          return {
            assignmentId: assignment.id,
            submissionId: submission?.id ?? null,
            grade: submission?.grade ?? null,
            submittedAt: submission?.createdAt ?? null,
            gradedAt: submission?.gradedAt ?? null,
          };
        });

        const testCells = tests.map((test) => {
          const bestAttempt = bestAttemptIndex.get(`${student.id}:${test.id}`) || null;
          const percent =
            bestAttempt && bestAttempt.maxScore > 0
              ? Math.round((bestAttempt.score / bestAttempt.maxScore) * 1000) / 10
              : null;
          return {
            testId: test.id,
            bestAttemptId: bestAttempt?.id ?? null,
            score: bestAttempt?.score ?? null,
            maxScore: bestAttempt?.maxScore ?? null,
            percent,
            finishedAt: bestAttempt?.finishedAt ?? null,
          };
        });

        const gradedAssignments = assignmentCells.filter((cell) => cell.grade != null).map((cell) => Number(cell.grade));
        const avgAssignmentGrade = gradedAssignments.length
          ? Math.round((gradedAssignments.reduce((sum, value) => sum + value, 0) / gradedAssignments.length) * 10) / 10
          : null;

        const finishedTests = testCells.filter((cell) => cell.percent != null).map((cell) => Number(cell.percent));
        const avgTestPercent = finishedTests.length
          ? Math.round((finishedTests.reduce((sum, value) => sum + value, 0) / finishedTests.length) * 10) / 10
          : null;

        return {
          studentId: student.id,
          email: student.email,
          fullName: student.fullName ?? '',
          groupName: student.group?.name ?? '',
          avgAssignmentGrade,
          avgTestPercent,
          assignments: assignmentCells,
          tests: testCells,
        };
      });

      return ok(res, {
        course: { id: courseId, title: course.title ?? null },
        assignments,
        tests,
        rows,
      });
    } catch (err) {
      return error(res, 500, String(err?.message || err));
    }
  });
};
