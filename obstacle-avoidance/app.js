// Import required libraries
const tf = require('@tensorflow/tfjs-node');
const axios = require('axios'); // Library to fetch the video stream
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

// Fetch a frame from the video stream
async function fetchFrameFromStream() {
    try {
        // Fetch the video frame from an existing webcam stream URL
        const response = await axios.get('http://webcam-stream:3008/stream', {
            responseType: 'arraybuffer',
        });
        return response.data; // Return the frame buffer
    } catch (error) {
        console.error('Error fetching frame from stream:', error);
        throw error;
    }
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
            // Fetch a frame from the video stream
            const frameBuffer = await fetchFrameFromStream();

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
