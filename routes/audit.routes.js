const { authJwt } = require("../middleware");
const controller = require("../controllers/audit.controller");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // List audit logs (accessible by Admin only)
    app.get(
        "/api/audit-logs",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.getAuditLogs
    );

    // Get audit quick statistics
    app.get(
        "/api/audit-logs/stats",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.getAuditStats
    );

    // Export audit logs as CSV
    app.get(
        "/api/audit-logs/export",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.exportAuditLogs
    );
};
