const fs = require('fs');
const path = require('path');
const { buildMssqlConfig } = require('./db.helper');

const settingsPath = path.join(__dirname, 'scada-settings.json');

function loadSettings() {
    try {
        if (!fs.existsSync(settingsPath)) return {};
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (err) {
        console.warn('[db.config.weighing] Failed to read scada-settings.json:', err.message);
        return {};
    }
}

function buildConfig() {
    const settings = loadSettings();
    return buildMssqlConfig({ settings });
}

module.exports = buildConfig();
module.exports.getConfig = buildConfig;
