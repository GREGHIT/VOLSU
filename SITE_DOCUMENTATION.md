# LMS Platform: Полное описание проекта

## 1. Что это за система

Этот проект представляет собой LMS-платформу для учебного процесса. Система объединяет в одном приложении:

- управление курсами;
- работу со студентами и группами;
- задания и сдачи;
- тестирование с автопроверкой и ручной проверкой;
- журнал оценок и модульные баллы;
- расписание;
- библиотеку материалов;
- уведомления;
- аналитику активности и успеваемости;
- административную работу с персоналом.

Проект ориентирован на три основные роли:

- `STUDENT` — студент;
- `TEACHER` — преподаватель;
- `ADMIN` — администратор.

Система сделана как локальное веб-приложение с фронтендом на React и бэкендом на Express + Prisma + SQLite.

---

## 2. Главная идея продукта

Сайт закрывает полный цикл учебной работы:

1. Преподаватель создаёт курс.
2. Записывает студентов на курс.
3. Добавляет задания, тесты, материалы и расписание.
4. Студенты проходят курс: читают материалы, смотрят расписание, сдают задания, проходят тесты.
5. Преподаватель проверяет задания и открытые вопросы в тестах.
6. Система автоматически считает часть результатов, а преподаватель дополняет ручные оценки.
7. Всё это попадает в разделы успеваемости, журнала и аналитики.

То есть проект не является только “сайтом с курсами” или “сайтом с тестами”. Это связанная академическая экосистема.

---

## 3. Технологический стек

### 3.1. Frontend

- `React 18`
- `React Router DOM`
- `Axios`
- `Framer Motion`
- `i18next`
- `Tailwind CSS`
- `Vite`

Frontend расположен в:

- `frontend/lms-frontend/src`

### 3.2. Backend

- `Node.js`
- `Express`
- `Prisma`
- `SQLite`
- `bcrypt`
- `jsonwebtoken`

Backend расположен в:

- `backend`

### 3.3. Хранилища данных

Система использует смешанную модель хранения:

- основная реляционная информация хранится в `SQLite` через `Prisma`;
- часть вспомогательных модулей хранит данные в JSON-файлах;
- загруженные файлы хранятся в папке `backend/uploads`.

---

## 4. Общая архитектура

### 4.1. Frontend-архитектура

Frontend работает как SPA-приложение.

Главная точка входа:

- `frontend/lms-frontend/src/main.jsx`

Основной роутер:

- `frontend/lms-frontend/src/App.jsx`

Защищённая оболочка приложения:

- `frontend/lms-frontend/src/components/AppLayout.jsx`
- `frontend/lms-frontend/src/components/RequireAuth.jsx`

Логика фронтенда делится на:

- страницы (`src/pages`);
- общие компоненты (`src/components`);
- course-specific компоненты (`src/components/course`);
- UI-элементы (`src/components/ui`);
- утилиты (`src/utils`);
- API-слой (`src/api/http.js`);
- auth-хранилище (`src/auth/token.js`).

### 4.2. Backend-архитектура

Главная точка входа сервера:

- `backend/index.js`

Сервер:

- поднимает Express;
- включает CORS;
- парсит JSON и form-urlencoded;
- раздаёт `/uploads` как статические файлы;
- вешает rate limit на основные рабочие роуты;
- регистрирует набор route-модулей.

Все основные домены вынесены в отдельные route-файлы:

- `authRoutes.js`
- `courseRoutes.js`
- `studentRoutes.js`
- `assignmentRoutes.js`
- `testRoutes.js`
- `notificationRoutes.js`
- `analyticsRoutes.js`
- `libraryRoutes.js`
- `scheduleRoutes.js`
- `dashboardRoutes.js`
- `staffRoutes.js`
- `gradesRoutes.js`

### 4.3. Бизнес-логика

Главная особенность проекта в том, что бизнес-логика не размазана случайно по всему коду. Она в основном сосредоточена:

- в route-модулях backend;
- в отдельных фронтенд-страницах с крупными рабочими сценариями, например:
  - `CourseAssignments.jsx`
  - `CourseTestEditorPage.jsx`
  - `TestAttemptPage.jsx`
  - `CourseGradebook.jsx`
  - `GradesPage.jsx`
  - `ScheduleEditorPage.jsx`

---

## 5. Роли и модель доступа

### 5.1. Студент

Студент может:

- видеть свои курсы;
- открывать страницу курса;
- проходить тесты;
- отправлять задания;
- смотреть библиотеку доступных материалов;
- смотреть расписание;
- видеть свои результаты и оценки;
- запрашивать дополнительную попытку теста.

Студент не может:

- создавать курсы;
- редактировать тесты;
- проверять сдачи;
- смотреть чужие оценки;
- управлять расписанием;
- управлять библиотекой.

### 5.2. Преподаватель

Преподаватель может:

- создавать и редактировать свои курсы;
- записывать студентов;
- создавать задания;
- создавать и публиковать тесты;
- проверять задания;
- вручную проверять открытые вопросы;
- отправлять уведомления;
- работать с библиотекой;
- управлять расписанием;
- смотреть аналитику;
- выставлять модульные оценки;
- экспортировать ведомости.

