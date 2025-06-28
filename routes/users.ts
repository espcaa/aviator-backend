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
  router.post("/api/users/createUser", async (req: Request) => {
    try {
      const {
        email,
        password,
        full_name,
        otp,
      }: { email: string; password: string; full_name: string; otp: string } =
        await req.json();

      if (!email || !password) {
        return new Response(JSON.stringify({ message: "Missing fields" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("otp")
        .select("*")
        .eq("email", email)
        .order("created_at", { ascending: false });

      if (error || !data) {
        return new Response(JSON.stringify({ message: "Invalid OTP" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      console.log("Expected otp: " + String(data[0].otp));
      console.log("Provided otp: " + String(otp));

      if (String(data[0].otp) !== String(otp)) {
        return new Response(JSON.stringify({ message: "Invalid OTP" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { error: deleteError } = await supabase
        .from("otp")
        .delete()
        .eq("email", email)
        .eq("otp", otp);

      if (deleteError) {
        return new Response(
          JSON.stringify({ message: "Failed to delete OTP" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      let fixedfullname = full_name || "";

      if (!full_name && email) {
        //@ts-ignore
        const nameParts = email.split("@")[0].split(".");
        if (nameParts.length > 1) {
          fixedfullname = nameParts.join(" ");
        } else {
          fixedfullname = nameParts[0] as string;
        }
      }

      let sanitizedPassword = sanitizePassword(password);
      if (sanitizePassword === null) {
        console.log("Password sanitization failed");
        return new Response(
          JSON.stringify({ message: "Your password isn't valid" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      console.log("Sanitized password:", sanitizedPassword);

      const { data: existingUsers, error: fetchError } = await supabase
        .from("users")
        .select("email")
        .eq("email", email)
        .limit(1);
      if (fetchError) {
        return new Response(
          JSON.stringify({
            message: "Failed to check existing users",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
      if (existingUsers && existingUsers.length > 0) {
        return new Response(
          JSON.stringify({ message: "Email already registered" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      let sanpassword = password.trim();
      if (!sanpassword || sanpassword.length < 8) {
        return new Response(
          JSON.stringify({ message: "Password must be at least 8 characters" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const hashedPassword = await hashPassword(sanitizedPassword as string);

      const { error: insertError } = await supabase.from("users").insert([
        {
          email,
          password_hash: hashedPassword,
          full_name: fixedfullname,
        },
      ]);

      if (insertError) {
        return new Response(
          JSON.stringify({
            message: "Failed to create user",
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
          message: "Internal server error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  });

  router.post("/api/users/getUserInfo", async (req: Request) => {
    try {
      const { token }: { token: string } = await req.json();

      if (!token) {
        return new Response(
          JSON.stringify({ message: "Email and token are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      let email = "";

      try {
        const decoded = jwt.verify(token, jwtSecret);
        if (!decoded || typeof decoded !== "object" || !decoded.userId) {
          return new Response(JSON.stringify({ message: "Invalid token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        } else {
          email = decoded.email as string;
          if (!email) {
            return new Response(
              JSON.stringify({ message: "Email not found in token" }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }
        }
      } catch (err) {
        const errstring = err instanceof Error ? err.message : "Unknown error";
        return new Response(
          JSON.stringify({ message: "Invalid token", errstring }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      const { data, error } = await supabase
        .from("users")
        .select("id, email, full_name")
        .eq("email", email)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({
            message: "Failed to fetch user info",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      if (!data) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(
        JSON.stringify({ message: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  });
}

export { registerUserRoutes };
