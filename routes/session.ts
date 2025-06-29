import type { Router } from "../router";
import bcrypt from "bcrypt";

// Load the jwt token + lib
import jwt from "jsonwebtoken";
import { supabase } from "../utils/database";
import { sanitizePassword } from "../utils/sanitize";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
const jwtSecret = JWT_SECRET as string;

export function registerSessionRoutes(router: Router) {
  router.post("/api/sessions/getRefreshToken", async (req: Request) => {
    try {
      const { email, password }: { email: string; password: string } =
        await req.json();

      if (!email || !password) {
        return new Response(
          JSON.stringify({
            message: "Email and password are required",
            token: null,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, email, password_hash")
        .eq("email", email)
        .single();
      if (userError || !user) {
        console.error("User not found or error fetching user:", userError);
        return new Response(
          JSON.stringify({ message: "Invalid email or password", token: null }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      const isPasswordValid = await bcrypt.compare(
        sanitizePassword(password) as string,
        user.password_hash,
      );
      if (!isPasswordValid) {
        return new Response(
          JSON.stringify({ message: "Invalid email or password", token: null }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, refresher: true },
        jwtSecret,
        {
          expiresIn: "30d",
        },
      );
      console.log("Generated refresh token for user:", token);

      return new Response(
        JSON.stringify({ message: "Login successful", token }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(
        JSON.stringify({
          message: "Internal server error",
          token: null,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  });
  router.post("/api/sessions/login", async (req: Request) => {
    try {
      const { refreshToken }: { refreshToken: string } = await req.json();
      if (!refreshToken) {
        return new Response(
          JSON.stringify({
            message: "Refresh token is required",
            token: null,
            success: false,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      console.log("Received refresh token:", refreshToken);

      let decoded;
      try {
        decoded = jwt.verify(refreshToken, jwtSecret) as {
          userId: string;
          email: string;
          refresher: boolean;
        };
      } catch (err) {
        console.error("Invalid refresh token:", err);
        return new Response(
          JSON.stringify({
            message: "Invalid refresh token",
            token: null,
            success: false,
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      if (!decoded.refresher) {
        console.error(
          "Refresh token is not valid for session refresh",
          decoded,
        );
        return new Response(
          JSON.stringify({
            message: "Invalid refresh token",
            token: null,
            success: false,
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      const accessToken = jwt.sign(
        { userId: decoded.userId, email: decoded.email, session: true },
        jwtSecret,
        {
          expiresIn: "1h",
        },
      );

      return new Response(
        JSON.stringify({
          message: "Login successful",
          token: accessToken,
          success: true,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          details: message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  });
}
