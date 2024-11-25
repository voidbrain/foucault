const isPi = require("detect-rpi");  // Detect Raspberry Pi
const i2cBus = require("i2c-bus");   // I2C bus library
let Gpio;                           // Declare Gpio without initializing
let i2cDevice;                      // Declare i2cDevice without initializing

if (isPi()) {
  console.log("Running on Raspberry Pi. Using real GPIO and I2C.");
  Gpio = require("pigpio").Gpio;    // Real Raspberry Pi GPIO
  i2cDevice = i2cBus.openSync(1);    // Real I2C device (assuming bus 1)
} else {
  console.warn("Running in a non-Raspberry Pi environment. Using mock devices.");
  Gpio = require('./mocks/gpio.cjs');  // Mock GPIO class
  i2cDevice = require('./mocks/i2c-bus.cjs').openSync("/dev/i2c-mock");  // Mock I2C device
}

// Initialize GPIO pins for motors and servos
const motorLeft = new Gpio(31, { mode: Gpio.OUTPUT });
const motorRight = new Gpio(33, { mode: Gpio.OUTPUT });

// Handle signals to gracefully shut down the process
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  process.exit(0);
});

// Keep the Node.js process alive (e.g., by setting a timer or using `setInterval`)
setInterval(() => {}, 1000);

// Function to simulate reading accelerometer data (mock data)
function mockAccelerometerData() {
  return Buffer.from([0x10, 0x00, 0x20, 0x00, 0x30, 0x00]);
}

// Function to read accelerometer data (mock or real)
function readAccelerometer() {
  return new Promise((resolve, reject) => {
    if (isPi()) {
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

    console.log(`X Angle: ${xAngle}, Y Angle: ${yAngle}`);
    return { xAngle, yAngle };
  } catch (error) {
    console.error(`Error getting tilt angles: ${error}`);
    return { xAngle: 0, yAngle: 0 };  // Return default if error occurs
  }
}

// Example: Get tilt angles
getTiltAngles();
