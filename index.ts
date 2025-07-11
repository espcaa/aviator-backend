// index.ts
import { serve } from "bun";
import { Router } from "./router";
import { registerOtpRoutes } from "./routes/otp";
import { registerUserRoutes } from "./routes/users";
import { registerSessionRoutes } from "./routes/session";
import { registerMapRoutes } from "./routes/map";
import { registerAirlinesRoutes } from "./routes/airlines";
import { registerLogoRoute } from "./routes/logo";
import { registerAirportsRoutes } from "./routes/airports";
import { registerFlightRoutes } from "./routes/flights";
// Create router instance
const router = new Router();
registerOtpRoutes(router);
registerUserRoutes(router);
registerSessionRoutes(router);
registerMapRoutes(router);
registerAirlinesRoutes(router);
registerLogoRoute(router);
registerAirlinesRoutes(router);
registerAirportsRoutes(router);
registerFlightRoutes(router);

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
