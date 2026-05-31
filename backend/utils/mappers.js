function normalizeText(value) {
  if (value == null) return value;
  const text = String(value);
  if (!/[РЎГ‘]/.test(text)) return text;
  try {
    const decoded = Buffer.from(text, "latin1").toString("utf8");
    const decodedCyrillic = (decoded.match(/[А-Яа-яЁё]/g) || []).length;
    const originalCyrillic = (text.match(/[А-Яа-яЁё]/g) || []).length;
    return decodedCyrillic > originalCyrillic ? decoded : text;
  } catch {
    return text;
  }
}

function pickPresetValue(values, courseId) {
  if (!Array.isArray(values) || values.length === 0) return "";
  const normalizedId = Number(courseId) || 1;
  return values[(normalizedId - 1) % values.length];
}

const COURSE_TAG_PRESETS = {
  subjectNames: [
    "Математический анализ",
    "Базы данных",
    "Программирование",
    "Информационная безопасность",
    "Дискретная математика",
    "Эконометрика",
  ],
  subjectCodes: ["MAT-101", "CS-204", "DB-310", "IS-220", "DM-115", "EC-330"],
  courseNumbers: [1, 2, 3, 4, 5, 6],
  semesters: ["Осенний", "Весенний", "Летний модуль"],
  departments: [
    "Кафедра прикладной математики",
    "Кафедра информатики",
    "Кафедра кибербезопасности",
    "Кафедра экономики и управления",
  ],
  studyYears: ["2025/2026", "2026/2027", "2027/2028"],
  formats: ["Очный", "Очно-заочный", "Дистанционный"],
  campuses: ["Главный корпус", "Корпус В", "Онлайн-поток"],
};

function mapStudent(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: normalizeText(user.fullName ?? ""),
    studentCode: normalizeText(user.studentCode ?? ""),
    faculty: normalizeText(user.faculty ?? ""),
    groupId: user.groupId ?? null,
    groupName: normalizeText(user.group?.name ?? ""),
    createdAt: user.createdAt,
  };
}

function safeParseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map((item) => normalizeText(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function safeParseJsonNumberArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map((item) => Number(item)).filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

function mapStaff(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: normalizeText(user.fullName ?? ""),
    faculty: normalizeText(user.faculty ?? ""),
    staffTitle: normalizeText(user.staffTitle ?? ""),
    staffCategory: normalizeText(user.staffCategory ?? ""),
    accessSystems: safeParseJsonArray(user.accessSystemsJson),
    permissions: safeParseJsonArray(user.permissionsJson),
    managedGroupIds: safeParseJsonNumberArray(user.managedGroupIdsJson),
    createdAt: user.createdAt,
  };
}

function mapCourse(course) {
  return {
    id: course.id,
    title: normalizeText(course.title),
    subjectName: normalizeText(course.subjectName || pickPresetValue(COURSE_TAG_PRESETS.subjectNames, course.id)),
    subjectCode: normalizeText(course.subjectCode || pickPresetValue(COURSE_TAG_PRESETS.subjectCodes, course.id)),
    courseNumber: course.courseNumber ?? pickPresetValue(COURSE_TAG_PRESETS.courseNumbers, course.id),
    semester: normalizeText(course.semester || pickPresetValue(COURSE_TAG_PRESETS.semesters, course.id)),
    department: normalizeText(course.department || pickPresetValue(COURSE_TAG_PRESETS.departments, course.id)),
    studyYear: normalizeText(course.studyYear || pickPresetValue(COURSE_TAG_PRESETS.studyYears, course.id)),
    format: normalizeText(course.format || pickPresetValue(COURSE_TAG_PRESETS.formats, course.id)),
    campus: normalizeText(course.campus || pickPresetValue(COURSE_TAG_PRESETS.campuses, course.id)),
    createdAt: course.createdAt,
    teacherId: course.teacherId,
  };
}

module.exports = {
  normalizeText,
  pickPresetValue,
  COURSE_TAG_PRESETS,
  mapStudent,
  mapStaff,
  mapCourse,
  safeParseJsonArray,
  safeParseJsonNumberArray,
};
