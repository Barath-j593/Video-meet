const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", socket => {

  socket.on("join-room", roomId => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.to(roomId).emit("user-joined", socket.id);
  });

  socket.on("leave-room", () => {
    const roomId = socket.roomId;
    if (roomId) {
      socket.to(roomId).emit("user-left", socket.id);
      socket.leave(roomId);
    }
  });

  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (roomId) {
      socket.to(roomId).emit("user-left", socket.id);
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
