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
  if (action.revert == "undo") {
    if (state.history.length == 1) return state;
    return {
      ...state,
      picture: state.history[state.marker + 1],
      marker: state.marker + 1,
    };
  } else if (action.revert == "redo") {
    if (state.history.length == 1) return state;
    return {
      ...state,
      picture: state.history[state.marker - 1],
      marker: state.marker - 1,
    };
  } else if (action.commit == true) {
    let history = [state.picture, ...state.history];
    let marker = state.marker;

    if (state.marker > 0) {
      history = [state.picture, ...state.history.slice(state.marker)];
      marker = 0;
    }

    return {
      ...state,
      history,
      marker,
    };
  } else {
    return { ...state, ...action };
  }
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

// Bresenham's algorithm
// Basic idea: increment y when the error gets too big
// This is generalised to work for all octants
function drawLine(start, pos, colour) {
  let dx = Math.abs(pos.x - start.x);
  let sx = start.x < pos.x ? 1 : -1;

  // Note the negative
  // In graphics, y++ means moving down
  let dy = -Math.abs(pos.y - start.y);
  let sy = start.y < pos.y ? 1 : -1;

  let err = dx + dy;

  let drawn = [];
  for (let x = start.x, y = start.y; ; ) {
    drawn.push({ x, y, colour });
    if (x == pos.x && y == pos.y) break;
    let err2 = 2 * err; // avoid dividing
    if (err2 >= dy) {
      if (x == pos.x) break;
      err += dy;
      x += sx;
    }
    if (err2 <= dx) {
      if (y == pos.y) break;
      err += dx;
      y += sy;
    }
  }

  return drawn;
}

function draw(start, state, dispatch) {
  // Draw segments rather than pixels
  // The mousemove/touchmove events don't fire quickly enough to hit every pixel
  // when you move the mouse quickly
  function drawSegment(pos, state) {
    let drawn = drawLine(start, pos, state.colour);
    start = pos;
    dispatch({ picture: state.picture.draw(drawn) });
  }

  // Immediately draw a segment
  drawSegment(start, state);

  // But also return it so that it can be called again when the user drags or
  // swipes over the picture
  return drawSegment;
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
  dispatch({ commit: true });
}

function circle(start, state, dispatch) {
  const dist = (x, y) => {
    let dx = x - start.x;
    let dy = y - start.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  function drawCircle(pos) {
    let radius = Math.ceil(dist(pos.x, pos.y));

    let xStart = Math.max(0, start.x - radius);
    let yStart = Math.max(0, start.y - radius);
    let xEnd = Math.min(start.x + radius, state.picture.width);
    let yEnd = Math.min(start.y + radius, state.picture.height);

    let drawn = [];
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        let d = dist(x, y);
        if (d < radius) drawn.push({ x, y, colour: state.colour });
      }
    }

    dispatch({ picture: state.picture.draw(drawn) });
  }

  drawCircle(start);
  return drawCircle;
}

function line(start, state, dispatch) {
  return (end) => {
    let drawn = drawLine(start, end, state.colour);
    dispatch({ picture: state.picture.draw(drawn) });
  };
}

function pick(pos, state, dispatch) {
  dispatch({ colour: state.picture.pixel(pos.x, pos.y) });
}

