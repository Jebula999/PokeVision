import "./loadEnv";
import type { Express, NextFunction, Request, Response } from "express";
import { createServer, type Server } from "http";
import { fetchMapPoints } from "./db";
import { kojiService } from "./kojiService";
import passport from "passport";

async function sendDiscordWebhook(webhookUrl: string, content: string, imageData?: string): Promise<boolean> {
  try {
    const payload: any = {
      content: content,
      username: "PokéVision Bot",
      avatar_url: "https://i.imgur.com/placeholder.png" // Optional: Replace with your bot avatar
    };

    // If there's image data, upload it as a file
    if (imageData) {
      const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const formData = new FormData();
      formData.append('payload_json', JSON.stringify(payload));
      formData.append('file', new Blob([buffer], { type: 'image/png' }), 'area-map.png');
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
      });
      
      return response.ok;
    } else {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      return response.ok;
    }
  } catch (error) {
    console.error('Discord webhook error:', error);
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/auth/session", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      const { id, username, discriminator, globalName, avatar } = req.user;
      return res.json({
        authenticated: true,
        user: {
          id,
          username,
          discriminator: discriminator ?? null,
          globalName: globalName ?? null,
          avatar: avatar ?? null,
        },
      });
    }

    res.json({ authenticated: false });
  });

  app.post("/auth/logout", (req: Request, res: Response, next: NextFunction) => {
    req.logout((err) => {
      if (err) {
        next(err);
        return;
      }

      if (req.session) {
        req.session.destroy(() => {
          res.json({ success: true });
        });
      } else {
        res.json({ success: true });
      }
    });
  });

  app.get("/auth/discord", passport.authenticate("discord"));

  app.get(
    "/auth/discord/callback",
    passport.authenticate("discord", {
      failureRedirect: "/request-area?auth=failed",
    }),
    (_req, res) => {
      res.redirect("/request-area");
    },
  );
  
  // Area request submission endpoint
  app.post("/api/request-area", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({
          success: false,
          error: "Discord authentication required",
        });
      }

      const { formData: incomingFormData, geofenceCollection } = req.body ?? {};
      const normalizedAreaName =
        typeof incomingFormData?.areaName === "string"
          ? incomingFormData.areaName.trim()
          : "";
      const normalizedQuestions =
        typeof incomingFormData?.questions === "string"
          ? incomingFormData.questions.trim()
          : "";
      const pricingTier =
        incomingFormData?.pricingTier === "pokemon-pvp" ? "pokemon-pvp" : "shadows-raids";

      const discordHandle =
        (req.user.globalName && req.user.globalName.trim()) ||
        (req.user.discriminator ? `${req.user.username}#${req.user.discriminator}` : req.user.username);

      const formData = {
        discordUsername: discordHandle,
        areaName: normalizedAreaName,
        questions: normalizedQuestions,
        pricingTier,
      };
      
      // Basic security: Check for required timestamp (within last 5 minutes)
      const requestTimestamp = req.headers['x-request-timestamp'];
      if (!requestTimestamp || isNaN(Number(requestTimestamp))) {
        return res.status(400).json({
          success: false,
          error: "Invalid request"
        });
      }
      
      const timeDiff = Date.now() - Number(requestTimestamp);
      if (timeDiff > 300000) { // 5 minutes
        return res.status(400).json({
          success: false,
          error: "Request expired"
        });
      }
      
      // Validate required fields
      if (!formData.areaName || !geofenceCollection?.geofences?.length) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required fields" 
        });
      }
      
      // Get Discord webhook URL from environment variables
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (!webhookUrl) {
        return res.status(500).json({
          success: false,
          error: "Discord webhook not configured"
        });
      }
      
      // Get pricing tier display name
      const tierDisplayName = formData.pricingTier === 'shadows-raids' 
        ? 'Pokestops and Gyms ($10 per 100km²)' 
        : 'Pokemon and Quests ($15 per 5km²)';

      // Prepare Discord message content
      const messageContent = `
🗺️ **New PokéVision Area Request**

**💬 Discord:** ${formData.discordUsername}
**🆔 Discord ID:** ${req.user.id}
${formData.areaName ? `**🏷️ Area Name:** ${formData.areaName}` : ''}
**💎 Pricing Tier:** ${tierDisplayName}
**📊 Number of Areas:** ${geofenceCollection.geofences.length}
**📏 Total Area Size:** ${geofenceCollection.totalArea.toFixed(2)} km²
**💰 Total Estimated Cost:** $${geofenceCollection.totalCost}

${formData.questions ? `**❓ Questions/Requests:** ${formData.questions}` : ''}

**📍 All Coordinates:**
\`\`\`
${geofenceCollection.formattedCoordinates || 'No coordinates available'}
\`\`\`
      `.trim();
      
      // Send to Discord (use first geofence image if available)
      const firstImageData = geofenceCollection.geofences[0]?.imageData || '';
      const discordSent = await sendDiscordWebhook(
        webhookUrl,
        messageContent,
        firstImageData
      );
      
      if (!discordSent) {
        res.status(500).json({ 
          success: false, 
          error: "Failed to send Discord notification" 
        });
        return;
      }

      await kojiService.recordAreaRequest({
        username: formData.discordUsername,
        areaName: formData.areaName,
        mode: formData.pricingTier,
        geofences: geofenceCollection.geofences.map((geofence: any) => ({
          coordinates: Array.isArray(geofence?.coordinates) ? geofence.coordinates : [],
        })),
      });

      res.json({ success: true, message: "Request submitted successfully" });
      
    } catch (error) {
      console.error('Error processing area request:', error);
      res.status(500).json({ 
        success: false, 
        error: "Internal server error" 
      });
    }
  });

  app.get("/api/map-points", async (req, res) => {
    try {
      const { north, south, east, west, zoom } = req.query;

      const zoomLevel = Number(zoom);
      if (Number.isFinite(zoomLevel) && zoomLevel < 11) {
        return res.json({ points: [] });
      }

      const parsedNorth = Number(north);
      const parsedSouth = Number(south);
      const parsedEast = Number(east);
      const parsedWest = Number(west);

      const inputs = [parsedNorth, parsedSouth, parsedEast, parsedWest];
      if (inputs.some((value) => !Number.isFinite(value))) {
        return res.status(400).json({ error: "Invalid bounds provided" });
      }

      const points = await fetchMapPoints({
        north: parsedNorth,
        south: parsedSouth,
        east: parsedEast,
        west: parsedWest,
      });

      res.json({ points });
    } catch (error) {
      console.error("Error fetching map points", error);
      res.status(500).json({ error: "Failed to load map points" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
