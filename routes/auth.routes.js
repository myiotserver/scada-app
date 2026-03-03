const { verifySignUp, authJwt } = require("../middleware");
const controller = require("../controllers/auth.controller");

// Simple in-memory rate limiter: max 10 attempts per 15 minutes per IP
const loginAttempts = new Map();
const RATE_LIMIT = {
    MAX_ATTEMPTS: 10,
    WINDOW_MS: 15 * 60 * 1000  // 15 minutes
};

function cleanupExpiredEntries() {
    const now = Date.now();
    for (const [ip, data] of loginAttempts.entries()) {
        if (now - data.firstAttempt > RATE_LIMIT.WINDOW_MS) {
            loginAttempts.delete(ip);
        }
    }
}

// Cleanup expired entries every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

function signinRateLimiter(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    const record = loginAttempts.get(ip);

    if (record) {
        // Reset window if expired
        if (now - record.firstAttempt > RATE_LIMIT.WINDOW_MS) {
            loginAttempts.set(ip, { count: 1, firstAttempt: now });
            return next();
        }
        // Check limit
        if (record.count >= RATE_LIMIT.MAX_ATTEMPTS) {
            const retryAfterSec = Math.ceil((RATE_LIMIT.WINDOW_MS - (now - record.firstAttempt)) / 1000);
            return res.status(429).json({
                message: `Too many login attempts. Try again in ${Math.ceil(retryAfterSec / 60)} minute(s).`
            });
        }
        record.count++;
    } else {
        loginAttempts.set(ip, { count: 1, firstAttempt: now });
    }
    next();
}

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // Signup restricted to admin users only
    app.post(
        "/api/auth/signup",
        [
            authJwt.verifyToken,
            authJwt.isAdmin,
            verifySignUp.checkDuplicateUsernameOrEmail,
            verifySignUp.checkRolesExisted
        ],
        controller.signup
    );

    // Signin with rate limiting: max 10 attempts per 15 minutes per IP
    app.post("/api/auth/signin", signinRateLimiter, controller.signin);
};

