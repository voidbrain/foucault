const i2c = require("i2c");
const mqtt = require("mqtt");
const axios = require("axios");

// MPU6050 and I2C setup
const address = 0x68; // MPU6050 default I2C address
const wire = new i2c(address, { device: "/dev/i2c-1" });

let Kp = 0;
let Ki = 0;
let Kd = 0;

// PID variables
let previousErrorLeft = 0;
let previousErrorRight = 0;
let integralLeft = 0;
let integralRight = 0;

let setpoint = 0; // Desired balance angle (0 for upright)
let incrementDegree = 0; // Default increment for movement adjustments

// MPU6050 Registers
const PWR_MGMT_1 = 0x6b;
const ACCEL_XOUT_H = 0x3b;

// Flag for sensor adjustments
let isSensorAdjustmentEnabled = true;
let heightAdjustmentInProgress = false;

let currentHeight = "low"; // 'low', 'middle', 'high'
let targetHeight = "low"; // Initial target height
let servoAngles = { left: 0, right: 0 }; // Initial servo angles
let servoSpeed = 5; // Servo adjustment speed (in degrees per update)
let motorSpeed = 100; // Default motor speed

const heightMap = {
  low: 0, // Low position (0 degrees, for example)
  middle: 10, // Middle position (10 degrees for example)
  high: 20, // High position (20 degrees for example)
};
// Define pulse width ranges for height levels
const heightLevels = {
  low: { basePulseWidth: 500 },
  mid: { basePulseWidth: 700 },
  high: { basePulseWidth: 900 },
};

let controlLoopInterval = null;

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
    stop: "pid/stop",
    start: "pid/start",
    setKp: "pid/set/Kp",
    setKi: "pid/set/Ki",
    setKd: "pid/set/Kd",
    setIncrementDegree: "pid/set/increment",

    walk: "pid/move",
    setHeight: "pid/set/height",
    enableSensorAdjustements: "pid/sensor/enable",
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
mqttClient.on("message", (topic, value) => {
  switch (topic) {
    case topics.input.walk:
      handleWalk(value);
      break;
    case topics.input.enableSensorAdjustements:
      handleSetSensorAdj(value);
      break;
    case topics.input.stop:
      handleStop();
      break;
    case topics.input.start:
      handleStart();
      break;
    case topics.input.setHeight:
      handleSetHeight(value);
      break;
    case topics.input.setKp:
      handleSetPIDParameter("Kp", value);
      break;
    case topics.input.setKi:
      handleSetPIDParameter("Ki", value);
      break;
    case topics.input.setKd:
      handleSetPIDParameter("Kd", value);
      break;
    case topics.input.setIncrementDegree:
      handleSetIncrementDegree(value);
      break;
  }
});

async function fetchConfig() {
  try {
    console.log("Fetching configuration...");
    const response = await axios.get("http://config-service:3004/config", {
      withCredentials: true, 
    }); 
    const config = response.data;

    // Use the config for initialization
    initializePID(config);
  } catch (error) {
    console.error("Error fetching configuration:", error.message);
    process.exit(1); // Exit if configuration cannot be fetched
  }
}

function initializePID(config) {

  if (config.Kp) {
    Kp = config.Kp;
  }
  if (config.Ki) {
    Ki = config.Ki;
  }
  if (config.Kd) {
    Kd = config.Kd;
  }
  if (config.incrementDegree) {
    incrementDegree = config.incrementDegree;
  }
  if (config.heightLevel) {
    currentHeight = config.heightLevel;
  }
  if (config.isSensorAdjustmentEnabled) {
    isSensorAdjustmentEnabled = config.isSensorAdjustmentEnabled;
  }
}

// Fetch config and start the application
fetchConfig().then(() => {
  console.log("PID Controller started");
});

function handleSetIncrementDegree(value) {
  console.log(value);
  if (!isNaN(value)) {
    incrementDegree = value;
    console.log(`Increment set to ${incrementDegree}`);
  } else {
    console.warn(`Invalid value for increment: ${value}`);
  }
}

function handleSetPIDParameter(param, value) {
  if (!isNaN(value)) {
    switch (param) {
      case "Kp":
        Kp = value.toString();
        console.log(`Kp set to ${Kp}`);
        break;
      case "Ki":
        Ki = value.toString();
        console.log(`Ki set to ${Ki}`);
        break;
      case "Kd":
        Kd = value.toString();
        console.log(`Kd set to ${Kd}`);
        break;
    }
  } else {
    console.warn(`Invalid value for ${param}: ${value}`);
  }
}

function handleSetSensorAdj(value) {
  const stringValue = value.toString();
  isSensorAdjustmentEnabled = toBoolean(stringValue);
  if (isSensorAdjustmentEnabled === true) {
    handleStart();
  }
}

