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
  isDynamic: boolean = true;

  HEIGHT_LOW = -0.5;   // Low height
  HEIGHT_MID = 1.5; // Mid height
  HEIGHT_HIGH = 2;  // High height

  heights = [
    "HEIGHT_LOW",
"HEIGHT_MID",
"HEIGHT_HIGH"
  ];

  @ViewChild('threejsContainer', { static: true })
  threejsContainer!: ElementRef<HTMLDivElement>;

  constructor(
    private socketService: SocketService,
    private cdr: ChangeDetectorRef
  ) {}


  ngAfterViewInit(): void {
    this.setupThreeJS();
    //this.setupCartesianPlane();
    this.setupSocket();
  }
  adjustHeightEvent(event: CustomEvent){
    this.adjustHeight(this.heights[event.detail.value])
  }

  updateLegServos(leg: THREE.Group, height: number) {
    // Access the servo part of the leg (assuming it's a cylinder or similar)
    const servo = leg.children.find(child => child instanceof THREE.Mesh && child.geometry.type === 'CylinderGeometry');
    if (servo) {
        // Adjust the servo rotation based on the height
        let angle = 0;

        // Example logic: change servo rotation depending on height
        if (height === this.HEIGHT_HIGH) {
            // If height is high, set a different angle (e.g., 90 degrees)
            angle = Math.PI / 2;
        } else if (height === this.HEIGHT_LOW) {
            // If height is low, set a different angle (e.g., -90 degrees)
            angle = -Math.PI / 2;
        } else {
            // Mid height logic
            angle = 0;
        }

        // Set the servo rotation based on the computed angle
        servo.rotation.z = angle;
    }
  }


  adjustHeight(value: string) {
    const height = value;
    console.log(height)
    let targetHeight = this.HEIGHT_MID; // Default to mid height

    switch (height) {
      case 'HEIGHT_LOW':
        targetHeight = this.HEIGHT_LOW;
        break;
      case 'HEIGHT_MID':
        targetHeight = this.HEIGHT_MID;
        break;
      case 'HEIGHT_HIGH':
        targetHeight = this.HEIGHT_HIGH;
        break;
    }

    this.updateRobotBody(targetHeight);

    // Adjust wheels based on the height setting
    this.updateWheels(targetHeight);

    // Adjust leg parts based on the height setting
    this.updateLegs(targetHeight);
}

updateRobotBody(targetHeight: number)
{
  // Adjust the robot body position
  this.robotBody.position.y = targetHeight;
}

updateWheels(height: number) {
    // Update the wheel positions based on the new height
    // Assuming the wheels are located at y = 1 for the mid height (for example)
    const wheelOffset = 0.5;  // Adjust based on your design

    this.updateWheelPosition(-0.75, height - wheelOffset, -0.4);  // Left wheel
    this.updateWheelPosition(0.75, height - wheelOffset, -0.4);   // Right wheel
}

updateWheelPosition(x: number, y: number, z: number) {
    // Update wheel position
    const wheel = this.scene.children.find(child => child instanceof THREE.Mesh && child.material.color.getHex() === 0x0000ff);
    if (wheel) {
        wheel.position.set(x, y, z);
    }
}

updateLegs(height: number) {
    // Adjust leg joints and parts based on the height
    // Calculate offsets and angles based on the target height
    this.adjustLegPosition(-1, 0, height);
    this.adjustLegPosition(1, 0, height);
}

adjustLegPosition(x: number, y: number, height: number) {
  // Access the leg and update the joints based on the new height
  const leg = this.scene.children.find(child => child instanceof THREE.Group);
  if (leg) {
      // Adjust the thigh and shin positions dynamically based on the height
      const thigh = leg.children[0]; // Assuming thigh is the first part
      const shin = leg.children[1];  // Assuming shin is the second part

      const offset = height - 1;  // Example offset calculation

      thigh.position.y = 0.5 + offset; // Adjust thigh position
      shin.position.y = offset;      // Adjust shin position
      leg.position.y = height;       // Set leg position

      // Call the servo adjustment function for this leg
      this.updateLegServos(leg, height);
  }
}

  toggleDynamic(event: any) {
    this.isDynamic = event.detail.checked;
    // Control logic for switching dynamic/static state
  }

  // Set up Three.js scene
  setupThreeJS() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,  // Aspect ratio
      0.1,  // Near clipping plane
      1000  // Far clipping plane
    );
    this.renderer = new THREE.WebGLRenderer();

    // Dynamically adjust to the container's size
    const container = this.threejsContainer?.nativeElement;
    if (container) {
      const width = 800;
      const height = 500;
      this.renderer.setSize(width, height);
      container.appendChild(this.renderer.domElement);
    }

    // Robot body
    this.robotBody = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    this.robotBody.position.y = 1;
    this.scene.add(this.robotBody);

    // Reference plane for stabilization
    const referencePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 1),
      new THREE.MeshBasicMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide })
    );
    referencePlane.position.set(0, 1.6, 0);
    referencePlane.rotation.x = Math.PI / 2;
    this.scene.add(referencePlane);

    // Add the wheels (Blue Cylinders)
    this.addWheel(-0.75, 0.5, -0.4);  // Left wheel
    this.addWheel(0.75, 0.5, -0.4);   // Right wheel

    // Add legs and servos
    this.addLeg(-1, 0, 0);  // Left leg
    this.addLeg(1, 0, 0);   // Right leg

    // Set camera position
    this.camera.position.z = 3;
    this.camera.position.x = -2;
    this.camera.position.y = 2;

    // Add OrbitControls to allow mouse drag for rotation
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;  // Restrict to positive Z axis rotation

    // Add XYZ Grid in the background
    this.addGrid();

    this.animate();
  }

  // Function to add a wheel
  addWheel(x: number, z: number, y: number) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x0000ff })
    );
    wheel.position.set(x, y, z);
    wheel.rotation.x = Math.PI / 2;
    wheel.rotation.z = Math.PI / 2;
    this.scene.add(wheel);
  }

  // Function to add a leg
  addLeg(x: number, y: number, z: number) {
    const leg = new THREE.Group();
    const leftThighSecondary = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.8, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x0000ff })
    );
    leftThighSecondary.position.set(0, 0.5, 0);
    leftThighSecondary.rotation.x = 1.2;
    leg.add(leftThighSecondary);

    const leftThighMain = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.8, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    leftThighMain.position.set(0, 0.7, -0.3);
    leftThighMain.rotation.x = Math.PI / 4;
    leg.add(leftThighMain);

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
    this.scene.add(leg);
  }

  // Function to add an XYZ grid
  addGrid() {
    const gridHelper = new THREE.GridHelper(10, 10);
    gridHelper.position.y = -1;
    this.scene.add(gridHelper);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }

  startObjectDetection() {
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
    const value = +event.detail.value;
    const levels = [
      "HEIGHT_LOW",
      "HEIGHT_MID",
      "HEIGHT_HIGH"
    ]
    this.heightLevel = value;
    const height = levels[value-1];
    this.adjustHeight(height);
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
