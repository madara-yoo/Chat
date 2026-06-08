export interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
}

export interface Chat {
  id: string;
  title: string;
  characterId: string;
  messages: Message[];
  createdAt: string;
}

export interface Character {
  id: string;
  name: string;
  roleAr: string;
  avatar: string;
  description: string;
  welcomeMessage: string;
  color: string;
  bgGradient: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  class: string;
  sidebarClass: string;
  bgGradient: string;
}
