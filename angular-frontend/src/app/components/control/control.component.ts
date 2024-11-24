import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ConfigService,
  TopicsInterface,
} from 'src/app/services/config/config.service';
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
  IonItem,
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
              
              <ion-button *ngIf="isStopEnabled === true" (click)="sendStopCommand()">Stop</ion-button>
              <ion-button *ngIf="isStopEnabled === false" (click)="sendStartCommand()">Start</ion-button>
            </ion-col>
            <ion-col size="6">
              <ion-grid>
              <ion-row>
                  <ion-col size="12">
                  dServo =  500 <= 2500;  <br />
                  dMotor =  0  <= 255;   
                  </ion-col>
              </ion-row>
              <ion-row>
                  <ion-col size="3" class="ion-text-center">
                    <label>MotorL</label>
                    <input
                      [(ngModel)]="motorLeft"
                      type="number"
                      placeholder="MotorL"
                      (change)="updateMotorLeft()"
                    />
                  </ion-col>

                  <ion-col size="3" class="ion-text-center">
                    <label>MotorR</label>
                    <input
                      [(ngModel)]="motorRight"
                      type="number"
                      placeholder="MotorR"
                      (change)="updateMotorRight()"
                    />
                  </ion-col>

                  <ion-col size="3" class="ion-text-center">
                    <label>ServoL</label>
                    <input
                      [(ngModel)]="servoLeft"
                      type="number"
                      placeholder="ServoL"
                      (change)="updateServoLeft()"
                    />
                  </ion-col>
                  <ion-col size="3" class="ion-text-center">
                    <label>ServoR</label>
                    <input
                      [(ngModel)]="servoRight"
                      type="number"
                      placeholder="ServoR"
                      (change)="updateServoRight()"
                    />
                  </ion-col>
                </ion-row>
                <ion-row>
                  <ion-col size="3" class="ion-text-center">
                    <label>Kp</label>
                    <input
                      [(ngModel)]="Kp"
                      type="number"
                      placeholder="Kp"
                      (change)="updateKp()"
                    />
                  </ion-col>

                  <ion-col size="3" class="ion-text-center">
                    <label>Ki</label>
                    <input
                      [(ngModel)]="Ki"
                      type="number"
                      placeholder="Ki"
                      (change)="updateKi()"
                    />
                  </ion-col>

                  <ion-col size="3" class="ion-text-center">
                    <label>Kd</label>
                    <input
                      [(ngModel)]="Kd"
                      type="number"
                      placeholder="Kd"
                      (change)="updateKd()"
                    />
                  </ion-col>
                  <ion-col size="3" class="ion-text-center">
                    <label>Degree</label>
                    <input
                      [(ngModel)]="incrementDegree"
                      type="number"
                      placeholder="Degree"
                      (change)="updateIncrementDegree()"
                    />
                  </ion-col>
                </ion-row>
                <ion-row>
                  <ion-col size="12" class="ion-text-center">
                    <ion-button
                      (click)="sendWalkCommand('forward')"
                      [class]="walkForwardActive ? 'pulse-effect' : ''"
                      >W</ion-button
                    >
                  </ion-col>
                </ion-row>
                <ion-row>
                  <ion-col size="4" class="ion-text-center">
                    <ion-button
                      (click)="sendWalkCommand('left')"
                      [class]="walkLeftActive ? 'pulse-effect' : ''"
                      >A</ion-button
                    >
                  </ion-col>
                  <ion-col size="4" class="ion-text-center">
                    <ion-button
                      (click)="sendWalkCommand('backward')"
                      [class]="walkBackwardActive ? 'pulse-effect' : ''"
                      >S</ion-button
                    >
                  </ion-col>
                  <ion-col size="4" class="ion-text-center">
                    <ion-button
                      (click)="sendWalkCommand('right')"
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
export class ControlComponent implements AfterViewInit {
  @Input() heights: string[] = [];
  @Input() heightLevelIndex: number = 0;
  @Input() isSensorAdjustmentEnabled: boolean = false;

  @Output() heightChanged = new EventEmitter<number>();
  @Output() sensorToggled = new EventEmitter<boolean>();
  @Output() stopCommand = new EventEmitter<void>();
  @Output() startCommand = new EventEmitter<void>();
  @Output() walkCommand = new EventEmitter<string>();
  @Output() degreeChanged = new EventEmitter<number>();

  @Output() KiChanged = new EventEmitter<number>();
  @Output() KpChanged = new EventEmitter<number>();
  @Output() KdChanged = new EventEmitter<number>();

  @Output() servoLeftChanged = new EventEmitter<number>();
  @Output() servoRightChanged = new EventEmitter<number>();
  @Output() motorLeftChanged = new EventEmitter<number>();
  @Output() motorRightChanged = new EventEmitter<number>();

  @Input() Kp: number = 0;
  @Input() Ki: number = 0;
  @Input() Kd: number = 0;
  @Input() incrementDegree: number = 0;

  motorLeft: number = 0;
  motorRight: number = 0;
  servoLeft: number = 0;
  servoRight: number = 0;

  isStopEnabled:boolean = true;

  walkForwardActive: boolean = false;
  walkLeftActive: boolean = false;
  walkBackwardActive: boolean = false;
  walkRightActive: boolean = false;

  public topics!: TopicsInterface;

  constructor(private configService: ConfigService) {}

  ngAfterViewInit() {
    this.topics = this.configService.getTopics();
  }

  sendWalkCommand(direction: string) {
    this.walkCommand.emit(direction);
  }

  updateKp() {
    this.KpChanged.emit(this.Kp);
  }

  updateKi() {
    this.KiChanged.emit(this.Ki);
  }

  updateKd() {
    this.KdChanged.emit(this.Kd);
  }
  
  updateMotorLeft(){
    this.motorLeftChanged.emit(this.motorLeft)
  }
  updateMotorRight(){
    this.motorRightChanged.emit(this.motorRight)
  }

  updateServoLeft(){
    this.servoLeftChanged.emit(this.servoLeft)
  }
  updateServoRight(){
    this.servoRightChanged.emit(this.servoRight)
  }

  updateIncrementDegree() {
    console.log('Increment Degree updated:', this.incrementDegree);
    this.degreeChanged.emit(this.incrementDegree);
  }

  adjustHeightEventFromSlider(event: any) {
    const newValue = event.detail.value;
    this.heightLevelIndex = newValue;
    this.heightChanged.emit(this.heightLevelIndex);
  }

  toggleEnableSensor() {
    this.sensorToggled.emit(
      this.isSensorAdjustmentEnabled === true ? false : true
    );
  }

  sendStopCommand() {
    this.isStopEnabled = false;
    this.stopCommand.emit();
  }
  sendStartCommand() {
    this.isStopEnabled = true;
    this.startCommand.emit();
  }
}
