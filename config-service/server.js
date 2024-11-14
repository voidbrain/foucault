const express = require('express');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// Enable CORS for the Angular frontend
app.use(cors({
  origin: 'http://angular-frontend:8082', // Replace with your Angular frontend URL if different
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(bodyParser.json());

// Path to the config file
const configFilePath = '/shared-config/config.json';

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
  }

  const value = parseFloat(message.toString());

  // Update config if valid value and save to file
  if (config.hasOwnProperty(param) && !isNaN(value)) {
    config[param] = value;
    saveConfig();
    console.log(`Updated ${param} to ${value}`);
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

app.post('/config/kp', (req, res) => {
  const value = req.body;
  if (value !== undefined) {
    mqttClient.publish(topics.input.setKp, value.toString());
  }
  saveConfig();
  res.json({ message: 'Config updated successfully', config });
});
app.post('/config/ki', (req, res) => {
  const value = req.body;
  if (value !== undefined) {
    mqttClient.publish(topics.input.setKi, value.toString());
  }
  saveConfig();
  res.json({ message: 'Config updated successfully', config });
});
app.post('/config/kd', (req, res) => {
  const value = req.body;
  if (value !== undefined) {
    mqttClient.publish(topics.input.setKd, value.toString());
  }
  saveConfig();
  res.json({ message: 'Config updated successfully', config });
});
app.post('/config/incrementdegree', (req, res) => {
  const value = req.body;
  if (value !== undefined) {
    mqttClient.publish(topics.input.setIncrementDegree, value.toString());
  }
  saveConfig();
  res.json({ message: 'Config updated successfully', config });
});
app.post('/config/heightLevel', (req, res) => {
  const value = req.body;
  if (value !== undefined) {
    mqttClient.publish(topics.input.setHeightLevel, value.toString());
  }
  saveConfig();
  res.json({ message: 'Config updated successfully', config });
});
app.post('/config/issensoradjustmentenabled', (req, res) => {
  const value = req.body;
  if (value !== undefined) {
    mqttClient.publish(topics.input.setIsSensorAdjustmentEnabled, value.toString());
  }
  saveConfig();
  res.json({ message: 'Config updated successfully', config });
});

const PORT = 3004;
app.listen(PORT, () => {
  console.log(`Config Service running on port ${PORT}`);
});
