const mqtt = require("mqtt");
const isPi = require("detect-rpi");  // For detecting Raspberry Pi
const i2cBus = require("i2c-bus");  // For real I2C device on Raspberry Pi

// Mock Modules
const MockGPIO = require('./mocks/gpio.cjs');  // Import the MockGPIO class
const MockI2C = require('./mocks/i2c-bus.cjs');  // Import the mock I2C device class

// GPIO and I2C setup
let Gpio;  // Declare Gpio without initializing
let i2cDevice;  // Declare i2cDevice variable

if (isPi()) {
  // Only initialize Gpio for Raspberry Pi
  console.log("Running on Raspberry Pi. Using real GPIO and I2C.");
  const pigpio = require("pigpio"); // Load pigpio
  pigpio.initialize();  // Ensure GPIO is initialized on Raspberry Pi
  Gpio = pigpio.Gpio;  // Now use pigpio.Gpio as the constructor
  i2cDevice = i2cBus.openSync("/dev/i2c-1");  // Real I2C device on Raspberry Pi
} else {
  // Fallback to mock devices when not on a Raspberry Pi
  console.warn("Running in a non-Raspberry Pi environment. Using mock devices.");
  Gpio = MockGPIO;  // Mock GPIO for testing
  i2cDevice = MockI2C.openSync("/dev/i2c-mock");  // Mock I2C device
}

// Initialize GPIO pins for motors and servos
const motorLeft = new Gpio(31, { mode: Gpio.OUTPUT });
const motorRight = new Gpio(33, { mode: Gpio.OUTPUT });
const servoLeft = new Gpio(18, { mode: Gpio.OUTPUT });
const servoRight = new Gpio(15, { mode: Gpio.OUTPUT });

// Setup MQTT connection
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || "mqtt://mqtt-broker:1883");

// Example function to interact with I2C device
function setupI2CDevice() {
  const buffer = Buffer.alloc(2);
  i2cDevice.readI2cBlockSync(0x68, 0x3B, 2, buffer); // Simulate reading from I2C device
  console.log(`Read I2C data: ${buffer.toString('hex')}`);

  const writeBuffer = Buffer.from([0x6B, 0x00]);
  i2cDevice.writeI2cBlockSync(0x68, 0x6B, writeBuffer.length, writeBuffer);  // Simulate writing to I2C
  console.log('Written to I2C device');
}

// Subscribe to relevant topics on MQTT client connection
mqttClient.on("connect", () => {
  mqttClient.subscribe("controller/motorPWM/left", (err) => {
    if (err) console.error("Subscription failed:", err);
  });
  mqttClient.subscribe("controller/motorPWM/right", (err) => {
    if (err) console.error("Subscription failed:", err);
  });
});

// Handle incoming MQTT messages
mqttClient.on("message", (topic, message) => {
  const value = message.toString();
  if (topic === "controller/motorPWM/left") {
    motorLeft.pwmWrite(value);  // This will either call the mock or real pwmWrite method
  }
  if (topic === "controller/motorPWM/right") {
    motorRight.pwmWrite(value);
  }
});

// Initialize I2C device for testing
setupI2CDevice();

// Example of using mock functionality if not on Raspberry Pi
motorLeft.pwmWrite(128);  // Example of writing a PWM value to a motor
servoLeft.servoWrite(90);  // Example of controlling a servo
