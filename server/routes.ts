import type { Express } from "express";
import { createServer, type Server } from "http";
import { fetchMapPoints } from "./db";

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
  
  // Area request submission endpoint
  app.post("/api/request-area", async (req, res) => {
    try {
      const { formData, geofenceCollection } = req.body;
      
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
      if (!formData?.discordUsername || !geofenceCollection?.geofences?.length) {
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
      
      if (discordSent) {
        res.json({ success: true, message: "Request submitted successfully" });
      } else {
        res.status(500).json({ 
          success: false, 
          error: "Failed to send Discord notification" 
        });
      }
      
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
