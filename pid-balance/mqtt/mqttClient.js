const mqtt = require("mqtt");
const { getConfig } = require("../config/config.js");

let client;

async function initializeMQTT(){
  const config = await getConfig();
  client = mqtt.connect(config.mqttUrl);
}


function sendMQTTMessage(topic, message) {
  client.publish(topic, JSON.stringify(message));
}

module.exports = { initializeMQTT, sendMQTTMessage };