// New gradualHeightAdjustment function
function gradualHeightAdjustment(targetHeight, duration = 2000) {
  const targetAngle = heightMap[targetHeight]; // Target angle for the new height
  const currentLeftAngle = servoAngles.left; // Current left servo angle
  const currentRightAngle = servoAngles.right; // Current right servo angle

  const leftAngleChange = targetAngle - currentLeftAngle; // Difference in left servo angle
  const rightAngleChange = targetAngle - currentRightAngle; // Difference in right servo angle

  const steps = Math.abs(targetAngle - (servoAngles.left || 0)) / servoSpeed; // Calculate number of steps for smooth transition

  let stepCount = 0; // Track the current step

  // Gradually adjust the servos over the specified duration
  const interval = setInterval(() => {
    // Calculate the increment for each step
    const leftAngleIncrement = (leftAngleChange / steps);
    const rightAngleIncrement = (rightAngleChange / steps);

    // Update servo angles
    servoAngles.left += leftAngleIncrement;
    servoAngles.right += rightAngleIncrement;

    // Apply the new servo angles to the hardware
    setServoAngles();

    stepCount++;

    // If we've reached the final step, clear the interval
    if (stepCount >= steps) {
      clearInterval(interval);
      heightAdjustmentInProgress = false; // Reset the flag
      sendMQTTMessage(topics.output.console, { source: "pid", message: `Height adjustment to ${targetHeight} complete` });
    }
  }, duration / steps);
}

// Update handleSetHeight to use gradualHeightAdjustment
function handleSetHeight(height) {
  if (heightMap[height] && !heightAdjustmentInProgress) {
    // Mark height adjustment as in progress
    heightAdjustmentInProgress = true;

    // Set the new target height
    targetHeight = height;

    // Start gradual height adjustment
    gradualHeightAdjustment(targetHeight);

    // Set motor speed based on the new height level (optional)
    motorSpeed = 100 * (heightMap[height] / 20); // Example: slower on higher positions
    setMotorSpeed(motorSpeed); // Set motor speed to maintain balance

    sendMQTTMessage(topics.output.console, { source: "pid", message: `Adjusting height to ${height}` });
  } else {
    console.log("Height adjustment already in progress or invalid height", heightMap[height], heightAdjustmentInProgress);
  }
}

// Helper function to adjust servo angles
function setServoAngles() {
  sendMQTTMessage(topics.output.servoLeft, servoAngles.left);
  sendMQTTMessage(topics.output.servoRight, servoAngles.right);
}

function handleStart() {
  console.log(`start`);
  // Avoid multiple intervals being set
  if (controlLoopInterval) {
    console.warn("Control loop is already running.");
    return;
  }
  controlLoopInterval = setInterval(async () => {
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
    
    if (isSensorAdjustmentEnabled === true) {
      updateMotors(pidLeft.output, pidRight.output);
      adjustServos(tiltAngles.xAngle);
    } else {
      handleStop();
    }
  }, 200);
}

function handleStop() {
  console.log(`stop`);
  // pidControl(setpoint, previousErrorLeft, integralLeft, true);
  // pidControl(setpoint, previousErrorRight, integralRight, false);

  if (controlLoopInterval) {
    clearInterval(controlLoopInterval); // Stop the interval
    controlLoopInterval = null; // Reset the interval reference
  }

  sendMQTTMessage(topics.output.servoRight, 1500); // Stop servos
  sendMQTTMessage(topics.output.servoLeft, 1500);
}

// Function to handle walking directions
function handleWalk(direction) {
  const walkDirection = direction.toString();
  console.log(`walk`, walkDirection);
  switch (walkDirection) {
    case "forward":
      pidControl(setpoint + incrementDegree, previousErrorLeft, integralLeft, true);
      pidControl(
        setpoint + incrementDegree,
        previousErrorRight,
        integralRight,
        false
      );
      break;
    case "backward":
      pidControl(setpoint - incrementDegree, previousErrorLeft, integralLeft, true);
      pidControl(
        setpoint - incrementDegree,
        previousErrorRight,
        integralRight,
        false
      );
      break;
    case "left":
      pidControl(setpoint + incrementDegree, previousErrorLeft, integralLeft, true);
      pidControl(
        setpoint - incrementDegree,
        previousErrorRight,
        integralRight,
        false
      );
      break;
    case "right":
      pidControl(setpoint - incrementDegree, previousErrorLeft, integralLeft, true);
      pidControl(
        setpoint + incrementDegree,
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
    // console.log("Sending MQTT object:", object);
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

function toBoolean(value) {
  return value === "true";
}

function adjustServos(xAngle) {
  // Base pulse width for the current height level
  const basePulseWidth = heightLevels[currentHeight]?.basePulseWidth;

  // Calculate height difference from the tilt angle
  const heightDifference = xAngle * 0.1;
  
  // Adjust left and right pulse widths
  const leftPulseWidth = Math.max(
    500,
    Math.min(2500, Math.round(basePulseWidth + heightDifference * 2000))
  );
  const rightPulseWidth = Math.max(
    500,
    Math.min(2500, Math.round(basePulseWidth + -heightDifference * 2000))
  );

  // Publish servo pulse width values via MQTT
  sendMQTTMessage(topics.output.servoLeft, leftPulseWidth);
  sendMQTTMessage(topics.output.servoRight, rightPulseWidth);
  }

// Run control loop at regular intervals (e.g., 200ms)
handleStart();

// Initialize MPU6050
wakeUpMPU6050();
