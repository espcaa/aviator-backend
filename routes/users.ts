/// <reference lib="dom" />

import type { Router } from "../router";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "../utils/database";
import { sanitizePassword } from "../utils/sanitize"; // Ai, prob will break

const emailRateLimitMap = new Map<string, number[]>();

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
      const {
        email,
        password,
        full_name,
      }: { email: string; password: string; full_name: string } =
        await req.json();

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      let fixedfullname = full_name || "";

      if (!full_name && email) {
        // Generate it with the email
        //@ts-ignore
        const nameParts = email.split("@")[0].split(".");
        if (nameParts.length > 1) {
          // Join the parts with a space
          fixedfullname = nameParts.join(" ");
        } else {
          // Use the email prefix as the full name
          fixedfullname = nameParts[0] as string;
        }
      }

      let sanitizedPassword = sanitizePassword(password);
      console.log("Sanitized password:", sanitizedPassword);

      // Check if email is already registered
      const { data: existingUsers, error: fetchError } = await supabase
        .from("users")
        .select("email")
        .eq("email", email)
        .limit(1);
      if (fetchError) {
        return new Response(
          JSON.stringify({
            error: "Failed to check existing users",
            details: fetchError.message,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
      if (existingUsers && existingUsers.length > 0) {
        return new Response(
          JSON.stringify({ error: "Email already registered" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      // Remove any strange characters from the password like leading/trailing spaces
      let sanpassword = password.trim();
      if (!sanpassword || sanpassword.length < 8) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 8 characters" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      // Hash the password

      const hashedPassword = await hashPassword(sanitizedPassword as string);

      const { error } = await supabase.from("users").insert([
        {
          email,
          password_hash: hashedPassword,
          full_name: fixedfullname,
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
