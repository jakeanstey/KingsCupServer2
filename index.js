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

app.use('/peer', peerServer);

/// GAME LOGIC ///
let rooms = {};
const Deck = require('./Deck');
const bank = 'abcdefghijklmnopqrstuvwxyz1234567890';

io.on('connection', socket =>
{
    socket.on('join-game', (username, gender, roomCode, peerID) =>
    {
        /// debug constant
        roomCode = strip(roomCode);
        
        let room = rooms[roomCode];
        if(room === undefined || room === null)
        {
            room = {
                players: [{ username: strip(username), gender, peerID, socket }],
                state: 0,
                turnIndex: 1,
                deck: new Deck(),
                votes: [],
                dates: {}, // object of peer id to array of peer ids
                queue: [],
                neverHaveIEverTurnIndex: 0,
                neverHaveIEver: {},
                neverHaveIEverCount: 0,
                rockPaperscissorsMoves: [],
                lastToTap: 0
            };
            rooms[roomCode] = room;
            console.log('room', roomCode, 'created');
        }
        else
        {
            room.players = [...room.players, { username, gender, peerID, socket }];
        }

        socket.join(roomCode);
        socket.to(roomCode).broadcast.emit('user-joined', username, peerID);
        console.log('player', peerID, 'joined', roomCode);

        socket.on('start-game', () =>
        {
            if(room.players.length > 1)
            {
                console.log('starting game in room', roomCode);
                io.in(roomCode).emit('game-started');
                room.state = 1;
                broadcastCurrentPlayer();
            }
        });

        socket.on('pause-game', () =>
        {
            console.log('room', roomCode, 'paused');
            socket.to(roomCode).broadcast.emit('game-paused');
            room.state = 0;
        });

        socket.on('resume-game', () =>
        {
            console.log('room', roomCode, 'resumed');
            socket.to(roomCode).broadcast.emit('game-resumed');
            room.state = 1;
        });

        socket.on('end-turn', () =>
        {
            if(room.state === 1)
            {
                room.votes = [];
                room.turnIndex = (room.turnIndex + 1) % room.players.length;
                room.rockPaperscissorsMoves = [];
                room.lastToTap = 0;
                broadcastCurrentPlayer();
            }
        });

        socket.on('pick-card', () =>
        {
            if(room.state === 1)
            {
                const card = JSON.stringify(room.deck.dealCard());
                io.in(roomCode).emit('card-dealt', card, room.players[room.turnIndex].username);
            }
        });

        socket.on('vote', (peerID, username) =>
        {
            const playerCount = room.players.length;
            room.votes = [...room.votes, {peerID, username}];
            console.log(username, 'was voted for');

            if(room.votes.length === playerCount)
            {
                let tally = {};
                
                for(let i = 0; i < playerCount; i++)
                {
                    const player = room.votes[i];
                    if(tally[player.peerID] !== undefined)
                    {
                        tally[player.peerID]++;
                    }
                    else
                    {
                        tally[player.peerID] = 1;
                    }
                }

                let maxCount = 0;
                let winner = null;
                for(let i = 0; i < playerCount; i++)
                {
                    const player = room.players[i];
                    if(tally[player.peerID] !== undefined)
                    {
                        if(tally[player.peerID] > maxCount)
                        {
                            winner = {username: player.username, peerID: player.peerID};
                        }
                    }
                }

                io.in(roomCode).emit('player-voted', winner.peerID, winner.username);
                room.votes = [];
            }
        });

        socket.on('two-for-you', (peerID, username) =>
        {
            if(room.state === 1)
            {
                io.in(roomCode).emit('drink', peerID, username, 'two-for-you');
            }
        });

        socket.on('choose-date', (myPeerID, myUsername, peerID, username) =>
        {
            if(room.dates[myPeerID] === undefined || room.dates[myPeerID] === null)
            {
                room.dates[myPeerID] = [peerID];
            }
            else
            {
                room.dates[myPeerID] = [...room.dates[myPeerID], peerID];
            }

            io.in(roomCode).emit('date-added', myPeerID, myUsername, peerID, username);
        });

        socket.on('notify-dates-to-drink', (peerID, username) =>
        {
            const dates = room.dates[peerID];
            if(dates !== undefined && dates !== null)
            {
                for(let date of dates)
                {
                    const player = room.players.find(player => player.peerID === date);
                    room.queue = [...room.queue, {player, emit: 'drink', reason: 'date', date: username}];

                    if(room.queue.length === 1)
                    {
                        processQueue();
                    }
                }
            }
        });

        socket.on('start-never-have-i-ever', () =>
        {
            room.neverHaveIEver = {};
            room.neverHaveIEverCount = 0;
            room.neverHaveIEverTurnIndex = room.turnIndex;
            for(let i = 0; i < room.players.length; i++)
            {
                const player = room.players[i];
                room.neverHaveIEver[player.peerID] = 3
            }
            io.in(roomCode).emit('start-never-have-i-ever');
            broadcastNeverHaveIEverTurn();
        });

        socket.on('never-have-i-ever', (peerID, iHave) =>
        {
            if(room.state == 1 && room.neverHaveIEver !== null)
            {
                room.neverHaveIEverCount++;
                if(iHave)
                {
                    room.neverHaveIEver[peerID]--;
                    socket.to(roomCode).broadcast.emit('never-have-i-ever-lives-changed', peerID, room.neverHaveIEver[peerID]);
                }

                let loser = null;
                for(let i = 0; i < room.players.length; i++)
                {
                    const player = room.players[i];
                    if(room.neverHaveIEver[player.peerID] === 0)
                    {
                        // game over
                        loser = player;
                    }
                }

                if(loser !== null)
                {
                    io.in(roomCode).emit('drink', loser.peerID, loser.username, 'never-have-i-ever');
                    room.neverHaveIEver = null;
                }
                else if(room.neverHaveIEverCount === room.players.length - 1)
                {
                    // next turn
                    room.neverHaveIEverCount = 0;
                    room.neverHaveIEverTurnIndex = (room.neverHaveIEverTurnIndex + 1) % room.players.length;
                    broadcastNeverHaveIEverTurn();
                }
            }
        });

        socket.on('rock-paper-scissors', (initiatorPeerID, initiatorUsername, oponentPeerID) =>
        {
            // tell the other player they are playing
            socket.to(roomCode).broadcast.emit('start-rock-paper-scissors', initiatorPeerID, oponentPeerID);
        });

        socket.on('choose-rock-paper-scissors', (peerID, choice, username) =>
        {
            room.rockPaperscissorsMoves.push({peerID, choice, username});
            console.log(peerID, 'chose', choice);

            if(room.rockPaperscissorsMoves.length === 2)
            {
                const [moveOne, moveTwo] = room.rockPaperscissorsMoves;
                if(moveOne.choice === 'rock' && moveTwo.choice === 'scissors')
                {
                    io.in(roomCode).emit('rock-paper-scissors-loser', moveTwo.peerID, moveTwo.username);
                }
                else if(moveTwo.choice === 'rock' && moveOne.choice === 'scissors')
                {
                    io.in(roomCode).emit('rock-paper-scissors-loser', moveOne.peerID, moveOne.username);
                }
                else if(moveOne.choice === 'paper' && moveTwo.choice === 'rock')
                {
                    io.in(roomCode).emit('rock-paper-scissors-loser', moveTwo.peerID, moveTwo.username);
                }
                else if(moveTwo.choice === 'paper' && moveOne.choice === 'rock')
                {
                    io.in(roomCode).emit('rock-paper-scissors-loser', moveOne.peerID, moveOne.username);
                }
                else if(moveOne.choice === 'scissors' && moveTwo.choice === 'paper')
                {
                    io.in(roomCode).emit('rock-paper-scissors-loser', moveTwo.peerID, moveTwo.username);
                }
                else if(moveTwo.choice === 'scissors' && moveOne.choice === 'paper')
                {
                    io.in(roomCode).emit('rock-paper-scissors-loser', moveOne.peerID, moveOne.username);
                }
                else
                {
                    // draw
                    io.in(roomCode).emit('rock-paper-scissors-draw', moveOne.peerID, moveTwo.peerID);
                }
                room.rockPaperscissorsMoves = [];
            }
        });

        socket.on('last-to-tap-the-screen', (peerID, username) =>
        {
            console.log(peerID, 'tapped the screen');
            if(++room.lastToTap === room.players.length)
            {
                io.in(roomCode).emit('last-to-tap-lost', peerID, username);
                room.lastToTap = 0;                
            }
        });

        socket.on('more', () =>{
            this.broadcastCurrentPlayer();
        });

        function processQueue()
        {
            if(room.queue.length > 0)
            {
                const message = room.queue.shift()
                message.player.socket.emit('drink', message.player.peerID, message.date, 'date');
                message.player.socket.to(roomCode).broadcast.emit('drink', message.player.peerID, message.date + ',' + message.player.username, 'date');

                // call this method in three seconds
                setTimeout(processQueue, 3 * 1000);
            }
        }

        function broadcastCurrentPlayer()
        {
            const player = room.players[room.turnIndex];
            console.log(player.username + "'s turn");
            player.socket.emit('my-turn');
            player.socket.to(roomCode).broadcast.emit('set-player-turn', player.peerID, player.username);
        }

        function broadcastNeverHaveIEverTurn()
        {
            const currentPlayer = room.players[room.neverHaveIEverTurnIndex];
            io.in(roomCode).emit('never-have-i-ever', currentPlayer.peerID, currentPlayer.username);
        }

        socket.on('disconnect', reason =>
        {
            console.log('player', peerID, 'left', roomCode);

            room.players = room.players.filter(player => player.peerID !== peerID);
            socket.to(roomCode).broadcast.emit('user-disconnected', peerID);
            
            // clean up and dispose if needed
            if (room.players.length === 0)
            {
                console.log('room', roomCode, 'empty. cleaning up');
                room = null;
            }
        });
    });    
});


const strip = (string) => 
{
    let result = '';
    for(let i = 0; i < string.length; i++)
    {
        let match = null;
        for(let j = 0; j < bank.length; j++)
        {
            if(bank[j] === string[i].toLowerCase())
            {
                match = bank[j];
                break;
            }
        }

        if(match !== null)
        {
            result += match;
        }
    }

    return result;
}