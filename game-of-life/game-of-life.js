// Model
// Manages the data and logic of the application
class Model {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  initCells() {
    const cells = [];
    for (let i = 0; i < this.width * this.height; i++) {
      cells[i] = Math.random() < 0.1;
    }

    return cells;
  }

  index(row, col) {
    return row * this.width + col;
  }

  pos(index) {
    let row = Math.trunc(index / this.width);
    let col = index % this.width;
    return [row, col];
  }

  nextGeneration(cells) {
    const neighbours = (row, col) => {
      let n = 0;
      for (let y = -1; y <= 1; y++) {
        if (row + y < 0 || row + y >= this.height) continue;
        for (let x = -1; x <= 1; x++) {
          if (x == 0 && y == 0) continue;
          if (col + x < 0 || col + x >= this.width) continue;
          if (cells[this.index(row + y, col + x)]) n++;
        }
      }

      return n;
    };

    return cells.map((c, i) => {
      let n = neighbours(...this.pos(i));
      return n == 3 || (n == 2 && c);
    });
  }

  clear() {
    for (let cell of cells) {
      cell = false;
    }
  }
}

// View
// Handles the presentation of the data
// Should be the only component to interact with the DOM
class View {
  constructor(width, height) {
    this.width = width;
    this.height = height;

    this.grid = document.getElementById("grid");
    this.nextBtn = document.getElementById("next");
    this.simulateBtn = document.getElementById("simulate");
    this.clearBtn = document.getElementById("clear");

    this.initCheckboxes();
  }

  initCheckboxes() {
    this.checkboxes = [];
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        let checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        this.grid.appendChild(checkbox);
        this.checkboxes.push(checkbox);
      }
      this.grid.appendChild(document.createElement("br"));
    }
  }

  displayCells(cells) {
    for (let i = 0; i < cells.length; i++) {
      this.checkboxes[i].checked = cells[i];
    }
  }

  getCells() {
    return this.checkboxes.map((checkbox) => checkbox.checked);
  }

  bindNextGeneration(handler) {
    this.nextBtn.addEventListener("click", (event) => {
      handler(this.getCells());
    });
  }

  bindSimulation(handler) {
    this.simulateBtn.addEventListener("click", (event) => {
      handler(this.getCells());
    });
  }

  bindClear() {
    this.clearBtn.addEventListener("click", (event) => {
      for (let checkbox of this.checkboxes) {
        checkbox.checked = false;
      }
    });
  }
}

// Controller
// Manages user input and passes it to the model
class Controller {
  constructor(width, height) {
    this.model = new Model(width, height);
    this.view = new View(width, height);

    this.view.displayCells(this.model.initCells());

    this.view.bindNextGeneration(this.handleNextGeneration);
    this.view.bindSimulation(this.handleSimulation);
    this.view.bindClear();
  }

  handleNextGeneration = (cells) => {
    this.view.displayCells(this.model.nextGeneration(cells));
  };

  handleSimulation = (cells) => {};
}

// Application
const WIDTH = 30,
  HEIGHT = 15;
const app = new Controller(WIDTH, HEIGHT);