### 5.3. Администратор

Администратор имеет максимально широкий доступ и может:

- видеть все курсы;
- работать со студентами;
- работать с персоналом;
- получать доступ к teacher-only разделам;
- выполнять глобальное администрирование данных.

### 5.4. Реализация авторизации

На backend авторизация реализована через JWT:

- `backend/auth.js`
- `backend/middlewares.js`

Основные механизмы:

- `signToken(user)` подписывает токен на 7 дней;
- `authRequired` проверяет Bearer token;
- `requireRole(...roles)` ограничивает доступ по роли;
- `requireCapability(...)` поддерживает модель прав/permissions.

На frontend токен и пользователь хранятся в `localStorage`:

- `lms_token`
- `lms_user`

Файл:

- `frontend/lms-frontend/src/auth/token.js`

---

## 6. Структура данных

Главная схема описана в:

- `backend/prisma/schema.prisma`

Ниже — ключевые сущности.

### 6.1. User

Пользователь системы.

Поля:

- email
- passwordHash
- role
- fullName
- studentCode
- faculty
- staffTitle
- staffCategory
- accessSystemsJson
- permissionsJson
- managedGroupIdsJson
- groupId

Пользователь может быть:

- студентом;
- преподавателем;
- администратором.

### 6.2. StudentGroup

Учебная группа.

Используется для:

- привязки студентов;
- фильтрации;
- адресных уведомлений;
- расписания;
- аналитики.

### 6.3. Course

Основная учебная единица.

Содержит:

- название;
- предметные теги;
- номер курса;
- семестр;
- кафедру;
- учебный год;
- формат;
- кампус;
- teacherId.

Связи:

- enrollments;
- assignments;
- tests;
- notifications;
- grades.

### 6.4. Enrollment

Связь между студентом и курсом.

Уникальность:

- `courseId + studentId`

### 6.5. CourseGrade

Ручной журнал по модульным оценкам.

Содержит:

- `module1Score`
- `module2Score`
- `module3Score`
- `notes`

Это отдельный слой оценки, который не дублирует тесты, а дополняет их.

### 6.6. Assignment

Задание в курсе.

Содержит:

- title
- description
- dueDate
- teacherId
- courseId

### 6.7. Submission

Сдача задания студентом.

Содержит:

- текст ответа;
- вложения;
- grade;
- feedback;
- gradedAt.

Вложения сохраняются через `attachmentsJson`.

### 6.8. Test

Тест в курсе.

Содержит:

- title
- description
- instructions
- isPublished
- availableFrom
- timeLimitMinutes
- tabSwitchLimit
- attemptLimit

### 6.9. Question

Вопрос теста.

Поля:

- type
- text
- configJson
- points
- order

Типы вопросов:

- `SINGLE`
- `MULTI`
- `OPEN`
- `ORDER`
- `MATCH`
- `CATEGORY`
- `KEYWORD`
- `FORMULA`
- `TABLE`
- `CODE`
- `SQL`

### 6.10. Option

Вариант ответа для `SINGLE` и `MULTI`.

### 6.11. Attempt

Попытка прохождения теста.

Содержит:

- startedAt
- finishedAt
- autoSubmittedAt
- score
- maxScore
- tabSwitchCount
- activityLogJson

### 6.12. Answer

Ответ на конкретный вопрос в рамках попытки.

Содержит:

- textAnswer
- responseJson
- attachmentsJson
- openScore
- manualScore
- reviewStatus
- reviewComment
- reviewReason
- feedbackJson
- reviewedAt
- reviewedById

### 6.13. AnswerSelection

Связь many-to-many между ответом и выбранными вариантами.

### 6.14. Notification

Уведомления по курсу.

Поддерживаются аудитории:

- `ALL`
- `GROUP`
- `STUDENT`
- `TEACHERS`

---

## 7. Где что хранится

### 7.1. SQLite через Prisma

Хранит:

- пользователей;
- группы;
- курсы;
- записи на курсы;
- задания;
- сдачи;
- тесты;
- вопросы;
- попытки;
- ответы;
- оценки;
- уведомления.

Файл базы:

- `backend/prisma/dev.db`

### 7.2. JSON-файлы

Используются для модулей, где удобнее хранить данные в файловом виде:

- `backend/data/library-materials.json`
- `backend/data/schedule-weekly-templates.json`
- `backend/data/schedule-events.json`
- `backend/data/audit-log.json`

### 7.3. Uploaded files

Файлы хранятся в:

- `backend/uploads/library`
- `backend/uploads/submissions`
- `backend/uploads/test-answers`

Сервер раздаёт их через:

- `/uploads/*`

---

## 8. Навигация и маршруты фронтенда

Главный роутинг описан в `App.jsx`.

### 8.1. Публичные маршруты

- `/login`

### 8.2. Защищённые маршруты

- `/courses`
- `/grades`
- `/library`
- `/schedule`
- `/schedule/editor`
- `/analytics`
- `/students`
- `/staff`
- `/courses/:courseId`
- `/courses/:courseId/assignments`
- `/courses/:courseId/students`
- `/courses/:courseId/tests`
- `/courses/:courseId/tests/:testId/edit`
- `/courses/:courseId/gradebook`
- `/tests/:testId/attempts/:attemptId`
- `/tests/:testId/inspect`

