/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  HEADY MANAGER - Node.js MCP Server & API Gateway               ║
 * ║  Sacred Geometry Architecture v3.0.0                             ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const PORT = Number(process.env.PORT || 3300);
const app = express();

// ─── Middleware ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "*",
  credentials: true,
}));
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── Static Assets ─────────────────────────────────────────────────
const frontendBuildPath = path.join(__dirname, "frontend", "dist");
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
}
app.use(express.static("public"));

// ─── Utility ────────────────────────────────────────────────────────
function readJsonSafe(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { return null; }
}

// ─── Health & Pulse ─────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "heady-manager",
    version: "3.0.0",
    ts: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

app.get("/api/pulse", (req, res) => {
  res.json({
    ok: true,
    service: "heady-manager",
    version: "3.0.0",
    ts: new Date().toISOString(),
    status: "active",
    endpoints: [
      "/api/health", "/api/pulse", "/api/registry", "/api/nodes",
      "/api/system/status", "/api/pipeline/*",
      "/api/ide/spec", "/api/ide/agents",
      "/api/playbook", "/api/agentic", "/api/activation", "/api/public-domain",
      "/api/resources/health", "/api/resources/snapshot", "/api/resources/events",
      "/api/stories", "/api/stories/recent", "/api/stories/summary",
      "/api/arena/*", "/api/build-any-app",
    ],
  });
});

// ─── Registry ───────────────────────────────────────────────────────
const REGISTRY_PATH = path.join(__dirname, ".heady", "registry.json");

function loadRegistry() {
  return readJsonSafe(REGISTRY_PATH) || { nodes: {}, tools: {}, workflows: {}, services: {}, skills: {}, metadata: {} };
}

function saveRegistry(data) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2), "utf8");
}

app.get("/api/registry", (req, res) => {
  const registryPath = path.join(__dirname, "heady-registry.json");
  const registry = readJsonSafe(registryPath);
  if (!registry) return res.status(404).json({ error: "Registry not found" });
  res.json(registry);
});

// ─── Node Management ────────────────────────────────────────────────
app.get("/api/nodes", (req, res) => {
  const reg = loadRegistry();
  const nodes = Object.entries(reg.nodes || {}).map(([id, n]) => ({ id, ...n }));
  res.json({ total: nodes.length, active: nodes.filter(n => n.status === "active").length, nodes, ts: new Date().toISOString() });
});

app.get("/api/nodes/:nodeId", (req, res) => {
  const reg = loadRegistry();
  const node = reg.nodes[req.params.nodeId.toUpperCase()];
  if (!node) return res.status(404).json({ error: `Node '${req.params.nodeId}' not found` });
  res.json({ id: req.params.nodeId.toUpperCase(), ...node });
});

app.post("/api/nodes/:nodeId/activate", (req, res) => {
  const reg = loadRegistry();
  const id = req.params.nodeId.toUpperCase();
  if (!reg.nodes[id]) return res.status(404).json({ error: `Node '${id}' not found` });
  reg.nodes[id].status = "active";
  reg.nodes[id].last_invoked = new Date().toISOString();
  saveRegistry(reg);
  res.json({ success: true, node: id, status: "active" });
});

app.post("/api/nodes/:nodeId/deactivate", (req, res) => {
  const reg = loadRegistry();
  const id = req.params.nodeId.toUpperCase();
  if (!reg.nodes[id]) return res.status(404).json({ error: `Node '${id}' not found` });
  reg.nodes[id].status = "available";
  saveRegistry(reg);
  res.json({ success: true, node: id, status: "available" });
});

// ─── System Status & Production Activation ──────────────────────────
app.get("/api/system/status", (req, res) => {
  const reg = loadRegistry();
  const nodeList = Object.entries(reg.nodes || {});
  const activeNodes = nodeList.filter(([, n]) => n.status === "active").length;

  res.json({
    system: "Heady Systems",
    version: "3.0.0",
    environment: (reg.metadata || {}).environment || "development",
    production_ready: activeNodes === nodeList.length && nodeList.length > 0,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    capabilities: {
      nodes: { total: nodeList.length, active: activeNodes },
      tools: { total: Object.keys(reg.tools || {}).length },
      workflows: { total: Object.keys(reg.workflows || {}).length },
      services: { total: Object.keys(reg.services || {}).length },
    },
    sacred_geometry: { architecture: "active", organic_systems: activeNodes === nodeList.length },
    ts: new Date().toISOString(),
  });
});

