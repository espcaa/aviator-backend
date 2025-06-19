/// <reference lib="dom" />
import type { HttpMethod, RouteHandler, Routes } from "./types";

export class Router {
  routes: Routes = {
    GET: new Map(),
    POST: new Map(),
    PUT: new Map(),
    DELETE: new Map(),
  };

  get(path: string, handler: RouteHandler): Router {
    this.routes.GET.set(path, handler);
    return this;
  }

  post(path: string, handler: RouteHandler): Router {
    this.routes.POST.set(path, handler);
    return this;
  }

  put(path: string, handler: RouteHandler): Router {
    this.routes.PUT.set(path, handler);
    return this;
  }

  delete(path: string, handler: RouteHandler): Router {
    this.routes.DELETE.set(path, handler);
    return this;
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method as HttpMethod;

    // Check for exact route match
    const handler = this.routes[method]?.get(path);

    if (handler) {
      return await handler(req);
    }

    // Check for parameterized routes
    for (const [routePath, routeHandler] of this.routes[method]?.entries() ||
      []) {
      if (this.matchRoute(path, routePath)) {
        return await routeHandler(req);
      }
    }

    return new Response(JSON.stringify({ message: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  matchRoute(path: string, routePath: string): boolean {
    if (routePath === path) return true;

    const routeParts = routePath.split("/");
    const pathParts = path.split("/");

    if (routeParts.length !== pathParts.length) return false;

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i]!.startsWith(":")) continue; // using ! to assert non-null
      if (routeParts[i]! !== pathParts[i]) return false;
    }

    return true;
  }
}
