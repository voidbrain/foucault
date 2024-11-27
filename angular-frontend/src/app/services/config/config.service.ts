// src/app/services/config.service.ts
import { Injectable } from '@angular/core';
import axios from 'axios';

export interface TopicsInterface {
  input: {
    [key: string]: string;
  };
  output: {
    [key: string]: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private localUrl = 'http://localhost:3004/config';
  private dockerUrl = 'http://foucault:3004/config';

  private topics = {
    input: {
      console: 'console/log',
      accelData: 'controller/accelData',
      tiltAngles: 'controller/tiltAngles',
      motorLeft: 'controller/motorPWM/left',
      motorRight: 'controller/motorPWM/right',
      servoLeft: 'controller/servoPulseWidth/left',
      servoRight: 'controller/servoPulseWidth/right',
      walk: "pid/move",
      setHeight: "pid/set/height",
      enableSensorAdjustements: "pid/sensor/enable",

      setKp: "pid/set/Kp",
      setKi: "pid/set/Ki",
      setKd: "pid/set/Kd",
      setincrementDegree: "pid/set/increment",
    },
    output: {
      stop: "pid/stop",
      start: "pid/start",
      walk: "pid/move",
      setHeight: "pid/set/height",
      enableSensorAdjustements: "pid/sensor/enable",
      setKp: "pid/set/Kp",
      setKi: "pid/set/Ki",
      setKd: "pid/set/Kd",
      setincrementDegree: "pid/set/increment",

      setServoRight:  "controller/servoPulseWidth/right",
      setServoLeft: "controller/servoPulseWidth/left",
      setMotorRight:  "controller/motorPWM/right",
      setMotorLeft: "controller/motorPWM/left"

    }
  };

  getTopics() {
    return this.topics;
  }

  // Get PID config from the server
  async getConfig(): Promise<any> {
    try {
      const url = this.isRaspberryPi() ? this.dockerUrl : this.localUrl;
      const response = await axios.get(url, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching config:', error);
      throw error;
    }
  }

  isRaspberryPi(){
    const userAgent = navigator.userAgent.toLowerCase();
    // Check for Raspberry keyword in user-agent
    const isRaspberry = userAgent.includes('raspberry');
    return isRaspberry;
  }
}
