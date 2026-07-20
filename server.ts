import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

// Import Vercel serverless api handlers using relative paths
// @ts-ignore
import visitHandler from "./api/visit.js";
// @ts-ignore
import statsHandler from "./api/stats.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Route mappings
  app.post("/api/visit", async (req: any, res: any) => {
    try {
      await visitHandler(req, res);
    } catch (err: any) {
      console.error("Error in /api/visit handler:", err);
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  });

  app.get("/api/stats", async (req: any, res: any) => {
    try {
      await statsHandler(req, res);
    } catch (err: any) {
      console.error("Error in /api/stats handler:", err);
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  });

  // Handle Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode with static assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
