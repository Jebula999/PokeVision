import mysql from "mysql2/promise";

export type MapPointType = "gym" | "pokestop";

export interface MapPoint {
  id: number | string;
  lat: number;
  lon: number;
  type: MapPointType;
  teamId?: number | null;
}

let pool: mysql.Pool | undefined;

function getPool() {
  if (!pool) {
    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME ?? "golbat";
    const port = Number(process.env.DB_PORT ?? 3306);

    if (!host || !user || !password) {
      throw new Error(
        "Database configuration missing. Set DB_HOST, DB_USER, DB_PASSWORD (and optionally DB_NAME, DB_PORT).",
      );
    }

    pool = mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      connectionLimit: 5,
      waitForConnections: true,
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }

  return pool;
}

interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export async function fetchMapPoints(bounds: Bounds): Promise<MapPoint[]> {
  const poolInstance = getPool();

  const north = Math.max(bounds.north, bounds.south);
  const south = Math.min(bounds.north, bounds.south);
  const east = Math.max(bounds.east, bounds.west);
  const west = Math.min(bounds.east, bounds.west);

  const query = `
    SELECT id, lat, lon, team_id AS teamId, 'gym' AS type
    FROM golbat.gym
    WHERE lat BETWEEN ? AND ?
      AND lon BETWEEN ? AND ?
      AND COALESCE(deleted, 0) = 0
      AND COALESCE(enabled, 1) = 1
    UNION ALL
    SELECT id, lat, lon, NULL AS teamId, 'pokestop' AS type
    FROM golbat.pokestop
    WHERE lat BETWEEN ? AND ?
      AND lon BETWEEN ? AND ?
      AND COALESCE(deleted, 0) = 0
      AND COALESCE(enabled, 1) = 1
  `;

  const params = [south, north, west, east, south, north, west, east];

  const [rows] = await poolInstance.query<mysql.RowDataPacket[]>(query, params);

  return rows.map((row) => ({
    id: row.id,
    lat: Number(row.lat),
    lon: Number(row.lon),
    type: row.type as MapPointType,
    teamId: row.teamId == null ? undefined : Number(row.teamId),
  }));
}
