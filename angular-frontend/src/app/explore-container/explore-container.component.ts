import { io, Socket } from 'socket.io-client';
import {
  Component,
  AfterViewInit,
  ChangeDetectorRef,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigService, TopicsInterface } from '../services/config/config.service';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonRow,
  IonGrid,
  IonCol,
  IonCard,
  IonCardContent,
  IonCardTitle,
  IonCardHeader
} from '@ionic/angular/standalone';
import { ControlComponent } from '../components/control/control.component';
import { ConsoleComponent } from '../components/console/console.component';
import { ThreejsComponent } from '../components/threejs/threejs.component';
import { RawDataComponent } from '../components/raw-data/raw-data.component';
import { MotorOutputComponent } from '../components/motor-output/motor-output.component';

@Component({
  standalone: true,
  selector: 'app-explore-container',
  templateUrl: './explore-container.component.html',
  styleUrls: ['./explore-container.component.scss'],
  imports: [
    ControlComponent,
    ConsoleComponent,
    ThreejsComponent,
    RawDataComponent,
    MotorOutputComponent,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonRow,
    IonGrid,
    IonCol,
    IonCard,
    IonCardContent,
    IonCardTitle,
    IonCardHeader,
    CommonModule,
  ],
})

export class ExploreContainerComponent implements AfterViewInit, OnDestroy {
  @ViewChild(ConsoleComponent) consoleComponent: ConsoleComponent | undefined;
  isConsoleAutoScrollEnabled: boolean = true;

  socket: Socket | null = null;
  socketStatus: string = 'Connecting...';

  config: any = {};
  levelsArray:string[] = [];
  accelData = { accelData : { accelX: 0 , accelY:0, accelZ:0 }}
  tiltAngles = { xAngle:0, yAngle:0 }

  leftMotorPWM:  null | { value:number} = null;
  rightMotorPWM:  null | { value:number} = null;
  leftServoPulse:  null | { value:number} = null;
  rightServoPulse:  null | { value:number} = null;

  adjustTHREERobotHeightValue! : string;
  updateTHREERobotTiltValue! : { xAngle: number; yAngle: number };
  updateTHREERobotWheelMovementValue! : { leftHeight: number | null; rightHeight: number | null };
  updateTHREERobotMotorPWMValue! : { wheel: string, data: { value: number} };

  private topics!: TopicsInterface;

