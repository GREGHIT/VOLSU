import { motion } from "framer-motion";
import PageHero from "../ui/PageHero";
import ActionButton from "../ui/ActionButton";
import AppIcon from "../ui/AppIcon";

const MotionButton = motion.button;

export default function CourseWorkspaceHeader({
  courseTitle,
  courseId,
  roleLabel,
  itemsCount,
  testsCount,
  courseMetaChips,
  isTeacher,
  onBack,
  onBackHover,
  backHoverColor,
  onOpenSettings,
  onOpenStudents,
  onOpenSubmissions,
  onCreateAssignment,
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        onMouseEnter={onBackHover}
        style={{ "--course-back-hover": backHoverColor }}
        className="course-back-button -ml-1 -mt-2 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition"
      >
        <AppIcon name="chevronLeft" className="h-4 w-4" />
        <span>Назад</span>
      </button>

      <PageHero
        eyebrow="Рабочая область курса"
        title={courseTitle}
        chips={[
          `ID: ${courseId}`,
          roleLabel,
          `${itemsCount} заданий`,
          `${testsCount} тестов`,
          ...(courseMetaChips.length ? courseMetaChips : ["Теги курса пока не заполнены"]),
        ]}
        actions={
          <>
            {isTeacher ? (
              <MotionButton
                type="button"
                onClick={onOpenSettings}
                animate={{ rotate: [0, 8, 0, -8, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 3 }}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-gray-300 bg-white text-gray-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                aria-label="Настройки курса"
                title="Настройки курса"
              >
                <AppIcon name="settings" className="h-5 w-5" />
              </MotionButton>
            ) : null}

            {isTeacher ? <ActionButton onClick={onOpenStudents}>Студенты</ActionButton> : null}
            {isTeacher ? <ActionButton onClick={onOpenSubmissions}>Сдачи</ActionButton> : null}
            {isTeacher ? <ActionButton tone="primary" onClick={onCreateAssignment}>+ Создать задание</ActionButton> : null}
          </>
        }
      />
    </div>
  );
}
