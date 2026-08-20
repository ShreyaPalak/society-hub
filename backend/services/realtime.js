let io = null;

function configureRealtime(socketServer) {
  io = socketServer;
}

function emitComplaintCreated(complaint) {
  if (io) io.to('admin_room').emit('complaint:created', { complaint });
}

function emitComplaintUpdated(complaint) {
  if (io) io.to(`resident_${complaint.resident_id}`).emit('complaint:updated', { complaint });
}

module.exports = { configureRealtime, emitComplaintCreated, emitComplaintUpdated };
