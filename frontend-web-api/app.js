const express = require('express');
const app = express();
const mqtt = require('mqtt');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Setup an HTTP server to bind Socket.io
const server = http.createServer(app);
const io = socketIo(server);

// Setup MQTT connection
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://mqtt-broker:1883');

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
});

const topics = [
  'controller/console','pid/console', 
  'pid/motors/left', 'pid/servos/left', 'pid/motors/right', 'pid/servos/right',
  'controller/servos/left/ack', 'controller/motors/left/ack', 'controller/servos/right/ack', 'controller/motors/right/ack',
];
topics.forEach(topic => {
  mqttClient.subscribe(topic, function (err) {
    if (err) { console.log("err", err); }
  });
});

// When MQTT messages are received, emit them to the connected frontend
mqttClient.on('message', (topic, message) => {
  console.log(`Received message: ${message.toString()} on topic: ${topic}`);

  // Optionally, parse the message if it's in JSON format
  let parsedMessage = {};
  try {
    parsedMessage = JSON.parse(message.toString());
  } catch (error) {
    console.error('Failed to parse message:', error);
    parsedMessage = { message: message.toString(), value: null };  // Handle invalid JSON
  }

  // Emit the message to the frontend via WebSocket
  io.emit('mqtt-message', { topic, ...parsedMessage });
});

// Define a simple route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Define a route for starting object detection (replace with your logic)
app.get('/detect', (req, res) => {
  // Add your object detection code here...
  res.send('Object detection started');
});

// Serve static files (if needed)
app.use(express.static(path.join(__dirname, 'public')));

// Start the HTTP server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
