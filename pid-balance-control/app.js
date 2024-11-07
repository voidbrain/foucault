var i2c = require('i2c');
var address = 0x68; // MPU6050 default I2C address
var wire = new i2c(address, { device: '/dev/i2c-1' });
const mqtt = require('mqtt');

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
const WHO_AM_I = 0x75;
const ACCEL_XOUT_H = 0x3B; // Start of accelerometer data

// Setup MQTT connection
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://mqtt-broker:1883');

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
});

mqttClient.on('message', (topic, message) => {
  // console.log(`Received message: ${message.toString()} on topic: ${topic}`);
});

// Function to send an MQTT message
function sendMQTTMessage(topic, message) {
  mqttClient.publish(topic, JSON.stringify(message), (err) => {
    if (err) {
      console.error('Error sending MQTT message:', err);
    } else {
      // console.log(`Message sent to ${topic}:`, message);
    }
  });
}

// Wake up the MPU6050 by writing 0 to the PWR_MGMT_1 register
wire.writeBytes(PWR_MGMT_1, [0x00], function (err) {
  if (err) {
    const message = "Error waking up MPU6050:";
    // console.log(message, err);
    sendMQTTMessage('pid/console', { message, err });
    return;
  }
  const message = "MPU6050 awake";
  // console.log(message);
  sendMQTTMessage('pid/console', { message });
});


// Function to read accelerometer data with a Promise
function readAccelerometer() {
  return new Promise((resolve, reject) => {
    let retries = 3;
    function attemptRead() {
      wire.readBytes(ACCEL_XOUT_H, 6, function (err, buffer) {
        if (err) {
          if (retries > 0) {
            // console.log(`Error reading accelerometer, retrying... (${retries} attempts left)`);
            retries--;
            attemptRead();
          } else {
            // console.log("Error reading accelerometer data:", err);
            resolve(null);
          }
          return;
        }

        let accelX = (buffer[0] << 8) | buffer[1];
        let accelY = (buffer[2] << 8) | buffer[3];
        let accelZ = (buffer[4] << 8) | buffer[5];

        accelX = accelX > 32767 ? accelX - 65536 : accelX;
        accelY = accelY > 32767 ? accelY - 65536 : accelY;
        accelZ = accelZ > 32767 ? accelZ - 65536 : accelZ;

        resolve({ accelX, accelY, accelZ });
      });
    }

    attemptRead();
  });
}

// Function to calculate tilt angles based on accelerometer data
async function getTiltAngles() {
  const accelData = await readAccelerometer();
  if (!accelData) {
    const message = "Error getting tilt angles: No accelerometer data";
    // console.log(message);
    sendMQTTMessage('pid/console', { message });
    return { xAngle: 0, yAngle: 0 };
  }
  const { accelX, accelY, accelZ } = accelData;

  const xAngle = Math.atan2(accelY, accelZ) * (180 / Math.PI);
  const yAngle = Math.atan2(accelX, accelZ) * (180 / Math.PI);

  return { xAngle, yAngle, accelData };
}

// Calculate height difference based on tilt angles for independent servos
function calculateHeightDifference({ xAngle, yAngle }) {
  const tiltToHeightFactor = 0.1; // Adjust this factor as necessary
  return {
    leftHeight: xAngle * tiltToHeightFactor,
    rightHeight: yAngle * tiltToHeightFactor
  };
}

// PID Controller for each motor
function pidControl(currentAngle, previousError, integral) {
  const error = setpoint - currentAngle;
  integral += error;
  const derivative = error - previousError;
  const output = Kp * error + Ki * integral + Kd * derivative;
  return { output, previousError: error, integral };
}


function updateMotors(leftOutput, rightOutput) {
  const message = `Motor PID Output - Left: ${leftOutput}, Right:${rightOutput}`;
  // console.log(message);
  sendMQTTMessage('pid/motors', { message, leftOutput, rightOutput });
  // Code to control the motors based on left and right outputs
}

function adjustServos(leftHeight, rightHeight) {
  const message = `Servo Adjustment - Left Height: ${leftHeight}, Right Height:${rightHeight}`;
  // console.log(message);
  sendMQTTMessage('pid/servos', { message, leftHeight, rightHeight });
  // Code to adjust left and right servos based on individual heights
}


// Main control loop
async function controlLoop() {
  // console.log("*** Control Loop *** ") 
  const tiltAngles = await getTiltAngles();

  const pidLeft = pidControl(tiltAngles.xAngle, previousErrorLeft, integralLeft);
  const pidRight = pidControl(tiltAngles.yAngle, previousErrorRight, integralRight);

  previousErrorLeft = pidLeft.previousError;
  integralLeft = pidLeft.integral;
  previousErrorRight = pidRight.previousError;
  integralRight = pidRight.integral;

  updateMotors(pidLeft.output, pidRight.output);

  const heightDifference = calculateHeightDifference(tiltAngles);
  adjustServos(heightDifference.leftHeight, heightDifference.rightHeight);
}

// Run control loop at regular intervals (e.g., 100ms)
setInterval(controlLoop, 200);

