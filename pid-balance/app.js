// app.js

const { readAccelerometer } = require("./hardware/i2c.js");
const { sendMQTTMessage, initializeMQTT } = require("./mqtt/mqttClient.js");
const PIDController = require("./pid/pidController.js");
const {getConfig} = require("./config/config.js");

const source = "pid";
let pid;
let enableSensorAdjustments = true;
let controlLoopInterval = null;
let topics;

let currentHeight = '';
let heightLevels 
let heightAdjustmentInProgress = false;

let setpoint = 0; // Desired balance angle (0 for upright)
let incrementDegree = 0;

async function getTiltAngles() {
  try {
    const accelData = await readAccelerometer();
    const scaleFactor = 16384;

    const accelXg = accelData.accelX / scaleFactor;
    const accelYg = accelData.accelY / scaleFactor;
    const accelZg = accelData.accelZ / scaleFactor;

    const xAngle = Math.atan2(accelYg, accelZg) * (180 / Math.PI);
    const yAngle = Math.atan2(accelXg, accelZg) * (180 / Math.PI);
    const tiltAngles = { xAngle, yAngle };
    

    sendMQTTMessage(topics.output.accelData, { value: accelData, source });
    sendMQTTMessage(topics.output.tiltAngles, { value: tiltAngles, source});
    return { xAngle, yAngle };
  } catch (error) {
    sendMQTTMessage(topics.output.console, { message: `Error: ${error}` });
    return { xAngle: 0, yAngle: 0 };
  }
}

function setMotorSpeeds(leftSpeed, rightSpeed) {
  if (heightAdjustmentInProgress) return;
  const clampedLeftOutput = Math.max(
    0,
    Math.min(255, Math.round(127 + leftSpeed))
  );
  const clampedRightOutput = Math.max(
    0,
    Math.min(255, Math.round(127 + rightSpeed))
  );

  sendMQTTMessage(topics.output.motorLeft, {
    source,
    value: clampedLeftOutput,
  });
  sendMQTTMessage(topics.output.motorRight, {
    source,
    value: clampedRightOutput,
  });
}

function adjustServos(xAngle) {
  if (heightAdjustmentInProgress) return;
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
    source,
    value: leftPulseWidth,
  });
  sendMQTTMessage(topics.output.servoRight, {
    source,
    value: rightPulseWidth,
  });
}

async function startControlLoop() {
  const config = await getConfig();
  currentHeight = config.heightLevel;
  heightLevels = config.pulseHeightLevels;
  incrementDegree = config.incrementDegree;

  pid = new PIDController(config.pidConfig.Kp, config.pidConfig.Ki, config.pidConfig.Kd);

  if (controlLoopInterval) {
    console.warn("Control loop already running.");
    return;
  }

  controlLoopInterval = setInterval(async () => {
    const tiltAngles = await getTiltAngles();

    if(enableSensorAdjustments === true){
      const pitchCorrection = pid.compute(0, tiltAngles.xAngle); // Common adjustment for pitch
      const rollCorrection = pid.compute(0, tiltAngles.yAngle); // Differential adjustment for roll

      // Adjust motor speeds for horizontal stabilization
      const leftMotorSpeed = pitchCorrection - rollCorrection;
      const rightMotorSpeed = pitchCorrection + rollCorrection;

      setMotorSpeeds(leftMotorSpeed, rightMotorSpeed);
      adjustServos(tiltAngles.xAngle);
    }
  }, 100);
}

function stopControlLoop() {
  sendMQTTMessage(topics.output.servoRight, { value: 1500, source }); // Stop servos
  sendMQTTMessage(topics.output.servoLeft, { value: 1500, source });
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

// Function to handle walking directions
function handleWalk(direction) {
  const walkDirection = direction.toString();
  console.log(walk, walkDirection);
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

function handleSetSensorAdj(value) {
  enableSensorAdjustments = (value === "true" ? true : false);
  console.log(enableSensorAdjustments)
  if(enableSensorAdjustments === false){
    sendMQTTMessage(topics.output.servoRight, { value: 1500, source }); // Stop servos
    sendMQTTMessage(topics.output.servoLeft, { value: 1500, source });
  }
}

function handleStop() {
  stopControlLoop();
  console.log("Robot stopped.");
}

function handleStart() {
  startControlLoop();
  console.log("Robot started.");
}

function handleSetHeight(height) {
  heightAdjustmentInProgress = true;
  if (controlLoopInterval) {
    clearInterval(controlLoopInterval); // Pause the control loop
    controlLoopInterval = null;
  }

  const newIndex = Object.keys(heightLevels).findIndex(key => key === height);
  const prevIndex = Object.keys(heightLevels).findIndex(key => key === currentHeight);
  const heightLevelDifference = newIndex - prevIndex;
  console.log(`Height set to ${height}, previous height ${currentHeight}, difference: ${heightLevelDifference}`);
  
  adjustServos(heightLevels[height].bodyAngle);
  currentHeight = height;

  setTimeout(() => {
    heightAdjustmentInProgress = false;
    handleStart();
  }, 1000);
}

function handleSetPIDParameter(param, value) {
  console.log(`Setting PID parameter ${param}:`, value);
  if (pidLeft && pidRight) {
    pidLeft[param] = value;
    pidRight[param] = value;
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

function handleSetIncrementDegree(value) {
  console.log(value);
  if (!isNaN(value)) {
    incrementDegree = value;
    console.log(`Increment set to ${value}`)
  } else {
    console.warn(`Invalid value for increment: ${value}`);
  }
}

async function setup() {
  await setupMQTTHandlers();
  startControlLoop();
}




// Function to update motors based on separate outputs for left and right motors

function gradualHeightAdjustment() {
  const targetAngle = heightMap[targetHeight];
  let currentAngle = servoAngles.left; // assuming both servos are adjusted similarly
  const angleDifference = targetAngle - currentAngle;

  const steps = 10; // Number of steps to take during adjustment
  const stepSize = angleDifference / steps;
  let stepCount = 0;

  const adjustmentInterval = setInterval(() => {
    currentAngle += stepSize;
    servoAngles.left = currentAngle;
    servoAngles.right = currentAngle; // assuming symmetric adjustment

    // Send updated servo angles
    setServoAngles();

    stepCount++;

    if (stepCount >= steps) {
      clearInterval(adjustmentInterval);
      heightAdjustmentInProgress = false; // Mark adjustment complete
    }
  }, 100); // Adjust every 100ms
}

///

initializeMQTT();
setup();
