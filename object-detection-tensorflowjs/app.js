// Import required libraries
const tf = require('@tensorflow/tfjs-node');
const axios = require('axios'); // Library to fetch the video stream
const express = require('express');
const cocoSsd = require('@tensorflow-models/coco-ssd'); // Import COCO-SSD model
const app = express();
const port = 3000; // Port for the server

let model; // Define model variable globally

// Load the COCO-SSD model
async function loadModel() {
    try {
        model = await cocoSsd.load(); // Load the COCO-SSD model
        console.log('COCO-SSD model loaded');
    } catch (error) {
        console.error('Error loading the model:', error);
        throw error; // Rethrow the error to handle it in the main app
    }
}

// Perform inference using the loaded model on input tensor
async function runInference(input) {
    const output = await model.detect(input); // Detect objects in the input tensor
    return output; // Return detected objects
}

// Fetch a frame from the video stream
async function fetchFrameFromStream() {
    try {
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
    const imageTensor = tf.node.decodeImage(buffer, 3)
        .resizeBilinear([640, 640]) // Resize to model input size
        .toFloat()
        .div(tf.scalar(255.0))
        .expandDims(0);
    return imageTensor;
}

// Stream video feed and perform inference
app.get('/video', async (req, res) => {
    res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');

    while (true) {
        try {
            const frameBuffer = await fetchFrameFromStream();
            const inputTensor = preprocessImage(frameBuffer);
            const detectedObjects = await runInference(inputTensor);

            // Object avoidance logic
            handleObjectAvoidance(detectedObjects);

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

// Handle object avoidance logic
function handleObjectAvoidance(detectedObjects) {
    detectedObjects.forEach(obj => {
        if (obj.score > 0.5) { // Confidence threshold
            const [x, y, width, height] = obj.bbox; // Bounding box coordinates
            console.log(`Detected object: ${obj.class} with confidence ${obj.score} at [${x}, ${y}, ${width}, ${height}]`);
            // Implement your pathfinding or avoidance logic based on the object's position
        }
    });
}

// Start the server
app.listen(port, async () => {
    try {
        await loadModel(); // Load the model once
        console.log(`Server running on http://localhost:${port}`);
    } catch (error) {
        console.error('Error loading the model:', error);
    }
});
