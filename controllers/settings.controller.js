const fs = require("fs");
const path = require("path");
const scadaController = require("./scada.controller");
const auditLogger = require("../utils/auditLogger");
const db = require("../models");
const User = db.user;
const bcrypt = require("bcrypt");

const settingsPath = path.join(__dirname, "../config/scada-settings.json");

exports.getSettings = (req, res) => {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, "utf8");
            res.json(JSON.parse(data));
        } else {
            res.status(404).json({ message: "Settings file not found" });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { confirmationPassword, ...newSettings } = req.body;

        // 1. Password verification check
        if (!confirmationPassword) {
            return res.status(401).json({ message: "Password konfirmasi akun diperlukan untuk menyimpan perubahan." });
        }

        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User tidak ditemukan." });
        }

        const isPasswordValid = bcrypt.compareSync(confirmationPassword, user.password);
        if (!isPasswordValid) {
            auditLogger.log({
                req,
                userId: user.id,
                username: user.username,
                action: "SETTINGS_CONFIRM_FAILED",
                category: "SETTINGS",
                target: "Config Menu",
                details: "Gagal konfirmasi password: Password yang dimasukkan salah"
            });
            return res.status(401).json({ message: "Password salah! Perubahan dibatalkan." });
        }

        // Validate basic structure if needed
        if (!newSettings.sql_server) {
            return res.status(400).json({ message: "Invalid settings data" });
        }

        let oldSettings = {};
        if (fs.existsSync(settingsPath)) {
            try {
                oldSettings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
            } catch (e) {}
        }

        const mergedSettings = {
            ...oldSettings,
            ...newSettings
        };
        if (newSettings.interlocks) {
            mergedSettings.interlocks = { ...(oldSettings.interlocks || {}), ...newSettings.interlocks };
        }
        if (newSettings.deviationThresholds) {
            mergedSettings.deviationThresholds = { ...(oldSettings.deviationThresholds || {}), ...newSettings.deviationThresholds };
        }

        fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 4));

        // Audit Trail: Detect specific changes
        let loggedSpecific = false;

        // 1. Interlock changes
        if (newSettings.interlocks && oldSettings.interlocks) {
            for (let i = 1; i <= 5; i++) {
                const key = `carousel${i}`;
                const oldVal = !!oldSettings.interlocks[key];
                const newVal = !!newSettings.interlocks[key];
                if (oldVal !== newVal) {
                    loggedSpecific = true;
                    auditLogger.log({
                        req,
                        action: "INTERLOCK_TOGGLE",
                        category: "SETTINGS",
                        target: `CR${i}`,
                        details: `Underweight Interlock diubah dari ${oldVal ? "ON" : "OFF"} ke ${newVal ? "ON" : "OFF"} (Dikonfirmasi dengan password)`
                    });
                }
            }
        }

        // 2. Deviation Threshold changes
        if (newSettings.deviationThresholds && oldSettings.deviationThresholds) {
            for (let i = 1; i <= 5; i++) {
                const key = `carousel${i}`;
                const oldVal = oldSettings.deviationThresholds[key];
                const newVal = newSettings.deviationThresholds[key];
                if (oldVal !== undefined && newVal !== undefined && parseFloat(oldVal) !== parseFloat(newVal)) {
                    loggedSpecific = true;
                    auditLogger.log({
                        req,
                        action: "DEVIATION_UPDATE",
                        category: "SETTINGS",
                        target: `CR${i}`,
                        details: `Batas deviasi diubah dari ${oldVal} Kg ke ${newVal} Kg (Dikonfirmasi dengan password)`
                    });
                }
            }
        }

        // 3. Database connection parameters
        const sqlChanged = oldSettings.sql_server !== newSettings.sql_server ||
                           oldSettings.sql_db !== newSettings.sql_db ||
                           oldSettings.sql_uid !== newSettings.sql_uid ||
                           oldSettings.sql_port !== newSettings.sql_port;
        if (sqlChanged) {
            loggedSpecific = true;
            auditLogger.log({
                req,
                action: "SQL_CONFIG_UPDATE",
                category: "SETTINGS",
                target: "MSSQL Database",
                details: `MSSQL configuration updated: Server=${newSettings.sql_server}:${newSettings.sql_port || 1433}, DB=${newSettings.sql_db} (Dikonfirmasi dengan password)`
            });
        }

        // 4. Fallback if general update without individual diffs
        if (!loggedSpecific) {
            auditLogger.log({
                req,
                action: "SETTINGS_UPDATE",
                category: "SETTINGS",
                target: "SCADA Settings",
                details: "Menyimpan pengaturan SCADA (Dikonfirmasi dengan password)"
            });
        }

        // Trigger DB Reconnection in SCADA Controller
        scadaController.reloadSettings();

        res.json({ message: "Pengaturan berhasil diperbarui." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};
