// Import required libraries for TensorFlow.js, camera feed, and A* implementation
const tf = require('@tensorflow/tfjs-node');
const NodeWebcam = require('node-webcam');

// A* Algorithm
function aStar(start, goal, grid) {
  let openSet = [start];
  let closedSet = [];

  function heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    let current = openSet.shift();

    if (current === goal) {
      return reconstructPath(current);
    }

    closedSet.push(current);

    for (let neighbor of getNeighbors(current, grid)) {
      if (closedSet.includes(neighbor)) continue;

      let tentative_g = current.g + 1;

      if (!openSet.includes(neighbor) || tentative_g < neighbor.g) {
        neighbor.g = tentative_g;
        neighbor.h = heuristic(neighbor, goal);
        neighbor.f = neighbor.g + neighbor.h;
        neighbor.cameFrom = current;

        if (!openSet.includes(neighbor)) {
          openSet.push(neighbor);
        }
      }
    }
  }

  return null; // No path found
}

// Function to reconstruct the path once the goal is reached
function reconstructPath(current) {
  let path = [];
  while (current.cameFrom) {
    path.push(current);
    current = current.cameFrom;
  }
  return path.reverse();
}

// Function to get neighbors (assuming 4-directional movement)
function getNeighbors(node, grid) {
  let neighbors = [];
  let dirs = [
    { x: 0, y: -1 }, // Up
    { x: 0, y: 1 },  // Down
    { x: -1, y: 0 }, // Left
    { x: 1, y: 0 }   // Right
  ];

  for (let dir of dirs) {
    let newX = node.x + dir.x;
    let newY = node.y + dir.y;
    if (newX >= 0 && newX < grid.length && newY >= 0 && newY < grid[0].length) {
      neighbors.push(grid[newX][newY]);
    }
  }

  return neighbors;
}

// Function to continuously capture frames from the camera
async function captureFrameAndUpdateGrid() {
  const options = {
    width: 640,
    height: 480,
    quality: 100,
    delay: 0,
    output: "jpeg",
    device: false,
    callbackReturn: "buffer",
  };

  const Webcam = NodeWebcam.create(options);
  
  while (true) {
    await new Promise((resolve, reject) => {
      Webcam.capture("frame", (err, frameBuffer) => {
        if (err) {
          console.error("Error capturing frame:", err);
          return reject(err);
        }

        // Preprocess the frame and update the grid with obstacles or objects
        updateGridWithCameraFeed(frameBuffer);

        resolve();
      });
    });

    // Delay between frames (adjust as needed)
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Function to update the grid with obstacles from the camera feed
function updateGridWithCameraFeed(frameBuffer) {
  // TODO: Process the frameBuffer using image processing (e.g., TensorFlow.js)
  // to detect obstacles and dynamically update the grid.
  
  // For now, assuming the grid is static and no dynamic obstacles are detected.
}

// Main function to run continuous A* pathfinding
(async () => {
  // Define a grid (for simplicity, a 2D array of nodes)
  const grid = createGrid(20, 20);

  // Set start and goal nodes
  const start = grid[0][0];
  const goal = grid[19][19];

  // Set up the continuous loop for capturing frames and running A* pathfinding
  await captureFrameAndUpdateGrid();

  while (true) {
    // Continuously run A* with updated start, goal, and grid
    const path = aStar(start, goal, grid);

    if (path) {
      console.log("Path found:", path);
    } else {
      console.log("No path found.");
    }

    // Delay between each A* run (optional, can be adjusted based on camera feed rate)
    await new Promise(resolve => setTimeout(resolve, 100));
  }
})();

// Utility function to create a 2D grid for the A* algorithm
function createGrid(rows, cols) {
  let grid = [];
  for (let x = 0; x < rows; x++) {
    let row = [];
    for (let y = 0; y < cols; y++) {
      row.push({
        x: x,
        y: y,
        g: 0,
        h: 0,
        f: 0,
        cameFrom: null
      });
    }
    grid.push(row);
  }
  return grid;
}
