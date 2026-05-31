const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const password = "123456";
const templatesFile = path.join(__dirname, "..", "data", "schedule-weekly-templates.json");

const groups = [
  { name: "ИС-21-1", faculty: "Институт информационных технологий" },
  { name: "ИС-21-2", faculty: "Институт информационных технологий" },
  { name: "ПМИ-22-1", faculty: "Факультет прикладной математики" },
  { name: "ПМИ-22-2", faculty: "Факультет прикладной математики" },
  { name: "ИБ-23-1", faculty: "Факультет кибербезопасности" },
  { name: "ИБ-23-2", faculty: "Факультет кибербезопасности" },
  { name: "ЭК-24-1", faculty: "Экономический факультет" },
  { name: "УП-24-3", faculty: "Факультет управления" },
];

const staff = [
  {
    email: "admin@lms.local",
    role: "ADMIN",
    fullName: "Смирнов Артем Дмитриевич",
    faculty: "Администрация СДО",
    staffTitle: "Администратор системы",
    staffCategory: "ADMINISTRATION",
    accessSystems: ["LMS Core", "Analytics Console", "Content Library", "Audit Log", "Database Tools"],
    permissions: [
      "COURSES_VIEW",
      "COURSES_EDIT",
      "TESTS_VIEW",
      "TESTS_EDIT",
      "TESTS_INSPECT",
      "SCHEDULE_EDIT",
      "ANALYTICS_VIEW",
      "ANALYTICS_EXPORT",
      "STUDENTS_MANAGE",
      "STAFF_MANAGE",
      "SYSTEMS_MANAGE",
    ],
  },
  {
    email: "teacher1@lms.local",
    role: "TEACHER",
    fullName: "Иванова Анна Сергеевна",
    faculty: "Институт информационных технологий",
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
    accessSystems: ["LMS Core", "Schedule Editor", "Analytics Console", "Content Library", "Notifications"],
    permissions: ["COURSES_VIEW", "COURSES_EDIT", "TESTS_VIEW", "TESTS_EDIT", "TESTS_INSPECT", "SCHEDULE_EDIT", "ANALYTICS_VIEW", "STUDENTS_MANAGE"],
  },
  {
    email: "teacher4@lms.local",
    role: "TEACHER",
    fullName: "Орлова Мария Викторовна",
    faculty: "Экономический факультет",
    staffTitle: "Преподаватель",
    staffCategory: "TEACHER",
    accessSystems: ["LMS Core", "Analytics Console", "Content Library"],
    permissions: ["COURSES_VIEW", "COURSES_EDIT", "TESTS_VIEW", "TESTS_EDIT", "ANALYTICS_VIEW", "STUDENTS_MANAGE"],
  },
];

