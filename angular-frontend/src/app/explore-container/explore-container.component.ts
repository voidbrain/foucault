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
      const command = "walk";
      let direction
      switch (key) {
          case 'w':
          case "ArrowUp":
              direction = "forward";
              break;
          case 'a':
          case "ArrowLeft":
              direction = "left";
              break;
          case 's':
          case "ArrowDown":
              direction = "backward";
              break;
          case 'd':
          case "ArrowRight":
              direction = "right";
              break;
          default:
              return; // Ignore other keys
      }

      this.sendControlCommand(command, direction);
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
    this.sendEnableSensorCommand(this.topics.output["enableSensorAdjustements"], isEnabled);
  }

  onStopCommand() {
    console.log('Stop command received!');
    this.sendStopCommand();
  }

  async getConfig(){
    this.config = await this.configService.getConfig();
    this.levelsArray = Object.values(this.config.heightLevels);
    this.heightLevelIndex = this.config?.heightLevels.findIndex((level:any) => level === this.config.heightLevel);
    this.adjustTHREERobotHeightValue = this.config.heightLevel;
  }

  updateKp(Kp: number){
    this.config.Kp = Kp;
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output["setKp"], value: Kp.toString(), souce: 'Angular FE' });
    }
  }

  updateKi(Ki: number){
    this.config.Ki = Ki;
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output["setKi"], value: Ki.toString(), souce: 'Angular FE' });
    }
  }

  updateKd(Kd: number){
    this.config.Kd = Kd;
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output["setKd"], value: Kd.toString(), souce: 'Angular FE' });
    }
  }

  updateIncrementDegree(incrementDegree: number){
    this.config.incrementDegree = incrementDegree;
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output["setincrementDegree"], value: incrementDegree.toString(), source: 'Angular FE' });
    }
  }

  onServoLeftChanged(value: number){
    if (this.socket !== null) {
      const obj = { topic: this.topics.output["setServoLeft"], value: value.toString(), source: 'Angular FE' };
      console.log(obj)
      this.socket.emit('message', obj);
    }
  }

  onServoRightChanged(value: number){
    if (this.socket !== null) {
      const obj = { topic: this.topics.output["setServoRight"], value: value.toString(), source: 'Angular FE' };
      console.log(obj)
      this.socket.emit('message', obj);
    }
  }

  onMotorLeftChanged(value: number){
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output["setMotorLeft"], value: value.toString(), source: 'Angular FE' });
    }
  }

  onMotorRightChanged(value: number){
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output["setMotorRight"], value: value.toString(), source: 'Angular FE' });
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
      this.socket = io('http://foucault:8080');
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
      
      switch (topic) {
        case this.topics.input["accelData"]:
          parsedMessage = JSON.parse(data);
          this.handleAccelData(parsedMessage as { accelData:  { accelX:number, accelY:number, accelZ:number }});
          break;

        case this.topics.input["tiltAngles"]:
          parsedMessage = JSON.parse(data);
          this.handleTiltAngles(parsedMessage.tiltAngles as { xAngle:number, yAngle:number });
          break;

        case this.topics.input["motorLeft"]:
          parsedMessage = JSON.parse(data);
          this.leftMotorPWM = parsedMessage
          break;

        case this.topics.input["motorRight"]:
          parsedMessage = JSON.parse(data);
          this.rightMotorPWM = parsedMessage
          break;

        case this.topics.input["servoLeft"]:
          parsedMessage = JSON.parse(data);
          this.leftServoPulse = parsedMessage;
          break;

        case this.topics.input["servoRight"]:
          parsedMessage = JSON.parse(data);
          this.rightServoPulse = parsedMessage;
          break;
        case this.topics.input["console"]:
          parsedMessage = JSON.parse(data);
          this.handleConsoleMessage(topic, parsedMessage.message, parsedMessage.source);
          break;
        case this.topics.input["setHeight"] :
          parsedMessage = data.toString();
          console.log(data)
          this.adjustTHREERobotHeightValue = parsedMessage;
          console.log(this.adjustTHREERobotHeightValue)
        break;
        case this.topics.input["enableSensorAdjustements"]:
          parsedMessage = JSON.parse(data);
          this.config.isSensorAdjustmentEnabled = parsedMessage;
          break;
        case this.topics.input["setKp"]:
            parsedMessage = JSON.parse(data);
            this.config.Kp = +parsedMessage;
          break;
        case this.topics.input["setKi"]:
            parsedMessage = JSON.parse(data);
            this.config.Ki = +parsedMessage;
          break;
        case this.topics.input["setKd"]:
            parsedMessage = JSON.parse(data);
            this.config.Kd = +parsedMessage;
          break;
        case this.topics.input["setincrementDegree"]:
            parsedMessage = JSON.parse(data);
            this.config.incrementDegree = +parsedMessage;
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

  onWalkCommand(direction: string){
    const command = this.topics.output['walk'];
    this.sendControlCommand(command, direction);
  }

  sendControlCommand(command: string, direction: string) {
    if (this.socket !== null) {
      this.socket.emit('message', { topic: command, value: direction,source: 'Angular FE' });
    } else {
      console.warn('Socket is null');
    }
  }

  sendSetHeightCommand(height: string) {
    if (this.socket !== null) {
        this.socket.emit('message', { topic: this.topics.output["setHeight"], value: height, source: 'Angular FE' });

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

  sendEnableSensorCommand(topic: string, isEnabled: boolean) {
    if (this.socket !== null) {
      this.socket.emit('message', { topic: topic, value:isEnabled.toString(),  source: 'Angular FE' });
    } else {
      console.warn('Socket is null');
    }
  }

  logToConsole(topic: string, message: string, source: string) {
    if (this.consoleComponent) {
      this.consoleComponent.handleConsoleMessage(topic, message, source);
    }
  }

  ngOnDestroy() {
    this.socket?.disconnect();
  }

}
