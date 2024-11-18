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

  getTopics() {
    return this.topics;
  }

  // Get PID config from the server
  async getConfig(): Promise<any> {
    try {
      const response = await axios.get(this.configUrl, {
        withCredentials: true  // Include credentials (cookies, authorization headers, etc.)
      });
      console.log(response)
      return response.data;
    } catch (error) {
      console.error('Error fetching config:', error);
      throw error;
    }
  }
}
