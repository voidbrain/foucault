const mqtt = require('mqtt');
const { Gpio } = require('pigpio');
const { exec } = require('child_process');

// MQTT Topics object
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

// Start pigpio daemon
exec('pigpiod', (err, stdout, stderr) => {
  if (err) console.error(`Error starting pigpio daemon: ${stderr}`);
});

// Subscribe to relevant topics on connect
mqttClient.on('connect', () => {
  Object.values(topics).forEach(topic => {
    mqttClient.subscribe(topic, err => {
      if (err) console.error(`Error subscribing to ${topic}`, err);
    });
  });
});

// Send MQTT messages
function sendMQTTMessage(topic, message) {
  mqttClient.publish(topic, JSON.stringify({ message }), err => {
    if (err) console.error(`Error sending message to ${topic}:`, err);
  });
}

// Handle incoming MQTT messages
mqttClient.on('message', (topic, message) => {
  const { message: msgText, value } = JSON.parse(message.toString());
  handleMqttMessage(topic, value);
});

// Message handling for motors and servos
function handleMqttMessage(topic, value) {
  const isValidServo = value >= 500 && value <= 2500;
  const isValidMotor = value >= 0 && value <= 255;

  switch (topic) {
    case topics.servoLeft:
      if (isValidServo) {
        servoLeft.servoWrite(value);
        sendMQTTMessage(topics.console, `Left Servo: ${value}`);
      }
      break;
    case topics.servoRight:
      if (isValidServo) {
        servoRight.servoWrite(value);
        sendMQTTMessage(topics.console, `Right Servo: ${value}`);
      }
      break;
    case topics.motorLeft:
      if (isValidMotor) {
        motorLeft.pwmWrite(value);
        sendMQTTMessage(topics.console, `Left Motor PWM: ${value}`);
      }
      break;
    case topics.motorRight:
      if (isValidMotor) {
        motorRight.pwmWrite(value);
        sendMQTTMessage(topics.console, `Right Motor PWM: ${value}`);
      }
      break;
    default:
      console.log(`Unhandled topic: ${topic}`);
  }
}
