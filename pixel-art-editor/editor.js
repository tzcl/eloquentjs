// Design
//
// We will structure the editor interface as components, objects that are
// responsible for a piece of the DOM and may contain other components.
//
// The state will be the current picture, selected tool and the selected colour.
// These will live in a single value.
//
// Components will interact with the state by creating and dispatching actions,
// objects that represent state changes. Then, we will use a central piece of
// machinery to compute the next state, and share this will the components.
//
// Components will be classes conforming to an interface:
// - Their constructor will be given a state (which may be the application
//   state or a subset)
// - They will have an update method that takes a state and updates the
//   component to reflect that state

// State
//
// Picture, current tool and colour

const scale = 10;

function updateState(state, action) {
  return { ...state, ...action };
}

function elt(type, props, ...children) {
  const dom = document.createElement(type);
  // Assign properties (instead of attributes)
  // Lets us register event handlers, but can't set arbitrary attributes
  if (props) Object.assign(dom, props);

  for (let child of children) {
    if (typeof child != "string") dom.appendChild(child);
    else dom.appendChild(document.createTextNode(child));
  }

  return dom;
}

function draw(pos, state, dispatch) {
  function drawPixel({ x, y }, state) {
    let drawn = { x, y, colour: state.colour };
    dispatch({ picture: state.picture.draw([drawn]) });
  }

  // Immediately draw a pixel
  drawPixel(pos, state);

  // But also return it so that it can be called again when the user drags or
  // swipes over the picture
  return drawPixel;
}

function rectangle(start, state, dispatch) {
  function drawRectangle(pos) {
    let xStart = Math.min(start.x, pos.x);
    let yStart = Math.min(start.y, pos.y);
    let xEnd = Math.max(start.x, pos.x);
    let yEnd = Math.max(start.y, pos.y);

    // Draw the rectangle on the original picture
    // This way the intermediate rectangles aren't saved
    let drawn = [];
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        drawn.push({ x, y, colour: state.colour });
      }
    }

    dispatch({ picture: state.picture.draw(drawn) });
  }

  drawRectangle(start);
  return drawRectangle;
}

const around = [
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
];

function fill({ x, y }, state, dispatch) {
  let targetColour = state.picture.pixel(x, y);
  let drawn = [{ x, y, colour: state.colour }];
  for (let done = 0; done < drawn.length; done++) {
    // For each neighbour
    for (let { dx, dy } of around) {
      let x = drawn[done].x + dx,
        y = drawn[done].y + dy;
      if (
        x < 0 ||
        x >= state.picture.width ||
        y < 0 ||
        y >= state.picture.height || // out of bounds
        state.picture.pixel(x, y) != targetColour || // different colour
        drawn.some((p) => p.x == x && p.y == y) // already visited
      )
        continue;

      drawn.push({ x, y, colour: state.colour });
    }
  }

  dispatch({ picture: state.picture.draw(drawn) });
}

function pick(pos, state, dispatch) {
  dispatch({ colour: state.picture.pixel(pos.x, pos.y) });
}

// TODO: reorganise this code, these global functions should belong in different sections

