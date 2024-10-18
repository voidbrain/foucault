const express = require('express');
const app = express();
const mqtt = require('mqtt');

// Setup MQTT connection
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://mqtt-broker:1883');

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
});

mqttClient.on('message', (topic, message) => {
  console.log(`Received message: ${message.toString()} on topic: ${topic}`);
});

// Define a simple route
app.get('/', (req, res) => {
  res.send('Frontend Service is running!');
});

// Define a route for starting object detection (replace with your logic)
app.get('/detect', (req, res) => {
  // Add your object detection code here...
  res.send('Object detection started');
});

// Listen on port 8080
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
