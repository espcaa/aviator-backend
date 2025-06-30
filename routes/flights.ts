import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
const jwtSecret = JWT_SECRET as string;
import type { Router } from "../router";
import { Database } from "bun:sqlite";
import { supabase } from "../utils/database";

type FlightAnswer = {
  flightId: string;
  departureCode: string;
  arrivalCode: string;
  departureDate: string;
  duration: number;
  departureAirportLat: number;
  departureAirportLon: number;
  arrivalAirportLat: number;
  arrivalAirportLon: number;
};

export function registerFlightRoutes(router: Router) {
  router.post("/api/flights/createFlight", async (req: Request) => {
    try {
      const {
        sessionToken,
        departureCode,
        arrivalCode,
        departureDate,
        airlineCode,
      } = await req.json();
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ message: "Session token is required" }),
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
            JSON.stringify({
              message: "Invalid session token",
              success: false,
            }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }
      } catch (error) {
        console.error("Invalid session token:", error);
        return new Response(
          JSON.stringify({
            message: "Invalid session token",
            success: false,
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Create the flight in the supabase

      if (airlineCode === "null") {
        return new Response(
          JSON.stringify({
            message: "Airline is required",
            success: false,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const { error } = await supabase.from("flights").insert({
        user_id: payload.userId,
        departure_airport_code: departureCode,
        arrival_airport_code: arrivalCode,
        date: departureDate,
        duration: 0.0,
        airline: airlineCode,
      });

      if (error) {
        console.error("Error inserting flight into Supabase:", error);
      } else {
        console.log("Flight inserted successfully into Supabase.");
      }

      return new Response(
        JSON.stringify({
          message: "Flight created successfully",
          success: true,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Error in createFlight route:", error);
      return new Response(
        JSON.stringify({ message: "Internal server error", success: false }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  });
  router.post("/api/flights/getFlights", async (req: Request) => {
    try {
      const { sessionToken } = await req.json();

      // Get the user id from the session token
      let payload;
      try {
        payload = jwt.verify(sessionToken, jwtSecret) as {
          userId: string;
          email: string;
          session: boolean;
        };
        if (!payload.session) {
          return new Response(
            JSON.stringify({
              message: "Invalid session token",
              success: false,
            }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }
      } catch (error) {
        console.error("Invalid session token:", error);
        return new Response(
          JSON.stringify({
            message: "Invalid session token",
            success: false,
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Fetch flights from the supabase
      const { data: flights, error } = await supabase
        .from("flights")
        .select("*")
        .eq("user_id", payload.userId);
      if (error) {
        console.error("Error fetching flights:", error);
        return new Response(
          JSON.stringify({ message: "Error fetching flights", success: false }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      // Map the flights to the required format
      const flightAnswers: FlightAnswer[] = await Promise.all(
        flights.map(async (flight) => {
          const departureCoords = await getAirportCoordinatesFromCode(
            flight.departure_code,
          );
          const arrivalCoords = await getAirportCoordinatesFromCode(
            flight.arrival_code,
          );

          return {
            flightId: flight.id,
            departureCode: flight.departure_code,
            arrivalCode: flight.arrival_code,
            departureDate: flight.date,
            duration: flight.duration,
            departureAirportLat: departureCoords.lat,
            departureAirportLon: departureCoords.lon,
            arrivalAirportLat: arrivalCoords.lat,
            arrivalAirportLon: arrivalCoords.lon,
          };
        }),
      );

      return new Response(
        JSON.stringify({ flights: flightAnswers, success: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ message: "Internal server error", success: false }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  });
  router.post("/api/flights/deleteFlight", async (req: Request) => {
    try {
      const { sessionToken, flightId } = await req.json();
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ message: "Session token is required" }),
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
            JSON.stringify({
              message: "Invalid session token",
              success: false,
            }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }
      } catch (error) {
        console.error("Invalid session token:", error);
        return new Response(
          JSON.stringify({
            message: "Invalid session token",
            success: false,
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Delete the flight from the supabase
      const { error } = await supabase
        .from("flights")
        .delete()
        .eq("id", flightId)
        .eq("user_id", payload.userId);
      if (error) {
        console.error("Error deleting flight:", error);
        return new Response(
          JSON.stringify({ message: "Error deleting flight", success: false }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          message: "Flight deleted successfully",
          success: true,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Error in deleteFlight route:", error);
      return new Response(
        JSON.stringify({ message: "Internal server error", success: false }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  });
}

interface AirportCoordinates {
  latitude: number;
  longitude: number;
}

function getAirportCoordinatesFromCode(
  airportCode: string,
): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    try {
      const db = new Database("airports.db");
      const row = db
        .query<
          AirportCoordinates,
          [string]
        >("SELECT latitude, longitude FROM airport WHERE iata_code = ?")
        .get(airportCode);

      if (!row) {
        return reject(new Error(`Airport code ${airportCode} not found`));
      }

      resolve({ lat: row.latitude, lon: row.longitude });
    } catch (error) {
      reject(error);
    }
  });
}
