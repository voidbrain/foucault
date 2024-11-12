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
} from '@ionic/angular/standalone';
import { SocketService } from '../services/send-mqtt/send-mqtt.service';
import * as THREE from 'three';

@Component({
  standalone: true,
  selector: 'app-explore-container',
  templateUrl: './explore-container.component.html',
  styleUrls: ['./explore-container.component.scss'],
  imports: [
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
    CommonModule,
    FormsModule,
  ],
})
export class ExploreContainerComponent implements AfterViewInit {
  socket: Socket | null = null;
  status: string = 'Connecting...';
  heightLevel: number = 2;
  isEnabled: boolean = true;
  consoleMessages: string[] = [];
  isConsoleAutoScrollEnabled: boolean = true;

  topics = {
    console: 'console/log',
    accelData: 'controller/accelData',
    tiltAngles: 'controller/tiltAngles',
    motorLeft: 'controller/motorPWM/left',
    motorRight: 'controller/motorPWM/right',
    servoLeft: 'controller/servoPulseWidth/left',
    servoRight: 'controller/servoPulseWidth/right',
  };

  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  robotBody!: THREE.Mesh;
  referencePlane!: THREE.Mesh;
  leftWheel!: THREE.Mesh;
  rightWheel!: THREE.Mesh;
  leftLeg!: THREE.Group;
  rightLeg!: THREE.Group;

  HEIGHT_LOW = 1;
  HEIGHT_MID = 2;
  HEIGHT_HIGH = 3;

  BODY_HEIGHT_LOW = 0.4;
  BODY_HEIGHT_MID = 1;
  BODY_HEIGHT_HIGH = 1.2;

  LEG_HEIGHT_LOW = 0;
  LEG_HEIGHT_MID = 1;
  LEG_HEIGHT_HIGH = 2;

  heights = ['HEIGHT_LOW', 'HEIGHT_MID', 'HEIGHT_HIGH'];

  @ViewChild('threejsContainer', { static: true })
  threejsContainer!: ElementRef<HTMLDivElement>;

  constructor(
    private socketService: SocketService,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.setupThreeJS();
    this.animateTHREERobot();
    this.setupSocket();
    this.adjustTHREERobotHeight('HEIGHT_MID');
  }

  adjustHeightEventFromSlider(event: CustomEvent) {
    this.adjustTHREERobotHeight(this.heights[event.detail.value - 1]);
  }

  adjustTHREERobotHeight(height: string) {
    let targetHeight = this.HEIGHT_MID;
    let offsetHeight;
    switch (height) {
      case 'HEIGHT_LOW':
        targetHeight = this.HEIGHT_LOW;
        offsetHeight = -0.8;
        this.updateTHREERobotBody(this.BODY_HEIGHT_LOW, offsetHeight);
        break;
      case 'HEIGHT_MID':
        targetHeight = this.HEIGHT_MID;
        offsetHeight = 0;
        this.updateTHREERobotBody(this.BODY_HEIGHT_MID, offsetHeight);
        break;
      case 'HEIGHT_HIGH':
        targetHeight = this.HEIGHT_HIGH;
        offsetHeight = +0.2;
        this.updateTHREERobotBody(this.BODY_HEIGHT_HIGH, offsetHeight);
        break;
    }

    this.updateTHREERobotLegs(targetHeight);
  }

  updateTHREERobotLegs(height: number) {
    this.adjustTHREERobotLegPosition(-1, height); // Left leg
    this.adjustTHREERobotLegPosition(1, height); // Right leg
  }

  updateTHREERobotBody(targetHeight: number, offsetHeight: number) {
    this.robotBody.position.y = targetHeight + offsetHeight;
    this.referencePlane.position.y = targetHeight + offsetHeight + 0.6;
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
    const servo = leg.children.find(
      (child) =>
        child instanceof THREE.Mesh &&
        child.geometry.type === 'CylinderGeometry'
    );
    if (servo) {
      switch (height) {
        case this.HEIGHT_HIGH:
          servo.position.y = 1.4;
          break;
        case this.HEIGHT_MID:
          servo.position.y = 1.2;
          break;
        case this.HEIGHT_LOW:
          servo.position.y = 0.5;
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

    this.robotBody = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    this.robotBody.position.y = 1;
    this.scene.add(this.robotBody);

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
      this.status = 'Connected';
    });

    this.socket.on('mqtt-message', (message: { topic: string; data: any }) => {
      console.log(message);
      const {
        topic,
        data: { ...parsedMessage },
      } = message;
      console.log(topic, parsedMessage);

      switch (topic) {
        case this.topics.accelData:
          this.handleAccelData(parsedMessage as { accelX:number, accelY:number, accelZ:number });
          break;

        case this.topics.tiltAngles:
          this.handleTiltAngles(parsedMessage.tiltAngles as { xAngle:number, yAngle:number }); // Access tiltAngles directly
          break;

        case this.topics.motorLeft:
          this.handleMotorPWM('left', parsedMessage as { value: number});
          break;

        case this.topics.motorRight:
          this.handleMotorPWM('right', parsedMessage as { value: number});
          break;

        case this.topics.servoLeft:
          this.handleServoPulseWidth('left', parsedMessage as { value: number});
          break;

        case this.topics.servoRight:
          this.handleServoPulseWidth('right', parsedMessage as { value: number});
          break;

        case this.topics.console:
          this.handleConsoleMessage(topic, parsedMessage.message, parsedMessage.source); // Access message content directly
          break;

        default:
          console.log(`Unknown topic: ${topic}, ${parsedMessage}`);
          break;
      }
    });
  }

