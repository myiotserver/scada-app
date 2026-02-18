const express = require('express');
const cors = require('cors');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

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
    console.log('User connected to SCADA dashboard');

    // Send initial state
    socket.emit('init', scadaController.getSnapshot());

    // Subscribe this socket to simulator updates
    const subscriptionId = `socket-${socket.id}`;
    scadaController.subscribe(subscriptionId, (updates) => {
        socket.emit('carousel-update', updates);
    });

    // Subscribe to OPC-UA events
    const opcuaSubId = `opcua-${socket.id}`;
    opcuaManager.subscribe(opcuaSubId, (event, data) => {
        socket.emit(event, data);
    });
    socket.emit('opcua-status', opcuaManager.getStatus());

    socket.on('disconnect', () => {
        console.log('User disconnected');
        scadaController.unsubscribe(subscriptionId);
        opcuaManager.unsubscribe(opcuaSubId);
    });
});

app.get('/api/opcua/status', (req, res) => res.json(opcuaManager.getStatus()));
app.post('/api/opcua/connect', async (req, res) => res.json(await opcuaManager.connect()));
app.post('/api/opcua/disconnect', async (req, res) => res.json(await opcuaManager.disconnect()));

// Settings & Control
app.get('/api/settings', (req, res) => {
    // ... setting get logic ...
    res.json(require('./config/scada-settings.json'));
});
app.get('/api/sql/status', scadaController.getSqlStatus);
app.post('/api/control', scadaController.controlCarousel);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
    opcuaManager.autoConnect();
});
