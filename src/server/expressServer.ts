import express from "express";
import { toolGatewayImpl } from "../gateway/toolGateway";
import { createDemoApiRouter } from "../demo-api/server";

export function createApp() {
  const app = express();

  // IMPORTANT: ChatGPT MCP sends JSON; keep body parsing permissive
  app.use(express.json({ limit: "2mb" }));
  app.use(express.text({ type: "*/*", limit: "2mb" }));

  // Demo backend mounted on same server (Cloud Run friendly)
  app.use("/demo", createDemoApiRouter());

  // Everything else is the MCP gateway
  app.all("*", (req, res) => toolGatewayImpl(req as any, res as any));

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, () => {
    console.log(`[starter] listening on http://localhost:${port}`);
    console.log(`[starter] demo api at     http://localhost:${port}/demo/health`);
  });
}