function drawPicture(picture, canvas, scale) {
  // Changing the size of a <canvas> element clears it and makes it transparent
  canvas.width = picture.width * scale;
  canvas.height = picture.height * scale;
  let cx = canvas.getContext("2d");

  // Redrawing the whole canvas is expensive
  for (let y = 0; y < picture.height; y++) {
    for (let x = 0; x < picture.width; x++) {
      cx.fillStyle = picture.pixel(x, y);
      cx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

// Skip unnecessary redraws
function patchPicture(prev, curr, canvas, scale) {
  let cx = canvas.getContext("2d");

  for (let y = 0; y < prev.height; y++) {
    for (let x = 0; x < prev.width; x++) {
      if (prev.pixel(x, y) != curr.pixel(x, y)) {
        cx.fillStyle = curr.pixel(x, y);
        cx.fillRect(x * scale, y * scale, scale, scale);
      }
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
  constructor(picture, pointerDown, pointerUp) {
    this.dom = elt("canvas", {
      onmousedown: (event) => this.mouse(event, pointerDown, pointerUp),
      ontouchstart: (event) => this.touch(event, pointerDown, pointerUp),
    });

    this.update(picture);
  }

  update(picture) {
    if (!this.picture) {
      this.picture = picture;
      drawPicture(this.picture, this.dom, scale);
    }

    if (this.picture == picture) return;
    patchPicture(this.picture, picture, this.dom, scale);
    this.picture = picture;
  }

  mouse(downEvent, onDown, onUp) {
    if (downEvent.button != 0) return;

    let pos = pointerPosition(downEvent, this.dom);
    const onMove = onDown(pos);
    if (!onMove) return;

    const move = (moveEvent) => {
      let newPos = pointerPosition(moveEvent, this.dom);
      if (newPos.x == pos.x && newPos.y == pos.y) return;
      pos = newPos;
      onMove(newPos);
    };

    const end = () => {
      onUp();
      this.dom.removeEventListener("mousemove", move);
      this.dom.removeEventListener("mouseup", end);
    };

    this.dom.addEventListener("mousemove", move);
    this.dom.addEventListener("mouseup", end);
  }

  touch(startEvent, onDown, onUp) {
    startEvent.preventDefault();

    let pos = pointerPosition(startEvent.touches[0], this.dom);
    const onMove = onDown(pos);
    if (!onMove) return;

    const move = (moveEvent) => {
      const newPos = pointerPosition(moveEvent.touches[0], this.dom);
      if (newPos.x == pos.x && newPos.y == pos.y) return;
      pos = newPos;
      onMove(newPos);
    };

    const end = () => {
      onUp();
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

    this.canvas = new PictureCanvas(
      state.picture,
      (pos) => {
        let tool = tools[this.state.tool];

        // Call the tool once
        let onMove = tool(pos, this.state, dispatch);
        // Pass along function in case we need to redraw
        if (onMove) return (pos) => onMove(pos, this.state);
      },
      () => dispatch({ commit: true })
    );

    this.controls = controls.map((Control) => new Control(state, config));

    const keyDown = (event) => {
      if (event.key == "z" && (event.ctrlKey || event.metaKey)) {
        dispatch({ revert: "undo" });
      } else if (event.key == "y" && (event.ctrlKey || event.metaKey)) {
        dispatch({ revert: "redo" });
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        for (let tool in tools) {
          if (event.key == tool[0]) {
            dispatch({ tool });
            return;
          }
        }
      }
    };

    this.dom = elt(
      "div",
      { tabIndex: 0, onkeydown: (event) => keyDown(event) },
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

    this.dom = elt("label", null, elt("span", {}, "🖌"), " Tool: ", this.select);
  }

  update(state) {
    this.select.value = state.tool;
  }
}

class ColourSelect {
  constructor(state, { dispatch }) {
    this.input = elt("input", {
      type: "color",
      value: state.colour,
      oninput: () => dispatch({ colour: this.input.value }),
    });

    this.dom = elt(
      "label",
      null,
      elt("span", {}, "🎨"),
      " Colour: ",
      this.input
    );
  }

  update(state) {
    this.input.value = state.colour;
  }
}

class SaveButton {
  constructor(state) {
    this.picture = state.picture;
    this.dom = elt(
      "button",
      {
        onclick: () => this.save(),
      },
      elt("span", {}, "💾"),
      " Save"
    );
  }

  save() {
    let canvas = elt("canvas");
    drawPicture(this.picture, canvas, 1);
    let link = elt("a", {
      href: canvas.toDataURL(),
      download: "pixelart.png",
    });

    // Simulate clicking the link and then remove it
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  update(state) {
    this.picture = state.picture;
  }
}

class LoadButton {
  constructor(_, { dispatch }) {
    this.dom = elt(
      "button",
      {
        onclick: () => startLoad(dispatch),
      },
      elt("span", {}, "📂"),
      " Load"
    );
  }

  update() {}
}

function startLoad(dispatch) {
  let input = elt("input", {
    type: "file",
    onchange: () => finishLoad(input.files[0], dispatch),
  });
  document.body.appendChild(input);
  input.click();
  input.remove();
}

function finishLoad(file, dispatch) {
  if (file == null) return;
  let reader = new FileReader();
  reader.addEventListener("load", () => {
    let image = elt("img", {
      onload: () => dispatch({ picture: pictureFromImage(image) }),
      src: reader.result,
    });
  });
  reader.readAsDataURL(file);
}

function pictureFromImage(image) {
  // Limit size of pictures to 100x100
  let width = Math.min(100, image.width);
  let height = Math.min(100, image.height);

  let canvas = elt("canvas", { width, height });
  let cx = canvas.getContext("2d");

  cx.drawImage(image, 0, 0);
  let pixels = [];
  let { data } = cx.getImageData(0, 0, width, height);

  const hex = (n) => {
    return n.toString(16).padStart(2, "0");
  };

  for (let i = 0; i < data.length; i += 4) {
    let [r, g, b] = data.slice(i, i + 3);
    pixels.push("#" + hex(r) + hex(g) + hex(b));
  }

  return new Picture(width, height, pixels);
}

class UndoButton {
  constructor(state, { dispatch }) {
    this.dom = elt(
      "button",
      {
        onclick: () => dispatch({ revert: "undo" }),
        disabled: state.marker == state.history.length - 1,
      },
      elt("span", {}, "↩"),
      " Undo"
    );
  }

  update(state) {
    this.dom.disabled = state.marker == state.history.length - 1;
  }
}

class RedoButton {
  constructor(state, { dispatch }) {
    this.dom = elt(
      "button",
      {
        onclick: () => dispatch({ revert: "redo" }),
        disabled: state.marker == 0,
      },
      elt("span", {}, "↪"),
      " Redo"
    );
  }

  update(state) {
    this.dom.disabled = state.marker == 0;
  }
}

const defaultPicture = Picture.empty(60, 30, "#f0f0f0");

// Start application
const startState = {
  tool: "draw",
  colour: "#000000",
  picture: defaultPicture,
  history: [defaultPicture], // TODO: make fixed size
  marker: 0,
};

const baseTools = { draw, line, rectangle, circle, fill, pick };

const baseControls = [
  ToolSelect,
  ColourSelect,
  SaveButton,
  LoadButton,
  UndoButton,
  RedoButton,
];

function startPixelEditor({
  state = startState,
  tools = baseTools,
  controls = baseControls,
}) {
  let app = new PixelEditor(state, {
    tools,
    controls,
    dispatch(action) {
      state = updateState(state, action);
      console.log("Updating", action, state);
      app.update(state);
    },
  });

  return app.dom;
}

document.getElementById("root").appendChild(startPixelEditor({}));
