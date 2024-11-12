import { io, Socket } from 'socket.io-client';
import { Component, AfterViewInit, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonRow, IonButton, IonGrid, IonCol, IonCard, IonText, IonCardContent, IonCardTitle, IonCardHeader, IonLabel, IonRange, IonToggle, IonCardSubtitle } from '@ionic/angular/standalone';
import { SocketService } from '../services/send-mqtt/send-mqtt.service';
import * as THREE from 'three';

@Component({
  standalone: true,
  selector: 'app-explore-container',
  templateUrl: './explore-container.component.html',
  styleUrls: ['./explore-container.component.scss'],
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar, IonRow, IonButton, IonGrid, IonCol, IonCard, IonText, IonCardContent,
    IonCardTitle, IonCardHeader, IonLabel, IonRange, IonToggle, IonCardSubtitle, CommonModule, FormsModule
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

  topics = {
    console: 'console/log',
    accelData: 'controller/accelData',
    tiltAngles: 'controller/tiltAngles',
    motorLeft: 'controller/motorPWM/left',
    motorRight: 'controller/motorPWM/right',
    servoLeft: 'controller/servoPulseWidth/left',
    servoRight: 'controller/servoPulseWidth/right'
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
  isDynamic: boolean = true;

  HEIGHT_LOW = 1;
  HEIGHT_MID = 2;
  HEIGHT_HIGH = 3;

  BODY_HEIGHT_LOW = 0.4;
  BODY_HEIGHT_MID = 1;
  BODY_HEIGHT_HIGH = 1.2;

  LEG_HEIGHT_LOW = 0;
  LEG_HEIGHT_MID = 1;
  LEG_HEIGHT_HIGH = 2;

  heights = ["HEIGHT_LOW", "HEIGHT_MID", "HEIGHT_HIGH"];

  @ViewChild('threejsContainer', { static: true }) threejsContainer!: ElementRef<HTMLDivElement>;

  constructor(private socketService: SocketService, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.setupThreeJS();
    this.setupCartesianPlane();
    this.animate();
    this.setupSocket();
    this.adjustHeight("HEIGHT_MID");
  }

  adjustHeightEvent(event: CustomEvent) {
    this.adjustHeight(this.heights[event.detail.value - 1]);
  }

  adjustHeight(height: string) {
    let targetHeight = this.HEIGHT_MID;
    let offsetHeight;
    switch (height) {
      case 'HEIGHT_LOW':
        targetHeight = this.HEIGHT_LOW;
        offsetHeight = -0.8;
        this.updateRobotBody(this.BODY_HEIGHT_LOW, offsetHeight);
        break;
      case 'HEIGHT_MID':
        targetHeight = this.HEIGHT_MID;
        offsetHeight = 0;
        this.updateRobotBody(this.BODY_HEIGHT_MID, offsetHeight);
        break;
      case 'HEIGHT_HIGH':
        targetHeight = this.HEIGHT_HIGH;
        offsetHeight = +0.2;
        this.updateRobotBody(this.BODY_HEIGHT_HIGH, offsetHeight);
        break;
    }

    this.updateLegs(targetHeight);
  }

  updateLegs(height: number) {
    this.adjustLegPosition(-1, height); // Left leg
    this.adjustLegPosition(1, height);  // Right leg
    this.updateWheels(height);
  }

  updateRobotBody(targetHeight: number, offsetHeight: number) {
    this.robotBody.position.y = this.BODY_HEIGHT_MID + offsetHeight;
    this.referencePlane.position.y = this.BODY_HEIGHT_MID + offsetHeight + 0.6;
  }

  updateWheels(height: number) {
    // Update the wheel positions based on the new height
    // Assuming the wheels are located at y = 1 for the mid height (for example)
    const wheelOffset = 0.5;  // Adjust based on your design

    // this.updateWheelPosition(-0.75, height - wheelOffset, -0.4);  // Left wheel
    // this.updateWheelPosition(0.75, height - wheelOffset, -0.4);   // Right wheel
}

updateWheelPosition(x: number, y: number, z: number) {
  // Update wheel position
  const wheel = this.scene.children.find(child => child instanceof THREE.Mesh && child.material.color.getHex() === 0x0000ff);
  if (wheel) {
      wheel.position.set(x, y, z);
  }
}

  adjustLegPosition(x: number, height: number) {
    const leg = this.scene.children.find(child => child instanceof THREE.Group && child.name === `leg-${x}`) as THREE.Group;
    console.log(leg)
    if (leg) {
      const thighUp = leg.children[0];
      const thighDown = leg.children[1];
      const shin = leg.children[2];

      const offset = height - 1;

      switch(height){
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

          shin.rotation.x =  -(Math.PI / 6)
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

          shin.rotation.x = Math.PI ;
          shin.position.x = 0;
          shin.position.y = 0.3;
          shin.position.z = 0;

          thighDown.position.set(0, 1.2, -0.2);
          thighDown.rotation.x = Math.PI;
        break;
        default:
        break;
      }

      this.updateLegServos(leg, height);
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

  updateLegServos(leg: THREE.Group, height: number) {
    const servo = leg.children.find(child => child instanceof THREE.Mesh && child.geometry.type === 'CylinderGeometry');
    if (servo) {
      let angle = 0;
      if (height === this.HEIGHT_HIGH) {
        // angle = Math.PI / 2;
        servo.position.y = 1.4;
      }

      if (height === this.HEIGHT_MID) {
        // angle = -Math.PI / 2;
        servo.position.y = 1.2;
      }

      if (height === this.HEIGHT_LOW) {
        // angle = -Math.PI / 2;
        servo.position.y = 0.5;
      }
    }
  }

  toggleDynamic(event: any) {
    this.isDynamic = event.detail.checked;
  }

  setupThreeJS() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer();

    const container = this.threejsContainer?.nativeElement;
    if (container) {
      const width = 800;
      const height = 500;
      this.renderer.setSize(width, height);
      container.appendChild(this.renderer.domElement);
    }

    this.robotBody = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    this.robotBody.position.y = 1;
    this.scene.add(this.robotBody);

    this.referencePlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide }));
    this.referencePlane.position.set(0, 1.6, 0);
    this.referencePlane.rotation.x = Math.PI / 2;
    this.scene.add( this.referencePlane);

    this.addWheel(-1.2, -0.4, -0.2);
    this.addWheel(1.2, -0.4, -0.2);

    this.addLeg(-1,-1.2, 0, 0);
    this.addLeg(1, 1.2, 0, 0);

    this.camera.position.set(-2, 2, 3);

    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

    this.addGrid();
    this.animate();
  }

  addWheel(x: number, y: number, z: number) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
    wheel.position.set(x, y, z);
    wheel.rotation.x = Math.PI / 2;
    wheel.rotation.z = Math.PI / 2;
    this.scene.add(wheel);
  }

  addLeg(name:number, x: number, y: number, z: number) {
    const leg = new THREE.Group();

    const thighUp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
    thighUp.position.set(0, 0.7, -0.3);
    thighUp.rotation.x = Math.PI / 4;
    leg.add(thighUp);

    const thighDown = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), new THREE.MeshBasicMaterial({ color: 0xFFD700 }));
    thighDown.position.set(0, 1.2, -0.4);
    thighDown.rotation.x = Math.PI / 5;
    leg.add(thighDown);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
    shin.position.set(0, 0, 0);
    shin.rotation.x = -(Math.PI / 4);
    leg.add(shin);

    const servo = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 16), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
    servo.position.set(0, 1, 0);
    servo.rotation.z = Math.PI / 2;
    leg.add(servo);

    leg.position.set(x, y, z);
    leg.name = `leg-${name}`; // Assign unique name
    this.scene.add(leg);
  }

  addGrid() {
    const gridHelper = new THREE.GridHelper(10, 10);
    gridHelper.position.y = -1;
    this.scene.add(gridHelper);
  }

  animate() {
      requestAnimationFrame(this.animate.bind(this));
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
