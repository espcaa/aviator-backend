import type { Router } from "../router";
import bcrypt from "bcrypt";

// Load the jwt token + lib
import jwt from "jsonwebtoken";
import { supabase } from "../utils/database";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
const jwtSecret = JWT_SECRET as string;

function registerSessionRoutes(router: Router) {
  // Session creation route
  router.post("/api/sessions/login", async (req: Request) => {
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
        return new Response(
          JSON.stringify({ error: "Invalid email or password" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      // Verify password
      const isPasswordValid = await bcrypt.compare(
        password,
        user.password_hash,
      );
      if (!isPasswordValid) {
        return new Response(
          JSON.stringify({ error: "Invalid email or password" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Generate a jwt token

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        jwtSecret,
        {
          expiresIn: "1h",
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
}
