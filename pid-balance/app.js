const i2c = require("i2c");
const mqtt = require("mqtt");

// MPU6050 and I2C setup
const address = 0x68; // MPU6050 default I2C address
const wire = new i2c(address, { device: "/dev/i2c-1" });

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
let increment = 1; // Default increment for movement adjustments

// MPU6050 Registers
const PWR_MGMT_1 = 0x6b;
const ACCEL_XOUT_H = 0x3b;

// Flag for sensor adjustments
let sensorAdjustmentsEnabled = true;

// MQTT topics
const topics = {
  output: {
    console: "console/log",
    accelData: "controller/accelData",
    tiltAngles: "controller/tiltAngles",
    motorLeft: "controller/motorPWM/left",
    motorRight: "controller/motorPWM/right",
    servoLeft: "controller/servoPulseWidth/left",
    servoRight: "controller/servoPulseWidth/right",
  },
  input: {
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
  },
};

// MQTT client setup
const mqttClient = mqtt.connect("mqtt://mqtt-broker:1883");
mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
  mqttClient.subscribe(Object.values(topics.input), (err) => {
    if (err) console.error("Subscription error:", err);
  });
});

// Message handler for subscribed topics
mqttClient.on("message", (topic) => {
    switch (topic) {
      case topics.input.walkForward:
        handleWalk("forward");
        break;
      case topics.input.walkBackward:
        handleWalk("backward");
        break;
      case topics.input.walkLeft:
        handleWalk("left");
        break;
      case topics.input.walkRight:
        handleWalk("right");
        break;
      case topics.input.stop:
        handleStop();
        break;
      case topics.input.setHeightLow:
        break;
      case topics.input.setHeightMid:
        break;
      case topics.input.setHeightHigh:
        break;
      case topics.input.enableSensorAdjustementsTrue:
        sensorAdjustmentsEnabled = true;
        break;
      case topics.input.enableSensorAdjustementsFalse:
        sensorAdjustmentsEnabled = false;
        break;
    }
});

function handleStop() {
  pidControl(setpoint, previousErrorLeft, integralLeft, true);
  pidControl(setpoint, previousErrorRight, integralRight, false);
}

// Function to handle walking directions
function handleWalk(direction) {
  switch (direction) {
    case "forward":
      pidControl(setpoint + increment, previousErrorLeft, integralLeft, true);
      pidControl(
        setpoint + increment,
        previousErrorRight,
        integralRight,
        false
      );
      break;
    case "backward":
      pidControl(setpoint - increment, previousErrorLeft, integralLeft, true);
      pidControl(
        setpoint - increment,
        previousErrorRight,
        integralRight,
        false
      );
      break;
    case "left":
      pidControl(setpoint + increment, previousErrorLeft, integralLeft, true);
      pidControl(
        setpoint - increment,
        previousErrorRight,
        integralRight,
        false
      );
      break;
    case "right":
      pidControl(setpoint - increment, previousErrorLeft, integralLeft, true);
      pidControl(
        setpoint + increment,
        previousErrorRight,
        integralRight,
        false
      );
      break;
  }
}

// Function to send an MQTT message
function sendMQTTMessage(topic, object) {
  mqttClient.publish(topic, JSON.stringify(object), (err) => {
    if (err) console.error("Error sending MQTT object:", err);
  });
}

// Wake up the MPU6050 by writing 0 to the PWR_MGMT_1 register
function wakeUpMPU6050() {
  wire.writeBytes(PWR_MGMT_1, [0x00], (err) => {
    sendMQTTMessage(topics.output.console, {
      source: "pid",
      message: err ? "Error waking up MPU6050" : "MPU6050 awake",
      error: err,
    });
  });
}

