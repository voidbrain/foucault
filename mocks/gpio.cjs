class Gpio {
  constructor(pin, options) {
    this.pin = pin;
    this.mode = options.mode;
    console.log(`mock Gpio constructor called for pin ${pin} with mode ${this.mode}`);
  }

  // Constants
  static OUTPUT = 'output';
  static INPUT = 'input';

  // Simulate setting the pin mode
  write(value) {
    console.log(`mock write called for pin ${this.pin} with value ${value}`);
  }

  pwmWrite(value) {
    console.log(`mock pwmWrite called for pin ${this.pin} with value ${value}`);
  }

  servoWrite(value) {
    console.log(`mock servoWrite called for pin ${this.pin} with value ${value}`);
  }

  // Simulate reading from a pin
  read(callback) {
    console.log(`mock read called for pin ${this.pin}`);
    callback(null, 0);  // Simulate reading a 0
  }

  // Simulate watching a pin for changes (e.g., for interrupts)
  watch(callback) {
    console.log(`mock watch called for pin ${this.pin}`);
    setTimeout(() => callback('RISING'), 1000); // Simulate a rising edge event
  }

  // Simulate unwatching a pin
  unwatch() {
    console.log(`mock unwatch called for pin ${this.pin}`);
  }

  // Cleanup resources
  unexport() {
    console.log(`mock unexport called for pin ${this.pin}`);
  }
}

// Export the Gpio class directly
module.exports = Gpio;
