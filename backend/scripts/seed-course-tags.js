const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const presets = [
  {
    subjectName: "Программирование",
    subjectCode: "CS-204",
    courseNumber: 2,
    semester: "Осенний",
    department: "Кафедра информатики",
    studyYear: "2026/2027",
    format: "Очный",
    campus: "Главный корпус",
  },
  {
    subjectName: "Базы данных",
    subjectCode: "DB-310",
    courseNumber: 3,
    semester: "Весенний",
    department: "Кафедра информатики",
    studyYear: "2026/2027",
    format: "Очный",
    campus: "Корпус В",
  },
  {
    subjectName: "Информационная безопасность",
    subjectCode: "IS-220",
    courseNumber: 2,
    semester: "Осенний",
    department: "Кафедра кибербезопасности",
    studyYear: "2026/2027",
    format: "Очно-заочный",
    campus: "Главный корпус",
  },
  {
    subjectName: "Эконометрика",
    subjectCode: "EC-330",
    courseNumber: 3,
    semester: "Весенний",
    department: "Кафедра экономики и управления",
    studyYear: "2026/2027",
    format: "Дистанционный",
    campus: "Онлайн-поток",
  },
];

async function main() {
  const courses = await prisma.course.findMany({ orderBy: { id: "asc" } });

  for (let index = 0; index < courses.length; index += 1) {
    const course = courses[index];
    const preset = presets[index % presets.length];

    await prisma.course.update({
      where: { id: course.id },
      data: {
        subjectName: course.subjectName || preset.subjectName,
        subjectCode: course.subjectCode || preset.subjectCode,
        courseNumber: course.courseNumber ?? preset.courseNumber,
        semester: course.semester || preset.semester,
        department: course.department || preset.department,
        studyYear: course.studyYear || preset.studyYear,
        format: course.format || preset.format,
        campus: course.campus || preset.campus,
      },
    });
  }

  console.log(`Обновлено курсов: ${courses.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
