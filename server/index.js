const { createWebRtcTransport } = require("./mediasoup/transport");

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const { createWorker } = require("./mediasoup/worker");
const { createRouter } = require("./mediasoup/router");
const { createRoom, getRoom, removePeer } = require("./mediasoup/rooms");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let worker;

(async () => {
  worker = await createWorker();
})();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

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
    async ({ transportId, kind, rtpParameters }, callback) => {
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
        });
        console.log(
          `📢 Sent new-producer to room ${
            socket.roomId
          }: ${producer.id.substring(0, 8)} from peer ${socket.id.substring(
            0,
            8
          )}`
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

  socket.on("join-room", async (roomId) => {
    const room = await createRoom(roomId, worker, createRouter);

    room.peers.set(socket.id, {
      socket,
      transports: [],
      producers: [],
      consumers: [],
    });

    socket.roomId = roomId;

    // ✅ Join socket.io room so broadcasts work
    socket.join(roomId);
    console.log(`✅ Socket ${socket.id.substring(0, 8)} joined room ${roomId}`);

    socket.emit("router-rtp-capabilities", room.router.rtpCapabilities);
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (roomId) {
      // ✅ Notify others that this peer is leaving
      socket.to(roomId).emit("peer-left", {
        peerId: socket.id,
      });
      console.log(`📢 Peer ${socket.id.substring(0, 8)} left room ${roomId}`);

      removePeer(roomId, socket.id);
    }
  });
});

server.listen(4000, () => {
  console.log("SFU server running on port 4000");
});