  walkForwardActive = false;
  walkBackwardActive = false;
  walkLeftActive = false;
  walkRightActive = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private configService: ConfigService
  ) {}

  heightLevelIndex!: number;

  async ngAfterViewInit() {
    await this.getConfig();
    this.topics = this.configService.getTopics();
    this.setupSocket();

    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      let command;

      switch (key) {
          case 'w':
          case "ArrowUp":
              command = "forward";
              break;
          case 'a':
          case "ArrowLeft":
              command = "left";
              break;
          case 's':
          case "ArrowDown":
              command = "backward";
              break;
          case 'd':
          case "ArrowRight":
              command = "right";
              break;
          default:
              return; // Ignore other keys
      }

      this.sendControlCommand(command);
    });
  }

  onHeightChanged(newHeightIndex: number) {
    const newHeightIndexNumber: number = newHeightIndex;
    this.heightLevelIndex = newHeightIndexNumber;
    this.sendSetHeightCommand(this.levelsArray[this.heightLevelIndex]);
  }

  onSensorToggled(isEnabled: boolean) {
    const isEnabledBoolean: boolean = isEnabled;
    this.config.isSensorAdjustmentEnabled = isEnabledBoolean;
    if(isEnabled === true) {
      this.sendEnableSensorCommand(this.topics.output["enableSensorAdjustementsTrue"]);
    } else {
      this.sendEnableSensorCommand(this.topics.output["enableSensorAdjustementsFalse"]);
    }
  }

  onStopCommand() {
    console.log('Stop command received!');
    this.sendStopCommand();
  }

  async getConfig(){
    this.config = await this.configService.getConfig();
    console.log(this.config)
    this.levelsArray = Object.keys(this.config.heightLevels);
    this.heightLevelIndex = this.config?.heightLevels.findIndex((level:any) => level === this.config.heightLevel)
  }

  updateKp(Kp: number){
    this.config.Kp = Kp;
    if (this.socket !== null) {
      const jsonMessage:string = JSON.stringify({ topic: this.topics.output["setKp"], value: Kp, source: 'Angular FE' })
      console.log("-->", jsonMessage)
      this.socket.emit('message', jsonMessage);
      this.socket.emit('message', { topic: this.topics.output["setKp"], value: Kp, source: 'Angular FE' });
    }
  }

  updateKi(Ki: number){
    this.config.Ki = Ki;
    if (this.socket !== null) {
      const jsonMessage = JSON.stringify({ topic: this.topics.output["setKi"], value: Ki, source: 'Angular FE' })
      console.log("-->", jsonMessage)
      this.socket.emit('message', jsonMessage);
      this.socket.emit('message', { topic: this.topics.output["setKi"], value: Ki, source: 'Angular FE' });
    }
  }

  updateKd(Kd: number){
    this.config.Kd = Kd;
    if (this.socket !== null) {
      const jsonMessage = JSON.stringify({ topic: this.topics.output["setKd"], value: Kd, source: 'Angular FE' })
      console.log("-->", jsonMessage)
      this.socket.emit('message', jsonMessage);
      this.socket.emit('message', { topic: this.topics.output["setKd"], value: Kd, source: 'Angular FE' });
    }
  }

  updateIncrementDegree(incrementDegree: number){
    this.config.incrementDegree = incrementDegree;
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output["setincrementDegree"], value: incrementDegree.toString(), source: 'Angular FE' });
    }
  }


  startCAMERAObjectDetection() {
    if (this.socket !== null) {
      this.socket.emit('startObjectDetection');
    } else {
      console.warn('Socket is null');
    }
  }
  setupSocket() {
    if (this.socket === null) {
      this.socket = io('http://foucault:8080'); // Make sure this URL is correct
    }

    this.socket.on('connect', () => {
      this.socketStatus = 'Connected';
    });

    this.socket.on('mqtt-message', (message: { topic: string; data: any }) => {
      const {
        topic,
        data,
      } = message;
      let parsedMessage;
      if(data) {
        parsedMessage = JSON.parse(data);
      }

      switch (topic) {
        case this.topics.input["accelData"]:
          this.handleAccelData(parsedMessage as { accelData:  { accelX:number, accelY:number, accelZ:number }});
          break;

        case this.topics.input["tiltAngles"]:
          this.handleTiltAngles(parsedMessage.tiltAngles as { xAngle:number, yAngle:number }); // Access tiltAngles directly
          break;

        case this.topics.input["motorLeft"]:
          this.leftMotorPWM = parsedMessage
          break;

        case this.topics.input["motorRight"]:
          this.rightMotorPWM = parsedMessage
          break;

        case this.topics.input["servoLeft"]:
          this.leftServoPulse = parsedMessage;
          break;

        case this.topics.input["servoRight"]:
          this.rightServoPulse = parsedMessage;
          break;

        case this.topics.input["console"]:
          this.handleConsoleMessage(topic, parsedMessage.message, parsedMessage.source); // Access message content directly
          break;

        case this.topics.input["walkForward"]:
          this.walkForwardActive = true;
          break;
        case this.topics.input["walkBackward"]:
          this.walkBackwardActive = true;
          break;
        case this.topics.input["walkLeft"]:
          this.walkLeftActive = true;
          break;
        case this.topics.input["walkRight"]:
          this.walkRightActive = true;
          break;
        case this.topics.input["setHeightLow"] :
          this.adjustTHREERobotHeightValue = this.levelsArray[0];
        break;
        case this.topics.input["setHeightMid"] :
          this.adjustTHREERobotHeightValue = this.levelsArray[1];
        break;
        case this.topics.input["setHeightHigh"]:
          this.adjustTHREERobotHeightValue = this.levelsArray[2];
        break;
        case this.topics.input["enableSensorAdjustementsTrue"]:
          this.config.isSensorAdjustmentEnabled = true;
          break;
        case this.topics.input["enableSensorAdjustementsFalse"]:
          this.config.isSensorAdjustmentEnabled = false;
          break;
        case this.topics.input["setKp"]:
            this.config.Kp = parsedMessage.value;
          break;
        case this.topics.input["setKi"]:
            this.config.Ki = parsedMessage.value;
          break;
        case this.topics.input["setKd"]:
            this.config.Kd = parsedMessage.value;
          break;
        case this.topics.input["setincrementDegree"]:
            this.config.incrementDegree = parsedMessage.value;
          break;
        default:
          console.log(`Unknown topic: ${topic}, ${parsedMessage}`);
          break;
      }
    });
  }

  handleAccelData(data: { accelData :{ accelX: number; accelY: number; accelZ: number }}) {
    this.accelData = data;
  }

  handleTiltAngles(data: { xAngle: number; yAngle: number }) {
    this.tiltAngles = data;
    this.updateTHREERobotTiltValue = data;
  }

  handleConsoleMessage(topic: string, message: string, source: string) {
    const stringifym = JSON.stringify(message);
    this.logToConsole(topic, stringifym, source);
  }

  handleServoPulseWidth(servo: string, data: any) {
    if (servo === 'left') {
      this.updateTHREERobotWheelMovementValue = {
        leftHeight: data.value,
        rightHeight: null,
      };
    } else if (servo === 'right') {
      this.updateTHREERobotWheelMovementValue = {
        leftHeight: null,
        rightHeight: data.value,
      };
    }
  }

  updateConsoleTiltAngles(data: { xAngle: number; yAngle: number }) {
    console.log(data)
    if(data){
      document.getElementById(
        'tiltAngles-content'
      )!.innerHTML = `X: ${data?.xAngle}°<br /> Y: ${data?.yAngle}°`;
      this.cdr.detectChanges();
    }
  }

  updateTHREERobotMotorPWM(wheel: string, data: { value: number} ) {
    this.updateTHREERobotMotorPWMValue = {wheel, data}
  }

  sendControlCommand(command: string) {
    if (this.socket !== null) {
      this.socket.emit('message', { topic: command, source: 'Angular FE' });
    } else {
      console.warn('Socket is null');
    }
  }

  sendSetHeightCommand(height: string) {
    if (this.socket !== null) {
      switch(height) {
        case 'low':
          this.socket.emit('message', { topic: this.topics.output["setHeightLow"], source: 'Angular FE' });
          break;
        case 'mid':
          this.socket.emit('message', { topic: this.topics.output["setHeightMid"], source: 'Angular FE' });
          break;
        case 'high':
          this.socket.emit('message', { topic: this.topics.output["setHeightHigh"], source: 'Angular FE' });
          break;
      }

    } else {
      console.warn('Socket is null');
    }
  }

  sendStopCommand() {
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output["stop"], source: 'Angular FE' });
    } else {
      console.warn('Socket is null');
    }
  }

  sendEnableSensorCommand(topic: string) {
    if (this.socket !== null) {
      this.socket.emit('message', { topic: topic, source: 'Angular FE' });
    } else {
      console.warn('Socket is null');
    }
  }

  logToConsole(topic: string, message: string, source: string) {
    if (this.consoleComponent) {
       // Pass the message to the child component
      this.consoleComponent.handleConsoleMessage(topic, message, source);
    }
  }

  ngOnDestroy() {
    this.socket?.disconnect();
  }

}
