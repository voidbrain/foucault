// Import required libraries
const tf = require('@tensorflow/tfjs-node');
const NodeWebcam = require('node-webcam'); // Library to capture webcam images
const fs = require('fs');
const path = require('path');

// Load a TensorFlow.js model (not TensorFlow Lite, as tfjs-node doesn't support tflite models)
async function loadModel() {
    // Replace 'path/to/your/model.json' with the actual path to the TensorFlow.js model
    const model = await tf.loadLayersModel('file://path/to/your/model/model.json');
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
    // Preprocess the buffer into a tensor based on model requirements
    const imageTensor = tf.node.decodeImage(buffer, 3) // Decode buffer into 3-channel RGB image
        .resizeBilinear([224, 224])                    // Resize to model input size
        .toFloat()                                     // Convert to float for model input
        .div(tf.scalar(255.0))                         // Normalize pixel values to [0, 1]
        .expandDims(0);                                // Add batch dimension for inference
    return imageTensor;
}

// Add delay to avoid overloading the system between frames
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Main application logic for continuous camera feed processing
(async () => {
    try {
        // Load the model once
        const model = await loadModel();

        // Continuous loop to capture frames and run inference
        while (true) {
            try {
                // Capture a frame from the camera
                const frameBuffer = await captureFrame();

                // Preprocess the image for model input
                const inputTensor = preprocessImage(frameBuffer);

                // Run inference on the captured frame
                await runInference(model, inputTensor);
            } catch (error) {
                console.error('Error during inference or capturing:', error);
            }

            // Optional: Introduce a small delay between frames to avoid system overload
            await delay(100); // 100ms delay
        }
    } catch (error) {
        console.error('Error loading the model:', error);
    }
})();