app.post("/api/system/production", (req, res) => {
  const reg = loadRegistry();
  const ts = new Date().toISOString();
  const report = { nodes: [], tools: [], workflows: [], services: [] };

  for (const [name, node] of Object.entries(reg.nodes || {})) {
    node.status = "active"; node.last_invoked = ts; report.nodes.push(name);
  }
  for (const [name, tool] of Object.entries(reg.tools || {})) {
    tool.status = "active"; report.tools.push(name);
  }
  for (const [name, wf] of Object.entries(reg.workflows || {})) {
    wf.status = "active"; report.workflows.push(name);
  }
  for (const [name, svc] of Object.entries(reg.services || {})) {
    svc.status = name === "heady-manager" ? "healthy" : "active"; report.services.push(name);
  }
  for (const [, sk] of Object.entries(reg.skills || {})) { sk.status = "active"; }

  reg.metadata = { ...reg.metadata, last_updated: ts, version: "3.0.0-production", environment: "production", all_nodes_active: true, production_activated_at: ts };
  saveRegistry(reg);

  res.json({
    success: true,
    environment: "production",
    activated: { nodes: report.nodes.length, tools: report.tools.length, workflows: report.workflows.length, services: report.services.length },
    sacred_geometry: "FULLY_ACTIVATED",
    ts,
  });
});

// ─── Pipeline Engine (wired to src/hc_pipeline.js) ──────────────────
let pipeline = null;
let pipelineError = null;
try {
  const pipelineMod = require("./src/hc_pipeline");
  pipeline = pipelineMod.pipeline;
  console.log("  ∞ Pipeline engine: LOADED");
} catch (err) {
  pipelineError = err.message;
  console.warn(`  ⚠ Pipeline engine not loaded: ${err.message}`);
}

app.get("/api/pipeline/config", (req, res) => {
  if (!pipeline) return res.status(503).json({ error: "Pipeline not loaded", reason: pipelineError });
  try {
    const summary = pipeline.getConfigSummary();
    res.json({ ok: true, ...summary });
  } catch (err) {
    res.status(500).json({ error: "Failed to load pipeline config", message: err.message });
  }
});

