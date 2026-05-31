-- CreateTable
CREATE TABLE "Test" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "courseId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    CONSTRAINT "Test_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Test_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "testId" INTEGER NOT NULL,
    CONSTRAINT "Question_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Option" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "questionId" INTEGER NOT NULL,
    CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "score" INTEGER NOT NULL DEFAULT 0,
    "maxScore" INTEGER NOT NULL DEFAULT 0,
    "testId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    CONSTRAINT "Attempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "textAnswer" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnswerSelection" (
    "answerId" INTEGER NOT NULL,
    "optionId" INTEGER NOT NULL,

    PRIMARY KEY ("answerId", "optionId"),
    CONSTRAINT "AnswerSelection_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnswerSelection_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Test_courseId_idx" ON "Test"("courseId");

-- CreateIndex
CREATE INDEX "Test_teacherId_idx" ON "Test"("teacherId");

-- CreateIndex
CREATE INDEX "Question_testId_idx" ON "Question"("testId");

-- CreateIndex
CREATE INDEX "Option_questionId_idx" ON "Option"("questionId");

-- CreateIndex
CREATE INDEX "Attempt_testId_idx" ON "Attempt"("testId");

-- CreateIndex
CREATE INDEX "Attempt_studentId_idx" ON "Attempt"("studentId");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE INDEX "Answer_attemptId_idx" ON "Answer"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_attemptId_questionId_key" ON "Answer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "AnswerSelection_optionId_idx" ON "AnswerSelection"("optionId");
