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
  //private configUrl = 'http://foucault:3004/config'

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

  constructor(){
    
  }

  getTopics() {
    return this.topics;
  }

  // Get PID config from the server
  async getConfig(): Promise<any> {
    try {
      const isPi: boolean = await this.isRaspberryPi();
      console.log(isPi)
      const url = isPi ? this.dockerUrl : this.localUrl ;

      const response = await axios.get(url, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching config:', error);
      throw error;
    }
  }

  async isRaspberryPi(): Promise<boolean> {
    try {
      const response = await axios.get<{ isRaspberryPi: boolean }>('http://localhost:8080/is-raspberry-pi');
      return response.data.isRaspberryPi;
    } catch (error) {
      console.error('Error checking Raspberry Pi:', error);
      return false;
    }
  }
  
}
