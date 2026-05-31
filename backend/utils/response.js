function ok(res, payload = {}, status = 200) {
  return res.status(status).json({ ok: true, ...payload });
}

function error(res, status, message, details = {}) {
  return res.status(status).json({
    ok: false,
    error: message,
    message,
    ...details,
  });
}

function paginated(items, page = 1, pageSize = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 20));
  const total = Array.isArray(items) ? items.length : 0;
  const startIndex = (safePage - 1) * safePageSize;
  const data = Array.isArray(items) ? items.slice(startIndex, startIndex + safePageSize) : [];

  return {
    data,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
      hasNextPage: startIndex + safePageSize < total,
      hasPrevPage: safePage > 1,
    },
  };
}

module.exports = {
  ok,
  error,
  paginated,
};
