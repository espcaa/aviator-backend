import { Database } from "bun:sqlite";

const db = new Database("airports.db");

export async function getGpsCoordinates(iata: string) {
  iata = iata.trim().toUpperCase();

  try {
    const airport: any = db
      .query("SELECT * FROM airport WHERE iata = ?")
      .get(iata.toUpperCase());

    if (!airport) {
      console.error(`Airport with IATA code ${iata} not found`);
      return {
        exists: false,
        message: "Airport not found",
      };
    } else {
      console.log(`Found airport: ${airport.name} (${iata})`);
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
