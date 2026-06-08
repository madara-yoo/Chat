import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  Send, 
  Trash2, 
  Download, 
  Sparkles, 
  User, 
  HelpCircle, 
  Laptop, 
  Smartphone, 
  Chrome, 
  X, 
  Menu, 
  Plus, 
  Check, 
  Radio, 
  Users, 
  Bell, 
  Shield, 
  Hash, 
  UserCheck 
} from "lucide-react";
import { APP_INSTRUCTIONS_AR } from "./data";
import { Message } from "./types";

// Suggested preset avatars for users
const AVATAR_PRESETS = ["🦁", "🦊", "🐧", "🦝", "🐨", "🦄", "🐼", "🐸", "🐙", "🐯", "🤖", "🐱", "🐶", "🐹", "🦉", "👑", "🚀", "🎨", "🎮", "⚽", "🍕", "✨"];
const COLOR_PRESETS = [
  { id: "teal", label: "الزمردي", bg: "from-teal-400 to-emerald-500", raw: "teal" },
  { id: "indigo", label: "البنفسجي", bg: "from-indigo-400 to-purple-500", raw: "indigo" },
  { id: "rose", label: "الوردي الساحر", bg: "from-rose-400 to-pink-500", raw: "rose" },
  { id: "amber", label: "الذهبي الدافئ", bg: "from-amber-400 to-orange-500", raw: "amber" },
  { id: "blue", label: "سماء الليل", bg: "from-blue-400 to-indigo-500", raw: "blue" }
];

interface ChatRoom {
  id: string;
  name: string;
  description: string;
}

interface ActiveUser {
  username: string;
  avatar: string;
  color: string;
  lastSeen: number;
}

