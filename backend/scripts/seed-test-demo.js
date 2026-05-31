const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DEMO_TITLE = "Демонстрационный тест: интерактивные форматы";

async function removeTest(testId) {
  const answers = await prisma.answer.findMany({
    where: { attempt: { testId } },
    select: { id: true },
  });
  const answerIds = answers.map((answer) => answer.id);
  if (answerIds.length) {
    await prisma.answerSelection.deleteMany({ where: { answerId: { in: answerIds } } });
  }
  await prisma.answer.deleteMany({ where: { attempt: { testId } } });
  await prisma.attempt.deleteMany({ where: { testId } });
  await prisma.option.deleteMany({ where: { question: { testId } } });
  await prisma.question.deleteMany({ where: { testId } });
  await prisma.test.delete({ where: { id: testId } });
}

async function main() {
  const course =
    (await prisma.course.findFirst({
      where: { enrollments: { some: {} } },
      include: { enrollments: true },
      orderBy: { id: "asc" },
    })) ||
    (await prisma.course.findFirst({ orderBy: { id: "asc" } }));

  if (!course) {
    console.log("Курс для демонстрационного теста не найден.");
    return;
  }

  const existing = await prisma.test.findFirst({
    where: { courseId: course.id, title: DEMO_TITLE },
  });

  if (existing) {
    await removeTest(existing.id);
  }

  const test = await prisma.test.create({
    data: {
      courseId: course.id,
      teacherId: course.teacherId,
      title: DEMO_TITLE,
      description: "Тест-полигон, в котором собраны интерактивные форматы вопросов для демонстрации возможностей LMS.",
      instructions:
        "Внутри этого теста собраны вопросы всех поддерживаемых типов: выбор, порядок шагов, сопоставления, категории, формулы, таблицы, код и SQL. Ответы автосохраняются, а таймер и контроль вкладок работают как в реальном тесте.",
      isPublished: true,
      timeLimitMinutes: 35,
      tabSwitchLimit: 3,
      questions: {
        create: [
          {
            type: "SINGLE",
            text: "Какой из факторов сильнее всего влияет на цену при прочих равных?",
            points: 2,
            order: 1,
            options: {
              create: [
                { text: "Изменение спроса", isCorrect: true },
                { text: "Цвет логотипа компании", isCorrect: false },
                { text: "Наличие обоев в аудитории", isCorrect: false },
              ],
            },
          },
          {
            type: "MULTI",
            text: "Какие признаки характерны для хорошей учебной аналитики?",
            points: 3,
            order: 2,
            options: {
              create: [
                { text: "Показывает сигналы внимания", isCorrect: true },
                { text: "Отслеживает динамику результатов", isCorrect: true },
                { text: "Случайно меняет оценки студентов", isCorrect: false },
                { text: "Помогает преподавателю принять решение", isCorrect: true },
              ],
            },
          },
          {
            type: "OPEN",
            text: "Кратко объясните, зачем преподавателю нужен журнал оценок курса.",
            points: 4,
            order: 3,
            configJson: JSON.stringify({
              prompt: "Опишите пользу журнала в 3-5 предложениях: контроль прогресса, прозрачность оценивания, сигналы внимания.",
            }),
          },
          {
            type: "ORDER",
            text: "Расставьте этапы публикации теста в логическом порядке.",
            points: 4,
            order: 4,
            configJson: JSON.stringify({
              prompt: "Нужно восстановить типовой процесс преподавателя.",
              items: [
                "Создать тест и заполнить общие параметры",
                "Добавить вопросы и ответы",
                "Проверить таймер и правила прохождения",
                "Опубликовать тест для студентов",
              ],
            }),
          },
          {
            type: "MATCH",
            text: "Сопоставьте формат вопроса и лучший сценарий его использования.",
            points: 4,
            order: 5,
            configJson: JSON.stringify({
              prompt: "Сопоставьте формат с задачей проверки.",
              pairs: [
                { left: "ORDER", right: "Проверка этапов процесса" },
                { left: "MATCH", right: "Термины и определения" },
                { left: "TABLE", right: "Заполнение структуры данными" },
                { left: "SQL", right: "Построение запроса к данным" },
              ],
            }),
          },
          {
            type: "CATEGORY",
            text: "Распределите объекты по категориям.",
            points: 4,
            order: 6,
            configJson: JSON.stringify({
              prompt: "Отнесите элементы к правильной категории.",
              categories: [
                { name: "Интерфейс", items: ["Кнопка", "Форма", "Модальное окно"] },
                { name: "Backend", items: ["Маршрут API", "Prisma schema", "JWT-проверка"] },
              ],
            }),
          },
          {
            type: "KEYWORD",
            text: "Введите ключевое слово: структура строк и столбцов для ввода данных.",
            points: 2,
            order: 7,
            configJson: JSON.stringify({
              prompt: "Подумайте о формате вопроса, где студент заполняет ячейки.",
              mask: "Т_БЛ_Ц_",
              answers: ["таблица"],
              caseSensitive: false,
            }),
          },
          {
            type: "FORMULA",
            text: "Введите формулу второй скорости Ньютона.",
            points: 3,
            order: 8,
            configJson: JSON.stringify({
              prompt: "Нужна стандартная запись второго закона Ньютона.",
              placeholder: "Например: F=ma",
              answers: ["F=ma", "F = ma", "F=m*a"],
            }),
          },
          {
            type: "TABLE",
            text: "Заполните таблицу соответствий языка и области применения.",
            points: 4,
            order: 9,
            configJson: JSON.stringify({
              prompt: "В каждой ячейке укажите наиболее уместную связку.",
              columns: [
                { key: "language", label: "Язык" },
                { key: "area", label: "Область" },
              ],
              rows: [
                { key: "row_1", label: "Строка 1" },
                { key: "row_2", label: "Строка 2" },
              ],
              answers: {
                row_1: { language: "SQL", area: "Запросы к данным" },
                row_2: { language: "Python", area: "Общая прикладная логика" },
              },
            }),
          },
          {
            type: "CODE",
            text: "Напишите функцию, которая возвращает среднее арифметическое списка чисел.",
            points: 5,
            order: 10,
            configJson: JSON.stringify({
              prompt: "Проверка будет смотреть на наличие функции, суммы и деления на длину.",
              language: "python",
              starterCode: "def average(values):\n    # your code here\n    pass",
              placeholder: "Введите код решения",
              expectedKeywords: ["def", "sum", "len", "/"],
              forbiddenKeywords: ["print("],
            }),
          },
          {
            type: "SQL",
            text: "Напишите SQL-запрос, который выберет имена студентов и их группы.",
            points: 5,
            order: 11,
            configJson: JSON.stringify({
              prompt: "Предположим, что есть таблицы students и groups.",
              language: "sql",
              starterCode: "SELECT s.full_name, g.name\nFROM students s\nJOIN groups g ON g.id = s.group_id\nWHERE ...;",
              placeholder: "Введите SQL-запрос",
              expectedKeywords: ["select", "from", "join", "group"],
              forbiddenKeywords: ["drop", "delete"],
            }),
          },
        ],
      },
    },
    include: {
      questions: true,
    },
  });

  console.log(`Создан демонстрационный тест ${test.id} для курса ${course.id}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
