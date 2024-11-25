module.exports = {
  readTemp: () => {
    console.log("Mocked readTemp function");
    return 25; // Example temperature
  },
  get: (address, callback) => {
    console.log("Mocked sensor.get function");

    // Mocked response data
    const err = null; // No error
    const value = 25; // Example sensor value

    // Simulate async behavior by invoking the callback with the mocked data
    process.nextTick(() => {
      callback(err, value);
    });
  },
};