export default function App() {
  // PWA elements
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<"android" | "ios" | "pc">("android");

  // User Profile
  const [userProfile, setUserProfile] = useState<{ username: string; avatar: string; color: string } | null>(null);
  
  // Registration Form States
  const [regUsername, setRegUsername] = useState("");
  const [regAvatar, setRegAvatar] = useState("🦊");
  const [regColor, setRegColor] = useState("from-teal-400 to-emerald-500");

  // Server Synced App States
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeMembers, setActiveMembers] = useState<ActiveUser[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [serverTimestamp, setServerTimestamp] = useState<number>(0);

  // Active Conversational state
  const [selectedRoomId, setSelectedRoomId] = useState<string>("general");
  const [selectedCompanion, setSelectedCompanion] = useState<ActiveUser | null>(null); // for Direct Messaging

  // General App States
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load of profile, PWA event handlers, and active service workers
  useEffect(() => {
    // Service Worker Registration for PWA caching
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js")
          .then((reg) => console.log("Service Worker registered successfully:", reg.scope))
          .catch((err) => console.log("Service Worker registration failed:", err));
      });
    }

    // Capture install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Load user profile from LocalStorage if exists
    try {
      const savedUser = localStorage.getItem("anis_messenger_user_profile");
      if (savedUser) {
        setUserProfile(JSON.parse(savedUser));
      }
    } catch (e) {
      console.error("Failed to load saved profile", e);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // 2. Active Sync loop via polling
  useEffect(() => {
    if (!userProfile) return;

    // Direct Sync invocation
    const syncApplicationState = async () => {
      try {
        // Send a heartbeat to inform the server we are active
        await fetch("/api/users/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: userProfile.username,
            avatar: userProfile.avatar,
            color: userProfile.color
          })
        });

        // Determine request query properties based on current conversation channel
        let queryParams = "";
        if (selectedCompanion) {
          // Calculate directChatId as sorted usernames to keep it symmetrical
          const companionKey = selectedCompanion.username;
          const userKey = userProfile.username;
          const directId = [userKey, companionKey].sort().join("---");
          queryParams = `directChatId=${encodeURIComponent(directId)}`;
        } else {
          queryParams = `roomId=${encodeURIComponent(selectedRoomId)}`;
        }

        const syncRes = await fetch(`/api/sync?${queryParams}`);
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          setMessages(syncData.messages || []);
          setRooms(syncData.rooms || []);
          // Filter out ourselves from the sidebar active user lists if wanted, but helpful to see presence
          setActiveMembers(syncData.activeUsers || []);
          setServerTimestamp(syncData.serverTime);
        }
      } catch (err) {
        console.error("Sync Cycle Failed:", err);
      }
    };

    // Initial load
    syncApplicationState();

    // Constant fast polling every 1.8 seconds for smooth real-time Messenger vibe
    const interval = setInterval(syncApplicationState, 1800);
    return () => clearInterval(interval);
  }, [userProfile, selectedRoomId, selectedCompanion]);

  // Scroll to latest updates
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, isLoading]);

  // Save profile state handler
  const handleJoinRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = regUsername.trim();
    if (!trimmed) {
      setErrorNotice("الرجاء إدخال اسم مستعار للمتابعة.");
      return;
    }

    const payload = {
      username: trimmed,
      avatar: regAvatar,
      color: regColor
    };

    setUserProfile(payload);
    localStorage.setItem("anis_messenger_user_profile", JSON.stringify(payload));
    setErrorNotice(null);
  };

  // Logout/Switch profile helper
  const handleLogout = () => {
    if (window.confirm("هل ترغب في تغيير ملفك الشخصي أو تسجيل الخروج؟")) {
      localStorage.removeItem("anis_messenger_user_profile");
      setUserProfile(null);
      setRegUsername("");
    }
  };

  // Add a new Room
  const handleCreateNewRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = newRoomName.trim();
    if (!nameTrimmed) return;

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameTrimmed,
          description: newRoomDesc.trim() || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل في إنشاء الغرفة");
      }

      const resData = await res.json();
      setNewRoomName("");
      setNewRoomDesc("");
      setShowCreateRoom(false);
      
      // Select the newly created room automatically
      setSelectedCompanion(null);
      setSelectedRoomId(resData.room.id);
    } catch (err: any) {
      alert(err.message || "حدث خطأ غير متوقع أثناء إضافة الغرفة.");
    }
  };

  // Send message procedure
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const textMsg = inputValue.trim();
    if (!textMsg || !userProfile) return;

    setInputValue("");
    setIsLoading(true);

    // Prepare message structure
    let reqBody: any = {
      content: textMsg,
      sender: {
        username: userProfile.username,
        avatar: userProfile.avatar,
        color: userProfile.color
      }
    };

    if (selectedCompanion) {
      // Symmetrical direct ID format
      const companionKey = selectedCompanion.username;
      const userKey = userProfile.username;
      const directId = [userKey, companionKey].sort().join("---");
      reqBody.directChatId = directId;
    } else {
      reqBody.roomId = selectedRoomId;
    }

    // Optimistic Update locally
    const optimisticMsg = {
      id: `optimistic-${Date.now()}`,
      content: textMsg,
      sender: userProfile,
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      roomId: reqBody.roomId || null,
      directChatId: reqBody.directChatId || null,
      createdAt: Date.now()
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody)
      });

      if (!response.ok) {
        throw new Error("فشلت عملية إرسال الرسالة إلى المخدم.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorNotice("تعذر تسليم الرواية للمخدم. تحقق من تشغيله.");
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Native PWA Install prompt
  const triggerNativeInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User outcome: ${outcome}`);
      setDeferredPrompt(null);
      setIsInstallable(false);
    } else {
      setShowInstallGuide(true);
    }
  };

  // Quick preset messages helper in chat input
  const insertQuickText = (text: string) => {
    setInputValue((prev) => prev ? prev + " " + text : text);
  };

  return (
    <div className="relative h-screen min-h-[100dvh] w-full font-sans overflow-hidden flex flex-col bg-gradient-to-br from-[#120f26] via-[#1d163f] to-[#39123b]" dir="rtl">
      
      {/* Dynamic Glassmorphism Background Blurs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-rose-500/15 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] left-[30%] w-[350px] h-[350px] rounded-full bg-teal-500/10 blur-[110px] pointer-events-none" />

      {/* HEADER BAR */}
      <header className="w-full flex justify-between items-center px-4 md:px-8 py-4 backdrop-blur-md bg-white/[0.03] border-b border-white/10 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {userProfile && (
            <button 
              id="mobile-sidebar-toggle-trigger"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} 
              className="md:hidden p-2 text-white/90 hover:text-white rounded-xl bg-white/5 border border-white/10"
              title="تصفح الغرف والأعضاء"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-rose-500 shadow-lg shadow-indigo-500/25">
            <span className="text-xl">💬</span>
            <div className="absolute bottom-[-1px] right-[-1px] w-3 h-3 bg-emerald-400 border-2 border-[#120f26] rounded-full animate-pulse" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold text-white tracking-wide">أنيس ماسنجر PWA</h1>
            <p className="text-[10px] text-teal-300 font-medium tracking-normal">شات مستخدمين جماعي وخاص قابل للتنزيل كأيقونة 📱💻</p>
          </div>
        </div>

        {/* Global Action Widgets */}
        <div className="flex items-center gap-2">
          {/* Quick installation launcher */}
          <button
            id="pwa-header-install-btn"
            onClick={triggerNativeInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 md:py-2 text-[11px] md:text-xs font-bold text-slate-900 bg-gradient-to-r from-teal-300 to-emerald-400 hover:from-teal-200 hover:to-emerald-300 rounded-xl transition shadow-md shadow-teal-400/10 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ثبت الأيقونة 📥</span>
          </button>

          <button
            id="help-guide-dialog-trigger"
            onClick={() => setShowInstallGuide(true)}
            className="p-1.5 md:p-2 text-white/80 hover:text-white rounded-xl bg-white/5 border border-white/10"
            title="طريقة تثبيت التطبيق"
          >
            <HelpCircle className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* CONDITIONAL SWITCH: GUEST REGISTRATION OR MESSENGER SYSTEM */}
      {!userProfile ? (
        // JOIN WIZARD: BEAUTIFUL FROSTED GLASS REGISTRATION
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden animate-fadeIn text-center">
            {/* Ambient inner card layout */}
            <div className="absolute top-[-20%] left-[-20%] w-52 h-52 bg-[#818cf8]/20 rounded-full blur-[60px]" />
            <div className="relative z-10">
              
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-3xl mx-auto shadow-lg mb-4">
                👋
              </div>
              
              <h2 className="text-xl md:text-2xl font-extrabold text-white">انضم لأنيس ماسنجر!</h2>
              <p className="text-slate-300 text-xs mt-2">اختر اسماً شخصياً وصورة تعبيرية وابدأ الدردشة كأيقونة على الهاتف والكمبيوتر.</p>

              <form onSubmit={handleJoinRegistration} className="mt-6 space-y-4 text-right">
                <div>
                  <label className="block text-xs text-slate-300 font-bold mb-1.5 mr-1 text-right">أدخل اسمك المستعار (أو الاسم الحقيقي):</label>
                  <input
                    id="username-input-register-field"
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="على سبيل المثال: سارة، أحمد البنا، المبرمج الصغير..."
                    maxLength={25}
                    className="w-full text-right bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/15 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm text-white placeholder-slate-400 rounded-2xl px-4 py-3 transition text-center"
                  />
                </div>

                {/* Avatar Presets Selection */}
                <div>
                  <label className="block text-xs text-slate-200 font-bold mb-2 mr-1">اختر الأيقونة / الإيموجي الشخصي المفضل:</label>
                  <div className="grid grid-cols-7 gap-1.5 p-2 bg-black/20 rounded-2xl max-h-24 overflow-y-auto">
                    {AVATAR_PRESETS.map((avatar) => (
                      <button
                        id={`avatar-preset-${avatar}`}
                        key={avatar}
                        type="button"
                        onClick={() => setRegAvatar(avatar)}
                        className={`text-xl p-1.5 rounded-lg transition duration-200 ${
                          regAvatar === avatar ? "bg-indigo-500 scale-110 shadow-md" : "hover:bg-white/10"
                        }`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Scheme Accent Selection */}
                <div>
                  <label className="block text-xs text-slate-200 font-bold mb-2 mr-1">اختر درجة اللون المميزة لرسائلك:</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        id={`color-preset-${color.id}`}
                        key={color.id}
                        type="button"
                        onClick={() => setRegColor(color.bg)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10.5px] border font-bold transition duration-200 ${
                          regColor === color.bg 
                            ? "bg-white/10 text-white border-white" 
                            : "bg-transparent text-slate-300 border-white/10 hover:bg-white/5"
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${color.bg}`} />
                        <span>{color.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {errorNotice && (
                  <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">
                    {errorNotice}
                  </p>
                )}

                <button
                  id="submit-register-join-btn"
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-l from-indigo-500 via-purple-600 to-rose-500 hover:from-indigo-400 hover:to-rose-400 text-white font-bold text-sm rounded-2xl transition duration-300 shadow-lg shadow-indigo-500/20 mt-6 cursor-pointer"
                >
                  حفظ ودخول الشات 🤖🚀
                </button>
              </form>

              <div className="mt-5 text-[10px] text-slate-400 leading-relaxed">
                <p>تثبيت فوري كأيقونة: يتم الاحتفاظ بملفك محلياً كمسجل، وستدخل الغرفة العامة تلقائياً فور الحفظ.</p>
              </div>

            </div>
          </div>
        </div>
      ) : (
        // MAIN PLATFORM
        <div className="flex-1 h-0 min-h-0 w-full max-w-7xl mx-auto p-3 md:p-6 flex flex-col md:flex-row gap-4 overflow-hidden">
          
          {/* SIDEBAR LISTS (Rooms, Active Users, Settings) */}
          <section className={`
            fixed inset-y-0 right-0 z-50 w-72 md:w-80 md:static flex flex-col 
            bg-[#171436]/98 md:bg-white/5 backdrop-blur-2xl md:backdrop-blur-md 
            border-l md:border border-white/15 md:rounded-3xl shadow-2xl transition-all duration-300
            ${mobileSidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
          `}>
            
            {/* User Profile Summary Header */}
            <div className="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-9.5 h-9.5 rounded-xl bg-gradient-to-r ${userProfile.color} flex items-center justify-center text-lg shadow-inner`}>
                  {userProfile.avatar}
                </div>
                <div>
                  <span className="text-white text-xs font-bold block leading-tight">{userProfile.username}</span>
                  <span className="text-[9.5px] text-teal-400 block mt-0.5">الملف الشخصي نشط</span>
                </div>
              </div>
              <button
                id="logout-switch-profile-btn"
                onClick={handleLogout}
                className="p-1.5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 border border-white/5 hover:border-rose-500/20 rounded-lg text-[10px] transition font-bold"
                title="تسجيل الخروج أو التعديل"
              >
                تغيير الحساب
              </button>
            </div>

            {/* Main Tabs Container Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              
              {/* SECTION: Public Chat Rooms */}
              <div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-xs font-bold text-slate-300 tracking-wide flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>الغرف والقنوات العامة ({rooms.length})</span>
                  </span>
                  
                  {/* Create Custom Room button */}
                  <button
                    id="create-custom-room-modal-trigger"
                    onClick={() => setShowCreateRoom(true)}
                    className="p-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-indigo-300 hover:text-indigo-200"
                    title="أنشئ غرفة جديدة"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {rooms.map((room) => {
                    const isSelected = !selectedCompanion && selectedRoomId === room.id;
                    return (
                      <button
                        id={`room-selector-button-${room.id}`}
                        key={room.id}
                        onClick={() => {
                          setSelectedCompanion(null);
                          setSelectedRoomId(room.id);
                          setMobileSidebarOpen(false);
                        }}
                        className={`w-full text-right flex items-start gap-2.5 p-2.5 rounded-xl border transition ${
                          isSelected
                            ? "bg-indigo-600/30 border-indigo-400 text-white font-bold"
                            : "bg-white/5 hover:bg-white/10 border-transparent text-slate-300 hover:text-white"
                        }`}
                      >
                        <Hash className="w-4 h-4 text-indigo-400 mt-1 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{room.name}</p>
                          <p className="text-[9.5px] text-slate-400 truncate mt-0.5">{room.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION: Online Users (Messenger DMs) */}
              <div>
                <span className="text-xs font-bold text-slate-300 tracking-wide flex items-center gap-1 px-1 mb-2">
                  <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                  <span>المتصلون بالرادار ({activeMembers.filter(v => v.username !== userProfile.username).length})</span>
                </span>

                <div className="space-y-1 rounded-2xl bg-black/10 p-1.5 border border-white/5">
                  {/* Default AI bot helper in direct messaging */}
                  <button
                    id="dm-anis-ai-bot-selector"
                    onClick={() => {
                      setSelectedCompanion({
                        username: "أنيس (الذكاء الاصطناعي) 🤖",
                        avatar: "🌸",
                        color: "from-teal-400 to-emerald-400",
                        lastSeen: Date.now()
                      });
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full text-right flex items-center gap-2.5 p-2 rounded-xl border transition ${
                      selectedCompanion?.username === "أنيس (الذكاء الاصطناعي) 🤖"
                        ? "bg-teal-500/20 border-teal-500/50 text-white"
                        : "bg-transparent text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-teal-400 to-emerald-400 flex items-center justify-center text-sm">
                        🌸
                      </div>
                      <div className="absolute bottom-[-1px] right-[-1px] w-2.5 h-2.5 bg-emerald-400 border border-[#171436] rounded-full" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold truncate">أنيس الذكاء الاصطناعي</span>
                        <span className="text-[8px] bg-teal-500/20 text-teal-300 px-1 py-0.5 rounded">بوت ذكي</span>
                      </div>
                      <p className="text-[9px] text-slate-400 truncate">اسألني أي شيء خاص ومباشر ✨</p>
                    </div>
                  </button>

                  {/* List human users who sent heartbeats */}
                  {activeMembers
                    .filter((member) => member.username.trim() !== userProfile.username.trim())
                    .map((member) => {
                      const isSelected = selectedCompanion?.username === member.username;
                      return (
                        <button
                          id={`companion-selector-btn-${member.username}`}
                          key={member.username}
                          onClick={() => {
                            setSelectedCompanion(member);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full text-right flex items-center gap-2.5 p-2 rounded-xl border transition-all duration-200 ${
                            isSelected
                              ? "bg-indigo-600/30 border-indigo-400 text-white"
                              : "bg-transparent text-slate-300 hover:bg-white/5"
                          }`}
                        >
                          <div className="relative shrink-0">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${member.color} flex items-center justify-center text-sm shadow-inner`}>
                              {member.avatar}
                            </div>
                            <div className="absolute bottom-[-1px] right-[-1px] w-2.5 h-2.5 bg-green-400 border border-[#171436] rounded-full animate-pulse" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{member.username}</p>
                            <p className="text-[9px] text-teal-400">نشط الآن في التطبيق</p>
                          </div>
                        </button>
                      );
                    })}

                  {activeMembers.filter(v => v.username !== userProfile.username).length === 0 && (
                    <div className="p-3 text-center">
                      <p className="text-[10px] text-slate-400 leading-relaxed">لا يوجد مستخدمون آخرون متصلون حالياً بالخادم.</p>
                      <p className="text-[8px] text-indigo-300 underline mt-1 cursor-pointer" onClick={() => setShowInstallGuide(true)}>
                        شارك رابط التطبيق ليتصلوا معك! 📤
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Sidebar Footer Controls */}
            <div className="p-4 border-t border-white/10 bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <p className="text-[10.5px] font-bold text-white">تطبيق أنيس ماسنجر</p>
                  <p className="text-[9px] text-slate-400">تثبيت فوري كأيقونة للجوال 📱</p>
                </div>
                {/* Manual guide toggle */}
                <button
                  id="pwa-guide-trigger-sidebar"
                  onClick={() => setShowInstallGuide(true)}
                  className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white hover:bg-white/10 font-bold transition"
                >
                  طريقة التثبيت
                </button>
              </div>
            </div>

          </section>

          {/* MAIN CHAT COMPONENT WINDOW (Messenger Experience) */}
          <section className="flex-1 flex flex-col bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
            
            {/* Header Area */}
            <header className="px-4 md:px-6 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedCompanion ? (
                  // Direct Chat Header
                  <>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${selectedCompanion.color} flex items-center justify-center text-lg shadow-lg`}>
                      {selectedCompanion.avatar}
                    </div>
                    <div>
                      <h2 className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5">
                        <span>محادثة خاصة: {selectedCompanion.username}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      </h2>
                      <p className="text-[10px] text-slate-400">دردشة آمنة ومباشرة بين طرفين</p>
                    </div>
                  </>
                ) : (
                  // Public Room Header
                  <>
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-lg">
                      💬
                    </div>
                    <div>
                      <h2 className="text-xs md:text-sm font-bold text-white">
                        {rooms.find(r => r.id === selectedRoomId)?.name || "المجلس العام 💬"}
                      </h2>
                      <p className="text-[10px] text-slate-400">
                        {rooms.find(r => r.id === selectedRoomId)?.description || "غرفة عامة للأعضاء والمستخدمين"}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Chat Header Actions */}
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block text-[10px] text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-full font-bold">
                  تحديث تلقائي مستمر 🟢
                </span>
                
                {mobileSidebarOpen ? (
                  <button
                    id="mobile-close-sidebar-btn"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="p-1.5 bg-white/5 border border-white/10 rounded-xl text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    id="mobile-open-sidebar-btn"
                    onClick={() => setMobileSidebarOpen(true)}
                    className="md:hidden p-1.5 bg-white/5 border border-white/10 rounded-xl text-white"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                )}
              </div>
            </header>

            {/* MESSAGE HISTORY SCROLLER */}
            <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-4 md:p-6 space-y-4">
              
              {/* Informative notification if they are alone with help option */}
              {messages.length === 0 && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center max-w-md mx-auto my-6 space-y-2">
                  <span className="text-2xl block">💬</span>
                  <p className="text-xs font-bold text-white">سجل الدردشة فارغ هنا</p>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    كن أول من يكتب رسالة في هذا الحقل، أو تواصل مع صديق من المتصلين على اليمين! يمكنك أيضاً كتابة <strong className="text-teal-300 bg-white/5 p-1 rounded">@أنيس</strong> وتجربة رد الذكاء الاصطناعي الفوري هنا.
                  </p>
                </div>
              )}

              {/* Display notices if network issues ever occur */}
              {errorNotice && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-200 text-center">
                  {errorNotice}
                </div>
              )}

              {/* Messages map loop list */}
              {messages.map((msg) => {
                const isMyMessage = msg.sender?.username === userProfile.username;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMyMessage ? "items-start" : "items-end"} w-full animate-fadeIn`}
                  >
                    {/* User identifier and avatar row */}
                    <div className={`flex items-center gap-1.5 mb-1 ${isMyMessage ? "flex-row" : "flex-row-reverse"}`}>
                      <div className={`w-6 h-6 rounded-lg bg-gradient-to-r ${msg.sender?.color || "from-slate-400 to-slate-500"} flex items-center justify-center text-xs shadow-inner`}>
                        {msg.sender?.avatar || "👤"}
                      </div>
                      <span className="text-[10.5px] font-bold text-slate-100">{msg.sender?.username}</span>
                      {isMyMessage && (
                        <span className="text-[8px] bg-indigo-500/25 text-indigo-300 px-1.5 py-0.5 rounded-full">أنت</span>
                      )}
                    </div>

                    {/* Chat Bubble matching exquisite frosted glass mockup */}
                    <div
                      className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-3 md:p-4 text-xs md:text-sm leading-relaxed shadow-lg border transition ${
                        isMyMessage
                          ? "bg-indigo-600/40 backdrop-blur-md border-indigo-400/30 text-white rounded-tr-none"
                          : "bg-white/10 backdrop-blur-md border border-white/10 text-slate-100 rounded-tl-none"
                      }`}
                    >
                      <p className="whitespace-pre-wrap select-text leading-relaxed">
                        {msg.content}
                      </p>
                      
                      <span className="text-[8px] opacity-60 font-mono block mt-1.5 text-left">
                        {msg.timestamp || "اليوم"}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Bot or system typing visual loading indicator */}
              {isLoading && (
                <div className="flex flex-col items-end w-full animate-pulse">
                  <div className="rounded-2xl p-3.5 bg-white/10 text-slate-200 border border-white/15 rounded-tl-none flex items-center gap-2">
                    <span className="text-[11px]">جاري نقل رسالتك للمجموعات...</span>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce delay-75"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce delay-150"></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Scroll anchor reference */}
              <div ref={messageEndRef} />
            </div>

            {/* Quick pre-set messaging options in header bottom helper */}
            <div className="px-4 py-2 border-t border-white/5 bg-white/[0.01] flex flex-wrap gap-1 md:gap-1.5 items-center">
              <span className="text-[10px] font-bold text-indigo-300">عبارات سريعة:</span>
              <button onClick={() => insertQuickText("السلام عليكم ورحمة الله وبركاته 🌹")} className="text-[9.5px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-2.5 py-0.5 text-slate-300 hover:text-white transition">السلام عليكم</button>
              <button onClick={() => insertQuickText("أهلاً بالجميع، كيف الحال اليوم؟ 👋")} className="text-[9.5px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-2.5 py-0.5 text-slate-300 hover:text-white transition">كيف الحال</button>
              <button onClick={() => insertQuickText("جربوا تثبيت واجهة التطبيق كأيقونة على الجوال! 📱")} className="text-[9.5px] bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/20 rounded-full px-2.5 py-0.5 transition">تطبيق PWA</button>
              <button onClick={() => insertQuickText("@أنيس ساعدني في تحسن كتابتي العربية ✨")} className="text-[9.5px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 rounded-full px-2.5 py-0.5 transition font-bold">@أنيس (سؤال ذكي)</button>
            </div>

            {/* KEY MESSAGE INPUT CONTAINER ACCORDING TO MOCKUP */}
            <footer className="p-4 border-t border-white/10 bg-[#161434]/50 backdrop-blur-md">
              <form onSubmit={handleSendMessage} className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-1.5 flex items-center gap-3 shadow-xl">
                
                {/* Send button */}
                <button
                  id="message-send-submit-trigger"
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="w-11 h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-rose-500 disabled:from-indigo-950 disabled:to-indigo-900 text-white disabled:text-white/40 flex items-center justify-center shadow-lg transition transform active:scale-95 shrink-0 cursor-pointer"
                  title="إرسال"
                >
                  <Send className="w-5 h-5 rotate-180" />
                </button>

                <input
                  id="user-typed-message-box"
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    selectedCompanion 
                      ? `اكتب رسالة خاصة لـ ${selectedCompanion.username}...`
                      : `@أنيس استدعاء لرد الذكاء الاصطناعي، أو دردشة مع الغرفة...`
                  }
                  className="flex-grow bg-transparent border-none focus:ring-0 focus:outline-none text-white placeholder-white/40 text-xs md:text-sm py-2 px-1 text-right"
                  dir="rtl"
                />

                {/* Micro Smiley Helper toggle */}
                <button
                  id="happy-smiley-toggle-helper"
                  type="button"
                  onClick={() => insertQuickText("😊")}
                  className="p-2 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition"
                  title="ابتسامة"
                >
                  😊
                </button>
              </form>
            </footer>

          </section>

        </div>
      )}

      {/* CREATE ROOM DRAWER DIALOG MODAL */}
      {showCreateRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-[#130f2c]/95 border border-white/15 rounded-3xl p-6 relative shadow-2xl overflow-hidden text-right">
            
            <div className="flex justify-between items-start border-b border-white/10 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">إنشاء غرفة محادثة عامة جديدة ➕</h3>
                <p className="text-[10px] text-slate-400 mt-1">اسم الغرفة سيكون متاحاً للجميع فوراً للتحدث به في الوقت الفعلي.</p>
              </div>
              <button
                id="close-create-room-btn"
                onClick={() => setShowCreateRoom(false)}
                className="p-1.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewRoomSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 font-bold mb-1 mr-1">اسم الغرفة:</label>
                <input
                  id="new-room-input-name"
                  type="text"
                  required
                  placeholder="مثلاً: عشاق القراءة، هواة البرمجة، حوار حر"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  maxLength={20}
                  className="w-full text-right bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3 text-xs md:text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-bold mb-1 mr-1">وصف موجز للغرفة:</label>
                <input
                  id="new-room-input-description"
                  type="text"
                  maxLength={50}
                  placeholder="مثال: لتبادل الروايات والقصص المفضلة ومناقشتها"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  className="w-full text-right bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3 text-xs md:text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  id="cancel-room-creation-btn"
                  type="button"
                  onClick={() => setShowCreateRoom(false)}
                  className="px-4 py-2 bg-white/5 rounded-2xl text-xs text-slate-300 hover:text-white"
                >
                  إلغاء الأمر
                </button>
                <button
                  id="confirm-submit-room-creation-btn"
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 rounded-2xl text-xs text-white font-bold"
                >
                  تأكيد وإنشاء الغرفة 🚀
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* PWA EASY INSTALLATION OVERLAY DRAWER */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-[#14122d]/95 border border-white/15 rounded-3xl p-6 relative shadow-2xl overflow-hidden text-right">
            
            <div className="absolute top-[-30%] right-[-20%] w-72 h-72 bg-gradient-to-br from-indigo-500/20 to-teal-500/20 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="flex justify-between items-start border-b border-white/10 pb-4 mb-4">
              <div>
                <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                  <span>تنزيل تطبيق أنيس كأيقونة 📲</span>
                  <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-full font-sans tracking-wide">PWA App</span>
                </h3>
                <p className="text-[11px] text-slate-300 mt-1">تطبيق ويب تقدمي يمكن تثبيته كأيقونة مستقلة على هاتفك بدون فك الضغط أو المتاجر!</p>
              </div>
              <button
                id="close-pwa-modal-guide-window"
                onClick={() => setShowInstallGuide(false)}
                className="p-1.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white transition cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Device tabs */}
            <div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded-xl mb-4 text-xs font-semibold">
              <button
                id="platform-tab-android"
                onClick={() => setActiveTab("android")}
                className={`py-2 text-center rounded-lg transition ${
                  activeTab === "android" ? "bg-indigo-600 text-white shadow" : "text-white/60 hover:text-white"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1">
                  <Chrome className="w-3.5 h-3.5" />
                  <span>حقيبة أندرويد</span>
                </div>
              </button>
              <button
                id="platform-tab-ios"
                onClick={() => setActiveTab("ios")}
                className={`py-2 text-center rounded-lg transition ${
                  activeTab === "ios" ? "bg-indigo-600 text-white shadow" : "text-white/60 hover:text-white"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>آيفون (Apple)</span>
                </div>
              </button>
              <button
                id="platform-tab-pc"
                onClick={() => setActiveTab("pc")}
                className={`py-2 text-center rounded-lg transition ${
                  activeTab === "pc" ? "bg-indigo-600 text-white shadow" : "text-white/60 hover:text-white"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1">
                  <Laptop className="w-3.5 h-3.5" />
                  <span>أجهزة الكمبيوتر</span>
                </div>
              </button>
            </div>

            {/* Steps detail list */}
            <div className="space-y-3 py-1">
              {activeTab === "android" && (
                <>
                  <h4 className="text-xs md:text-sm font-bold text-teal-300">{APP_INSTRUCTIONS_AR.android_title}</h4>
                  <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 pr-1 leading-relaxed">
                    {APP_INSTRUCTIONS_AR.android_steps.map((step, idx) => (
                      <li key={idx} className="marker:text-teal-400 marker:font-bold">{step}</li>
                    ))}
                  </ol>
                  {isInstallable && (
                    <div className="mt-4 p-3 bg-teal-500/10 border border-teal-500/20 rounded-2xl flex items-center justify-between">
                      <span className="text-[11px] text-teal-200">مدعوم أوتوماتيكياً على متصفحك الحالي!</span>
                      <button
                        id="native-install-launch-direct"
                        onClick={() => {
                          triggerNativeInstall();
                          setShowInstallGuide(false);
                        }}
                        className="px-3.5 py-1.5 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-[11px] rounded-lg transition"
                      >
                        تنزيل وتثبيت الآن 📥
                      </button>
                    </div>
                  )}
                </>
              )}

              {activeTab === "ios" && (
                <>
                  <h4 className="text-xs md:text-sm font-bold text-teal-300">{APP_INSTRUCTIONS_AR.ios_title}</h4>
                  <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 pr-1 leading-relaxed">
                    {APP_INSTRUCTIONS_AR.ios_steps.map((step, idx) => (
                      <li key={idx} className="marker:text-teal-400 marker:font-bold">{step}</li>
                    ))}
                  </ol>
                  <p className="text-[10px] text-orange-200 bg-orange-500/10 border border-orange-500/20 p-2.5 rounded-xl mt-3 leading-relaxed">
                    تنبيه هام وملاحظة: متصفح سفاري على هواتف آبل هو الحصري للسماح بإضافة وتمرير الروابط للشاشة الرئيسية كأيقونة مستقلة وتبريرها بكامل حجم الشاشة.
                  </p>
                </>
              )}

              {activeTab === "pc" && (
                <>
                  <h4 className="text-xs md:text-sm font-bold text-teal-300">{APP_INSTRUCTIONS_AR.pc_title}</h4>
                  <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 pr-1 leading-relaxed">
                    {APP_INSTRUCTIONS_AR.pc_steps.map((step, idx) => (
                      <li key={idx} className="marker:text-teal-400 marker:font-bold">{step}</li>
                    ))}
                  </ol>
                </>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-white/10 pt-4 mt-5 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <img src="/icon-512.png" alt="أنيس" className="w-8 h-8 rounded-lg shadow border border-white/20" />
                <div className="text-right">
                  <p className="font-bold text-white">أنيس ماسنجر</p>
                  <p className="text-[9px] text-slate-400 font-mono">v1.5 (PWA Installable)</p>
                </div>
              </div>
              <button
                id="guide-confirm-dismiss-btn"
                onClick={() => setShowInstallGuide(false)}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl transition cursor-pointer"
              >
                حسناً، فهمت الطريقة! 👌
              </button>
            </div>

          </div>
        </div>
      )}

      {/* GLOBAL FOOTER */}
      <footer className="w-full text-center py-3 bg-[#0a0c1a] border-t border-white/5 opacity-85 mt-auto text-[9.5px] text-slate-400 flex flex-col md:flex-row justify-center items-center gap-1 md:gap-3">
        <p>صنع بكل حب كـ تطبيق ويب تقدمي (PWA) للكمبيوتر والهاتف 🌸</p>
        <span className="hidden md:inline">|</span>
        <p>التحديثات فورية ومباشرة من خلال مخازن الحفظ اللحظية 🟢</p>
      </footer>

    </div>
  );
}