app.post("/api/pipeline/run", async (req, res) => {
  if (!pipeline) return res.status(503).json({ error: "Pipeline not loaded", reason: pipelineError });
  try {
    const result = await pipeline.run(req.body || {});
    res.json({
      ok: true,
      runId: result.runId,
      status: result.status,
      metrics: result.metrics,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Pipeline run failed", message: err.message });
  }
});

app.get("/api/pipeline/state", (req, res) => {
  if (!pipeline) return res.status(503).json({ error: "Pipeline not loaded", reason: pipelineError });
  try {
    const state = pipeline.getState();
    if (!state) return res.json({ ok: true, state: null, message: "No run executed yet" });
    res.json({ ok: true, runId: state.runId, status: state.status, metrics: state.metrics, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to get pipeline state", message: err.message });
  }
});

// ─── HeadyAutoIDE & Methodology APIs ────────────────────────────────
const jsYaml = require("js-yaml");

function loadYamlConfig(filename) {
  const filePath = path.join(__dirname, "configs", filename);
  if (!fs.existsSync(filePath)) return null;
  try { return jsYaml.load(fs.readFileSync(filePath, "utf8")); }
  catch { return null; }
}

app.get("/api/ide/spec", (req, res) => {
  const spec = loadYamlConfig("heady-auto-ide.yaml");
  if (!spec) return res.status(404).json({ error: "HeadyAutoIDE spec not found" });
  res.json({ ok: true, ...spec, ts: new Date().toISOString() });
});

app.get("/api/ide/agents", (req, res) => {
  const spec = loadYamlConfig("heady-auto-ide.yaml");
  if (!spec) return res.status(404).json({ error: "HeadyAutoIDE spec not found" });
  res.json({ ok: true, agents: spec.agentRoles || [], ts: new Date().toISOString() });
});

app.get("/api/playbook", (req, res) => {
  const playbook = loadYamlConfig("build-playbook.yaml");
  if (!playbook) return res.status(404).json({ error: "Build Playbook not found" });
  res.json({ ok: true, ...playbook, ts: new Date().toISOString() });
});

app.get("/api/agentic", (req, res) => {
  const agentic = loadYamlConfig("agentic-coding.yaml");
  if (!agentic) return res.status(404).json({ error: "Agentic Coding config not found" });
  res.json({ ok: true, ...agentic, ts: new Date().toISOString() });
});

app.get("/api/activation", (req, res) => {
  const manifest = loadYamlConfig("activation-manifest.yaml");
  if (!manifest) return res.status(404).json({ error: "Activation Manifest not found" });
  const reg = loadRegistry();
  const nodeList = Object.entries(reg.nodes || {});
  const activeNodes = nodeList.filter(([, n]) => n.status === "active").length;

  res.json({
    ok: true,
    status: manifest.status || "PENDING",
    activatedAt: manifest.activatedAt,
    version: manifest.version,
    verifiedResources: {
      configs: (manifest.verifiedResources?.configs || []).length,
      coreEngines: (manifest.verifiedResources?.coreEngines || []).length,
      companionSystems: (manifest.verifiedResources?.companionSystems || []).length,
      registryNodes: { total: nodeList.length, active: activeNodes },
    },
    operatingDirectives: (manifest.operatingDirectives || []).length,
    pipelineStages: (manifest.pipelineInitTemplate?.stages || []).length,
    ts: new Date().toISOString(),
  });
});

app.get("/api/public-domain", (req, res) => {
  const pdi = loadYamlConfig("public-domain-integration.yaml");
  if (!pdi) return res.status(404).json({ error: "Public Domain Integration config not found" });
  res.json({ ok: true, ...pdi, ts: new Date().toISOString() });
});

// ─── Continuous Pipeline State (shared by resources & buddy APIs) ────
let continuousPipeline = {
  running: false,
  cycleCount: 0,
  lastCycleTs: null,
  exitReason: null,
  errors: [],
  gateResults: { quality: null, resource: null, stability: null, user: null },
  intervalId: null,
};

// ─── Intelligent Resource Manager ────────────────────────────────────
let resourceManager = null;
try {
  const { HCResourceManager, registerRoutes: registerResourceRoutes } = require("./src/hc_resource_manager");
  resourceManager = new HCResourceManager({ pollIntervalMs: 5000 });
  registerResourceRoutes(app, resourceManager);
  resourceManager.start();

  resourceManager.on("resource_event", (event) => {
    if (event.severity === "WARN_HARD" || event.severity === "CRITICAL") {
      console.warn(`  ⚠ Resource ${event.severity}: ${event.resourceType} at ${event.currentUsagePercent}%`);
    }
  });

  resourceManager.on("escalation_required", (data) => {
    console.warn(`  ⚠ ESCALATION: ${data.event.resourceType} at ${data.event.currentUsagePercent}% — user prompt required`);
  });

  console.log("  ∞ Resource Manager: LOADED (polling every 5s)");
} catch (err) {
  console.warn(`  ⚠ Resource Manager not loaded: ${err.message}`);

  // Fallback inline resource health endpoint
  app.get("/api/resources/health", (req, res) => {
    const mem = process.memoryUsage();
    const osLib = require("os");
    const totalMem = osLib.totalmem();
    const freeMem = osLib.freemem();
    const usedMem = totalMem - freeMem;
    const cpuCount = osLib.cpus().length;
    const ramPercent = Math.round((usedMem / totalMem) * 100);

    res.json({
      cpu: { currentPercent: 0, cores: cpuCount, unit: "%" },
      ram: { currentPercent: ramPercent, absoluteValue: Math.round(usedMem / 1048576), capacity: Math.round(totalMem / 1048576), unit: "MB" },
      disk: { currentPercent: 0, absoluteValue: 0, capacity: 0, unit: "GB" },
      gpu: null,
      safeMode: false,
      status: "fallback",
      ts: new Date().toISOString(),
    });
  });
}

// ─── Story Driver ────────────────────────────────────────────────────
let storyDriver = null;
try {
  const { HCStoryDriver, registerStoryRoutes } = require("./src/hc_story_driver");
  storyDriver = new HCStoryDriver();
  registerStoryRoutes(app, storyDriver);

  // Wire resource manager events into story driver
  if (resourceManager) {
    resourceManager.on("resource_event", (event) => {
      if (event.severity === "WARN_HARD" || event.severity === "CRITICAL") {
        storyDriver.ingestSystemEvent({
          type: `RESOURCE_${event.severity}`,
          refs: {
            resourceType: event.resourceType,
            percent: event.currentUsagePercent,
            mitigation: event.mitigationApplied || "pending",
          },
          source: "resource_manager",
        });
      }
    });
  }

  console.log("  ∞ Story Driver: LOADED");
} catch (err) {
  console.warn(`  ⚠ Story Driver not loaded: ${err.message}`);
}

// ─── HeadyBuddy API ─────────────────────────────────────────────────
const buddyStartTime = Date.now();

app.get("/api/buddy/health", (req, res) => {
  res.json({
    ok: true,
    service: "heady-buddy",
    version: "2.0.0",
    uptime: (Date.now() - buddyStartTime) / 1000,
    continuousMode: continuousPipeline.running,
    ts: new Date().toISOString(),
  });
});

app.post("/api/buddy/chat", (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });

  const reg = loadRegistry();
  const nodeCount = Object.keys(reg.nodes || {}).length;
  const activeNodes = Object.values(reg.nodes || {}).filter(n => n.status === "active").length;

  const hour = new Date().getHours();
  let greeting = hour < 12 ? "Good morning!" : hour < 17 ? "Good afternoon!" : "Good evening!";
  const lowerMsg = message.toLowerCase();
  let reply = "";

  if (lowerMsg.includes("plan") && lowerMsg.includes("day")) {
    reply = `${greeting} Let's plan your perfect day. I see ${activeNodes}/${nodeCount} nodes active. What are your top 3 priorities today?`;
  } else if (lowerMsg.includes("pipeline") || lowerMsg.includes("hcfull")) {
    const contState = continuousPipeline.running ? `running (cycle ${continuousPipeline.cycleCount})` : "stopped";
    reply = `Pipeline continuous mode: ${contState}. ${activeNodes} nodes active. Would you like me to start a pipeline run or check the orchestrator dashboard?`;
  } else if (lowerMsg.includes("slow") || lowerMsg.includes("taking so long") || lowerMsg.includes("explain") && lowerMsg.includes("slowdown")) {
    if (resourceManager) {
      const snap = resourceManager.getSnapshot();
      const events = resourceManager.getRecentEvents(5);
      const cpuPct = snap.cpu?.currentPercent || 0;
      const ramPct = snap.ram?.currentPercent || 0;
      const contributors = events.length > 0 && events[events.length - 1].contributors
        ? events[events.length - 1].contributors.slice(0, 3).map(c => `${c.description} (${c.ramMB || 0} MB)`).join(", ")
        : "no major contributors detected";
      const severity = cpuPct >= 90 || ramPct >= 85 ? "CRITICAL" : cpuPct >= 75 || ramPct >= 70 ? "CONSTRAINED" : "HEALTHY";
      reply = `Resource status: ${severity}. CPU: ${cpuPct}%, RAM: ${ramPct}%. Top contributors: ${contributors}. ${snap.safeMode ? "Safe mode is ACTIVE." : ""} Check the Resources tab in Expanded View for details and quick actions.`;
    } else {
      reply = `I can see system memory at ${Math.round(process.memoryUsage().heapUsed / 1048576)}MB heap. For detailed resource analysis, the Resource Manager needs to be running. Check the Resources tab for more.`;
    }
  } else if (lowerMsg.includes("resource") || lowerMsg.includes("gpu") || lowerMsg.includes("tier")) {
    if (resourceManager) {
      const snap = resourceManager.getSnapshot();
      reply = `Resource overview: CPU ${snap.cpu?.currentPercent || 0}%, RAM ${snap.ram?.currentPercent || 0}%${snap.gpu ? `, GPU ${snap.gpu.compute?.currentPercent || 0}%` : ""}. ${activeNodes}/${nodeCount} nodes active. ${snap.safeMode ? "⚠ Safe mode active." : ""} Expand to Resources tab for full details.`;
    } else {
      reply = `Resource overview: ${activeNodes}/${nodeCount} nodes active. Memory: ${Math.round(process.memoryUsage().heapUsed / 1048576)}MB heap. Check the Orchestrator tab for detailed tier usage.`;
    }
  } else if (lowerMsg.includes("arena") || lowerMsg.includes("squash") || lowerMsg.includes("candidate")) {
    const activeRun = arenaState.activeRun;
    if (activeRun) {
      const scored = activeRun.candidates.filter(c => c.status === "scored");
      const winnerInfo = activeRun.winner ? `Winner: Candidate ${activeRun.winner}.` : `${scored.length}/${activeRun.candidateCount} candidates scored.`;
      reply = `Arena Run #${activeRun.id} "${activeRun.title}" — Status: ${activeRun.status}. ${winnerInfo} ${activeRun.status === "winner_selected" ? "Ready to squash-merge. Say 'squash-merge' to proceed." : "Check the Arena tab in Expanded View for details."}`;
    } else {
      reply = `No active Arena run. ${arenaState.runs.length} total runs completed. Say "start arena" with a title to begin a new evaluation, or check history in the Arena tab.`;
    }
  } else if (lowerMsg.includes("story") || lowerMsg.includes("what changed") || lowerMsg.includes("narrative")) {
    if (storyDriver) {
      const sysSummary = storyDriver.getSystemSummary();
      reply = `Story Driver: ${sysSummary.totalStories} stories (${sysSummary.ongoing} ongoing). ${sysSummary.recentNarrative || "No recent events."} Check the Story tab in Expanded View for full timelines.`;
    } else {
      reply = "Story Driver is not loaded. It tracks project narratives, feature lifecycles, and incident timelines.";
    }
  } else if (lowerMsg.includes("status") || lowerMsg.includes("health")) {
    reply = `System healthy. ${activeNodes}/${nodeCount} nodes active. Uptime: ${Math.round(process.uptime())}s. Continuous mode: ${continuousPipeline.running ? "active" : "off"}.`;
  } else if (lowerMsg.includes("help") || lowerMsg.includes("what can")) {
    reply = `I can help with: planning your day, running HCFullPipeline, monitoring resources/nodes, orchestrating parallel tasks, automating workflows, and checking system health.`;
  } else if (lowerMsg.includes("stop") || lowerMsg.includes("pause")) {
    if (continuousPipeline.running) {
      clearInterval(continuousPipeline.intervalId);
      continuousPipeline.running = false;
      continuousPipeline.exitReason = "user_requested_stop";
      reply = `Continuous pipeline stopped after ${continuousPipeline.cycleCount} cycles. Resume anytime.`;
    } else {
      reply = "No continuous pipeline running. I'm here whenever you need me!";
    }
  } else {
    reply = `${greeting} I'm HeadyBuddy, your perfect day AI companion and orchestration copilot. ${activeNodes} nodes standing by. How can I help?`;
  }

  res.json({
    reply,
    context: {
      nodes: { total: nodeCount, active: activeNodes },
      continuousMode: continuousPipeline.running,
      cycleCount: continuousPipeline.cycleCount,
    },
    ts: new Date().toISOString(),
  });
});

app.get("/api/buddy/suggestions", (req, res) => {
  const hour = new Date().getHours();
  const reg = loadRegistry();
  const activeNodes = Object.values(reg.nodes || {}).filter(n => n.status === "active").length;
  const chips = [];

  if (hour < 10) chips.push({ label: "Plan my morning", icon: "calendar", prompt: "Help me plan my morning." });
  else if (hour < 14) chips.push({ label: "Plan my afternoon", icon: "calendar", prompt: "Help me plan my afternoon." });
  else if (hour < 18) chips.push({ label: "Wrap up my day", icon: "calendar", prompt: "Help me wrap up today." });
  else chips.push({ label: "Plan tomorrow", icon: "calendar", prompt: "Help me plan tomorrow." });

  chips.push({ label: "Summarize this", icon: "file-text", prompt: "Summarize the content I'm looking at." });
  chips.push({ label: continuousPipeline.running ? "Pipeline status" : "Run pipeline", icon: "play", prompt: continuousPipeline.running ? "Show pipeline status." : "Start HCFullPipeline." });
  if (activeNodes > 0) chips.push({ label: "Check resources", icon: "activity", prompt: "Show resource usage and node health." });
  if (arenaState.activeRun) {
    chips.push({ label: `Arena #${arenaState.activeRun.id}`, icon: "swords", prompt: `Show Arena run #${arenaState.activeRun.id} status.` });
  } else {
    chips.push({ label: "Start Arena", icon: "swords", prompt: "Start a new Arena evaluation run." });
  }
  chips.push({ label: "Surprise me", icon: "sparkles", prompt: "Suggest something useful right now." });

  res.json({ suggestions: chips.slice(0, 5), ts: new Date().toISOString() });
});

app.get("/api/buddy/orchestrator", (req, res) => {
  const reg = loadRegistry();
  const nodes = Object.entries(reg.nodes || {}).map(([id, n]) => ({
    id, name: n.name || id, role: n.role || "unknown",
    status: n.status || "unknown", tier: n.tier || "M",
    lastInvoked: n.last_invoked || null,
  }));
  const mem = process.memoryUsage();

  res.json({
    ok: true,
    system: {
      uptime: process.uptime(),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1048576),
        heapTotalMB: Math.round(mem.heapTotal / 1048576),
        rssMB: Math.round(mem.rss / 1048576),
      },
    },
    nodes: {
      total: nodes.length,
      active: nodes.filter(n => n.status === "active").length,
      list: nodes,
    },
    resourceTiers: {
      L: nodes.filter(n => n.tier === "L").length,
      M: nodes.filter(n => n.tier === "M").length,
      S: nodes.filter(n => n.tier === "S").length,
    },
    pipeline: {
      available: true,
      state: null,
      continuous: {
        running: continuousPipeline.running,
        cycleCount: continuousPipeline.cycleCount,
        lastCycleTs: continuousPipeline.lastCycleTs,
        exitReason: continuousPipeline.exitReason,
        gates: continuousPipeline.gateResults,
        recentErrors: continuousPipeline.errors.slice(-5),
      },
    },
    ts: new Date().toISOString(),
  });
});

