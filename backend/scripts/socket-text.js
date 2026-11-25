import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('connected:', socket.id);
  socket.emit('system:ping', (res) => {
    console.log('ack:', res);
    socket.disconnect();
  });
});

socket.on('connect_error', (err) => {
  console.error('connection failed:', err.message);
  process.exit(1);
});