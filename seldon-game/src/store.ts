import { createStore } from 'zustand/vanilla';

interface AppState {
  isPlaying: boolean;
  togglePlay: () => void;
}

export const useStore = createStore<AppState>((set) => ({
  // State
  isPlaying: false,

  // Actions
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
}));
