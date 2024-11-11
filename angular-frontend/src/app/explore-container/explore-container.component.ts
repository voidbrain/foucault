import { io, Socket } from 'socket.io-client';
import { ChartConfiguration, ChartOptions, ChartType } from 'chart.js';
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
import { SocketService } from '../services/send-mqtt/send-mqtt.service'; // Make sure this service is set up to publish MQTT messages

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
    CommonModule, // Provides *ngFor, *ngIf, etc.
    FormsModule, // Provides form-related directives like ngModel
  ],
})
export class ExploreContainerComponent implements AfterViewInit {
  socket: Socket | null = null;
  status: string = 'Connecting...';
  heightLevel: number = 2;
  isEnabled: boolean = true;
  consoleMessages: string[] = [];

  topics = {
    console: 'console/log',
    accelData: 'controller/accelData',
    tiltAngles: 'controller/tiltAngles',
    motorLeft: 'controller/motorPWM/left',
    motorRight: 'controller/motorPWM/right',
    servoLeft: 'controller/servoPulseWidth/left',
    servoRight: 'controller/servoPulseWidth/right'
  };

  // Three.js objects
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  robotBody!: THREE.Mesh;
  leftWheel!: THREE.Mesh;
  rightWheel!: THREE.Mesh;
  leftLeg!: THREE.Group;
  rightLeg!: THREE.Group;
  balanceSensor!: THREE.Mesh;

  scenes: THREE.Scene[] = [];
  cameras: THREE.PerspectiveCamera[] = [];
  renderers: THREE.WebGLRenderer[] = [];

  @ViewChild('threejsContainer', { static: true }) threejsContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('cartesianContainer', { static: true }) cartesianContainer!: ElementRef<HTMLDivElement>;

  constructor(
    private socketService: SocketService,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.setupThreeJS();
    this.setupCartesianPlane();
    this.animate();
    this.setupSocket();
  }

  startObjectDetection() {
    if (this.socket !== null) {
      this.socket.emit('startObjectDetection');
    } else {
      console.warn('Socket is null');
    }
  }