### 8.3. Оболочка приложения

`AppLayout.jsx` отвечает за:

- левый sidebar;
- верхнеуровневую навигацию;
- настройки интерфейса;
- тему;
- язык;
- режим анимаций;
- фильтры списка курсов;
- карточку возврата к незавершённому тесту.

---

## 9. Интерфейс и UX-особенности

### 9.1. Темы

В системе есть несколько визуальных режимов:

- `light`
- `dark`
- `glass`

Они запоминаются в `localStorage`.

### 9.2. Motion modes

Поддерживаются режимы анимаций:

- `simple`
- `medium`
- `full`

### 9.3. Язык

Используется `i18next`.

Язык сохраняется локально и может меняться через настройки интерфейса.

### 9.4. Sidebar

Sidebar:

- может скрываться;
- состояние сохраняется между сессиями;
- показывает роль пользователя;
- даёт быстрый доступ к разделам;
- у студента показывает напоминание о незавершённой попытке теста.

### 9.5. Защита от потери контекста в тесте

Во время теста система:

- сохраняет состояние ответов;
- хранит напоминание об активной попытке;
- позволяет вернуться к незавершённому тесту;
- учитывает переключение вкладок;
- может автоматически завершить тест при нарушении лимита.

---

## 10. Главные страницы системы

### 10.1. LoginPage

Файл:

- `src/pages/LoginPage.jsx`

Отвечает за вход по email/password.

### 10.2. CoursesPage

Файл:

- `src/pages/CoursesPage.jsx`

Показывает список курсов.

Для преподавателя и администратора:

- создание курсов;
- фильтрация по тегам;
- управление набором курсов.

Для студента:

- список записанных курсов.

### 10.3. CoursePage

Файл:

- `src/pages/CoursePage.jsx`

Это контейнер-страница для вложенных разделов курса:

- assignments;
- students;
- tests;
- gradebook.

### 10.4. CourseAssignments

Файл:

- `src/pages/CourseAssignments.jsx`

Один из самых крупных и насыщенных модулей.

В нём сосредоточено:

- задания;
- сдачи;
- обзор курса;
- курс-уведомления;
- создание тестов;
- teacher workflow внутри курса;
- review workflow по тестам;
- student preview;
- gradebook entry points.

Это фактически “рабочий центр курса”.

### 10.5. CourseStudentsPage

Файл:

- `src/pages/CourseStudentsPage.jsx`

Показывает студентов курса и операции с записью.

### 10.6. CourseTests

Файл:

- `src/pages/CourseTests.jsx`

Фокусируется на списке тестов курса.

### 10.7. CourseTestEditorPage

Файл:

- `src/pages/CourseTestEditorPage.jsx`

Большой редактор тестов.

Позволяет:

- редактировать метаданные теста;
- работать с вопросами;
- настраивать типы вопросов;
- задавать правильные ответы и конфигурацию;
- управлять порядком и баллами.

### 10.8. TestAttemptPage

Файл:

- `src/pages/TestAttemptPage.jsx`

Ключевая страница прохождения теста.

Поддерживает:

- режим студента;
- inspect mode для преподавателя/админа;
- автосохранение;
- таймер;
- лимит переключения вкладок;
- завершение теста;
- просмотр обратной связи;
- drag-and-drop для `ORDER`;
- вложения в `OPEN`.

### 10.9. GradesPage

Файл:

- `src/pages/GradesPage.jsx`

Объединяет:

- автоматический средний результат по тестам;
- ручные модульные баллы;
- фильтрацию;
- экспорт Word/Excel;
- режим чтения для студента;
- режим редактирования для преподавателя.

### 10.10. CourseGradebook

Файл:

- `src/pages/CourseGradebook.jsx`

Расширенный журнал внутри курса.

Даёт:

- агрегированные показатели;
- фильтры;
- детальный разрез по заданиям и тестам;
- уведомления по контексту;
- аналитику по студентам и группам.

### 10.11. LibraryPage

Файл:

- `src/pages/LibraryPage.jsx`

Раздел материалов.

### 10.12. SchedulePage

Файл:

- `src/pages/SchedulePage.jsx`

Отображение расписания.

### 10.13. ScheduleEditorPage

Файл:

- `src/pages/ScheduleEditorPage.jsx`

Редактор недельных шаблонов расписания.

### 10.14. AnalyticsPage

Файл:

- `src/pages/AnalyticsPage.jsx`

Раздел сводной аналитики по учебным данным.

### 10.15. StudentsManagementPage

Файл:

- `src/pages/StudentsManagementPage.jsx`

Глобальное управление студентами и группами.

### 10.16. StaffManagementPage

Файл:

- `src/pages/StaffManagementPage.jsx`

Глобальное управление персоналом.

---

## 11. Курсы: как они работают

### 11.1. Создание курса

Backend:

- `POST /courses`

Frontend:

- список курсов и создание доступны через `CoursesPage`.

При создании курс получает:

