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
  { name: "ИБ-23-1", faculty: "Факультет кибербезопасности" },
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
    permissions: [
      "COURSES_VIEW",
      "COURSES_EDIT",
      "TESTS_VIEW",
      "TESTS_EDIT",
      "TESTS_INSPECT",
      "SCHEDULE_EDIT",
      "ANALYTICS_VIEW",
      "STUDENTS_MANAGE",
    ],
  },
  {
    email: "teacher2@lms.local",
    role: "TEACHER",
    fullName: "Петров Николай Олегович",
    faculty: "Факультет прикладной математики",
    staffTitle: "Преподаватель",
    staffCategory: "TEACHER",
    accessSystems: ["LMS Core", "Schedule Editor", "Content Library"],
    permissions: ["COURSES_VIEW", "COURSES_EDIT", "TESTS_VIEW", "TESTS_EDIT", "SCHEDULE_EDIT"],
  },
];

const studentSeed = [
  ["student1@lms.local", "Кузнецова Полина Андреевна", "2026001", "ИС-21-1"],
  ["student2@lms.local", "Орлов Максим Павлович", "2026002", "ИС-21-1"],
  ["student3@lms.local", "Соколова Мария Игоревна", "2026003", "ИС-21-2"],
  ["student4@lms.local", "Федоров Кирилл Дмитриевич", "2026004", "ИС-21-2"],
  ["student5@lms.local", "Андреев Тимур Сергеевич", "2026005", "ПМИ-22-1"],
  ["student6@lms.local", "Зайцева Софья Максимовна", "2026006", "ПМИ-22-1"],
  ["student7@lms.local", "Иванов Даниил Константинович", "2026007", "ИБ-23-1"],
  ["student8@lms.local", "Попова Виктория Алексеевна", "2026008", "ИБ-23-1"],
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
    title: "Информационная безопасность",
    subjectName: "Информационная безопасность",
    subjectCode: "IS-220",
    courseNumber: 3,
    semester: "Весенний",
    department: "Кафедра кибербезопасности",
    studyYear: "2026/2027",
    format: "Смешанный",
    campus: "Корпус C",
    teacherEmail: "teacher2@lms.local",
    groupNames: ["ИБ-23-1"],
  },
];

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

  for (const [email, fullName, studentCode, groupName] of studentSeed) {
    const group = groupsByName.get(groupName);
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "STUDENT",
        fullName,
        studentCode,
        faculty: group.faculty,
        groupId: group.id,
      },
    });
    usersByEmail.set(created.email, created);
  }

  return usersByEmail;
}

async function createAssignments(course, teacher) {
  const assignmentA = await prisma.assignment.create({
    data: {
      title: "Практическая работа 1",
      description: `Закрепить базовые понятия по дисциплине "${course.title}". Загрузите текст решения или краткое описание выполненной работы.`,
      dueDate: daysFromNow(7),
      courseId: course.id,
      teacherId: teacher.id,
    },
  });

  const assignmentB = await prisma.assignment.create({
    data: {
      title: "Индивидуальное задание",
      description: "Подготовьте небольшое решение по выбранному варианту и отправьте его на проверку.",
      dueDate: daysFromNow(14),
      courseId: course.id,
      teacherId: teacher.id,
    },
  });

  return [assignmentA, assignmentB];
}

async function createCourseTest(course, teacher) {
  return prisma.test.create({
    data: {
      title: `Входной тест: ${course.subjectName || course.title}`,
      description: "Короткая проверка базовых знаний перед началом практической части.",
      instructions: "Ответьте на вопросы. Для закрытых вопросов результат считается автоматически.",
      isPublished: true,
      timeLimitMinutes: 25,
      tabSwitchLimit: 3,
      attemptLimit: 2,
      courseId: course.id,
      teacherId: teacher.id,
      questions: {
        create: [
          {
            type: "SINGLE",
            text: `Что является основной единицей работы в курсе "${course.title}"?`,
            points: 2,
            order: 1,
            options: {
              create: [
                { text: "Учебный курс с заданиями и тестами", isCorrect: true },
                { text: "Случайный список файлов", isCorrect: false },
                { text: "Только расписание занятий", isCorrect: false },
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
                { text: "Цвет фона страницы", isCorrect: false },
              ],
            },
          },
          {
            type: "OPEN",
            text: "Кратко опишите, зачем в системе нужен журнал оценок.",
            points: 5,
            order: 3,
            configJson: json({ minLength: 40, placeholder: "Ответ в свободной форме" }),
          },
        ],
      },
    },
  });
}

