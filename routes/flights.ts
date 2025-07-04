import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
const jwtSecret = JWT_SECRET as string;
import type { Router } from "../router";
import { Database } from "bun:sqlite";
import { supabase } from "../utils/database";
import { getGpsCoordinates } from "../utils/gps";

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
        console.log("Session token is required");
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

      // Get the airports coordinates from the database

      let resultDeparture = await getGpsCoordinates(departureCode);
      let resultArrival = await getGpsCoordinates(arrivalCode);

      if (!resultDeparture.exists || !resultArrival.exists) {
        console.error(
          "One or both airport codes are invalid:",
          departureCode,
          arrivalCode,
        );
        return new Response(
          JSON.stringify({
            message: {
              departure: resultDeparture.exists
                ? "Arrival airport code is invalid"
                : "Departure airport code is invalid",
            },
            success: false,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
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
        departure_airport_lon: resultDeparture.location?.longitude,
        departure_airport_lat: resultDeparture.location?.latitude,
        arrival_airport_lon: resultArrival.location?.longitude,
        arrival_airport_lat: resultArrival.location?.latitude,
      });

      if (error) {
        console.error("Error inserting flight into Supabase:", error);
      } else {
        console.log("Flight inserted successfully into Supabase.");
      }
      // Get the flight id from the supabase

      const { data: flightData, error: flightError } = await supabase
        .from("flights")
        .select("id")
        .eq("user_id", payload.userId)
        .eq("departure_airport_code", departureCode)
        .eq("arrival_airport_code", arrivalCode)
        .eq("date", departureDate)
        .eq("airline", airlineCode)
        .single();
      if (flightError || !flightData) {
        console.error("Error fetching flight id:", flightError);
        return new Response(
          JSON.stringify({
            message: "Error fetching flight id",
            success: false,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          message: "Flight created successfully",
          success: true,
          positions: {
            departure: {
              lat: resultDeparture.location?.latitude,
              lon: resultDeparture.location?.longitude,
            },
            arrival: {
              lat: resultArrival.location?.latitude,
              lon: resultArrival.location?.longitude,
            },
          },
          duration: 0.0,
          flightId: flightData.id,
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

      const flightAnswers: FlightAnswer[] = await Promise.all(
        flights.map(async (flight) => {
          const departureCoords = await getGpsCoordinates(
            flight.departure_airport_code,
          );
          const arrivalCoords = await getGpsCoordinates(
            flight.arrival_airport_code,
          );

          return {
            flightId: flight.id,
            airlineCode: flight.airline,
            departureCode: flight.departure_airport_code,
            arrivalCode: flight.arrival_airport_code,
            departureDate: flight.date,
            duration: flight.duration,
            departureAirportLat: departureCoords.location?.latitude,
            departureAirportLon: departureCoords.location?.longitude,
            arrivalAirportLat: arrivalCoords.location?.latitude,
            arrivalAirportLon: arrivalCoords.location?.longitude,
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
      console.log("Error in getFlights route:", error);
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
