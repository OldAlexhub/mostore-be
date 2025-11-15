import mongoose from 'mongoose';

export const getHealth = async (req, res) => {
  // Check basic app responsiveness
  const app = { status: 'ok', uptime: process.uptime() };

  // Check mongoose connection state
  const connState = mongoose.connection.readyState; // 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
  const db = {
    state: connState,
    ok: connState === 1
  };

  // Optionally try a ping command if connected (safer to avoid extra operations)
  res.json({ app, db });
};
