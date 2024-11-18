import {
  Component,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  Input,
} from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-threejs',
  templateUrl: './threejs.component.html',
  styleUrls: ['./threejs.component.scss'],
  standalone: true
})
export class ThreejsComponent implements AfterViewInit, OnChanges {
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  referencePlane!: THREE.Mesh;
  leftWheel!: THREE.Mesh;
  rightWheel!: THREE.Mesh;
  leftLeg!: THREE.Group;
  rightLeg!: THREE.Group;

  @ViewChild('threejsContainer', { static: true }) threejsContainer!: ElementRef<HTMLDivElement>;
  @Input() adjustTHREERobotHeightValue!: string;
  @Input() updateTHREERobotTiltValue!: { xAngle: number; yAngle: number };
  @Input() updateTHREERobotMotorPWMValue!: { servo: string, data: any };
  @Input() updateTHREERobotWheelMovementValue!: { wheel: string, data: { value: number} };


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

  ngAfterViewInit() {
    this.setupThreeJS();
    this.animateTHREEScene();
    this.adjustTHREERobotHeight('mid');
  }

  ngOnChanges(change:SimpleChanges) {
    if (this.adjustTHREERobotHeightValue){
      this.adjustTHREERobotHeight(this.adjustTHREERobotHeightValue)
    }
    if (this.updateTHREERobotTiltValue){
      this.updateTHREERobotTilt(this.updateTHREERobotTiltValue)
    }
    if (this.updateTHREERobotMotorPWMValue){
      this.updateTHREERobotMotorPWM(this.updateTHREERobotMotorPWMValue)
    }
    if (this.updateTHREERobotWheelMovementValue){
      this.handleServoPulseWidth(this.updateTHREERobotWheelMovementValue)
    }
  }

  updateTHREERobotMotorPWM(value: any) {
    const wheel = value.wheel;
    const data = value.data;
    const rotationIncrement = THREE.MathUtils.degToRad(data.value);
    if (wheel === 'left' && this.leftWheel) {
      this.leftWheel.rotation.z += rotationIncrement;
    } else if (wheel === 'right' && this.rightWheel) {
      this.rightWheel.rotation.z += rotationIncrement;
    }
  }

  handleServoPulseWidth(value: any) {
    const servo = value.servo;
      const data = value.data;

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

    this.camera.position.z = 5;
  }

  animateTHREEScene() {
    const animate = () => {
      requestAnimationFrame(animate);
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

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

  updateTHREERobotWheelMovement(data: { leftHeight: number; rightHeight: number }) {
    this.leftLeg.position.y = data.leftHeight;
    this.rightLeg.position.y = data.rightHeight;
  }

  updateTHREERobotTilt(data: { xAngle: number; yAngle: number }) {

    this.referencePlane.rotation.x = Math.PI / 2 + THREE.MathUtils.degToRad(data.xAngle);
    this.referencePlane.rotation.y = THREE.MathUtils.degToRad(data.yAngle);
  }

  updateTHREERobotLegs(height: number) {
    this.adjustTHREERobotLegPosition(-1, height); // Left leg
    this.adjustTHREERobotLegPosition(1, height); // Right leg
  }

  updateTHREERobotBody(targetHeight: number, offsetHeight: number) {
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
}
