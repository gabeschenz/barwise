/**
 * Tool registration barrel. Registers all MCP tools on the server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerValidateTool } from "./validate.js";
import { registerVerbalizeTool } from "./verbalize.js";
import { registerSchemaTool } from "./schema.js";
import { registerDiffTool } from "./diff.js";
import { registerDiagramTool } from "./diagram.js";
import { registerImportTool } from "./import.js";
import { registerImportModelTool } from "./importModel.js";
import { registerMergeTool } from "./merge.js";
import { registerExportModelTool } from "./exportModel.js";
import { registerDescribeDomainTool } from "./describeDomain.js";
import { registerLineageStatusTool } from "./lineageStatus.js";
import { registerImpactAnalysisTool } from "./impactAnalysis.js";
import { registerReviewTool } from "./review.js";

export function registerTools(server: McpServer): void {
  registerValidateTool(server);
  registerVerbalizeTool(server);
  registerSchemaTool(server);
  registerDiffTool(server);
  registerDiagramTool(server);
  registerImportTool(server);
  registerImportModelTool(server);
  registerMergeTool(server);
  registerExportModelTool(server);
  registerDescribeDomainTool(server);
  registerLineageStatusTool(server);
  registerImpactAnalysisTool(server);
  registerReviewTool(server);
}
