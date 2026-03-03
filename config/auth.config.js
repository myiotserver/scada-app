const crypto = require('crypto');

// Use JWT_SECRET env var if available, otherwise generate a strong random secret
// To persist across restarts, set JWT_SECRET in your environment:
//   export JWT_SECRET="your-strong-secret-here"
const secret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

if (!process.env.JWT_SECRET) {
    console.warn('[SECURITY] JWT_SECRET not set in environment. Using auto-generated secret.');
    console.warn('[SECURITY] Sessions will be invalidated on server restart.');
    console.warn('[SECURITY] Set JWT_SECRET env var for persistent sessions.');
}

module.exports = {
    secret: secret
};

