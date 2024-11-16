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
  IonText,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-raw-data',
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
    IonText,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Raw Data</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-grid>
          <ion-row>
            <ion-col size="6">
              <h2>Accelerometer</h2>
              <ion-text
                [color]="isSensorAdjustmentEnabled ? 'primary' : 'secondary'"
                id="accelData-content">
                <ng-container *ngIf="accelData; else loadingAccel">
                  X: {{ accelData.accelX }} m/s<sup>2</sup> <br />
                  Y: {{ accelData.accelY }} m/s<sup>2</sup> <br />
                  Z: {{ accelData.accelZ }} m/s<sup>2</sup>
                </ng-container>
                <ng-template #loadingAccel>Loading...</ng-template>
              </ion-text>
            </ion-col>
            <ion-col size="6">
              <h2>Tilt Data</h2>
              <ion-text
                [color]="isSensorAdjustmentEnabled ? 'primary' : 'secondary'"
                id="tiltAngles-content">
                <ng-container *ngIf="tiltAngles; else loadingAngles">
                  X: {{ tiltAngles.xAngle }}° <br />
                  Y: {{ tiltAngles.yAngle }}°
                </ng-container>
                <ng-template #loadingAngles>Loading...</ng-template>
              </ion-text>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card-content>
    </ion-card>
  `,
})
export class RawDataComponent {
  @Input() accelData:  { accelX: number; accelY: number; accelZ: number } | null = null; // Accelerometer data
  @Input() tiltAngles: { xAngle: number; yAngle: number } | null = null; // Tilt data
  @Input() isSensorAdjustmentEnabled: boolean = false; // Sensor adjustment state
}
