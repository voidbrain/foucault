const mqtt = require('mqtt');
const { Gpio } = require('pigpio');
const { exec } = require('child_process');

// MQTT Topics object for cleaner management
const topics = {
  motorLeft: 'controller/motorPWM/left',
  motorRight: 'controller/motorPWM/right',
  servoLeft: 'controller/servoPulseWidth/left',
  servoRight: 'controller/servoPulseWidth/right',
  console: 'controller/console',
};

// Setup MQTT connection
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://mqtt-broker:1883');

// GPIO Pins for motors and servos
const motorLeft = new Gpio(17, { mode: Gpio.OUTPUT });
const motorRight = new Gpio(18, { mode: Gpio.OUTPUT });
const servoLeft = new Gpio(19, { mode: Gpio.OUTPUT });
const servoRight = new Gpio(20, { mode: Gpio.OUTPUT });

// Start pigpio daemon for GPIO access
exec('pigpiod', (err, stdout, stderr) => {
  if (err) {
    console.error(`Error starting pigpio daemon: ${stderr}`);
  } else {
    console.log('pigpio daemon started successfully');
  }
});

// Subscribe to relevant topics on MQTT client connection
mqttClient.on('connect', () => {
  Object.values(topics).forEach((topic) => {
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
  const { message: msgText, value } = JSON.parse(message.toString());
  handleMqttMessage(topic, value);
});

// Function to handle commands for motors and servos
function handleMqttMessage(topic, value) {
  const isValidServo = value >= 500 && value <= 2500;  // Valid range for servos (in microseconds)
  const isValidMotor = value >= 0 && value <= 255;    // Valid range for motor PWM

  switch (topic) {
    case topics.servoLeft:
      if (isValidServo) {
        servoLeft.servoWrite(value);
        sendMQTTMessage(topics.console, `Left Servo set to: ${value}`);
      } else {
        sendMQTTMessage(topics.console, `Invalid value for Left Servo: ${value}`);
      }
      break;

    case topics.servoRight:
      if (isValidServo) {
        servoRight.servoWrite(value);
        sendMQTTMessage(topics.console, `Right Servo set to: ${value}`);
      } else {
        sendMQTTMessage(topics.console, `Invalid value for Right Servo: ${value}`);
      }
      break;

    case topics.motorLeft:
      if (isValidMotor) {
        motorLeft.pwmWrite(value);
        sendMQTTMessage(topics.console, `Left Motor PWM set to: ${value}`);
      } else {
        sendMQTTMessage(topics.console, `Invalid value for Left Motor PWM: ${value}`);
      }
      break;

    case topics.motorRight:
      if (isValidMotor) {
        motorRight.pwmWrite(value);
        sendMQTTMessage(topics.console, `Right Motor PWM set to: ${value}`);
      } else {
        sendMQTTMessage(topics.console, `Invalid value for Right Motor PWM: ${value}`);
      }
      break;

    default:
      console.log(`Unhandled topic: ${topic}`);
  }
}