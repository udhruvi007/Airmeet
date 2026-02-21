// socketmanager.js
import { Server } from "socket.io";

let connections = {}; // roomId -> [socketId... admitted users]
let waiting = {}; // roomId -> [{id,name,joinedAt}]
let messages = {}; // roomId -> [{sender,data,socketIdSender}]
let timeOnline = {}; // socketId -> Date
let socketMeta = {}; // socketId -> { roomId, name, role }
let roomHost = {}; // roomId -> hostSocketId

export const connectToSocket = (server) => {
  // ✅ allow Netlify + localhost both
  const allowedOrigins = [process.env.FRONTEND_URL, "http://localhost:3000"].filter(Boolean);

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // ✅ on Render websocket kabhi-kabhi drop hota hai, polling fallback helpful
    transports: ["websocket", "polling"],
  });

  // ---------------------------
  // helpers (safe)
  // ---------------------------
  const safeId = (x) => (typeof x === "string" ? x : String(x ?? ""));
  const shortId = (x) => safeId(x).slice(0, 5);
  const safeName = (n) => (typeof n === "string" ? n.trim() : "");
  const findRoomOfSocket = (sid) => socketMeta[sid]?.roomId || "";

  const ensureRoomArrays = (roomId) => {
    if (!connections[roomId]) connections[roomId] = [];
    if (!waiting[roomId]) waiting[roomId] = [];
    if (!messages[roomId]) messages[roomId] = [];
  };

  // ✅ frontend ko ids nahi, proper objects bhejo {id,name,role}
  const buildParticipantsPayload = (roomId) => {
    const ids = connections[roomId] || [];
    return ids
      .filter(Boolean)
      .map((sid) => ({
        id: sid,
        name: safeName(socketMeta[sid]?.name) || `Guest-${shortId(sid)}`,
        role: socketMeta[sid]?.role || "guest",
      }));
  };

  const emitWaitingUpdate = (roomId) => {
    const hostId = roomHost[roomId];
    if (!hostId) return;
    io.to(hostId).emit("waiting-update", waiting[roomId] || []);
  };

  const emitParticipantsUpdate = (roomId) => {
    const ids = connections[roomId] || [];
    const payload = buildParticipantsPayload(roomId);
    ids.forEach((sid) => {
      if (sid) io.to(sid).emit("participants-update", payload);
    });
  };

  io.on("connection", (socket) => {
    console.log("SOCKET CONNECTED:", socket.id);
    timeOnline[socket.id] = new Date();

    // ---------------------------
    // JOIN FLOW (waiting room)
    // ---------------------------
    socket.on("join-room", ({ roomId, name }) => {
      if (!roomId) return;

      ensureRoomArrays(roomId);

      // save meta safely
      socketMeta[socket.id] = {
        roomId,
        name: safeName(name) || "Guest",
        role: "guest",
      };

      // first user becomes host
      if (!roomHost[roomId]) {
        roomHost[roomId] = socket.id;
        socketMeta[socket.id].role = "host";

        // prevent duplicates
        if (!connections[roomId].includes(socket.id)) {
          connections[roomId].push(socket.id);
        }

        io.to(socket.id).emit("join-approved", {
          role: "host",
          participants: buildParticipantsPayload(roomId),
          waiting: waiting[roomId] || [],
        });

        // replay chat history
        (messages[roomId] || []).forEach((m) => {
          io.to(socket.id).emit("chat-message", m.data, m.sender, m.socketIdSender);
        });

        emitParticipantsUpdate(roomId);
        emitWaitingUpdate(roomId);
        return;
      }

      // room exists => waiting room
      // ensure not duplicate in waiting
      waiting[roomId] = (waiting[roomId] || []).filter((p) => p.id !== socket.id);
      waiting[roomId].push({
        id: socket.id,
        name: socketMeta[socket.id].name || "Guest",
        joinedAt: Date.now(),
      });

      io.to(socket.id).emit("waiting");
      emitWaitingUpdate(roomId);
    });

    // ---------------------------
    // HOST admits user
    // ---------------------------
    socket.on("admit-user", ({ roomId, targetId }) => {
      if (!roomId || !targetId) return;
      ensureRoomArrays(roomId);

      // only host
      if (roomHost[roomId] !== socket.id) return;

      const list = waiting[roomId] || [];
      const person = list.find((p) => p.id === targetId);
      if (!person) return;

      // remove from waiting
      waiting[roomId] = list.filter((p) => p.id !== targetId);

      // add to admitted list (no dup)
      if (!connections[roomId].includes(targetId)) {
        connections[roomId].push(targetId);
      }

      // ensure target meta exists
      socketMeta[targetId] = {
        roomId,
        name: safeName(socketMeta[targetId]?.name) || safeName(person.name) || "Guest",
        role: "guest",
      };

      io.to(targetId).emit("join-approved", {
        role: "guest",
        participants: buildParticipantsPayload(roomId),
        waiting: waiting[roomId] || [],
      });

      // notify everyone someone joined
      (connections[roomId] || []).forEach((sid) => {
        if (sid) io.to(sid).emit("user-joined", targetId, buildParticipantsPayload(roomId));
      });

      // replay chat to admitted user
      (messages[roomId] || []).forEach((m) => {
        io.to(targetId).emit("chat-message", m.data, m.sender, m.socketIdSender);
      });

      emitWaitingUpdate(roomId);
      emitParticipantsUpdate(roomId);
    });

    // ---------------------------
    // HOST denies user
    // ---------------------------
    socket.on("deny-user", ({ roomId, targetId }) => {
      if (!roomId || !targetId) return;
      if (roomHost[roomId] !== socket.id) return;

      waiting[roomId] = (waiting[roomId] || []).filter((p) => p.id !== targetId);
      io.to(targetId).emit("denied");
      emitWaitingUpdate(roomId);
    });

    // ---------------------------
    // WebRTC signaling (unchanged)
    // ---------------------------
    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    // ---------------------------
    // Chat (admitted only)
    // ---------------------------
    socket.on("chat-message", (data, sender) => {
      const roomId = findRoomOfSocket(socket.id);
      if (!roomId) return;

      const admitted = (connections[roomId] || []).includes(socket.id);
      if (!admitted) return;

      if (!messages[roomId]) messages[roomId] = [];
      messages[roomId].push({ sender, data, socketIdSender: socket.id });

      (connections[roomId] || []).forEach((sid) => {
        if (sid) io.to(sid).emit("chat-message", data, sender, socket.id);
      });
    });

    // ---------------------------
    // Hand raise broadcast (admitted only)
    // ---------------------------
    socket.on("hand-raise", ({ raised, name }) => {
      const roomId = findRoomOfSocket(socket.id);
      if (!roomId) return;

      const admitted = (connections[roomId] || []).includes(socket.id);
      if (!admitted) return;

      const finalName = safeName(name) || safeName(socketMeta[socket.id]?.name) || "Guest";

      (connections[roomId] || []).forEach((sid) => {
        if (sid) {
          io.to(sid).emit("hand-raise", {
            id: socket.id,
            name: finalName,
            raised: !!raised,
          });
        }
      });
    });

    // ---------------------------
    // Reaction broadcast (admitted only)
    // ---------------------------
    socket.on("reaction", ({ emoji, name }) => {
      const roomId = findRoomOfSocket(socket.id);
      if (!roomId) return;

      const admitted = (connections[roomId] || []).includes(socket.id);
      if (!admitted) return;

      const finalName = safeName(name) || safeName(socketMeta[socket.id]?.name) || "Guest";

      (connections[roomId] || []).forEach((sid) => {
        if (sid) {
          io.to(sid).emit("reaction", {
            id: socket.id,
            name: finalName,
            emoji,
          });
        }
      });
    });

    // ---------------------------
    // Disconnect cleanup
    // ---------------------------
    socket.on("disconnect", () => {
      const roomId = findRoomOfSocket(socket.id);

      if (roomId) {
        // remove from waiting
        if (waiting[roomId]) {
          waiting[roomId] = waiting[roomId].filter((p) => p.id !== socket.id);
          emitWaitingUpdate(roomId);
        }

        // remove from connections
        if (connections[roomId]) {
          connections[roomId] = connections[roomId].filter((id) => id !== socket.id);

          // tell others user left
          (connections[roomId] || []).forEach((sid) => {
            if (sid) io.to(sid).emit("user-left", socket.id);
          });

          // if host left -> assign new host or cleanup
          if (roomHost[roomId] === socket.id) {
            const newHost = connections[roomId][0];
            if (newHost) {
              roomHost[roomId] = newHost;
              if (socketMeta[newHost]) socketMeta[newHost].role = "host";
              io.to(newHost).emit("host-changed");
            } else {
              delete roomHost[roomId];
              delete connections[roomId];
              delete waiting[roomId];
              delete messages[roomId];
            }
          } else {
            if ((connections[roomId] || []).length === 0) {
              delete connections[roomId];
              delete waiting[roomId];
              delete messages[roomId];
              delete roomHost[roomId];
            }
          }

          emitParticipantsUpdate(roomId);
        }
      }

      delete socketMeta[socket.id];
      delete timeOnline[socket.id];
    });
  });

  return io;
};