const i2cBus = require("i2c-bus");
const mqtt = require("mqtt");
const axios = require("axios");
const fs = require("fs");

// Mock Modules
const MockI2C = require("./mocks/i2c-bus.cjs"); // Import the mock I2C device class
const address = 0x68; // MPU6050 default I2C address

let device = isRaspberryPi() ? 1 : "mock"; // Use `let` if device might change
let i2c; // Declare i2c as `let` for later assignment
let i2cDevice; // Declare `i2cDevice` for initialization inside the async block

function isRaspberryPi() {
  try {
    // Check /proc/cpuinfo
    const cpuInfo = fs.readFileSync("/proc/cpuinfo", "utf8");
    if (cpuInfo.includes("Raspberry Pi")) {
      return true;
    }

    // Check /sys/firmware/devicetree/base/model
    const modelPath = "/sys/firmware/devicetree/base/model";
    if (fs.existsSync(modelPath)) {
      const model = fs.readFileSync(modelPath, "utf8").toLowerCase();
      if (model.includes("raspberry pi")) {
        return true;
      }
    }
  } catch (error) {
    console.error("Error checking Raspberry Pi:", error);
  }

  return false;
}

(async () => {
  try {
    if (isRaspberryPi()) {
      console.log("Running on Raspberry Pi. Initializing real I2C device...");
      device = 1; // Set to the actual I2C bus number
      i2cDevice = i2cBus.openSync(device); // Open /dev/i2c-1
    } else {
      console.warn("Running in a non-Raspberry Pi environment. Using mock I2C device.");
      i2cDevice = MockI2C.openSync("/dev/i2c-mock"); // Initialize the mock I2C
    }

    i2c = i2cDevice; // Assign to `i2c` for consistent usage

    console.log(`I2C connection established. Device: ${device}, Address: ${address}`);
  } catch (error) {
    console.error("Error initializing I2C connection:", error);
    process.exit(1); // Exit if there is an error initializing I2C
  }
})();

// PID and other configurations...
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
  mid: { basePulseWidth: 1500 },
  high: { basePulseWidth: 2500 },
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
    enableSensorAdjustments: "pid/sensor/enable",
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
    case topics.input.enableSensorAdjustments:
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
    default:
      console.warn(`Unknown topic: ${topic}`);
  }
});

async function fetchConfig() {
  try {
    console.log("Fetching configuration...");
    // const response = await axios.get("http://config-service:3004/config", {
    const response = await axios.get("http://localhost:3004/config", {
      withCredentials: true,
    });
    const config = response.data;

    initializePID(config);
  } catch (error) {
    console.error("Error fetching configuration:", error.message);
    process.exit(1); // Exit if configuration cannot be fetched
  }
}

function initializePID(config) {
  if (config.pidConfig.Kp) Kp = config.pidConfig.Kp;
  if (config.pidConfig.Ki) Ki = config.pidConfig.Ki;
  if (config.pidConfig.Kd) Kd = config.pidConfig.Kd;
  if (config.incrementDegree) incrementDegree = config.incrementDegree;
  if (config.heightLevel) currentHeight = config.heightLevel;
  if (config.isSensorAdjustmentEnabled)
    isSensorAdjustmentEnabled = config.isSensorAdjustmentEnabled;

  console.log(`PID initialized with Kp: ${Kp}, Ki: ${Ki}, Kd: ${Kd}`);
}

// Fetch config and start the application
fetchConfig().then(() => {
  console.log("PID Controller started");
});

function handleSetIncrementDegree(value) {
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
        Kp = value;
        break;
      case "Ki":
        Ki = value;
        break;
      case "Kd":
        Kd = value;
        break;
    }
    console.log(`${param} set to ${value}`);
  } else {
    console.warn(`Invalid value for ${param}: ${value}`);
  }
}

function handleSetSensorAdj(value) {
  isSensorAdjustmentEnabled = toBoolean(value.toString());
  if (isSensorAdjustmentEnabled) handleStart();
}

// Gradual height adjustment logic
function gradualHeightAdjustment(targetHeight, duration = 2000) {
  const targetAngle = heightMap[targetHeight];
  const leftAngleChange = targetAngle - servoAngles.left;
  const rightAngleChange = targetAngle - servoAngles.right;
  const steps = Math.abs(targetAngle - servoAngles.left) / servoSpeed;

  let stepCount = 0;
  const interval = setInterval(() => {
    const leftAngleIncrement = leftAngleChange / steps;
    const rightAngleIncrement = rightAngleChange / steps;

    servoAngles.left += leftAngleIncrement;
    servoAngles.right += rightAngleIncrement;

    setServoAngles();

    stepCount++;
    if (stepCount >= steps) {
      clearInterval(interval);
      heightAdjustmentInProgress = false;
      sendMQTTMessage(topics.output.console, {
        source: "pid",
        message: `Height adjustment to ${targetHeight} complete`,
      });
    }
  }, duration / steps);
}

function handleSetHeight(value) {
  const height = value.toString();
  if (heightLevels[height] && !heightAdjustmentInProgress) {
    heightAdjustmentInProgress = true;
    targetHeight = height;

    gradualHeightAdjustment(targetHeight);
    motorSpeed = 100 * (heightMap[height] / 20);
    setMotorSpeed(motorSpeed);

    sendMQTTMessage(topics.output.console, {
      source: "pid",
      message: `Adjusting height to ${height}`,
    });
  } else {
    console.log("Height adjustment already in progress or invalid height");
  }
}