app.post("/api/buddy/pipeline/continuous", (req, res) => {
  const { action = "start" } = req.body;

  if (action === "stop") {
    if (continuousPipeline.intervalId) clearInterval(continuousPipeline.intervalId);
    continuousPipeline.running = false;
    continuousPipeline.exitReason = "user_requested_stop";
    return res.json({ ok: true, action: "stopped", cycleCount: continuousPipeline.cycleCount, ts: new Date().toISOString() });
  }

  if (continuousPipeline.running) return res.json({ ok: true, action: "already_running", cycleCount: continuousPipeline.cycleCount });

  continuousPipeline.running = true;
  continuousPipeline.exitReason = null;
  continuousPipeline.errors = [];
  continuousPipeline.cycleCount = 0;

  const runCycle = () => {
    if (!continuousPipeline.running) return;
    continuousPipeline.cycleCount++;
    continuousPipeline.lastCycleTs = new Date().toISOString();
    continuousPipeline.gateResults = {
      quality: true,
      resource: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) < 0.9,
      stability: true,
      user: continuousPipeline.running,
    };
    const allPass = Object.values(continuousPipeline.gateResults).every(Boolean);

    // Emit story events for pipeline cycles
    if (storyDriver) {
      if (allPass) {
        storyDriver.ingestSystemEvent({
          type: "PIPELINE_CYCLE_COMPLETE",
          refs: { cycleNumber: continuousPipeline.cycleCount, gatesSummary: "all passed" },
          source: "hcfullpipeline",
        });
      } else {
        storyDriver.ingestSystemEvent({
          type: "PIPELINE_GATE_FAIL",
          refs: {
            cycleNumber: continuousPipeline.cycleCount,
            gate: Object.entries(continuousPipeline.gateResults).find(([, v]) => !v)?.[0] || "unknown",
            reason: "Gate check returned false",
          },
          source: "hcfullpipeline",
        });
      }
    }

    if (!allPass) {
      continuousPipeline.running = false;
      continuousPipeline.exitReason = "gate_failed";
      if (continuousPipeline.intervalId) clearInterval(continuousPipeline.intervalId);
    }
  };

  runCycle();
  if (continuousPipeline.running) {
    continuousPipeline.intervalId = setInterval(runCycle, req.body.intervalMs || 30000);
  }

  res.json({
    ok: true, action: "started", running: continuousPipeline.running,
    cycleCount: continuousPipeline.cycleCount, gates: continuousPipeline.gateResults,
    ts: new Date().toISOString(),
  });
});

