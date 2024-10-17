function aStar(start, goal, grid) {
  // Open and closed sets
  let openSet = [start];
  let closedSet = [];

  // Calculate heuristic function
  function heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  // Main A* loop
  while (openSet.length > 0) {
    // Sort openSet by lowest cost
    openSet.sort((a, b) => a.f - b.f);
    let current = openSet.shift();

    // Check if we've reached the goal
    if (current === goal) {
      return reconstructPath(current);
    }

    closedSet.push(current);

    // Loop through neighbors and calculate cost
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
