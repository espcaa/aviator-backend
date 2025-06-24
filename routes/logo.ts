import type { Router } from "../router";

export function registerLogoRoute(router: Router) {
  router.get("/api/logo/getLogo", async (req: Request) => {
    // get the icao code from the query parameters
    const url = new URL(req.url);
    const icao = url.searchParams.get("icao");
    if (!icao) {
      return new Response(JSON.stringify({ error: "ICAO code is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    try {
      // Return the file from "@/logos/${icao}.png"
      const logoPath = `logos/${icao}.png`;
      console.log("Fetching logo from path:", logoPath);

      const logo = await fetch(logoPath);
      if (!logo.ok) {
        return new Response(JSON.stringify({ error: "Logo not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      const logoBlob = await logo.blob();
      return new Response(logoBlob, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
        },
      });
    } catch (error) {
      console.error("Error fetching logo:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch logo" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}
