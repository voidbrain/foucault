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
  private configUrl = 'http://foucault:3004/config'
  
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
      walk: "pid/move",
      setHeight: "pid/set/height",
      enableSensorAdjustements: "pid/sensor/enable",
      setKp: "pid/set/Kp",
      setKi: "pid/set/Ki",
      setKd: "pid/set/Kd",
      setincrementDegree: "pid/set/increment",
      
      setServoRight:  "controller/servoPulseWidth/setServoRight",
      setServoLeft: "controller/servoPulseWidth/setServoLeft",
      setMotorRight:  "controller/motorPWM/setMotorRight",
      setMotorLeft: "controller/motorPWM/setMotorLeft"
      
    }
  };

  getTopics() {
    return this.topics;
  }

  // Get PID config from the server
  async getConfig(): Promise<any> {
    try {
      const response = await axios.get(this.configUrl, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching config:', error);
      throw error;
    }
  }
}
