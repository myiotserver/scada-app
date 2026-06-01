const crypto = require('crypto');

// Use JWT_SECRET env var if available, otherwise generate a strong random secret
// To persist across restarts, set JWT_SECRET in your environment:
//   export JWT_SECRET="your-strong-secret-here"
const secret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

if (!process.env.JWT_SECRET) {
    console.warn('');
    console.warn('═══════════════════════════════════════════════════════════════');
    console.warn('  [SECURITY WARNING] JWT_SECRET not set in environment');
    console.warn('═══════════════════════════════════════════════════════════════');
    console.warn('  • Using auto-generated secret (sessions will be lost on restart)');
    console.warn('  • Set JWT_SECRET environment variable for persistent sessions');
    console.warn('  • Example: export JWT_SECRET="your-strong-random-secret-here"');
    console.warn('═══════════════════════════════════════════════════════════════');
    console.warn('');
}

module.exports = {
    secret: secret
};

