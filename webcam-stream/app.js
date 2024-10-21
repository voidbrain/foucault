const express = require('express');
const NodeWebcam = require('node-webcam');
const app = express();
const port = 3008;

// Set up NodeWebcam to capture frames from the webcam
const webcamOptions = {
  width: 640,
  height: 480,
  quality: 100,
  frames: 30,  // Adjust frames per second
  output: "jpeg",
  device: false,
  callbackReturn: "buffer"
};

const Webcam = NodeWebcam.create(webcamOptions);

// Route for streaming webcam feed
app.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
  
  // Continuously capture frames and stream to response
  setInterval(() => {
    Webcam.capture("frame", (err, frame) => {
      if (err) {
        console.error('Error capturing frame:', err);
        return;
      }
      
      res.write(`--frame\r\n`);
      res.write(`Content-Type: image/jpeg\r\n`);
      res.write(`Content-Length: ${frame.length}\r\n\r\n`);
      res.write(frame, 'binary');
      res.write('\r\n');
    });
  }, 100);  // Stream frame every 100ms (10 frames per second)
});

app.listen(port, () => {
  console.log(`Webcam stream running at http://localhost:${port}/stream`);
});