const courseSeed = [
  {
    title: "Алгоритмы и структуры данных",
    subjectName: "Алгоритмы",
    subjectCode: "CS-204",
    courseNumber: 2,
    semester: "Осенний",
    department: "Кафедра информатики",
    studyYear: "2026/2027",
    format: "Очный",
    campus: "Главный корпус",
    teacherEmail: "teacher1@lms.local",
    groupNames: ["ИС-21-1", "ИС-21-2"],
  },
  {
    title: "Базы данных",
    subjectName: "Базы данных",
    subjectCode: "DB-310",
    courseNumber: 2,
    semester: "Осенний",
    department: "Кафедра информатики",
    studyYear: "2026/2027",
    format: "Очный",
    campus: "Главный корпус",
    teacherEmail: "teacher1@lms.local",
    groupNames: ["ИС-21-1", "ПМИ-22-1"],
  },
  {
    title: "Разработка веб-приложений",
    subjectName: "Веб-разработка",
    subjectCode: "WEB-220",
    courseNumber: 3,
    semester: "Весенний",
    department: "Кафедра информатики",
    studyYear: "2026/2027",
    format: "Смешанный",
    campus: "Главный корпус",
    teacherEmail: "teacher1@lms.local",
    groupNames: ["ИС-21-2", "ПМИ-22-1"],
  },
  {
    title: "Математический анализ",
    subjectName: "Математический анализ",
    subjectCode: "MAT-101",
    courseNumber: 1,
    semester: "Осенний",
    department: "Кафедра прикладной математики",
    studyYear: "2026/2027",
    format: "Очный",
    campus: "Корпус B",
    teacherEmail: "teacher2@lms.local",
    groupNames: ["ПМИ-22-1", "ПМИ-22-2"],
  },
  {
    title: "Дискретная математика",
    subjectName: "Дискретная математика",
    subjectCode: "DM-115",
    courseNumber: 2,
    semester: "Весенний",
    department: "Кафедра прикладной математики",
    studyYear: "2026/2027",
    format: "Очный",
    campus: "Корпус B",
    teacherEmail: "teacher2@lms.local",
    groupNames: ["ПМИ-22-2", "ИС-21-1"],
  },
  {
    title: "Информационная безопасность",
    subjectName: "Информационная безопасность",
    subjectCode: "IS-220",
    courseNumber: 3,
    semester: "Весенний",
    department: "Кафедра кибербезопасности",
    studyYear: "2026/2027",
    format: "Смешанный",
    campus: "Корпус C",
    teacherEmail: "teacher3@lms.local",
    groupNames: ["ИБ-23-1", "ИБ-23-2"],
  },
  {
    title: "Сетевые технологии",
    subjectName: "Сетевые технологии",
    subjectCode: "NET-205",
    courseNumber: 2,
    semester: "Весенний",
    department: "Кафедра кибербезопасности",
    studyYear: "2026/2027",
    format: "Очный",
    campus: "Корпус C",
    teacherEmail: "teacher3@lms.local",
    groupNames: ["ИБ-23-1", "ИБ-23-2"],
  },
  {
    title: "Управление проектами",
    subjectName: "Управление проектами",
    subjectCode: "PM-210",
    courseNumber: 3,
    semester: "Осенний",
    department: "Кафедра экономики и управления",
    studyYear: "2026/2027",
    format: "Очно-заочный",
    campus: "Главный корпус",
    teacherEmail: "teacher4@lms.local",
    groupNames: ["ЭК-24-1", "УП-24-3"],
  },
  {
    title: "Эконометрика",
    subjectName: "Эконометрика",
    subjectCode: "EC-330",
    courseNumber: 3,
    semester: "Весенний",
    department: "Кафедра экономики и управления",
    studyYear: "2026/2027",
    format: "Очно-заочный",
    campus: "Главный корпус",
    teacherEmail: "teacher4@lms.local",
    groupNames: ["ЭК-24-1", "УП-24-3"],
  },
];

const firstNames = ["Алина", "Илья", "Мария", "Роман", "Софья", "Артем", "Максим", "Полина", "Кирилл", "Виктория"];
const lastNames = ["Соколова", "Иванов", "Петрова", "Николаев", "Кузнецова", "Орлов", "Федорова", "Смирнов", "Попова", "Зайцев"];
const middleNames = ["Игоревна", "Сергеевич", "Максимовна", "Алексеевич", "Андреевна", "Павлович", "Дмитриевна", "Константинович", "Ильинична", "Викторович"];

