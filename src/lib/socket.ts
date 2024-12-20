import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

class SocketManager {
  private static instance: SocketManager;
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageQueue: Array<{ event: string; data: any }> = [];

  private constructor() {
    this.connect();
    this.setupListeners();
  }

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  private connect() {
    try {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        reconnection: true,
      });
    } catch (error) {
      console.error('Socket connection error:', error);
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.reconnectAttempts = 0;
      this.processMessageQueue();
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.attemptReconnect();
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.socket) {
        this.socket.emit(message.event, message.data);
      }
    }
  }

  public emit(event: string, data: any) {
    if (!this.socket) {
      console.warn('Socket not connected, adding to queue:', { event, data });
      this.messageQueue.push({ event, data });
      return;
    }
    this.socket.emit(event, data);
  }

  public on(event: string, callback: (...args: any[]) => void) {
    if (!this.socket) {
      console.warn('Socket not connected, event listener will be added when connected:', event);
      return;
    }
    this.socket.on(event, callback);
  }

  public off(event: string, callback: (...args: any[]) => void) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }
}

export const socketManager = SocketManager.getInstance();

export function useSocket() {
  return {
    socket: socketManager.getSocket(),
    emit: (event: string, data: any) => socketManager.emit(event, data),
    on: (event: string, callback: (...args: any[]) => void) => socketManager.on(event, callback),
    off: (event: string, callback: (...args: any[]) => void) => socketManager.off(event, callback),
  };
}