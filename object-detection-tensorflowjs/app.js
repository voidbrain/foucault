// Import required libraries
const tf = require('@tensorflow/tfjs-node');
const NodeWebcam = require('node-webcam'); // Library to capture webcam images
const express = require('express');
const app = express();
const port = 3000; // Port for the server

// Load a TensorFlow.js model (ensure this is a .json model file)
async function loadModel() {
    const model = await tf.loadLayersModel('file://path/to/your/model/model.json'); // Update with your model path
    return model;
}

// Perform inference using the loaded model on input tensor
async function runInference(model, input) {
    const output = model.predict(input);
    console.log('Inference result:', output.dataSync()); // Synchronously get data from tensor
}

// Capture an image from the webcam
function captureFrame() {
    return new Promise((resolve, reject) => {
        const options = {
            width: 640,
            height: 480,
            quality: 100,
            delay: 0,
            saveShots: false,
            output: "jpeg",
            device: false,
            callbackReturn: "buffer", // Return buffer instead of saving file
        };

        const Webcam = NodeWebcam.create(options);
        Webcam.capture("frame", (err, frame) => {
            if (err) {
                return reject(err);
            }
            resolve(frame); // The frame is returned as a buffer
        });
    });
}

// Preprocess image buffer into a tensor
function preprocessImage(buffer) {
    const imageTensor = tf.node.decodeImage(buffer, 3) // Decode buffer into 3-channel RGB image
        .resizeBilinear([224, 224])                    // Resize to model input size
        .toFloat()                                     // Convert to float for model input
        .div(tf.scalar(255.0))                         // Normalize pixel values to [0, 1]
        .expandDims(0);                                // Add batch dimension for inference
    return imageTensor;
}

// Stream webcam feed
app.get('/video', async (req, res) => {
    res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
    
    while (true) {
        try {
            // Capture a frame from the camera
            const frameBuffer = await captureFrame();

            // Preprocess the image for model input
            const inputTensor = preprocessImage(frameBuffer);

            // Run inference on the captured frame
            await runInference(model, inputTensor);

            // Send the frame as part of the stream
            res.write(`--frame\r\n`);
            res.write(`Content-Type: image/jpeg\r\n\r\n`);
            res.write(frameBuffer);
            res.write(`\r\n`);
        } catch (error) {
            console.error('Error during inference or capturing:', error);
            break; // Exit the loop on error
        }
    }
});

// Start the server
app.listen(port, async () => {
    try {
        const model = await loadModel(); // Load the model once
        console.log(`Server running on http://localhost:${port}`);
    } catch (error) {
        console.error('Error loading the model:', error);
    }
});
