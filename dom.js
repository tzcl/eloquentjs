function DFS(init, visit, update) {
  // Use the call stack
  function explore(state) {
    visit(state);
    for (const new_state of update(state)) {
      explore(new_state);
    }

    return state;
  }

  return explore(init);
}

function BFS(init, visit, update) {
  // Use a queue
  let queue = [init];
  let state;

  while (queue.length) {
    state = queue.shift();
    visit(state);
    for (const new_state of update(state)) {
      queue.push(new_state);
    }
  }

  return state;
}

function IterativeDFS(init, visit, update) {
  // Use an explicit stack
  let stack = [init];
  let state;

  while (stack.length) {
    state = stack.pop();
    visit(state);
    for (const new_state of update(state).reverse()) {
      stack.push(new_state);
    }
  }

  return state;
}

const state = (node) => {
  return { node: node, indent: "", acc: [] };
};
const visit = (tagName) => {
  return (state) => {
    console.log(state.indent + state.node.nodeName);
    if (state.node.nodeName === tagName) state.acc.push(state.node);
  };
};
const update = (state) => {
  return Array.from(state.node.children).map((child) => {
    return { node: child, indent: state.indent + "  ", acc: state.acc };
  });
};

function byTagNameDFS(node, tagName) {
  tagName = tagName.toUpperCase();

  return DFS(state(node), visit(tagName), update).acc;
}

function byTagNameBFS(node, tagName) {
  tagName = tagName.toUpperCase();

  return BFS(state(node), visit(tagName), update).acc;
}

function byTagNameIterativeDFS(node, tagName) {
  tagName = tagName.toUpperCase();

  return IterativeDFS(state(node), visit(tagName), update).acc;
}

let byTagName = byTagNameIterativeDFS;

console.log(byTagName(document.body, "h1"));

console.log(byTagName(document.body, "span"));

let para = document.querySelector("p");
console.log(byTagName(para, "span"));
