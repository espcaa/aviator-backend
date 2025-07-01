import { Database } from "bun:sqlite";

const db = new Database("airports.db");

export async function getGpsCoordinates(iata: string) {
  iata = iata.trim().toUpperCase();
  try {
    const airport: any = db
      .query("SELECT * FROM airport WHERE iata = ?")
      .get(iata.toUpperCase());

    if (!airport) {
      return {
        exists: false,
        message: "Airport not found",
      };
    }

    return {
      exists: true,
      location: {
        latitude: airport.lat,
        longitude: airport.lon,
      },
      message: "Airport found",
    };
  } catch (error: any) {
    return {
      exists: false,
      message: `Error retrieving airport: ${error.message}`,
    };
  }
}
