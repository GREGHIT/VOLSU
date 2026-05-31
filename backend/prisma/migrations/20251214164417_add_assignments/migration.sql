-- CreateTable
CREATE TABLE "Assignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "courseId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignmentId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "contentText" TEXT NOT NULL DEFAULT '',
    "grade" INTEGER,
    "feedback" TEXT NOT NULL DEFAULT '',
    "gradedAt" DATETIME,
    CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Assignment_courseId_idx" ON "Assignment"("courseId");

-- CreateIndex
CREATE INDEX "Assignment_teacherId_idx" ON "Assignment"("teacherId");

-- CreateIndex
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");

-- CreateIndex
CREATE INDEX "Submission_assignmentId_idx" ON "Submission"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_assignmentId_studentId_key" ON "Submission"("assignmentId", "studentId");
