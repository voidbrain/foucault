class MockPca9685Driver {
  constructor(options, onReady) {
    console.log("MockPca9685Driver initialized with options:", options);
    if (onReady) {
      onReady(); // Call the callback to simulate async initialization
    }
  }
  // mock methods
  setPulseLength(channel, pulseLength) {
    console.log(
      `mock setPulseLength called with channel: ${channel}, pulseLength: ${pulseLength}`,
    );
  }
}

module.exports = { Pca9685Driver: MockPca9685Driver };
