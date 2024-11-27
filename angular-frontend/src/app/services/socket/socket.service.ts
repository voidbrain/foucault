import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;

  constructor() {}

  connect(url: string): void {
    if (!this.socket) {
      this.socket = io(url);
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  onEvent<T>(event: string): Observable<T> {
    return new Observable((observer) => {
      this.socket?.on(event, (data: T) => observer.next(data));
      return () => this.socket?.off(event);
    });
  }

  emit(event: string, message: any): void {
    this.socket?.emit(event, message);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}
