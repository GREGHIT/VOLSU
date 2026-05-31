module.exports = function registerStudentRoutes(app, deps) {
  const { prisma, authRequired, requireRole, mapStudent, hashPassword } = deps;

function getManagedGroupIds(auth) {
  return Array.isArray(auth?.managedGroupIds) ? auth.managedGroupIds.map((id) => Number(id)).filter(Number.isInteger) : [];
}

function buildTeacherGroupFilter(auth) {
  const ids = getManagedGroupIds(auth);
  return auth?.role === 'TEACHER' && ids.length ? { in: ids } : null;
}

app.post('/courses/:courseId/enroll', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const { studentEmail } = req.body;

    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ ok: false, error: 'invalid courseId' });
    }
    if (!studentEmail) {
      return res.status(400).json({ ok: false, error: 'Укажите email студента.' });
    }

    // пров�µрим, что курс прин�°д�»РµР¶ит т�µкущ�µму пр�µпод�°РІР°т�µР»ю
    const course = await prisma.course.findFirst({
      where: { id: courseId, teacherId: req.auth.sub },
    });
    if (!course) {
      return res.status(404).json({ ok: false, error: 'course not found' });
    }

    const student = await prisma.user.findUnique({
      where: { email: String(studentEmail).toLowerCase().trim() },
    });
    if (!student) {
      return res.status(404).json({ ok: false, error: 'student not found' });
    }
    if (student.role !== 'STUDENT') {
      return res.status(400).json({ ok: false, error: 'user is not a student' });
    }
    const managedGroupIds = getManagedGroupIds(req.auth);
    if (req.auth.role === 'TEACHER' && managedGroupIds.length && !managedGroupIds.includes(student.groupId)) {
      return res.status(403).json({ ok: false, error: 'Преподаватель может работать только со своими группами.' });
    }

    const enrollment = await prisma.enrollment.create({
      data: { courseId: course.id, studentId: student.id },
    });

    await prisma.courseGrade.upsert({
      where: { courseId_studentId: { courseId: course.id, studentId: student.id } },
      update: {},
      create: { courseId: course.id, studentId: student.id },
    });

    return res.json({ ok: true, enrollment });
  } catch (err) {
    return res.status(400).json({ ok: false, error: String(err) });
  }
});

// Вс�µ студ�µнты (то�»ько пр�µпод�°РІР°т�µР»ь/�°дмин)
app.get('/students', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const teacherGroupFilter = buildTeacherGroupFilter(req.auth);
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT', ...(teacherGroupFilter ? { groupId: teacherGroupFilter } : {}) },
      include: { group: true },
      orderBy: { id: 'asc' },
    });

    res.json({ ok: true, students: students.map(mapStudent) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/students', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const { email, password, fullName, studentCode, faculty, groupId } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ ok: false, error: 'Укажите email, пароль и ФИО студента.' });
    }

    const managedGroupIds = getManagedGroupIds(req.auth);
    if (req.auth.role === 'TEACHER' && managedGroupIds.length && Number.isInteger(groupId) && !managedGroupIds.includes(groupId)) {
      return res.status(403).json({ ok: false, error: 'Преподаватель может добавлять студентов только в свои группы.' });
    }

    const student = await prisma.user.create({
      data: {
        email: String(email).toLowerCase().trim(),
        passwordHash: await hashPassword(password),
        role: 'STUDENT',
        fullName: String(fullName).trim(),
        studentCode: studentCode ? String(studentCode).trim() : null,
        faculty: faculty ? String(faculty).trim() : null,
        groupId: Number.isInteger(groupId) ? groupId : null,
      },
      include: { group: true },
    });

    res.json({ ok: true, student: mapStudent(student) });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

app.put('/students/:studentId', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    const { fullName, studentCode, faculty, groupId } = req.body;
    if (!Number.isInteger(studentId)) return res.status(400).json({ ok: false, error: 'invalid studentId' });

    const managedGroupIds = getManagedGroupIds(req.auth);
    const currentStudent = await prisma.user.findUnique({ where: { id: studentId }, select: { id: true, role: true, groupId: true } });
    if (!currentStudent || currentStudent.role !== 'STUDENT') return res.status(404).json({ ok: false, error: 'student not found' });
    if (req.auth.role === 'TEACHER' && managedGroupIds.length) {
      const targetGroupId = groupId === null ? null : Number.isInteger(groupId) ? groupId : currentStudent.groupId;
      if (!managedGroupIds.includes(currentStudent.groupId) || (targetGroupId != null && !managedGroupIds.includes(targetGroupId))) {
        return res.status(403).json({ ok: false, error: 'Преподаватель может редактировать только свои группы.' });
      }
    }

    const student = await prisma.user.update({
      where: { id: studentId },
      data: {
        fullName: fullName != null ? String(fullName).trim() : undefined,
        studentCode: studentCode != null ? String(studentCode).trim() : undefined,
        faculty: faculty != null ? String(faculty).trim() : undefined,
        groupId: groupId === null ? null : Number.isInteger(groupId) ? groupId : undefined,
      },
      include: { group: true },
    });

    res.json({ ok: true, student: mapStudent(student) });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

app.get('/groups', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const teacherGroupFilter = buildTeacherGroupFilter(req.auth);
    const groups = await prisma.studentGroup.findMany({
      where: teacherGroupFilter ? { id: teacherGroupFilter } : undefined,
      include: { _count: { select: { students: true } } },
      orderBy: [{ faculty: 'asc' }, { name: 'asc' }],
    });
    res.json({
      ok: true,
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        faculty: group.faculty,
        studentsCount: group._count.students,
      })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/groups', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const { name, faculty } = req.body;
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ ok: false, error: 'Укажите название группы.' });
    }

    const group = await prisma.studentGroup.create({
      data: {
        name: String(name).trim(),
        faculty: faculty ? String(faculty).trim() : '',
      },
    });

    res.json({ ok: true, group });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

