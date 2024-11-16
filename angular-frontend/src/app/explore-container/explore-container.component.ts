import { io, Socket } from 'socket.io-client';
import {
  Component,
  AfterViewInit,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { ConfigService } from '../services/config/config.service';
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
export class ExploreContainerComponent implements AfterViewInit {
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

  THREESettings = {
    HEIGHT_LOW: 1,
    HEIGHT_MID: 2,
    HEIGHT_HIGH: 3,
  
    BODY_LOW: 0.4,
    BODY_HEIGHT_MID: 1,
    BODY_HEIGHT_HIGH: 1.2,
  
    LEG_LOW: 0,
    LEG_HEIGHT_MID: 1,
    LEG_HEIGHT_HIGH: 2,
  }

  isSensorAdjustmentEnabled: boolean = false

  

  walkForwardActive = false;
  walkBackwardActive = false;
  walkLeftActive = false;
  walkRightActive = false;

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

  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  referencePlane!: THREE.Mesh;
  leftWheel!: THREE.Mesh;
  rightWheel!: THREE.Mesh;
  leftLeg!: THREE.Group;
  rightLeg!: THREE.Group;

  @ViewChild('threejsContainer', { static: true })
  threejsContainer!: ElementRef<HTMLDivElement>;

  constructor(
    // private socketService: SocketService,
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

    this.setupThreeJS();
    this.animateTHREERobot();
    this.setupSocket();
    this.adjustTHREERobotHeight('mid');

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
    console.log(newHeightIndex, this.heightLevels[newHeightIndex])
    const newHeightIndexNumber: number = newHeightIndex;
    this.heightLevelIndex = newHeightIndexNumber;
    console.log('Height Level Changed:', this.heightLevels[this.heightLevelIndex]);
    this.sendSetHeightCommand(this.heightLevels[this.heightLevelIndex]);
  }

  onSensorToggled(isEnabled: boolean) {
    const isEnabledBoolean: boolean = isEnabled;
    this.isSensorAdjustmentEnabled = isEnabledBoolean;
    console.log('Sensor Adjustments Enabled:', this.isSensorAdjustmentEnabled);

    if(isEnabled === true) {
      this.sendEnableSensorCommand(this.topics.output.enableSensorAdjustementsTrue);
    } else {
      this.sendEnableSensorCommand(this.topics.output.enableSensorAdjustementsFalse);
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

  // adjustHeightEventFromSlider(event: CustomEvent) {
  //   const selectedLevel = this.heightLevels[event.detail.value];
  //   this.heightLevel = selectedLevel;
  //   console.log(this.heightLevel);
  //   this.sendSetHeightCommand(this.heightLevel);
  // }

  adjustTHREERobotHeight(height: string) {
    let targetHeight = this.THREESettings.HEIGHT_MID;
    let offsetHeight;
    switch (height) {
      case 'low':
        targetHeight = this.THREESettings.HEIGHT_LOW;
        offsetHeight = -0.8;
        this.updateTHREERobotBody(this.THREESettings.HEIGHT_LOW, offsetHeight);
        break;
      case 'mid':
        targetHeight = this.THREESettings.HEIGHT_MID;
        offsetHeight = 0;
        this.updateTHREERobotBody(this.THREESettings.BODY_HEIGHT_MID, offsetHeight);
        break;
      case 'high':
        targetHeight = this.THREESettings.HEIGHT_HIGH;
        offsetHeight = +0.2;
        this.updateTHREERobotBody(this.THREESettings.BODY_HEIGHT_HIGH, offsetHeight);
        break;
    }

    this.updateTHREERobotLegs(targetHeight);
  }

  updateTHREERobotLegs(height: number) {
    this.adjustTHREERobotLegPosition(-1, height); // Left leg
    this.adjustTHREERobotLegPosition(1, height); // Right leg
  }

  updateTHREERobotBody(targetHeight: number, offsetHeight: number) {

    this.referencePlane.position.y = targetHeight + offsetHeight + 0.6;
  }

  updatePID() {
    console.log('Updated PID constants:', { Kp: this.Kp, Ki: this.Ki, Kd: this.Kd });
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output.setKp, value: this.Kp.toString(), souce: 'Angular FE' });
      this.socket.emit('message', { topic: this.topics.output.setKi, value: this.Ki.toString(), souce: 'Angular FE' });
      this.socket.emit('message', { topic: this.topics.output.setKd, value: this.Kd.toString(), souce: 'Angular FE' });
    }
  }

  updateIncrementDegree(incrementDegree: number){
    this.incrementDegree = incrementDegree;
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output.setincrementDegree, value: incrementDegree.toString(), souce: 'Angular FE' });
    }
  }

  adjustTHREERobotLegPosition(x: number, height: number) {
    const leg = this.scene.children.find(
      (child: { name: string }) =>
        child instanceof THREE.Group && child.name === `leg-${x}`
    ) as THREE.Group;
    if (leg) {
      const thighUp = leg.children[0];
      const thighDown = leg.children[1];
      const shin = leg.children[2];

      const offset = height - 1;

      switch (height) {
        case 1: // low
          thighUp.rotation.x = Math.PI / 2;
          thighUp.position.x = 0;
          thighUp.position.y = 0.5;
          thighUp.position.z = -0.3;

          shin.rotation.x = -(Math.PI / 4);
          shin.position.x = 0;
          shin.position.y = 0.2;
          shin.position.z = -0.5;

          thighDown.position.set(0, 0.7, -0.4);
          thighDown.rotation.x = Math.PI / 2;
          break;
        case 2: // mid
          thighUp.rotation.x = Math.PI / 4;
          thighUp.position.x = 0;
          thighUp.position.y = 1;
          thighUp.position.z = -0.2;

          shin.rotation.x = -(Math.PI / 6);
          shin.position.x = 0;
          shin.position.y = 0.5;
          shin.position.z = -0.3;

          thighDown.position.set(0, 1.2, -0.4);
          thighDown.rotation.x = Math.PI / 5;
          break;
        case 3: // high
          thighUp.rotation.x = Math.PI;
          thighUp.position.x = 0;
          thighUp.position.y = 1.1;
          thighUp.position.z = 0;

          shin.rotation.x = Math.PI;
          shin.position.x = 0;
          shin.position.y = 0.3;
          shin.position.z = 0;

          thighDown.position.set(0, 1.2, -0.2);
          thighDown.rotation.x = Math.PI;
          break;
        default:
          break;
      }

      this.updateTHREERobotLegServos(leg, height);
    }
  }

  updateTHREERobotLegServos(leg: THREE.Group, height: number) {
    const THREEServo = leg.children.find(
      (child) =>
        child instanceof THREE.Mesh &&
        child.geometry.type === 'CylinderGeometry'
    );
    if (THREEServo) {
      switch (height) {
        case this.THREESettings.HEIGHT_HIGH:
          THREEServo.position.y = 1.4;
          break;
        case this.THREESettings.HEIGHT_MID:
          THREEServo.position.y = 1.2;
          break;
        case this.THREESettings.HEIGHT_LOW:
          THREEServo.position.y = 0.5;
          break;
      }
    }
  }

  setupThreeJS() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer();

    const container = this.threejsContainer?.nativeElement;
    if (container) {
      const width = 800;
      const height = 500;
      this.renderer.setSize(width, height);
      container.appendChild(this.renderer.domElement);
    }

    this.referencePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 1),
      new THREE.MeshBasicMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide })
    );
    this.referencePlane.position.set(0, 1.6, 0);
    this.referencePlane.rotation.x = Math.PI / 2;
    this.scene.add(this.referencePlane);

    this.addTHREERobotWheel(-1.2, -0.4, -0.2);
    this.addTHREERobotWheel(1.2, -0.4, -0.2);

    this.addTHREERobotLeg(-1, -1.2, 0, 0);
    this.addTHREERobotLeg(1, 1.2, 0, 0);

    this.camera.position.set(-2, 2, 3);

    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

    this.addTHREERobotGrid();
    this.animateTHREERobot();
  }

  addTHREERobotWheel(x: number, y: number, z: number) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x0000ff })
    );
    wheel.position.set(x, y, z);
    wheel.rotation.x = Math.PI / 2;
    wheel.rotation.z = Math.PI / 2;
    this.scene.add(wheel);
  }

  addTHREERobotLeg(name: number, x: number, y: number, z: number) {
    const leg = new THREE.Group();

    const thighUp = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.8, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    thighUp.position.set(0, 0.7, -0.3);
    thighUp.rotation.x = Math.PI / 4;
    leg.add(thighUp);

    const thighDown = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.6, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffd700 })
    );
    thighDown.position.set(0, 1.2, -0.4);
    thighDown.rotation.x = Math.PI / 5;
    leg.add(thighDown);

    const shin = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.8, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    shin.position.set(0, 0, 0);
    shin.rotation.x = -(Math.PI / 4);
    leg.add(shin);

    const servo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.2, 16),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    servo.position.set(0, 1, 0);
    servo.rotation.z = Math.PI / 2;
    leg.add(servo);

    leg.position.set(x, y, z);
    leg.name = `leg-${name}`; // Assign unique name
    this.scene.add(leg);
  }

  addTHREERobotGrid() {
    const gridHelper = new THREE.GridHelper(10, 10);
    gridHelper.position.y = -1;
    this.scene.add(gridHelper);
  }

  animateTHREERobot() {
    requestAnimationFrame(this.animateTHREERobot.bind(this));
    this.renderer.render(this.scene, this.camera);
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
        case this.topics.input.accelData:
          this.handleAccelData(parsedMessage as { accelData:  { accelX:number, accelY:number, accelZ:number }});
          break;

        case this.topics.input.tiltAngles:
          this.handleTiltAngles(parsedMessage.tiltAngles as { xAngle:number, yAngle:number }); // Access tiltAngles directly
          break;

        case this.topics.input.motorLeft:
          // this.handleMotorPWM('left', parsedMessage as { value: number});
          this.leftMotorPWM = parsedMessage
          break;

        case this.topics.input.motorRight:
          // this.handleMotorPWM('right', parsedMessage as { value: number});
          this.rightMotorPWM = parsedMessage
          break;

        case this.topics.input.servoLeft:
          // this.handleServoPulseWidth('left', parsedMessage as { value: number});
          this.leftServoPulse = parsedMessage;
          break;

        case this.topics.input.servoRight:
          // this.handleServoPulseWidth('right', parsedMessage as { value: number});
          this.rightServoPulse = parsedMessage;
          break;

        case this.topics.input.console:
          this.handleConsoleMessage(topic, parsedMessage.message, parsedMessage.source); // Access message content directly
          break;


        case this.topics.input.walkForward:
          this.walkForwardActive = true;
          break;
        case this.topics.input.walkBackward:
          this.walkBackwardActive = true;
          break;
        case this.topics.input.walkLeft:
          this.walkLeftActive = true;
          break;
        case this.topics.input.walkRight:
          this.walkRightActive = true;
          break;
        case this.topics.input.setHeightLow :
          this.adjustTHREERobotHeight(this.heightLevels[0]);
        break;
        case this.topics.input.setHeightMid :
          this.adjustTHREERobotHeight(this.heightLevels[1]);
        break;
        case this.topics.input.setHeightHigh:
          this.adjustTHREERobotHeight(this.heightLevels[2]);
        break;
        case this.topics.input.enableSensorAdjustementsTrue:
          this.isSensorAdjustmentEnabled = true;
          break;
        case this.topics.input.enableSensorAdjustementsFalse:
          this.isSensorAdjustmentEnabled = false;
          break;

         case this.topics.input.setKp:
            this.Kp = parsedMessage.value;
          break;
         case this.topics.input.setKi:
            this.Ki = parsedMessage.value;
          break;
         case this.topics.input.setKd:
            this.Kd = parsedMessage.value;
          break;
         case this.topics.input.setincrementDegree:
            this.incrementDegree = parsedMessage.value;
          break;
        default:
          console.log(`Unknown topic: ${topic}, ${parsedMessage}`);
          break;
      }
    });
  }

  handleAccelData(data: { accelData :{ accelX: number; accelY: number; accelZ: number }}) {
    // this.updateConsoleAccelData(data);
    this.accelData = data;
  }

  handleTiltAngles(data: { xAngle: number; yAngle: number }) {
    // this.updateConsoleTiltAngles(data);
    this.tiltAngles = data;
    this.updateTHREERobotTilt(data);
  }

  handleConsoleMessage(topic: string, message: string, source: string) {
    const m = JSON.stringify(message);
    this.logToConsole(`topic: ${topic}, message:${m}`);
  }

  // handleMotorPWM(wheel: string, data: { value: number }) {
  //   const value = data;

  //   // Update the motor PWM for the specified wheel
  //   this.updateTHREERobotMotorPWM(wheel, value);

  //   // Selectively update the left or right motor value in the HTML
  //   const motorValueElement = document.getElementById(`${wheel}-motor-value`);
  //   if (motorValueElement) {

  //     motorValueElement.innerText = `${value.value}`;
  //   }

  //   this.cdr.detectChanges();
  // }

  handleServoPulseWidth(servo: string, data: any) {
    if (servo === 'left' && this.rightLeg) {
      const rightLegPosition = this.rightLeg ? this.rightLeg.position : null;
      const rightHeight = rightLegPosition ? rightLegPosition.y : 0;
      this.updateTHREERobotWheelMovement({
        leftHeight: data.value,
        rightHeight: rightHeight,
      });
    } else if (servo === 'right' && this.leftLeg) {
      const leftLegPosition = this.leftLeg ? this.leftLeg.position : null;
      const leftHeight = leftLegPosition ? leftLegPosition.y : 0;
      this.updateTHREERobotWheelMovement({
        leftHeight: leftHeight,
        rightHeight: data.value,
      });
    }
    const servoValueElement = document.getElementById(`${servo}-servo-value`);
    if (servoValueElement) {
      servoValueElement.innerText = `${data.value}`;
    }

    this.cdr.detectChanges();
  }

  updateTHREERobotMotorPWM(wheel: string, data: { value: number} ) {
    const rotationIncrement = THREE.MathUtils.degToRad(data.value);
    if (wheel === 'left' && this.leftWheel) {
      this.leftWheel.rotation.z += rotationIncrement;
    } else if (wheel === 'right' && this.rightWheel) {
      this.rightWheel.rotation.z += rotationIncrement;
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

  // updateConsoleAccelData(data:any) {
  //   if(data){
  //     document.getElementById(
  //       'accelData-content'
  //     )!.innerHTML = `X: ${data?.accelData.accelX}°<br /> Y: ${data?.accelData.accelY}°<br /> Z: ${data?.accelData.accelZ}°`;
  //     this.cdr.detectChanges();
  //   }
  // }

  updateTHREERobotWheelMovement(data: { leftHeight: number; rightHeight: number }) {
    this.leftLeg.position.y = data.leftHeight;
    this.rightLeg.position.y = data.rightHeight;
  }

  updateTHREERobotTilt(data: { xAngle: number; yAngle: number }) {

    this.referencePlane.rotation.x = Math.PI / 2 + THREE.MathUtils.degToRad(data.xAngle);
    this.referencePlane.rotation.y = THREE.MathUtils.degToRad(data.yAngle);
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
          this.socket.emit('message', { topic: this.topics.output.setHeightLow, souce: 'Angular FE' });
          break;
        case 'mid':
          this.socket.emit('message', { topic: this.topics.output.setHeightMid, souce: 'Angular FE' });
          break;
        case 'high':
          this.socket.emit('message', { topic: this.topics.output.setHeightHigh, souce: 'Angular FE' });
          break;


      }

    } else {
      console.warn('Socket is null');
    }
  }

  sendStopCommand() {
    if (this.socket !== null) {
      this.socket.emit('message', { topic: this.topics.output.stop, souce: 'Angular FE' });
    } else {
      console.warn('Socket is null');
    }
  }

  // toggleEnableSensor() {
  //   if (this.socket !== null) {
  //     this.isSensorAdjustmentEnabled = !this.isSensorAdjustmentEnabled;
  //     switch (this.isSensorAdjustmentEnabled) {
  //       case true:
  //         this.sendEnableSensorCommand(this.topics.output.enableSensorAdjustementsTrue);
  //         break;
  //       case false:
  //         this.sendEnableSensorCommand(this.topics.output.enableSensorAdjustementsFalse);
  //         break;
  //     }

  //   } else {
  //     console.warn('Socket is null');
  //   }
  // }

  sendEnableSensorCommand(topic: string) {
    if (this.socket !== null) {
      this.socket.emit('message', { topic: topic, souce: 'Angular FE' });
    } else {
      console.warn('Socket is null');
    }
  }

  logToConsole(message: string) {
    // const consoleContent = document.getElementById('console-content')!;
    // consoleContent.innerHTML += `<p>${message}</p>`;
    // if (this.isConsoleAutoScrollEnabled) {
    //   consoleContent.scrollTop = consoleContent.scrollHeight;
    // }
    if (this.consoleComponent) {
      const topic = `topic${++this.messageIndex}`;
      const message = `Message ${this.messageIndex}`;
      const source = `Source`;

      // Pass the message to the child component
      this.consoleComponent.handleConsoleMessage(topic, message, source);
    }
  }

  ngOnDestroy() {
    this.socket?.disconnect();
  }
}