- название;
- набор предметных тегов;
- teacherId;
- системные метаданные.

### 11.2. Предметные теги

Система поддерживает преднастроенные значения:

- название предмета;
- код;
- номер курса;
- семестр;
- кафедра;
- учебный год;
- формат;
- кампус.

Preset-значения описаны в:

- `backend/utils/mappers.js`

### 11.3. Дублирование курса

Backend:

- `POST /courses/:courseId/duplicate`

Можно продублировать:

- сам курс;
- задания;
- тесты;
- вопросы и варианты ответов.

Это полезно для переноса курса на новый семестр.

### 11.4. История курса

Backend:

- `GET /courses/:courseId/history`

История строится по audit-log и показывает события:

- создание;
- обновление;
- удаление;
- дублирование;
- связанные операции.

---

## 12. Студенты и группы

### 12.1. Глобальные студенты

Backend:

- `GET /students`
- `POST /students`
- `PUT /students/:studentId`

### 12.2. Группы

Backend:

- `GET /groups`
- `POST /groups`
- `DELETE /groups/:groupId`

Группы участвуют в:

- записи студентов;
- расписании;
- библиотеке;
- уведомлениях;
- аналитике;
- фильтрации успеваемости.

### 12.3. Запись на курс

Backend:

- `POST /courses/:courseId/enroll`
- `POST /courses/:courseId/unenroll`
- `POST /courses/:courseId/enrollments/group-remove`
- `POST /courses/:courseId/enrollments/bulk`
- `GET /courses/:courseId/enrollments`
- `GET /courses/:courseId/students`

Таким образом система поддерживает:

- точечную запись;
- массовую запись;
- массовое удаление;
- получение состава курса.

---

## 13. Задания и сдачи

### 13.1. Assignment lifecycle

Backend:

- `POST /courses/:courseId/assignments`
- `DELETE /assignments/:assignmentId`
- `POST /assignments/:assignmentId/duplicate`
- `POST /courses/:courseId/assignments/batch`
- `GET /courses/:courseId/assignments`

### 13.2. Сдача задания студентом

Backend:

- `POST /assignments/:assignmentId/submit`

Студент может отправить:

- текст;
- файлы.

Вложения хранятся:

- на диске;
- метаданные — в `attachmentsJson`.

### 13.3. Проверка преподавателем

Backend:

- `POST /submissions/:submissionId/grade`

Преподаватель выставляет:

- `grade`
- `feedback`

### 13.4. Список сдач

Backend:

- `GET /courses/:courseId/submissions`

Этот маршрут нужен для teacher review workflow и панели “Сдачи”.

### 13.5. Связь с журналом

Задания имеют собственные оценки по сдачам, а модульный журнал хранится отдельно. Это означает:

- сдача задания не равна автоматически модульной оценке;
- преподаватель может использовать оценки по заданиям как основу для модульного выставления, но это отдельные слои данных.

---

## 14. Тестовая система

Тестовый модуль — один из самых сложных и функционально насыщенных блоков проекта.

### 14.1. Что поддерживает тестовый модуль

- создание тестов;
- редактирование тестов;
- публикацию;
- планирование доступности;
- лимит попыток;
- дополнительную попытку по запросу;
- таймер;
- контроль переключения вкладок;
- автосохранение ответов;
- автоматическую проверку;
- ручную проверку открытых ответов;
- teacher inspect mode;
- хранение файлов в открытых ответах.

### 14.2. Основные backend-роуты тестов

- `POST /courses/:courseId/tests`
- `PUT /tests/:testId`
- `POST /tests/:testId/duplicate`
- `POST /courses/:courseId/tests/batch`
- `DELETE /tests/:testId`
- `POST /tests/:testId/publish`
- `POST /tests/:testId/unpublish`
- `POST /tests/:testId/questions`
- `PUT /questions/:questionId`
- `DELETE /questions/:questionId`
- `GET /courses/:courseId/tests`
- `GET /tests/:testId`
- `POST /tests/:testId/start`
- `GET /attempts/:attemptId/state`
- `POST /attempts/:attemptId/activity`
- `POST /attempts/:attemptId/answer`
- `POST /attempts/:attemptId/finish`
- `GET /tests/:testId/my-attempts`
- `POST /tests/:testId/request-attempt`
- `GET /tests/:testId/attempts`
- `GET /attempts/:attemptId/review`
- `POST /attempts/:attemptId/review`

### 14.3. Типы вопросов

#### SINGLE

Один правильный вариант.

#### MULTI

Несколько правильных вариантов.

#### OPEN

Открытый текстовый ответ, который требует ручной проверки.

Особенности:

- можно прикреплять файлы;
- преподаватель видит только сам открытый вопрос в review modal;
- итог попытки пересчитывается после ручной проверки.

#### ORDER

Нужно расставить шаги в правильной последовательности.

Особенности:

- поддержан drag-and-drop;
- есть динамическое перетаскивание элементов;
- сохранён fallback через кнопки вверх/вниз.

#### MATCH

Сопоставление левых и правых значений.

#### CATEGORY

Распределение объектов по категориям.

#### KEYWORD

Короткий ответ по ключевым словам.

