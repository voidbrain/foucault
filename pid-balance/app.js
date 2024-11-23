const i2c = require("i2c");
const mqtt = require("mqtt");
const axios = require('axios');

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
let sensorAdjustmentsEnabled = true;

// Define pulse width ranges for height levels
const heightLevels = {
  low: { basePulseWidth: 500 },
  mid: { basePulseWidth: 1500 },
  high: { basePulseWidth: 2500 },
};

// Current height setting, default to 'mid'
let heightLevel = "mid";

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
        handleSetSensorAdj(value)
        break;
      case topics.input.stop:
        handleStop();
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
    console.log('Fetching configuration...');
    const response = await axios.get('http://config-service:3004/config', {
      withCredentials: true  // Include credentials (cookies, authorization headers, etc.)
    }); // Replace with actual service URL
    const config = response.data;

    console.log('Configuration fetched successfully:', config);

    // Use the config for initialization
    initializePID(config);

  } catch (error) {
    console.error('Error fetching configuration:', error.message);
    process.exit(1); // Exit if configuration cannot be fetched
  }
}

function initializePID(config) {
  console.log('Initializing PID controller with config:', config);

  if(config.Kp){ Kp = config.Kp }
  if(config.Kp){ Ki = config.Ki }
  if(config.Kp){ Kd = config.Kd }
  if(config.Kp){ Ki = config.Ki }
  if(config.Kp){ Ki = config.Ki }
  if(config.Kp){ Ki = config.Ki }
  if(config.incrementDegree){ incrementDegree = config.incrementDegree }
  if(config.heightLevel){ heightLevel = config.heightLevel }
  if(config.isSensorAdjustmentEnabled){ isSensorAdjustmentEnabled = config.isSensorAdjustmentEnabled }
}

// Fetch config and start the application
fetchConfig().then(() => {
  console.log('PID Controller started');
});


function handleSetIncrementDegree(value) {
  console.log(value)
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


function handleSetSensorAdj(value){
  console.log("set sensor adj2: ", value.toString())
  sensorAdjustmentsEnabled = value.toString();

}

// Modify the handleSetHeight function to update the current height setting
function handleSetHeight(height) {
    console.log(`Height set to ${height}`);
    heightLevel = height;
}

function handleStop() {
  console.log(`stop`);
  pidControl(setpoint, previousErrorLeft, integralLeft, true);
  pidControl(setpoint, previousErrorRight, integralRight, false);
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

function adjustServos(xAngle) {
  // Base pulse width for the current height level
  const basePulseWidth = heightLevels[heightLevel]?.basePulseWidth;

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
