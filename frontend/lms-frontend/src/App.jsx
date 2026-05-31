import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import AppLayout from "./components/AppLayout.jsx";
import AppErrorBoundary from "./components/AppErrorBoundary.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import PageSkeleton, { SectionSkeleton } from "./components/ui/Skeleton.jsx";
import LoginPage from "./pages/LoginPage.jsx";

const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage.jsx"));
const CourseAssignments = lazy(() => import("./pages/CourseAssignments.jsx"));
const CourseGradebook = lazy(() => import("./pages/CourseGradebook.jsx"));
const CoursePage = lazy(() => import("./pages/CoursePage.jsx"));
const CourseStudentsPage = lazy(() => import("./pages/CourseStudentsPage.jsx"));
const CourseTestEditorPage = lazy(() => import("./pages/CourseTestEditorPage.jsx"));
const CoursesPage = lazy(() => import("./pages/CoursesPage.jsx"));
const CourseTests = lazy(() => import("./pages/CourseTests.jsx"));
const GradesPage = lazy(() => import("./pages/GradesPage.jsx"));
const LibraryPage = lazy(() => import("./pages/LibraryPage.jsx"));
const ScheduleEditorPage = lazy(() => import("./pages/ScheduleEditorPage.jsx"));
const SchedulePage = lazy(() => import("./pages/SchedulePage.jsx"));
const StaffManagementPage = lazy(() => import("./pages/StaffManagementPage.jsx"));
const StudentsManagementPage = lazy(() => import("./pages/StudentsManagementPage.jsx"));
const TestAttemptPage = lazy(() => import("./pages/TestAttemptPage.jsx"));

function PageLoader() {
  return <PageSkeleton sections={2} />;
}

function AttemptLoader() {
  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-4 py-6">
      <SectionSkeleton rows={6} />
      <SectionSkeleton rows={4} />
    </div>
  );
}

function RoutedApp() {
  const location = useLocation();

  return (
    <AppErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/courses" replace />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/grades" element={<GradesPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/schedule/editor" element={<ScheduleEditorPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/students" element={<StudentsManagementPage />} />
            <Route path="/staff" element={<StaffManagementPage />} />

            <Route path="/courses/:courseId/assignments" element={<CourseAssignments />} />
            <Route path="/courses/:courseId/students" element={<CourseStudentsPage />} />
            <Route path="/courses/:courseId/tests/:testId/edit" element={<CourseTestEditorPage />} />
            <Route path="/courses/:courseId" element={<CoursePage />}>
              <Route path="assignments" element={<CourseAssignments />} />
              <Route path="students" element={<CourseStudentsPage />} />
              <Route path="tests/:testId/edit" element={<CourseTestEditorPage />} />
              <Route path="tests" element={<CourseTests />} />
              <Route path="gradebook" element={<CourseGradebook />} />
              <Route index element={<Navigate to="assignments" replace />} />
            </Route>
          </Route>

          <Route
            path="/tests/:testId/attempts/:attemptId"
            element={
              <RequireAuth>
                <Suspense fallback={<AttemptLoader />}>
                  <TestAttemptPage />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route
            path="/tests/:testId/inspect"
            element={
              <RequireAuth>
                <Suspense fallback={<AttemptLoader />}>
                  <TestAttemptPage />
                </Suspense>
              </RequireAuth>
            }
          />

          <Route
            path="*"
            element={
              <div className="mx-auto flex min-h-[40vh] max-w-3xl items-center justify-center px-4 py-10">
                <div className="theme-surface-panel w-full rounded-[26px] border border-slate-300 bg-white/95 p-6 text-center shadow-sm">
                  <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">404</div>
                  <div className="theme-readable-strong mt-3 text-2xl font-black text-slate-950">Страница не найдена</div>
                  <div className="theme-readable-soft mt-2 text-sm text-slate-600">
                    Похоже, адрес устарел или был введен с ошибкой.
                  </div>
                </div>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  );
}

export default function App() {
  return <RoutedApp />;
}
