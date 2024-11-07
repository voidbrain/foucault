var i2c = require('i2c');
var address = 0x68; // MPU6050 default I2C address
var wire = new i2c(address, {device: '/dev/i2c-1'});

// PID constants
const Kp = 1.2; // Proportional gain
const Ki = 0.0; // Integral gain
const Kd = 0.4; // Derivative gain

// PID variables
let previousError = 0;
let integral = 0;
let setpoint = 0; // Desired balance angle (usually 0 for upright)

// MPU6050 Registers
const PWR_MGMT_1 = 0x6B;
const WHO_AM_I = 0x75;
const ACCEL_XOUT_H = 0x3B; // Start of accelerometer data

// Wake up the MPU6050 by writing 0 to the PWR_MGMT_1 register
wire.writeBytes(PWR_MGMT_1, [0x00], function (err) {
  if (err) {
    console.log("Error waking up MPU6050:", err);
    return;
  }
  console.log("MPU6050 awake");
});

// Function to read accelerometer data with a Promise
function readAccelerometer() {
  return new Promise((resolve, reject) => {
    let retries = 3; // Try 3 times before giving up
    function attemptRead() {
      wire.readBytes(ACCEL_XOUT_H, 6, function(err, buffer) {
        if (err) {
          if (retries > 0) {
            console.log(`Error reading accelerometer, retrying... (${retries} attempts left)`);
            retries--;
            attemptRead(); // Retry reading
          } else {
            console.log("Error reading accelerometer data:", err);
            resolve(null); // Return null after retries are exhausted
          }
          return;
        }
        
        // Process accelerometer data
        let accelX = (buffer[0] << 8) | buffer[1];
        let accelY = (buffer[2] << 8) | buffer[3];
        let accelZ = (buffer[4] << 8) | buffer[5];

        accelX = accelX > 32767 ? accelX - 65536 : accelX;
        accelY = accelY > 32767 ? accelY - 65536 : accelY;
        accelZ = accelZ > 32767 ? accelZ - 65536 : accelZ;

        resolve({ accelX, accelY, accelZ });
      });
    }
    
    attemptRead(); // Start the first attempt
  });
}

async function getTotalTiltAngle() {

  const accelData = await readAccelerometer();
  if (!accelData) {
    console.log("Error getting tilt angles: No accelerometer data");
    return { xAngle: 0, yAngle: 0 }; // Return default angles on error
  }
  const { accelX, accelY, accelZ } = accelData;

  // Calculate tilt angles in both the X and Y axes
  const xAngle = Math.atan2(accelY, accelZ) * (180 / Math.PI); // X tilt angle
  const yAngle = Math.atan2(accelX, accelZ) * (180 / Math.PI); // Y tilt angle

  // Calculate the total tilt angle using the X and Y tilt angles
  const totalTiltAngle = Math.atan2(accelX, Math.sqrt(accelY * accelY + accelZ * accelZ)) * (180 / Math.PI);

  console.log(`X Angle: ${xAngle}°`);
  console.log(`Y Angle: ${yAngle}°`);
  console.log(`Total Tilt Angle: ${totalTiltAngle}°`);

  return totalTiltAngle;
}


async function getTiltAngles() {
  const accelData = await readAccelerometer();
  if (!accelData) {
    console.log("Error getting tilt angles: No accelerometer data");
    return { xAngle: 0, yAngle: 0 }; // Return default angles on error
  }
  const { accelX, accelY, accelZ } = accelData;
  const xAngle = Math.atan2(accelY, accelZ) * (180 / Math.PI);
  const yAngle = Math.atan2(accelX, accelZ) * (180 / Math.PI);
  return { xAngle, yAngle, accelData };
}

// Calculate height difference based on tilt angles
function calculateHeightDifference(tiltAngles) {
  // Ensure tiltAngles is an object with xAngle and yAngle
  if (typeof tiltAngles === "number") {
    console.error("Invalid tiltAngles format, expected an object with xAngle and yAngle.");
    return NaN;  // Handle invalid input
  }

  const { xAngle, yAngle } = tiltAngles;
  const tiltToHeightFactor = 0.1; // Adjust this factor as necessary
  console.log("--"+ xAngle+" " + yAngle+"--")
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

// Main control loop
async function controlLoop() {
  const tiltAngles = await getTotalTiltAngle(); // Get both X and Y tilt angles
  const pidOutput = pidControl(tiltAngles); // Get PID output
  updateMotors(pidOutput); // Update motor speeds

  // Calculate height difference based on tilt angles
  const heightDifference = calculateHeightDifference(tiltAngles);

  // Adjust for uneven terrain
  adjustServos(heightDifference); // Pass the height difference directly

  console.log(`Angle: ${tiltAngles}, 
    \nTiltdata: X:${tiltAngles?.accelData?.accelX}, Y:${tiltAngles?.accelData?.accelY}, Z:${tiltAngles?.accelData?.accelZ}
    \nPID Output: ${pidOutput}, Height Difference: ${heightDifference}`);
}

// Run control loop at regular intervals (e.g., 100ms)
setInterval(controlLoop, 200);

function updateMotors(pidOutput) {
  console.log("Motor PID Output:", pidOutput);
  // Here, add code to control the motors using pidOutput
}

function adjustServos(heightDifference) {
  console.log("Servo Adjustment for Height Difference:", heightDifference);
  // Here, add code to adjust servos based on heightDifference
}
