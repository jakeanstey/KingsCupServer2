const path = require('path');
const fs = require('fs');
const port = process.env.PORT || 8080;
const express = require('express');
const http = require('http');
const https = require('https');
const app = express();
const socketIO = require('socket.io');
const { ExpressPeerServer } = require('peer');

const secureServer = https.createServer({
    key: fs.readFileSync('data/server.key'),
    cert: fs.readFileSync('data/server.cert'),
    ca: fs.readFileSync('data/server.ca-bundle'),
    requestCert: false,
    rejectUnauthorized: false
}, app);

const server = http.createServer(app).listen(port);

secureServer.listen(443, () => {
    console.log('listening https');
});

const io = socketIO(secureServer).sockets;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    console.log('website reached')
    res.sendFile(path.join(__dirname, 'index.html'));
  });


const peerServer = ExpressPeerServer(server, { 
    path: '/',
    debug: true
});

let players = [];

app.use('/peer', peerServer);

io.on('connection', socket =>
{
    console.log('connected');
    socket.on('join-game', (username, gender, roomCode, peerID) =>
    {
        console.log(roomCode);
        players = [...players, { username, gender, peerID }];
        socket.join('ASDF');
        socket.to('ASDF').broadcast.emit('user-joined', username, peerID);
    });
});

