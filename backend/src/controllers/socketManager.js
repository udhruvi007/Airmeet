import { Server } from "socket.io";

let connections = {};      // roomId -> [socketId... admitted users]
let waiting = {};          // roomId -> [{id,name,joinedAt}]
let messages = {};         // roomId -> [{sender,data,socketIdSender}]
let timeOnline = {};       // socketId -> Date
let socketMeta = {};       // socketId -> { roomId, name, role }  role: "host"|"guest"
let roomHost = {};         // roomId -> hostSocketId

export const connectToSocket = (server) => {
    const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});


  const emitWaitingUpdate = (roomId) => {
    const hostId = roomHost[roomId];
    if (!hostId) return;
    io.to(hostId).emit("waiting-update", waiting[roomId] || []);
  };

  const emitParticipantsUpdate = (roomId) => {
    const ids = connections[roomId] || [];
    // host + all participants ko list bhej do
    ids.forEach((sid) => {
      io.to(sid).emit("participants-update", ids);
    });
  };

  const findRoomOfSocket = (sid) => socketMeta[sid]?.roomId || "";

  io.on("connection", (socket) => {
    console.log("SOCKET CONNECTED:", socket.id);
    timeOnline[socket.id] = new Date();

    // ✅ JOIN FLOW with waiting room
    // Frontend will emit: socket.emit("join-room", { roomId, name })
    socket.on("join-room", ({ roomId, name }) => {
      if (!roomId) return;

      // first user becomes host
      if (!roomHost[roomId]) {
        roomHost[roomId] = socket.id;

        if (!connections[roomId]) connections[roomId] = [];
        connections[roomId].push(socket.id);

        socketMeta[socket.id] = { roomId, name: name || "Host", role: "host" };

        io.to(socket.id).emit("join-approved", {
          role: "host",
          participants: connections[roomId],
          waiting: waiting[roomId] || [],
        });

        // existing messages bhej do
        if (messages[roomId]) {
          messages[roomId].forEach((m) => {
            io.to(socket.id).emit("chat-message", m.data, m.sender, m.socketIdSender);
          });
        }

        emitParticipantsUpdate(roomId);
        return;
      }

      // room exists => go to waiting
      if (!waiting[roomId]) waiting[roomId] = [];
      waiting[roomId].push({ id: socket.id, name: name || "Guest", joinedAt: Date.now() });

      socketMeta[socket.id] = { roomId, name: name || "Guest", role: "guest" };

      io.to(socket.id).emit("waiting"); // client UI show "Waiting for host…"
      emitWaitingUpdate(roomId);
    });

    // ✅ Host admits user
    // Frontend host emits: socket.emit("admit-user", { roomId, targetId })
    socket.on("admit-user", ({ roomId, targetId }) => {
      if (!roomId || !targetId) return;

      // only host can admit
      if (roomHost[roomId] !== socket.id) return;

      const list = waiting[roomId] || [];
      const person = list.find((p) => p.id === targetId);
      if (!person) return;

      waiting[roomId] = list.filter((p) => p.id !== targetId);

      if (!connections[roomId]) connections[roomId] = [];
      if (!connections[roomId].includes(targetId)) connections[roomId].push(targetId);

      io.to(targetId).emit("join-approved", {
        role: "guest",
        participants: connections[roomId],
        waiting: waiting[roomId] || [],
      });

      // notify all participants that a user joined
      connections[roomId].forEach((sid) => {
        io.to(sid).emit("user-joined", targetId, connections[roomId]);
      });

      // replay chat history to admitted user
      if (messages[roomId]) {
        messages[roomId].forEach((m) => {
          io.to(targetId).emit("chat-message", m.data, m.sender, m.socketIdSender);
        });
      }

      emitWaitingUpdate(roomId);
      emitParticipantsUpdate(roomId);
    });

    // ✅ Host denies user
    socket.on("deny-user", ({ roomId, targetId }) => {
      if (!roomId || !targetId) return;
      if (roomHost[roomId] !== socket.id) return;

      waiting[roomId] = (waiting[roomId] || []).filter((p) => p.id !== targetId);
      io.to(targetId).emit("denied");
      // optionally kick them:
      // io.sockets.sockets.get(targetId)?.disconnect(true);

      emitWaitingUpdate(roomId);
    });

    // ✅ Keep your existing signaling (WebRTC)
    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    // ✅ Chat only for admitted users
    socket.on("chat-message", (data, sender) => {
      const roomId = findRoomOfSocket(socket.id);
      if (!roomId) return;

      // only allow if admitted
      const admitted = (connections[roomId] || []).includes(socket.id);
      if (!admitted) return;

      if (!messages[roomId]) messages[roomId] = [];
      messages[roomId].push({ sender, data, socketIdSender: socket.id });

      (connections[roomId] || []).forEach((sid) => {
        io.to(sid).emit("chat-message", data, sender, socket.id);
      });
    });

    socket.on("disconnect", () => {
      const roomId = findRoomOfSocket(socket.id);

      // remove from waiting
      if (roomId && waiting[roomId]) {
        waiting[roomId] = waiting[roomId].filter((p) => p.id !== socket.id);
        emitWaitingUpdate(roomId);
      }

      // remove from connections
      if (roomId && connections[roomId]) {
        connections[roomId] = connections[roomId].filter((id) => id !== socket.id);
        // tell others user left
        (connections[roomId] || []).forEach((sid) => io.to(sid).emit("user-left", socket.id));

        // if host left -> assign new host (first participant) else delete room
        if (roomHost[roomId] === socket.id) {
          const newHost = connections[roomId][0];
          if (newHost) {
            roomHost[roomId] = newHost;
            io.to(newHost).emit("host-changed"); // optional
          } else {
            delete roomHost[roomId];
            delete connections[roomId];
            delete waiting[roomId];
            delete messages[roomId];
          }
        } else {
          if (connections[roomId].length === 0) {
            delete connections[roomId];
            delete waiting[roomId];
            delete messages[roomId];
            delete roomHost[roomId];
          }
        }

        emitParticipantsUpdate(roomId);
      }

      delete socketMeta[socket.id];
      delete timeOnline[socket.id];
    });
  });

  return io;
};
