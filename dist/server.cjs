var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var DEFAULT_ROOMS = [
  { id: "general", name: "\u0627\u0644\u0645\u062C\u0644\u0633 \u0627\u0644\u0639\u0627\u0645 \u{1F4AC}", description: "\u0627\u0644\u0645\u0643\u0627\u0646 \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0644\u0644\u062F\u0631\u062F\u0634\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u062A\u0631\u062D\u064A\u0628 \u0628\u0627\u0644\u062C\u0645\u064A\u0639" },
  { id: "tech", name: "\u0645\u0644\u062A\u0642\u0649 \u0627\u0644\u062A\u0642\u0646\u064A\u0629 \u{1F4BB}", description: "\u0623\u062E\u0628\u0627\u0631 \u0627\u0644\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627\u060C \u0627\u0644\u0628\u0631\u0645\u062C\u0629\u060C \u0648\u0627\u0644\u062A\u0637\u0628\u064A\u0642\u0627\u062A \u0627\u0644\u062D\u062F\u064A\u062B\u0629" },
  { id: "cafe", name: "\u0627\u0633\u062A\u0631\u0627\u062D\u0629 \u0627\u0644\u0642\u0647\u0648\u0629 \u2615", description: "\u0644\u0644\u062D\u0648\u0627\u0631\u0627\u062A \u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0629\u060C \u0627\u0644\u0634\u0639\u0631\u060C \u0648\u0645\u0634\u0627\u0631\u0643\u0629 \u0643\u0648\u0628 \u0627\u0644\u064A\u0648\u0645" },
  { id: "gaming", name: "\u0647\u0648\u0627\u0629 \u0627\u0644\u0623\u0644\u0639\u0627\u0628 \u{1F3AE}", description: "\u062A\u062D\u062F\u064A\u0627\u062A \u0627\u0644\u0623\u0644\u0639\u0627\u0628\u060C \u0627\u0644\u0628\u0637\u0648\u0644\u0627\u062A \u0648\u0645\u0646\u0627\u0642\u0634\u0629 \u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0623\u0644\u0639\u0627\u0628" }
];
var DATA_DIR = import_path.default.join(process.cwd(), "db_data");
var MESSAGES_FILE = import_path.default.join(DATA_DIR, "messages.json");
var ROOMS_FILE = import_path.default.join(DATA_DIR, "rooms.json");
if (!import_fs.default.existsSync(DATA_DIR)) {
  import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
}
var dbMessages = [];
var dbRooms = [...DEFAULT_ROOMS];
var activeUsers = {};
try {
  if (import_fs.default.existsSync(MESSAGES_FILE)) {
    dbMessages = JSON.parse(import_fs.default.readFileSync(MESSAGES_FILE, "utf-8"));
  } else {
    dbMessages = [
      {
        id: "wel-1",
        content: "\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643\u0645 \u0641\u064A \u062A\u0637\u0628\u064A\u0642 \u0623\u0646\u064A\u0633 \u0645\u0627\u0633\u0646\u062C\u0631! \u{1F389} \u0634\u0627\u062A \u0645\u062E\u0635\u0635 \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u064A\u062F\u0639\u0645 \u0627\u0644\u062A\u062B\u0628\u064A\u062A \u0639\u0644\u0649 \u0627\u0644\u0647\u0627\u062A\u0641 \u0643\u0623\u064A\u0642\u0648\u0646\u0629 \u0645\u0633\u062A\u0642\u0644\u0629. \u062C\u0631\u0628 \u062F\u0639\u0648\u0629 \u0623\u0635\u062F\u0642\u0627\u0626\u0643 \u0628\u0641\u062A\u062D \u0646\u0641\u0633 \u0627\u0644\u0631\u0627\u0628\u0637 \u0644\u0644\u062A\u062D\u062F\u062B \u0645\u0639\u0647\u0645 \u0641\u0648\u0631\u0627\u064B!",
        sender: { username: "\u0646\u0638\u0627\u0645 \u0623\u0646\u064A\u0633", avatar: "\u{1F4E2}", color: "from-teal-500 to-indigo-500" },
        roomId: "general",
        timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        createdAt: Date.now()
      }
    ];
    import_fs.default.writeFileSync(MESSAGES_FILE, JSON.stringify(dbMessages, null, 2));
  }
} catch (e) {
  console.error("Failed to load messages database, using memory cache", e);
}
try {
  if (import_fs.default.existsSync(ROOMS_FILE)) {
    dbRooms = JSON.parse(import_fs.default.readFileSync(ROOMS_FILE, "utf-8"));
  } else {
    import_fs.default.writeFileSync(ROOMS_FILE, JSON.stringify(dbRooms, null, 2));
  }
} catch (e) {
  console.error("Failed to load rooms database, using memory cache", e);
}
function persistMessages() {
  try {
    import_fs.default.writeFileSync(MESSAGES_FILE, JSON.stringify(dbMessages, null, 2));
  } catch (err) {
    console.error("Failed to persist messages", err);
  }
}
function persistRooms() {
  try {
    import_fs.default.writeFileSync(ROOMS_FILE, JSON.stringify(dbRooms, null, 2));
  } catch (err) {
    console.error("Failed to persist rooms", err);
  }
}
var aiClient = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new import_genai.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
    }
  }
  return aiClient;
}
var AI_SYSTEM_INSTRUCTION = `
\u0623\u0646\u062A '\u0623\u0646\u064A\u0633 \u0627\u0644\u0630\u0643\u064A'\u060C \u0645\u0633\u0627\u0639\u062F \u0645\u062F\u0645\u062C \u0641\u064A \u062A\u0637\u0628\u064A\u0642 "\u0623\u0646\u064A\u0633 \u0645\u0627\u0633\u0646\u062C\u0631" \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646.
\u0639\u0646\u062F\u0645\u0627 \u064A\u0646\u0627\u062F\u064A\u0643 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0640 @\u0623\u0646\u064A\u0633 \u0623\u0648 \u064A\u062A\u062D\u062F\u062B \u0645\u0639\u0643 \u0641\u064A \u0631\u0648\u0645 \u062E\u0627\u0635\u060C \u0642\u0645 \u0628\u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0639\u0644\u064A\u0647 \u0628\u0637\u0631\u064A\u0642\u0629 \u062F\u0627\u0641\u0626\u0629 \u0648\u0645\u062E\u062A\u0635\u0631\u0629 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0641\u0635\u062D\u0649 \u0627\u0644\u062C\u0645\u064A\u0644\u0629 \u0648\u0628\u0634\u0643\u0644 \u064A\u0646\u0627\u0633\u0628 \u0637\u0628\u064A\u0639\u0629 \u0627\u0644\u0645\u0627\u0633\u0646\u062C\u0631 \u0627\u0644\u0633\u0631\u064A\u0639\u0629.
\u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0631\u0645\u0648\u0632 \u0627\u0644\u062A\u0639\u0628\u064A\u0631\u064A\u0629 \u{1F338}\u2728\u{1F4BB} \u0644\u062A\u0628\u062F\u0648 \u0648\u062F\u0648\u062F\u0627\u064B. \u064A\u0631\u062C\u0649 \u0623\u0644\u0627 \u062A\u062A\u062C\u0627\u0648\u0632 \u0625\u062C\u0627\u0628\u0627\u062A\u0643 \u0637\u0648\u0644 \u0631\u0633\u0627\u0644\u0629 \u0634\u0627\u062A \u0646\u0645\u0648\u0630\u062C\u064A\u0629 (\u0641\u0642\u0631\u0629 \u0623\u0648 \u0641\u0642\u0631\u062A\u064A\u0646 \u0643\u062D\u062F \u0623\u0642\u0635\u0649).
`;
async function triggerAIBotResponse(messageContent, replyToRoomId, replyToDirectId, userNickname) {
  const ai = getGeminiClient();
  if (!ai) return;
  try {
    const cleanedPrompt = messageContent.replace(/@أنيس/gi, "").trim();
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: `\u0627\u0644\u0645\u0631\u0633\u0644: ${userNickname || "\u0634\u062E\u0635 \u0645\u0627"}
\u0627\u0644\u0631\u0633\u0627\u0644\u0629: ${cleanedPrompt}` }] }
      ],
      config: {
        systemInstruction: AI_SYSTEM_INSTRUCTION,
        temperature: 0.8
      }
    });
    const replyText = result.text || "\u0623\u0647\u0644\u0627\u064B \u0628\u0643! \u0644\u0645 \u0623\u0633\u062A\u0637\u0639 \u0641\u0647\u0645 \u0631\u0633\u0627\u0644\u062A\u0643 \u0628\u0648\u0636\u0648\u062D\u060C \u0648\u0644\u0643\u0646\u0646\u064A \u0647\u0646\u0627 \u062F\u0648\u0645\u0627\u064B \u0644\u0645\u0633\u0627\u0639\u062F\u062A\u0643 \u2728";
    const aiMessage = {
      id: `ai-${Date.now()}`,
      content: replyText,
      sender: { username: "\u0623\u0646\u064A\u0633 (\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A) \u{1F916}", avatar: "\u{1F338}", color: "from-teal-400 to-emerald-400" },
      roomId: replyToRoomId || null,
      directChatId: replyToDirectId || null,
      timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      createdAt: Date.now()
    };
    dbMessages.push(aiMessage);
    persistMessages();
  } catch (err) {
    console.error("Error invoking Gemini Bot helper:", err);
  }
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  setInterval(() => {
    const now = Date.now();
    Object.keys(activeUsers).forEach((key) => {
      if (now - activeUsers[key].lastSeen > 2e4) {
        delete activeUsers[key];
      }
    });
  }, 1e4);
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", activeUsersCount: Object.keys(activeUsers).length });
  });
  app.get("/api/sync", (req, res) => {
    const { since = 0, roomId, directChatId } = req.query;
    const sinceTime = parseInt(since, 10) || 0;
    let filtered = dbMessages.filter((m) => m.createdAt > sinceTime);
    if (roomId) {
      filtered = filtered.filter((m) => m.roomId === roomId);
    } else if (directChatId) {
      filtered = filtered.filter((m) => m.directChatId === directChatId);
    } else {
      filtered = filtered.filter((m) => m.roomId === "general");
    }
    res.json({
      messages: filtered,
      rooms: dbRooms,
      activeUsers: Object.values(activeUsers),
      serverTime: Date.now()
    });
  });
  app.post("/api/users/heartbeat", (req, res) => {
    const { username, avatar, color } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const key = username.trim().toLowerCase();
    activeUsers[key] = {
      username: username.trim(),
      avatar: avatar || "\u{1F464}",
      color: color || "from-slate-400 to-slate-500",
      lastSeen: Date.now()
    };
    res.json({ success: true, count: Object.keys(activeUsers).length });
  });
  app.post("/api/rooms", (req, res) => {
    const { name, description } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Room name is required" });
    }
    const cleanName = name.trim();
    const cleanId = cleanName.toLowerCase().replace(/[^\w\u0600-\u06FF\s]/g, "").replace(/\s+/g, "-");
    const exists = dbRooms.find((r) => r.id === cleanId || r.name === cleanName);
    if (exists) {
      return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u062D\u0635\u064A\u0644\u0629 \u0623\u0648 \u0627\u0644\u063A\u0631\u0641\u0629 \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0641\u0639\u0644!" });
    }
    const newRoom = {
      id: cleanId || `room-${Date.now()}`,
      name: cleanName,
      description: description || "\u063A\u0631\u0641\u0629 \u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0645\u062E\u0635\u0635\u0629 \u062A\u0645 \u0625\u0646\u0634\u0627\u0624\u0647\u0627 \u062D\u062F\u064A\u062B\u0627\u064B"
    };
    dbRooms.push(newRoom);
    persistRooms();
    dbMessages.push({
      id: `sys-room-${Date.now()}`,
      content: `\u{1F4E2} \u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u063A\u0631\u0641\u0629 \u0645\u062D\u0627\u062F\u062B\u0629 \u0639\u0627\u0645\u0629 \u062C\u062F\u064A\u062F\u0629: **${cleanName}**! \u0627\u0646\u0636\u0645\u0648\u0627 \u0644\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0647\u0646\u0627\u0643.`,
      sender: { username: "\u0627\u0644\u0646\u0638\u0627\u0645", avatar: "\u{1F6E0}\uFE0F", color: "from-teal-500 to-indigo-500" },
      roomId: "general",
      timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      createdAt: Date.now()
    });
    persistMessages();
    res.json({ success: true, room: newRoom });
  });
  app.post("/api/messages", async (req, res) => {
    try {
      const { content, roomId, directChatId, sender } = req.body;
      if (!content || !sender || !sender.username) {
        return res.status(400).json({ error: "Content and sender details are required" });
      }
      const newMessage = {
        id: `msg-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
        content: content.trim(),
        sender: {
          username: sender.username.trim(),
          avatar: sender.avatar || "\u{1F464}",
          color: sender.color || "from-purple-500 to-indigo-500"
        },
        roomId: roomId || null,
        directChatId: directChatId || null,
        timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        createdAt: Date.now()
      };
      dbMessages.push(newMessage);
      persistMessages();
      const mentionsAI = content.includes("@\u0623\u0646\u064A\u0633") || content.includes("@anis");
      const isPrivateAI = directChatId && (directChatId.toLowerCase().includes("\u0623\u0646\u064A\u0633") || directChatId.toLowerCase().includes("anis"));
      if (mentionsAI || isPrivateAI) {
        triggerAIBotResponse(content, roomId, directChatId, sender.username);
      }
      return res.json({ success: true, message: newMessage });
    } catch (err) {
      console.error("Failed to post message", err);
      return res.status(500).json({ error: "Internal server error posting message." });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Messenger Server] Listening dynamically on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Full startup cycle crashed:", err);
});
//# sourceMappingURL=server.cjs.map
