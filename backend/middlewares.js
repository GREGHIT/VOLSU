const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');

async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, error: 'missing bearer token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const prisma = req.app?.locals?.prisma;

    if (payload?.email && prisma) {
      const byId = Number.isInteger(payload.sub)
        ? await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, role: true, email: true, permissionsJson: true, accessSystemsJson: true, managedGroupIdsJson: true },
          })
        : null;

      if (!byId || String(byId.email).toLowerCase() !== String(payload.email).toLowerCase()) {
        const byEmail = await prisma.user.findUnique({
          where: { email: String(payload.email).toLowerCase() },
          select: { id: true, role: true, email: true, permissionsJson: true, accessSystemsJson: true, managedGroupIdsJson: true },
        });

        if (!byEmail) {
          return res.status(401).json({ ok: false, error: 'user session is outdated, please sign in again' });
        }

        req.auth = {
          ...payload,
          sub: byEmail.id,
          role: byEmail.role,
          email: byEmail.email,
          permissions: safeParseJsonArray(byEmail.permissionsJson),
          accessSystems: safeParseJsonArray(byEmail.accessSystemsJson),
          managedGroupIds: safeParseJsonNumberArray(byEmail.managedGroupIdsJson),
        };
        return next();
      }

      req.auth = {
        ...payload,
        sub: byId.id,
        role: byId.role,
        email: byId.email,
        permissions: safeParseJsonArray(byId.permissionsJson),
        accessSystems: safeParseJsonArray(byId.accessSystemsJson),
        managedGroupIds: safeParseJsonNumberArray(byId.managedGroupIdsJson),
      };
      return next();
    }

    req.auth = payload; // { sub, role, email, iat, exp }
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: 'invalid token' });
  }
}

function safeParseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
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

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.auth?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    return next();
  };
}

function requireCapability({ roles = [], permissions = [] } = {}) {
  return (req, res, next) => {
    const role = req.auth?.role;
    const grantedPermissions = req.auth?.permissions || [];
    if (role && roles.includes(role)) return next();
    if (permissions.some((permission) => grantedPermissions.includes(permission))) return next();
    return res.status(403).json({ ok: false, error: "forbidden" });
  };
}

module.exports = { authRequired, requireRole, requireCapability };
