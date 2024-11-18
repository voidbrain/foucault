import { io, Socket } from 'socket.io-client';
import {
  Component,
  AfterViewInit,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService, TopicsInterface } from '../services/config/config.service';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
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
  IonCardSubtitle,
  IonItem
} from '@ionic/angular/standalone';
import * as THREE from 'three';
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
    IonCardSubtitle,
    IonItem,
    CommonModule,
    FormsModule,
  ],
})

export class ExploreContainerComponent implements AfterViewInit, OnDestroy {
  @ViewChild(ConsoleComponent) consoleComponent: ConsoleComponent | undefined;
  isConsoleAutoScrollEnabled: boolean = true;
  private messageIndex = 0;

  socket: Socket | null = null;
  socketStatus: string = 'Connecting...';

  Kp = 0; // Proportional gain
  Ki = 0; // Integral gain
  Kd = 0; // Derivative gain
  incrementDegree = 0; // Default increment for movement adjustments
  heightLevels: string[] = ['low', 'mid', 'high'];
  heightLevel: string = this.heightLevels[1];
  degree = 0;

  accelData = { accelData : { accelX: 0 , accelY:0, accelZ:0 }}
  tiltAngles = { xAngle:0, yAngle:0 }

  leftMotorPWM:  null | { value:number} = null;
  rightMotorPWM:  null | { value:number} = null;
  leftServoPulse:  null | { value:number} = null;
  rightServoPulse:  null | { value:number} = null;

  adjustTHREERobotHeightValue! :string;
  updateTHREERobotTiltValue! :{ xAngle: number; yAngle: number };
  updateTHREERobotWheelMovementValue! : { servo: string, data: any };
  updateTHREERobotMotorPWMValue! : { wheel: string, data: { value: number} };

  isSensorAdjustmentEnabled: boolean = false

  private topics!: TopicsInterface;

  walkForwardActive = false;
  walkBackwardActive = false;
  walkLeftActive = false;
  walkRightActive = false;

  @ViewChild('threejsContainer', { static: true })
  threejsContainer!: ElementRef<HTMLDivElement>;

  constructor(
    private cdr: ChangeDetectorRef,
    private configService: ConfigService
  ) {}

  get heightLevelIndex(): number {
    return this.heightLevels.findIndex(level => level === this.heightLevel);
  }

  set heightLevelIndex(index: number) {
    // Sets the heightLevel based on the provided index
    if (index >= 0 && index < this.heightLevels.length) {
      this.heightLevel = this.heightLevels[index];
    }
  }

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
    this.sendSetHeightCommand(this.heightLevels[this.heightLevelIndex]);
  }

  onSensorToggled(isEnabled: boolean) {
    const isEnabledBoolean: boolean = isEnabled;
    this.isSensorAdjustmentEnabled = isEnabledBoolean;

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
    const config = await this.configService.getConfig();

    if(config.Kp){ this.Kp = config.Kp }
    if(config.Ki){ this.Ki = config.Ki }
    if(config.Kd){ this.Kd = config.Kd }
    if(config.incrementDegree){ this.incrementDegree = config.incrementDegree }
    if(config.heightLevel){ this.heightLevel = config.heightLevel }
    if(config.isSensorAdjustmentEnabled){ this.isSensorAdjustmentEnabled = config.isSensorAdjustmentEnabled }
  }

  updateKp(Kp: number){
    this.Kp = Kp;
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output["setKp"], value: Kp.toString(), souce: 'Angular FE' });
    }
  }

  updateKi(Ki: number){
    this.Ki = Ki;
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output["setKi"], value: Ki.toString(), souce: 'Angular FE' });
    }
  }

  updateKd(Kd: number){
    this.Kd = Kd;
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output["setKd"], value: Kd.toString(), souce: 'Angular FE' });
    }
  }

  updateIncrementDegree(incrementDegree: number){
    this.incrementDegree = incrementDegree;
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output["setincrementDegree"], value: incrementDegree.toString(), souce: 'Angular FE' });
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
          this.adjustTHREERobotHeightValue = this.heightLevels[0];
        break;
        case this.topics.input["setHeightMid"] :
          this.adjustTHREERobotHeightValue = this.heightLevels[1];
        break;
        case this.topics.input["setHeightHigh"]:
          this.adjustTHREERobotHeightValue = this.heightLevels[2];
        break;
        case this.topics.input["enableSensorAdjustementsTrue"]:
          this.isSensorAdjustmentEnabled = true;
          break;
        case this.topics.input["enableSensorAdjustementsFalse"]:
          this.isSensorAdjustmentEnabled = false;
          break;

        case this.topics.input["setKp"]:
            this.Kp = parsedMessage.value;
          break;
        case this.topics.input["setKi"]:
            this.Ki = parsedMessage.value;
          break;
        case this.topics.input["setKd"]:
            this.Kd = parsedMessage.value;
          break;
        case this.topics.input["setincrementDegree"]:
            this.incrementDegree = parsedMessage.value;
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
    this.updateTHREERobotWheelMovementValue = { servo, data};
    // if (servo === 'left' && this.rightLeg) {
    //   const rightLegPosition = this.rightLeg ? this.rightLeg.position : null;
    //   const rightHeight = rightLegPosition ? rightLegPosition.y : 0;
    //   this.updateTHREERobotWheelMovement({
    //     leftHeight: data.value,
    //     rightHeight: rightHeight,
    //   });
    // } else if (servo === 'right' && this.leftLeg) {
    //   const leftLegPosition = this.leftLeg ? this.leftLeg.position : null;
    //   const leftHeight = leftLegPosition ? leftLegPosition.y : 0;
    //   this.updateTHREERobotWheelMovement({
    //     leftHeight: leftHeight,
    //     rightHeight: data.value,
    //   });
    // }
    // const servoValueElement = document.getElementById(`${servo}-servo-value`);
    // if (servoValueElement) {
    //   servoValueElement.innerText = `${data.value}`;
    // }

    this.cdr.detectChanges();
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
    // const rotationIncrement = THREE.MathUtils.degToRad(data.value);
    // if (wheel === 'left' && this.leftWheel) {
    //   this.leftWheel.rotation.z += rotationIncrement;
    // } else if (wheel === 'right' && this.rightWheel) {
    //   this.rightWheel.rotation.z += rotationIncrement;
    // }
  }



  sendControlCommand(command: string) {
    if (this.socket !== null) {

      this.socket.emit('message', { topic: command, souce: 'Angular FE' });
    } else {
      console.warn('Socket is null');
    }
  }

  sendSetHeightCommand(height: string) {
    if (this.socket !== null) {
      switch(height) {
        case 'low':
          this.socket.emit('message', { topic: this.topics.output["setHeightLow"], souce: 'Angular FE' });
          break;
        case 'mid':
          this.socket.emit('message', { topic: this.topics.output["setHeightMid"], souce: 'Angular FE' });
          break;
        case 'high':
          this.socket.emit('message', { topic: this.topics.output["setHeightHigh"], souce: 'Angular FE' });
          break;
      }

    } else {
      console.warn('Socket is null');
    }
  }

  sendStopCommand() {
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output["stop"], souce: 'Angular FE' });
    } else {
      console.warn('Socket is null');
    }
  }

  sendEnableSensorCommand(topic: string) {
    if (this.socket !== null) {
      this.socket.emit('message', { topic: topic, souce: 'Angular FE' });
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
