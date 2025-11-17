export const ADMIN_ROOM = 'chat:admins';
const SESSION_PREFIX = 'chat:session:';

let ioInstance = null;

export const setSocketServer = (io) => {
  ioInstance = io;
};

export const getSocketServer = () => ioInstance;

export const sessionRoom = (sessionId) => `${SESSION_PREFIX}${sessionId}`;

export const emitToAdmins = (event, payload) => {
  if (!ioInstance) return;
  ioInstance.to(ADMIN_ROOM).emit(event, payload);
};

export const emitToSession = (sessionId, event, payload) => {
  if (!ioInstance || !sessionId) return;
  ioInstance.to(sessionRoom(sessionId)).emit(event, payload);
};
