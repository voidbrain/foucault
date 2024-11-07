const mqtt = require('mqtt');
const { Gpio } = require('pigpio');
const { exec } = require('child_process');

// Setup MQTT connection
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://mqtt-broker:1883');

// GPIO Pins for motors and servos
const motorLeft = new Gpio(17, { mode: Gpio.OUTPUT });
const motorRight = new Gpio(18, { mode: Gpio.OUTPUT });
const servoLeft = new Gpio(19, { mode: Gpio.OUTPUT });
const servoRight = new Gpio(20, { mode: Gpio.OUTPUT });

// MQTT Topics
const MOTOR_TOPIC_LEFT = 'pid/motors/left';
const MOTOR_TOPIC_RIGHT = 'pid/motors/right';
const SERVO_TOPIC_LEFT = 'pid/servos/left';
const SERVO_TOPIC_RIGHT = 'pid/servos/right';

// Error handling for GPIO pins
motorLeft.on('error', (err) => console.error(`Error with motorLeft: ${err}`));
motorRight.on('error', (err) => console.error(`Error with motorRight: ${err}`));
servoLeft.on('error', (err) => console.error(`Error with servoLeft: ${err}`));
servoRight.on('error', (err) => console.error(`Error with servoRight: ${err}`));

// Start the pigpio daemon (no sudo required in Docker with privileged mode)
exec('pigpiod', (err, stdout, stderr) => {
  if (err) {
    console.error(`Error starting pigpio daemon: ${stderr}`);
  } else {
    console.log('pigpiod started');
  }
});

// Setup MQTT connection
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  mqttClient.subscribe(MOTOR_TOPIC_LEFT, (err) => {
    if (err) console.log('Error subscribing to motor left topic', err);
  });
  mqttClient.subscribe(MOTOR_TOPIC_RIGHT, (err) => {
    if (err) console.log('Error subscribing to motor right topic', err);
  });
  mqttClient.subscribe(SERVO_TOPIC_LEFT, (err) => {
    if (err) console.log('Error subscribing to servo 1 topic', err);
  });
  mqttClient.subscribe(SERVO_TOPIC_RIGHT, (err) => {
    if (err) console.log('Error subscribing to servo 2 topic', err);
  });
});

// Handle incoming MQTT messages
mqttClient.on('message', (topic, {message, value}) => {
  console.log(`Received on ${topic}: ${message}`);

  // Function to handle incoming MQTT messages for motors and servos
function handleMqttMessage(topic, value) {
  switch (topic) {
    case 'pid/servos/left':
      // Check if the left height value is valid (range between 500 and 2500 for pulse width)
      if (value >= 500 && value <= 2500) {
        // Send the adjusted servo pulse width to the servo
        // You can now call sendMQTTMessage or adjust directly as needed
        sendMQTTMessage('controller/servos/left/ack', `Servo Left set to pulse width: ${value}`);
        console.log(`Left Servo Pulse Width: ${value}µs`);
      } else {
        // If invalid value, send an error message back
        sendMQTTMessage('controller/servos/left/ack', `Invalid value for left servo: ${value}`);
        console.error(`Invalid pulse width for left servo: ${value}`);
      }
      break;

    case 'pid/servos/right':
      // Check if the right height value is valid (range between 500 and 2500 for pulse width)
      if (value >= 500 && value <= 2500) {
        // Send the adjusted servo pulse width to the servo
        sendMQTTMessage('controller/servos/right/ack', `Servo Right set to pulse width: ${value}`);
        console.log(`Right Servo Pulse Width: ${value}µs`);
      } else {
        // If invalid value, send an error message back
        sendMQTTMessage('controller/servos/right/ack', `Invalid value for right servo: ${value}`);
        console.error(`Invalid pulse width for right servo: ${value}`);
      }
      break;

    // Handle other topics as needed
    case 'pid/motors/left':
      // Handle motor left PWM logic
      if (value >= 0 && value <= 255) {
        sendMQTTMessage('controller/motors/left/ack', `Motor Left set to PWM value: ${value}`);
        console.log(`Left Motor PWM: ${value}`);
      } else {
        sendMQTTMessage('controller/motors/left/ack', `Invalid value for motor left: ${value}`);
        console.error(`Invalid PWM value for left motor: ${value}`);
      }
      break;

    case 'pid/motors/right':
      // Handle motor right PWM logic
      if (value >= 0 && value <= 255) {
        sendMQTTMessage('controller/motors/right/ack', `Motor Right set to PWM value: ${value}`);
        console.log(`Right Motor PWM: ${value}`);
      } else {
        sendMQTTMessage('controller/motors/right/ack', `Invalid value for motor right: ${value}`);
        console.error(`Invalid PWM value for right motor: ${value}`);
      }
      break;

    default:
      // Handle unknown topics
      console.log(`Unknown topic: ${topic}`);
      sendMQTTMessage('controller/console', `Unknown command for ${topic}`);
  }
}

});

// Cleanup and stop pigpio daemon on exit
process.on('SIGINT', () => {
  motorLeft.digitalWrite(0);
  motorRight.digitalWrite(0);
  servoLeft.digitalWrite(0);
  servoRight.digitalWrite(0);

  exec('killall pigpiod', () => {
    console.log('pigpiod stopped');
    process.exit();
  });
});
