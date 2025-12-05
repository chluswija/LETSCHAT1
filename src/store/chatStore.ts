import { create } from 'zustand';
import { Chat, Message, User } from '@/types/chat';

interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  messages: Message[];
  contacts: User[];
  searchQuery: string;
  isTyping: boolean;
  setChats: (chats: Chat[]) => void;
  setActiveChat: (chat: Chat | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setContacts: (contacts: User[]) => void;
  setSearchQuery: (query: string) => void;
  setTyping: (typing: boolean) => void;
  updateMessageStatus: (messageId: string, status: Message['status']) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChat: null,
  messages: [],
  contacts: [],
  searchQuery: '',
  isTyping: false,
  setChats: (chats) => set({ chats }),
  setActiveChat: (activeChat) => set({ activeChat }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  setContacts: (contacts) => set({ contacts }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setTyping: (isTyping) => set({ isTyping }),
  updateMessageStatus: (messageId, status) => set((state) => ({
    messages: state.messages.map((m) =>
      m.id === messageId ? { ...m, status } : m
    ),
  })),
}));
