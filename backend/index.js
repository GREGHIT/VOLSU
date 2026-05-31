const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { signToken, hashPassword, verifyPassword } = require('./auth');
const { authRequired, requireRole, requireCapability } = require('./middlewares');
const { normalizeText, pickPresetValue, COURSE_TAG_PRESETS, mapStudent, mapStaff, mapCourse, safeParseJsonArray, safeParseJsonNumberArray } = require('./utils/mappers');
const { createRateLimiter } = require('./utils/rateLimit');
const { appendAuditEntry, listAuditEntries } = require('./utils/auditLog');
const { ok, error, paginated } = require('./utils/response');
const registerAuthRoutes = require('./routes/authRoutes');
const registerCourseRoutes = require('./routes/courseRoutes');
const registerStudentRoutes = require('./routes/studentRoutes');
const registerAssignmentRoutes = require('./routes/assignmentRoutes');
const registerTestRoutes = require('./routes/testRoutes');
const registerNotificationRoutes = require('./routes/notificationRoutes');
const registerAnalyticsRoutes = require('./routes/analyticsRoutes');
const registerLibraryRoutes = require('./routes/libraryRoutes');
const registerScheduleRoutes = require('./routes/scheduleRoutes');
const registerDashboardRoutes = require('./routes/dashboardRoutes');
const registerStaffRoutes = require('./routes/staffRoutes');
const registerGradesRoutes = require('./routes/gradesRoutes');

const app = express();
const prisma = new PrismaClient();
app.locals.prisma = prisma;

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(['/courses', '/assignments', '/tests', '/submissions', '/library', '/schedule'], createRateLimiter({
  limit: 45,
  windowMs: 15 * 1000,
}));

const PORT = process.env.PORT || 3000;

const deps = {
  prisma,
  signToken,
  hashPassword,
  verifyPassword,
  authRequired,
  requireRole,
  requireCapability,
  normalizeText,
  pickPresetValue,
  COURSE_TAG_PRESETS,
  mapStudent,
  mapStaff,
  mapCourse,
  safeParseJsonArray,
  safeParseJsonNumberArray,
  appendAuditEntry,
  listAuditEntries,
  ok,
  error,
  paginated,
};

registerAuthRoutes(app, deps);
registerCourseRoutes(app, deps);
registerStudentRoutes(app, deps);
registerAssignmentRoutes(app, deps);
registerTestRoutes(app, deps);
registerNotificationRoutes(app, deps);
registerAnalyticsRoutes(app, deps);
registerLibraryRoutes(app, deps);
registerScheduleRoutes(app, deps);
registerDashboardRoutes(app, deps);
registerStaffRoutes(app, deps);
registerGradesRoutes(app, deps);

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  return error(res, 500, String(err?.message || err || 'Internal server error'));
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
