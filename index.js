
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { ExpressPeerServer } = require('peer');
const path = require('path');

const app = express();

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

const server = http.createServer(app);
const io = socketIO(server).sockets;
const peerServer = ExpressPeerServer(server, { debug: true, path: '/' });

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


const port = process.env.PORT || 8080;

server.listen(port, () => console.log("Server started"));