function setMotorSpeed(motorSpeed) {
  motorSpeed = Math.max(-100, Math.min(100, motorSpeed));
  console.log(`Setting motor speed to: ${motorSpeed}%`);
}

function angleToPWM(angle) {
  // Map angle (0°-180°) to PWM (1000µs-2000µs)
  return 1000 + (angle / 180) * 1000;
}

// function setServoAngles() {
//   const pwmLeft = angleToPWM(servoAngles.left);
//   const pwmRight = angleToPWM(servoAngles.right);

//   sendMQTTMessage(topics.output.servoLeft, pwmLeft);
//   sendMQTTMessage(topics.output.servoRight, pwmRight);
//   console.log(`Servo PWM set to left: ${pwmLeft}µs, right: ${pwmRight}µs`);
// }

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
  sendMQTTMessage(topics.output.servoLeft, {
    source: "pid",
    value: leftPulseWidth,
  });
  sendMQTTMessage(topics.output.servoRight, {
    source: "pid",
    value: rightPulseWidth,
  });
}

function handleStart() {
  if (controlLoopInterval) {
    console.warn("Control loop is already running.");
    return;
  }

  servoAngles.left = 0;
  servoAngles.right = 0;
  

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
      setMotorSpeeds(pidLeft.output, pidRight.output);
      adjustServos(tiltAngles.xAngle);
    } else {
      handleStop();
    }
  }, 100);
}

function handleStop() {
  if (controlLoopInterval) {
    clearInterval(controlLoopInterval);
    controlLoopInterval = null;
    console.log("Control loop stopped");
  }
}

function setMotorSpeeds(leftSpeed, rightSpeed) {
  sendMQTTMessage(topics.output.motorLeft, leftSpeed);
  sendMQTTMessage(topics.output.motorRight, rightSpeed);
}

// async function getTiltAngles() {
//   const accelerometerData = await wire.readBytes(ACCEL_XOUT_H, 6);
//   // Extract tilt angles and return them
//   return { xAngle: 0, yAngle: 0 };
// }

async function getTiltAngles() {
  try {
    const accelData = await readAccelerometer();
    
    // Scale accelerometer data to 'g' (assuming 16-bit raw data)
    const scaleFactor = 16384; // Assuming default sensitivity for MPU6050 (±2g range)

    const accelXg = accelData.accelX / scaleFactor;
    const accelYg = accelData.accelY / scaleFactor;
    const accelZg = accelData.accelZ / scaleFactor;

    // Calculate tilt angles using accelerometer data
    const xAngle = Math.atan2(accelYg, accelZg) * (180 / Math.PI);
    const yAngle = Math.atan2(accelXg, accelZg) * (180 / Math.PI);

    // Send data via MQTT
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
function readAccelerometer() {
  return new Promise((resolve, reject) => {
    try {
      // Read 6 bytes starting from the accelerometer's X-axis high register
      const buffer = Buffer.alloc(6);  // Create a buffer of size 6
      const bytesRead = i2c.readI2cBlockSync(address, ACCEL_XOUT_H, 6, buffer);

      // Check if the number of bytes read is as expected
      if (bytesRead !== 6) {
        throw new Error(`Expected 6 bytes, but got ${bytesRead}`);
      }

      // Combine high and low bytes into 16-bit signed values
      let accelX = (buffer[0] << 8) | buffer[1];
      let accelY = (buffer[2] << 8) | buffer[3];
      let accelZ = (buffer[4] << 8) | buffer[5];

      // Handle signed 16-bit data (conversion from unsigned)
      accelX = accelX > 32767 ? accelX - 65536 : accelX;
      accelY = accelY > 32767 ? accelY - 65536 : accelY;
      accelZ = accelZ > 32767 ? accelZ - 65536 : accelZ;

      // Resolve with the accelerometer data
      resolve({ accelX, accelY, accelZ });
    } catch (err) {
      console.error("Error reading accelerometer:", err); // Log error for debugging
      reject("Failed to read accelerometer data");
    }
  });
}



function pidControl(currentAngle, previousError, integral, isLeft) {
  const error = setpoint - currentAngle;
  integral += error;
  const derivative = error - previousError;
  const output = Kp * error + Ki * integral + Kd * derivative;

  return { output, previousError: error, integral };
}

function sendMQTTMessage(topic, message) {
  mqttClient.publish(topic, JSON.stringify(message), { qos: 1 });
}

function toBoolean(value) {
  return value === "true";
}

// Wake up the MPU6050 by writing 0 to the PWR_MGMT_1 register
function wakeUpMPU6050() {
  const PWR_MGMT_1 = 0x6B; // Power Management register address
  const data = 0x00; // Value to wake up the MPU6050
  
  try {
    // Write data to the power management register
    i2c.writeByteSync(address, PWR_MGMT_1, data);

    // Send success message via MQTT
    sendMQTTMessage(topics.output.console, {
      source: "pid",
      message: "MPU6050 awake",
      error: null,
    });
  } catch (err) {
    // Send error message via MQTT
    sendMQTTMessage(topics.output.console, {
      source: "pid",
      message: "Error waking up MPU6050",
      error: err.message,
    });

    console.error("Error waking up MPU6050:", err);
  }
}


// Run control loop at regular intervals (e.g., 200ms)
handleStart();

// Initialize MPU6050
wakeUpMPU6050();
