const mqtt = require("mqtt");
const { getConfig } = require("../config/config.js");

let client;

async function initializeMQTT() {
  const config = await getConfig();
  client = mqtt.connect(config.mqttUrl);

  client.on("connect", () => {
    console.log("Connected to MQTT broker.");
  });

  return client;
}

function sendMQTTMessage(topic, message) {
  if (client) {
    client.publish(topic, JSON.stringify(message));
  } else {
    console.error("MQTT client not initialized.");
  }
}

module.exports = { initializeMQTT, sendMQTTMessage };
