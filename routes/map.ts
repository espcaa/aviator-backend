// This route provides a map token using Mapbox and a verified session token.

import type { Router } from "../router";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) {
  throw new Error("MAPBOX_TOKEN is not defined");
}

const jwtSecret = JWT_SECRET as string;

const mbxClient = require("@mapbox/mapbox-sdk");
const tokenClient = require("@mapbox/mapbox-sdk/services/tokens");

const baseClient = mbxClient({ accessToken: MAPBOX_TOKEN });
const tokensService = tokenClient(baseClient);

export function registerMapRoutes(router: Router) {
  router.post("/api/maps/getToken", async (req: Request) => {
    try {
      const { sessionToken } = await req.json();
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: "Session token is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      let payload;
      try {
        payload = jwt.verify(sessionToken, jwtSecret) as {
          userId: string;
          email: string;
          session: boolean;
        };
        if (!payload.session) {
          return new Response(
            JSON.stringify({ error: "Invalid session token" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }
      } catch (error) {
        console.error("Invalid session token:", error);
        return new Response(
          JSON.stringify({ error: "Invalid session token" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Generate a temporary Mapbox token valid for 1 hour
      const expirationDate = new Date(Date.now() + 3600000);
      const tokenResponse = await tokensService
        .createTemporaryToken({
          scopes: ["styles:read", "tilesets:read"],
          expires: expirationDate.toISOString(),
        })
        .send();

      if (tokenResponse?.body?.token) {
        return new Response(
          JSON.stringify({ token: tokenResponse.body.token }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to generate map token" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("Server error:", error);
      return new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}
