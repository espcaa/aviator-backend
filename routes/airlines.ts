import type { Router } from "../router";
import { Database } from "bun:sqlite";

import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
import { readdir } from "node:fs/promises";
const jwtSecret = JWT_SECRET as string;
let validLogos = new Set<string>();
readdir("./logos")
  .then((files) => {
    validLogos = new Set(
      files.map((file) => file.replace(".png", "").toUpperCase()),
    );
  })
  .catch((error) => {
    console.error("Error reading logos directory:", error);
  });

const db = new Database("airlines.db");

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
            JSON.stringify({ error: "Session token is invalid or expired" }),
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

async function fetchAirlinesData(searchString: string, searchLimit: number) {
  // Prepare the query with placeholders for parameters
  const query = db.query(`
    SELECT * FROM airline
    WHERE name LIKE ? OR code LIKE ?
    ORDER BY name ASC
  `);

  // Make another one to check if a code perfectly matches
  const exactCodeQuery = db.query(`
    SELECT * FROM airline
    WHERE code = ?
  `);

  // Execute the query with the searchString parameter
  let result = query.all(`%${searchString}%`, `%${searchString}%`);
  // Check if the searchString is a perfect match for a code (put it in caps if it isn't already)
  const exactCodeResult = exactCodeQuery.get(searchString.toUpperCase());
  type AirlineResult = {
    id: number;
    name: string;
    code: string;
    country: string;
  };
  const exactCodeTypedResult = exactCodeResult as AirlineResult | undefined;
  console.log("Exact code result:", exactCodeTypedResult?.code);

  // Only keep airlines that either have a logo or are the exact match we're looking for
  result = result.filter((airline: any) => {
    return hasLogo(airline.code);
  });

  if (exactCodeTypedResult) {
    if (hasLogo(exactCodeTypedResult.code)) {
      // First remove this exactCodeTypedResult if it exists in the result
      result = result.filter(
        (airline: any) => airline.code !== exactCodeTypedResult.code,
      );
      result.push(exactCodeTypedResult);
    }
  }

  // Limit the results if searchLimit is provided
  if (searchLimit && searchLimit > 0) {
    result = result.slice(0, searchLimit);
  }

  // Map the results to a more structured format
  return result.map((airline: any) => ({
    id: airline.id,
    name: airline.name,
    code: airline.code,
    country: airline.country,
    hasLogo: hasLogo(airline.code),
  }));
}

function hasLogo(icao: string) {
  if (icao == undefined || icao === null) {
    return false;
  }
  return validLogos.has(icao.toUpperCase());
}
