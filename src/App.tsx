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
  UserCheck,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  CornerUpLeft,
  Volume2,
  VolumeX,
  MessageCircle
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
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [selectedCompanion, setSelectedCompanion] = useState<ActiveUser | null>(null); // for Direct Messaging

  // Reply - Unread count - WebRTC Call States
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [enableSoundAlert, setEnableSoundAlert] = useState<boolean>(true);
  const [activeCall, setActiveCall] = useState<{
    isCalling: boolean;
    isIncoming: boolean;
    isConnected: boolean;
    companionName: string;
    companionAvatar: string;
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
  } | null>(null);

  // General App States
  const [inputValue, setInputValue] = useState("");
  const [localIsTyping, setLocalIsTyping] = useState<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // WebRTC refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // Notification filter timeline
  const lastMessageProcessedTimeRef = useRef<number>(Date.now());

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

  // 1b. Request Notification permissions and clear unread counts when active viewport shifts
  useEffect(() => {
    if (!userProfile) return;
    
    // Clear unreads for active screen
    const targetKey = selectedCompanion 
      ? `dm-${selectedCompanion.username}` 
      : `room-${selectedRoomId}`;
      
    if (unreadCounts[targetKey]) {
      setUnreadCounts((prev) => {
        const copy = { ...prev };
        delete copy[targetKey];
        return copy;
      });
    }
  }, [selectedRoomId, selectedCompanion, userProfile]);

  // Play synthesized notification beep using Web Audio API (cross-device & reliable)
  const playModernNotificationAlert = () => {
    if (!enableSoundAlert) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = "sine";
      // Elegant futuristic tone progression
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      oscillator.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.08); // A5

      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.35);
    } catch (err) {
      console.warn("Audio Context playback disabled or blocked", err);
    }
  };

  // Trigger HTML5 Desktop Notification (excellent when PWA is running or minimized)
  const triggerDesktopWebNotification = (msg: any) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      try {
        const notificationTitle = `رسالة جديدة من ${msg.sender?.username || "شخص ما"} 💬`;
        const notification = new Notification(notificationTitle, {
          body: msg.content,
          icon: "/icon-192.png",
          tag: msg.id,
          renotify: true
        } as any);

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (err) {
        console.warn("Failed to issue browser Notification", err);
      }
    }
  };

  // Gracefully request notification permissions
  const requestNotificationPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        console.log("Desktop Notification status:", permission);
      });
    }
  };

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
            color: userProfile.color,
            isTypingIn: localIsTyping 
              ? (selectedCompanion ? `dm-${userProfile.username}` : `room-${selectedRoomId}`) 
              : null
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

        const syncRes = await fetch(`/api/sync?${queryParams}&username=${encodeURIComponent(userProfile.username)}`);
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          setMessages(syncData.messages || []);
          setRooms(syncData.rooms || []);
          setActiveMembers(syncData.activeUsers || []);
          setServerTimestamp(syncData.serverTime);

          // Alert & Badge Handler for other channels
          const recentGlobal = syncData.globalRecent || [];
          if (recentGlobal.length > 0) {
            let shouldPlayAlert = false;
            let lastMessage: any = null;

            recentGlobal.forEach((m: any) => {
              if (m.sender?.username === userProfile.username) return;

              // Only process brand new messages
              if (m.createdAt > lastMessageProcessedTimeRef.current) {
                // Determine if this belongs to current view
                let isCurrentViewport = false;
                if (selectedCompanion) {
                  const companionKey = selectedCompanion.username;
                  const userKey = userProfile.username;
                  const currentDirectId = [userKey, companionKey].sort().join("---");
                  isCurrentViewport = m.directChatId === currentDirectId;
                } else {
                  isCurrentViewport = m.roomId === selectedRoomId;
                }

                // If not current view, increase unread offset
                if (!isCurrentViewport) {
                  const badgeKey = m.roomId ? `room-${m.roomId}` : `dm-${m.sender?.username}`;
                  setUnreadCounts((prev) => ({
                    ...prev,
                    [badgeKey]: (prev[badgeKey] || 0) + 1
                  }));
                }

                shouldPlayAlert = true;
                lastMessage = m;
              }
            });

            // Keep reference updated to avoid repeating alerts on old messages
            const newestTime = Math.max(...recentGlobal.map((m: any) => m.createdAt));
            if (newestTime > lastMessageProcessedTimeRef.current) {
              lastMessageProcessedTimeRef.current = newestTime;
            }

            if (shouldPlayAlert && lastMessage) {
              playModernNotificationAlert();
              triggerDesktopWebNotification(lastMessage);
            }
          }
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
  }, [userProfile, selectedRoomId, selectedCompanion, enableSoundAlert, localIsTyping]);

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

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setLocalIsTyping(false);

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

    if (replyingTo) {
      reqBody.replyToId = replyingTo.id;
      reqBody.replyToSender = replyingTo.sender?.username;
      reqBody.replyToContent = replyingTo.content;
    }

    // Optimistic Update locally
    const optimisticMsg = {
      id: `optimistic-${Date.now()}`,
      content: textMsg,
      sender: userProfile,
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      roomId: reqBody.roomId || null,
      directChatId: reqBody.directChatId || null,
      replyToId: replyingTo ? replyingTo.id : null,
      replyToSender: replyingTo ? replyingTo.sender?.username : null,
      replyToContent: replyingTo ? replyingTo.content : null,
      createdAt: Date.now()
    };
    
    setMessages((prev) => [...prev, optimisticMsg]);
    setReplyingTo(null);

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

  // Start Voice & Video Call
  const startLiveCall = async (companionName: string, companionAvatar: string, withVideo: boolean = true) => {
    setActiveCall({
      isCalling: true,
      isIncoming: false,
      isConnected: false,
      companionName,
      companionAvatar,
      isVideoEnabled: withVideo,
      isAudioEnabled: true
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true });
      localStreamRef.current = stream;
      
      // Assign stream to HTML video elements asynchronously once modal mounts
      setTimeout(() => {
        if (localVideoRef.current && withVideo) {
          localVideoRef.current.srcObject = stream;
        }
      }, 500);

      // Simulate connection setup & peer hook
      setTimeout(() => {
        setActiveCall(prev => prev ? { ...prev, isConnected: true } : null);
        setTimeout(() => {
          if (remoteVideoRef.current && stream && withVideo) {
            remoteVideoRef.current.srcObject = stream;
          }
        }, 500);
      }, 2500);

    } catch (err) {
      console.error("Camera/Mic Permission Denied", err);
      setErrorNotice("لم يتم منح صلاحية المايكروفون أو الكاميرا لبدء الاتصال.");
      endLiveCall();
    }
  };

  const toggleVideoInCall = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const newState = !videoTracks[0].enabled;
        videoTracks[0].enabled = newState;
        setActiveCall(prev => prev ? { ...prev, isVideoEnabled: newState } : null);
      }
    }
  };

  const toggleAudioInCall = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const newState = !audioTracks[0].enabled;
        audioTracks[0].enabled = newState;
        setActiveCall(prev => prev ? { ...prev, isAudioEnabled: newState } : null);
      }
    }
  };

  const endLiveCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setActiveCall(null);
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

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setLocalIsTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setLocalIsTyping(false);
    }, 3000);
  };

  const typingUsers = activeMembers.filter((m) => {
    const isMe = m.username?.trim().toLowerCase() === userProfile?.username?.trim().toLowerCase();
    if (isMe) return false;

    if (selectedCompanion) {
      return m.username === selectedCompanion.username && m.isTypingIn === `dm-${userProfile?.username}`;
    } else {
      return m.isTypingIn === `room-${selectedRoomId}`;
    }
  });

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
              className="md:hidden p-2.5 text-white bg-indigo-600 hover:bg-indigo-550 rounded-full border border-indigo-400 shadow-lg animate-pulse cursor-pointer transition-all active:scale-95 flex items-center justify-center shrink-0"
              title="تصفح الغرف والأعضاء 👥"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div 
            onClick={() => {
              if (userProfile) {
                setSelectedRoomId("");
                setSelectedCompanion(null);
              }
            }}
            className={`flex items-center gap-3 ${userProfile ? "cursor-pointer select-none hover:opacity-85 active:scale-98 transition" : ""}`}
            title={userProfile ? "العودة للرئيسية ورادار الأعضاء 👁️" : undefined}
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[#1c1236] border-2 border-purple-500/50 shadow-lg shadow-purple-500/25 shrink-0">
              {/* Rinnegan SVG logo of Madara Uchiha */}
              <svg viewBox="0 0 100 100" className="w-9 h-9 select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="45" fill="#58487a" />
                <circle cx="50" cy="50" r="36" fill="none" stroke="#251a3d" strokeWidth="2.5" />
                <circle cx="50" cy="50" r="27" fill="#695594" stroke="#251a3d" strokeWidth="2.5" />
                <circle cx="50" cy="50" r="18" fill="none" stroke="#251a3d" strokeWidth="2.5" />
                <circle cx="50" cy="50" r="10" fill="#140b22" />
                <circle cx="50" cy="50" r="3" fill="#ffffff" opacity="0.6" />
              </svg>
              <div className="absolute bottom-[-1px] right-[-1px] w-3 h-3 bg-rose-500 border-2 border-[#120f26] rounded-full animate-pulse" />
            </div>
            <div className="text-right">
              <h1 className="text-base md:text-lg font-bold text-white tracking-wide flex items-center gap-1.5">مادارا شات 👁️</h1>
              <p className="text-[10px] text-teal-300 font-medium tracking-normal">دردشة وتواصل جماعي وفردي آمن - مشفر ومثبت بالكامل 📱💻</p>
            </div>
          </div>
        </div>

        {/* Global Action Widgets */}
        <div className="flex items-center gap-2">
          {/* Quick installation launcher */}
          <button
            id="pwa-header-install-btn"
            onClick={triggerNativeInstall}
            className="p-2.5 text-slate-900 bg-gradient-to-r from-teal-300 to-emerald-400 hover:from-teal-200 hover:to-emerald-300 rounded-full transition shadow-md shadow-teal-400/20 cursor-pointer flex items-center justify-center shrink-0"
            title="تثبيت التطبيق كأيقونة مستقلة للجوال والكمبيوتر 📥"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            id="help-guide-dialog-trigger"
            onClick={() => setShowInstallGuide(true)}
            className="p-2.5 text-white/80 hover:text-white rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center shrink-0 cursor-pointer"
            title="طريقة تثبيت التطبيق"
          >
            <HelpCircle className="w-4 h-4" />
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
            
            {/* Mobile Close Bar at top of sidebar */}
            <div className="md:hidden flex items-center justify-between p-3.5 bg-gradient-to-l from-indigo-950 to-slate-900 border-b border-white/10">
              <span className="text-white text-xs font-bold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>قائمة المحادثات والأنشطة 👥</span>
              </span>
              <button
                id="sidebar-internal-close-btn"
                onClick={() => setMobileSidebarOpen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[11px] rounded-xl cursor-pointer shadow-md shadow-rose-600/20 active:scale-95 transition"
              >
                <span>إخفاء القائمة ✕</span>
              </button>
            </div>
            
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
                    const unread = unreadCounts[`room-${room.id}`];
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between w-full">
                            <p className="text-xs font-bold truncate">{room.name}</p>
                            {unread ? (
                              <span className="bg-gradient-to-r from-rose-500 to-pink-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">
                                {unread}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[9px] text-slate-400 truncate mt-0.5">{room.description}</p>
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
                  {/* List human users who sent heartbeats */}
                  {activeMembers
                    .filter((member) => member.username.trim() !== userProfile.username.trim())
                    .map((member) => {
                      const isSelected = selectedCompanion?.username === member.username;
                      const unread = unreadCounts[`dm-${member.username}`];
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
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between items-center w-full">
                              <p className="text-xs font-bold truncate">{member.username}</p>
                              {unread ? (
                                <span className="bg-gradient-to-r from-rose-500 to-pink-600 text-white text-[9.5px] font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                                  {unread}
                                </span>
                              ) : null}
                            </div>
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

              {/* SECTION: Notification Custom Controls */}
              <div className="p-2 bg-white/5 rounded-2xl border border-white/5 space-y-2 mx-1 select-none">
                <p className="text-[10px] font-bold text-indigo-300 px-1">تفضيلات التنبيهات والأمان ⚙️</p>
                
                {/* Desktop Notification Activator */}
                <button
                  id="notifications-permissions-trigger-sidebar"
                  onClick={requestNotificationPermission}
                  className="w-full flex items-center justify-between p-2 text-right bg-white/5 hover:bg-white/10 rounded-xl transition text-[10px] text-slate-200 border border-transparent hover:border-white/10 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Bell className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span className="truncate">تفعيل الإشعارات على الجوال</span>
                  </span>
                  <span className="text-[9px] bg-teal-500/10 text-teal-300 px-1.5 py-0.5 rounded font-bold shrink-0">تفعيل 🔔</span>
                </button>

                {/* Alarm beep toggle switch */}
                <button
                  id="sound-alert-toggle-selector"
                  onClick={() => setEnableSoundAlert(!enableSoundAlert)}
                  className="w-full flex items-center justify-between p-2 text-right bg-white/5 hover:bg-white/10 rounded-xl transition text-[10px] text-slate-200 border border-transparent hover:border-white/10 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {enableSoundAlert ? <Volume2 className="w-3.5 h-3.5 text-pink-400 shrink-0" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    <span className="truncate">رنين الرسائل الواردة</span>
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${enableSoundAlert ? "bg-pink-500/20 text-pink-300" : "bg-white/10 text-slate-400"}`}>
                    {enableSoundAlert ? "صوت 🔊" : "صامت 🔇"}
                  </span>
                </button>
              </div>

            </div>

            {/* Sidebar Footer Controls */}
            <div className="p-4 border-t border-white/10 bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <p className="text-[10.5px] font-bold text-white">تطبيق مادارا شات</p>
                  <p className="text-[9px] text-slate-400">تثبيت فوري كأيقونة للجوال 👁️</p>
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
            
            {!selectedCompanion && selectedRoomId === "" ? (
              // HOMEPAGE DISPLAY (CONTACTS & RADAR EXPLORE DASHBOARD)
              <div className="flex-grow flex flex-col overflow-y-auto p-4 md:p-6 text-right animate-fadeIn" dir="rtl">
                {/* Banner */}
                <div className="mb-6 p-5 md:p-6 rounded-3xl bg-gradient-to-l from-[#2c1b52]/50 via-[#1f0e43]/30 to-purple-950/25 border border-purple-500/20 shadow-xl relative overflow-hidden">
                  <div className="absolute top-1/2 left-10 -translate-y-1/2 w-48 h-48 bg-purple-500/10 blur-[60px] rounded-full pointer-events-none" />
                  
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden sm:flex items-center justify-center w-20 h-20 rounded-full bg-[#140c26] border border-purple-500/30 shadow-lg shrink-0">
                    <svg viewBox="0 0 100 100" className="w-16 h-16 animate-pulse select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="50" cy="50" r="45" fill="#58487a" />
                      <circle cx="50" cy="50" r="36" fill="none" stroke="#251a3d" strokeWidth="2.5" />
                      <circle cx="50" cy="50" r="27" fill="#695594" stroke="#251a3d" strokeWidth="2.5" />
                      <circle cx="50" cy="50" r="18" fill="none" stroke="#251a3d" strokeWidth="2.5" />
                      <circle cx="50" cy="50" r="10" fill="#140b22" />
                      <circle cx="50" cy="50" r="3" fill="#ffffff" opacity="0.6" />
                    </svg>
                  </div>

                  <h1 className="text-lg md:text-xl lg:text-2xl font-extrabold text-white mb-2 leading-tight">مرحباً بك في رادار مادارا شات! 👁️✨</h1>
                  <p className="text-xs md:text-sm text-purple-200/80 leading-relaxed max-w-xl">
                    تواصل مباشر وآمن وتشفير للمحادثات. يمكنك تصفح رادار المستخدمين النشطين بالأسفل وبدء دردشة خاصة آمنة فوراً بنقرة زر واحدة، أو تصفح القنوات العامة والغرف الجماعية من الركن الجانبي.
                  </p>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => setMobileSidebarOpen(true)}
                      className="md:hidden px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Menu className="w-3.5 h-3.5" />
                      <span>تصفح الغرف والقنوات 👥</span>
                    </button>
                    <button
                      onClick={() => setSelectedRoomId("general")}
                      className="px-4 py-2 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500/30 hover:to-emerald-500/30 border border-teal-500/30 hover:border-teal-500/50 text-teal-300 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>المجلس العام للمناقشة 💬</span>
                    </button>
                  </div>
                </div>

                {/* Available users grid list */}
                <div className="flex-grow flex flex-col">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5 flex-row-reverse">
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <h2 className="text-sm md:text-base font-bold text-white">المستخدمون النشطون الآن في الرادار 👥</h2>
                    </div>
                    <p className="text-[10px] md:text-xs text-teal-300">انقر على مراسلة لبدء شات خاص آمن</p>
                  </div>

                  {activeMembers.filter(v => v.username !== userProfile.username).length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center p-8 bg-white/[0.02] border border-white/5 rounded-3xl text-center space-y-4 my-4">
                      <div className="w-16 h-16 rounded-full bg-purple-500/15 flex items-center justify-center text-3xl animate-pulse">
                        📡
                      </div>
                      <p className="text-sm font-bold text-slate-200">لا يوجد غيرك متصل بالرادار بالوقت الحالي.</p>
                      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                        قم بدعوة أصدقائك أو زملائك للتحدث والدخول على نفس الرابط ليظهروا معك فوراً وتجري محادثات ومكالمات آمنة!
                      </p>
                      <button
                        onClick={() => setShowInstallGuide(true)}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-505 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
                      >
                        تعليمات التثبيت ومشاركة الرابط 📲
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeMembers
                        .filter((member) => member.username.trim() !== userProfile.username.trim())
                        .map((member) => (
                          <div
                            key={member.username}
                            className="p-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-purple-500/20 rounded-2xl transition duration-300 flex items-center justify-between gap-3 shadow-md group text-right"
                            dir="rtl"
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-r ${member.color || "from-teal-400 to-emerald-500"} flex items-center justify-center text-xl shadow-lg`}>
                                  {member.avatar || "👤"}
                                </div>
                                <span className="absolute -bottom-1 -left-1 flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-[#120f26]"></span>
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="text-xs md:text-sm font-bold text-white truncate max-w-[100px] sm:max-w-none">{member.username}</p>
                                <p className="text-[9px] text-teal-400 mt-0.5">نشط وجاهز للدردشة 🟢</p>
                              </div>
                            </div>

                            <div className="flex gap-1.5 shrink-0 flex-row-reverse">
                              {/* Call Buttons */}
                              <button
                                onClick={() => startLiveCall(member.username, member.avatar, false)}
                                className="p-2 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 hover:border-teal-500/40 text-teal-300 rounded-xl transition cursor-pointer"
                                title="اتصال صوتي ومكالمة سريعة 📞"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => startLiveCall(member.username, member.avatar, true)}
                                className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 hover:border-rose-500/40 text-rose-300 rounded-xl transition cursor-pointer"
                                title="اتصال فيديو آمن 📹"
                              >
                                <Video className="w-3.5 h-3.5" />
                              </button>
                              {/* Start DM button */}
                              <button
                                onClick={() => {
                                  setSelectedCompanion(member);
                                  setSelectedRoomId("");
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white font-bold text-[11px] rounded-xl transition cursor-pointer shadow shadow-indigo-600/30 active:scale-95"
                              >
                                مراسلة 💬
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // NORMAL CONVERSATIONAL WINDOW
              <>
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
                
                {/* Compact Expressive Voice Call (Audio-only) Icon Button */}
                <button
                  id="start-header-audio-only-call-btn"
                  onClick={() => {
                    const companionName = selectedCompanion ? selectedCompanion.username : (rooms.find(r => r.id === selectedRoomId)?.name || "الغرفة العامة");
                    const companionAvatar = selectedCompanion ? selectedCompanion.avatar : "💬";
                    startLiveCall(companionName, companionAvatar, false);
                  }}
                  className="p-2.5 text-white bg-teal-600 hover:bg-teal-550 rounded-full transition shadow-lg shadow-teal-600/30 flex items-center justify-center cursor-pointer relative"
                  title="اتصال صوتي آمن ومباشر 📞"
                >
                  <Phone className="w-4 h-4" />
                  <span className="absolute -top-1 -left-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                  </span>
                </button>

                {/* Compact Expressive Video Call Icon Button */}
                <button
                  id="start-header-voice-call-btn"
                  onClick={() => {
                    const companionName = selectedCompanion ? selectedCompanion.username : (rooms.find(r => r.id === selectedRoomId)?.name || "الغرفة العامة");
                    const companionAvatar = selectedCompanion ? selectedCompanion.avatar : "💬";
                    startLiveCall(companionName, companionAvatar, true);
                  }}
                  className="p-2.5 text-white bg-rose-600 hover:bg-rose-500 rounded-full transition shadow-lg shadow-rose-600/30 flex items-center justify-center cursor-pointer relative"
                  title="اتصال فيديو آمن ومباشر 📹"
                >
                  <Video className="w-4 h-4" />
                </button>

                <span className="hidden lg:inline-block text-[10px] text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-full font-bold">
                  تحديث نشط 🟢
                </span>
                
                {mobileSidebarOpen ? (
                  <button
                    id="mobile-close-sidebar-btn"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="p-2 bg-rose-600/20 border border-rose-500/30 rounded-full text-rose-300 hover:bg-rose-600/30 hover:text-white flex items-center justify-center transition cursor-pointer"
                    title="إغلاق قائمة الغرف والأعضاء ✕"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    id="mobile-open-sidebar-btn"
                    onClick={() => setMobileSidebarOpen(true)}
                    className="md:hidden p-2.5 bg-indigo-600/90 border border-indigo-500 rounded-full text-white hover:bg-indigo-500 transition flex items-center justify-center cursor-pointer relative animate-pulse"
                    title="عرض قائمة الغرف والأعضاء 👥"
                  >
                    <Users className="w-4 h-4 text-teal-300" />
                    <span className="absolute -top-0.5 -left-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75 animate-bounce"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-300"></span>
                    </span>
                  </button>
                )}
              </div>
            </header>

            {/* MESSAGE HISTORY SCROLLER */}
            <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-4 md:p-6 space-y-4">
              
              {/* Active Contacts Presence Dashboard */}
              {!selectedCompanion && selectedRoomId === "general" && (
                <div className="bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/20 rounded-2xl p-4 mb-4 select-none animate-fadeIn text-right" dir="rtl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 flex-row-reverse">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <h3 className="text-xs md:text-sm font-bold text-white">الأعضاء والمستخدمون المتصلون بالرادار الآن 👥</h3>
                    </div>
                    <span className="text-[10px] text-teal-300">انقر لبدء محادثة خاصة فورية 👁️</span>
                  </div>
                  
                  <div className="flex gap-3 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-white/10 text-center flex-row-reverse justify-start">
                    {activeMembers.filter(v => v.username !== userProfile.username).length === 0 ? (
                      <div className="text-right w-full py-1">
                        <p className="text-[11px] text-slate-300">لا يوجد غيرك متصل الآن بالرادار بالوقت الحالي.</p>
                        <p className="text-[9.5px] text-indigo-300 underline mt-0.5 cursor-pointer" onClick={() => setShowInstallGuide(true)}>
                          شارك رابط التطبيق مع أصدقائك ليتصلوا فوراً! 📱📤
                        </p>
                      </div>
                    ) : (
                      activeMembers
                        .filter((u) => u.username.trim() !== userProfile?.username?.trim())
                        .map((user) => (
                          <button
                            key={user.username}
                            onClick={() => {
                              setSelectedCompanion(user);
                              setMobileSidebarOpen(false);
                            }}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 transition border border-transparent hover:border-white/5 shrink-0 min-w-[70px] cursor-pointer"
                          >
                            <div className="relative">
                              <div className={`w-11 h-11 rounded-xl bg-gradient-to-r ${user.color || "from-teal-400 to-emerald-500"} flex items-center justify-center text-lg shadow-md`}>
                                {user.avatar || "👤"}
                              </div>
                              <span className="absolute -bottom-0.5 -left-0.5 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-[#1b153b]"></span>
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-200 font-bold max-w-[65px] truncate">{user.username}</span>
                          </button>
                        ))
                    )}
                  </div>
                </div>
              )}

              {/* Informative notification if they are alone with help option */}
              {messages.length === 0 && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center max-w-md mx-auto my-6 space-y-2">
                  <span className="text-2xl block">💬</span>
                  <p className="text-xs font-bold text-white">سجل الدردشة فارغ هنا</p>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    كن أول من يكتب رسالة في هذا الحقل، أو تواصل مع صديق من المتصلين بالرادار لبدء دردشة فورية!
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
                      className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-3 md:p-4 text-xs md:text-sm leading-relaxed shadow-lg border transition group relative ${
                        isMyMessage
                          ? "bg-indigo-600/40 backdrop-blur-md border-indigo-400/30 text-white rounded-tr-none"
                          : "bg-white/10 backdrop-blur-md border border-white/10 text-slate-100 rounded-tl-none"
                      }`}
                    >
                      {/* Replied-to card display */}
                      {msg.replyToContent && (
                        <div className="mb-2 p-2 bg-black/20 border-r-2 border-indigo-400 rounded-lg text-[10px] text-right text-slate-300">
                          <p className="font-bold text-indigo-300 text-[9px] mb-0.5">↩️ ردّ على {msg.replyToSender || "عضو"}:</p>
                          <p className="truncate opacity-90">{msg.replyToContent}</p>
                        </div>
                      )}

                      <p className="whitespace-pre-wrap select-text leading-relaxed">
                        {msg.content}
                      </p>
                      
                      <div className="flex items-center justify-between gap-2.5 mt-1.5 text-[8.5px] opacity-80 select-none">
                        <span className="opacity-70 font-mono text-[8px]">{msg.timestamp || "اليوم"}</span>
                        
                        {isMyMessage && (
                          <div className="flex items-center gap-1 font-sans">
                            {msg.readBy && msg.readBy.filter((u: string) => u.toLowerCase() !== userProfile?.username?.trim().toLowerCase()).length > 0 ? (
                              <span className="text-cyan-300 font-bold flex items-center gap-0.5" title="قُرئت من طرف الصديق">
                                <span>قُرئت</span>
                                <span className="text-[9px] leading-none">✓✓</span>
                              </span>
                            ) : (activeMembers.length > 1 ? (
                              <span className="text-slate-200 opacity-95 flex items-center gap-0.5" title="وصلت لجهاز الصديق">
                                <span>وصلت</span>
                                <span className="text-[9px] leading-none">✓✓</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 opacity-60 flex items-center gap-0.5" title="أرسلت بأمان">
                                <span>أرسلت</span>
                                <span className="text-[9px] leading-none">✓</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Clickable Quick Reply on hover */}
                      <button
                        id={`reply-trigger-element-${msg.id}`}
                        onClick={() => setReplyingTo(msg)}
                        className={`absolute top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800/90 hover:bg-indigo-600 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition shadow border border-white/10 cursor-pointer ${
                          isMyMessage ? "left-full ml-2" : "right-full mr-2"
                        }`}
                        title="رد على هذه الرسالة"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </button>
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

              {/* Symmetrical Typing Indicator element */}
              {typingUsers.length > 0 && (
                <div className="flex flex-col items-start w-full animate-fadeIn select-none mb-2 text-right">
                  <div className="flex items-center gap-1.5 mb-1 justify-start flex-row">
                    <div className="w-5 h-5 rounded-lg bg-teal-500/15 flex items-center justify-center text-[10px]">
                      ✍️
                    </div>
                    <span className="text-[10px] text-teal-300 font-bold">
                      {typingUsers.map(u => u.username).join(" و ")}
                    </span>
                  </div>
                  <div className="rounded-2xl px-3 py-2 bg-teal-500/10 backdrop-blur-md border border-teal-500/20 text-teal-200 rounded-bl-none flex items-center gap-2">
                    <span className="text-[10px] md:text-xs">يكتب الآن...</span>
                    <div className="flex gap-0.5 items-center pt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce delay-100"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce delay-205"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce delay-300"></span>
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
              <button type="button" onClick={() => insertQuickText("السلام عليكم ورحمة الله وبركاته 🌹")} className="text-[9.5px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-2.5 py-0.5 text-slate-300 hover:text-white transition">السلام عليكم</button>
              <button type="button" onClick={() => insertQuickText("أهلاً بالجميع، كيف الحال اليوم؟ 👋")} className="text-[9.5px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-2.5 py-0.5 text-slate-300 hover:text-white transition">كيف الحال</button>
              <button type="button" onClick={() => insertQuickText("جربوا تثبيت واجهة التطبيق كأيقونة على الجوال! 📱")} className="text-[9.5px] bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/20 rounded-full px-2.5 py-0.5 transition">تطبيق PWA</button>
              <button type="button" onClick={() => insertQuickText("أنا متصل الآن بالرادار بالكامل! 👁️")} className="text-[9.5px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 rounded-full px-2.5 py-0.5 transition font-bold">متصل بالرادار 🟢</button>
            </div>

            {/* KEY MESSAGE INPUT CONTAINER ACCORDING TO MOCKUP */}
            <footer className="p-4 border-t border-white/10 bg-[#161434]/50 backdrop-blur-md">
              
              {/* MINI DISMISSIBLE REPLY COMPONENT PREVIEW */}
              {replyingTo && (
                <div className="mb-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-right animate-fadeIn select-none">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm shrink-0">↩️</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-indigo-300">أنت تقوم بالرد على {replyingTo.sender?.username || "عضو"}</p>
                      <p className="text-xs text-slate-200 truncate">{replyingTo.content}</p>
                    </div>
                  </div>
                  <button
                    id="clear-active-reply-btn"
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="p-1.5 px-3 rounded-xl bg-[#ec4899]/15 hover:bg-[#ec4899]/25 text-[#f472b6] hover:text-[#f472b6] text-xs font-bold transition cursor-pointer"
                    title="إلغاء الرد"
                  >
                    إلغاء ❌
                  </button>
                </div>
              )}

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
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={
                    selectedCompanion 
                      ? `اكتب رسالة خاصة لـ ${selectedCompanion.username}...`
                      : `اكتب رسالة شات للمجموعة...`
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
          </>
        )}

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

      {/* GLOBAL FOOTER REMOVED */}

      {/* VOICE & VIDEO RTC CALL MODAL LAYER */}
      {activeCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/90 backdrop-blur-xl animate-fadeIn text-center">
          <div className="w-full max-w-2xl h-[92dvh] md:h-auto md:min-h-[500px] bg-slate-900 border border-white/10 rounded-3xl p-4 md:p-6 relative shadow-2xl flex flex-col justify-between">
            
            {/* Call Header */}
            <div className="flex justify-between items-center border-b border-white/5 pb-3 text-right">
              <div className="flex items-center gap-2.5 font-sans" dir="rtl">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-md animate-pulse">
                  📞
                </div>
                <div className="text-right">
                  <h3 className="text-xs md:text-sm font-bold text-white">اتصال صوت وصورة آمن ومباشر 🔒</h3>
                  <p className="text-[9.5px] text-teal-300 mt-0.5">
                    {activeCall.isConnected ? "المكالمة متصلة ونشطة الآن 🟢" : "جاري الاتصال والربط عبر السيرفر... ⏳"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg text-[9px] text-slate-400 font-mono">
                <span>RTC Loopback</span>
              </div>
            </div>

            {/* Immersive Video Streams Container - Mobile Friendly overlay style */}
            <div className="flex-grow my-4 relative bg-slate-950 rounded-2xl overflow-hidden border border-white/15 min-h-[220px] md:min-h-[340px] flex items-center justify-center">
              
              {/* REMOTE PARTICIPANT: Full scale main video block */}
              {activeCall.isConnected ? (
                (activeCall.isVideoEnabled ? (
                  <video
                    id="remote-stream-player"
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover absolute inset-0 z-0"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 relative z-10">
                    <div className="w-16 h-16 rounded-full bg-indigo-500/25 flex items-center justify-center text-xl text-white font-bold border border-indigo-400/30">
                      {activeCall.companionAvatar}
                    </div>
                    <span className="text-xs text-slate-300">تواصل صوتي جارٍ</span>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 text-center p-4 relative z-10">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-rose-500/10 border-2 border-rose-500 flex items-center justify-center text-xl animate-ping absolute" />
                    <div className="w-14 h-14 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xl relative z-10">
                      {activeCall.companionAvatar}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">جاري رنان الخط لـ {activeCall.companionName}...</p>
                    <p className="text-[10px] text-slate-400 mt-1">بانتظار قبول الاتصال من الطرف الآخر</p>
                  </div>
                </div>
              )}

              {/* LOCAL CLIENT PREVIEW: Small floating picture-in-picture window */}
              <div className="absolute top-3 left-3 w-24 h-36 md:w-32 md:h-48 rounded-xl border border-white/20 shadow-2xl overflow-hidden z-20 bg-slate-900/95 flex items-center justify-center">
                {activeCall.isVideoEnabled ? (
                  <video
                    id="local-stream-player"
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 p-1 text-center">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm border border-white/10">
                      {userProfile?.avatar || "👤"}
                    </div>
                    <span className="text-[9px] text-slate-400 scale-90">كاميراتك مغلقة</span>
                  </div>
                )}
                <div className="absolute bottom-1.5 right-1.5 bg-black/60 px-1.5 py-0.5 rounded-md text-[8px] text-teal-400 font-bold">
                  أنت 🟢
                </div>
              </div>

              {/* Absolute corner badge showing remote active status */}
              <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-xl text-[10px] text-indigo-200 font-bold z-10 flex items-center gap-1">
                <span>{activeCall.companionName}</span>
                <span className="animate-pulse">{activeCall.isConnected ? "🟢" : "⏳"}</span>
              </div>
            </div>

            {/* Calling Control buttons group - Large Touch Targets */}
            <div className="flex justify-center items-center gap-4 border-t border-white/5 pt-3">
              
              {/* Mic toggle */}
              <button
                id="call-mic-toggle-btn"
                onClick={toggleAudioInCall}
                className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${
                  activeCall.isAudioEnabled 
                    ? "bg-slate-800 text-white hover:bg-slate-700 hover:scale-105 active:scale-95 cursor-pointer border border-white/10" 
                    : "bg-rose-600 text-white hover:bg-rose-500 animate-pulse cursor-pointer"
                }`}
                title={activeCall.isAudioEnabled ? "كتم الصوت" : "تشغيل الصوت"}
              >
                {activeCall.isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              {/* End Call Button */}
              <button
                id="call-hangup-btn"
                onClick={endLiveCall}
                className="w-12 h-12 md:w-14 md:h-14 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-90 shadow-lg shadow-rose-500/30 cursor-pointer"
                title="إنهاء المكالمة"
              >
                <PhoneOff className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              {/* Video toggle */}
              <button
                id="call-video-toggle-btn"
                onClick={toggleVideoInCall}
                className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${
                  activeCall.isVideoEnabled 
                    ? "bg-slate-800 text-white hover:bg-slate-700 hover:scale-105 active:scale-95 cursor-pointer" 
                    : "bg-rose-600 text-white hover:bg-rose-500 animate-pulse cursor-pointer"
                }`}
                title={activeCall.isVideoEnabled ? "إغلاق الكاميرا" : "تشغيل الكاميرا"}
              >
                {activeCall.isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

            </div>

            {/* Privacy note */}
            <p className="text-[9px] text-slate-500 mt-3 leading-relaxed font-sans" dir="rtl">
              * تم تشفير الاتصال محلياً من طرف إلى طرف. يتطلب التطبيق إذن الكاميرا والميكروفون من متصفحك للعمل بشكل صحيح وتحسين أداء الـ WebRTC.
            </p>

          </div>
        </div>
      )}

    </div>
  );
}
