const { readAccelerometer } = require("./hardware/i2c.js");
const { sendMQTTMessage, initializeMQTT } = require("./mqtt/mqttClient.js");
const PIDController = require("./pid/pidController.js");
const {getConfig} = require("./config/config.js");


let pidLeft;
let pidRight;

let controlLoopInterval = null;
let topics;

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

    console.log(topics.output.accelData, { accelData });
    console.log(topics.output.tiltAngles, { xAngle, yAngle });

    return { xAngle, yAngle };
  } catch (error) {
    sendMQTTMessage(topics.output.console, { message: `Error: ${error}` });
    return { xAngle: 0, yAngle: 0 };
  }
}

function setMotorSpeeds(leftSpeed, rightSpeed) {
  sendMQTTMessage(topics.output.motorLeft, leftSpeed);
  console.log(topics.output.motorLeft, leftSpeed)
  sendMQTTMessage(topics.output.motorRight, rightSpeed);
  console.log(topics.output.motorLeft, leftSpeed)
}

async function startControlLoop() {
  const config = await getConfig();
  pidLeft = new PIDController(config.pidConfig.Kp, config.pidConfig.Ki, config.pidConfig.Kd);
  pidRight = new PIDController(config.pidConfig.Kp, config.pidConfig.Ki, config.pidConfig.Kd);

  if (controlLoopInterval) {
    console.warn("Control loop already running.");
    return;
  }

  controlLoopInterval = setInterval(async () => {
    const tiltAngles = await getTiltAngles();

    const leftOutput = pidLeft.compute(0, tiltAngles.xAngle);
    const rightOutput = pidRight.compute(0, tiltAngles.yAngle);

    setMotorSpeeds(leftOutput, rightOutput);
  }, 100);
}

function stopControlLoop() {
  if (controlLoopInterval) {
    clearInterval(controlLoopInterval);
    controlLoopInterval = null;
    console.log("Control loop stopped.");
  }
}

async function setup() {
  const config = await getConfig();
  topics = config.topics;
}

setup();
startControlLoop();