  setupCartesianPlane() {
    // Set up Cartesian scene, camera, and renderer
    const cartesianScene = new THREE.Scene();
    const cartesianCamera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const cartesianRenderer = new THREE.WebGLRenderer();
    cartesianRenderer.setSize(window.innerWidth / 2, window.innerHeight / 2);
  
    // Append renderer to the div with id 'cartesian-container'
    const cartesianContainer = this.cartesianContainer?.nativeElement;
    if (cartesianContainer) {
      cartesianContainer.appendChild(cartesianRenderer.domElement);
    }
  
    // Create a plane with two colors on each side
    const planeGeometry = new THREE.PlaneGeometry(10, 10);
    const frontMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.FrontSide });
    const backMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.BackSide });
    const plane = new THREE.Mesh(planeGeometry, [frontMaterial, backMaterial]);
  
    // Rotate and add plane to scene
    plane.rotation.x = -Math.PI / 2; // Align with the ground
    cartesianScene.add(plane);
  
    // Set camera position
    cartesianCamera.position.set(5, 5, 5);
    cartesianCamera.lookAt(cartesianScene.position);

    // Add scene, camera, and renderer to the arrays for the animate loop
    this.scenes.push(cartesianScene);
    this.cameras.push(cartesianCamera);
    this.renderers.push(cartesianRenderer);
  }

  // Set up Three.js scene
  setupThreeJS() {    
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Append renderer to the div with id 'threejs-container'
    const container = this.threejsContainer?.nativeElement;
    if (container) {
        container.appendChild(this.renderer.domElement);
    }

    // Robot main body
    this.robotBody = new THREE.Mesh(
        new THREE.BoxGeometry(2, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    this.robotBody.position.y = 1.5;
    this.scene.add(this.robotBody);

    // Balance sensor
    const sensorGeometry = new THREE.SphereGeometry(0.1, 32, 32);
    const sensorMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    this.balanceSensor = new THREE.Mesh(sensorGeometry, sensorMaterial);
    this.balanceSensor.position.set(0, 2, 0); // Positioned at the top center of the main body
    this.robotBody.add(this.balanceSensor);

    // Wheels with motors
    this.leftWheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32),
        new THREE.MeshBasicMaterial({ color: 0x0000ff })
    );
    this.leftWheel.position.set(-0.8, 0.5, 0);
    this.leftWheel.rotation.z = Math.PI / 2;
    this.robotBody.add(this.leftWheel);

    this.rightWheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    this.rightWheel.position.set(0.8, 0.5, 0);
    this.rightWheel.rotation.z = Math.PI / 2;
    this.robotBody.add(this.rightWheel);

    // Left leg with two-piece thigh
    this.leftLeg = new THREE.Group();
    const leftUpperThigh = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.5, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    leftUpperThigh.position.set(0, 0.25, 0);
    this.leftLeg.add(leftUpperThigh);

    const leftLowerThigh = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.5, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    leftLowerThigh.position.set(0, -0.25, 0);
    leftUpperThigh.add(leftLowerThigh);

    // Left ankle with servo
    const leftAnkleServo = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.2, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xffa500 })
    );
    leftAnkleServo.position.set(0, -0.25, 0);
    leftLowerThigh.add(leftAnkleServo);

    this.leftLeg.position.set(-1, 0.5, 0);
    this.scene.add(this.leftLeg);

    // Right leg with two-piece thigh
    this.rightLeg = new THREE.Group();
    const rightUpperThigh = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.5, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    rightUpperThigh.position.set(0, 0.25, 0);
    this.rightLeg.add(rightUpperThigh);

    const rightLowerThigh = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.5, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    rightLowerThigh.position.set(0, -0.25, 0);
    rightUpperThigh.add(rightLowerThigh);

    // Right ankle with servo
    const rightAnkleServo = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.2, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xffa500 })
    );
    rightAnkleServo.position.set(0, -0.25, 0);
    rightLowerThigh.add(rightAnkleServo);

    this.rightLeg.position.set(1, 0.5, 0);
    this.scene.add(this.rightLeg);

    // Set camera position and add OrbitControls
    this.camera.position.z = 5;
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2; // Restrict to positive Z axis rotation

    // Add scene, camera, and renderer to the arrays for the animate loop
    this.scenes.push(this.scene);
    this.cameras.push(this.camera);
    this.renderers.push(this.renderer);
  }

  animate() {
      requestAnimationFrame(this.animate.bind(this));
      this.renderer.render(this.scene, this.camera);
  }


  setupSocket() {
    if (this.socket === null) {
      this.socket = io('http://foucault:8080'); // Make sure this URL is correct
    }

    this.socket.on('connect', () => {
      this.status = 'Connected';
    });

    this.socket.on('mqtt-message', (message: { topic: string; data: { source: string; data: any} }) => {
      const { topic, data: {data: parsedMessage, source} } = message;
      switch (topic) {
        case this.topics.accelData:
          this.handleAccelData(parsedMessage);
          break;

        case this.topics.tiltAngles:
          this.handleTiltAngles(parsedMessage);
          break;

        case this.topics.motorLeft:
          this.handleMotorPWM('left', parsedMessage);
          break;

        case this.topics.motorRight:
          this.handleMotorPWM('right', parsedMessage);
          break;

        case this.topics.servoLeft:
          this.handleServoPulseWidth('left', parsedMessage);
          break;

        case this.topics.servoRight:
          this.handleServoPulseWidth('right', parsedMessage);
          break;

        default:
          console.log(`Unknown topic: ${topic}, ${parsedMessage}`);
          break;

        case this.topics.console:
          this.handleConsoleMessage(topic, parsedMessage, source);
          break;
      }
    });
  }

  updateTiltAngles(data: { xAngle: number; yAngle: number }) {
    document.getElementById(
      'tiltAngles-content'
    )!.innerHTML = `X: ${data.xAngle}°, Y: ${data.yAngle}°`;
    this.cdr.detectChanges();
  }

  updateAccelData(data: { accelX: number; accelY: number; accelZ: number }) {
    document.getElementById(
      'accelData-content'
    )!.innerHTML = `X: ${data.accelX}°, Y: ${data.accelY}°, Z: ${data.accelZ}°`;
    this.cdr.detectChanges();
  }

  handleAccelData(data: { accelX: number; accelY: number; accelZ: number }) {
    const { accelX, accelY, accelZ } = data;
    console.log(`Accel Data - X: ${accelX}, Y: ${accelY}, Z: ${accelZ}`);
    this.updateAccelData(data);
    this.updateRobotTilt(data);
  }

  handleTiltAngles(data: { xAngle: number; yAngle: number }) {
    const { xAngle, yAngle } = data;
    console.log(`Tilt Angles - : ${xAngle}, Y: ${yAngle}`);
    this.updateTiltAngles(data);
  }

  handleConsoleMessage(topic: string, message: string, from: string ) {
    console.log(`Console Topic: ${topic}, From: ${from}, Message: ${message}`);
    this.logToConsole(message);
  }

  handleMotorPWM(wheel: string, data: { leftPWM: number; rightPWM: number }) {
    console.log(
      `${wheel} Motor PWM: Left: ${data.leftPWM}, Right: ${data.rightPWM}`
    );
    this.updateMotorPWM(data); // Pass the correct structure of data
  }

  updateMotorPWM(data: { leftPWM: number; rightPWM: number }) {
    this.leftWheel.rotation.z += THREE.MathUtils.degToRad(data.leftPWM);
    this.rightWheel.rotation.z += THREE.MathUtils.degToRad(data.rightPWM);
  }

  handleServoPulseWidth(
    servo: string,
    data: { leftValue: number; rightValue: number }
  ) {
    console.log(
      `${servo} Servo Pulse Width: Left: ${data.leftValue}, Right: ${data.rightValue}`
    );

    this.updateWheelMovement({
      leftHeight: data.leftValue,
      rightHeight: data.rightValue,
    });
  }

  updateWheelMovement(data: { leftHeight: number; rightHeight: number }) {
    this.leftLeg.position.y = data.leftHeight;
    this.rightLeg.position.y = data.rightHeight;
  }

  updateHeight(event: any) {
    const value = event.detail.value;
    this.heightLevel = value;
    console.log('Updated height:', value); // You can use the value as needed
  }

  updateRobotTilt(data: { accelX: number; accelY: number; accelZ: number }) {
    const { accelX, accelY } = data;
    this.robotBody.rotation.x = THREE.MathUtils.degToRad(accelX);
    this.robotBody.rotation.y = THREE.MathUtils.degToRad(accelY);
  }

  onHeightChange(event: any) {
    this.heightLevel = event.detail.value;
    console.log(`Height level changed to: ${this.heightLevel}`);
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
      this.socket.emit('move', { direction: command, from: "Angular FE" });
    } else {
      console.warn('Socket is null');
    }
    // this.logToConsole(`Moving: ${command}`);
  }

  logToConsole(message: string) {
    const consoleContent = document.getElementById('console-content')!;
    consoleContent.innerHTML += `<p>${message}</p>`;
    consoleContent.scrollTop = consoleContent.scrollHeight;
  }

  ngOnDestroy() {
    this.socket?.disconnect();
  }
}
