const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const password = "123456";
const templatesFile = path.join(__dirname, "..", "data", "schedule-weekly-templates.json");

const groupBlueprints = [
  { name: "ИС-21-1", faculty: "Институт информатики" },
  { name: "ИС-21-2", faculty: "Институт информатики" },
  { name: "ПМИ-22-1", faculty: "Факультет прикладной математики" },
  { name: "ПМИ-22-2", faculty: "Факультет прикладной математики" },
  { name: "ИБ-23-1", faculty: "Факультет кибербезопасности" },
  { name: "ИБ-23-2", faculty: "Факультет кибербезопасности" },
  { name: "ЭК-24-1", faculty: "Экономический факультет" },
  { name: "ЭК-24-2", faculty: "Экономический факультет" },
  { name: "МО-24-1", faculty: "Факультет прикладной математики" },
  { name: "МО-24-2", faculty: "Факультет прикладной математики" },
  { name: "СА-25-1", faculty: "Факультет кибербезопасности" },
  { name: "УП-24-3", faculty: "Экономический факультет" },
];

const staffBlueprints = [
  {
    email: "admin@lms.local",
    role: "ADMIN",
    fullName: "Смирнов Артем Дмитриевич",
    faculty: "Администрация LMS",
    staffTitle: "Администратор LMS",
    staffCategory: "ADMINISTRATION",
    accessSystems: ["LMS Core", "Analytics Console", "Content Library", "Audit Log", "Database Tools", "Deployment"],
    permissions: ["COURSES_VIEW", "COURSES_EDIT", "TESTS_VIEW", "TESTS_EDIT", "TESTS_INSPECT", "SCHEDULE_EDIT", "ANALYTICS_VIEW", "ANALYTICS_EXPORT", "STUDENTS_MANAGE", "STAFF_MANAGE", "SYSTEMS_MANAGE"],
  },
  {
    email: "teacher1@lms.local",
    role: "TEACHER",
    fullName: "Иванова Анна Сергеевна",
    faculty: "Институт информатики",
    staffTitle: "Старший преподаватель",
    staffCategory: "TEACHER",
    accessSystems: ["LMS Core", "Schedule Editor", "Analytics Console", "Content Library", "Notifications"],
    permissions: ["COURSES_VIEW", "COURSES_EDIT", "TESTS_VIEW", "TESTS_EDIT", "TESTS_INSPECT", "SCHEDULE_EDIT", "ANALYTICS_VIEW", "STUDENTS_MANAGE"],
  },
  {
    email: "teacher2@lms.local",
    role: "TEACHER",
    fullName: "Петров Николай Олегович",
    faculty: "Факультет прикладной математики",
    staffTitle: "Преподаватель",
    staffCategory: "TEACHER",
    accessSystems: ["LMS Core", "Schedule Editor", "Analytics Console", "Content Library"],
    permissions: ["COURSES_VIEW", "COURSES_EDIT", "TESTS_VIEW", "TESTS_EDIT", "TESTS_INSPECT", "SCHEDULE_EDIT", "ANALYTICS_VIEW", "STUDENTS_MANAGE"],
  },
  {
    email: "teacher3@lms.local",
    role: "TEACHER",
    fullName: "Кузнецов Роман Игоревич",
    faculty: "Факультет кибербезопасности",
    staffTitle: "Доцент",
    staffCategory: "TEACHER",
    accessSystems: ["LMS Core", "Schedule Editor", "Analytics Console", "Content Library"],
    permissions: ["COURSES_VIEW", "COURSES_EDIT", "TESTS_VIEW", "TESTS_EDIT", "TESTS_INSPECT", "SCHEDULE_EDIT", "ANALYTICS_VIEW", "STUDENTS_MANAGE"],
  },
  {
    email: "developer1@lms.local",
    role: "ADMIN",
    fullName: "Орлова Мария Викторовна",
    faculty: "Платформа LMS",
    staffTitle: "Frontend разработчик",
    staffCategory: "DEVELOPER",
    accessSystems: ["LMS Core", "Analytics Console", "Content Library", "Database Tools", "Deployment"],
    permissions: ["COURSES_VIEW", "TESTS_VIEW", "TESTS_INSPECT", "ANALYTICS_VIEW", "STAFF_MANAGE", "SYSTEMS_MANAGE"],
  },
  {
    email: "developer2@lms.local",
    role: "ADMIN",
    fullName: "Фролов Егор Павлович",
    faculty: "Платформа LMS",
    staffTitle: "Backend разработчик",
    staffCategory: "DEVELOPER",
    accessSystems: ["LMS Core", "Audit Log", "Database Tools", "Deployment"],
    permissions: ["COURSES_VIEW", "TESTS_VIEW", "TESTS_INSPECT", "ANALYTICS_VIEW", "STAFF_MANAGE", "SYSTEMS_MANAGE"],
  },
];

