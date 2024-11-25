const isPi = require("detect-rpi");
const i2cBus = require("i2c-bus");

let Gpio;  // Declare Gpio without initializing
let i2cDevice;

if (isPi()) {
  console.log("Running on Raspberry Pi. Using real GPIO and I2C.");
  Gpio = require("pigpio").Gpio;  // Real Raspberry Pi GPIO
  i2cDevice = i2cBus.openSync("/dev/i2c-1");  // Real I2C device on Raspberry Pi
} else {
  console.warn("Running in a non-Raspberry Pi environment. Using mock devices.");
  Gpio = require('./mocks/gpio.cjs');  // Import the Gpio class directly
  i2cDevice = require('./mocks/i2c-bus.cjs').openSync("/dev/i2c-mock");  // Mock I2C device
}

// Initialize GPIO pins for motors and servos
const motorLeft = new Gpio(31, { mode: Gpio.OUTPUT });
const motorRight = new Gpio(33, { mode: Gpio.OUTPUT });

// Keep the service running
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  process.exit(0);
});

// Keep the Node.js process alive (e.g., by setting a timer or using `setInterval`)
setInterval(() => {}, 1000);
