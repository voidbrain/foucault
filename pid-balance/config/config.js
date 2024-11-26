const axios = require("axios");

// Static default configuration
const defaultConfig = {
  mqttUrl: "mqtt://localhost:1883", // Replace with your MQTT broker URL
  i2c: {
    address: 0x68, // Example I2C address for a device like MPU6050
    accelRegister: 0x3b,
  },
  pidConfig: {
    Kp: 1.0,
    Ki: 0.5,
    Kd: 0.1,
  },
  incrementDegree: 0,
  heightLevel: 'mid',
  isSensorAdjustmentEnabled: true,
  topics: {
    output: {
      console: "console/log",
      accelData: "controller/accelData",
      tiltAngles: "controller/tiltAngles",
      motorLeft: "controller/motorPWM/left",
      motorRight: "controller/motorPWM/right",
      servoLeft: "controller/servoPulseWidth/left",
      servoRight: "controller/servoPulseWidth/right",
    },
    input: {
      stop: "pid/stop",
      start: "pid/start",
      setKp: "pid/set/Kp",
      setKi: "pid/set/Ki",
      setKd: "pid/set/Kd",
      setIncrementDegree: "pid/set/increment",
  
      walk: "pid/move",
      setHeight: "pid/set/height",
      enableSensorAdjustments: "pid/sensor/enable",
    },
  },
};

/**
 * Fetches configuration dynamically from a remote service.
 * @returns {Promise<object>} The fetched configuration.
 */
async function fetchConfig() {
  try {
    const response = await axios.get("http://config-service:3004/config");
    return response.data;
  } catch (error) {
    console.error("Failed to fetch config:", error.message);
    throw error; // Propagate error to caller
  }
}

/**
 * Merges the fetched configuration with default values.
 * If fetching fails, it falls back to the default configuration.
 * @returns {Promise<object>} The final configuration.
 */
async function getConfig() {
  try {
    const fetchedConfig = await fetchConfig();
    return { ...defaultConfig, ...fetchedConfig }; // Merge fetched with defaults
  } catch (error) {
    console.warn("Using default config due to fetch failure.");
    return defaultConfig; // Fallback to default config
  }
}

module.exports = { getConfig, fetchConfig };
