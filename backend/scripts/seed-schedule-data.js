const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const outFile = path.join(__dirname, "..", "data", "schedule-weekly-templates.json");

const pairSlots = {
  1: ["08:30", "10:00"],
  2: ["10:10", "11:40"],
  3: ["12:10", "13:40"],
  4: ["13:50", "15:20"],
  5: ["15:30", "17:00"],
  6: ["17:10", "18:40"],
  7: ["18:50", "20:20"],
};

const groups = {
  1: "ИС-21-1",
  2: "ПМИ-22-2",
  3: "ИБ-23-1",
  4: "ЭК-24-1",
  5: "ВАР",
};

const baseSchedules = {
  1: [
    { weekday: 1, pairIndex: 2, title: "Базы данных", type: "Практика", location: "3-214" },
    { weekday: 1, pairIndex: 4, title: "Архитектура ЭВМ", type: "Лабораторная", location: "2-118" },
    { weekday: 2, pairIndex: 2, title: "Математика", type: "Лекция", location: "1-309", courseId: 10, courseTitle: "Математика" },
    { weekday: 2, pairIndex: 3, title: "Алгоритмы", type: "Практика", location: "2-205" },
    { weekday: 3, pairIndex: 1, title: "Тест0254", type: "Семинар", location: "3-109", courseId: 5, courseTitle: "Тест0254" },
    { weekday: 3, pairIndex: 3, title: "Проектный практикум", type: "Практика", location: "Коворкинг ИТ" },
    { weekday: 4, pairIndex: 2, title: "Эконометрика", type: "Лекция", location: "4-201", courseId: 12, courseTitle: "1234" },
    { weekday: 4, pairIndex: 4, title: "Программирование", type: "Практика", location: "2-311", courseId: 9, courseTitle: "999" },
    { weekday: 5, pairIndex: 2, title: "Английский язык", type: "Практика", location: "1-107" },
    { weekday: 5, pairIndex: 3, title: "Кураторский час", type: "Событие", location: "онлайн", format: "Онлайн" },
  ],
  2: [
    { weekday: 1, pairIndex: 2, title: "Высшая математика", type: "Лекция", location: "1-211" },
    { weekday: 1, pairIndex: 3, title: "Анализ данных", type: "Практика", location: "3-116" },
    { weekday: 2, pairIndex: 1, title: "Эконометрика", type: "Лекция", location: "2-208", courseId: 12, courseTitle: "1234" },
    { weekday: 2, pairIndex: 3, title: "Теория вероятностей", type: "Практика", location: "1-315" },
    { weekday: 3, pairIndex: 4, title: "Практикум Python", type: "Лабораторная", location: "3-120" },
    { weekday: 4, pairIndex: 1, title: "Дискретная математика", type: "Лекция", location: "2-201", courseId: 11, courseTitle: "2243" },
    { weekday: 4, pairIndex: 3, title: "Моделирование процессов", type: "Практика", location: "3-118" },
    { weekday: 5, pairIndex: 1, title: "Научный семинар", type: "Семинар", location: "2-305" },
    { weekday: 5, pairIndex: 2, title: "Консультация по проекту", type: "Консультация", location: "онлайн", format: "Онлайн" },
  ],
  3: [
    { weekday: 1, pairIndex: 3, title: "Криптография", type: "Лекция", location: "5-110" },
    { weekday: 2, pairIndex: 1, title: "Информационная безопасность", type: "Лекция", location: "5-201" },
    { weekday: 2, pairIndex: 2, title: "Сетевые технологии", type: "Лабораторная", location: "5-212" },
    { weekday: 3, pairIndex: 1, title: "Операционные системы", type: "Практика", location: "3-212" },
    { weekday: 3, pairIndex: 3, title: "Защита веб-приложений", type: "Лекция", location: "5-204" },
    { weekday: 4, pairIndex: 2, title: "Реверс-инжиниринг", type: "Лабораторная", location: "5-108" },
    { weekday: 4, pairIndex: 4, title: "Мониторинг инцидентов", type: "Практика", location: "5-111" },
    { weekday: 5, pairIndex: 1, title: "Киберполигон", type: "Практика", location: "онлайн", format: "Онлайн" },
    { weekday: 5, pairIndex: 3, title: "Сетевой аудит", type: "Семинар", location: "5-215" },
  ],
  4: [
    { weekday: 1, pairIndex: 1, title: "Микроэкономика", type: "Лекция", location: "4-102" },
    { weekday: 1, pairIndex: 2, title: "Статистика", type: "Практика", location: "4-115" },
    { weekday: 2, pairIndex: 2, title: "Финансы", type: "Лекция", location: "4-210" },
    { weekday: 2, pairIndex: 4, title: "Бухгалтерский учет", type: "Практика", location: "4-203" },
    { weekday: 3, pairIndex: 1, title: "Эконометрика", type: "Лекция", location: "4-108", courseId: 12, courseTitle: "1234" },
    { weekday: 4, pairIndex: 1, title: "Управление проектами", type: "Практика", location: "4-305" },
    { weekday: 4, pairIndex: 3, title: "Маркетинг", type: "Лекция", location: "4-118" },
    { weekday: 5, pairIndex: 2, title: "Деловые коммуникации", type: "Практика", location: "4-120" },
    { weekday: 5, pairIndex: 4, title: "Экономический семинар", type: "Семинар", location: "4-207" },
  ],
  5: [
    { weekday: 1, pairIndex: 2, title: "Базовый модуль", type: "Лекция", location: "1-100" },
    { weekday: 2, pairIndex: 2, title: "Практикум", type: "Практика", location: "1-101" },
    { weekday: 3, pairIndex: 2, title: "Учебная консультация", type: "Консультация", location: "онлайн", format: "Онлайн" },
    { weekday: 4, pairIndex: 2, title: "Работа с куратором", type: "Событие", location: "1-102" },
    { weekday: 5, pairIndex: 2, title: "Разбор заданий", type: "Практика", location: "1-103" },
  ],
};

