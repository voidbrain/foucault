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
const motor1 = new Gpio(17, 'out'); // GPIO pin for left motor
const motor2 = new Gpio(27, 'out'); // GPIO pin for right motor

// Servo control pins (for arms)
const servo1 = new Gpio(22, 'out'); // GPIO pin for left servo
const servo2 = new Gpio(23, 'out'); // GPIO pin for right servo

// MPU6050 sensor setup
const i2cBus = i2c.openSync(1);
const mpu6050 = new MPU6050(i2cBus, 0x68); // Initialize MPU6050

// Read the angle from MPU6050 (simplified for demo purposes)
function getTiltAngle() {
  const accelData = mpu6050.readSync(); // Read data from MPU6050
  const angle = Math.atan2(accelData.accel.y, accelData.accel.z) * (180 / Math.PI); // Calculate tilt angle
  return angle;
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
function updateMotors(pidOutput, direction) {
  let speed = Math.abs(pidOutput);
  
  if (direction === 'forward') {
    motor1.writeSync(speed > 0 ? 1 : 0); // Move left motor forward
    motor2.writeSync(speed > 0 ? 1 : 0); // Move right motor forward
  } else if (direction === 'backward') {
    motor1.writeSync(speed < 0 ? 1 : 0); // Move left motor backward
    motor2.writeSync(speed < 0 ? 1 : 0); // Move right motor backward
  } else {
    motor1.writeSync(0); // Stop left motor
    motor2.writeSync(0); // Stop right motor
  }
}

// Handle servo movements based on balance
function adjustServos() {
  // Example servo control based on balance
  const servoAngle = setpoint === 0 ? 90 : (setpoint > 0 ? 120 : 60);
  servo1.writeSync(servoAngle); // Adjust left servo
  servo2.writeSync(servoAngle); // Adjust right servo
}

// Function to read user input (for controlling movement)
function getUserInput() {
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.on('data', (chunk) => {
    const command = chunk.toString();
    if (command === 'w') {
      setpoint = 0; // Upright
      updateMotors(1, 'forward'); // Move forward
    } else if (command === 's') {
      setpoint = 0; // Upright
      updateMotors(-1, 'backward'); // Move backward
    } else if (command === 'a') {
      setpoint = 10; // Tilt for left turn
      updateMotors(1, 'forward'); // Move forward while turning
    } else if (command === 'd') {
      setpoint = -10; // Tilt for right turn
      updateMotors(1, 'forward'); // Move forward while turning
    } else if (command === 'x') {
      updateMotors(0); // Stop motors
    }
  });
}

// Main control loop
function controlLoop() {
  const currentAngle = getTiltAngle(); // Read current tilt angle from MPU6050
  const pidOutput = pidControl(currentAngle); // Get PID output
  updateMotors(pidOutput); // Update motor speeds
  adjustServos(); // Adjust servos based on balance
  console.log(`Angle: ${currentAngle}, PID Output: ${pidOutput}`);
}

// Start user input listener
getUserInput();

// Run control loop at regular intervals (e.g., 100ms)
setInterval(controlLoop, 100);

// Gracefully clean up GPIO on exit
process.on('SIGINT', () => {
  motor1.unexport();
  motor2.unexport();
  servo1.unexport();
  servo2.unexport();
  console.log('Motors and servos stopped, exiting...');
  process.exit();
});
