const fs = require('fs');
const path = require('path');
const scadaController = require('./scada.controller');

const settingsPath = path.join(__dirname, '../config/scada-settings.json');

exports.getSettings = (req, res) => {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.status(404).json({ message: "Settings file not found" });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateSettings = (req, res) => {
    try {
        const newSettings = req.body;

        // Validate basic structure if needed
        if (!newSettings.sql_server) {
            return res.status(400).json({ message: "Invalid settings data" });
        }

        fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 4));

        // Trigger DB Reconnection in SCADA Controller
        scadaController.reloadSettings();

        res.json({ message: "Settings updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};
