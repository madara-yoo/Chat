import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Default hardcoded rooms
const DEFAULT_ROOMS = [
  { id: "general", name: "المجلس العام 💬", description: "المكان الرئيسي للدردشة العامة والترحيب بالجميع" },
  { id: "tech", name: "ملتقى التقنية 💻", description: "أخبار التكنولوجيا، البرمجة، والتطبيقات الحديثة" },
  { id: "cafe", name: "استراحة القهوة ☕", description: "للحوارات الجانبية، الشعر، ومشاركة كوب اليوم" },
  { id: "gaming", name: "هواة الألعاب 🎮", description: "تحديات الألعاب، البطولات ومناقشة تقييم الألعاب" }
];

// File paths for persistence (Simple JSON Database)
const DATA_DIR = path.join(process.cwd(), "db_data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const ROOMS_FILE = path.join(DATA_DIR, "rooms.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory state fallback / cache
let dbMessages: any[] = [];
let dbRooms: any[] = [...DEFAULT_ROOMS];
let activeUsers: Record<string, { username: string; avatar: string; color: string; lastSeen: number }> = {};

// Load persisted data
try {
  if (fs.existsSync(MESSAGES_FILE)) {
    dbMessages = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8"));
  } else {
    // Initial welcome state
    dbMessages = [
      {
        id: "wel-1",
        content: "مرحباً بكم في تطبيق أنيس ماسنجر! 🎉 شات مخصص للمستخدمين يدعم التثبيت على الهاتف كأيقونة مستقلة. جرب دعوة أصدقائك بفتح نفس الرابط للتحدث معهم فوراً!",
        sender: { username: "نظام أنيس", avatar: "📢", color: "from-teal-500 to-indigo-500" },
        roomId: "general",
        timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        createdAt: Date.now()
      }
    ];
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(dbMessages, null, 2));
  }
} catch (e) {
  console.error("Failed to load messages database, using memory cache", e);
}

try {
  if (fs.existsSync(ROOMS_FILE)) {
    dbRooms = JSON.parse(fs.readFileSync(ROOMS_FILE, "utf-8"));
  } else {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(dbRooms, null, 2));
  }
} catch (e) {
  console.error("Failed to load rooms database, using memory cache", e);
}

// Save helpers
function persistMessages() {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(dbMessages, null, 2));
  } catch (err) {
    console.error("Failed to persist messages", err);
  }
}

function persistRooms() {
  try {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(dbRooms, null, 2));
  } catch (err) {
    console.error("Failed to persist rooms", err);
  }
}

// Gemini AI Setup (for smart AI assistance)
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return aiClient;
}

// System Persona instructions for the AI agent
const AI_SYSTEM_INSTRUCTION = `
أنت 'أنيس الذكي'، مساعد مدمج في تطبيق "أنيس ماسنجر" للمستخدمين.
عندما يناديك المستخدم بـ @أنيس أو يتحدث معك في روم خاص، قم بالإجابة عليه بطريقة دافئة ومختصرة باللغة العربية الفصحى الجميلة وبشكل يناسب طبيعة الماسنجر السريعة.
استخدم الرموز التعبيرية 🌸✨💻 لتبدو ودوداً. يرجى ألا تتجاوز إجاباتك طول رسالة شات نموذجية (فقرة أو فقرتين كحد أقصى).
`;

