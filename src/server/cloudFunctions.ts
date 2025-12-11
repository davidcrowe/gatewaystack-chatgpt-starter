// src/server/cloudFunctions.ts
import type { Request, Response } from "express";
import { toolGatewayImpl } from "../gateway/toolGateway";

export async function toolGatewayHandler(req: Request, res: Response) {
  return toolGatewayImpl(req, res);
}
