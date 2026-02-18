// Load environment variables first
require('dotenv').config();

const { createWebRtcTransport } = require("./mediasoup/transport");

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const { createWorker } = require("./mediasoup/worker");
const { createRouter } = require("./mediasoup/router");
const { createRoom, getRoom, removePeer } = require("./mediasoup/rooms");

// Auth imports
const connectDB = require("./config/db");
const routes = require("./routes");
const { socketAuthMiddleware } = require("./middleware/socketAuth");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api", routes);

let worker;

(async () => {
  // Connect to MongoDB
  await connectDB();
  
  worker = await createWorker();
})();

// Socket.IO Authentication Middleware
io.use(socketAuthMiddleware);

io.on("connection", (socket) => {
  // Now socket.user contains authenticated user info
  console.log(`Client connected: ${socket.id} (${socket.user?.name || 'Unknown'})`);


  socket.on("create-transport", async ({ direction }, callback) => {
    const room = getRoom(socket.roomId);
    const peer = room.peers.get(socket.id);

    const { transport, params } = await createWebRtcTransport(room.router);

    transport.appData = { direction }; // 🔥 FIX HERE
    peer.transports.push(transport);

    callback(params);
  });

  socket.on("connect-transport", async ({ transportId, dtlsParameters }) => {
    const room = getRoom(socket.roomId);
    const peer = room.peers.get(socket.id);

    const transport = peer.transports.find((t) => t.id === transportId);
    await transport.connect({ dtlsParameters });
  });

  // PRODUCE (client sends audio/video)
  socket.on(
    "produce",
    async ({ transportId, kind, rtpParameters, isScreenShare }, callback) => {
      try {
        const room = getRoom(socket.roomId);
        if (!room) {
          console.error("❌ Room not found for roomId:", socket.roomId);
          return;
        }

        const peer = room.peers.get(socket.id);
        if (!peer) {
          console.error("❌ Peer not found for socket:", socket.id);
          return;
        }

        const transport = peer.transports.find((t) => t.id === transportId);
        if (!transport) {
          console.error("❌ Transport not found:", transportId);
          return;
        }

        const producer = await transport.produce({ kind, rtpParameters });
        console.log(
          `✅ Producer created: ${
            producer.id
          } (${kind}) from peer ${socket.id.substring(0, 8)}`
        );
        peer.producers.push(producer);

        // Notify others to consume this producer (include peerId for grouping audio+video)
        socket.to(socket.roomId).emit("new-producer", {
          producerId: producer.id,
          peerId: socket.id,
          kind,
          isScreenShare: isScreenShare || false,
        });
        console.log(
          `📢 Sent new-producer to room ${
            socket.roomId
          }: ${producer.id.substring(0, 8)} from peer ${socket.id.substring(
            0,
            8
          )} (screenShare: ${isScreenShare || false})`
        );

        callback({ id: producer.id });
      } catch (error) {
        console.error("❌ Error in produce:", error.message);
        callback({ error: error.message });
      }
    }
  );

  // CONSUME (client receives audio/video)
  socket.on("consume", async ({ producerId, rtpCapabilities }, callback) => {
    try {
      const room = getRoom(socket.roomId);
      if (!room) {
        console.error("❌ Room not found for consume");
        return;
      }

      const peer = room.peers.get(socket.id);
      if (!peer) {
        console.error("❌ Peer not found for consume");
        return;
      }

      const transport = peer.transports.find(
        (t) => t.appData.direction === "recv"
      );

      if (!transport) {
        console.error(
          "❌ No recv transport found for peer:",
          socket.id.substring(0, 8)
        );
        return;
      }

      // ✅ Find the producer being consumed
      let sourceProducer = null;
      for (const [peerId, otherPeer] of room.peers.entries()) {
        const prod = otherPeer.producers.find((p) => p.id === producerId);
        if (prod) {
          sourceProducer = prod;
          break;
        }
      }

      if (!sourceProducer) {
        console.error("❌ Producer not found:", producerId);
        return;
      }

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });

      peer.consumers.push(consumer);

      console.log(
        `✅ Consumer created: ${
          consumer.id
        } for producer: ${producerId.substring(0, 8)} (${consumer.kind})`
      );

      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (error) {
      console.error("❌ Error in consume:", error.message);
      callback({ error: error.message });
    }
  });

  socket.on("get-producers", (callback) => {
    const room = getRoom(socket.roomId);
    if (!room) return callback([]);

    const producers = [];

    for (const [peerId, peer] of room.peers.entries()) {
      if (peerId === socket.id) continue;

      peer.producers.forEach((producer) => {
        producers.push({
          producerId: producer.id,
          peerId: peerId,
        });
      });
    }

    callback(producers);
  });

  // RESUME CONSUMER
  socket.on("resume-consumer", async ({ consumerId }) => {
    try {
      const room = getRoom(socket.roomId);
      if (!room) {
        console.error("❌ Room not found for resume-consumer");
        return;
      }

      const peer = room.peers.get(socket.id);
      if (!peer) {
        console.error("❌ Peer not found for resume-consumer");
        return;
      }

      const consumer = peer.consumers.find((c) => c.id === consumerId);
      if (!consumer) {
        console.error("❌ Consumer not found:", consumerId);
        return;
      }

      await consumer.resume();
      console.log(`✅ Consumer resumed: ${consumerId.substring(0, 8)}`);
    } catch (error) {
      console.error("❌ Error resuming consumer:", error.message);
    }
  });

  socket.on("join-room", async ({ roomId, userName }) => {
    const room = await createRoom(roomId, worker, createRouter);

    // Use authenticated user info if available, fallback to provided userName
    const userInfo = socket.user || { name: userName || "Guest" };

    room.peers.set(socket.id, {
      socket,
      userName: userInfo.name,
      userId: userInfo.userId || null,
      userRole: userInfo.role || 'guest',
      transports: [],
      producers: [],
      consumers: [],
    });

    socket.roomId = roomId;
    socket.userName = userInfo.name;

    // ✅ Join socket.io room so broadcasts work
    socket.join(roomId);
    console.log(
      `✅ Socket ${socket.id.substring(
        0,
        8
      )} (${userInfo.name} - ${userInfo.role || 'guest'}) joined room ${roomId}`
    );

    // ✅ Notify all peers about new participant
    io.to(roomId).emit("participant-joined", {
      participantCount: room.peers.size,
    });

    socket.emit("router-rtp-capabilities", room.router.rtpCapabilities);
  });

  // 💬 Chat message handler
  socket.on("chat-message", ({ message, senderName, timestamp }) => {
    const roomId = socket.roomId;
    if (roomId) {
      // Broadcast message to all peers in the room
      io.to(roomId).emit("chat-message", {
        senderId: socket.id,
        senderName: senderName || socket.userName || "Guest",
        message,
        timestamp,
      });
      console.log(
        `💬 Chat from ${socket.userName} (${socket.id.substring(
          0,
          8
        )}): ${message.substring(0, 50)}`
      );
    }
  });

  // 📺 Screen share stopped handler
  socket.on("screen-share-stopped", () => {
    const roomId = socket.roomId;
    if (roomId) {
      // Broadcast to all peers in the room except sender
      socket.to(roomId).emit("screen-share-stopped", {
        peerId: socket.id,
      });
      console.log(`🛑 Screen share stopped by ${socket.id.substring(0, 8)}`);
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (roomId) {
      const room = getRoom(roomId);

      // ✅ Notify others that this peer is leaving
      socket.to(roomId).emit("peer-left", {
        peerId: socket.id,
      });
      console.log(`📢 Peer ${socket.id.substring(0, 8)} left room ${roomId}`);

      removePeer(roomId, socket.id);

      // ✅ Update participant count for remaining peers
      if (room && room.peers.size > 0) {
        socket.to(roomId).emit("participant-left", {
          participantCount: room.peers.size,
        });
      }
    }
  });
});

server.listen(4000, () => {
  console.log("SFU server running on port 4000");
});
