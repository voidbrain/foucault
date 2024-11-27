const RealI2C = require("i2c-bus");
const MockI2C = require("../mocks/i2c-bus.cjs"); 
const { getConfig } = require("../config/config.js");
const fs = require("fs");

const bus = isRaspberryPi() ? RealI2C.openSync(1) : MockI2C.openSync("/dev/i2c-mock");


async function readAccelerometer() {
  return new Promise(async (resolve, reject) => {
    try {
      const config = await getConfig();

      const buffer = Buffer.alloc(6);
      bus.readI2cBlockSync(config.i2c.address, config.i2c.accelRegister, 6, buffer);

      let accelX = (buffer[0] << 8) | buffer[1];
      let accelY = (buffer[2] << 8) | buffer[3];
      let accelZ = (buffer[4] << 8) | buffer[5];

      accelX = accelX > 32767 ? accelX - 65536 : accelX;
      accelY = accelY > 32767 ? accelY - 65536 : accelY;
      accelZ = accelZ > 32767 ? accelZ - 65536 : accelZ;
      resolve({ accelX, accelY, accelZ });
    } catch (err) {
      console.error("I2C read error:", err);
      reject("Failed to read accelerometer data.");
    }
  });
}

function isRaspberryPi() {
  try {
    // Read /proc/cpuinfo
    const cpuInfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
    if (cpuInfo.includes('Raspberry Pi')) {
      return true;
    }

    // Read /sys/firmware/devicetree/base/model
    const modelPath = '/sys/firmware/devicetree/base/model';
    if (fs.existsSync(modelPath)) {
      const model = fs.readFileSync(modelPath, 'utf8').toLowerCase();
      if (model.includes('raspberry pi')) {
        return true;
      }
    }
  } catch (error) {
    console.error('Error checking Raspberry Pi:', error);
  }

  return false;
}

module.exports = { readAccelerometer, isRaspberryPi };
