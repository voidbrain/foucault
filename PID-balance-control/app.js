const { Gpio } = require('onoff'); // Use onoff to control GPIO pins
const i2c = require('i2c-bus');     // For I2C communication with MPU6050
const MPU6050 = require('mpu6050'); // MPU6050 library

// PID constants
const Kp = 1.2; // Proportional gain
const Ki = 0.0; // Integral gain
const Kd = 0.4; // Derivative gain

// PID variables
let previousError = 0;
let integral = 0;
let setpoint = 0; // Desired balance angle (usually 0 for upright)

// Motor control pins (Assuming GPIO for motor driver)
const motor1 = new Gpio(17, 'out'); // GPIO pin 17
const motor2 = new Gpio(27, 'out'); // GPIO pin 27

// Servo control pins (Assuming GPIO for servos)
const servo1 = new Gpio(22, 'out'); // GPIO pin for left servo
const servo2 = new Gpio(23, 'out'); // GPIO pin for right servo

// MPU6050 sensor setup
const i2cBus = i2c.openSync(1);
const mpu6050 = new MPU6050(i2cBus, 0x68); // Initialize MPU6050

// Read the angles from MPU6050 (returns both X and Y tilt angles)
function getTiltAngles() {
  const accelData = mpu6050.readSync(); // Read data from MPU6050
  const xAngle = Math.atan2(accelData.accel.y, accelData.accel.z) * (180 / Math.PI); // X tilt angle
  const yAngle = Math.atan2(accelData.accel.x, accelData.accel.z) * (180 / Math.PI); // Y tilt angle
  return { xAngle, yAngle };
}

// Calculate height difference based on tilt angles
function calculateHeightDifference(tiltAngles) {
  const { xAngle, yAngle } = tiltAngles;
  const tiltToHeightFactor = 0.1; // Adjust this factor as necessary
  const heightDifference = (xAngle * tiltToHeightFactor) - (yAngle * tiltToHeightFactor);
  return heightDifference;
}

// PID Controller function
function pidControl(currentAngle) {
  const error = setpoint - currentAngle; // Calculate error
  integral += error; // Accumulate integral
  const derivative = error - previousError; // Calculate derivative
  const output = Kp * error + Ki * integral + Kd * derivative; // PID formula
  previousError = error; // Store error for next cycle
  return output; // Output to motors
}

// Update motor speeds based on PID output
function updateMotors(pidOutput) {
  if (pidOutput > 0) {
    motor1.writeSync(1); // Move motor1 forward
    motor2.writeSync(0); // Stop motor2
  } else if (pidOutput < 0) {
    motor1.writeSync(0); // Stop motor1
    motor2.writeSync(1); // Move motor2 forward
  } else {
    motor1.writeSync(0); // Stop both motors
    motor2.writeSync(0);
  }
}

// Adjust servo positions based on height difference
function adjustServos(heightDifference) {
  const baseAngle = 90; // Neutral angle for servos
  const adjustmentFactor = 5; // Amount to adjust servos per height unit

  const leftServoAngle = baseAngle + (heightDifference * adjustmentFactor);
  const rightServoAngle = baseAngle - (heightDifference * adjustmentFactor);

  // Clamp servo angles to valid range (0-180)
  servo1.writeSync(Math.min(Math.max(leftServoAngle, 0), 180));
  servo2.writeSync(Math.min(Math.max(rightServoAngle, 0), 180));
}

// Get user input for controlling movement
function getUserInput() {
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.on('data', (chunk) => {
    const command = chunk.toString();
    if (command === 'w') {
      setpoint = 0; // Upright
      updateMotors(1); // Move forward
    } else if (command === 's') {
      setpoint = 0; // Upright
      updateMotors(-1); // Move backward
    } else if (command === 'a') {
      setpoint = 10; // Tilt for left turn
      updateMotors(1); // Move forward while turning
    } else if (command === 'd') {
      setpoint = -10; // Tilt for right turn
      updateMotors(1); // Move forward while turning
    } else if (command === 'x') {
      updateMotors(0); // Stop motors
    }
  });
}

// Main control loop
function controlLoop() {
  const tiltAngles = getTiltAngles(); // Get both X and Y tilt angles
  const currentAngle = (tiltAngles.xAngle + tiltAngles.yAngle) / 2; // Average angle (or use one as needed)
  const pidOutput = pidControl(currentAngle); // Get PID output
  updateMotors(pidOutput); // Update motor speeds

  // Calculate height difference based on tilt angles
  const heightDifference = calculateHeightDifference(tiltAngles);

  // Adjust for uneven terrain
  adjustServos(heightDifference); // Pass the height difference directly

  console.log(`Angle: ${currentAngle}, PID Output: ${pidOutput}, Height Difference: ${heightDifference}`);
}

// Run control loop at regular intervals (e.g., 100ms)
setInterval(controlLoop, 100);

// Start listening for user input
getUserInput();

// Gracefully clean up GPIO on exit
process.on('SIGINT', () => {
  motor1.unexport();
  motor2.unexport();
  servo1.unexport();
  servo2.unexport();
  console.log('Motors and servos stopped, exiting...');
  process.exit();
});
