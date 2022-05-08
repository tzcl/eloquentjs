import { parse } from "url";

class Router {
  constructor() {
    this.routes = [];
  }

  add(method, url, handler) {
    this.routes.push({ method, url, handler });
  }

  resolve(context, req) {
    let path = parse(req.url).pathname;

    for (let { method, url, handler } of this.routes) {
      let match = url.exec(path);
      if (!match || req.method != method) continue;
      let urlParts = match.slice(1).map(decodeURIComponent);
      return handler(context, ...urlParts, req);
    }

    return null;
  }
}

export default Router;