app.delete('/groups/:groupId', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    if (!Number.isInteger(groupId)) return res.status(400).json({ ok: false, error: 'invalid groupId' });
    const managedGroupIds = getManagedGroupIds(req.auth);
    if (req.auth.role === 'TEACHER' && managedGroupIds.length && !managedGroupIds.includes(groupId)) {
      return res.status(403).json({ ok: false, error: 'Преподаватель может удалять только свои группы.' });
    }

    const group = await prisma.studentGroup.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ ok: false, error: 'group not found' });

    await prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { groupId } });
      await tx.user.updateMany({ where: { groupId }, data: { groupId: null } });
      await tx.studentGroup.delete({ where: { id: groupId } });
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

// Список �·Р°пис�°нных студ�µнтов н�° курс (то�»ько в�»Р°д�µР»Рµц курс�° РёР»Рё ADMIN)
app.get('/courses/:courseId/enrollments', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId)) return res.status(400).json({ ok: false, error: 'invalid courseId' });

    const course = await prisma.course.findFirst({ where: { id: courseId, teacherId: req.auth.sub } });
    if (!course && req.auth.role !== 'ADMIN') return res.status(404).json({ ok: false, error: 'course not found' });

    const managedGroupIds = getManagedGroupIds(req.auth);
    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId,
        ...(req.auth.role === 'TEACHER' && managedGroupIds.length ? { student: { groupId: { in: managedGroupIds } } } : {}),
      },
      include: {
        student: {
          include: { group: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      ok: true,
      enrollments: enrollments.map(e => ({
        id: e.id,
        studentId: e.studentId,
        email: e.student.email,
        fullName: e.student.fullName ?? '',
        studentCode: e.student.studentCode ?? '',
        faculty: e.student.faculty ?? '',
        groupId: e.student.groupId ?? null,
        groupName: e.student.group?.name ?? '',
        createdAt: e.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Снять студ�µнт�° с курс�° (то�»ько в�»Р°д�µР»Рµц курс�° РёР»Рё ADMIN)
app.post('/courses/:courseId/unenroll', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const { studentId } = req.body;

    if (!Number.isInteger(courseId)) return res.status(400).json({ ok: false, error: 'invalid courseId' });
    if (!Number.isInteger(studentId)) return res.status(400).json({ ok: false, error: 'Выберите студента.' });

    const course = await prisma.course.findFirst({ where: { id: courseId, teacherId: req.auth.sub } });
    if (!course && req.auth.role !== 'ADMIN') return res.status(404).json({ ok: false, error: 'course not found' });
    const managedGroupIds = getManagedGroupIds(req.auth);
    if (req.auth.role === 'TEACHER' && managedGroupIds.length) {
      const student = await prisma.user.findUnique({ where: { id: studentId }, select: { groupId: true } });
      if (!student || !managedGroupIds.includes(student.groupId)) {
        return res.status(403).json({ ok: false, error: 'Преподаватель может изменять записи только своих групп.' });
      }
    }

    await prisma.courseGrade.deleteMany({
      where: { courseId, studentId },
    });

    await prisma.enrollment.deleteMany({
      where: { courseId, studentId },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

app.post('/courses/:courseId/enrollments/group-remove', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const { groupId } = req.body;
    if (!Number.isInteger(courseId)) return res.status(400).json({ ok: false, error: 'invalid courseId' });
    if (!Number.isInteger(groupId)) return res.status(400).json({ ok: false, error: 'Выберите группу.' });

    const course = await prisma.course.findFirst({ where: { id: courseId, teacherId: req.auth.sub } });
    if (!course && req.auth.role !== 'ADMIN') return res.status(404).json({ ok: false, error: 'course not found' });
    const managedGroupIds = getManagedGroupIds(req.auth);
    if (req.auth.role === 'TEACHER' && managedGroupIds.length && !managedGroupIds.includes(groupId)) {
      return res.status(403).json({ ok: false, error: 'Преподаватель может менять записи только своих групп.' });
    }

    const students = await prisma.user.findMany({
      where: { role: 'STUDENT', groupId },
      select: { id: true },
    });
    const ids = students.map((student) => student.id);

    if (!ids.length) return res.json({ ok: true, removedCount: 0 });

    await prisma.courseGrade.deleteMany({
      where: { courseId, studentId: { in: ids } },
    });

    const result = await prisma.enrollment.deleteMany({
      where: { courseId, studentId: { in: ids } },
    });

    res.json({ ok: true, removedCount: result.count });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

app.get('/courses/:courseId/students', authRequired, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId)) return res.status(400).json({ ok: false, error: 'invalid courseId' });

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ ok: false, error: 'course not found' });

    if (req.auth.role === 'STUDENT') {
      const enrolled = await prisma.enrollment.findFirst({
        where: { courseId, studentId: req.auth.sub },
      });
      if (!enrolled) return res.status(403).json({ ok: false, error: 'not enrolled' });
    } else if (req.auth.role !== 'ADMIN' && course.teacherId !== req.auth.sub) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    const managedGroupIds = getManagedGroupIds(req.auth);
    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId,
        ...(req.auth.role === 'TEACHER' && managedGroupIds.length ? { student: { groupId: { in: managedGroupIds } } } : {}),
      },
      include: { student: { include: { group: true } } },
      orderBy: [{ student: { fullName: 'asc' } }, { studentId: 'asc' }],
    });

    res.json({
      ok: true,
      students: enrollments.map((item) => mapStudent(item.student)),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/courses/:courseId/enrollments/bulk', authRequired, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const { studentIds, groupId } = req.body;
    if (!Number.isInteger(courseId)) return res.status(400).json({ ok: false, error: 'invalid courseId' });

    const course = await prisma.course.findFirst({ where: { id: courseId, teacherId: req.auth.sub } });
    if (!course && req.auth.role !== 'ADMIN') return res.status(404).json({ ok: false, error: 'course not found' });

    let ids = Array.isArray(studentIds) ? studentIds.map(Number).filter(Number.isInteger) : [];
    const managedGroupIds = getManagedGroupIds(req.auth);
    if (Number.isInteger(groupId)) {
      if (req.auth.role === 'TEACHER' && managedGroupIds.length && !managedGroupIds.includes(groupId)) {
        return res.status(403).json({ ok: false, error: 'Преподаватель может работать только со своими группами.' });
      }
      const groupStudents = await prisma.user.findMany({
        where: { role: 'STUDENT', groupId },
        select: { id: true },
      });
      ids = [...new Set([...ids, ...groupStudents.map((student) => student.id)])];
    }

    if (req.auth.role === 'TEACHER' && managedGroupIds.length && ids.length) {
      const allowedStudents = await prisma.user.findMany({
        where: { id: { in: ids }, role: 'STUDENT', groupId: { in: managedGroupIds } },
        select: { id: true },
      });
      ids = allowedStudents.map((student) => student.id);
    }

    if (!ids.length) return res.status(400).json({ ok: false, error: 'no students selected' });

    const existing = await prisma.enrollment.findMany({
      where: { courseId, studentId: { in: ids } },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map((row) => row.studentId));
    const idsToCreate = ids.filter((studentId) => !existingIds.has(studentId));

    if (idsToCreate.length) {
      await prisma.enrollment.createMany({
        data: idsToCreate.map((studentId) => ({ courseId, studentId })),
      });
      for (const studentId of idsToCreate) {
        await prisma.courseGrade.upsert({
          where: { courseId_studentId: { courseId, studentId } },
          update: {},
          create: { courseId, studentId },
        });
      }
    }

    res.json({ ok: true, enrolledCount: idsToCreate.length, skippedCount: ids.length - idsToCreate.length });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});


};
