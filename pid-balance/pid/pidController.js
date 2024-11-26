class PIDController {
  constructor(Kp, Ki, Kd) {
    this.Kp = Kp;
    this.Ki = Ki;
    this.Kd = Kd;
    this.previousError = 0;
    this.integral = 0;
  }

  compute(setpoint, measurement) {
    const error = setpoint - measurement;
    this.integral += error;
    const derivative = error - this.previousError;

    const output =
      this.Kp * error + this.Ki * this.integral + this.Kd * derivative;

    this.previousError = error;
    return output;
  }
}

module.exports = PIDController;
