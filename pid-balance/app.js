// app.js

const { readAccelerometer } = require("./hardware/i2c.js");
const { sendMQTTMessage, initializeMQTT } = require("./mqtt/mqttClient.js");
const PIDController = require("./pid/pidController.js");
const {getConfig} = require("./config/config.js");


let pidLeft;
let pidRight;
let enableSensorAdjustments = true;
let controlLoopInterval = null;
let topics;

let currentHeight = '';
let heightLevels 

initializeMQTT();

async function getTiltAngles() {
  try {
    const accelData = await readAccelerometer();
    const scaleFactor = 16384;

    const accelXg = accelData.accelX / scaleFactor;
    const accelYg = accelData.accelY / scaleFactor;
    const accelZg = accelData.accelZ / scaleFactor;

    const xAngle = Math.atan2(accelYg, accelZg) * (180 / Math.PI);
    const yAngle = Math.atan2(accelXg, accelZg) * (180 / Math.PI);

    sendMQTTMessage(topics.output.accelData, { accelData });
    const tiltAngles = { xAngle, yAngle };
    const source = "pid";
    sendMQTTMessage(topics.output.tiltAngles, { tiltAngles, source});

    // console.log(topics.output.accelData, { accelData });
    // console.log(topics.output.tiltAngles, { xAngle, yAngle });

    return { xAngle, yAngle };
  } catch (error) {
    sendMQTTMessage(topics.output.console, { message: `Error: ${error}` });
    return { xAngle: 0, yAngle: 0 };
  }
}

function setMotorSpeeds(leftSpeed, rightSpeed) {
  sendMQTTMessage(topics.output.motorLeft, leftSpeed);
  sendMQTTMessage(topics.output.motorRight, rightSpeed);
}

function adjustServos(xAngle) {
  // Base pulse width for the current height level
  const basePulseWidth = heightLevels[currentHeight]?.basePulseWidth;

  // Calculate height difference from the tilt angle
  const heightDifference = +xAngle * 0.1;
  
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

async function startControlLoop() {
  const config = await getConfig();
  currentHeight = config.heightLevel;
  heightLevels = config.pulseHeightLevels;

  pidLeft = new PIDController(config.pidConfig.Kp, config.pidConfig.Ki, config.pidConfig.Kd);
  pidRight = new PIDController(config.pidConfig.Kp, config.pidConfig.Ki, config.pidConfig.Kd);

  if (controlLoopInterval) {
    console.warn("Control loop already running.");
    return;
  }

  controlLoopInterval = setInterval(async () => {
    const tiltAngles = await getTiltAngles();

    if(enableSensorAdjustments === true){
      const leftOutput = pidLeft.compute(0, tiltAngles.xAngle);
      const rightOutput = pidRight.compute(0, tiltAngles.yAngle);

      setMotorSpeeds(leftOutput, rightOutput);
      adjustServos(tiltAngles.xAngle);
    }
  }, 100);
}

function stopControlLoop() {
  if (controlLoopInterval) {
    clearInterval(controlLoopInterval);
    controlLoopInterval = null;
    console.log("Control loop stopped.");
  }
}

async function setupMQTTHandlers() {
  client = await initializeMQTT();
  const config = await getConfig();
  topics = config.topics;

  client.on("message", (topic, message) => {
    const parsedMessage = message.toString();
    switch (topic) {
      case topics.input.walk:
        handleWalk(parsedMessage);
        break;
      case topics.input.enableSensorAdjustments:
        handleSetSensorAdj(parsedMessage);
        break;
      case topics.input.stop:
        handleStop();
        break;
      case topics.input.start:
        handleStart();
        break;
      case topics.input.setHeight:
        handleSetHeight(parsedMessage);
        break;
      case topics.input.setKp:
        handleSetPIDParameter("Kp", parsedMessage);
        break;
      case topics.input.setKi:
        handleSetPIDParameter("Ki", parsedMessage);
        break;
      case topics.input.setKd:
        handleSetPIDParameter("Kd", parsedMessage);
        break;
      case topics.input.setIncrementDegree:
        handleSetIncrementDegree(parsedMessage);
        break;
      default:
        console.warn(`Unknown topic: ${topic}`);
    }
  });

  // Subscribe to all input topics
  Object.values(topics.input).forEach((topic) => {
    client.subscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to topic: ${topic}`, err);
      } else {
        console.log(`Subscribed to topic: ${topic}`);
      }
    });
  });
}

// Define handlers for each topic
function handleWalk(value) {
  console.log("Handling walk:", value);
  // Add logic for walking here
}

function handleSetSensorAdj(value) {
  enableSensorAdjustments = (value === "true" ? true : false);
  
  // Add logic for sensor adjustments here
}

function handleStop() {
  stopControlLoop();
  console.log("Robot stopped.");
}

function handleStart() {
  startControlLoop();
  console.log("Robot started.");
}

function handleSetHeight(value) {
  console.log("Setting height:", value);
  // Add logic to adjust height here
}

function handleSetPIDParameter(param, value) {
  console.log(`Setting PID parameter ${param}:`, value);
  if (pidLeft && pidRight) {
    pidLeft[param] = value;
    pidRight[param] = value;
  }
}

function handleSetIncrementDegree(value) {
  console.log("Setting increment degree:", value);
  // Add logic for increment degree adjustment here
}

async function setup() {
  await setupMQTTHandlers();
  startControlLoop();
}

setup();
