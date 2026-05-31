module.exports = function registerNotificationRoutes(app, deps) {
  const { prisma, authRequired, requireRole } = deps;

app.get('/courses/:courseId/notifications', authRequired, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId)) return res.status(400).json({ ok: false, error: 'invalid courseId' });

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ ok: false, error: 'course not found' });

    let user = null;
    if (req.auth.role === 'STUDENT') {
      user = await prisma.user.findUnique({ where: { id: req.auth.sub } });
      const enrolled = await prisma.enrollment.findFirst({ where: { courseId, studentId: req.auth.sub } });
      if (!enrolled) return res.status(403).json({ ok: false, error: 'not enrolled' });
    } else if (req.auth.role !== 'ADMIN' && course.teacherId !== req.auth.sub) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    const notifications = await prisma.notification.findMany({
      where: {
        courseId,
        ...(req.auth.role === 'STUDENT'
          ? {
              OR: [
                { audience: 'ALL' },
                { audience: 'STUDENT', studentId: req.auth.sub },
                { audience: 'GROUP', groupId: user?.groupId ?? -1 },
              ],
            }
          : {}),
      },
      include: {
        group: true,
        student: { select: { id: true, email: true, fullName: true } },
        createdBy: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, notifications });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/courses/:courseId/notifications', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const { title, body, audience, groupId, studentId } = req.body;
    if (!Number.isInteger(courseId)) return res.status(400).json({ ok: false, error: 'invalid courseId' });
    if (!title || String(title).trim().length < 3) {
      return res.status(400).json({ ok: false, error: 'Введите заголовок уведомления.' });
    }

    const course = await prisma.course.findFirst({ where: { id: courseId, teacherId: req.auth.sub } });
    if (!course && req.auth.role !== 'ADMIN') return res.status(404).json({ ok: false, error: 'course not found' });

    const normalizedAudience = String(audience || 'ALL').toUpperCase();
    if (!['ALL', 'GROUP', 'STUDENT', 'TEACHERS'].includes(normalizedAudience)) {
      return res.status(400).json({ ok: false, error: 'audience must be ALL|GROUP|STUDENT|TEACHERS' });
    }

    const notification = await prisma.notification.create({
      data: {
        title: String(title).trim(),
        body: body ? String(body) : '',
        audience: normalizedAudience,
        courseId,
        createdById: req.auth.sub,
        groupId: normalizedAudience === 'GROUP' && Number.isInteger(groupId) ? groupId : null,
        studentId: normalizedAudience === 'STUDENT' && Number.isInteger(studentId) ? studentId : null,
      },
      include: {
        group: true,
        student: { select: { id: true, email: true, fullName: true } },
        createdBy: { select: { id: true, email: true, fullName: true } },
      },
    });

    res.json({ ok: true, notification });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

app.post('/notifications/:notificationId/attempt-request', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const notificationId = Number(req.params.notificationId);
    const action = String(req.body?.action || '').toLowerCase();
    if (!Number.isInteger(notificationId)) {
      return res.status(400).json({ ok: false, error: 'invalid notificationId' });
    }
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ ok: false, error: 'action must be approve|reject' });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: { course: true },
    });
    if (!notification) return res.status(404).json({ ok: false, error: 'notification not found' });
    if (req.auth.role !== 'ADMIN' && notification.course.teacherId !== req.auth.sub) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    const payloadLine = String(notification.body || '')
      .split('\n')
      .find((line) => line.includes('"kind":"ATTEMPT_REQUEST"'));
    if (!payloadLine) {
      return res.status(400).json({ ok: false, error: 'request payload missing' });
    }

    const payload = JSON.parse(payloadLine);
    const testId = Number(payload.testId);
    const studentId = Number(payload.studentId);
    if (!Number.isInteger(testId) || !Number.isInteger(studentId)) {
      return res.status(400).json({ ok: false, error: 'request payload invalid' });
    }

    if (action === 'approve') {
      const current = await prisma.testAttemptAllowance.findUnique({
        where: { testId_studentId: { testId, studentId } },
      });
      await prisma.testAttemptAllowance.upsert({
        where: { testId_studentId: { testId, studentId } },
        update: {
          extraAttempts: Math.max(0, Number(current?.extraAttempts || 0)) + 1,
          grantedById: req.auth.sub,
        },
        create: {
          testId,
          studentId,
          extraAttempts: 1,
          grantedById: req.auth.sub,
        },
      });
    }

    await prisma.notification.create({
      data: {
        title: action === 'approve' ? 'Дополнительная попытка одобрена' : 'Запрос на попытку отклонен',
        body: action === 'approve'
          ? 'Преподаватель одобрил дополнительную попытку. Тест снова доступен для запуска.'
          : 'Преподаватель отклонил запрос на дополнительную попытку.',
        audience: 'STUDENT',
        courseId: notification.courseId,
        createdById: req.auth.sub,
        studentId,
      },
    });

    await prisma.notification.delete({ where: { id: notificationId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

app.delete('/notifications/:notificationId', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const notificationId = Number(req.params.notificationId);
    if (!Number.isInteger(notificationId)) {
      return res.status(400).json({ ok: false, error: 'invalid notificationId' });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: { course: true },
    });
    if (!notification) return res.status(404).json({ ok: false, error: 'notification not found' });
    if (req.auth.role !== 'ADMIN' && notification.course.teacherId !== req.auth.sub) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    await prisma.notification.delete({ where: { id: notificationId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

};
