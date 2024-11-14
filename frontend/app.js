const express = require('express');
const app = express();
const mqtt = require('mqtt');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Setup an HTTP server to bind Socket.io
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://foucault:8082', // Allow frontend access from http://foucault:8082
    methods: ["GET", "POST"]
  }
});

// Setup MQTT connection
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://mqtt-broker:1883');

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
});

// MQTT topics
const topics = {
  input: {
    console: 'console/log',
    accelData: 'controller/accelData',
    tiltAngles: 'controller/tiltAngles',
    motorLeft: 'controller/motorPWM/left',
    motorRight: 'controller/motorPWM/right',
    servoLeft: 'controller/servoPulseWidth/left',
    servoRight: 'controller/servoPulseWidth/right',

    walkForward: "pid/move/forward",
    walkBackward: "pid/move/backward",
    walkLeft: "pid/move/left",
    walkRight: "pid/move/right",
    enableSensorAdjustementsTrue: "pid/sensor/enable/true",
    enableSensorAdjustementsFalse: "pid/sensor/enable/false",
    setKp: "pid/set/Kp",
    setKi: "pid/set/Ki",
    setKd: "pid/set/Kd",
  },
};

// Subscribe to all MQTT topics
Object.keys(topics.input).forEach(topic => {
  mqttClient.subscribe(topics.input[topic], (err) => {
    if (err) {
      console.error(`Error subscribing to topic ${topic}:`, err);
    }
  });
});

// Listen for 'mqtt-publish' events from the frontend
io.on('connection', (socket) => {
  socket.on('message', (data) => {
    const { topic, message } = data;

    // Publish the message to the specified MQTT topic
    mqttClient.publish(topic, message, (err) => {
      if (err) {
        console.error(`Failed to publish message to ${topic}:`, err);
      } else {
        console.log(`Message published to topic ${topic}`, data);
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// When MQTT messages are received, emit them to the connected frontend
mqttClient.on('message', (topic, message) => {
  let parsedMessage = {};
  // console.log(topic, message.toString())
  // Attempt to parse the message if it's JSON
  try {
    parsedMessage = message.toString();
  } catch (error) {
    console.error('Failed to parse MQTT message:', error);
    parsedMessage = { message: message.toString(), value: null };
  }

  // Emit the parsed message to the frontend via WebSocket
  io.emit('mqtt-message', { topic, data: parsedMessage });
});

// Define a route for triggering object detection (replace with your logic)
app.get('/detect', (req, res) => {
  // Add object detection code here
  res.send('Object detection started');
});


// Start the HTTP server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
