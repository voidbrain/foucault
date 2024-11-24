// config service server.js
const express = require('express');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// Enable CORS for the Angular frontend
app.use(cors({
  origin: [
    'http://localhost:8084', 
    'http://foucault:8082', 
    'http://foucault:3003', 
    'http://angular-frontend-service:8082', 
    'http://pid-balance-service:3003'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(bodyParser.json());

// Path to the config file
const configFilePath = 'config.json';

// Load initial config from file, if it exists
let config = {};
if (fs.existsSync(configFilePath)) {
  config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
}

// MQTT setup
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL);

// MQTT topics for setting parameters
const topics = {
  input: {
    setKp: "pid/set/Kp",
    setKi: "pid/set/Ki",
    setKd: "pid/set/Kd",
    setIncrementDegree: "pid/set/increment",
    setHeight: "pid/set/height",
    enableSensorAdjustements: "pid/sensor/enable",
  },
};

// Subscribe to relevant MQTT topics
mqttClient.on('connect', () => {
  console.log('Config Service connected to MQTT broker');
  Object.keys(topics.input).forEach(key => {
    const topic = topics.input[key];
    mqttClient.subscribe(topic, (err) => {
      if (err) {
        console.error(`Error subscribing to topic ${topic}:`, err);
      }
    });
  });
});

// Handle incoming MQTT messages and update config
mqttClient.on('message', (topic, message) => {
  let param;

  // Map MQTT topic to corresponding config parameter
  switch (topic) {
    case topics.input.setKp:
      param = 'Kp';
      break;
    case topics.input.setKi:
      param = 'Ki';
      break;
    case topics.input.setKd:
      param = 'Kd';
      break;
    case topics.input.setIncrementDegree:
      param = 'incrementDegree';
      break;
    case topics.input.setHeight:
      param = 'heightLevel';
      break;
    case topics.input.enableSensorAdjustements:
      param = 'isSensorAdjustmentEnabled';
      break;
  }
  
  const value = message.toString();

  try {
    // Parse the incoming message as JSON
    const parsedMessage = message.toString();
    // Access properties in the parsed object
    const { Kp, Ki, Kd, heightLevel, enableSensorAdjustements, incrementDegree } = parsedMessage;
  } catch (error) {
    // Handle JSON parsing errors
    console.error('Error parsing message:', error.message);
    console.log('Raw message:', message.toString());
  }

  // Update config if valid value and save to file
  if (config.hasOwnProperty(param)) {
    config[param] = value;
    saveConfig();
  }
});

// Save config to file
const saveConfig = () => {
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf-8');
};

// Endpoint to get the current config
app.get('/config', (req, res) => {
  res.json(config);
});

const PORT = 3004;
app.listen(PORT, () => {
  console.log(`Config Service running on port ${PORT}`);
});