  handleAccelData(data: { accelX: number; accelY: number; accelZ: number }) {
    this.updateConsoleAccelData(data);
    this.updateTHREERobotTilt(data);
  }

  handleTiltAngles(data: { xAngle: number; yAngle: number }) {
    this.updateConsoleTiltAngles(data);
  }

  handleConsoleMessage(topic: string, message: string, source: string) {
    const m = JSON.stringify(message);
    this.logToConsole(`topic: ${topic}, message:${m}`); 
  }

  handleMotorPWM(wheel: string, data: { value: number }) {
    const value = data;
    console.log("//", wheel, data) 
    // Update the motor PWM for the specified wheel
    this.updateTHREERobotMotorPWM(wheel, value);

    // Selectively update the left or right motor value in the HTML
    const motorValueElement = document.getElementById(`${wheel}-motor-value`);
    console.log("!!!",motorValueElement, `${data.value}`)
    if (motorValueElement) {
      
      motorValueElement.innerText = `${data.value}`;
    }

    this.cdr.detectChanges();
  }

  handleServoPulseWidth(servo: string, data: { value: number }) {
    console.log("//", servo, data)
    // console.log(`${servo} Servo Pulse Width: ${data.value}`);

    // Pass only the relevant height for the servo being updated
    if (servo === 'left') {
      this.updateTHREERobotWheelMovement({
        leftHeight: data.value,
        rightHeight: this.rightLeg?.position?.y ?? 0,
      });
    } else if (servo === 'right') {
      this.updateTHREERobotWheelMovement({
        leftHeight: this.leftLeg?.position?.y ?? 0,
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
    console.log("updateTHREERobotMotorPWM",wheel, data)
    const rotationIncrement = THREE.MathUtils.degToRad(data.value);
    if (wheel === 'left' && this.leftWheel) {
      this.leftWheel.rotation.z += rotationIncrement;
    } else if (wheel === 'right' && this.rightWheel) {
      this.rightWheel.rotation.z += rotationIncrement;
    }
  }

  updateConsoleTiltAngles(data: { xAngle: number; yAngle: number }) {
    document.getElementById(
      'tiltAngles-content'
    )!.innerHTML = `X: ${data.xAngle}°, Y: ${data.yAngle}°`;
    this.cdr.detectChanges();
  }

  updateConsoleAccelData(accelData: { accelX: number; accelY: number; accelZ: number }) {
    document.getElementById(
      'accelData-content'
    )!.innerHTML = `X: ${accelData.accelX}°, Y: ${accelData.accelY}°, Z: ${accelData.accelZ}°`;
    this.cdr.detectChanges();
  }

  updateTHREERobotWheelMovement(data: { leftHeight: number; rightHeight: number }) {
    this.leftLeg.position.y = data.leftHeight;
    this.rightLeg.position.y = data.rightHeight;
  }

  updateTHREERobotTilt(data: { accelX: number; accelY: number; accelZ: number }) {
    const { accelX, accelY } = data;
    this.robotBody.rotation.x = THREE.MathUtils.degToRad(accelX);
    this.robotBody.rotation.y = THREE.MathUtils.degToRad(accelY);
  }

  toggleEnable(event: any) {
    const { value, checked } = event.detail;
    if (this.socket !== null) {
      this.socket.emit('toggleEnable', checked);
    } else {
      console.warn('Socket is null');
    }
  }

  sendControlCommand(command: string) {
    if (this.socket !== null) {
      this.socket.emit('move', { direction: command, from: 'Angular FE' });
    } else {
      console.warn('Socket is null');
    }
    // this.logToConsole(`Moving: ${command}`);
  }

  logToConsole(message: string) {
    const consoleContent = document.getElementById('console-content')!;
    consoleContent.innerHTML += `<p>${message}</p>`;
    if (this.isConsoleAutoScrollEnabled) {
      consoleContent.scrollTop = consoleContent.scrollHeight;
    }
  }

  ngOnDestroy() {
    this.socket?.disconnect();
  }
}


/** 
 * 
 * 
 * 
 {
    "topic": "controller/servoPulseWidth/right",
    "data": {
        "source": "pid",
        "value": 500
    }
}

{
    "topic": "controller/motorPWM/right",
    "data": {
        "source": "pid",
        "value": 127
    }
}

    {
    "topic": "controller/motorPWM/right",
    "data": {
        "source": "pid",
        "value": 127
    }
}
*/
