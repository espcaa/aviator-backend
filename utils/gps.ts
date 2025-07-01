// get an airport gps coords by its iata code

import { Database } from "bun:sqlite";

const db = new Database("airports.db");

export async function getGpsCoordinates(iata: string) {
  const airport: any = db
    .query("SELECT * FROM airport WHERE iata = ?")
    .get(iata.toUpperCase());

  if (!airport) {
    return {
      exists: false,
      message: "Airport not found",
    };
  } else {
    return {
      exists: true,
      location: {
        latitude: airport.lat,
        longitude: airport.lon,
      },
      message: "Airport found",
    };
  }
}
