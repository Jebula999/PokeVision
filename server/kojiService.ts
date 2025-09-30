import "./loadEnv";
import mysql, { type Pool, type PoolConnection } from "mysql2/promise";
import { log } from "./vite";

export interface KojiGeofence {
  coordinates: string[];
}

export interface KojiAreaRequest {
  username: string;
  areaName?: string;
  geofences: KojiGeofence[];
  mode?: string | null;
}

type GeoType = "Polygon" | "MultiPolygon";

type Position = [number, number];

function sanitizeNameSegment(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim().toLowerCase() ?? "";
  const normalized = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : fallback;
}

function parseCoordinatePair(raw: string): Position | null {
  const parts = raw.split(",").map((part) => part.trim());
  if (parts.length < 2) {
    return null;
  }

  const lat = Number(parts[0]);
  const lon = Number(parts[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const lonLat: Position = [lon, lat];
  return lonLat;
}

function ensureClosedRing(ring: Position[]): Position[] {
  if (ring.length === 0) {
    return ring;
  }

  const [firstLon, firstLat] = ring[0];
  const [lastLon, lastLat] = ring[ring.length - 1];

  if (firstLon !== lastLon || firstLat !== lastLat) {
    ring.push([firstLon, firstLat]);
  }

  return ring;
}

function buildGeometry(geofences: KojiGeofence[]): { geometry: any; geoType: GeoType } {
  const rings: Position[][] = geofences
    .map((geofence) => {
      const parsed = geofence.coordinates
        .map(parseCoordinatePair)
        .filter((position): position is Position => position !== null);

      if (parsed.length < 3) {
        return null;
      }

      return ensureClosedRing([...parsed]);
    })
    .filter((ring): ring is Position[] => Array.isArray(ring) && ring.length >= 4);

  if (rings.length === 0) {
    throw new Error("No valid geofence coordinates provided for Koji insertion");
  }

  if (rings.length === 1) {
    return {
      geoType: "Polygon",
      geometry: {
        type: "Polygon",
        coordinates: [rings[0]],
      },
    };
  }

  return {
    geoType: "MultiPolygon",
    geometry: {
      type: "MultiPolygon",
      coordinates: rings.map((ring) => [ring]),
    },
  };
}

class KojiService {
  private pool: Pool | null = null;

  private getPool(): Pool {
    if (this.pool) {
      return this.pool;
    }

    const connectionUrl = process.env.KOJI_DB_URL;
    const host = process.env.KOJI_DB_HOST;
    const user = process.env.KOJI_DB_USER;
    const password = process.env.KOJI_DB_PASSWORD;
    const database = process.env.KOJI_DB_NAME;
    const port = process.env.KOJI_DB_PORT ? Number(process.env.KOJI_DB_PORT) : undefined;
    const ssl = process.env.KOJI_DB_SSL === "true";

    try {
      if (connectionUrl) {
        this.pool = mysql.createPool(connectionUrl);
      } else {
        if (!host || !user || !password || !database) {
          throw new Error(
            "Koji database configuration missing. Set KOJI_DB_URL or KOJI_DB_HOST, KOJI_DB_USER, KOJI_DB_PASSWORD, KOJI_DB_NAME.",
          );
        }

        this.pool = mysql.createPool({
          host,
          user,
          password,
          database,
          port,
          waitForConnections: true,
          connectionLimit: 5,
          ssl: ssl ? { rejectUnauthorized: false } : undefined,
        });
      }
    } catch (error) {
      log(`Failed to initialize Koji database pool: ${(error as Error).message}`, "koji");
      throw error;
    }

    return this.pool;
  }

  private async getConnection(): Promise<PoolConnection> {
    const pool = this.getPool();
    return pool.getConnection();
  }

  private async nextGeofenceId(connection: PoolConnection): Promise<number> {
    const [rows] = await connection.query<{ id: number }[]>(
      "SELECT id FROM geofence ORDER BY id DESC LIMIT 1 FOR UPDATE",
    );

    const currentMax = rows.length > 0 ? Number(rows[0].id) : 0;
    return currentMax + 1;
  }

  private async nextGeofenceProjectId(connection: PoolConnection): Promise<number> {
    const [rows] = await connection.query<{ id: number }[]>(
      "SELECT id FROM geofence_project ORDER BY id DESC LIMIT 1 FOR UPDATE",
    );

    const currentMax = rows.length > 0 ? Number(rows[0].id) : 0;
    return currentMax + 1;
  }

  async recordAreaRequest(payload: KojiAreaRequest): Promise<{ id: number; name: string }> {
    if (!payload.geofences || payload.geofences.length === 0) {
      throw new Error("Cannot record Koji geofence request without geofences");
    }

    const { geometry } = buildGeometry(payload.geofences);
    const now = new Date();
    const usernameSegment = sanitizeNameSegment(payload.username, "user");
    const areaSegment = sanitizeNameSegment(payload.areaName, "area");
    const recordName = `request_${usernameSegment}_${areaSegment}`;
    const mode = "auto_quest";

    const connection = await this.getConnection();

    try {
      await connection.beginTransaction();
      const id = await this.nextGeofenceId(connection);

      await connection.execute(
        `INSERT INTO geofence (id, name, created_at, updated_at, mode, geometry)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          recordName,
          now,
          now,
          mode,
          JSON.stringify(geometry),
        ],
      );

      let nextProjectId = await this.nextGeofenceProjectId(connection);
      const projectIds = [2, 7];

      for (const projectId of projectIds) {
        await connection.execute(
          `INSERT INTO geofence_project (id, geofence_id, project_id)
           VALUES (?, ?, ?)`,
          [
            nextProjectId,
            id,
            projectId,
          ],
        );
        nextProjectId += 1;
      }

      await connection.commit();
      log(`Inserted Koji geofence #${id} (${recordName})`, "koji");
      return { id, name: recordName };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export const kojiService = new KojiService();
