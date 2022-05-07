import { createServer } from "http";
import { parse } from "url";
import { resolve, sep } from "path";
import { createReadStream, createWriteStream } from "fs";
import { stat, readdir, mkdir, rmdir, unlink } from "fs/promises";
import mime from "mime";

const baseDirectory = process.cwd();

// Make sure we don't expose our whole filesystem
function urlPath(url) {
  let { pathname } = parse(url);
  let path = resolve(decodeURIComponent(pathname).slice(1));
  if (path != baseDirectory && !path.startsWith(baseDirectory + sep)) {
    throw { status: 403, body: "Forbidden" };
  }

  return path;
}

const methods = Object.create(null);

methods.GET = async function (req) {
  let path = urlPath(req.url);
  let stats;
  try {
    stats = await stat(path);
  } catch (err) {
    if (err.code == "ENOENT") return { status: 404, body: "File not found!" };
    else throw err;
  }

  if (stats.isDirectory()) {
    return { body: (await readdir(path)).join("\n") };
  } else {
    return { body: createReadStream(path), type: mime.getType(path) };
  }
};

methods.DELETE = async function (req) {
  let path = urlPath(req.url);
  let stats;
  try {
    stats = await stat(path);
  } catch (err) {
    if (err.code == "ENOENT") return { status: 204 };
    else throw err;
  }

  if (stats.isDirectory()) await rmdir(path);
  else await unlink(path);
  return { status: 204 };
};

function pipeStream(from, to) {
  return new Promise((resolve, reject) => {
    from.on("error", reject);
    to.on("error", reject);
    to.on("finish", resolve);
    from.pipe(to);
  });
}

methods.PUT = async function (req) {
  let path = urlPath(req.url);
  await pipeStream(req, createWriteStream(path));
  return { status: 204 };
};

methods.MKCOL = async function (req) {
  let path = urlPath(req.url);
  let stats;
  try {
    stats = await stat(path);
  } catch (err) {
    if (err.code == "ENOENT") {
      await mkdir(path);
      return { status: 204 };
    } else throw err;
  }

  if (stats.isDirectory()) return { status: 204 };
  else return { status: 409, body: "Not a directory" };
};

async function notAllowed(req) {
  return {
    status: 405,
    body: `Method ${req.method} not allowed.`,
  };
}

createServer((req, res) => {
  let handler = methods[req.method] || notAllowed;
  handler(req)
    .catch((err) => {
      if (err.status != null) return err;
      return { body: String(err), status: 500 };
    })
    .then(({ body, status = 200, type = "text/plain" }) => {
      res.writeHead(status, { "Content-Type": type });
      if (body && body.pipe) body.pipe(res);
      else res.end(body);
    });
}).listen(8000);