#### FORMULA

Ввод формулы.

#### TABLE

Заполнение ячеек таблицы.

#### CODE

Текстовый кодовый ответ.

#### SQL

Текстовый SQL-ответ.

### 14.4. Хранение конфигурации вопросов

Для гибкости разные типы вопросов хранят настройки в `configJson`.

Примеры того, что попадает в `configJson`:

- prompt;
- items;
- pairs;
- categories;
- mask;
- answers;
- placeholder;
- columns / rows / cells;
- language;
- starterCode;
- expectedKeywords;
- forbiddenKeywords.

### 14.5. Student attempt flow

Поток прохождения:

1. Студент стартует тест.
2. Создаётся `Attempt`.
3. По мере ответа создаются/обновляются `Answer`.
4. Выборы для choice-вопросов сохраняются в `AnswerSelection`.
5. При открытии страницы снова грузится state попытки.
6. При завершении теста вызывается финализация.
7. Итог сохраняется в `Attempt.score/maxScore`.

### 14.6. Автосохранение

На frontend `TestAttemptPage` отслеживает dirty-ответы и отправляет их пачкой с небольшой задержкой.

Это снижает риск потери данных при:

- случайном уходе со страницы;
- перезагрузке;
- нестабильной работе пользователя внутри длинного теста.

### 14.7. Контроль вкладок

В `Attempt` хранится:

- `tabSwitchCount`
- `activityLogJson`

Тест может:

- фиксировать переходы на другую вкладку;
- показывать предупреждение;
- автоматически завершаться при превышении лимита.

### 14.8. Таймер

У теста есть `timeLimitMinutes`.

Если время истекло:

- попытка автоматически финализируется;
- студент получает auto-finished состояние.

### 14.9. Автопроверка

Для большинства типов работает автоматическая проверка.

Она сравнивает:

- выбранные ответы;
- порядок;
- соответствия;
- категории;
- текстовые шаблоны;
- ключевые слова;
- формулы;
- таблицы;
- кодовые признаки.

### 14.10. Ручная проверка

Сейчас ручная проверка нужна только для `OPEN`.

Поток:

1. Студент завершает тест.
2. Если есть открытый вопрос — создаётся teacher notification о проверке.
3. В `Сдачи` появляется жёлтая карточка review request.
4. Преподаватель открывает review modal.
5. Видит:
   - студента;
   - тест;
   - открытый вопрос;
   - ответ;
   - файлы;
   - поля оценки/комментариев.
6. После сохранения:
   - ответ получает manual score;
   - попытка пересчитывается;
   - итоговая оценка обновляется;
   - review notification исчезает.

### 14.11. Вложения в открытых вопросах

Поддержка сделана сквозным образом:

- frontend позволяет прикреплять файлы;
- backend сохраняет их в `uploads/test-answers`;
- teacher review modal даёт скачивание файлов;
- данные переживают повторное открытие попытки;
- удаление файлов корректно синхронизируется при пересохранении ответа;
- файлы очищаются при удалении теста/вопроса/ответа.

### 14.12. Дополнительные попытки

Студент может запросить extra attempt:

- `POST /tests/:testId/request-attempt`

Преподаватель получает уведомление и может:

- approve;
- reject.

Approve создаёт/увеличивает `TestAttemptAllowance.extraAttempts`.

---

## 15. Раздел "Оценки"

### 15.1. Что показывает GradesPage

Раздел объединяет два источника:

- автоматический средний процент по завершённым тестам;
- ручные модульные оценки `module1/module2/module3`.

### 15.2. Как считается testAverage

Backend `gradesRoutes.js`:

- получает все завершённые `Attempt` по курсам;
- переводит их в проценты `score / maxScore * 100`;
- усредняет по студенту внутри курса.

### 15.3. Что редактирует преподаватель

Преподаватель редактирует:

- `module1Score`
- `module2Score`
- `module3Score`
- `notes`

Тестовые проценты в этом разделе не редактируются вручную. Они считаются из фактических попыток.

### 15.4. Экспорт

Поддерживается экспорт в:

- `Word (.doc)`
- `Excel (.xls)`

Это HTML-документы с соответствующим MIME-type, которые скачиваются как ведомость.

---

## 16. CourseGradebook и журнал внутри курса

Это более глубокий курс-ориентированный журнал по сравнению с общей страницей `GradesPage`.

Он:

- загружает расширенный `gradebook/full`;
- показывает задания и тесты в разрезе курса;
- показывает уведомления;
- даёт фильтры по группам и студентам;
- помогает преподавателю видеть не только баллы, но и контекст.

Важная логика:

- manual review тестов влияет на итог `Attempt`;
- `CourseGradebook` перезагружается после review, чтобы показывать обновлённые проценты.

---

## 17. Уведомления

### 17.1. Что поддерживается

Система уведомлений привязана к курсам.

Поддерживаются аудитории:

- весь курс;
- конкретная группа;
- конкретный студент;
- преподаватели курса.

### 17.2. Где используются уведомления

- ручные объявления преподавателя;
- одобрение/отклонение extra attempt;
- запрос на ручную проверку открытого ответа;
- системные course-level коммуникации.

