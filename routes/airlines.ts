import type { Router } from "../router";
import { Database } from "bun:sqlite";

import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
const jwtSecret = JWT_SECRET as string;

export function registerAirlinesRoutes(router: Router) {
  router.post("/api/airlines/getAirlines", async (req: Request) => {
    try {
      const { sessionToken, searchString, searchlimit } = await req.json();
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
          JSON.stringify({
            error: "Invalid session token aaa idk why random error",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Fetch airlines data from the database or external API
      const airlinesData = await fetchAirlinesData(searchString, searchlimit);

      return new Response(JSON.stringify({ airlines: airlinesData }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Server error:", error);
      return new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}

// Fetch data from sqlite airlines.db

async function fetchAirlinesData(searchString: string, searchLimit: number) {
  const db = new Database("airlines.db");

  // Prepare the query with placeholders for parameters
  const query = db.query(`
    SELECT * FROM airlines
    WHERE name LIKE ? OR code LIKE ?
    ORDER BY name ASC
  `);

  // Execute the query with the searchString parameter
  const result = query.all(`%${searchString}%`, `%${searchString}%`);

  // Return only the first {searchLimit} results
  if (searchLimit > 0) {
    return result.slice(0, searchLimit);
  } else {
    return result;
  }
}
