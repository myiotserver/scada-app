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


io.on('connection', (socket) => {
    console.log('a user connected');

    // Simulate SCADA Data
    setInterval(() => {
        const data = {
            pressure: (Math.random() * 10 + 20).toFixed(2), // 20-30 bar
            temperature: (Math.random() * 5 + 60).toFixed(1), // 60-65 C
            flowRate: (Math.floor(Math.random() * 100) + 500), // 500-600 L/h
            status: Math.random() > 0.9 ? 'WARNING' : 'NORMAL'
        };
        socket.emit('scada-update', data);
    }, 1000);
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});
