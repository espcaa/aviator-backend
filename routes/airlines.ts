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
  const exactCodeTypedResult = exactCodeResult as AirlineResult | undefined;

  // Define the struct for a db result
  type AirlineResult = {
    id: number;
    name: string;
    code: string;
    country: string;
  };

  if (exactCodeTypedResult) {
    // Remove exactCodeResult from the result if it exists
    result = result.filter(
      (airline: any) => airline.code !== exactCodeTypedResult.code,
    );
  }

  // Check each result to ensure it has a logo
  result = result.filter((airline: any) => {
    if (airline.code) {
      const hasAirlineLogo = hasLogo(airline.code);
      if (hasAirlineLogo) {
        return true; // Keep this airline in the results
      } else {
        console.warn(`No logo found for airline code: ${airline.code}`);
        return false; // Exclude this airline from the results
      }
    }
  });

  // Filter by icao if it doesnt have the right format
  result = result.filter((airline: any) => {
    const icaoRegex = /^[A-Z]{4}$/;
    return icaoRegex.test(airline.code);
  });

  // Return only the first {searchLimit} results
  if (searchLimit > 0) {
    // If the searchString is a perfect match for a code, return that result first
    if (exactCodeResult) {
      return [exactCodeResult, ...result].slice(0, searchLimit);
    }
    return result.slice(0, searchLimit);
  } else {
    return result;
  }
}

function hasLogo(icao: string) {
  const logoPath = `./logos/${icao.toLowerCase()}.png`;
  try {
    return Bun.file(logoPath).exists();
  } catch (error) {
    console.error(`Error checking logo for ${icao}:`, error);
    return false;
  }
}