### 17.3. Специальные системные уведомления

В body уведомлений может храниться JSON payload с `kind`.

Примеры:

- `ATTEMPT_REQUEST`
- `TEST_REVIEW_REQUIRED`

Это позволяет использовать уведомления не только как текст, но и как бизнес-сигналы.

---

## 18. Библиотека материалов

### 18.1. Общая идея

Библиотека — это файловое хранилище учебных материалов с видимостью по аудитории.

### 18.2. Разделы доступа

Поддерживаются материалы:

- `PUBLIC`
- `PRIVATE`
- `GROUP`

### 18.3. PRIVATE-аудитории

Для private используются дополнительные audience-mode:

- `SELF`
- `ALL_TEACHERS`
- `COURSE`
- `GROUP`

### 18.4. Видимость

Студент видит:

- публичное;
- своё групповое;
- course-private, если записан на курс.

Преподаватель видит:

- публичное;
- свои материалы;
- group-материалы;
- teacher-private;
- course-private по своим курсам.

### 18.5. Preview

Поддерживаются preview-режимы:

- PDF;
- image;
- text;
- docx;
- pptx;
- download-only fallback.

### 18.6. Хранение

Метаданные:

- `backend/data/library-materials.json`

Файлы:

- `backend/uploads/library`

---

## 19. Расписание

### 19.1. Подход

Расписание основано не на единичных событиях, а на недельных шаблонах.

То есть преподаватель создаёт weekly template, а система генерирует фактические события в диапазоне дат.

### 19.2. Пары

Система содержит фиксированные слоты пар:

- 1 пара — `08:30–10:00`
- 2 пара — `10:10–11:40`
- 3 пара — `12:10–13:40`
- 4 пара — `13:50–15:20`
- 5 пара — `15:30–17:00`
- 6 пара — `17:10–18:40`
- 7 пара — `18:50–20:20`

### 19.3. Семестры

Система использует preset range:

- `current`
- `next`

### 19.4. Чётность недель

Поддерживается parity:

- `BOTH`
- `ODD`
- `EVEN`

При генерации система вычисляет ISO parity недели.

### 19.5. Привязка расписания

Шаблон может быть связан:

- с курсом;
- с основной группой;
- с объединением групп;
- с местом и форматом проведения.

### 19.6. Student view

Студент видит только релевантные события:

- по своей группе;
- по своим курсам;
- по общим нейтральным событиям.

### 19.7. Teacher/Admin view

Teacher/Admin могут:

- создавать;
- редактировать;
- удалять шаблоны.

### 19.8. Хранение

Шаблоны:

- `backend/data/schedule-weekly-templates.json`

---

## 20. Аналитика

### 20.1. Обзор

Маршрут:

- `GET /analytics/overview`

Это интеллектуальный слой поверх:

- enrollments;
- submissions;
- finished attempts;
- групп;
- курсов.

### 20.2. Scope

Поддерживаются уровни обзора:

- university;
- group;
- student.

Для студента scope фактически всегда принудительно сужается до student-mode.

### 20.3. Что считает аналитика

- averageAssignmentGrade;
- averageTestPercent;
- activeStudentsPercent;
- riskStudentsCount;
- publishedTestsCount;
- assignmentsCount.

### 20.4. Что ещё формируется

- `facts`
- `triggers`
- `groupInsights`
- `studentInsights`
- `leaderboard`

То есть аналитика здесь не только числовая, но и интерпретационная.

### 20.5. Какие сигналы считаются рискованными

Примеры:

- давно нет активности;
- низкие средние;
- много несданных заданий;
- непройденные тесты.

---

## 21. Dashboard / Today

Маршрут:

- `GET /dashboard/today`

### 21.1. Для студента

Формируются:

- список актуальных задач;
- прогресс по курсам;
- preview расписания на сегодня.

### 21.2. Для преподавателя

Формируются:

- задачи по непроверенным сдачам;
- задачи по тестам, требующим review;
- прогресс по курсам;
- pendingReviews на курс.

Это быстрый operational summary по текущему дню.

---

## 22. Персонал

Backend:

- `GET /staff/options`
- `GET /staff`
- `POST /staff`
- `PUT /staff/:staffId`
- `GET /staff/:staffId/audit`

Этот блок нужен для:

- ведения преподавателей и другого staff;
- управления staff metadata;
- назначения access systems и permissions;
- отслеживания аудита по сотруднику.

---

## 23. Аудит и история изменений

### 23.1. Audit log

Реализован в:

- `backend/utils/auditLog.js`

Хранится в:

- `backend/data/audit-log.json`

### 23.2. Что логируется

Примеры:

- создание курса;
- обновление курса;
- удаление курса;
- создание/дублирование задания;
- выставление оценок;
- операции в библиотеке;
- batch-действия;
- изменение staff-данных.

### 23.3. Зачем это нужно

Audit log даёт:

- прозрачность изменений;
- историю курса;
- основу для административного контроля;
- удобство при передаче проекта и анализе событий.

---

## 24. API-каталог по модулям

### 24.1. Auth

- `GET /`
- `POST /auth/register`
- `POST /auth/login`
- `GET /me`

