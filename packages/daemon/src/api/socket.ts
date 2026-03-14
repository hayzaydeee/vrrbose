import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { Event } from '@vrrbose/shared';

export function createSocketServer(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:7331'],
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('[socket] client connected:', socket.id);

    socket.on('subscribe:project', (projectId: string) => {
      socket.join(`project:${projectId}`);
    });

    socket.on('disconnect', () => {
      console.log('[socket] client disconnected:', socket.id);
    });
  });

  return io;
}

export function broadcastEvent(io: SocketServer, projectId: string, event: Event): void {
  io.to(`project:${projectId}`).emit('event', event);
}
