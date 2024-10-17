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
function updateMotors(pidOutput) {
  if (pidOutput > 0) {
    motor1.writeSync(1); // Move motor forward
    motor2.writeSync(0); // Stop the other motor
  } else if (pidOutput < 0) {
    motor1.writeSync(0); // Stop motor
    motor2.writeSync(1); // Move other motor forward
  } else {
    motor1.writeSync(0); // Stop both motors
    motor2.writeSync(0);
  }
}

// Main control loop
function controlLoop() {
  const currentAngle = getTiltAngle(); // Read current tilt angle from MPU6050
  const pidOutput = pidControl(currentAngle); // Get PID output
  updateMotors(pidOutput); // Update motor speeds
  console.log(`Angle: ${currentAngle}, PID Output: ${pidOutput}`);
}

// Run control loop at regular intervals (e.g., 100ms)
setInterval(controlLoop, 100);

// Gracefully clean up GPIO on exit
process.on('SIGINT', () => {
  motor1.unexport();
  motor2.unexport();
  console.log('Motors stopped, exiting...');
  process.exit();
});
