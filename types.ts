export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
export type RouteHandler = (req: Request) => Promise<Response> | Response;
export type RoutesMap = Map<string, RouteHandler>;

export interface Routes {
  GET: RoutesMap;
  POST: RoutesMap;
  PUT: RoutesMap;
  DELETE: RoutesMap;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  inStock: boolean;
}
