import ChatSession from '../models/ChatSession.js';
import { ADMIN_ROOM, emitToAdmins, sessionRoom } from './socketState.js';

const sanitizeMessage = (text = '') => {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.slice(0, 1000);
};

const sessionSummary = (session) => {
  const lastMessage = Array.isArray(session.messages) && session.messages.length
    ? session.messages[session.messages.length - 1]
    : null;
  return {
    _id: session._id,
    customerName: session.customerName,
    customerPhone: session.customerPhone,
    orderNumber: session.orderNumber,
    status: session.status,
    lastMessageAt: session.lastMessageAt,
    messagesCount: Array.isArray(session.messages) ? session.messages.length : 0,
    startedAsGuest: !!session.startedAsGuest,
    lastSender: lastMessage?.sender || null,
    lastText: lastMessage?.text || ''
  };
};

const messagePayload = (sessionId, message) => ({
  sessionId,
  message: {
    sender: message.sender,
    text: message.text,
    createdAt: message.createdAt
  }
});

export default function registerChatHandlers(io) {
  io.on('connection', (socket) => {
    const { sessionId, role } = socket.handshake.query || {};

    if (role === 'admin') {
      socket.join(ADMIN_ROOM);
    }

    if (sessionId) {
      socket.join(sessionRoom(sessionId));
    }

    socket.on('chat:join', ({ sessionId: joinId }) => {
      if (!joinId) return;
      socket.join(sessionRoom(joinId));
    });

    socket.on('chat:leave', ({ sessionId: leaveId }) => {
      if (!leaveId) return;
      socket.leave(sessionRoom(leaveId));
    });

    socket.on('chat:message', async ({ sessionId: msgSessionId, sender, text }) => {
      try {
        if (!msgSessionId) return;
        const clean = sanitizeMessage(text);
        if (!clean) return;

        const validSender = sender === 'admin' ? 'admin' : 'customer';
        const message = { sender: validSender, text: clean, createdAt: new Date() };

        const session = await ChatSession.findOneAndUpdate(
          { _id: msgSessionId, status: 'open' },
          {
            $push: { messages: message },
            $set: { lastMessageAt: message.createdAt }
          },
          { new: true }
        );

        if (!session) return;

        const payload = messagePayload(msgSessionId, message);
        io.to(sessionRoom(msgSessionId)).emit('chat:message', payload);
        emitToAdmins('chat:message', payload);
        emitToAdmins('chat:sessionUpdated', sessionSummary(session));
      } catch (err) {
        console.error('[chat:message] error', err);
      }
    });

    socket.on('chat:close', async ({ sessionId: closeId, closedBy }) => {
      try {
        if (!closeId) return;
        const now = new Date();
        const session = await ChatSession.findOneAndUpdate(
          { _id: closeId, status: 'open' },
          { $set: { status: 'closed', closedAt: now, lastMessageAt: now } },
          { new: true }
        );
        if (!session) return;
        if (closedBy) {
          const systemMessage = {
            sender: 'system',
            text: `${closedBy} أغلق المحادثة`,
            createdAt: now
          };
          session.messages.push(systemMessage);
          session.lastMessageAt = now;
          await session.save();
        }
        io.to(sessionRoom(closeId)).emit('chat:sessionClosed', { sessionId: closeId });
        emitToAdmins('chat:sessionClosed', { sessionId: closeId });
        emitToAdmins('chat:sessionUpdated', sessionSummary(session));
      } catch (err) {
        console.error('[chat:close] error', err);
      }
    });
  });
}
