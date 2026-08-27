// server.js — бэкенд "WICK DUEL"
// Держит счётчик онлайна, матчмейкинг для дуэлей 1х1 и релей событий боя между соперниками.
// Бои с ботами полностью считаются на клиенте (server.js в них не участвует).

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ---- Состояние сервера ----
let onlineCount = 0;
let totalPlayedDuels = 0; // "число игравших" — сколько дуэлей всего сыграно за время жизни процесса

const queue = []; // сокеты, ожидающие соперника
const rooms = new Map(); // roomId -> { players: [id1, id2] }

function broadcastStats() {
  io.emit('stats', {
    online: onlineCount,
    totalPlayed: totalPlayedDuels
  });
}

function makeRoomId() {
  return 'room_' + Math.random().toString(36).slice(2, 10);
}

io.on('connection', (socket) => {
  onlineCount++;
  broadcastStats();

  socket.data.roomId = null;

  // Игрок встаёт в очередь на онлайн-дуэль
  socket.on('findMatch', () => {
    // не дублируем в очереди
    if (queue.includes(socket)) return;

    if (queue.length > 0) {
      const opponent = queue.shift();
      if (!opponent.connected) {
        // соперник отвалился — просто встаём в очередь сами
        queue.push(socket);
        return;
      }
      const roomId = makeRoomId();
      socket.join(roomId);
      opponent.join(roomId);
      socket.data.roomId = roomId;
      opponent.data.roomId = roomId;

      rooms.set(roomId, { players: [socket.id, opponent.id] });

      // Первому — левая позиция, второму — правая (дуэлянты лицом друг к другу)
      socket.emit('matchFound', { roomId, side: 'left', opponentId: opponent.id });
      opponent.emit('matchFound', { roomId, side: 'right', opponentId: socket.id });
    } else {
      queue.push(socket);
    }
  });

  socket.on('cancelFind', () => {
    const idx = queue.indexOf(socket);
    if (idx !== -1) queue.splice(idx, 1);
  });

  // Релей позиции/поворота камеры-тела соперника
  socket.on('state', (payload) => {
    if (!socket.data.roomId) return;
    socket.to(socket.data.roomId).emit('opponentState', payload);
  });

  // Выстрел
  socket.on('shoot', (payload) => {
    if (!socket.data.roomId) return;
    socket.to(socket.data.roomId).emit('opponentShoot', payload);
  });

  // Попадание в часть тела (клиент-инициатор сам решает, куда попал — упрощённая модель)
  socket.on('hit', (payload) => {
    if (!socket.data.roomId) return;
    socket.to(socket.data.roomId).emit('opponentHit', payload);
  });

  // Конец дуэли (победа/поражение)
  socket.on('duelOver', (payload) => {
    if (!socket.data.roomId) return;
    totalPlayedDuels++;
    io.to(socket.data.roomId).emit('duelEnded', payload);
    broadcastStats();
    const room = rooms.get(socket.data.roomId);
    if (room) {
      rooms.delete(socket.data.roomId);
    }
  });

  socket.on('disconnect', () => {
    onlineCount = Math.max(0, onlineCount - 1);
    const idx = queue.indexOf(socket);
    if (idx !== -1) queue.splice(idx, 1);

    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit('opponentLeft');
      rooms.delete(socket.data.roomId);
    }
    broadcastStats();
  });
});

server.listen(PORT, () => {
  console.log(`WICK DUEL server running on port ${PORT}`);
});