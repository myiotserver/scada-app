require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
const logger = require('./utils/logger');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const authConfig = require('./config/auth.config');

// Parse requests of content-type - application/json
app.use(express.json());
// Parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));
app.use('/vendor/sweetalert2', express.static(path.join(__dirname, 'node_modules', 'sweetalert2', 'dist')));

// Download route for OPC-UA client certificate (needed for KEPServer trust)
app.get('/download/client-cert', (req, res) => {
    const certPath = path.join(__dirname, 'pki', 'own', 'certs', 'client_certificate.pem');
    const derPath = path.join(__dirname, 'public', 'client_certificate.der');
    const format = req.query.format || 'der';
    const filePath = format === 'pem' ? certPath : derPath;
    res.download(filePath, `client_certificate.${format}`);
});

const db = require("./models");
const Role = db.role;
const User = db.user;

// Force sync to create tables (DROP and CREATE) - user 'sync' only for prod
// For initial setup we use force: true to drop and re-create
db.sequelize.sync({ force: false }).then(async () => {
    console.log('Drop and Resync Db');
    await initial();
}).catch((err) => {
    logger.error('AUTH', `Database sync failed: ${err.message}`);
});

async function initial() {
    await Role.findOrCreate({ where: { id: 1, name: "user" } });
    await Role.findOrCreate({ where: { id: 2, name: "moderator" } });
    await Role.findOrCreate({ where: { id: 3, name: "admin" } });
    await Role.findOrCreate({ where: { id: 4, name: "guest" } });
    await ensureDefaultAdmin();
}

async function ensureDefaultAdmin() {
    if (process.env.SCADA_AUTO_SEED_ADMIN === 'false') {
        logger.info('AUTH', 'Default admin auto-seed disabled by SCADA_AUTO_SEED_ADMIN=false.');
        return;
    }

    const userCount = await User.count();
    if (userCount > 0) {
        return;
    }

    const adminRole = await Role.findOne({ where: { name: 'admin' } });
    if (!adminRole) {
        logger.warn('AUTH', 'Admin role not found, skipping default admin creation.');
        return;
    }

    const username = process.env.SCADA_DEFAULT_ADMIN_USER || 'admin';
    const email = process.env.SCADA_DEFAULT_ADMIN_EMAIL || 'admin@scada.local';
    const password = process.env.SCADA_DEFAULT_ADMIN_PASSWORD || '12345678';

    const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    if (isProduction && password === '12345678') {
        logger.error('AUTH', 'Refusing startup: SCADA_DEFAULT_ADMIN_PASSWORD is still default in production.');
        logger.error('AUTH', 'Set SCADA_DEFAULT_ADMIN_PASSWORD to a strong value or disable auto-seed with SCADA_AUTO_SEED_ADMIN=false.');
        process.exit(1);
    }

    const user = await User.create({
        username,
        email,
        password: bcrypt.hashSync(password, 8)
    });

    await user.setRoles([adminRole]);
    logger.warn('AUTH', `Default admin user created on startup: ${username}. Change password after first login.`);
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

// Socket.IO authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
        return next(new Error('Authentication required'));
    }
    jwt.verify(token, authConfig.secret, (err, decoded) => {
        if (err) {
            return next(new Error('Invalid token'));
        }
        socket.userId = decoded.id;
        next();
    });
});

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

// NOTE: OPC-UA, Settings, and Control routes are handled in their respective
// route files with proper auth middleware. Do NOT add duplicate routes here.

// System Logs API (protected)
const { authJwt } = require('./middleware');
app.get('/api/logs', [authJwt.verifyToken], (req, res) => {
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
