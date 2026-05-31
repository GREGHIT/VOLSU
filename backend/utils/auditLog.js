const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const dataDir = path.join(__dirname, "..", "data");
const auditFile = path.join(dataDir, "audit-log.json");

async function ensureAuditStorage() {
  await fsp.mkdir(dataDir, { recursive: true });
  if (!fs.existsSync(auditFile)) {
    await fsp.writeFile(auditFile, "[]", "utf8");
  }
}

async function readAuditLog() {
  await ensureAuditStorage();
  const raw = await fsp.readFile(auditFile, "utf8");
  return JSON.parse(raw || "[]");
}

async function writeAuditLog(entries) {
  await ensureAuditStorage();
  await fsp.writeFile(auditFile, JSON.stringify(entries, null, 2), "utf8");
}

async function appendAuditEntry(entry) {
  const entries = await readAuditLog();
  entries.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...entry,
  });
  await writeAuditLog(entries);
}

async function listAuditEntries(filters = {}) {
  const entries = await readAuditLog();
  return entries
    .filter((entry) => {
      if (filters.entityType && entry.entityType !== filters.entityType) return false;
      if (filters.entityId != null && String(entry.entityId) !== String(filters.entityId)) return false;
      if (filters.courseId != null && String(entry.courseId) !== String(filters.courseId)) return false;
      if (filters.actorId != null && String(entry.actorId) !== String(filters.actorId)) return false;
      if (filters.action && entry.action !== filters.action) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  appendAuditEntry,
  listAuditEntries,
};