// ─── Arena Mode ─────────────────────────────────────────────────────
let arenaState = {
  runs: [],
  activeRun: null,
  nextRunId: 1,
};

function createArenaRun(title, candidateCount = 3) {
  const run = {
    id: arenaState.nextRunId++,
    title,
    status: "created",
    candidateCount,
    candidates: [],
    winner: null,
    scores: {},
    createdAt: new Date().toISOString(),
    completedAt: null,
    storyEventId: null,
  };
  for (let i = 0; i < candidateCount; i++) {
    run.candidates.push({
      id: String.fromCharCode(65 + i),
      status: "pending",
      scores: {
        correctness: 0,
        performance: 0,
        resource_efficiency: 0,
        maintainability: 0,
        stability: 0,
        historical_reliability: 0,
      },
      compositeScore: 0,
    });
  }
  arenaState.runs.push(run);
  arenaState.activeRun = run;

  if (storyDriver) {
    storyDriver.ingestSystemEvent({
      type: "ARENA_RUN_STARTED",
      refs: { arenaId: run.id, title, candidateCount },
      source: "arena_mode",
    });
  }

  return run;
}

function scoreArenaCandidate(run, candidateId, scores) {
  const candidate = run.candidates.find(c => c.id === candidateId);
  if (!candidate) return null;
  candidate.scores = { ...candidate.scores, ...scores };

  const weights = { correctness: 0.30, performance: 0.20, resource_efficiency: 0.15, maintainability: 0.15, stability: 0.10, historical_reliability: 0.10 };
  candidate.compositeScore = Object.entries(weights).reduce((sum, [k, w]) => sum + (candidate.scores[k] || 0) * w, 0);
  candidate.compositeScore = Math.round(candidate.compositeScore * 100) / 100;
  candidate.status = "scored";

  if (storyDriver) {
    storyDriver.ingestSystemEvent({
      type: "ARENA_CANDIDATE_SCORED",
      refs: { arenaId: run.id, candidateId, compositeScore: candidate.compositeScore },
      source: "arena_mode",
    });
  }

  return candidate;
}

