import { io } from 'socket.io-client';
import { API_BASE_URL } from '../constants';

/**
 * Shared, authenticated Socket.IO client.
 *
 * One connection per tab. Pages call getSocket() + joinClassRoom()/leaveClassRoom() and remove
 * their own listeners on unmount; nobody but disconnectSocket() (logout) closes the connection.
 * Joined rooms are remembered so they are re-joined after an automatic reconnect.
 */
let socket = null;
const joinedRooms = new Map(); // classId -> number of active subscribers

const readToken = () => {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

export function getSocket() {
  if (socket) return socket;
  socket = io(API_BASE_URL, {
    // Evaluated on every (re)connect so a fresh login's token is used without recreating the socket.
    auth: (cb) => cb({ token: readToken() }),
    // WebSocket only: long-polling needs sticky sessions, which break when the API runs as several
    // processes (PM2 cluster / multiple instances). nginx already forwards the Upgrade header.
    transports: ['websocket'],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  socket.on('connect', () => {
    for (const classId of joinedRooms.keys()) emitJoin(socket, classId);
  });
  return socket;
}

/** `joinClass` is acked `{ ok, error }`; a refused join (not enrolled, bad token) is dropped from the room set. */
function emitJoin(s, classId) {
  s.emit('joinClass', classId, (ack) => {
    if (ack && ack.ok === false) joinedRooms.delete(classId);
  });
}

export function joinClassRoom(classId) {
  if (!classId) return;
  const key = String(classId);
  const s = getSocket();
  joinedRooms.set(key, (joinedRooms.get(key) || 0) + 1);
  if (s.connected) emitJoin(s, key);
}

export function leaveClassRoom(classId) {
  if (!classId || !socket) return;
  const key = String(classId);
  const remaining = (joinedRooms.get(key) || 0) - 1;
  if (remaining > 0) {
    joinedRooms.set(key, remaining);
    return;
  }
  joinedRooms.delete(key);
  if (socket.connected) socket.emit('leaveClass', key);
}

export function disconnectSocket() {
  joinedRooms.clear();
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