function buildStudentSeed() {
  const result = [];
  let counter = 1;
  for (const group of groups) {
    for (let index = 0; index < 5; index += 1) {
      const fullName = `${lastNames[(counter + index) % lastNames.length]} ${firstNames[counter % firstNames.length]} ${middleNames[(counter + index * 2) % middleNames.length]}`;
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

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function json(value) {
  return JSON.stringify(value);
}

async function resetTables() {
  await prisma.answerSelection.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.testAttemptAllowance.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.test.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.courseGrade.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();
  await prisma.studentGroup.deleteMany();
}

async function createGroups() {
  const result = new Map();
  for (const group of groups) {
    const created = await prisma.studentGroup.create({ data: group });
    result.set(created.name, created);
  }
  return result;
}

async function createUsers(groupsByName, passwordHash) {
  const usersByEmail = new Map();

  for (const person of staff) {
    const created = await prisma.user.create({
      data: {
        email: person.email,
        passwordHash,
        role: person.role,
        fullName: person.fullName,
        faculty: person.faculty,
        staffTitle: person.staffTitle,
        staffCategory: person.staffCategory,
        accessSystemsJson: json(person.accessSystems),
        permissionsJson: json(person.permissions),
      },
    });
    usersByEmail.set(created.email, created);
  }

  for (const student of buildStudentSeed()) {
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
    usersByEmail.set(created.email, created);
  }

  return usersByEmail;
}

async function createAssignments(course, teacher) {
  const assignments = [
    {
      title: "Практическая работа 1",
      description: `Закрепить базовые понятия по дисциплине "${course.title}".`,
      dueDate: daysFromNow(7),
    },
    {
      title: "Индивидуальное задание",
      description: "Подготовить решение по выбранному варианту и отправить его на проверку.",
      dueDate: daysFromNow(14),
    },
    {
      title: "Контрольная работа",
      description: "Выполнить итоговое задание по первой части курса.",
      dueDate: daysFromNow(21),
    },
  ];

  return Promise.all(
    assignments.map((assignment) =>
      prisma.assignment.create({
        data: {
          ...assignment,
          courseId: course.id,
          teacherId: teacher.id,
        },
      })
    )
  );
}

function buildQuestionSet(courseTitle, variant) {
  return [
    {
      type: "SINGLE",
      text: `Что является основной единицей учебной работы в курсе "${courseTitle}"?`,
      points: 2,
      order: 1,
      options: {
        create: [
          { text: "Курс, объединяющий задания, тесты и оценки", isCorrect: true },
          { text: "Случайный набор файлов", isCorrect: false },
          { text: "Только календарь занятий", isCorrect: false },
        ],
      },
    },
    {
      type: "MULTI",
      text: "Какие элементы помогают преподавателю оценивать работу студентов?",
      points: 3,
      order: 2,
      options: {
        create: [
          { text: "Сдачи заданий", isCorrect: true },
          { text: "Попытки тестов", isCorrect: true },
          { text: "Журнал оценок", isCorrect: true },
          { text: "Цветовое оформление страницы", isCorrect: false },
        ],
      },
    },
    {
      type: "OPEN",
      text: variant === "final" ? "Опишите, как результаты тестов связаны с журналом оценок." : "Кратко объясните, зачем студенту видеть обратную связь по заданию.",
      points: 5,
      order: 3,
      configJson: json({ minLength: 40, placeholder: "Ответ в свободной форме" }),
    },
  ];
}

async function createCourseTests(course, teacher) {
  const tests = [
    {
      title: `Входной тест: ${course.subjectName || course.title}`,
      description: "Короткая проверка базовых знаний перед началом практической части.",
      instructions: "Ответьте на вопросы. Закрытые вопросы проверяются автоматически.",
      isPublished: true,
      timeLimitMinutes: 25,
      attemptLimit: 2,
      variant: "intro",
    },
    {
      title: `Итоговый тест: ${course.subjectName || course.title}`,
      description: "Проверка усвоения материала после выполнения заданий.",
      instructions: "Внимательно прочитайте вопросы и завершите попытку до истечения времени.",
      isPublished: true,
      timeLimitMinutes: 35,
      attemptLimit: 1,
      variant: "final",
    },
  ];

  return Promise.all(
    tests.map((test) =>
      prisma.test.create({
        data: {
          title: test.title,
          description: test.description,
          instructions: test.instructions,
          isPublished: test.isPublished,
          timeLimitMinutes: test.timeLimitMinutes,
          tabSwitchLimit: 3,
          attemptLimit: test.attemptLimit,
          courseId: course.id,
          teacherId: teacher.id,
          questions: { create: buildQuestionSet(course.title, test.variant) },
        },
      })
    )
  );
}

async function createCourses(groupsByName, usersByEmail) {
  const courses = [];
  const groupList = [...groupsByName.values()];

  for (const [courseIndex, blueprint] of courseSeed.entries()) {
    const teacher = usersByEmail.get(blueprint.teacherEmail);
    const course = await prisma.course.create({
      data: {
        title: blueprint.title,
        subjectName: blueprint.subjectName,
        subjectCode: blueprint.subjectCode,
        courseNumber: blueprint.courseNumber,
        semester: blueprint.semester,
        department: blueprint.department,
        studyYear: blueprint.studyYear,
        format: blueprint.format,
        campus: blueprint.campus,
        teacherId: teacher.id,
      },
    });

    const students = [...usersByEmail.values()].filter((user) => {
      if (user.role !== "STUDENT") return false;
      const group = groupList.find((item) => item.id === user.groupId);
      return blueprint.groupNames.includes(group?.name);
    });

    for (const [studentIndex, student] of students.entries()) {
      await prisma.enrollment.create({
        data: { courseId: course.id, studentId: student.id },
      });

      await prisma.courseGrade.create({
        data: {
          courseId: course.id,
          studentId: student.id,
          module1Score: 62 + ((courseIndex * 7 + studentIndex * 3) % 35),
          module2Score: 58 + ((courseIndex * 5 + studentIndex * 4) % 38),
          module3Score: studentIndex % 4 === 0 ? null : 60 + ((courseIndex * 6 + studentIndex * 5) % 35),
          notes: studentIndex % 5 === 0 ? "Нужна консультация по итоговому модулю." : "Учебная динамика в пределах нормы.",
        },
      });
    }

    const assignments = await createAssignments(course, teacher);
    const tests = await createCourseTests(course, teacher);

    for (const [studentIndex, student] of students.entries()) {
      for (const [assignmentIndex, assignment] of assignments.entries()) {
        if ((studentIndex + assignmentIndex) % 5 === 4) continue;
        const grade = 64 + ((courseIndex * 9 + studentIndex * 5 + assignmentIndex * 7) % 35);
        await prisma.submission.create({
          data: {
            assignmentId: assignment.id,
            studentId: student.id,
            contentText: `Демо-решение студента ${student.fullName} по заданию "${assignment.title}".`,
            grade,
            feedback: grade >= 85 ? "Отличная работа, решение хорошо аргументировано." : "Работа принята, отдельные выводы стоит уточнить.",
            gradedAt: new Date(),
            createdAt: daysFromNow(-assignmentIndex - studentIndex - 1),
            attachmentsJson: "[]",
          },
        });
      }

      for (const [testIndex, test] of tests.entries()) {
        if ((studentIndex + testIndex) % 6 === 5) continue;
        const score = 5 + ((courseIndex * 2 + studentIndex + testIndex) % 6);
        await prisma.attempt.create({
          data: {
            testId: test.id,
            studentId: student.id,
            score,
            maxScore: 10,
            startedAt: daysFromNow(-studentIndex - testIndex - 2),
            finishedAt: daysFromNow(-studentIndex - testIndex - 2),
            tabSwitchCount: (studentIndex + testIndex) % 3,
            activityLogJson: json([{ type: "demo", at: new Date().toISOString() }]),
          },
        });
      }
    }

    await prisma.notification.create({
      data: {
        title: "Курс опубликован",
        body: `Для курса "${course.title}" доступны задания, тесты и журнал оценок.`,
        audience: "COURSE",
        courseId: course.id,
        createdById: teacher.id,
      },
    });

    courses.push(course);
  }

  return courses;
}

function writeScheduleTemplates(courses, groupsByName, usersByEmail) {
  const teacher = usersByEmail.get("teacher1@lms.local");
  const weekdays = [1, 2, 3, 4, 5];
  const types = ["Лекция", "Практика", "Лабораторная"];
  const templates = courses.slice(0, 8).map((course, index) => {
    const group = [...groupsByName.values()][index % groupsByName.size];
    return {
      id: `demo-schedule-${index + 1}`,
      calendarYear: 2026,
      semester: "current",
      weekday: weekdays[index % weekdays.length],
      pairIndex: (index % 4) + 1,
      startTime: ["08:30", "10:10", "12:10", "13:50"][index % 4],
      endTime: ["10:00", "11:40", "13:40", "15:20"][index % 4],
      title: course.title,
      type: types[index % types.length],
      format: index % 3 === 0 ? "Смешанный" : "Очно",
      location: `${2 + (index % 4)}-${110 + index}`,
      parity: index % 3 === 0 ? "ODD" : index % 3 === 1 ? "EVEN" : "BOTH",
      courseId: course.id,
      courseTitle: course.title,
      primaryGroupId: group.id,
      primaryGroupName: group.name,
      mergedGroupIds: [],
      mergedGroupNames: [],
      notes: "Демо-занятие для расписания.",
      createdById: teacher.id,
      createdByName: teacher.fullName,
    };
  });

  fs.mkdirSync(path.dirname(templatesFile), { recursive: true });
  fs.writeFileSync(templatesFile, JSON.stringify(templates, null, 2), "utf8");
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);

  await resetTables();
  const groupsByName = await createGroups();
  const usersByEmail = await createUsers(groupsByName, passwordHash);
  const courses = await createCourses(groupsByName, usersByEmail);
  writeScheduleTemplates(courses, groupsByName, usersByEmail);

  console.log("Демо-данные успешно загружены.");
  console.log("Создано: 5 сотрудников, 40 студентов, 8 групп, 9 курсов.");
  console.log("Логины: admin@lms.local, teacher1@lms.local, student1@lms.local");
  console.log(`Пароль для всех демо-пользователей: ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
