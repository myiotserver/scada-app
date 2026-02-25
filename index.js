const express = require('express');
const cors = require('cors');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const logger = require('./utils/logger');

// Parse requests of content-type - application/json
app.use(express.json());
// Parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));

// Download route for OPC-UA client certificate (needed for KEPServer trust)
app.get('/download/client-cert', (req, res) => {
    const certPath = require('path').join(__dirname, 'pki', 'own', 'certs', 'client_certificate.pem');
    const derPath = require('path').join(__dirname, 'public', 'client_certificate.der');
    const format = req.query.format || 'der';
    const filePath = format === 'pem' ? certPath : derPath;
    res.download(filePath, `client_certificate.${format}`);
});

const db = require("./models");
const Role = db.role;

// Force sync to create tables (DROP and CREATE) - user 'sync' only for prod
// For initial setup we use force: true to drop and re-create
db.sequelize.sync({ force: false }).then(() => {
    console.log('Drop and Resync Db');
    initial();
});

function initial() {
    Role.findOrCreate({ where: { id: 1, name: "user" } });
    Role.findOrCreate({ where: { id: 2, name: "moderator" } });
    Role.findOrCreate({ where: { id: 3, name: "admin" } });
    Role.findOrCreate({ where: { id: 4, name: "guest" } });
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Routes
require('./routes/auth.routes')(app);
require('./routes/user.routes')(app);
require('./routes/scada.routes')(app);
require('./routes/settings.routes')(app);
require('./routes/opcua.routes')(app);
const scadaController = require("./controllers/scada.controller");
const opcuaManager = require("./utils/opcua.manager");
const scadaSim = scadaController.scadaSim;

io.on('connection', (socket) => {
    logger.info('SYSTEM', `User connected to SCADA dashboard (${socket.id})`);

    // Send initial state
    socket.emit('init', scadaController.getSnapshot());

    // Subscribe this socket to simulator/config updates
    const subscriptionId = `socket-${socket.id}`;
    scadaController.subscribe(subscriptionId, (data) => {
        if (data.type === 'config-loading') {
            socket.emit('config-loading', data.loading);
        } else {
            socket.emit('carousel-update', data);
        }
    });

    const alertSubscriptionId = `alert-${socket.id}`;
    scadaController.subscribeAlerts(alertSubscriptionId, (alertData) => {
        socket.emit('scada-alert', alertData);
    });

    // Subscribe to OPC-UA events
    const opcuaSubId = `opcua-${socket.id}`;
    opcuaManager.subscribe(opcuaSubId, (event, data) => {
        socket.emit(event, data);
    });
    socket.emit('opcua-status', opcuaManager.getStatus());

    // Subscribe to SQL status changes
    const sqlSubId = `sql-${socket.id}`;
    scadaController.subscribeSqlStatus(sqlSubId, (status) => {
        socket.emit('sql-status', status);
    });

    // Subscribe to system logs (real-time)
    const logSubId = `log-${socket.id}`;
    logger.subscribe(logSubId, (entry) => {
        socket.emit('system-log', entry);
    });

    socket.on('disconnect', () => {
        logger.info('SYSTEM', `User disconnected (${socket.id})`);
        scadaController.unsubscribe(subscriptionId);
        scadaController.unsubscribeAlerts(alertSubscriptionId);
        opcuaManager.unsubscribe(opcuaSubId);
        scadaController.unsubscribeSqlStatus(sqlSubId);
        logger.unsubscribe(logSubId);
    });
});

app.get('/api/opcua/status', (req, res) => res.json(opcuaManager.getStatus()));
app.post('/api/opcua/connect', async (req, res) => res.json(await opcuaManager.connect()));
app.post('/api/opcua/disconnect', async (req, res) => res.json(await opcuaManager.disconnect()));

// Settings & Control
app.get('/api/settings', (req, res) => {
    res.json(require('./config/scada-settings.json'));
});
app.get('/api/sql/status', scadaController.getSqlStatus);
app.post('/api/control', scadaController.controlCarousel);
app.post('/api/control/reset-error', scadaController.resetErrorTag);

// System Logs API
app.get('/api/logs', (req, res) => {
    const filters = {};
    if (req.query.level) filters.level = req.query.level;
    if (req.query.source) filters.source = req.query.source;
    res.json(logger.getHistory(filters));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    logger.info('SYSTEM', `Server listening on port ${PORT}`);
    opcuaManager.autoConnect();
});
