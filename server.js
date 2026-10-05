const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const cors = require('cors');

let retentionReferenceData = {
  S12_SQUADS: {},
  RETENTION_REFERENCE: {},
  SQUAD_BOOK_RETENTION_AMOUNTS: {},
  SQUAD_AUCTION_META: {},
  PLAYER_ALIASES: {}
};
try {
  retentionReferenceData = require('./retention_data.js');
} catch (err) {
  console.warn('[RETENTION DATA] Could not load retention_data.js:', err.message);
}


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 10000,
  pingInterval: 25000,
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
  connectionStateRecovery: { maxDisconnectionDuration: 120000, skipMiddlewares: true }
});

const PORT = process.env.PORT || 3000;
const railwayPublicDomain = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
const railwayPublicUrl = railwayPublicDomain ? `https://${railwayPublicDomain}` : '';
const PUBLIC_APP_URL = (process.env.PUBLIC_URL || railwayPublicUrl || '').replace(/\/$/, '');

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

function publicUrlFromRequest(req) {
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || (req?.secure ? 'https' : 'http');
  const host = String(req?.headers?.host || '').trim();
  return host ? `${proto}://${host}`.replace(/\/$/, '') : PUBLIC_APP_URL;
}

function publicUrlFromSocket(socket) {
  const headers = socket?.handshake?.headers || {};
  const forwardedProto = String(headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || 'https';
  const host = String(headers.host || '').trim();
  return host ? `${proto}://${host}`.replace(/\/$/, '') : PUBLIC_APP_URL;
}

function getRoom(roomId) {
  if (!roomId) return null;
  return rooms.get(String(roomId).trim().toUpperCase()) || null;
}

function cleanRoomId(value) {
  return String(value || '').trim().toUpperCase();
}

function cleanUserName(value, fallback = 'Player') {
  const name = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return name || fallback;
}

function canonicalName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const RETENTION_ALIASES = {};
for (const [alias, target] of Object.entries(retentionReferenceData.PLAYER_ALIASES || {})) {
  RETENTION_ALIASES[canonicalName(alias)] = canonicalName(target);
}

function canonicalRetentionName(value) {
  const raw = canonicalName(value);
  return RETENTION_ALIASES[raw] || raw;
}

function findRetentionCandidate(teamId, name) {
  const rows = retentionReferenceData.S12_SQUADS?.[teamId] || [];
  const wanted = canonicalRetentionName(name);
  return rows.find(row => Array.isArray(row) && canonicalRetentionName(row[0]) === wanted) || null;
}

function retentionRuleFor(teamId, name, candidate) {
  const referenceRows = retentionReferenceData.RETENTION_REFERENCE?.[teamId] || {};
  let type = null;
  for (const [refName, refType] of Object.entries(referenceRows)) {
    if (canonicalRetentionName(refName) === canonicalRetentionName(candidate?.[0] || name)) {
      type = refType;
      break;
    }
  }
  if (type === 'ERP') return { min: 3000000, max: 9000000 };
  if (type === 'RYP') return { min: 1300000, max: 5000000 };
  if (type === 'NYP') return { min: 1050000, max: 1050000 };

  const meta = retentionReferenceData.SQUAD_AUCTION_META?.[teamId] || {};
  const playerName = candidate?.[0] || name;
  let metaRow = meta[playerName];
  if (!metaRow) {
    const key = canonicalRetentionName(playerName);
    const found = Object.entries(meta).find(([n]) => canonicalRetentionName(n) === key);
    metaRow = found?.[1] || null;
  }
  const category = String(metaRow?.[0] || '').replace(/^Category\s*/i, '').trim().toUpperCase();
  const baseByCategory = { A: 3000000, B: 2000000, C: 1300000, D: 900000 };
  return { min: Number(metaRow?.[1]) || baseByCategory[category] || 900000, max: 50000000 };
}


function getParticipant(room, socketId) {
  return room?.participants?.get(socketId) || null;
}

function isHostParticipant(room, participant) {
  return !!(room && participant && room.state && participant.slotId === room.state.hostSlotId);
}

function getSlot(room, slotId) {
  return room?.state?.slots?.find(slot => slot.slotId === slotId) || null;
}

function getTeam(room, teamId) {
  return room?.state?.teams?.find(team => team.teamId === teamId) || null;
}

function emitActionDenied(socket, callback, error) {
  const result = { success: false, error };
  socket.emit('room:action_rejected', result);
  if (callback) callback(result);
}

function normalizeAuctionPosition(position) {
  const value = String(position || '').trim().toLowerCase();
  if (value.includes('all')) return 'All-Rounder';
  if (value.includes('raid')) return 'Raider';
  if (value.includes('defend')) return 'Defender';
  return String(position || '').trim();
}

function countOverseasPlayers(team) {
  return (team?.auctionSquad || []).filter(player => {
    const nationality = String(player?.nationality || '').toLowerCase();
    return nationality === 'overseas' || ['iran', 'nepal', 'bangladesh', 'south korea', 'kenya'].includes(nationality);
  }).length;
}

function bidStep(currentBid) {
  return Number(currentBid || 0) < 10000000 ? 25000 : 50000;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyHostStateSnapshot(room, incomingState) {
  if (!incomingState || typeof incomingState !== 'object') return false;
  const incoming = cloneJson(incomingState);
  incoming.id = room.id;

  const current = room.state || {};
  const incomingRevision = Number(incoming.stateRevision || 0);
  const currentRevision = Number(current.stateRevision || 0);

  // The server is authoritative. A host packet may arrive after a human bid
  // from another socket, so never allow an older host snapshot to roll back
  // server-owned auction fields, teams, or player statuses.
  if (incomingRevision < currentRevision) {
    const merged = { ...cloneJson(current), ...incoming };
    const protectedFields = [
      'teams', 'players', 'active', 'fbmState', 'groupIndex',
      'auctionPhase', 'bidsLocked', 'timeLeft', 'bidExpiresAt',
      'auctionPaused', 'pauseRequest', 'pauseRemaining', 'pauseExpiresAt'
    ];
    for (const field of protectedFields) {
      if (typeof current[field] !== 'undefined') merged[field] = cloneJson(current[field]);
    }
    merged.stateRevision = currentRevision;
    room.state = merged;
    return false;
  }

  room.state = incoming;
  room.state.stateRevision = incomingRevision;
  return true;
}

const HOST_ACTIONS = new Set([
  'retentions:start', 'auction:start', 'auction:pause_toggle', 'auction:time_request_declined',
  'auction:timer_tick', 'auction:player_next', 'auction:player_bidding_open',
  'auction:skip', 'auction:sold', 'auction:unsold', 'auction:fbm_prompt', 'auction:fbm_result',
  'auction:round2_start', 'auction:bidding_war', 'auction:undo_sale'
]);

io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentSlotId = null;
  let currentUserName = null;

  socket.on('room:create', ({ state, hostSlotId, hostName } = {}, callback) => {
    try {
      if (!state || !state.id) {
        if (callback) callback({ success: false, error: 'Invalid room data.' });
        return;
      }

      const roomId = cleanRoomId(state.id);
      if (!roomId || roomId.length !== 6) {
        if (callback) callback({ success: false, error: 'Room ID must be 6 characters.' });
        return;
      }
      if (rooms.has(roomId)) {
        if (callback) callback({ success: false, error: `Room ${roomId} already exists. Please create a new room.` });
        return;
      }

      const cleanHostName = cleanUserName(hostName, 'Host');
      const cleanHostSlotId = String(hostSlotId || 'slot-1');
      const incomingState = JSON.parse(JSON.stringify(state));
      incomingState.id = roomId;
      incomingState.hostSlotId = cleanHostSlotId;
      incomingState.hostName = cleanHostName;
      incomingState.slots = Array.isArray(incomingState.slots) ? incomingState.slots : [];
      incomingState.teams = Array.isArray(incomingState.teams) ? incomingState.teams : [];
      incomingState.stateRevision = Number(incomingState.stateRevision || 0);

      let hostSlot = incomingState.slots.find(slot => slot.slotId === cleanHostSlotId);
      if (!hostSlot) {
        hostSlot = { slotId: cleanHostSlotId, name: cleanHostName, mode: 'human', teamId: null };
        incomingState.slots.unshift(hostSlot);
      }
      hostSlot.name = cleanHostName;
      hostSlot.mode = 'human';

      const room = {
        id: roomId,
        state: incomingState,
        participants: new Map(),
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      currentRoomId = roomId;
      currentSlotId = cleanHostSlotId;
      currentUserName = cleanHostName;
      room.participants.set(socket.id, {
        socketId: socket.id,
        slotId: currentSlotId,
        userName: currentUserName,
        online: true,
        joinedAt: Date.now()
      });

      rooms.set(roomId, room);
      socket.join(roomId);

      if (callback) callback({ success: true, roomId, state: room.state, lanIps: getLocalIPAddresses(), port: PORT, publicUrl: publicUrlFromSocket(socket), directJoinUrl: `${publicUrlFromSocket(socket)}/?room=${encodeURIComponent(roomId)}` });
      io.to(roomId).emit('room:presence', Array.from(room.participants.values()));
      console.log(`[ROOM CREATED] ${roomId} by ${currentUserName} (${socket.id})`);
    } catch (err) {
      console.error('room:create error:', err);
      if (callback) callback({ success: false, error: 'Server error creating room.' });
    }
  });

  socket.on('room:join', ({ roomId, userName, slotId } = {}, callback) => {
    try {
      const cleanId = cleanRoomId(roomId);
      const cleanName = cleanUserName(userName, 'Player');
      const room = getRoom(cleanId);

      if (!/^[A-Z0-9]{6}$/.test(cleanId)) {
        if (callback) callback({ success: false, error: 'Room ID must be exactly 6 letters/numbers.' });
        return;
      }

      if (!room) {
        if (callback) callback({ success: false, error: `Room ${cleanId} was not found on this server.` });
        return;
      }

      // room:join is idempotent for the same socket + room. Repeated join
      // events must never create a second human slot.
      const existingParticipant = room.participants.get(socket.id);
      if (currentRoomId === cleanId && existingParticipant) {
        existingParticipant.online = true;
        existingParticipant.userName = cleanName;
        existingParticipant.lastSeenAt = Date.now();
        currentSlotId = existingParticipant.slotId;
        currentUserName = cleanName;
        room.lastActivity = Date.now();
        if (callback) callback({
          success: true,
          roomId: cleanId,
          slotId: currentSlotId,
          state: room.state,
          lanIps: getLocalIPAddresses(),
          port: PORT,
          publicUrl: publicUrlFromSocket(socket),
          directJoinUrl: `${publicUrlFromSocket(socket)}/?room=${encodeURIComponent(cleanId)}`,
          isSpectator: String(currentSlotId).startsWith('spectator-'),
          alreadyJoined: true
        });
        return;
      }

      if (currentRoomId && currentRoomId !== cleanId) {
        const oldRoom = getRoom(currentRoomId);
        if (oldRoom) {
          const oldParticipant = oldRoom.participants.get(socket.id);
          if (oldParticipant) {
            oldParticipant.online = false;
            oldParticipant.disconnectedAt = Date.now();
            oldRoom.lastActivity = Date.now();
            io.to(currentRoomId).emit('room:presence', Array.from(oldRoom.participants.values()));
          }
        }
        socket.leave(currentRoomId);
      }

      const requestedSlotId = slotId ? String(slotId) : null;
      let slot = requestedSlotId ? getSlot(room, requestedSlotId) : null;
      let reconnectingOwner = null;
      if (slot) {
        const existingOwner = Array.from(room.participants.values()).find(p => p.slotId === slot.slotId && p.online);
        if (existingOwner && existingOwner.socketId !== socket.id) {
          if (callback) callback({ success: false, error: 'That player slot is already connected. Please choose another slot.' });
          return;
        }
        reconnectingOwner = Array.from(room.participants.values()).find(
          p => !p.online && p.slotId === slot.slotId && p.userName.toLowerCase() === cleanName.toLowerCase()
        ) || null;
        if (room.state.started && !reconnectingOwner) {
          if (callback) callback({ success: false, error: 'This started-room slot can only be reclaimed by its previous player.' });
          return;
        }
      }

      if (!slot && !room.state.started) {
        slot = room.state.slots.find(s => s.mode === 'human' && !Array.from(room.participants.values()).some(p => p.slotId === s.slotId && p.online) && s.name.toLowerCase() === cleanName.toLowerCase());
      }

      if (!slot) {
        if (room.state.started || room.state.slots.length >= Number(room.state.maxTeams || 12)) {
          currentSlotId = `spectator-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        } else {
          currentSlotId = `slot-${Date.now()}-${room.state.slots.length + 1}`;
          room.state.slots.push({ slotId: currentSlotId, name: cleanName, mode: 'human', teamId: null });
        }
      } else {
        currentSlotId = slot.slotId;
        slot.name = cleanName;
        if (reconnectingOwner || !room.state.started) slot.mode = 'human';
        else slot.mode = slot.mode || 'human';
        if (reconnectingOwner) room.participants.delete(reconnectingOwner.socketId);
      }

      currentRoomId = cleanId;
      currentUserName = cleanName;
      socket.join(cleanId);
      room.lastActivity = Date.now();

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
          publicUrl: publicUrlFromSocket(socket),
          directJoinUrl: `${publicUrlFromSocket(socket)}/?room=${encodeURIComponent(cleanId)}`,
          isSpectator: currentSlotId.startsWith('spectator-')
        });
      }

      if (!room.state.started) {
        socket.to(cleanId).emit('room:state_sync', { state: room.state, source: 'player_joined' });
      }
      io.to(cleanId).emit('room:presence', Array.from(room.participants.values()));
      io.to(cleanId).emit('room:notification', { type: 'info', text: `${cleanName} joined the room.` });
      console.log(`[PLAYER JOINED] ${cleanName} joined room ${cleanId} (Slot: ${currentSlotId})`);
    } catch (err) {
      console.error('room:join error:', err);
      if (callback) callback({ success: false, error: 'Server error joining room.' });
    }
  });

  socket.on('room:action', ({ roomId, actionType, payload, stateDelta } = {}, callback) => {
    try {
      const cleanId = cleanRoomId(roomId || currentRoomId);
      const room = getRoom(cleanId);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found.' });
        return;
      }

      const participant = getParticipant(room, socket.id);
      if (!participant) {
        emitActionDenied(socket, callback, 'You are not connected to this room.');
        return;
      }
      const senderSlotId = participant.slotId;
      const senderSlot = getSlot(room, senderSlotId);
      const host = isHostParticipant(room, participant);
      const spectator = senderSlotId.startsWith('spectator-');
      room.lastActivity = Date.now();

      if (spectator) {
        emitActionDenied(socket, callback, 'Spectators cannot control the auction.');
        return;
      }

      if (HOST_ACTIONS.has(actionType) && !host) {
        emitActionDenied(socket, callback, 'Only the room host can perform this action.');
        return;
      }

      if (actionType === 'slot:update') {
        const targetSlotId = String(payload?.slotId || senderSlotId);
        const target = getSlot(room, targetSlotId);
        if (!target) {
          emitActionDenied(socket, callback, 'Player slot not found.');
          return;
        }
        if (!host && targetSlotId !== senderSlotId) {
          emitActionDenied(socket, callback, 'You can only edit your own player slot.');
          return;
        }
        const targetIsBot = target.mode === 'bot';
        if (!host && targetIsBot) {
          emitActionDenied(socket, callback, 'Only the host can edit an AI slot.');
          return;
        }
        const newName = cleanUserName(payload?.newName || payload?.name || '', target.name || 'Player');
        if (!newName) {
          emitActionDenied(socket, callback, 'Player name cannot be empty.');
          return;
        }
        target.name = newName;
        if (targetSlotId === senderSlotId) participant.userName = newName;
        room.state.stateRevision = Number(room.state.stateRevision || 0) + 1;
        io.to(room.id).emit('room:slot_sync', { slots: room.state.slots, state: room.state });
        io.to(room.id).emit('room:state_sync', { state: room.state, actionType, payload, senderSlotId });
        if (callback) callback({ success: true, state: room.state });
        return;
      }

      if (actionType === 'slot:set_team') {
        if (room.state.started) {
          emitActionDenied(socket, callback, 'Franchises are locked after the auction starts.');
          return;
        }
        const targetSlotId = String(payload?.slotId || senderSlotId);
        const target = getSlot(room, targetSlotId);
        if (!target) {
          emitActionDenied(socket, callback, 'Player slot not found.');
          return;
        }
        if (!host && targetSlotId !== senderSlotId) {
          emitActionDenied(socket, callback, 'You can only choose a franchise for your own slot.');
          return;
        }
        if (!host && target.mode === 'bot') {
          emitActionDenied(socket, callback, 'Only the host can configure AI franchises.');
          return;
        }
        const teamId = payload?.teamId ? String(payload.teamId) : null;
        if (teamId && !getTeam(room, teamId)) {
          emitActionDenied(socket, callback, 'Invalid franchise selected.');
          return;
        }
        const duplicate = teamId && room.state.slots.some(s => s.slotId !== targetSlotId && s.teamId === teamId);
        if (duplicate) {
          emitActionDenied(socket, callback, 'That franchise is already selected by another slot.');
          return;
        }
        target.teamId = teamId;
        room.state.stateRevision = Number(room.state.stateRevision || 0) + 1;
        io.to(room.id).emit('room:slot_sync', { slots: room.state.slots, state: room.state });
        io.to(room.id).emit('room:state_sync', { state: room.state, actionType, payload, senderSlotId });
        if (callback) callback({ success: true, state: room.state });
        return;
      }

      if (actionType === 'retention:update') {
        if (room.state.retentionsFinalized) {
          emitActionDenied(socket, callback, 'Retentions are already finalized.');
          return;
        }
        const teamId = String(payload?.teamId || '');
        const targetSlot = room.state.slots.find(s => s.teamId === teamId);
        const allowed = host || (targetSlot && targetSlot.slotId === senderSlotId && targetSlot.mode === 'human');
        if (!allowed || !targetSlot) {
          emitActionDenied(socket, callback, 'You can only edit retentions for your own franchise.');
          return;
        }
        if (!Array.isArray(payload?.retentions)) {
          emitActionDenied(socket, callback, 'Invalid retention selection.');
          return;
        }
        const team = getTeam(room, teamId);
        if (!team) {
          emitActionDenied(socket, callback, 'Franchise not found.');
          return;
        }
        const retentions = [...new Set(payload.retentions.map(name => String(name || '').trim()).filter(Boolean))].slice(0, 8);
        const incomingAmounts = payload.retentionAmounts && typeof payload.retentionAmounts === 'object' ? payload.retentionAmounts : {};
        const normalizedAmounts = Object.fromEntries(Object.entries(incomingAmounts).map(([key, value]) => [canonicalRetentionName(key), value]));
        const amounts = {};
        let spend = 0;
        const canonicalRetentions = [];
        for (const requestedName of retentions) {
          const candidate = findRetentionCandidate(teamId, requestedName);
          if (!candidate) {
            emitActionDenied(socket, callback, `Player ${requestedName} is not a valid retention candidate for this franchise.`);
            return;
          }
          const name = String(candidate[0]);
          const canonicalKey = canonicalRetentionName(name);
          const raw = Number(incomingAmounts[requestedName] ?? incomingAmounts[name] ?? incomingAmounts[requestedName.toLowerCase()] ?? normalizedAmounts[canonicalKey] ?? 0);
          const rule = retentionRuleFor(teamId, name, candidate);
          const amount = Number.isFinite(raw) && raw >= 0 ? Math.round(raw / 50000) * 50000 : 0;
          if (amount < rule.min || amount > rule.max) {
            emitActionDenied(socket, callback, `Retention amount for ${name} must be between ₹${rule.min.toLocaleString('en-IN')} and ₹${rule.max.toLocaleString('en-IN')}.`);
            return;
          }
          spend += amount;
          if (spend > 50000000) {
            emitActionDenied(socket, callback, 'Retention cost cannot exceed the ₹5 Cr purse.');
            return;
          }
          canonicalRetentions.push(name);
          amounts[canonicalKey] = amount;
        }
        team.retentions = canonicalRetentions;
        team.retentionAmounts = amounts;
        team.retentionSpent = spend;
        team.purse = Math.max(0, 50000000 - spend);
        team.spent = spend;
        team.retentionPurse = team.purse;
        room.state.stateRevision = Number(room.state.stateRevision || 0) + 1;
        io.to(room.id).emit('room:state_sync', { state: room.state, actionType, payload: { teamId, retentions: canonicalRetentions, retentionAmounts: amounts }, senderSlotId });
        if (callback) callback({ success: true, state: room.state });
        return;
      }

      if (actionType === 'bid:placed') {
        const requestedTeamId = String(payload?.bidderTeamId || '');
        const requestedSlotId = String(payload?.bidderSlotId || '');
        const parsedBid = Number(payload?.newBid);
        const activeId = payload?.active?.id || room.state?.active?.id;

        if (!room.state?.started || !room.state.active || !activeId || room.state.active.id !== activeId) {
          emitActionDenied(socket, callback, 'Auction state is out of date. Please wait for synchronization.');
          socket.emit('auction:bid_rejected', { error: 'Auction state is out of date.', state: room.state });
          return;
        }
        if (!['bidding', 'going1', 'going2'].includes(room.state.auctionPhase) || room.state.auctionPaused || room.state.bidsLocked) {
          emitActionDenied(socket, callback, 'Bidding is currently closed.');
          socket.emit('auction:bid_rejected', { error: 'Bidding is currently closed.', state: room.state });
          return;
        }
        if (!Number.isFinite(parsedBid) || parsedBid <= 0) {
          emitActionDenied(socket, callback, 'Invalid bid amount.');
          socket.emit('auction:bid_rejected', { error: 'Invalid bid amount.', state: room.state });
          return;
        }

        let bidderTeamId = requestedTeamId;
        let bidderName = cleanUserName(payload?.bidderName, participant.userName);
        let bidderSlotId = senderSlotId;
        let bidderTeam = null;

        if (requestedSlotId.startsWith('ai-') && host) {
          bidderTeam = getTeam(room, requestedTeamId);
          const aiSlot = room.state.slots.find(s => s.mode === 'bot' && s.teamId === requestedTeamId);
          if (!bidderTeam || !aiSlot) {
            emitActionDenied(socket, callback, 'Invalid AI bidder.');
            return;
          }
          bidderSlotId = `ai-${requestedTeamId}`;
          bidderName = cleanUserName(payload?.bidderName, `AI Manager (${requestedTeamId})`);
        } else {
          if (!senderSlot || senderSlot.mode !== 'human') {
            emitActionDenied(socket, callback, 'Only a human franchise owner can place this bid.');
            return;
          }
          if (!senderSlot.teamId || requestedTeamId !== senderSlot.teamId || (requestedSlotId && requestedSlotId !== senderSlotId)) {
            emitActionDenied(socket, callback, 'Bidder identity does not match your player slot.');
            return;
          }
          bidderTeamId = senderSlot.teamId;
          bidderTeam = getTeam(room, bidderTeamId);
        }

        if (!bidderTeam) {
          emitActionDenied(socket, callback, 'Franchise not found.');
          return;
        }
        if (room.state.active.highestBidder === bidderTeamId) {
          emitActionDenied(socket, callback, 'The current highest bidder cannot bid again immediately.');
          socket.emit('auction:bid_rejected', { error: 'The current highest bidder cannot bid again immediately.', state: room.state });
          return;
        }

        const currentBid = Number(room.state.active.currentBid || 0);
        const basePrice = Number(room.state.active.basePrice || 0);
        const minimumBid = room.state.active.highestBidder ? currentBid + bidStep(currentBid) : Math.max(basePrice, currentBid);
        if (parsedBid < minimumBid) {
          emitActionDenied(socket, callback, `Minimum valid bid is ₹${minimumBid.toLocaleString('en-IN')}.`);
          socket.emit('auction:bid_rejected', { error: `Minimum valid bid is ₹${minimumBid.toLocaleString('en-IN')}.`, state: room.state });
          return;
        }
        if (parsedBid > Number(bidderTeam.purse || 0)) {
          emitActionDenied(socket, callback, 'Insufficient purse for this bid.');
          socket.emit('auction:bid_rejected', { error: 'Insufficient purse for this bid.', state: room.state });
          return;
        }
        if ((bidderTeam.auctionSquad || []).length >= 25) {
          emitActionDenied(socket, callback, 'Maximum squad size reached.');
          socket.emit('auction:bid_rejected', { error: 'Maximum squad size reached.', state: room.state });
          return;
        }
        if (String(room.state.active.nationality || '').toLowerCase() === 'overseas' && countOverseasPlayers(bidderTeam) >= 4) {
          emitActionDenied(socket, callback, 'Maximum overseas player limit reached.');
          socket.emit('auction:bid_rejected', { error: 'Maximum overseas player limit reached.', state: room.state });
          return;
        }

        const active = room.state.active;
        active.currentBid = parsedBid;
        active.highestBidder = bidderTeamId;
        active.bidHistory = Array.isArray(active.bidHistory) ? active.bidHistory : [];
        active.bidHistory.push(bidderTeamId);
        active.lastBidAt = Date.now();
        room.state.timeLeft = Number(room.state.bidTimer || 15);
        room.state.bidExpiresAt = Date.now() + room.state.timeLeft * 1000;
        room.state.auctionPhase = 'bidding';
        room.state.bidsLocked = false;
        room.state.stateRevision = Number(room.state.stateRevision || 0) + 1;

        const currentServerTime = Date.now();
        const authoritativeState = cloneJson(room.state);
        io.to(room.id).emit('auction:bid_update', {
          bidderTeamId,
          newBid: parsedBid,
          bidderSlotId,
          bidderName,
          active: authoritativeState.active,
          timeLeft: authoritativeState.timeLeft,
          bidExpiresAt: authoritativeState.bidExpiresAt,
          serverTime: currentServerTime,
          auctionPhase: authoritativeState.auctionPhase,
          bidsLocked: authoritativeState.bidsLocked,
          state: authoritativeState
        });
        io.to(room.id).emit('room:state_sync', { state: authoritativeState, actionType, payload: { bidderTeamId, newBid: parsedBid, bidderSlotId, bidderName }, senderSlotId });
        if (callback) callback({ success: true, state: authoritativeState, serverTime: currentServerTime });
        return;
      }

      if (actionType === 'auction:time_request') {
        const request = payload?.pauseRequest || {};
        const normalizedRequest = {
          requesterSlotId: senderSlotId,
          name: participant.userName,
          teamId: senderSlot?.teamId || null,
          teamName: request.teamName || '',
          timestamp: Date.now()
        };
        room.state.pauseRequest = normalizedRequest;
        room.state.stateRevision = Number(room.state.stateRevision || 0) + 1;
        io.to(room.id).emit('auction:time_request_sync', { pauseRequest: normalizedRequest, senderSlotId, state: room.state });
        if (callback) callback({ success: true, state: room.state });
        return;
      }

      if (actionType === 'auction:fbm_decision') {
        const fbmState = room.state.fbmState;
        const targetTeamId = fbmState?.origTeamId;
        const ownsTargetTeam = senderSlot?.teamId === targetTeamId;
        if (!host && !ownsTargetTeam) {
          emitActionDenied(socket, callback, 'Only the original franchise can make this FBM decision.');
          return;
        }
        const exercised = !!payload?.exercised;
        io.to(room.id).emit('auction:fbm_decision_sync', { exercised, fbmState, senderSlotId });
        if (callback) callback({ success: true, state: room.state });
        return;
      }

      // All remaining state-changing auction actions are host controlled.
      if (stateDelta && host) {
        const beforeRevision = Number(room.state.stateRevision || 0);
        applyHostStateSnapshot(room, stateDelta);
        room.state.id = room.id;
        room.state.hostSlotId = room.state.hostSlotId || room.state.slots?.[0]?.slotId || 'slot-1';
        room.state.stateRevision = Math.max(beforeRevision, Number(room.state.stateRevision || 0)) + 1;
      }

      if (actionType === 'auction:pause_toggle') {
        const { paused, reason, seconds, pauseExpiresAt } = payload || {};
        const pauseSeconds = Math.max(0, Number(seconds) || 0);
        room.state.auctionPaused = !!paused;
        room.state.pauseReason = reason || '';
        room.state.pauseRemaining = pauseSeconds;
        room.state.pauseExpiresAt = pauseExpiresAt || (paused && pauseSeconds > 0 ? Date.now() + pauseSeconds * 1000 : null);
        io.to(room.id).emit('auction:pause_sync', { paused: !!paused, reason: room.state.pauseReason, seconds: pauseSeconds, pauseExpiresAt: room.state.pauseExpiresAt, state: room.state });
      } else if (actionType === 'auction:timer_tick') {
        const { timeLeft, auctionPhase, bidsLocked, speakText } = payload || {};
        room.state.timeLeft = Math.max(0, Number(timeLeft) || 0);
        if (auctionPhase) room.state.auctionPhase = auctionPhase;
        if (typeof bidsLocked !== 'undefined') room.state.bidsLocked = !!bidsLocked;
        io.to(room.id).emit('auction:timer_sync', { timeLeft: room.state.timeLeft, auctionPhase: room.state.auctionPhase, bidsLocked: room.state.bidsLocked, speakText });
      } else if (actionType === 'auction:player_next') {
        const { active, timeLeft, groupIndex, auctionPhase, bidsLocked } = payload || {};
        room.state.active = active || null;
        room.state.timeLeft = Number(timeLeft) || Number(room.state.bidTimer || 15);
        if (typeof groupIndex !== 'undefined') room.state.groupIndex = groupIndex;
        room.state.auctionPhase = auctionPhase || 'announcement';
        room.state.bidsLocked = typeof bidsLocked !== 'undefined' ? !!bidsLocked : true;
        io.to(room.id).emit('auction:player_next_sync', { active: room.state.active, timeLeft: room.state.timeLeft, groupIndex: room.state.groupIndex, auctionPhase: room.state.auctionPhase, bidsLocked: room.state.bidsLocked, state: room.state });
      } else if (actionType === 'auction:player_bidding_open') {
        const { active, timeLeft, groupIndex } = payload || {};
        if (active) room.state.active = active;
        room.state.timeLeft = Number(timeLeft) || Number(room.state.bidTimer || 15);
        if (typeof groupIndex !== 'undefined') room.state.groupIndex = groupIndex;
        room.state.auctionPhase = 'bidding';
        room.state.bidsLocked = false;
        room.state.bidExpiresAt = Date.now() + room.state.timeLeft * 1000;
        io.to(room.id).emit('auction:player_bidding_open_sync', { active: room.state.active, timeLeft: room.state.timeLeft, groupIndex: room.state.groupIndex, auctionPhase: 'bidding', bidsLocked: false, state: room.state });
      } else if (actionType === 'auction:skip' || actionType === 'auction:sold') {
        const { player, teamId, price, speakText } = payload || {};
        room.state.active = player ? { ...player, currentBid: Number(price) || 0, highestBidder: teamId || null } : room.state.active;
        room.state.auctionPhase = 'settling';
        room.state.bidsLocked = true;
        room.state.timeLeft = 1;
        const authoritativeState = cloneJson(room.state);
        io.to(room.id).emit('auction:skip_sync', { player, teamId, price, speakText, state: authoritativeState });
        if (actionType === 'auction:sold') io.to(room.id).emit('auction:sold_sync', { player, teamId, price, speakText, state: authoritativeState });
        io.to(room.id).emit('room:state_sync', { state: authoritativeState, actionType, payload: { player, teamId, price }, senderSlotId });
      } else if (actionType === 'auction:unsold') {
        room.state.auctionPhase = 'settling';
        room.state.bidsLocked = true;
        room.state.timeLeft = 1;
        io.to(room.id).emit('auction:unsold_sync', { player: payload?.player, state: room.state });
        io.to(room.id).emit('room:state_sync', { state: room.state, actionType, payload, senderSlotId });
      } else if (actionType === 'auction:fbm_prompt') {
        room.state.fbmState = payload?.fbmState || null;
        room.state.auctionPhase = 'fbm';
        room.state.bidsLocked = true;
        io.to(room.id).emit('auction:fbm_prompt_sync', { fbmState: room.state.fbmState, speakText: payload?.speakText, state: room.state });
      } else if (actionType === 'auction:fbm_result') {
        room.state.fbmState = null;
        room.state.auctionPhase = 'settling';
        room.state.bidsLocked = true;
        io.to(room.id).emit('auction:fbm_result_sync', { exercised: !!payload?.exercised, teamId: payload?.teamId, price: payload?.price, speakText: payload?.speakText, player: payload?.player, state: room.state });
      } else if (actionType === 'auction:time_request_declined') {
        room.state.pauseRequest = null;
        io.to(room.id).emit('auction:time_request_declined', { targetSlotId: payload?.targetSlotId, requesterName: payload?.requesterName, message: payload?.message || 'Time request was declined by the host.', state: room.state });
      } else if (actionType === 'auction:round2_start') {
        room.state.isRound2 = true;
        io.to(room.id).emit('auction:round2_sync', { state: room.state });
      } else if (actionType === 'auction:bidding_war') {
        io.to(room.id).emit('auction:bidding_war_sync', { teamA: payload?.teamA, teamB: payload?.teamB });
      } else if (actionType === 'auction:undo_sale') {
        io.to(room.id).emit('auction:undo_sale_sync', { state: room.state, payload });
      } else if (actionType === 'retentions:start' || actionType === 'auction:start') {
        io.to(room.id).emit('room:state_sync', { state: room.state, actionType, payload, senderSlotId });
      } else {
        io.to(room.id).emit('room:state_sync', { state: room.state, actionType, payload, senderSlotId });
      }

      if (callback) callback({ success: true, state: room.state });
    } catch (err) {
      console.error('room:action error:', err);
      if (callback) callback({ success: false, error: 'Server error applying action.' });
    }
  });

  socket.on('room:reaction', ({ roomId, emoji } = {}) => {
    try {
      const cleanId = cleanRoomId(roomId || currentRoomId);
      const room = getRoom(cleanId);
      const participant = room && getParticipant(room, socket.id);
      if (!room || !participant) return;
      const cleanEmoji = String(emoji || '').slice(0, 4);
      if (!cleanEmoji) return;
      io.to(cleanId).emit('room:reaction_broadcast', {
        emoji: cleanEmoji,
        senderName: participant.userName,
        senderSlotId: participant.slotId
      });
    } catch (_) {}
  });

  socket.on('room:request_sync', ({ roomId } = {}, callback) => {
    try {
      const cleanId = cleanRoomId(roomId || currentRoomId);
      const room = getRoom(cleanId);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found.' });
        return;
      }
      if (callback) callback({ success: true, state: room.state, serverTime: Date.now(), participants: Array.from(room.participants.values()) });
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  socket.on('room:leave', ({ roomId } = {}, callback) => {
    try {
      const cleanId = cleanRoomId(roomId || currentRoomId);
      const room = getRoom(cleanId);
      if (!room) {
        if (callback) callback({ success: true });
        return;
      }

      const participant = getParticipant(room, socket.id);
      const actualSlotId = participant?.slotId || currentSlotId;
      const isHostLeaving = participant ? isHostParticipant(room, participant) : false;
      room.participants.delete(socket.id);
      socket.leave(cleanId);

      const activeOnline = Array.from(room.participants.values()).filter(p => p.online);
      if (isHostLeaving) {
        rooms.delete(cleanId);
        io.to(cleanId).emit('room:closed', { message: 'Room was closed by host.' });
        if (callback) callback({ success: true, deleted: true });
        currentRoomId = null;
        currentSlotId = null;
        return;
      }

      if (activeOnline.length === 0) {
        room.lastActivity = Date.now();
      }

      if (!room.state.started && actualSlotId && !String(actualSlotId).startsWith('spectator-')) {
        room.state.slots = room.state.slots.filter(s => s.slotId !== actualSlotId);
      } else if (room.state.started && actualSlotId) {
        const slot = room.state.slots?.find(x => x.slotId === actualSlotId);
        if (slot && slot.mode === 'human') {
          slot.mode = 'bot';
          slot.name = slot.name.replace(/ \(AI\)$/i, '') + ' (AI)';
        }
      }

      io.to(cleanId).emit('room:presence', Array.from(room.participants.values()));
      io.to(cleanId).emit('room:state_sync', { state: room.state, source: 'player_left' });
      if (callback) callback({ success: true });
      currentRoomId = null;
      currentSlotId = null;
    } catch (err) {
      console.error('room:leave error:', err);
      if (callback) callback({ success: false, error: 'Server error leaving room.' });
    }
  });

  socket.on('room:player_ready', ({ roomId, isReady } = {}) => {
    const cleanId = cleanRoomId(roomId || currentRoomId);
    const room = getRoom(cleanId);
    const participant = room && getParticipant(room, socket.id);
    if (!room || !participant) return;
    const slot = getSlot(room, participant.slotId);
    if (!slot || slot.mode !== 'human') return;
    slot.isReady = !!isReady;
    room.state.stateRevision = Number(room.state.stateRevision || 0) + 1;
    io.to(cleanId).emit('room:player_ready_sync', {
      slotId: participant.slotId,
      teamId: slot.teamId || null,
      isReady: slot.isReady,
      playerName: participant.userName,
      state: room.state
    });
  });

  socket.on('room:chat', ({ roomId, message } = {}) => {
    const cleanId = cleanRoomId(roomId || currentRoomId);
    const room = getRoom(cleanId);
    const participant = room && getParticipant(room, socket.id);
    const cleanMessage = String(message || '').trim().slice(0, 140);
    if (!room || !participant || !cleanMessage) return;
    const slot = getSlot(room, participant.slotId);
    const team = getTeam(room, slot?.teamId);
    const chatItem = {
      id: 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      senderName: participant.userName,
      teamName: team?.name || slot?.teamId || '',
      teamLogo: team?.logo || '',
      message: cleanMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    io.to(cleanId).emit('room:chat_message', chatItem);
  });

  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = getRoom(currentRoomId);
    if (!room) return;
    const p = room.participants.get(socket.id);
    if (p) {
      p.online = false;
      p.disconnectedAt = Date.now();
      room.lastActivity = Date.now();
      io.to(currentRoomId).emit('room:presence', Array.from(room.participants.values()));
      console.log(`[DISCONNECT] ${p.userName} disconnected from room ${currentRoomId} (room preserved for reconnect/refresh)`);
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
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({
    status: 'ok',
    version: '1.1.0',
    roomsActive: rooms.size,
    localIps: getLocalIPAddresses(),
    publicUrl: publicUrlFromRequest(req)
  });
});

app.get('/api/room/:id', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
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
    console.log('  Same Wi-Fi URL:   http://' + ip + ':' + PORT);
  });
  console.log('------------------------------------------------------');
  console.log('  🌐 Public multiplayer URL: ' + PUBLIC_APP_URL);
  console.log('     Use this URL for devices on different Wi-Fi / Mobile Data.');
  console.log('======================================================\n');
});
