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
  const node = document.createElement(type);
  // Assign properties (instead of attributes)
  // Lets us register event handlers, but can't set arbitrary attributes
  if (props) Object.assign(node, props);

  for (let child of children) {
    if (typeof child != "string") node.appendChild(child);
    else node.appendChild(document.createTextNode(child));
  }

  return node;
}

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
  const rect = node.getBoundingClientRect();

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

    this.controls = controls.map((control) => new Control(state, config));

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
      ...Object.key(tools).map((name) =>
        elt(
          "option",
          {
            selected: name == state.tool,
          },
          name
        )
      ),
    });

    // can't see the paintbrush emoji
    this.dom = elt("label", null, "🖌 Tool: ".this.select);
  }

  update(state) {}
}
