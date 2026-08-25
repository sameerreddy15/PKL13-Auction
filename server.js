const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));


function getLocalIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

const rooms = new Map();

function getRoom(roomId) {
  if (!roomId) return null;
  return rooms.get(String(roomId).trim().toUpperCase()) || null;
}

io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentSlotId = null;
  let currentUserName = null;

  socket.on("room:create", ({ state, hostSlotId, hostName }, callback) => {
    try {
      if (!state || !state.id) {
        if (callback) callback({ success: false, error: 'Invalid room data.' });
        return;
      }
      const roomId = String(state.id).trim().toUpperCase();
      const room = {
        id: roomId,
        state: { ...state, id: roomId },
        participants: new Map(),
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      currentRoomId = roomId;
      currentSlotId = hostSlotId || 'slot-1';
      currentUserName = hostName || 'Host';

      room.participants.set(socket.id, {
        socketId: socket.id,
        slotId: currentSlotId,
        userName: currentUserName,
        online: true,
        joinedAt: Date.now()
      });

      rooms.set(roomId, room);
      socket.join(roomId);

      if (callback) callback({ success: true, roomId, state: room.state, lanIps: getLocalIPAddresses(), port: PORT });
      io.to(roomId).emit('room:presence', Array.from(room.participants.values()));
      console.log(`[ROOM CREATED] ${roomId} by ${currentUserName} (${socket.id})`);
    } catch (err) {
      console.error('room:create error:', err);
      if (callback) callback({ success: false, error: 'Server error creating room.' });
    }
  });

  socket.on("room:join", ({ roomId, userName, slotId }, callback) => {
    try {
      const cleanId = String(roomId || '').trim().toUpperCase();
      const cleanName = String(userName || '').trim();
      const room = getRoom(cleanId);

      if (!room) {
        if (callback) callback({ success: false, error: `Room ${cleanId} was not found on this server.` });
        return;
      }

      currentRoomId = cleanId;
      currentUserName = cleanName;
      socket.join(cleanId);
      room.lastActivity = Date.now();

      let slot = null;
      if (slotId && room.state.slots) {
        const candidate = room.state.slots.find(s => s.slotId === slotId);
        if (candidate) {
          const hostParticipant = Array.from(room.participants.values()).find(p => p.slotId === room.state.hostSlotId && p.online);
          if (candidate.slotId === room.state.hostSlotId && hostParticipant && hostParticipant.socketId !== socket.id) {
            slot = null; // Do not overwrite host slot from another device
          } else {
            slot = candidate;
          }
        }
      }
      if (!slot && room.state.slots) {
        slot = room.state.slots.find(s => s.name.toLowerCase() === cleanName.toLowerCase() && s.mode === 'human' && s.slotId !== room.state.hostSlotId);
      }

      if (slot) {
        currentSlotId = slot.slotId;
        slot.name = cleanName;
      } else {
        if (room.state.slots.length >= room.state.maxTeams) {
          currentSlotId = 'spectator-' + Date.now();
        } else {
          currentSlotId = 'slot-' + Date.now() + '-' + (room.state.slots.length + 1);
          room.state.slots.push({
            slotId: currentSlotId,
            name: cleanName,
            mode: 'human',
            teamId: null
          });
        }
      }

      room.participants.set(socket.id, {
        socketId: socket.id,
        slotId: currentSlotId,
        userName: cleanName,
        online: true,
        joinedAt: Date.now()
      });

      if (callback) {
        callback({
          success: true,
          roomId: cleanId,
          slotId: currentSlotId,
          state: room.state,
          lanIps: getLocalIPAddresses(),
          port: PORT,
          isSpectator: currentSlotId.startsWith('spectator-')
        });
      }

      if (!room.state || !room.state.started) {
        socket.to(cleanId).emit('room:state_sync', { state: room.state, source: 'player_joined' });
      }
      io.to(cleanId).emit('room:presence', Array.from(room.participants.values()));
      io.to(cleanId).emit('room:notification', {
        type: 'info',
        text: `${cleanName} joined the room.`
      });

      console.log(`[PLAYER JOINED] ${cleanName} joined room ${cleanId} (Slot: ${currentSlotId})`);
    } catch (err) {
      console.error('room:join error:', err);
      if (callback) callback({ success: false, error: 'Server error joining room.' });
    }
  });

  socket.on("room:action", ({ roomId, actionType, payload, stateDelta }, callback) => {
    try {
      const room = getRoom(roomId || currentRoomId);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found.' });
        return;
      }

      room.lastActivity = Date.now();

      if (stateDelta) {
        room.state = { ...room.state, ...stateDelta };
      }
      if (payload && payload.slots && room.state) {
        room.state.slots = payload.slots;
      }

      if (actionType === 'bid:placed') {
        const { bidderTeamId, newBid, bidderSlotId, bidderName, active: payloadActive } = payload || {};
        const parsedBid = Number(newBid) || 0;
        if (room.state) {
          if (!room.state.active && payloadActive) {
            room.state.active = payloadActive;
          }
          if (room.state.active) {
            // Enforce strictly monotonic bids: A bid on the active player must never go backwards
            if (parsedBid >= (room.state.active.currentBid || 0)) {
              room.state.active.currentBid = parsedBid;
              room.state.active.highestBidder = bidderTeamId;
              room.state.active.bidHistory = room.state.active.bidHistory || [];
              room.state.active.bidHistory.push(bidderTeamId);
              room.state.timeLeft = room.state.bidTimer || 15;
              room.state.auctionPhase = 'bidding';
              room.state.bidsLocked = false;
            }
          }
        }
        io.to(room.id).emit('auction:bid_update', {
          bidderTeamId: room.state?.active?.highestBidder || bidderTeamId,
          newBid: room.state?.active?.currentBid || parsedBid,
          bidderSlotId,
          bidderName,
          active: room.state?.active,
          timeLeft: room.state?.timeLeft || 15,
          auctionPhase: 'bidding',
          bidsLocked: false,
          state: room.state
        });
      } else if (actionType === 'auction:pause_toggle') {
        const { paused, reason, seconds, pauseExpiresAt } = payload || {};
        const pauseSeconds = Number(seconds) || 0;
        if (room.state) {
          room.state.auctionPaused = paused;
          room.state.pauseReason = reason || '';
          room.state.pauseRemaining = pauseSeconds;
          room.state.pauseExpiresAt = pauseExpiresAt || (paused && pauseSeconds > 0 ? Date.now() + (pauseSeconds * 1000) : null);
        }
        io.to(room.id).emit('auction:pause_sync', {
          paused,
          reason,
          seconds: pauseSeconds,
          pauseExpiresAt: room.state?.pauseExpiresAt,
          state: room.state
        });
      } else if (actionType === 'auction:time_request') {
        const { pauseRequest } = payload || {};
        if (room.state) {
          room.state.pauseRequest = pauseRequest;
        }
        io.to(room.id).emit('auction:time_request_sync', {
          pauseRequest,
          senderSlotId: currentSlotId,
          state: room.state
        });
      } else if (actionType === 'auction:timer_tick') {
        const { timeLeft, auctionPhase, bidsLocked, speakText } = payload || {};
        if (room.state) {
          room.state.timeLeft = timeLeft;
          if (auctionPhase) room.state.auctionPhase = auctionPhase;
          if (typeof bidsLocked !== 'undefined') room.state.bidsLocked = bidsLocked;
        }
        socket.to(room.id).emit('auction:timer_sync', {
          timeLeft,
          auctionPhase,
          bidsLocked,
          speakText
        });
      } else if (actionType === 'auction:player_next') {
        const { active, timeLeft, groupIndex, auctionPhase, bidsLocked } = payload || {};
        if (room.state) {
          if (stateDelta) {
            room.state = { ...room.state, ...stateDelta };
          }
          room.state.active = active || null;
          room.state.timeLeft = timeLeft || room.state.bidTimer || 15;
          if (typeof groupIndex !== 'undefined') room.state.groupIndex = groupIndex;
          room.state.auctionPhase = auctionPhase || 'announcement';
          room.state.bidsLocked = (typeof bidsLocked !== 'undefined') ? bidsLocked : true;
        }
        socket.to(room.id).emit('auction:player_next_sync', {
          active: room.state?.active,
          timeLeft: room.state?.timeLeft,
          groupIndex: room.state?.groupIndex,
          auctionPhase: room.state?.auctionPhase,
          bidsLocked: room.state?.bidsLocked,
          state: room.state
        });
      } else if (actionType === 'auction:player_bidding_open') {
        const { active, timeLeft, groupIndex } = payload || {};
        if (room.state) {
          if (stateDelta) {
            room.state = { ...room.state, ...stateDelta };
          }
          if (active) room.state.active = active;
          room.state.timeLeft = timeLeft || room.state.bidTimer || 15;
          if (typeof groupIndex !== 'undefined') room.state.groupIndex = groupIndex;
          room.state.auctionPhase = 'bidding';
          room.state.bidsLocked = false;
        }
        socket.to(room.id).emit('auction:player_bidding_open_sync', {
          active: room.state?.active,
          timeLeft: room.state?.timeLeft,
          groupIndex: room.state?.groupIndex,
          auctionPhase: 'bidding',
          bidsLocked: false,
          state: room.state
        });
      } else if (actionType === 'auction:skip' || actionType === 'auction:sold') {
        const { player, teamId, price, speakText } = payload || {};
        if (room.state) {
          if (stateDelta) {
            room.state = { ...room.state, ...stateDelta };
          }
          if (player) {
            room.state.active = { ...player, currentBid: price, highestBidder: teamId };
          }
          room.state.auctionPhase = 'settling';
          room.state.bidsLocked = true;
          room.state.timeLeft = 1;
        }
        io.to(room.id).emit('auction:skip_sync', {
          player,
          teamId,
          price,
          speakText,
          state: room.state
        });
      } else if (actionType === 'auction:fbm_prompt') {
        const { fbmState, speakText } = payload || {};
        if (room.state) {
          room.state.fbmState = fbmState;
          room.state.auctionPhase = 'fbm';
          room.state.bidsLocked = true;
        }
        io.to(room.id).emit('auction:fbm_prompt_sync', {
          fbmState,
          speakText,
          state: room.state
        });
      } else if (actionType === 'auction:fbm_result') {
        const { exercised, teamId, price, speakText, player } = payload || {};
        if (room.state) {
          room.state.fbmState = null;
          room.state.auctionPhase = 'settling';
          room.state.bidsLocked = true;
        }
        io.to(room.id).emit('auction:fbm_result_sync', {
          exercised,
          teamId,
          price,
          speakText,
          player,
          state: room.state
        });
      } else if (actionType === 'auction:fbm_decision') {
        const { exercised, fbmState } = payload || {};
        io.to(room.id).emit('auction:fbm_decision_sync', {
          exercised,
          fbmState,
          senderSlotId: currentSlotId
        });
      } else if (actionType === 'auction:time_request_declined') {
        const { targetSlotId, requesterName, message } = payload || {};
        if (room.state) {
          room.state.pauseRequest = null;
        }
        io.to(room.id).emit('auction:time_request_declined', {
          targetSlotId,
          requesterName,
          message: message || 'Time request was declined by the host.',
          state: room.state
        });
      } else if (actionType === 'auction:round2_start') {
        if (room.state) {
          if (stateDelta) room.state = { ...room.state, ...stateDelta };
          room.state.isRound2 = true;
        }
        io.to(room.id).emit('auction:round2_sync', {
          state: room.state
        });
      } else if (actionType === 'auction:bidding_war') {
        const { teamA, teamB } = payload || {};
        io.to(room.id).emit('auction:bidding_war_sync', {
          teamA,
          teamB
        });
      } else if (actionType === 'auction:undo_sale') {
        io.to(room.id).emit('auction:undo_sale_sync', {
          state: room.state,
          payload
        });
      } else {
        io.to(room.id).emit('room:state_sync', {
          state: room.state,
          actionType,
          payload,
          senderSlotId: currentSlotId
        });
      }

      if (callback) callback({ success: true, state: room.state });
    } catch (err) {
      console.error('room:action error:', err);
      if (callback) callback({ success: false, error: 'Server error applying action.' });
    }
  });

  socket.on("room:reaction", ({ roomId, emoji, senderName }) => {
    try {
      const cleanId = String(roomId || currentRoomId || '').toUpperCase();
      if (!cleanId) return;
      io.to(cleanId).emit("room:reaction_sync", {
        emoji,
        senderName,
        senderSlotId: currentSlotId
      });
    } catch(e){}
  });

  socket.on("room:leave", ({ roomId, slotId }, callback) => {
    try {
      const cleanId = String(roomId || currentRoomId || '').toUpperCase();
      if (!cleanId) return;
      const room = rooms.get(cleanId);
      if (room) {
        room.participants.delete(socket.id);
        socket.leave(cleanId);
        
        const activeOnline = Array.from(room.participants.values()).filter(p => p.online);
        const isHostLeaving = (room.state && (room.state.hostSlotId === slotId || slotId === 'slot-1'));

        if (activeOnline.length === 0 || isHostLeaving) {
          rooms.delete(cleanId);
          console.log(`[ROOM CLEARED] Room ${cleanId} cleared from server (host left or room empty).`);
          io.to(cleanId).emit('room:closed', { message: 'Room was closed by host.' });
          if (callback) callback({ success: true, deleted: true });
          return;
        }

        if (!room.state.started && slotId) {
          room.state.slots = room.state.slots.filter(s => s.slotId !== slotId);
        } else if (room.state.started && slotId) {
          const s = room.state.slots?.find(x => x.slotId === slotId);
          if (s) {
            s.mode = 'bot';
            s.name = `${s.name} (AI)`;
          }
        }

        io.to(cleanId).emit('room:presence', Array.from(room.participants.values()));
        io.to(cleanId).emit('room:state_sync', { state: room.state, source: 'player_left' });
        console.log(`[PLAYER LEFT] Slot ${slotId} left room ${cleanId}. Handed over to AI if active.`);
      }
      currentRoomId = null;
      if (callback) callback({ success: true });
    } catch (err) {
      console.error('room:leave error:', err);
    }
  });

  socket.on("room:player_ready", ({ roomId, slotId, teamId, isReady, playerName }) => {
    const cleanId = String(roomId || currentRoomId || '').toUpperCase();
    if (!cleanId) return;
    const room = rooms.get(cleanId);
    if (!room) return;
    const slot = room.state?.slots?.find(s => s.slotId === slotId);
    if (slot) {
      slot.isReady = !!isReady;
    }
    io.to(cleanId).emit('room:player_ready_sync', {
      slotId,
      teamId,
      isReady: !!isReady,
      playerName: playerName || slot?.name || 'Player',
      state: room.state
    });
  });

  socket.on("room:chat", ({ roomId, message, senderName, teamName, teamLogo }) => {
    const cleanId = String(roomId || currentRoomId || '').toUpperCase();
    if (!cleanId || !message) return;
    const chatItem = {
      id: 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      senderName: senderName || currentUserName || 'Player',
      teamName: teamName || '',
      teamLogo: teamLogo || '',
      message: String(message).slice(0, 140),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    io.to(cleanId).emit('room:chat_message', chatItem);
  });

  socket.on("room:reaction", ({ roomId, emoji, senderName, teamName }) => {
    const cleanId = String(roomId || currentRoomId || '').toUpperCase();
    if (!cleanId || !emoji) return;
    io.to(cleanId).emit('room:reaction_broadcast', {
      emoji: String(emoji).slice(0, 4),
      senderName: senderName || currentUserName || 'Player',
      teamName: teamName || ''
    });
  });

  socket.on("disconnect", () => {
    if (currentRoomId) {
      const room = getRoom(currentRoomId);
      if (room && room.participants.has(socket.id)) {
        const p = room.participants.get(socket.id);
        p.online = false;
        p.disconnectedAt = Date.now();
        io.to(currentRoomId).emit('room:presence', Array.from(room.participants.values()));
        console.log(`[DISCONNECT] ${p.userName} disconnected from room ${currentRoomId} (room preserved for reconnect/refresh)`);
      }
    }
  });
});

const QRCode = require('qrcode');

app.get('/api/qr', async (req, res) => {
  try {
    const text = req.query.text || '';
    if (!text) return res.status(400).send('Missing text parameter');
    const dataUrl = await QRCode.toDataURL(text, {
      width: 220,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.json({ dataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    roomsActive: rooms.size,
    localIps: getLocalIPAddresses()
  });
});

app.get('/api/room/:id', (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({
    id: room.id,
    name: room.state.name,
    slotsCount: room.state.slots.length,
    maxTeams: room.state.maxTeams,
    started: room.state.started,
    participants: Array.from(room.participants.values())
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPAddresses();
  console.log('\n======================================================');
  console.log('  🏆 PKL 13 AUCTION SIMULATOR - MULTIPLAYER   🏆');
  console.log('======================================================');
  console.log('  Local URL:        http://localhost:' + PORT);
  ips.forEach(ip => {
    console.log('  Network (LAN) URL: http://' + ip + ':' + PORT);
  });
  console.log('======================================================\n');
});
