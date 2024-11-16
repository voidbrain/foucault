// // socket.service.ts
// import { Injectable, signal } from '@angular/core';
// import { Socket } from 'socket.io-client';
// import { io } from 'socket.io-client';

// @Injectable({
//   providedIn: 'root',
// })
// export class SocketService {
//   private socket: Socket | null = null;
//   connectionStatus = signal<boolean>(false);  // Signal to track the connection status
//   messages = signal<any[]>([]);  // Signal to track incoming messages
//   socketStatus: string = 'Connecting...';

//   topics = {
//     input: {
//       console: 'console/log',
//       accelData: 'controller/accelData',
//       tiltAngles: 'controller/tiltAngles',
//       motorLeft: 'controller/motorPWM/left',
//       motorRight: 'controller/motorPWM/right',
//       servoLeft: 'controller/servoPulseWidth/left',
//       servoRight: 'controller/servoPulseWidth/right',

//       walkForward: "pid/move/forward",
//       walkBackward: "pid/move/backward",
//       walkLeft: "pid/move/left",
//       walkRight: "pid/move/right",
//       setHeightLow: "pid/set/height/low",
//       setHeightMid: "pid/set/height/mid",
//       setHeightHigh: "pid/set/height/high",
//       enableSensorAdjustementsTrue: "pid/sensor/enable/true",
//       enableSensorAdjustementsFalse: "pid/sensor/enable/false",
//       setKp: "pid/set/Kp",
//       setKi: "pid/set/Ki",
//       setKd: "pid/set/Kd",
//       setincrementDegree: "pid/set/increment",
//     },
//     output: {
//       walkForward: "pid/move/forward",
//       walkBackward: "pid/move/backward",
//       walkLeft: "pid/move/left",
//       walkRight: "pid/move/right",
//       stop: "pid/stop",
//       setHeightLow: "pid/set/height/low",
//       setHeightMid: "pid/set/height/mid",
//       setHeightHigh: "pid/set/height/high",

//       enableSensorAdjustementsTrue: "pid/sensor/enable/true",
//       enableSensorAdjustementsFalse: "pid/sensor/enable/false",
//       setKp: "pid/set/Kp",
//       setKi: "pid/set/Ki",
//       setKd: "pid/set/Kd",
//       setincrementDegree: "pid/set/increment",
//     }
//   };

//   constructor() {}

//   public setupSocket(): void {
//     if (this.socket === null) {
//       this.socket = io('http://foucault.local:8080'); // Make sure this URL is correct
//     }

//     this.socket.on('connect', () => {
//       this.socketStatus = 'Connected';
//     });

//     this.socket.on('mqtt-message', (message: { topic: string; data: any }) => {
//       const {
//         topic,
//         data,
//       } = message;
//       let parsedMessage;
//       if(data) {
//         parsedMessage = JSON.parse(data);
//       }


//       switch (topic) {
//         case this.topics.input.accelData:
//           this.handleAccelData(parsedMessage as { accelX:number, accelY:number, accelZ:number });
//           break;

//         case this.topics.input.tiltAngles:
//           this.handleTiltAngles(parsedMessage.tiltAngles as { xAngle:number, yAngle:number }); // Access tiltAngles directly
//           break;

//         case this.topics.input.motorLeft:
//           this.handleMotorPWM('left', parsedMessage as { value: number});
//           break;

//         case this.topics.input.motorRight:
//           this.handleMotorPWM('right', parsedMessage as { value: number});
//           break;

//         case this.topics.input.servoLeft:
//           this.handleServoPulseWidth('left', parsedMessage as { value: number});
//           break;

//         case this.topics.input.servoRight:
//           this.handleServoPulseWidth('right', parsedMessage as { value: number});
//           break;

//         case this.topics.input.console:
//           this.handleConsoleMessage(topic, parsedMessage.message, parsedMessage.source); // Access message content directly
//           break;


//         case this.topics.input.walkForward:
//           this.walkForwardActive = true;
//           break;
//         case this.topics.input.walkBackward:
//           this.walkBackwardActive = true;
//           break;
//         case this.topics.input.walkLeft:
//           this.walkLeftActive = true;
//           break;
//         case this.topics.input.walkRight:
//           this.walkRightActive = true;
//           break;
//         case this.topics.input.setHeightLow :
//           this.adjustTHREERobotHeight(this.heightLevels[0]);
//         break;
//         case this.topics.input.setHeightMid :
//           this.adjustTHREERobotHeight(this.heightLevels[1]);
//         break;
//         case this.topics.input.setHeightHigh:
//           this.adjustTHREERobotHeight(this.heightLevels[2]);
//         break;
//         case this.topics.input.enableSensorAdjustementsTrue:
//           this.isSensorAdjustmentEnabled = true;
//           break;
//         case this.topics.input.enableSensorAdjustementsFalse:
//           this.isSensorAdjustmentEnabled = false;
//           break;

//          case this.topics.input.setKp:
//             this.Kp = parsedMessage.value;
//           break;
//          case this.topics.input.setKi:
//             this.Ki = parsedMessage.value;
//           break;
//          case this.topics.input.setKd:
//             this.Kd = parsedMessage.value;
//           break;
//          case this.topics.input.setincrementDegree:
//             this.incrementDegree = parsedMessage.value;
//           break;
//         default:
//           console.log(`Unknown topic: ${topic}, ${parsedMessage}`);
//           break;
//       }
//     });
//   }

//   emitMessage(topic: string, value: string) {
//     if (this.socket) {
//       this.socket.emit('message', { topic, value });
//     }
//   }

//   disconnect() {
//     if (this.socket) {
//       this.socket.disconnect();
//     }
//   }
// }
