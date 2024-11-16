import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-motor-output',
  standalone: true,
  imports: [
    CommonModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Output for Motors</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-grid>
          <ion-row>
            <ion-col size="6">
              <h2>Motor PWM</h2>
              <div id="motor-content">
                <span id="left-motor">
                  Left Motor PWM: 
                  <span id="left-motor-value">{{ leftMotorPWM || '_' }}</span>
                </span>
                <br />
                <span id="right-motor">
                  Right Motor PWM: 
                  <span id="right-motor-value">{{ rightMotorPWM || '_' }}</span>
                </span>
              </div>
            </ion-col>
            <ion-col size="6">
              <h2>Servo Pulse</h2>
              <div id="servo-content">
                <span id="left-servo">
                  Left Servo Pulse: 
                  <span id="left-servo-value">{{ leftServoPulse || '_' }}</span>µs
                </span>
                <br />
                <span id="right-servo">
                  Right Servo Pulse: 
                  <span id="right-servo-value">{{ rightServoPulse || '_' }}</span>µs
                </span>
              </div>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card-content>
    </ion-card>
  `,
})
export class MotorOutputComponent {
  @Input() leftMotorPWM: number | null = null; // Left motor PWM
  @Input() rightMotorPWM: number | null = null; // Right motor PWM
  @Input() leftServoPulse: number | null = null; // Left servo pulse width
  @Input() rightServoPulse: number | null = null; // Right servo pulse width
}