async function createCourses(groupsByName, usersByEmail) {
  const courses = [];

  for (const blueprint of courseSeed) {
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
      const group = [...groupsByName.values()].find((item) => item.id === user.groupId);
      return blueprint.groupNames.includes(group?.name);
    });

    for (const student of students) {
      await prisma.enrollment.create({
        data: { courseId: course.id, studentId: student.id },
      });

      await prisma.courseGrade.create({
        data: {
          courseId: course.id,
          studentId: student.id,
          module1Score: 70 + (student.id % 25),
          module2Score: 65 + (student.id % 30),
          module3Score: null,
          notes: "Демо-запись для проверки журнала.",
        },
      });
    }

    const assignments = await createAssignments(course, teacher);
    const test = await createCourseTest(course, teacher);

    for (const [index, student] of students.entries()) {
      if (index < assignments.length) {
        await prisma.submission.create({
          data: {
            assignmentId: assignments[index].id,
            studentId: student.id,
            contentText: `Демо-решение студента ${student.fullName}.`,
            grade: 82 + index * 7,
            feedback: "Работа принята. Основная логика решения показана корректно.",
            gradedAt: new Date(),
            attachmentsJson: "[]",
          },
        });
      }

      if (index < 3) {
        await prisma.attempt.create({
          data: {
            testId: test.id,
            studentId: student.id,
            score: 7 + index,
            maxScore: 10,
            startedAt: daysFromNow(-index - 2),
            finishedAt: daysFromNow(-index - 2),
            tabSwitchCount: index,
            activityLogJson: json([{ type: "demo", at: new Date().toISOString() }]),
          },
        });
      }
    }

    await prisma.notification.create({
      data: {
        title: "Курс опубликован",
        body: `Для курса "${course.title}" доступны задания и входной тест.`,
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
  const course = courses[0];
  const firstGroup = groupsByName.get("ИС-21-1");
  const secondGroup = groupsByName.get("ИС-21-2");

  const templates = [
    {
      id: "demo-monday-1",
      calendarYear: 2026,
      semester: "current",
      weekday: 1,
      pairIndex: 2,
      startTime: "10:10",
      endTime: "11:40",
      title: "Алгоритмы и структуры данных",
      type: "Лекция",
      format: "Очно",
      location: "2-214",
      parity: "BOTH",
      courseId: course.id,
      courseTitle: course.title,
      primaryGroupId: firstGroup.id,
      primaryGroupName: firstGroup.name,
      mergedGroupIds: [secondGroup.id],
      mergedGroupNames: [secondGroup.name],
      notes: "Демо-занятие для расписания.",
      createdById: teacher.id,
      createdByName: teacher.fullName,
    },
    {
      id: "demo-wednesday-3",
      calendarYear: 2026,
      semester: "current",
      weekday: 3,
      pairIndex: 3,
      startTime: "12:10",
      endTime: "13:40",
      title: "Практикум по алгоритмам",
      type: "Практика",
      format: "Очно",
      location: "3-108",
      parity: "ODD",
      courseId: course.id,
      courseTitle: course.title,
      primaryGroupId: firstGroup.id,
      primaryGroupName: firstGroup.name,
      mergedGroupIds: [],
      mergedGroupNames: [],
      notes: "Нечетная неделя.",
      createdById: teacher.id,
      createdByName: teacher.fullName,
    },
  ];

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
