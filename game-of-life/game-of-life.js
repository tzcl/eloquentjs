// Model
function initialState(width, height) {
  // 2D array is easier to reason about
  // 1D array may be faster (due to data locality)
  // but the benefit is negligible here

  // This one-liner creates a 2D array of size width x height
  let cells = Array.from(Array(height), () => Array(width));
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      cells[row][col] = Math.random() < 0.1;
    }
  }
  cells.height = height;
  cells.width = width;
  return cells;
}

function neighbours(row, col, state) {
  let neighbours = 0; // between 3 and 8
  for (let y = -1; y <= 1; y++) {
    if (row + y < 0 || row + y >= state.height) continue;
    for (let x = -1; x <= 1; x++) {
      if (y == 0 && x == 0) continue;
      if (col + x < 0 || col + x >= state.width) continue;
      neighbours += state[row + y][col + x]; // cast bool to int
    }
  }
  return neighbours;
}

function nextState(state) {
  // Want to write an efficient algorithm
  // Naive: for each cell, apply rules to neighbours
  for (let row = 0; row < state.height; row++) {
    for (let col = 0; col < state.width; col++) {
      let n = neighbours(row, col, state);
      state[row][col] = n == 3 || (n == 2 && state[row][col]);
    }
  }
  return state;
}

// View
const grid = document.getElementById("grid");

function createCheckboxes(width, height) {
  let checkboxes = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      grid.appendChild(checkbox);
      checkboxes.push(checkbox);
    }

    grid.appendChild(document.createElement("br"));
  }
  checkboxes.width = width;
  checkboxes.height = height;

  return checkboxes;
}

// Controller
const WIDTH = 30,
  HEIGHT = 15;

const init_state = initialState(WIDTH, HEIGHT);
const checkboxes = createCheckboxes(WIDTH, HEIGHT);

applyState(init_state, checkboxes);

function getState(checkboxes) {
  let cells = Array.from(Array(checkboxes.height), () =>
    Array(checkboxes.width)
  );

  cells.width = checkboxes.width;
  cells.height = checkboxes.height;

  for (let row = 0; row < checkboxes.height; row++) {
    for (let col = 0; col < checkboxes.width; col++) {
      cells[row][col] = checkboxes[row * checkboxes.width + col].checked;
    }
  }

  return cells;
}

function applyState(state, checkboxes) {
  for (let row = 0; row < checkboxes.height; row++) {
    for (let col = 0; col < checkboxes.width; col++) {
      let checkbox = checkboxes[row * checkboxes.width + col];
      checkbox.checked = state[row][col];
    }
  }
}

function clearCheckboxes(checkboxes) {
  for (let row = 0; row < checkboxes.height; row++) {
    for (let col = 0; col < checkboxes.width; col++) {
      checkboxes[row * checkboxes.width + col].checked = false;
    }
  }
}

function handleNext(event) {
  let state = getState(checkboxes);
  state = nextState(state);
  applyState(state, checkboxes);
}

function handleAuto(event) {
  let state = getState(checkboxes);
  let prev_state;

  let running = null;
  if (running) {
    clearInterval(running);
    running = null;
  } else {
    running = setInterval(() => {
      state = getState(checkboxes);
      state = nextState(state);
      applyState(state, checkboxes);
    }, 500);
  }
}

function handleClear(event) {
  clearCheckboxes(checkboxes);
}

const next = document.getElementById("next");
const auto = document.getElementById("auto");
const clear = document.getElementById("clear");

function registerHandlers() {
  next.addEventListener("click", handleNext);
  auto.addEventListener("click", handleAuto);
  clear.addEventListener("click", handleClear);

  return () => {
    next.removeEventListener("click", handleNext);
    auto.removeEventListener("click", handleAuto);
    clear.removeEventListener("click", handleClear);
  };
}

let deregisterHandlers = registerHandlers();
