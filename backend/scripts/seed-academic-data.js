const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const groupsData = [
    { name: "ИС-21-1", faculty: "Факультет информатики" },
    { name: "ПМИ-22-2", faculty: "Факультет прикладной математики" },
    { name: "ИБ-23-1", faculty: "Факультет кибербезопасности" },
    { name: "ЭК-24-1", faculty: "Экономический факультет" },
  ];

  const groups = [];
  for (const groupData of groupsData) {
    const group = await prisma.studentGroup.upsert({
      where: { name: groupData.name },
      update: { faculty: groupData.faculty },
      create: groupData,
    });
    groups.push(group);
  }

  const passwordHash = await bcrypt.hash("123456", 10);
  const students = [
    {
      email: "student2@lms.local",
      fullName: "Иванов Илья Сергеевич",
      studentCode: "2024002",
      faculty: groups[0].faculty,
      groupId: groups[0].id,
    },
    {
      email: "student3@lms.local",
      fullName: "Петрова Анна Максимовна",
      studentCode: "2024003",
      faculty: groups[0].faculty,
      groupId: groups[0].id,
    },
    {
      email: "student4@lms.local",
      fullName: "Соколова Дарья Игоревна",
      studentCode: "2024004",
      faculty: groups[1].faculty,
      groupId: groups[1].id,
    },
    {
      email: "student5@lms.local",
      fullName: "Николаев Роман Алексеевич",
      studentCode: "2024005",
      faculty: groups[1].faculty,
      groupId: groups[1].id,
    },
    {
      email: "student6@lms.local",
      fullName: "Кузнецова Мария Андреевна",
      studentCode: "2024006",
      faculty: groups[2].faculty,
      groupId: groups[2].id,
    },
    {
      email: "student7@lms.local",
      fullName: "Орлов Егор Павлович",
      studentCode: "2024007",
      faculty: groups[2].faculty,
      groupId: groups[2].id,
    },
    {
      email: "student8@lms.local",
      fullName: "Федорова Софья Дмитриевна",
      studentCode: "2024008",
      faculty: groups[3].faculty,
      groupId: groups[3].id,
    },
    {
      email: "student9@lms.local",
      fullName: "Смирнов Артем Константинович",
      studentCode: "2024009",
      faculty: groups[3].faculty,
      groupId: groups[3].id,
    },
  ];

  for (const student of students) {
    await prisma.user.upsert({
      where: { email: student.email },
      update: {
        fullName: student.fullName,
        studentCode: student.studentCode,
        faculty: student.faculty,
        groupId: student.groupId,
        role: "STUDENT",
      },
      create: {
        ...student,
        role: "STUDENT",
        passwordHash,
      },
    });
  }

  console.log(`Готово: ${groups.length} групп и ${students.length} студентов синхронизированы.`);
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
