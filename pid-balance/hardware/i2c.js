const i2c = require("i2c-bus");
const { getConfig } = require("../config/config.js");

const bus = i2c.openSync(1);


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

module.exports = { readAccelerometer };
