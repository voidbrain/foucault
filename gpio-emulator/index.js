const fs = require('fs');  // Detect Raspberry Pi
const i2cBus = require("i2c-bus");   // I2C bus library
let Gpio;                           // Declare Gpio without initializing
let i2cDevice;                      // Declare i2cDevice without initializing

let motorLeft
let motorRight

const isPi = isRaspberryPi();

const gpioPath = isPi ? '/sys/class/gpio' : './mocks/sys/class/gpio';
const cpuInfoPath = isPi ? '/proc/cpuinfo' : './mocks/proc/cpuinfo';
const firmwareModelPath = isPi
  ? '/sys/firmware/devicetree/base/model'
  : './mocks/sys/firmware/devicetree/base/model';

function isRaspberryPi() {
  try {
    // Read /proc/cpuinfo
    const cpuInfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
    if (cpuInfo.includes('Raspberry Pi')) {
      return true;
    }

    // Read /sys/firmware/devicetree/base/model
    const modelPath = '/sys/firmware/devicetree/base/model';
    if (fs.existsSync(modelPath)) {
      const model = fs.readFileSync(modelPath, 'utf8').toLowerCase();
      if (model.includes('raspberry pi')) {
        return true;
      }
    }
  } catch (error) {
    console.error('Error checking Raspberry Pi:', error);
  }

  return false;
}

if (isPi) {
  console.log("Running on Raspberry Pi. Using real GPIO and I2C.");
} else {
  console.warn("Running in a non-Raspberry Pi environment. Using mock devices.");

  Gpio = require('./mocks/gpio.cjs');  // Mock GPIO class
  i2cDevice = require('./mocks/i2c-bus.cjs').openSync("/dev/i2c-mock");  // Mock I2C device

  // Initialize GPIO pins for motors and servos
  motorLeft = new Gpio(31, { mode: Gpio.OUTPUT });
  motorRight = new Gpio(33, { mode: Gpio.OUTPUT });
}



// Handle signals to gracefully shut down the process
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  process.exit(0);
});

// Keep the Node.js process alive (e.g., by setting a timer or using `setInterval`)

  setInterval(() => {
    if (isPi === false) {
      getTiltAngles();
    }
  }, 1000);

  let mockAngleStep = 0;

  function mockAccelerometerData() {
    // Generate periodic xAngle (pitch) from -10 to +10
    const pitch = 10 * Math.sin(mockAngleStep); // Scale sine wave to [-10, 10]
    mockAngleStep += Math.PI / 30; // Increment step for smooth oscillation (adjust the divisor for speed)
  
    // Convert pitch back to accelerometer raw data
    const scaleFactor = 16384;
    const accelX = Math.round(scaleFactor * Math.sin((pitch * Math.PI) / 180)); // Simulate X based on pitch
    const accelY = 0; // Assume constant for simplicity
    const accelZ = Math.round(scaleFactor * Math.cos((pitch * Math.PI) / 180)); // Z varies inversely with pitch
  
    // Return mock data as Buffer
    const buffer = Buffer.alloc(6);
    buffer.writeInt16LE(accelX, 0); // Write X
    buffer.writeInt16LE(accelY, 2); // Write Y
    buffer.writeInt16LE(accelZ, 4); // Write Z
    return buffer;
  }
// Function to read accelerometer data (mock or real)
function readAccelerometer() {
  return new Promise((resolve, reject) => {
    if (isPi) {
      // Real I2C accelerometer data (assuming ACCEL_XOUT_H is the starting register)
      i2cDevice.i2cReadSync(0x68, 6, Buffer.from([0, 0, 0, 0, 0, 0])); // Example for real I2C read
      resolve(i2cDevice);
    } else {
      // Mock data if not on a Raspberry Pi
      const mockData = mockAccelerometerData();  // Use mock accelerometer data
      resolve(mockData);  // Return mock data as Buffer
    }
  });
}

// Example usage of reading accelerometer data
async function getTiltAngles() {
  try {
    const accelData = await readAccelerometer(); 

    // Assuming accelData is a buffer, we extract accelerometer values from it
    const accelX = (accelData[0] << 8) | accelData[1];
    const accelY = (accelData[2] << 8) | accelData[3];
    const accelZ = (accelData[4] << 8) | accelData[5];

    // Convert raw accelerometer data to tilt angles (in degrees)
    const xAngle = Math.atan2(accelY, accelZ) * (180 / Math.PI);
    const yAngle = Math.atan2(accelX, accelZ) * (180 / Math.PI);

    // console.log(`X Angle: ${xAngle}, Y Angle: ${yAngle}`);
    return { xAngle, yAngle };
  } catch (error) {
    console.error(`Error getting tilt angles: ${error}`);
    return { xAngle: 0, yAngle: 0 };  // Return default if error occurs
  }
}

