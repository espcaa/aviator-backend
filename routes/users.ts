import type { Router } from "../router";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "../utils/database";

const JWT_SECRET = process.env.JWT_SECRET;

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
  router.post("/api/createUser", async (req: Request) => {
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
          password: hashedPassword,
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
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          details: err.message,
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
      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return new Response(
          JSON.stringify({ error: "Invalid email or password" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Generate JWT token
      const token = jwt.sign({ email: user.email }, JWT_SECRET, {
        expiresIn: "1h",
      });

      return new Response(
        JSON.stringify({ message: "Login successful", token }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          details: err.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  });
}

export { registerUserRoutes };
