import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonLabel,
  IonToggle
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-console',
  standalone: true,
  imports: [
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonLabel,
    IonToggle,
    CommonModule,
    FormsModule
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Console</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div>
          <ion-label>Auto Scroll</ion-label>
          <ion-toggle [(ngModel)]="isConsoleAutoScrollEnabled"></ion-toggle>
        </div>
        <div
          id="console-content"
          #consoleDiv
          style="max-height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 10px;"
        >
          <div *ngFor="let message of consoleMessages">{{ message }}</div>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      #console-content {
        background: #f9f9f9;
        font-family: monospace;
        white-space: pre-wrap;
      }
    `,
  ],
})
export class ConsoleComponent {
  @Input() isConsoleAutoScrollEnabled: boolean = true; // Controls auto-scroll from the parent
  consoleMessages: string[] = []; // Stores console messages

  // Method to handle incoming console messages (called by the parent)
  handleConsoleMessage(topic: string, message: string, source: string) {
    const logMessage = `${source} [${topic}]: ${message}`;
    this.logToConsole(logMessage);
  }

  // Method to log a message and handle auto-scrolling
  private logToConsole(message: string) {
    this.consoleMessages.push(message);
    this.scrollConsole();
  }

  // Scroll the console content if auto-scroll is enabled
  private scrollConsole() {
    if (this.isConsoleAutoScrollEnabled) {
      const consoleDiv = document.getElementById('console-content');
      if (consoleDiv) {
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
      }
    }
  }
}
