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

  // Three.js objects
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  robotBody!: THREE.Mesh;
  leftWheel!: THREE.Mesh;
  rightWheel!: THREE.Mesh;
  leftLeg!: THREE.Group;
  rightLeg!: THREE.Group;

  @ViewChild('threejsContainer', { static: true })
  threejsContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('cartesianContainer', { static: true })
  cartesianContainer!: ElementRef<HTMLDivElement>;

  constructor(
    private socketService: SocketService,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.setupThreeJS();
    this.setupCartesianPlane();
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

    // Render loop
    const animate = () => {
      requestAnimationFrame(animate);
      cartesianRenderer.render(cartesianScene, cartesianCamera);
    };
    animate();
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

    // Robot body
    this.robotBody = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    this.robotBody.position.y = 1;
    this.scene.add(this.robotBody);

    // Reference plane for stabilization on top of the body
    const referencePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 1),
      new THREE.MeshBasicMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide })
    );
    referencePlane.position.set(0, 1.6, 0); // Place slightly above the body
    referencePlane.rotation.x = Math.PI / 2;
    this.scene.add(referencePlane);

    // Left wheel with motor
    this.leftWheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x0000ff })
    );
    this.leftWheel.position.set(-0.75, -0.4, 0.5);
    this.leftWheel.rotation.x = Math.PI / 2;
    this.leftWheel.rotation.z = Math.PI / 2;
    this.scene.add(this.leftWheel);

    // Right wheel with motor
    this.rightWheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x0000ff })
    );
    this.rightWheel.position.set(0.75, -0.4, 0.5);
    this.rightWheel.rotation.x = Math.PI / 2;
    this.rightWheel.rotation.z = Math.PI / 2;
    this.scene.add(this.rightWheel);

    // Left leg setup with articulation points
    this.leftLeg = new THREE.Group();

    const leftThighSecondary = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.8, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x0000ff })
    );
    leftThighSecondary.position.set(0, 0.5, 0);
    leftThighSecondary.rotation.x = 1.2;
    this.leftLeg.add(leftThighSecondary);

    const leftThighMain = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.8, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    leftThighMain.position.set(0, 0.7, -0.3);
    leftThighMain.rotation.x = Math.PI / 4;
    this.leftLeg.add(leftThighMain);

    const leftShin = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.8, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    leftShin.position.set(0, -0, 0);
    leftShin.rotation.x = -(Math.PI / 4);
    this.leftLeg.add(leftShin);

    this.leftLeg.position.set(-1, 0, 0);
    this.scene.add(this.leftLeg);

    // Servo at the top leg/body connection for left leg
    const leftServo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.2, 16),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    leftServo.position.set(-1, 1, 0);
    this.scene.add(leftServo);

    // Right leg setup with articulation points
    this.rightLeg = new THREE.Group();
    const rightThighSecondary = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.8, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x0000ff })
    );
    rightThighSecondary.position.set(0, 0.5, 0);
    rightThighSecondary.rotation.x = 1.2;
    this.rightLeg.add(rightThighSecondary);

    const rightThighMain = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.8, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    rightThighMain.position.set(0, 0.7, -0.3);
    rightThighMain.rotation.x = Math.PI / 4;
    this.rightLeg.add(rightThighMain);

    this.rightLeg.position.set(1, 0, 0);
    this.scene.add(this.rightLeg);

    const rightShin = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.8, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    rightShin.position.set(0, -0, 0);
    rightShin.rotation.x = -(Math.PI / 4);
    this.rightLeg.add(rightShin);

    // Servo at the top leg/body connection for right leg
    const rightServo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.2, 16),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    rightServo.position.set(1, 1, 0);
    this.scene.add(rightServo);

    // Set camera position
    this.camera.position.z = 5;

    // Add OrbitControls to allow mouse drag for rotation
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2; // Restrict to positive Z axis rotation
    this.animate();
  }


  // Animation loop
  animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }

  setupSocket() {
    if (this.socket === null) {
      this.socket = io('http://foucault:8080'); // Make sure this URL is correct
    }

    this.socket.on('connect', () => {
      this.status = 'Connected';
    });

    this.socket.on('mqtt-message', (message: { topic: string; data: any }) => {
      const { topic, data: parsedMessage } = message;
      switch (topic) {
        case 'controller/accelData':
          this.handleAccelData(parsedMessage);
          break;

        case 'controller/tiltAngles':
          this.handleTiltAngles(parsedMessage);
          break;

        case 'controller/console':
          this.handleConsoleMessage(topic, parsedMessage);
          break;

        case 'controller/motorPWM/left':
          this.handleMotorPWM('left', parsedMessage);
          break;

        case 'controller/motorPWM/right':
          this.handleMotorPWM('right', parsedMessage);
          break;

        case 'controller/servoPulseWidth/left':
          this.handleServoPulseWidth('left', parsedMessage);
          break;

        case 'controller/servoPulseWidth/right':
          this.handleServoPulseWidth('right', parsedMessage);
          break;

        default:
          console.log(`Unknown topic: ${topic}, ${parsedMessage}`);
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

  handleConsoleMessage(topic: string, data: { message: string }) {
    const { message } = data;
    console.log(`Console Topic: ${topic}, Message: ${message}`);
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

  sendMqttMessage(topic: string, payload: any) {
    this.socketService.publishMqttMessage(topic, payload);
  }

  sendControlCommand(command: string) {
    if (this.socket !== null) {
      this.socket.emit('move', { direction: command });
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
