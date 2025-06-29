import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
const jwtSecret = JWT_SECRET as string;
import type { Router } from "../router";
import { supabase } from "../utils/database";

function registerFlightRoutes(router: Router) {
  router.post("/api/flights/createFlight", async (req: Request) => {
    try {
      const { sessionToken, departureCode, arrivalCode, departureDate } =
        await req.json();
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

      supabase.from("flights").insert({
        user_id: payload.userId,
        departure_code: departureCode,
        arrival_code: arrivalCode,
        date: departureDate,
        duration: 0.0,
      });

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
}
