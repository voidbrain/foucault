//frontend 

const express = require('express');
const app = express();
const mqtt = require('mqtt');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      'http://localhost:8084', 
      'http://foucault:8082', 
      'http://foucault:3003', 
      'http://angular-frontend-service:8082', 
      'http://pid-balance-service:3003'
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ['Content-Type'],
    credentials: true
  }
});
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://mqtt-broker:1883');

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
});

const topics = {
  input: {
    console: 'console/log',
    accelData: 'controller/accelData',
    tiltAngles: 'controller/tiltAngles',
    motorLeft: 'controller/motorPWM/left',
    motorRight: 'controller/motorPWM/right',
    servoLeft: 'controller/servoPulseWidth/left',
    servoRight: 'controller/servoPulseWidth/right',
    setKp: "pid/set/Kp",
    setKi: "pid/set/Ki",
    setKd: "pid/set/Kd",
    setIncrementDegree: "pid/set/increment",

    walk: "pid/move",
    setHeight: "pid/set/height",
    enableSensorAdjustements: "pid/sensor/enable",
  },
};

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
    const { topic, value, ...source } = data;

    mqttClient.publish(topic, value, (err) => {
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
  try {
    parsedMessage = message.toString();
  } catch (error) {
    console.error('Failed to parse MQTT message:', error);
    parsedMessage = { message: message.toString(), value: null };
  }
  io.emit('mqtt-message', { topic, data: parsedMessage });
});

// Define a route for triggering object detection (replace with your logic)
app.get('/detect', (req, res) => {
  // Add object detection code here
  res.send('Object detection started');
});

app.use((req, res, next) => {
  console.log('Request Origin:', req.get('Origin'));
  next();
});

// Start the HTTP server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