### 24.2. Courses

- `GET /course-tag-options`
- `POST /courses`
- `GET /courses`
- `GET /courses/:courseId`
- `POST /courses/:courseId/duplicate`
- `DELETE /courses/:courseId`
- `PUT /courses/:courseId`
- `GET /courses/:courseId/history`
- `GET /my/courses`

### 24.3. Students and groups

- `POST /courses/:courseId/enroll`
- `GET /students`
- `POST /students`
- `PUT /students/:studentId`
- `GET /groups`
- `POST /groups`
- `DELETE /groups/:groupId`
- `GET /courses/:courseId/enrollments`
- `POST /courses/:courseId/unenroll`
- `POST /courses/:courseId/enrollments/group-remove`
- `GET /courses/:courseId/students`
- `POST /courses/:courseId/enrollments/bulk`

### 24.4. Assignments

- `POST /courses/:courseId/assignments`
- `DELETE /assignments/:assignmentId`
- `POST /assignments/:assignmentId/duplicate`
- `POST /courses/:courseId/assignments/batch`
- `GET /courses/:courseId/assignments`
- `POST /assignments/:assignmentId/submit`
- `POST /submissions/:submissionId/grade`
- `GET /courses/:courseId/submissions`
- `GET /courses/:courseId/gradebook`
- `GET /courses/:courseId/gradebook/full`

### 24.5. Tests

- `POST /courses/:courseId/tests`
- `PUT /tests/:testId`
- `POST /tests/:testId/duplicate`
- `POST /courses/:courseId/tests/batch`
- `DELETE /tests/:testId`
- `POST /tests/:testId/publish`
- `POST /tests/:testId/unpublish`
- `POST /tests/:testId/questions`
- `PUT /questions/:questionId`
- `DELETE /questions/:questionId`
- `GET /courses/:courseId/tests`
- `GET /tests/:testId`
- `POST /tests/:testId/start`
- `GET /attempts/:attemptId/state`
- `POST /attempts/:attemptId/activity`
- `POST /attempts/:attemptId/answer`
- `POST /attempts/:attemptId/finish`
- `GET /tests/:testId/my-attempts`
- `POST /tests/:testId/request-attempt`
- `GET /tests/:testId/attempts`
- `GET /attempts/:attemptId/review`
- `POST /attempts/:attemptId/review`

### 24.6. Notifications

- `GET /courses/:courseId/notifications`
- `POST /courses/:courseId/notifications`
- `POST /notifications/:notificationId/attempt-request`
- `DELETE /notifications/:notificationId`

### 24.7. Analytics

- `GET /analytics/overview`

### 24.8. Dashboard

- `GET /dashboard/today`

### 24.9. Library

- `GET /library/meta`
- `GET /library/materials`
- `GET /library/materials/:materialId/preview`
- `POST /library/materials`
- `PUT /library/materials/:materialId`
- `DELETE /library/materials/:materialId`

### 24.10. Schedule

- `GET /schedule/meta`
- `GET /schedule/templates`
- `GET /schedule/generated`
- `POST /schedule/templates`
- `PUT /schedule/templates/:templateId`
- `DELETE /schedule/templates/:templateId`

### 24.11. Grades

- `GET /grades/overview`
- `PUT /grades/:gradeId`
- `GET /grades/export`

### 24.12. Staff

- `GET /staff/options`
- `GET /staff`
- `POST /staff`
- `PUT /staff/:staffId`
- `GET /staff/:staffId/audit`

---

## 25. Особенности хранения состояния на клиенте

Через `localStorage` хранятся:

- auth token;
- user profile;
- theme;
- motion mode;
- sidebar collapsed flag;
- language;
- active test reminder.

Это даёт:

- сохранение пользовательских предпочтений;
- возможность быстро восстановить состояние теста;
- устойчивость интерфейса между перезагрузками.

---

## 26. Обработка ошибок

### 26.1. Backend

В `backend/index.js` есть общий error middleware.

Он:

- перехватывает непойманные ошибки;
- возвращает `500`;
- формирует payload через helper `error(...)`.

### 26.2. Frontend

Frontend использует:

- `AppErrorBoundary`
- перехватчики Axios
- `translateUiMessage`
- `formatUiError`

Это позволяет:

- показывать более человекочитаемые ошибки;
- локализовать системные сообщения;
- не падать на отдельных страницах полностью.

---

## 27. Производительность и защитные меры

### 27.1. Rate limit

Сервер ограничивает интенсивные маршруты:

- `/courses`
- `/assignments`
- `/tests`
- `/submissions`
- `/library`
- `/schedule`

Параметры:

- 45 запросов на 15 секунд.

### 27.2. Lazy loading страниц

Frontend использует `React.lazy` и `Suspense`.

Это помогает:

- не грузить весь интерфейс сразу;
- ускорять первичную загрузку.

### 27.3. Static file strategy

Файлы раздаются напрямую через `/uploads`, что упрощает скачивание:

- библиотечных материалов;
- вложений к заданиям;
- вложений к открытым ответам.

---

## 28. Практические пользовательские сценарии

### 28.1. Сценарий преподавателя

