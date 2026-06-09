import express from "express";
import path from "path";
import fs from "fs";
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
let activeUsers: Record<string, { username: string; avatar: string; color: string; lastSeen: number; isTypingIn?: string | null }> = {};

// Load persisted data
try {
  if (fs.existsSync(MESSAGES_FILE)) {
    dbMessages = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8"));
  } else {
    // Initial welcome state
    dbMessages = [
      {
        id: "wel-1",
        content: "مرحباً بكم في تطبيق مادارا ماسنجر! 🎉 شات مخصص للمستخدمين يدعم التثبيت على الهاتف كأيقونة مستقلة وبدون برمجيات ذكاء اصطناعي. جرب دعوة أصدقائك بفتح نفس الرابط للتحدث معهم فوراً!",
        sender: { username: "نظام مادارا 👁️", avatar: "🔴", color: "from-rose-600 to-indigo-950" },
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
    const { since = 0, roomId, directChatId, username } = req.query;
    const sinceTime = parseInt(since as string, 10) || 0;

    const cleanUser = (username as string || "").trim().toLowerCase();

    // Mark messages as read by current user
    if (cleanUser) {
      dbMessages.forEach((m) => {
        const isTargetRoom = roomId && m.roomId === roomId;
        const isTargetDM = directChatId && m.directChatId === directChatId;
        const notMe = m.sender?.username?.trim().toLowerCase() !== cleanUser;

        if ((isTargetRoom || isTargetDM) && notMe) {
          if (!m.readBy) {
            m.readBy = [];
          }
          if (!m.readBy.includes(cleanUser)) {
            m.readBy.push(cleanUser);
          }
        }
      });
    }

    // Filter messages according to roomId OR directChatId for current main viewport
    let filtered = dbMessages.filter((m) => m.createdAt > sinceTime);

    if (roomId) {
      filtered = filtered.filter((m) => m.roomId === roomId);
    } else if (directChatId) {
      filtered = filtered.filter((m) => m.directChatId === directChatId);
    } else {
      // If no room is specified, by default return general room chats to prevent sending everything
      filtered = filtered.filter((m) => m.roomId === "general");
    }

    // Filter secure global recent messages for notification flags & badging
    const globalRecent = dbMessages.filter((m) => {
      // Public messages
      if (m.roomId) return true;
      // Private messages must belong to this requesting user
      if (m.directChatId && cleanUser) {
        const parts = m.directChatId.toLowerCase().split("---");
        return parts.includes(cleanUser);
      }
      return false;
    }).slice(-40); // Grab the 40 most recent messages

    res.json({
      messages: filtered,
      rooms: dbRooms,
      activeUsers: Object.values(activeUsers),
      globalRecent: globalRecent,
      serverTime: Date.now()
    });
  });

  // User Heartbeat to broadcast presence
  app.post("/api/users/heartbeat", (req: express.Request, res: express.Response) => {
    const { username, avatar, color, isTypingIn } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    const key = username.trim().toLowerCase();
    activeUsers[key] = {
      username: username.trim(),
      avatar: avatar || "👤",
      color: color || "from-slate-400 to-slate-500",
      lastSeen: Date.now(),
      isTypingIn: isTypingIn || null
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
      const { content, roomId, directChatId, sender, replyToId, replyToSender, replyToContent } = req.body;

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
        replyToId: replyToId || null,
        replyToSender: replyToSender || null,
        replyToContent: replyToContent || null,
        timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        createdAt: Date.now(),
        readBy: []
      };

      dbMessages.push(newMessage);
      persistMessages();

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