function selectArenaWinner(run) {
  const scored = run.candidates.filter(c => c.status === "scored");
  if (scored.length === 0) return null;

  const thresholds = { correctness: 0.80, stability: 0.70 };
  const qualified = scored.filter(c =>
    c.scores.correctness >= thresholds.correctness &&
    c.scores.stability >= thresholds.stability
  );

  const pool = qualified.length > 0 ? qualified : scored;
  pool.sort((a, b) => b.compositeScore - a.compositeScore);

  const winner = pool[0];
  winner.status = "winner";
  run.winner = winner.id;
  run.status = "winner_selected";
  run.completedAt = new Date().toISOString();

  if (storyDriver) {
    storyDriver.ingestSystemEvent({
      type: "ARENA_WINNER_SELECTED",
      refs: {
        arenaId: run.id,
        winnerId: winner.id,
        compositeScore: winner.compositeScore,
        title: run.title,
      },
      source: "arena_mode",
    });
  }

  return winner;
}

app.get("/api/arena/runs", (req, res) => {
  res.json({
    ok: true,
    total: arenaState.runs.length,
    activeRun: arenaState.activeRun ? arenaState.activeRun.id : null,
    runs: arenaState.runs.slice(-20),
    ts: new Date().toISOString(),
  });
});

app.get("/api/arena/active", (req, res) => {
  if (!arenaState.activeRun) return res.json({ ok: true, activeRun: null, ts: new Date().toISOString() });
  res.json({ ok: true, activeRun: arenaState.activeRun, ts: new Date().toISOString() });
});

