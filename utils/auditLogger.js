const db = require("../models");
const AuditLog = db.auditLog;
const logger = require("./logger");

const CATEGORIES = {
    AUTH: "AUTH",
    CAROUSEL: "CAROUSEL",
    SETTINGS: "SETTINGS",
    USER_MGMT: "USER_MGMT",
    OPCUA: "OPCUA",
    SYSTEM: "SYSTEM"
};

function extractClientIp(req) {
    if (!req) return null;
    let ip = req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || req.ip || null;
    if (ip && typeof ip === "string") {
        if (ip.includes(",")) {
            ip = ip.split(",")[0].trim();
        }
        if (ip.startsWith("::ffff:")) {
            ip = ip.substring(7);
        }
    }
    return ip;
}

async function log({
    req = null,
    userId = null,
    username = null,
    role = null,
    action,
    category = "GENERAL",
    target = null,
    details = null,
    ipAddress = null,
    userAgent = null
}) {
    try {
        let finalIp = ipAddress || extractClientIp(req);
        let finalUa = userAgent || (req && req.headers ? req.headers["user-agent"] : null);
        let finalUserId = userId || (req ? req.userId : null);
        let finalUsername = username || (req ? req.username : null) || "Anonymous";
        let finalRole = role || (req ? (req.userRole || (req.userRoles ? req.userRoles.join(", ") : null)) : null);

        let detailsStr = details;
        if (details !== null && typeof details === "object") {
            try {
                detailsStr = JSON.stringify(details);
            } catch (e) {
                detailsStr = String(details);
            }
        } else if (details !== null && details !== undefined) {
            detailsStr = String(details);
        }

        const entry = await AuditLog.create({
            userId: finalUserId,
            username: finalUsername,
            role: finalRole,
            action: String(action || "UNKNOWN"),
            category: String(category || "GENERAL"),
            target: target ? String(target) : null,
            details: detailsStr,
            ipAddress: finalIp,
            userAgent: finalUa ? finalUa.substring(0, 255) : null
        });

        // Broadcast real-time event to connected Socket.IO clients
        if (global.scadaIo) {
            try {
                global.scadaIo.emit("new-audit-log", entry.toJSON());
            } catch (ioErr) {
                // Ignore socket emit errors
            }
        }

        // Also record to system logger
        logger.info("AUDIT", `[${category}] ${finalUsername} (${finalRole || "N/A"}) -> ${action} ${target ? "[" + target + "]" : ""}: ${detailsStr || ""}`);

        return entry;
    } catch (err) {
        logger.error("AUDIT", `Failed to record audit log: ${err.message}`);
        return null;
    }
}

module.exports = {
    log,
    CATEGORIES
};