function drawPicture(picture, canvas, scale) {
  canvas.width = picture.width * scale;
  canvas.height = picture.height * scale;
  let cx = canvas.getContext("2d");

  for (let y = 0; y < picture.height; y++) {
    for (let x = 0; x < picture.width; x++) {
      cx.fillStyle = picture.pixel(x, y);
      cx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

function pointerPosition(pos, dom) {
  const rect = dom.getBoundingClientRect();

  return {
    x: Math.floor((pos.clientX - rect.left) / scale),
    y: Math.floor((pos.clientY - rect.top) / scale),
  };
}

// Treat as immutable (why?)
class Picture {
  constructor(width, height, pixels) {
    this.width = width;
    this.height = height;
    this.pixels = pixels;
  }

  static empty(width, height, colour) {
    let pixels = new Array(width * height).fill(colour);
    return new Picture(width, height, pixels);
  }

  pixel(x, y) {
    return this.pixels[x + y * this.width];
  }

  draw(pixels) {
    let copy = this.pixels.slice();
    for (let { x, y, colour } of pixels) {
      copy[x + y * this.width] = colour;
    }

    return new Picture(this.width, this.height, copy);
  }
}

class PictureCanvas {
  constructor(picture, pointerDown) {
    this.dom = elt("canvas", {
      onmousedown: (event) => this.mouse(event, pointerDown),
      ontouchstart: (event) => this.touch(event, pointerDown),
    });

    this.update(picture);
  }

  update(picture) {
    if (this.picture == picture) return;
    this.picture = picture;
    drawPicture(this.picture, this.dom, scale);
  }

  mouse(downEvent, onDown) {
    if (downEvent.button != 0) return;

    let pos = pointerPosition(downEvent, this.dom);
    const onMove = onDown(pos);
    if (!onMove) return;

    const move = (moveEvent) => {
      if (moveEvent.buttons == 0) {
        this.dom.removeEventListener("mousemove", move);
      } else {
        let newPos = pointerPosition(moveEvent, this.dom);
        if (newPos.x == pos.x && newPos.y == pos.y) return;
        pos = newPos;
        onMove(newPos);
      }
    };

    this.dom.addEventListener("mousemove", move);
  }

  touch(startEvent, onDown) {
    startEvent.preventDefault();

    let pos = pointerPosition(startEvent.touches[0], this.dom);
    const onMove = onDown(pos);
    if (!onMove) return;

    let move = (moveEvent) => {
      const newPos = pointerPosition(moveEvent.touches[0], this.dom);
      if (newPos.x == pos.x && newPos.y == pos.y) return;
      pos = newPos;
      onMove(newPos);
    };

    let end = () => {
      this.dom.removeEventListener("touchmove", move);
      this.dom.removeEventListener("touchend", end);
    };

    this.dom.addEventListener("touchmove", move);
    this.dom.addEventListener("touchend", end);
  }
}

// Application

class PixelEditor {
  constructor(state, config) {
    let { tools, controls, dispatch } = config;
    this.state = state;

    this.canvas = new PictureCanvas(state.picture, (pos) => {
      let tool = tools[this.state.tool];
      let onMove = tool(pos, this.state, dispatch);
      if (onMove) return (pos) => onMove(pos, this.state);
    });

    this.controls = controls.map((control) => new control(state, config));

    this.dom = elt(
      "div",
      {},
      this.canvas.dom,
      elt("br"),
      ...this.controls.reduce((a, c) => a.concat(" ", c.dom), [])
    );
  }

  update(state) {
    this.state = state;
    this.canvas.update(state.picture);
    for (let ctrl of this.controls) ctrl.update(state);
  }
}

class ToolSelect {
  constructor(state, { tools, dispatch }) {
    this.select = elt("select", {
      onchange: () => dispatch({ tool: this.select.value }),
      ...Object.keys(tools).map((name) =>
        elt(
          "option",
          {
            selected: name == state.tool,
          },
          name
        )
      ),
    });

    this.dom = elt("label", null, "🖌 Tool: ", this.select);
  }

  update(state) {
    this.select.value = state.tool;
  }
}

class ColourSelect {
  constructor(state, { dispatch }) {
    this.input = elt("input", {
      type: "colour",
      value: state.colour,
      onchange: () => dispatch({ colour: this.input.value }),
    });

    this.dom = elt("label", null, "🎨 Colour: ", this.input);
  }

  update(state) {
    this.input.value = state.colour;
  }
}

// Start application
let state = {
  tool: "draw",
  colour: "#000000",
  picture: Picture.empty(60, 30, "#f0f0f0"),
};

let app = new PixelEditor(state, {
  tools: { draw, fill, rectangle, pick },
  controls: [ToolSelect, ColourSelect],
  dispatch(action) {
    state = updateState(state, action);
    app.update(state);
  },
});

document.getElementById("root").appendChild(app.dom);