app.post("/api/arena/create", (req, res) => {
  const { title = "Arena Run", candidates = 3 } = req.body;
  const run = createArenaRun(title, Math.min(Math.max(candidates, 2), 5));
  res.json({ ok: true, run, ts: new Date().toISOString() });
});

app.post("/api/arena/score", (req, res) => {
  const { runId, candidateId, scores } = req.body;
  const run = arenaState.runs.find(r => r.id === runId);
  if (!run) return res.status(404).json({ error: `Arena run ${runId} not found` });
  if (!scores || !candidateId) return res.status(400).json({ error: "candidateId and scores required" });
  const candidate = scoreArenaCandidate(run, candidateId, scores);
  if (!candidate) return res.status(404).json({ error: `Candidate ${candidateId} not found` });
  res.json({ ok: true, candidate, ts: new Date().toISOString() });
});

app.post("/api/arena/select-winner", (req, res) => {
  const { runId } = req.body;
  const run = arenaState.runs.find(r => r.id === runId);
  if (!run) return res.status(404).json({ error: `Arena run ${runId} not found` });
  const winner = selectArenaWinner(run);
  if (!winner) return res.status(400).json({ error: "No scored candidates available" });
  res.json({ ok: true, winner, run, ts: new Date().toISOString() });
});

app.post("/api/arena/squash-merge", (req, res) => {
  const { runId } = req.body;
  const run = arenaState.runs.find(r => r.id === runId);
  if (!run) return res.status(404).json({ error: `Arena run ${runId} not found` });
  if (!run.winner) return res.status(400).json({ error: "No winner selected yet" });

  run.status = "squash_merged";
  const winner = run.candidates.find(c => c.id === run.winner);

  if (storyDriver) {
    storyDriver.ingestSystemEvent({
      type: "ARENA_SQUASH_MERGE",
      refs: {
        arenaId: run.id,
        winnerId: run.winner,
        compositeScore: winner ? winner.compositeScore : 0,
        title: run.title,
      },
      source: "arena_mode",
    });
  }

  arenaState.activeRun = null;

  res.json({
    ok: true,
    action: "squash_merged",
    run,
    commitMessage: `[Arena #${run.id}] ${run.title} — Winner: Candidate ${run.winner} (score: ${winner ? winner.compositeScore : "N/A"})`,
    ts: new Date().toISOString(),
  });
});

app.get("/api/arena/config", (req, res) => {
  const arenaConfig = loadYamlConfig("arena-mode.yaml");
  if (!arenaConfig) return res.status(404).json({ error: "Arena Mode config not found" });
  res.json({ ok: true, ...arenaConfig, ts: new Date().toISOString() });
});

app.get("/api/build-any-app", (req, res) => {
  const baaConfig = loadYamlConfig("build-any-app.yaml");
  if (!baaConfig) return res.status(404).json({ error: "Build Any App config not found" });
  res.json({ ok: true, ...baaConfig, ts: new Date().toISOString() });
});

// ─── Error Handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("HeadyManager Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
    ts: new Date().toISOString(),
  });
});

// ─── SPA Fallback ───────────────────────────────────────────────────
app.get("*", (req, res) => {
  const indexPath = path.join(frontendBuildPath, "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).json({ error: "Not found" });
});

// ─── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ∞ Heady Manager v3.0.0 listening on port ${PORT}`);
  console.log(`  ∞ Health: http://localhost:${PORT}/api/health`);
  console.log(`  ∞ Environment: ${process.env.NODE_ENV || "development"}\n`);
});