1. Входит в систему.
2. Создаёт курс.
3. Настраивает курс и теги.
4. Записывает студентов.
5. Создаёт задания.
6. Создаёт тесты и вопросы.
7. Публикует тесты.
8. Добавляет материалы в библиотеку.
9. Формирует расписание.
10. Проверяет сдачи.
11. Проверяет открытые вопросы.
12. Выставляет модульные оценки.
13. Анализирует результаты.
14. Экспортирует ведомости.

### 28.2. Сценарий студента

1. Входит в систему.
2. Видит список своих курсов.
3. Заходит в курс.
4. Читает уведомления и материалы.
5. Сдаёт задания с файлами.
6. Проходит тесты.
7. При необходимости возвращается к незавершённой попытке.
8. Видит свои результаты.
9. Запрашивает дополнительную попытку, если лимит исчерпан.

### 28.3. Сценарий администратора

1. Контролирует все курсы.
2. Управляет персоналом.
3. Может вмешиваться в курсы и академические сущности.
4. Имеет более широкий доступ к данным и аудитам.

---

## 29. Текущие сильные стороны системы

- широкий охват учебных процессов;
- связность модулей между собой;
- сильная тестовая подсистема;
- ручная и автоматическая оценка в одном контуре;
- поддержка файлов в заданиях и открытых ответах;
- роли и разграничение доступа;
- аналитика по группам и студентам;
- наглядный интерфейс курса;
- экспорт и аудит;
- сохранение пользовательских настроек интерфейса.

---

## 30. Что особенно важно понимать о системе

### 30.1. Это не просто CRUD-проект

Внутри проекта есть реальные бизнес-потоки:

- попытки тестирования;
- автопроверка;
- ручной review;
- маршрутизация уведомлений;
- учёт прав доступа;
- аналитические вычисления;
- генерация расписания из шаблонов.

### 30.2. Это гибридная архитектура хранения

Проект сочетает:

- реляционные данные в SQLite;
- JSON-файлы для некоторых доменов;
- файловое хранилище для вложений.

### 30.3. CourseAssignments — одно из самых центральных мест

Многие course-level сценарии сходятся именно туда:

- overview;
- assignments;
- tests;
- notifications;
- submissions;
- review workflow.

### 30.4. TestAttemptPage и testRoutes.js — самые сложные части проекта

Именно там сосредоточена наиболее тонкая логика:

- вопросные типы;
- state-management попытки;
- финализация;
- безопасность;
- review flow;
- feedback generation.

---

## 31. Файлы, которые особенно полезно знать при развитии проекта

### Frontend

- `frontend/lms-frontend/src/App.jsx`
- `frontend/lms-frontend/src/components/AppLayout.jsx`
- `frontend/lms-frontend/src/pages/CourseAssignments.jsx`
- `frontend/lms-frontend/src/pages/CourseTestEditorPage.jsx`
- `frontend/lms-frontend/src/pages/TestAttemptPage.jsx`
- `frontend/lms-frontend/src/pages/GradesPage.jsx`
- `frontend/lms-frontend/src/pages/CourseGradebook.jsx`
- `frontend/lms-frontend/src/pages/ScheduleEditorPage.jsx`
- `frontend/lms-frontend/src/pages/LibraryPage.jsx`
- `frontend/lms-frontend/src/components/AttemptReviewModal.jsx`
- `frontend/lms-frontend/src/utils/testDesigner.js`

### Backend

- `backend/index.js`
- `backend/prisma/schema.prisma`
- `backend/routes/testRoutes.js`
- `backend/routes/assignmentRoutes.js`
- `backend/routes/gradesRoutes.js`
- `backend/routes/courseRoutes.js`
- `backend/routes/notificationRoutes.js`
- `backend/routes/libraryRoutes.js`
- `backend/routes/scheduleRoutes.js`
- `backend/routes/analyticsRoutes.js`
- `backend/routes/dashboardRoutes.js`
- `backend/utils/auditLog.js`
- `backend/utils/mappers.js`

---

## 32. Краткое итоговое резюме

Получившийся сайт — это полноценная учебная LMS-платформа, а не набор отдельных экранов. В нём реализованы:

- роли и авторизация;
- курсы и запись студентов;
- задания и сдачи;
- тесты с большим набором типов вопросов;
- автоматическая и ручная проверка;
- вложения в заданиях и открытых ответах;
- журнал оценок;
- модульная успеваемость;
- библиотека файловых материалов;
- расписание на основе шаблонов;
- уведомления;
- аналитика и дашборд;
- экспорт данных;
- аудит действий.

С технической точки зрения проект сочетает:

- React SPA на фронтенде;
- Express + Prisma + SQLite на бэкенде;
- JSON-хранилища для части модулей;
- файловую систему для вложений;
- явную маршрутизацию по доменам;
- достаточно богатую предметную логику.

Если этот документ использовать как базу для дальнейшей работы, его логично расширять следующими слоями:

- UML/ER-диаграммой;
- sequence-диаграммами ключевых сценариев;
- разделом по деплою;
- разделом по тестированию;
- чек-листом технического долга;
- пользовательскими инструкциями по ролям.
