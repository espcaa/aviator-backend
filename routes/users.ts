/// <reference lib="dom" />

import type { Router } from "../router";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "../utils/database";

const emailRateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string, limit = 5, windowMs = 2_000): boolean {
  const now = Date.now();
  const timestamps = emailRateLimitMap.get(ip) || [];

  // Filter out timestamps older than windowMs
  const recentTimestamps = timestamps.filter((ts) => now - ts < windowMs);
  emailRateLimitMap.set(ip, recentTimestamps);

  if (recentTimestamps.length >= limit) {
    return true; // rate limited
  }

  recentTimestamps.push(now);
  emailRateLimitMap.set(ip, recentTimestamps);
  return false;
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
const jwtSecret = JWT_SECRET as string;

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

function registerUserRoutes(router: Router) {
  // User registration route
  router.post("/api/users/createUser", async (req: Request) => {
    try {
      const { email, password }: { email: string; password: string } =
        await req.json();

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const hashedPassword = await hashPassword(password);

      const { error } = await supabase.from("users").insert([
        {
          email,
          password_hash: hashedPassword,
        },
      ]);

      if (error) {
        return new Response(
          JSON.stringify({
            error: "Failed to create user",
            details: error.message,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ message: "User created successfully" }),
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

  // User login route
  router.post("/api/login", async (req: Request) => {
    try {
      const { email, password }: { email: string; password: string } =
        await req.json();

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      // Fetch user from the database
      const { data: users, error } = await supabase
        .from("users")
        .select("email, password")
        .eq("email", email)
        .limit(1);

      if (error || !users || users.length === 0) {
        return new Response(
          JSON.stringify({ error: "Invalid email or password" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      const user = users[0];

      // Verify the password

      if (!user) {
        // Handle user being undefined, e.g., return an error or throw an exception
        throw new Error("User not found");
      }

      const isPasswordValid = await verifyPassword(password, user.password);

      if (!isPasswordValid) {
        return new Response(
          JSON.stringify({ error: "Invalid email or password" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Generate JWT token
      const token = jwt.sign({ email: user.email }, jwtSecret, {
        expiresIn: "1h", // Token expiration time
      });

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
  router.get("/api/users/checkEmail", async (req: Request) => {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    console.log("IP address:", ip);
    console.log("Email to check:", email);

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Apply rate limiting
    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({ error: "Too many requests, please try again later." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "2", // seconds
          },
        },
      );
    }

    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (error) {
      return new Response(
        JSON.stringify({ error: "Database error", details: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const available = !data || data.length === 0;
    console.log("Email availability:", available);

    return new Response(JSON.stringify({ available }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

export { registerUserRoutes };
