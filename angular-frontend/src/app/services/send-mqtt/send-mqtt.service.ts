import { Injectable } from '@angular/core';
import { io } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket = io('http://foucault:8080'); // Replace with your server address

  // Publishes an MQTT message to the specified topic
  publishMqttMessage(topic: string, message: string): Observable<void> {
    return new Observable<void>((observer: { next: () => void; complete: () => void; error: (arg0: any) => void; }) => {
      this.socket.emit('mqtt-publish', { topic, message }, (ack: { success: boolean; error?: any }) => {
        if (ack.success) {
          observer.next();
          observer.complete();
        } else {
          observer.error(ack.error || 'Failed to publish MQTT message');
        }
      });
    });
  }
}
