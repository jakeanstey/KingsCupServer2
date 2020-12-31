
const express = require('express');
const http = require('http');
const https = require('https');
const socketIO = require('socket.io');
const { ExpressPeerServer } = require('peer');
const path = require('path');
const fs = require('fs');
const port = process.env.PORT || 8080;

const app = express();

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

const server = http.createServer(app).listen(port);

const secureServer = https.createServer({
    key: fs.readFileSync('data/server.key'),
    cert: fs.readFileSync('data/server.cert')},
    app);

const io = socketIO(secureServer).sockets;
const peerServer = ExpressPeerServer(server, { 
    path: '/',
    debug: true
});

let players = [];

app.use('/peer', peerServer);

io.on('connection', socket =>
{
    socket.on('join-game', (username, gender, roomCode, peerID) =>
    {
        console.log(roomCode);
        players = [...players, { username, gender, peerID }];
        socket.join('ASDF');
        socket.to('ASDF').broadcast.emit('user-joined', username, peerID);
    });
});

secureServer.listen(443, () => {
    console.log('listening https');
});