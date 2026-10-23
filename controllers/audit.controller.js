const db = require("../models");
const AuditLog = db.auditLog;
const { Op } = db.Sequelize;

exports.getAuditLogs = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(10, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        const where = {};

        // Category filter
        if (req.query.category && req.query.category.trim() !== "") {
            where.category = req.query.category.trim();
        }

        // Action filter
        if (req.query.action && req.query.action.trim() !== "") {
            where.action = req.query.action.trim();
        }

        // Target filter (e.g. CR1, CR2)
        if (req.query.target && req.query.target.trim() !== "") {
            where.target = { [Op.iLike]: `%${req.query.target.trim()}%` };
        }

        // Username filter
        if (req.query.username && req.query.username.trim() !== "") {
            where.username = { [Op.iLike]: `%${req.query.username.trim()}%` };
        }

        // Date range
        if (req.query.startDate || req.query.endDate) {
            where.createdAt = {};
            if (req.query.startDate) {
                const sDate = new Date(req.query.startDate);
                sDate.setHours(0, 0, 0, 0);
                where.createdAt[Op.gte] = sDate;
            }
            if (req.query.endDate) {
                const eDate = new Date(req.query.endDate);
                eDate.setHours(23, 59, 59, 999);
                where.createdAt[Op.lte] = eDate;
            }
        }

        // General search term across username, details, target
        if (req.query.search && req.query.search.trim() !== "") {
            const term = `%${req.query.search.trim()}%`;
            where[Op.or] = [
                { username: { [Op.iLike]: term } },
                { details: { [Op.iLike]: term } },
                { target: { [Op.iLike]: term } },
                { action: { [Op.iLike]: term } }
            ];
        }

        const { count, rows } = await AuditLog.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            limit,
            offset
        });

        res.json({
            success: true,
            total: count,
            totalPages: Math.ceil(count / limit) || 1,
            currentPage: page,
            limit,
            logs: rows
        });
    } catch (err) {
        console.error("Error retrieving audit logs:", err);
        res.status(500).json({ error: "Failed to retrieve audit logs: " + err.message });
    }
};

exports.getAuditStats = async (req, res) => {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [todayTotal, todayAuth, todayControl, todaySettings] = await Promise.all([
            AuditLog.count({ where: { createdAt: { [Op.gte]: startOfToday } } }),
            AuditLog.count({ where: { createdAt: { [Op.gte]: startOfToday }, category: "AUTH" } }),
            AuditLog.count({ where: { createdAt: { [Op.gte]: startOfToday }, category: "CAROUSEL" } }),
            AuditLog.count({ where: { createdAt: { [Op.gte]: startOfToday }, category: "SETTINGS" } })
        ]);

        res.json({
            success: true,
            stats: {
                todayTotal,
                todayAuth,
                todayControl,
                todaySettings
            }
        });
    } catch (err) {
        console.error("Error retrieving audit stats:", err);
        res.status(500).json({ error: "Failed to retrieve audit stats" });
    }
};

exports.exportAuditLogs = async (req, res) => {
    try {
        const where = {};

        if (req.query.category && req.query.category.trim() !== "") {
            where.category = req.query.category.trim();
        }
        if (req.query.target && req.query.target.trim() !== "") {
            where.target = { [Op.iLike]: `%${req.query.target.trim()}%` };
        }
        if (req.query.username && req.query.username.trim() !== "") {
            where.username = { [Op.iLike]: `%${req.query.username.trim()}%` };
        }
        if (req.query.startDate || req.query.endDate) {
            where.createdAt = {};
            if (req.query.startDate) {
                const sDate = new Date(req.query.startDate);
                sDate.setHours(0, 0, 0, 0);
                where.createdAt[Op.gte] = sDate;
            }
            if (req.query.endDate) {
                const eDate = new Date(req.query.endDate);
                eDate.setHours(23, 59, 59, 999);
                where.createdAt[Op.lte] = eDate;
            }
        }

        const rows = await AuditLog.findAll({
            where,
            order: [["createdAt", "DESC"]],
            limit: 5000 // reasonable ceiling for CSV export
        });

        const escapeCsv = (str) => {
            if (str === null || str === undefined) return '""';
            const s = String(str).replace(/"/g, '""');
            return `"${s}"`;
        };

        const headers = ["ID", "Timestamp (WIB)", "Username", "Role", "Category", "Action", "Target", "Details", "IP Address", "User Agent"];
        const csvLines = [headers.join(",")];

        for (const row of rows) {
            const timeStr = new Date(row.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
            csvLines.push([
                row.id,
                escapeCsv(timeStr),
                escapeCsv(row.username),
                escapeCsv(row.role || "-"),
                escapeCsv(row.category),
                escapeCsv(row.action),
                escapeCsv(row.target || "-"),
                escapeCsv(row.details || "-"),
                escapeCsv(row.ipAddress || "-"),
                escapeCsv(row.userAgent || "-")
            ].join(","));
        }

        const csvContent = "\uFEFF" + csvLines.join("\r\n");
        const filename = `scada_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`;

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.status(200).send(csvContent);
    } catch (err) {
        console.error("Error exporting audit logs:", err);
        res.status(500).json({ error: "Failed to export audit logs" });
    }
};
