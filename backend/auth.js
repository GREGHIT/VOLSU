const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');
const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = { signToken, hashPassword, verifyPassword };
