## 2025-12-14
### Auth
- POST /auth/register
- POST /auth/login
- GET /me (JWT)

### Courses + Enrollment
- POST /courses (TEACHER)
- GET /courses (TEACHER)
- POST /courses/:courseId/enroll (TEACHER)
- GET /my/courses (STUDENT)

### Assignments + Submissions + Gradebook
- POST /courses/:courseId/assignments (TEACHER)
- GET /courses/:courseId/assignments (STUDENT/TEACHER)
- POST /assignments/:assignmentId/submit (STUDENT)
- POST /submissions/:submissionId/grade (TEACHER)
- GET /courses/:courseId/gradebook (TEACHER)

### Tests
- POST /courses/:courseId/tests (TEACHER)
- POST /tests/:testId/questions (TEACHER)
- POST /tests/:testId/publish (TEACHER)
- GET /courses/:courseId/tests (STUDENT sees only published)
- GET /tests/:testId (student безопасная версия)
- POST /tests/:testId/start (STUDENT)
- POST /attempts/:attemptId/answer (STUDENT)
- POST /attempts/:attemptId/finish (STUDENT, автооценка)
