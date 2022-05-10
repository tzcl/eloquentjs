import { createServer } from "http";
import { readFile, writeFile } from "fs/promises";
import serve_handler from "serve-handler";
import Router from "./router.js";

const router = new Router();
const defaultHeaders = { "Content-Type": "text/plain" };

// Set up routes

router.add("GET", /^\/talks$/, async (server, req) => {
  let tag = /"(.*)"/.exec(req.headers["if-none-match"]);
  let wait = /\bwait=(\d+)/.exec(req.headers["prefer"]);
  if (!tag || tag[1] != server.version) {
    return server.talkResponse();
  } else if (!wait) {
    return { status: 304 };
  } else {
    return server.waitForChanges(Number(wait[1]));
  }
});

const talkPath = /^\/talks\/([^\/]+)$/;

router.add("GET", talkPath, async (server, title) => {
  if (title in server.talks) {
    return {
      body: JSON.stringify(server.talks[title]),
      headers: { "Content-Type": "application/json" },
    };
  } else {
    return { status: 404, body: `No talk '${title}' found` };
  }
});

router.add("DELETE", talkPath, async (server, title) => {
  if (title in server.talks) {
    delete server.talks[title];
    server.updated(); //  notifies long-polling requests
  }

  return { status: 204 };
});

function readStream(stream) {
  return new Promise((resolve, reject) => {
    let data = "";
    stream.on("error", reject);
    stream.on("data", (chunk) => (data += chunk.toString()));
    stream.on("end", () => resolve(data));
  });
}

router.add("PUT", talkPath, async (server, title, req) => {
  let body = await readStream(req);
  let talk;
  try {
    talk = JSON.parse(body);
  } catch (_) {
    return { status: 400, body: "Invalid JSON" };
  }

  if (
    !talk ||
    typeof talk.presenter != "string" ||
    typeof talk.summary != "string"
  ) {
    return { status: 400, body: "Bad talk data" };
  }

  server.talks[title] = {
    title,
    presenter: talk.presenter,
    summary: talk.summary,
    comments: [],
  };
  server.updated();
  return { status: 204 };
});

router.add(
  "POST",
  /^\/talks\/([^\/]+)\/comments$/,
  async (server, title, req) => {
    let body = await readStream(req);
    let comment;
    try {
      comment = JSON.parse(body);
    } catch (_) {
      return { status: 400, body: "Invalid JSON" };
    }

    if (
      !comment ||
      typeof comment.author != "string" ||
      typeof comment.message != "string"
    ) {
      return { status: 400, body: "Bad comment data" };
    } else if (title in server.talks) {
      server.talks[title].comments.push(comment);
      server.updated();
      return { status: 204 };
    } else {
      return { status: 404, body: `No talk '${title}' found` };
    }
  }
);

// Server code

const filePath = "data.json";

async function loadTalks(file = filePath) {
  let data;
  try {
    data = JSON.parse(await readFile(file, { encoding: "utf-8" }));
  } catch (err) {
    data = {};
  }

  // Need to do this to remove the prototype
  // If not, we wouldn't be able to use the 'in' operator safely
  return Object.assign(Object.create(null), data);
}

class SkillShareServer {
  constructor(talks) {
    this.talks = talks;
    this.version = 0;
    this.waiting = [];

    this.server = createServer((req, res) => {
      let resolved = router.resolve(this, req);
      if (resolved) {
        resolved
          .catch((err) => {
            if (err.status != null) return err;
            return { body: String(err), status: 500 };
          })
          .then(({ body, status = 200, headers = defaultHeaders }) => {
            res.writeHead(status, headers);
            res.end(body);
          });
      } else {
        // serve out of the public folder
        serve_handler(req, res, { public: "public" });
      }
    });
  }

  start(port) {
    this.server.listen(port);
  }

  stop() {
    this.server.close;
  }

  talkResponse() {
    let talks = [];
    for (let title of Object.keys(this.talks)) {
      talks.push(this.talks[title]);
    }

    let res = {
      body: JSON.stringify(talks),
      headers: {
        "Content-Type": "application/json",
        ETag: `"${this.version}"`,
        "Cache-Control": "no-store",
      },
    };
    return res;
  }

  waitForChanges(time) {
    return new Promise((resolve) => {
      this.waiting.push(resolve);
      setTimeout(() => {
        if (!this.waiting.includes(resolve)) return;
        this.waiting = this.waiting.filter((r) => r != resolve);
        resolve({ status: 304 });
      }, time * 1000);
    });
  }

  updated() {
    this.version++;
    let res = this.talkResponse();
    this.waiting.forEach((resolve) => resolve(res));
    this.waiting = [];

    writeFile(filePath, JSON.stringify(this.talks), (err) => {
      if (err) throw err;
    });
  }
}

// Start the server

new SkillShareServer(await loadTalks()).start(8000);
