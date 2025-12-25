const rooms = new Map();

async function createRoom(roomId, worker, createRouter) {
  if (rooms.has(roomId)) {
    return rooms.get(roomId);
  }

  const router = await createRouter(worker);

  const room = {
    id: roomId,
    router,
    peers: new Map()
  };

  rooms.set(roomId, room);
  console.log(`Room ${roomId} created`);

  return room;
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function removePeer(roomId, peerId) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.peers.delete(peerId);

  if (room.peers.size === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted`);
  }
}

module.exports = {
  createRoom,
  getRoom,
  removePeer
};
