import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserSettings } from '@/types/chat';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  updateUser: (updates: Partial<User>) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },
      updateSettings: (settings) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ 
            user: { 
              ...currentUser, 
              settings: { ...currentUser.settings, ...settings } 
            } 
          });
        }
      },
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'letschat-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
