// threejs.service.ts
import { Injectable, signal } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root',
})
export class ThreejsService {
  scene = signal<THREE.Scene | null>(null);  // Signal for the Three.js scene
  camera = signal<THREE.PerspectiveCamera | null>(null);  // Signal for the camera
  renderer = signal<THREE.WebGLRenderer | null>(null);  // Signal for the renderer
  isInitialized = signal<boolean>(false);  // Signal to track if the scene is initialized

  constructor() {}

  initializeScene(): void {
    if (!this.scene()) {
      this.scene.set(new THREE.Scene());
      this.camera.set(new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000));
      this.renderer.set(new THREE.WebGLRenderer());
      this.isInitialized.set(true);
    }
  }

  updateCameraPosition(x: number, y: number, z: number): void {
    if (this.camera()) {
      this.camera().position.set(x, y, z);
    }
  }

  renderScene(): void {
    if (this.renderer() && this.scene() && this.camera()) {
      this.renderer().render(this.scene(), this.camera());
    }
  }
}
