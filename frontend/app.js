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

// MQTT topics
const topics = {
  console: 'controller/console',
  accelData: 'controller/accelData',
  tiltAngles: 'controller/tiltAngles',
  motorLeft: 'controller/motorPWM/left',
  motorRight: 'controller/motorPWM/right',
  servoLeft: 'controller/servoPulseWidth/left',
  servoRight: 'controller/servoPulseWidth/right'
};

// Subscribe to all MQTT topics
Object.keys(topics).forEach(topic => {
  mqttClient.subscribe(topics[topic], function (err) {
    if (err) { 
      console.log("Error subscribing to topic", err); 
    }
  });
});

// When MQTT messages are received, emit them to the connected frontend
mqttClient.on('message', (topic, message) => {
  // Optionally, parse the message if it's in JSON format
  let parsedMessage = {};
  try {
    parsedMessage = JSON.parse(message.toString());
  } catch (error) {
    console.error('Failed to parse message:', error);
    parsedMessage = { message: message.toString(), value: null };  // Handle invalid JSON
  }

  // Emit the message to the frontend via WebSocket with { topic, parsedMessage }
  io.emit('mqtt-message', { topic, data: parsedMessage });
});

// Define a simple route to serve the frontend HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));  // Serving index.html from the root directory
});

// Define a route for starting object detection (replace with your logic)
app.get('/detect', (req, res) => {
  // Add your object detection code here...
  res.send('Object detection started');
});

// Serve static files (if needed, not necessary since index.html is in root)
app.use(express.static(path.join(__dirname, 'public')));

// Start the HTTP server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
