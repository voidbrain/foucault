import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonRow,
  IonButton,
  IonGrid,
  IonCol,
  IonCard,
  IonText,
  IonCardContent,
  IonCardTitle,
  IonCardHeader,
  IonLabel,
  IonRange,
  IonToggle,
  IonItem
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-control',
  standalone: true,
  imports: [
    IonRow,
    IonButton,
    IonGrid,
    IonCol,
    IonCard,
    IonText,
    IonCardContent,
    IonCardTitle,
    IonCardHeader,
    IonLabel,
    IonRange,
    IonToggle,
    IonItem,
    CommonModule,
    FormsModule,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Controls</ion-card-title>
      </ion-card-header>
      <ion-card-content>
      <ion-grid>
      <ion-row>
      <ion-col [size]="6">
        <ion-range
          [value]="heightLevelIndex"
          min="0"
          max="2"
          step="1"
          snaps="true"
          color="primary"
          (ionChange)="adjustHeightEventFromSlider($event)"
        >
          <ion-label slot="start">1</ion-label>
          <ion-label slot="end">3</ion-label>
        </ion-range>
        <div>{{ heights[heightLevelIndex] }}</div>

        <ion-toggle
          [checked]="isSensorAdjustmentEnabled"
          (ionChange)="toggleEnableSensor()"
        >
          Enable Sensor Adjustments
        </ion-toggle>

        <ion-button (click)="sendStopCommand()">Stop</ion-button>
        </ion-col>
        <ion-col size="6">
                  <ion-grid>
                    <ion-row>
                      <ion-col size="3" class="ion-text-center">
                        
                          <label>Kp</label>
                            <input
                              [(ngModel)]="Kp"
                              type="number"
                              placeholder="Kp"
                              (change)="updatePID()"
                            />
                          
                        
                      </ion-col>
                  
                      <ion-col size="3" class="ion-text-center">
                        
                          
                          <label>Ki</label>
                          <input
                            [(ngModel)]="Ki"
                            type="number"
                            placeholder="Ki"
                            (change)="updatePID()"
                          />
                        
                        
                      </ion-col>
                  
                      <ion-col size="3" class="ion-text-center">
                        
                          
                        <label>Kd</label>
                          <input
                            [(ngModel)]="Kd"
                            type="number"
                            placeholder="Kd"
                            (change)="updatePID()"
                          />
                        
                        
                      </ion-col>
                      <ion-col size="3" class="ion-text-center">
                        
                          
                       <label>Increment °</label>
                          <input
                            [(ngModel)]="incrementDegree"
                            type="number"
                            placeholder="incrementDegree"
                            (change)="updateIncrementDegree()"
                          />
                        
                        
                      </ion-col>
                    </ion-row>
                    <ion-row>
                      <ion-col size="12" class="ion-text-center">
                        <ion-button (click)="sendControlCommand(topics.output.walkForward)"
                        [class]="walkForwardActive ? 'pulse-effect' : ''"
                          >W</ion-button
                        >
                      </ion-col>
                    </ion-row>
                    <ion-row>
                      <ion-col size="4" class="ion-text-center">
                        <ion-button (click)="sendControlCommand(topics.output.walkLeft)"
                        [class]="walkLeftActive ? 'pulse-effect' : ''"
                          >A</ion-button
                        >
                      </ion-col>
                      <ion-col size="4" class="ion-text-center">
                        <ion-button (click)="sendControlCommand(topics.output.walkBackward)"
                        [class]="walkBackwardActive ? 'pulse-effect' : ''"
                          >S</ion-button
                        >
                      </ion-col>
                      <ion-col size="4" class="ion-text-center">
                        <ion-button (click)="sendControlCommand(topics.output.walkRight)"
                        [class]="walkRightActive ? 'pulse-effect' : ''"
                          >D</ion-button
                        >
                      </ion-col>
                    </ion-row>
                  </ion-grid>
                </ion-col>
              </ion-row>
            </ion-grid>
      </ion-card-content>
    </ion-card>
  `,
})
export class ControlComponent {
  @Input() heights: string[] = [];
  @Input() heightLevelIndex: number = 0;
  @Input() isSensorAdjustmentEnabled: boolean = false;

  @Output() heightChanged = new EventEmitter<number>();
  @Output() sensorToggled = new EventEmitter<boolean>();
  @Output() stopCommand = new EventEmitter<void>();
  @Output() controlCommand = new EventEmitter<string>();
  @Output() degreeChanged = new EventEmitter<number>();

  @Input() Kp: number = 0;
  @Input() Ki: number = 0;
  @Input() Kd: number = 0;
  @Input() incrementDegree: number = 0;

  walkForwardActive: boolean = false;
  walkLeftActive: boolean = false;
  walkBackwardActive: boolean = false;
  walkRightActive: boolean = false;

  topics = {
    input: {
      console: 'console/log',
      accelData: 'controller/accelData',
      tiltAngles: 'controller/tiltAngles',
      motorLeft: 'controller/motorPWM/left',
      motorRight: 'controller/motorPWM/right',
      servoLeft: 'controller/servoPulseWidth/left',
      servoRight: 'controller/servoPulseWidth/right',

      walkForward: "pid/move/forward",
      walkBackward: "pid/move/backward",
      walkLeft: "pid/move/left",
      walkRight: "pid/move/right",
      setHeightLow: "pid/set/height/low",
      setHeightMid: "pid/set/height/mid",
      setHeightHigh: "pid/set/height/high",
      enableSensorAdjustementsTrue: "pid/sensor/enable/true",
      enableSensorAdjustementsFalse: "pid/sensor/enable/false",
      setKp: "pid/set/Kp",
      setKi: "pid/set/Ki",
      setKd: "pid/set/Kd",
      setincrementDegree: "pid/set/increment",
    },
    output: {
      walkForward: "pid/move/forward",
      walkBackward: "pid/move/backward",
      walkLeft: "pid/move/left",
      walkRight: "pid/move/right",
      stop: "pid/stop",
      setHeightLow: "pid/set/height/low",
      setHeightMid: "pid/set/height/mid",
      setHeightHigh: "pid/set/height/high",

      enableSensorAdjustementsTrue: "pid/sensor/enable/true",
      enableSensorAdjustementsFalse: "pid/sensor/enable/false",
      setKp: "pid/set/Kp",
      setKi: "pid/set/Ki",
      setKd: "pid/set/Kd",
      setincrementDegree: "pid/set/increment",
    }
  };

  sendControlCommand(direction: string) {
    this.controlCommand.emit(direction);
  }

  updatePID() {
    console.log('PID updated:', { Kp: this.Kp, Ki: this.Ki, Kd: this.Kd });
  }

  updateIncrementDegree() {
    console.log('Increment Degree updated:', this.incrementDegree);
    this.degreeChanged.emit(this.incrementDegree)
  }


  adjustHeightEventFromSlider(event: any) {
    const newValue = event.detail.value;
    this.heightLevelIndex = newValue;

    console.log("heightChanged 1")
    this.heightChanged.emit(this.heightLevelIndex);
  }

  toggleEnableSensor() {
    this.isSensorAdjustmentEnabled = (this.isSensorAdjustmentEnabled === true ? false : true);
    console.log("isSensorAdjustmentEnabled", this.isSensorAdjustmentEnabled)
    this.sensorToggled.emit(this.isSensorAdjustmentEnabled);
  }

  sendStopCommand() {
    this.stopCommand.emit();
  }
}
