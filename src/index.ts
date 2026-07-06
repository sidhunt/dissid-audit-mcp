#!/usr/bin/env bun
// dissid-audit MCP server over stdio.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
// Keep quiet on stdout (it is the protocol channel); log startup to stderr.
console.error("[dissid-audit-mcp] serving on stdio");
