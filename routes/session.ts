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
  // Session creation route
  router.post("/api/sessions/getRefreshToken", async (req: Request) => {
    try {
      const { email, password }: { email: string; password: string } =
        await req.json();

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      // Fetch user from database
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, email, password_hash")
        .eq("email", email)
        .single();
      if (userError || !user) {
        console.error("User not found or error fetching user:", userError);
        return new Response(
          JSON.stringify({ error: "Invalid email or password" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      // Verify password
      const isPasswordValid = await bcrypt.compare(
        sanitizePassword(password) as string,
        user.password_hash,
      );
      if (!isPasswordValid) {
        console.error("Invalid password for user:", email);
        console.error("User data:", user);
        console.error("Password hash:", user.password_hash);
        console.error("Provided password:", password);
        console.error("Password verification failed");
        return new Response(
          JSON.stringify({ error: "Invalid email or password" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Generate a jwt token

      const token = jwt.sign(
        { userId: user.id, email: user.email, refresher: true },
        jwtSecret,
        {
          expiresIn: "1m",
        },
      );

      return new Response(
        JSON.stringify({ message: "Login successful", token }),
        { status: 200, headers: { "Content-Type": "application/json" } },
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
  router.post("/api/sessions/refresh", async (req: Request) => {
    try {
      const { token }: { token: string } = await req.json();

      if (!token) {
        return new Response(JSON.stringify({ error: "Token is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify the token
      const decoded = jwt.verify(token, jwtSecret);
      if (!decoded || typeof decoded === "string") {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify if the token is a refresher

      if (!(decoded as any).refresher) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Generate a new token
      const newToken = jwt.sign(
        { userId: (decoded as any).userId, email: (decoded as any).email },
        jwtSecret,
        {
          expiresIn: "1h",
        },
      );

      return new Response(
        JSON.stringify({
          message: "Token refreshed successfully",
          token: newToken,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
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