const firstNames = ["Алина", "Илья", "Мария", "Роман", "Софья", "Артем", "Максим", "Полина", "Кирилл", "Виктория", "Даниил", "Тимур"];
const lastNames = ["Соколова", "Иванов", "Петрова", "Николаев", "Кузнецова", "Орлов", "Федорова", "Смирнов", "Попова", "Зайцев", "Лебедев", "Андреев"];
const middleNames = ["Игоревна", "Сергеевич", "Максимовна", "Алексеевич", "Андреевна", "Павлович", "Дмитриевна", "Константинович", "Ильинична", "Викторович"];

const courseBlueprints = [
  { title: "Алгоритмы и структуры данных", teacherEmail: "teacher1@lms.local", groupNames: ["ИС-21-1", "ИС-21-2"], subjectCode: "CS-204", subjectName: "Алгоритмы", department: "Кафедра информатики", semester: "Осенний", studyYear: "2026/2027", format: "Очный", campus: "Главный корпус", courseNumber: 2 },
  { title: "Базы данных", teacherEmail: "teacher1@lms.local", groupNames: ["ИС-21-1", "МО-24-1"], subjectCode: "DB-310", subjectName: "Базы данных", department: "Кафедра информатики", semester: "Осенний", studyYear: "2026/2027", format: "Очный", campus: "Главный корпус", courseNumber: 2 },
  { title: "Разработка веб-приложений", teacherEmail: "teacher1@lms.local", groupNames: ["ИС-21-2", "ПМИ-22-1"], subjectCode: "WEB-220", subjectName: "Веб-разработка", department: "Кафедра информатики", semester: "Весенний", studyYear: "2026/2027", format: "Смешанный", campus: "Главный корпус", courseNumber: 3 },
  { title: "Дискретная математика", teacherEmail: "teacher1@lms.local", groupNames: ["ПМИ-22-1", "МО-24-2"], subjectCode: "DM-115", subjectName: "Дискретная математика", department: "Кафедра прикладной математики", semester: "Весенний", studyYear: "2026/2027", format: "Очный", campus: "Корпус B", courseNumber: 2 },
  { title: "Математический анализ", teacherEmail: "teacher1@lms.local", groupNames: ["ПМИ-22-2", "МО-24-1"], subjectCode: "MAT-101", subjectName: "Математический анализ", department: "Кафедра прикладной математики", semester: "Осенний", studyYear: "2026/2027", format: "Очный", campus: "Главный корпус", courseNumber: 1 },
  { title: "Теория вероятностей", teacherEmail: "teacher1@lms.local", groupNames: ["ПМИ-22-2", "МО-24-2"], subjectCode: "STAT-201", subjectName: "Теория вероятностей", department: "Кафедра прикладной математики", semester: "Весенний", studyYear: "2027/2028", format: "Очный", campus: "Корпус B", courseNumber: 3 },
  { title: "Информационная безопасность", teacherEmail: "teacher1@lms.local", groupNames: ["ИБ-23-1", "СА-25-1"], subjectCode: "IS-220", subjectName: "Информационная безопасность", department: "Кафедра кибербезопасности", semester: "Осенний", studyYear: "2026/2027", format: "Очный", campus: "Корпус C", courseNumber: 3 },
  { title: "Сетевые технологии", teacherEmail: "teacher1@lms.local", groupNames: ["ИБ-23-2", "СА-25-1"], subjectCode: "NET-205", subjectName: "Сетевые технологии", department: "Кафедра кибербезопасности", semester: "Весенний", studyYear: "2026/2027", format: "Смешанный", campus: "Корпус C", courseNumber: 2 },
  { title: "Эконометрика", teacherEmail: "teacher1@lms.local", groupNames: ["ЭК-24-1", "УП-24-3"], subjectCode: "EC-330", subjectName: "Эконометрика", department: "Кафедра экономики и управления", semester: "Весенний", studyYear: "2026/2027", format: "Очно-заочный", campus: "Главный корпус", courseNumber: 3 },
  { title: "Управление проектами", teacherEmail: "teacher1@lms.local", groupNames: ["ЭК-24-2", "УП-24-3"], subjectCode: "PM-210", subjectName: "Управление проектами", department: "Кафедра экономики и управления", semester: "Осенний", studyYear: "2027/2028", format: "Очно-заочный", campus: "Главный корпус", courseNumber: 2 },
];

function buildStudentBlueprints() {
  const result = [];
  let counter = 1;
  for (const group of groupBlueprints) {
    for (let index = 0; index < 4; index += 1) {
      const fullName = `${lastNames[(counter + index) % lastNames.length]} ${firstNames[counter % firstNames.length]} ${middleNames[counter % middleNames.length]}`;
      result.push({
        email: `student${counter}@lms.local`,
        fullName,
        studentCode: `2026${String(counter).padStart(3, "0")}`,
        groupName: group.name,
      });
      counter += 1;
    }
  }
  return result;
}

