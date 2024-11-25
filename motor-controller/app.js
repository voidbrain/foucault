const mqtt = require("mqtt");
const fs = require('fs');  // For detecting Raspberry Pi
const i2cBus = require("i2c-bus");  // For real I2C device on Raspberry Pi
const { exec } = require('child_process');

// Mock Modules
const MockGPIO = require('./mocks/gpio.cjs');  // Import the MockGPIO class
const MockI2C = require('./mocks/i2c-bus.cjs');  // Import the mock I2C device class

// GPIO and I2C setup
let Gpio;  // Declare Gpio without initializing
let i2cDevice;  // Declare i2cDevice variable

// MQTT Topics object for cleaner management
const topics = {
  input: {
    motorLeft: 'controller/motorPWM/left',
    motorRight: 'controller/motorPWM/right',
    servoLeft: 'controller/servoPulseWidth/left',
    servoRight: 'controller/servoPulseWidth/right',
  },
  output: {
    console: 'console/log',
  }
};

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

if (isRaspberryPi()) {
  // Only initialize Gpio for Raspberry Pi
  console.log("Running on Raspberry Pi. Using real GPIO and I2C.");
  const pigpio = require("pigpio"); // Load pigpio
  pigpio.initialize();  // Ensure GPIO is initialized on Raspberry Pi
  Gpio = pigpio.Gpio;  // Now use pigpio.Gpio as the constructor
  i2cDevice = i2cBus.openSync(1);  // Real I2C device on Raspberry Pi
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


// Start pigpio daemon for GPIO access
exec('pigpiod', (err, stdout, stderr) => {
  if (err) {
    console.error(`Error starting pigpio daemon: ${stderr}`);
  } else {
    console.log('pigpio daemon started successfully');
  }
});

// Setup MQTT connection
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || "mqtt://mqtt-broker:1883");

mqttClient.on('connect', () => {
  Object.values(topics.input).forEach((topic) => {
    mqttClient.subscribe(topic, (err) => {
      if (err) {
        console.error(`Error subscribing to ${topic}: ${err.message}`);
      } else {
        console.log(`Subscribed to ${topic}`);
      }
    });
  });
});

// Send MQTT messages function
function sendMQTTMessage(topic, message) {
  mqttClient.publish(topic, JSON.stringify({ message }), (err) => {
    if (err) {
      console.error(`Error sending message to ${topic}: ${err.message}`);
    }
  });
}

// Handle incoming MQTT messages
mqttClient.on('message', (topic, message) => {
  const value = message.toString();
  handleMqttMessage(topic, value);
});

function handleMqttMessage(topic, value) {
  const isValidServo = +value >= 500 && +value <= 2500;  // Valid range for servos (in microseconds) 1500 = stop
  const isValidMotor = +value >= 0 && +value <= 255;    // Valid range for motor PWM

  switch (topic) {
    case topics.input.servoLeft:
      if (isValidServo) {
        servoLeft.servoWrite(value);
        sendMQTTMessage(topics.output.console, { source:'motor-controller', message: `Left Servo set to: ${value}`});
      } else {
        sendMQTTMessage(topics.output.console, { source:'motor-controller', message: `Invalid value for Left Servo: ${value}`});
      }
      break;

    case topics.input.servoRight:
      if (isValidServo) {
        servoRight.servoWrite(value);
        sendMQTTMessage(topics.output.console, { source:'motor-controller', message: `Right Servo set to: ${value}`});
      } else {
        sendMQTTMessage(topics.output.console, { source:'motor-controller', message: `Invalid value for Right Servo: ${value}`});
      }
      break;

    case topics.input.motorLeft:
      if (isValidMotor) {
        motorLeft.pwmWrite(value);
        sendMQTTMessage(topics.output.console, { source:'motor-controller', message: `Left Motor PWM set to: ${value}`});
      } else {
        sendMQTTMessage(topics.output.console, { source:'motor-controller', message: `Invalid value for Left Motor PWM: ${value}`});
      }
      break;

    case topics.input.motorRight:
      if (isValidMotor) {
        motorRight.pwmWrite(value);
        sendMQTTMessage(topics.output.console, { source:'motor-controller', message: `Right Motor PWM set to: ${value}`});
      } else {
        sendMQTTMessage(topics.output.console, { source:'motor-controller', message: `Invalid value for Right Motor PWM: ${value}`});
      }
      break;

    default:
      // console.log(`Unhandled topic: ${topic}`);
  }
}
