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

  adjustHeightEventFromSlider(event: any) {
    const newValue = event.detail.value;
    this.heightLevelIndex = newValue;
    this.heightChanged.emit(this.heightLevelIndex);
  }

  toggleEnableSensor() {
    this.isSensorAdjustmentEnabled = !this.isSensorAdjustmentEnabled;
    this.sensorToggled.emit(this.isSensorAdjustmentEnabled);
  }

  sendStopCommand() {
    this.stopCommand.emit();
  }
}
