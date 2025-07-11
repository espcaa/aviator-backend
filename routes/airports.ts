import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
const jwtSecret = JWT_SECRET as string;
import { Database } from "bun:sqlite";
import type { Router } from "../router";

const db = new Database("airports.db");

export function registerAirportsRoutes(router: Router) {
  router.post("/api/airports/getAirports", async (req: Request) => {
    try {
      const { sessionToken, searchString, searchLimit } = await req.json();
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
            error: "Invalid session token",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Fetch airports data based on searchString and searchLimit
      const airportsData = await fetchAirportsData(searchString, searchLimit);

      return new Response(JSON.stringify({ airports: airportsData }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error in getAirports route:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
  router.post("/api/airports/isCodeValid", async (req: Request) => {
    try {
      const { code }: { code: string } = await req.json();
      if (!code) {
        return new Response(JSON.stringify({ message: "Code is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const airport = db
        .query("SELECT * FROM airport WHERE iata = ?")
        .get(code.toUpperCase());

      if (airport) {
        return new Response(JSON.stringify({ exists: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({ exists: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(
        JSON.stringify({ message: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  });
  router.post("/api/airports/getAirportLocation", async (req: Request) => {
    try {
      const { code }: { code: string } = await req.json();
      if (!code) {
        return new Response(
          JSON.stringify({ exist: false, message: "Code is required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const airport: any = db
        .query("SELECT * FROM airport WHERE iata = ?")
        .get(code.toUpperCase());

      if (airport) {
        return new Response(
          JSON.stringify({
            exists: true,
            location: {
              latitude: airport.lat,
              longitude: airport.lon,
            },
            message: "Airport found",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      } else {
        return new Response(JSON.stringify({ exists: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(
        JSON.stringify({ message: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  });
}

async function fetchAirportsData(searchString: string, searchLimit: number) {
  const query = db.query(`
  SELECT * FROM airport
  WHERE name LIKE ? OR iata LIKE ?
  ORDER BY name ASC
`);

  // Make another one to check if a code perfectly matches
  const exactCodeQuery = db.query(`
  SELECT * FROM airport
  WHERE iata = ?
`);

  // Execute the query with the searchString parameter
  let result = query.all(`%${searchString}%`, `%${searchString}%`);
  // Check if the searchString is a perfect match for a code (put it in caps if it isn't already)
  const exactCodeResult = exactCodeQuery.get(searchString.toUpperCase());
  type AirportResult = {
    id: number;
    name: string;
    iata: string;
    country: string;
  };
  const exactCodeTypedResult = exactCodeResult as AirportResult | undefined;
  console.log("Exact code result:", exactCodeTypedResult?.iata);

  if (exactCodeTypedResult) {
    // First remove this exactCodeTypedResult if it exists in the result
    result = result.filter(
      (airport: any) => airport.iata !== exactCodeTypedResult.iata,
    );
    // Push the result as first element
    result.unshift(exactCodeTypedResult);
  }

  if (searchLimit && searchLimit > 0) {
    result = result.slice(0, searchLimit);
  }

  return result.map((airport: any) => ({
    id: airport.id,
    name: airport.name,
    code: airport.iata,
    country: airport.country,
  }));
}
