// Get a token in exchange of a session token :)

import type { Router } from "../router";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) {
  throw new Error("MAPBOX_TOKEN is not defined");
}
import jwt from "jsonwebtoken";
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

      // Verify the session token

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

      // Token is valid, call mapbox to get a nice map read token!
      const expirationDate = new Date(Date.now() + 3600000);

      await tokensService
        .createTemporaryToken({
          // This is a read-only token for map access
          scopes: ["styles:read", "tilesets:read"],
          // 1 hour expiry
          expires: expirationDate.toISOString(),
        })
        .send()
        .then((response: any) => {
          const token = response.body;
          return new Response(JSON.stringify({ token: token.token }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        });

      // If this failed, then send a server error response

      return new Response(
        JSON.stringify({ error: "Failed to generate map token" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.log(error);
      return new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}
