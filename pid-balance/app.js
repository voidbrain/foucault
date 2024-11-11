const i2c = require('i2c');
const mqtt = require('mqtt');

// MPU6050 and I2C setup
const address = 0x68; // MPU6050 default I2C address
const wire = new i2c(address, { device: '/dev/i2c-1' });

// PID constants
const Kp = 1.2; // Proportional gain
const Ki = 0.0; // Integral gain
const Kd = 0.4; // Derivative gain

// PID variables
let previousErrorLeft = 0;
let previousErrorRight = 0;
let integralLeft = 0;
let integralRight = 0;
let setpoint = 0; // Desired balance angle (0 for upright)

// MPU6050 Registers
const PWR_MGMT_1 = 0x6B;
const ACCEL_XOUT_H = 0x3B; // Start of accelerometer data

// MQTT topics
const topics = {
  console: 'console/log',
  accelData: 'controller/accelData',
  tiltAngles: 'controller/tiltAngles',
  motorLeft: 'controller/motorPWM/left',
  motorRight: 'controller/motorPWM/right',
  servoLeft: 'controller/servoPulseWidth/left',
  servoRight: 'controller/servoPulseWidth/right'
};

// MQTT client setup
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://mqtt-broker:1883');
mqttClient.on('connect', () => console.log('Connected to MQTT broker'));
mqttClient.on('message', (topic, message) => { /* handle messages here if necessary */ });

// Function to send an MQTT message
function sendMQTTMessage(topic, object) {
  mqttClient.publish(topic, JSON.stringify(object), (err) => {
    if (err) {
      console.error('Error sending MQTT object:', err);
    }
  });
}

// Wake up the MPU6050 by writing 0 to the PWR_MGMT_1 register
function wakeUpMPU6050() {
  wire.writeBytes(PWR_MGMT_1, [0x00], (err) => {
    if (err) {
      sendMQTTMessage(topics.console, { source:"pid", message: "Error waking up MPU6050", error: err });
    } else {
      sendMQTTMessage(topics.console, { source:"pid", message: "MPU6050 awake" });
    }
  });
}

// Function to read accelerometer data with retry logic
function readAccelerometer() {
  return new Promise((resolve, reject) => {
    let retries = 3;
    function attemptRead() {
      wire.readBytes(ACCEL_XOUT_H, 6, (err, buffer) => {
        if (err) {
          if (retries > 0) {
            retries--;
            attemptRead();
          } else {
            reject("Failed to read accelerometer data");
          }
        } else {
          let accelX = (buffer[0] << 8) | buffer[1];
          let accelY = (buffer[2] << 8) | buffer[3];
          let accelZ = (buffer[4] << 8) | buffer[5];

          accelX = accelX > 32767 ? accelX - 65536 : accelX;
          accelY = accelY > 32767 ? accelY - 65536 : accelY;
          accelZ = accelZ > 32767 ? accelZ - 65536 : accelZ;

          resolve({ accelX, accelY, accelZ });
        }
      });
    }
    attemptRead();
  });
}

// Function to calculate tilt angles based on accelerometer data
async function getTiltAngles() {
  try {
    const accelData = await readAccelerometer();
    const { accelX, accelY, accelZ } = accelData;
    console.log("accelData", accelData);
    sendMQTTMessage(topics.accelData, { accelData, source:'pid'});

    const xAngle = Math.atan2(accelY, accelZ) * (180 / Math.PI);
    const yAngle = Math.atan2(accelX, accelZ) * (180 / Math.PI);

    return { xAngle, yAngle };
  } catch (error) {
    sendMQTTMessage(topics.console, { source:"pid", message: `Error getting tilt angles: ${error}` });
    return { xAngle: 0, yAngle: 0 };
  }
}

// Calculate height difference based on tilt angles for independent servos
function calculateHeightDifference({ xAngle }) {
  const tiltToHeightFactor = 0.1; // Adjust this factor as necessary
  const heightDifference = xAngle * tiltToHeightFactor;
  return {
    leftHeight: heightDifference,
    rightHeight: -heightDifference // Invert for the opposite side
  };
}

// Adjusted PID controller for each motor based on tilt angle direction
function pidControl(currentAngle, previousError, integral, isLeftMotor) {
  const error = setpoint - currentAngle;
  integral += error;
  const derivative = error - previousError;
  const output = Kp * error + Ki * integral + Kd * derivative;

  // Apply minimum output threshold
  const minOutputThreshold = 5;
  const adjustedOutput = Math.abs(output) < minOutputThreshold ? 0 : output;

  // Reverse direction of output based on tilt direction for each motor
  const directionAdjustedOutput = isLeftMotor ? adjustedOutput : -adjustedOutput;
  return { output: directionAdjustedOutput, previousError: error, integral };
}

// Function to update motors based on separate outputs for left and right motors
function updateMotors(leftOutput, rightOutput) {
  const clampedLeftOutput = Math.max(0, Math.min(255, Math.round(127 + leftOutput))); // Center at 127 for both directions
  const clampedRightOutput = Math.max(0, Math.min(255, Math.round(127 + rightOutput)));

  sendMQTTMessage(topics.motorLeft, { source: 'pid', value: clampedLeftOutput });
  sendMQTTMessage(topics.motorRight, { source: 'pid', value: clampedRightOutput });

  console.log(`Left Motor PWM: ${clampedLeftOutput}, Right Motor PWM: ${clampedRightOutput}`);
}

// Function to adjust servos based on height difference calculation
function adjustServos(xAngle) {
  const { leftHeight, rightHeight } = calculateHeightDifference({ xAngle });

  const leftPulseWidth = Math.round(500 + (leftHeight * 2000));
  const rightPulseWidth = Math.round(500 + (rightHeight * 2000));

  const clampedLeftPulseWidth = Math.max(500, Math.min(2500, leftPulseWidth));
  const clampedRightPulseWidth = Math.max(500, Math.min(2500, rightPulseWidth));

  sendMQTTMessage(topics.servoLeft, { source:'pid', value: clampedLeftPulseWidth}); // Corrected message format
  sendMQTTMessage(topics.servoRight, { source:'pid', value: clampedRightPulseWidth}); // Corrected message format

  console.log(`Left Servo Pulse Width: ${clampedLeftPulseWidth}µs`);
  console.log(`Right Servo Pulse Width: ${clampedRightPulseWidth}µs`);
}

// Run control loop at regular intervals (e.g., 200ms)
setInterval(controlLoop, 200);

// Main control loop (called at regular intervals)
async function controlLoop() {
  const tiltAngles = await getTiltAngles();
  
  // Separate PID calculations for each motor, reversing output as necessary
  const pidLeft = pidControl(tiltAngles.xAngle, previousErrorLeft, integralLeft, true);
  const pidRight = pidControl(tiltAngles.yAngle, previousErrorRight, integralRight, false);

  // Update previous errors and integrals
  previousErrorLeft = pidLeft.previousError;
  integralLeft = pidLeft.integral;
  previousErrorRight = pidRight.previousError;
  integralRight = pidRight.integral;

  sendMQTTMessage(topics.tiltAngles, {tiltAngles, source:'pid'});

  // Update motors with the adjusted outputs
  updateMotors(pidLeft.output, pidRight.output);

  // Adjust servos for balance
  adjustServos(tiltAngles.xAngle);
}

// Initialize MPU6050
wakeUpMPU6050();
