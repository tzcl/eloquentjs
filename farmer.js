const root = { fox: "left", chicken: "left", grain: "left", farmer: "left" };

const transitions = {
  left: "going",
  going: "right",
  right: "coming",
  coming: "left",
};

const swapSide = { left: "right", right: "left" };

function search(root) {
  let queue = [];
  let sols = { num: 0, len: 100 };

  let seen = new Set();
  seen.add(JSON.stringify(root));
  for (let next of possibleMoves(root)) {
    if (!seen.has(JSON.stringify(next))) {
      seen.add(JSON.stringify(next));
      queue.push({
        node: next,
        depth: "",
        seen: new Set(seen),
        path: [root, next],
      });
    }
  }

  while (queue.length > 0) {
    let { node, depth, seen, path } = queue.shift();
    if (success(node) && path.length <= sols.len) {
      console.log(path);
      sols.num++;
      sols.len = path.length;
      continue;
    }
    if (!valid(node)) continue;

    for (let next of possibleMoves(node)) {
      if (!seen.has(JSON.stringify(next))) {
        seen.add(JSON.stringify(next));
        queue.push({
          node: next,
          depth: depth + " ",
          seen: new Set(seen),
          path: [...path, next],
        });
      }
    }
  }

  return sols;
}

console.log(search(root));

// Implementation
function success(node) {
  return Object.values(node).every((i) => i == "right" || i == "going");
}

function valid(node) {
  return !(node.fox == node.chicken || node.chicken == node.grain);
}

function possibleMoves(node) {
  // Update going/coming items
  for (let item in node) {
    if (node[item] == "going" || node[item] == "coming")
      node[item] = transitions[node[item]];
  }

  // The farmer can pick to bring anything on his side or nothing
  let items = Object.keys(node).filter((i) => node[i] == node.farmer);

  function move(item) {
    return Object.assign({}, node, {
      [item]: transitions[node[item]],
      farmer: swapSide[node.farmer],
    });
  }

  return items.map((item) => move(item));
}
