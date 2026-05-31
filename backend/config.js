const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
}

module.exports = { JWT_SECRET };