// Function to read accelerometer data with retry logic
function readAccelerometer() {
  return new Promise((resolve, reject) => {
    wire.readBytes(ACCEL_XOUT_H, 6, (err, buffer) => {
      if (err) reject("Failed to read accelerometer data");
      else {
        let accelX = (buffer[0] << 8) | buffer[1];
        let accelY = (buffer[2] << 8) | buffer[3];
        let accelZ = (buffer[4] << 8) | buffer[5];

        accelX = accelX > 32767 ? accelX - 65536 : accelX;
        accelY = accelY > 32767 ? accelY - 65536 : accelY;
        accelZ = accelZ > 32767 ? accelZ - 65536 : accelZ;

        resolve({ accelX, accelY, accelZ });
      }
    });
  });
}

// Function to calculate tilt angles based on accelerometer data
async function getTiltAngles() {
  try {
    const accelData = await readAccelerometer();
    const xAngle =
      Math.atan2(accelData.accelY, accelData.accelZ) * (180 / Math.PI);
    const yAngle =
      Math.atan2(accelData.accelX, accelData.accelZ) * (180 / Math.PI);
    sendMQTTMessage(topics.output.accelData, { accelData, source: "pid" });
    return { xAngle, yAngle };
  } catch (error) {
    sendMQTTMessage(topics.output.console, {
      source: "pid",
      message: `Error getting tilt angles: ${error}`,
    });
    return { xAngle: 0, yAngle: 0 };
  }
}

// Adjusted PID controller for each motor based on tilt angle direction
function pidControl(currentAngle, previousError, integral, isLeftMotor) {
  const error = setpoint - currentAngle;
  integral += error;
  const derivative = error - previousError;
  const output = Kp * error + Ki * integral + Kd * derivative;
  const minOutputThreshold = 5;
  const adjustedOutput = Math.abs(output) < minOutputThreshold ? 0 : output;
  return {
    output: isLeftMotor ? adjustedOutput : -adjustedOutput,
    previousError: error,
    integral,
  };
}

// Function to update motors based on separate outputs for left and right motors
function updateMotors(leftOutput, rightOutput) {
  const clampedLeftOutput = Math.max(
    0,
    Math.min(255, Math.round(127 + leftOutput))
  );
  const clampedRightOutput = Math.max(
    0,
    Math.min(255, Math.round(127 + rightOutput))
  );

  sendMQTTMessage(topics.output.motorLeft, {
    source: "pid",
    value: clampedLeftOutput,
  });
  sendMQTTMessage(topics.output.motorRight, {
    source: "pid",
    value: clampedRightOutput,
  });
}

// Adjust servos based on height difference calculation
function adjustServos(xAngle) {
  const heightDifference = xAngle * 0.1;
  const leftPulseWidth = Math.max(
    500,
    Math.min(2500, Math.round(500 + heightDifference * 2000))
  );
  const rightPulseWidth = Math.max(
    500,
    Math.min(2500, Math.round(500 + -heightDifference * 2000))
  );

  sendMQTTMessage(topics.output.servoLeft, {
    source: "pid",
    value: leftPulseWidth,
  });
  sendMQTTMessage(topics.output.servoRight, {
    source: "pid",
    value: rightPulseWidth,
  });
}

// Run control loop at regular intervals (e.g., 200ms)
setInterval(async () => {
  const tiltAngles = await getTiltAngles();
  const pidLeft = pidControl(
    tiltAngles.xAngle,
    previousErrorLeft,
    integralLeft,
    true
  );
  const pidRight = pidControl(
    tiltAngles.yAngle,
    previousErrorRight,
    integralRight,
    false
  );

  previousErrorLeft = pidLeft.previousError;
  integralLeft = pidLeft.integral;
  previousErrorRight = pidRight.previousError;
  integralRight = pidRight.integral;

  sendMQTTMessage(topics.output.tiltAngles, { tiltAngles, source: "pid" });
  
  if (sensorAdjustmentsEnabled) {
    updateMotors(pidLeft.output, pidRight.output);
    adjustServos(tiltAngles.xAngle);
  }
}, 200);

// Initialize MPU6050
wakeUpMPU6050();