function buildTestQuestions(courseTitle) {
  return [
    {
      type: "SINGLE",
      text: `Какой шаг для курса "${courseTitle}" нужно выполнить перед публикацией теста?`,
      points: 2,
      order: 1,
      options: {
        create: [
          { text: "Проверить вопросы и правильные ответы", isCorrect: true },
          { text: "Случайно поменять тему оформления", isCorrect: false },
          { text: "Скрыть описание теста", isCorrect: false },
        ],
      },
    },
    {
      type: "MULTI",
      text: "Что помогает преподавателю контролировать качество теста?",
      points: 3,
      order: 2,
      options: {
        create: [
          { text: "История изменений", isCorrect: true },
          { text: "Аналитика по попыткам", isCorrect: true },
          { text: "Ручная модерация спорных ответов", isCorrect: true },
          { text: "Удаление дедлайнов без причины", isCorrect: false },
        ],
      },
    },
    {
      type: "ORDER",
      text: "Расставьте этапы подготовки теста по порядку.",
      points: 4,
      order: 3,
      configJson: JSON.stringify({
        prompt: "Восстановите типовой порядок подготовки теста.",
        items: [
          "Создать карточку теста",
          "Добавить вопросы и ответы",
          "Проверить лимиты и публикацию",
          "Открыть тест студентам",
        ],
      }),
    },
    {
      type: "OPEN",
      text: "Кратко объясните, зачем студенту видеть причины потери баллов.",
      points: 4,
      order: 4,
      configJson: JSON.stringify({
        prompt: "Укажите, как прозрачная обратная связь помогает улучшить следующую попытку.",
      }),
    },
  ];
}

