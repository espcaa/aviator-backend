// index.ts
import { serve } from "bun";
import { Router } from "./router";
import { registerOtpRoutes } from "./routes/otp";
import { registerUserRoutes } from "./routes/users";
// Create router instance
const router = new Router();
registerOtpRoutes(router);
registerUserRoutes(router);

// Health check route
router.get("/api/health", () => {
  return new Response(
    JSON.stringify({ status: "healthy", timestamp: new Date().toISOString() }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
});

// Start server
serve({
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  async fetch(req: Request): Promise<Response> {
    return router.handle(req);
  },
});

console.log("Server running at http://localhost:" + (process.env.PORT || 3000));