const mergedPairs = [
  { semester: "current", weekday: 1, pairIndex: 1, primaryGroupId: 4, mergedGroupIds: [1], title: "Микроэкономика", type: "Лекция", format: "Очное", location: "3-12А" },
  { semester: "current", weekday: 3, pairIndex: 2, primaryGroupId: 2, mergedGroupIds: [4], title: "Совместный аналитический практикум", type: "Практика", format: "Очное", location: "2-220" },
  { semester: "next", weekday: 1, pairIndex: 1, primaryGroupId: 4, mergedGroupIds: [1], title: "Микроэкономика", type: "Лекция", format: "Очное", location: "3-12А" },
  { semester: "next", weekday: 3, pairIndex: 2, primaryGroupId: 2, mergedGroupIds: [4], title: "Совместный аналитический практикум", type: "Практика", format: "Очное", location: "2-220" },
];

function makeTemplate({
  calendarYear = 2026,
  semester,
  weekday,
  pairIndex,
  title,
  type,
  format = "Очное",
  location = "",
  parity = "BOTH",
  courseId = null,
  courseTitle = "",
  primaryGroupId,
  mergedGroupIds = [],
  notes = "",
}) {
  const [startTime, endTime] = pairSlots[pairIndex];
  return {
    id: crypto.randomUUID(),
    calendarYear,
    semester,
    weekday,
    pairIndex,
    startTime,
    endTime,
    title,
    type,
    format,
    location,
    parity,
    courseId,
    courseTitle,
    primaryGroupId,
    primaryGroupName: groups[primaryGroupId] || "",
    mergedGroupIds,
    mergedGroupNames: mergedGroupIds.map((id) => groups[id]).filter(Boolean),
    notes,
    createdById: 1,
    createdByName: "teacher@lms.local",
  };
}

const blocked = new Set();
for (const pair of mergedPairs) {
  for (const groupId of [pair.primaryGroupId, ...pair.mergedGroupIds]) {
    blocked.add(`${pair.semester}:${groupId}:${pair.weekday}:${pair.pairIndex}`);
  }
}

const templates = [];
for (const semester of ["current", "next"]) {
  for (const [groupIdRaw, lessons] of Object.entries(baseSchedules)) {
    const groupId = Number(groupIdRaw);
    for (const lesson of lessons) {
      const key = `${semester}:${groupId}:${lesson.weekday}:${lesson.pairIndex}`;
      if (blocked.has(key)) continue;
      templates.push(makeTemplate({ calendarYear: 2026, semester, primaryGroupId: groupId, ...lesson }));
    }
  }
}

for (const pair of mergedPairs) {
  templates.push(
    makeTemplate({
      calendarYear: 2026,
      semester: pair.semester,
      weekday: pair.weekday,
      pairIndex: pair.pairIndex,
      title: pair.title,
      type: pair.type,
      format: pair.format,
      location: pair.location,
      primaryGroupId: pair.primaryGroupId,
      mergedGroupIds: pair.mergedGroupIds,
    })
  );
}

fs.writeFileSync(outFile, JSON.stringify(templates, null, 2), "utf8");
console.log(`written ${templates.length} templates to ${outFile}`);