async function triggerAIBotResponse(messageContent: string, replyToRoomId?: string, replyToDirectId?: string, userNickname?: string) {
  const ai = getGeminiClient();
  if (!ai) return;

  try {
    // Generate simple AI response
    const cleanedPrompt = messageContent.replace(/@أنيس/gi, "").trim();
    
    // Call Gemini Flash
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: `المرسل: ${userNickname || "شخص ما"}\nالرسالة: ${cleanedPrompt}` }] }
      ],
      config: {
        systemInstruction: AI_SYSTEM_INSTRUCTION,
        temperature: 0.8,
      }
    });

    const replyText = result.text || "أهلاً بك! لم أستطع فهم رسالتك بوضوح، ولكنني هنا دوماً لمساعدتك ✨";

    const aiMessage = {
      id: `ai-${Date.now()}`,
      content: replyText,
      sender: { username: "أنيس (الذكاء الاصطناعي) 🤖", avatar: "🌸", color: "from-teal-400 to-emerald-400" },
      roomId: replyToRoomId || null,
      directChatId: replyToDirectId || null,
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      createdAt: Date.now()
    };

    dbMessages.push(aiMessage);
    persistMessages();
  } catch (err) {
    console.error("Error invoking Gemini Bot helper:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Clean stale users every 15 seconds (inactive for more than 20 seconds)
  setInterval(() => {
    const now = Date.now();
    Object.keys(activeUsers).forEach((key) => {
      if (now - activeUsers[key].lastSeen > 20000) {
        delete activeUsers[key];
      }
    });
  }, 10000);

  // --- API Routes ---

  // Get general status
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", activeUsersCount: Object.keys(activeUsers).length });
  });

  // Get app global state (Active Users, Rooms, Messages)
  app.get("/api/sync", (req: express.Request, res: express.Response) => {
    const { since = 0, roomId, directChatId } = req.query;
    const sinceTime = parseInt(since as string, 10) || 0;

    // Filter messages according to roomId OR directChatId
    let filtered = dbMessages.filter((m) => m.createdAt > sinceTime);

    if (roomId) {
      filtered = filtered.filter((m) => m.roomId === roomId);
    } else if (directChatId) {
      filtered = filtered.filter((m) => m.directChatId === directChatId);
    } else {
      // If no room is specified, by default return general room chats to prevent sending everything
      filtered = filtered.filter((m) => m.roomId === "general");
    }

    res.json({
      messages: filtered,
      rooms: dbRooms,
      activeUsers: Object.values(activeUsers),
      serverTime: Date.now()
    });
  });

  // User Heartbeat to broadcast presence
  app.post("/api/users/heartbeat", (req: express.Request, res: express.Response) => {
    const { username, avatar, color } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    const key = username.trim().toLowerCase();
    activeUsers[key] = {
      username: username.trim(),
      avatar: avatar || "👤",
      color: color || "from-slate-400 to-slate-500",
      lastSeen: Date.now()
    };

    res.json({ success: true, count: Object.keys(activeUsers).length });
  });

  // Create a new chat room
  app.post("/api/rooms", (req: express.Request, res: express.Response) => {
    const { name, description } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Room name is required" });
    }

    const cleanName = name.trim();
    const cleanId = cleanName.toLowerCase()
      .replace(/[^\w\u0600-\u06FF\s]/g, "") // support both english and arabic alphanumerics
      .replace(/\s+/g, "-");

    const exists = dbRooms.find((r) => r.id === cleanId || r.name === cleanName);
    if (exists) {
      return res.status(400).json({ error: "اسم الحصيلة أو الغرفة موجود بالفعل!" });
    }

    const newRoom = {
      id: cleanId || `room-${Date.now()}`,
      name: cleanName,
      description: description || "غرفة مستخدمين مخصصة تم إنشاؤها حديثاً"
    };

    dbRooms.push(newRoom);
    persistRooms();

    // Broadcast creation message to general room
    dbMessages.push({
      id: `sys-room-${Date.now()}`,
      content: `📢 تم إنشاء غرفة محادثة عامة جديدة: **${cleanName}**! انضموا للمحادثة هناك.`,
      sender: { username: "النظام", avatar: "🛠️", color: "from-teal-500 to-indigo-500" },
      roomId: "general",
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      createdAt: Date.now()
    });
    persistMessages();

    res.json({ success: true, room: newRoom });
  });

  // Post a new message
  app.post("/api/messages", async (req: express.Request, res: express.Response) => {
    try {
      const { content, roomId, directChatId, sender } = req.body;

      if (!content || !sender || !sender.username) {
        return res.status(400).json({ error: "Content and sender details are required" });
      }

      const newMessage = {
        id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        content: content.trim(),
        sender: {
          username: sender.username.trim(),
          avatar: sender.avatar || "👤",
          color: sender.color || "from-purple-500 to-indigo-500"
        },
        roomId: roomId || null,
        directChatId: directChatId || null,
        timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        createdAt: Date.now()
      };

      dbMessages.push(newMessage);
      persistMessages();

      // Check if user is invoking the smart AI bot
      // summons either via "@أنيس" in any public channel OR if sending a private message to user "أنيس" (directChatId containing "-أنيس" or "أنيس-")
      const mentionsAI = content.includes("@أنيس") || content.includes("@anis");
      const isPrivateAI = directChatId && (
        directChatId.toLowerCase().includes("أنيس") || 
        directChatId.toLowerCase().includes("anis")
      );

      if (mentionsAI || isPrivateAI) {
        // Fire response in background non-blocking, so user sees their message sent instantly
        triggerAIBotResponse(content, roomId, directChatId, sender.username);
      }

      return res.json({ success: true, message: newMessage });

    } catch (err: any) {
      console.error("Failed to post message", err);
      return res.status(500).json({ error: "Internal server error posting message." });
    }
  });

  // Vite middleware for dev or serving built site
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Messenger Server] Listening dynamically on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Full startup cycle crashed:", err);
});