function buildScheduleTemplates(groupsByName, courses, staffByEmail) {
  const pairSlots = [
    { pairIndex: 1, startTime: "08:30", endTime: "10:00" },
    { pairIndex: 2, startTime: "10:10", endTime: "11:40" },
    { pairIndex: 3, startTime: "12:10", endTime: "13:40" },
    { pairIndex: 4, startTime: "13:50", endTime: "15:20" },
    { pairIndex: 5, startTime: "15:30", endTime: "17:00" },
  ];

  const templates = [];
  const years = [2026, 2027, 2028];
  const semesters = ["current", "next"];

  courses.forEach((course, courseIndex) => {
    const blueprint = courseBlueprints.find((item) => item.title === course.title);
    const creator = staffByEmail.get(blueprint.teacherEmail);
    const primaryGroup = groupsByName.get(blueprint.groupNames[0]);
    const mergedGroups = blueprint.groupNames.slice(1).map((name) => groupsByName.get(name)).filter(Boolean);
    if (!creator || !primaryGroup) return;

    years.forEach((year) => {
      semesters.forEach((semester, semesterIndex) => {
        const weekday = ((courseIndex + semesterIndex) % 5) + 1;
        const slot = pairSlots[(courseIndex + semesterIndex) % pairSlots.length];
        templates.push({
          id: `${year}-${semester}-${course.id}-${primaryGroup.id}`,
          calendarYear: year,
          semester,
          weekday,
          pairIndex: slot.pairIndex,
          startTime: slot.startTime,
          endTime: slot.endTime,
          title: course.title,
          type: semester === "current" ? "Лекция" : "Практика",
          format: blueprint.format,
          location: `Аудитория ${200 + courseIndex * 3 + semesterIndex}`,
          parity: semesterIndex % 2 === 0 ? "BOTH" : "ODD",
          courseId: course.id,
          courseTitle: course.title,
          primaryGroupId: primaryGroup.id,
          primaryGroupName: primaryGroup.name,
          mergedGroupIds: mergedGroups.map((group) => group.id),
          mergedGroupNames: mergedGroups.map((group) => group.name),
          notes: `Демо-шаблон расписания для курса "${course.title}" на ${year} год.`,
          createdById: creator.id,
          createdByName: creator.email,
        });
      });
    });
  });

  return templates;
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const studentBlueprints = buildStudentBlueprints();

  await prisma.answerSelection.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.test.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();
  await prisma.studentGroup.deleteMany();

  const groupsByName = new Map();
  for (const group of groupBlueprints) {
    const created = await prisma.studentGroup.create({ data: group });
    groupsByName.set(created.name, created);
  }

  const staffByEmail = new Map();
  for (const staff of staffBlueprints) {
    const created = await prisma.user.create({
      data: {
        email: staff.email,
        passwordHash,
        role: staff.role,
        fullName: staff.fullName,
        faculty: staff.faculty,
        staffTitle: staff.staffTitle,
        staffCategory: staff.staffCategory,
        accessSystemsJson: JSON.stringify(staff.accessSystems),
        permissionsJson: JSON.stringify(staff.permissions),
      },
    });
    staffByEmail.set(created.email, created);
  }

  const students = [];
  for (const student of studentBlueprints) {
    const group = groupsByName.get(student.groupName);
    const created = await prisma.user.create({
      data: {
        email: student.email,
        passwordHash,
        role: "STUDENT",
        fullName: student.fullName,
        studentCode: student.studentCode,
        faculty: group.faculty,
        groupId: group.id,
      },
    });
    students.push(created);
  }

  const courses = [];
  for (const blueprint of courseBlueprints) {
    const teacher = staffByEmail.get(blueprint.teacherEmail);
    const course = await prisma.course.create({
      data: {
        title: blueprint.title,
        teacherId: teacher.id,
        subjectCode: blueprint.subjectCode,
        subjectName: blueprint.subjectName,
        department: blueprint.department,
        semester: blueprint.semester,
        studyYear: blueprint.studyYear,
        format: blueprint.format,
        campus: blueprint.campus,
        courseNumber: blueprint.courseNumber,
      },
    });
    courses.push(course);

    const enrolledStudents = students.filter((student) => {
      const group = [...groupsByName.values()].find((item) => item.id === student.groupId);
      return blueprint.groupNames.includes(group?.name);
    });

    if (enrolledStudents.length) {
      await prisma.enrollment.createMany({
        data: enrolledStudents.map((student) => ({
          courseId: course.id,
          studentId: student.id,
        })),
      });
    }

    const assignments = await Promise.all(
      [
        ["Практикум 1", 5],
        ["Домашняя работа 2", 9],
        ["Мини-проект", 14],
      ].map(([title, offsetDays], index) =>
        prisma.assignment.create({
          data: {
            courseId: course.id,
            teacherId: teacher.id,
            title: `${title}: ${course.title}`,
            description: `Проверочное задание по курсу "${course.title}".`,
            dueDate: new Date(Date.now() + (offsetDays + index) * 24 * 60 * 60 * 1000),
          },
        })
      )
    );

    const tests = await Promise.all(
      [
        ["Входной тест", true, 2, 25],
        ["Контрольный тест", true, 2, 35],
        ["Итоговый тест", false, 3, 45],
      ].map(([title, isPublished, attemptLimit, timeLimitMinutes]) =>
        prisma.test.create({
          data: {
            courseId: course.id,
            teacherId: teacher.id,
            title: `${title}: ${course.title}`,
            description: `Проверочный тест по курсу "${course.title}".`,
            instructions: "Вопросы собраны так, чтобы проверить публикацию, пересдачи, аналитику и осмотр теста.",
            isPublished,
            attemptLimit,
            timeLimitMinutes,
            tabSwitchLimit: 3,
            questions: {
              create: buildTestQuestions(course.title),
            },
          },
        })
      )
    );

    for (const [studentIndex, student] of enrolledStudents.entries()) {
      const assignment = assignments[studentIndex % assignments.length];
      await prisma.submission.create({
        data: {
          assignmentId: assignment.id,
          studentId: student.id,
          contentText: `Решение студента ${student.email}`,
          grade: [96, 92, 88, 84, 79, 73, 67, 61][studentIndex % 8],
          feedback: studentIndex % 4 === 0 ? "Хорошая работа, но можно усилить аргументацию." : "Работа принята, логика решения понятна.",
          gradedAt: new Date(),
          createdAt: new Date(Date.now() - (studentIndex + 1) * 24 * 60 * 60 * 1000),
        },
      });

      const test = tests[studentIndex % tests.length];
      await prisma.attempt.create({
        data: {
          testId: test.id,
          studentId: student.id,
          score: [19, 17, 15, 13, 11, 9][studentIndex % 6],
          maxScore: 20,
          startedAt: new Date(Date.now() - (studentIndex + 2) * 24 * 60 * 60 * 1000 - 30 * 60 * 1000),
          finishedAt: new Date(Date.now() - (studentIndex + 2) * 24 * 60 * 60 * 1000),
          tabSwitchCount: studentIndex % 3,
          activityLogJson: JSON.stringify([{ type: "TAB_SWITCH", createdAt: new Date().toISOString() }]),
        },
      });
    }
  }

  const templates = buildScheduleTemplates(groupsByName, courses, staffByEmail);
  fs.mkdirSync(path.dirname(templatesFile), { recursive: true });
  fs.writeFileSync(templatesFile, JSON.stringify(templates, null, 2), "utf8");

  console.log(`Готово: ${staffBlueprints.length} сотрудников, ${students.length} студентов, ${groupsByName.size} групп, ${courses.length} курсов, ${templates.length} шаблонов расписания.`);
  console.log("Логины по умолчанию: admin@lms.local / teacher1@lms.local / student1@lms.local, пароль: 123456");
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
