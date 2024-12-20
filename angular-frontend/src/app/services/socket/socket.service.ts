import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';

interface MqttMessage {
  topic: string;
  payload: string;
}

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;
  private connectSubject: Subject<void> = new Subject();
  private mqttMessageSubject: Subject<MqttMessage> = new Subject();

  constructor() {}

  // Connect to the Socket.IO server
  connect(url: string): void {
    if (!this.socket) {
      console.log('Connecting to ' + url);
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
      });

      // Listen for the 'connect' event
      this.socket.on('connect', () => {
        console.log('Connected to the server');
        this.connectSubject.next(); // Emit the connect event
      });

      // Listen for the 'mqtt-message' event
      this.socket.on('mqtt-message', (message: MqttMessage) => {
        this.mqttMessageSubject.next(message); // Emit the mqtt-message event
      });

      // Handle other events
      this.socket.on('connect_error', (err) => {
        console.error('Socket connection error: ', err);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from the server');
      });
    }
  }

  // Observable for the 'connect' event
  onConnect(): Observable<void> {
    return this.connectSubject.asObservable();
  }

  onEvent<T>(eventName: string): Observable<T> {
    if (!this.socket) {
      throw new Error('Socket is not connected');
    }

    const subject = new Subject<T>();

    // Listen for the specified event and emit the event data to the subject
    this.socket.on(eventName, (data: T) => {
      subject.next(data);
    });

    // Return the observable to the caller
    return subject.asObservable();
  }

  // Observable for the 'mqtt-message' event
  onMqttMessage(): Observable<MqttMessage> {
    return this.mqttMessageSubject.asObservable();
  }

  emit(event: string, message: any): void {
    this.socket?.emit(event, message);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

}
