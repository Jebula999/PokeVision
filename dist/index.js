// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";
async function sendDiscordWebhook(webhookUrl, content, imageData) {
  try {
    const payload = {
      content,
      username: "Pok\xE9Vision Bot",
      avatar_url: "https://i.imgur.com/placeholder.png"
      // Optional: Replace with your bot avatar
    };
    if (imageData) {
      const base64Data = imageData.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const formData = new FormData();
      formData.append("payload_json", JSON.stringify(payload));
      formData.append("file", new Blob([buffer], { type: "image/png" }), "area-map.png");
      const response = await fetch(webhookUrl, {
        method: "POST",
        body: formData
      });
      return response.ok;
    } else {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      return response.ok;
    }
  } catch (error) {
    console.error("Discord webhook error:", error);
    return false;
  }
}
async function registerRoutes(app2) {
  app2.post("/api/request-area", async (req, res) => {
    try {
      const { formData, geofenceCollection } = req.body;
      const requestTimestamp = req.headers["x-request-timestamp"];
      if (!requestTimestamp || isNaN(Number(requestTimestamp))) {
        return res.status(400).json({
          success: false,
          error: "Invalid request"
        });
      }
      const timeDiff = Date.now() - Number(requestTimestamp);
      if (timeDiff > 3e5) {
        return res.status(400).json({
          success: false,
          error: "Request expired"
        });
      }
      if (!formData?.discordUsername || !geofenceCollection?.geofences?.length) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields"
        });
      }
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (!webhookUrl) {
        return res.status(500).json({
          success: false,
          error: "Discord webhook not configured"
        });
      }
      const tierDisplayName = formData.pricingTier === "shadows-raids" ? "Shadows and Raids ($10 per 100km\xB2)" : "Pok\xE9mon, PVP and Quests ($15 per 5km\xB2)";
      const messageContent = `
\u{1F5FA}\uFE0F **New Pok\xE9Vision Area Request**

**\u{1F4AC} Discord:** ${formData.discordUsername}
${formData.areaName ? `**\u{1F3F7}\uFE0F Area Name:** ${formData.areaName}` : ""}
**\u{1F48E} Pricing Tier:** ${tierDisplayName}
**\u{1F4CA} Number of Areas:** ${geofenceCollection.geofences.length}
**\u{1F4CF} Total Area Size:** ${geofenceCollection.totalArea.toFixed(2)} km\xB2
**\u{1F4B0} Total Estimated Cost:** $${geofenceCollection.totalCost}

${formData.questions ? `**\u2753 Questions/Requests:** ${formData.questions}` : ""}

**\u{1F4CD} All Coordinates:**
\`\`\`
${geofenceCollection.formattedCoordinates || "No coordinates available"}
\`\`\`
      `.trim();
      const firstImageData = geofenceCollection.geofences[0]?.imageData || "";
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
      console.error("Error processing area request:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error"
      });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
