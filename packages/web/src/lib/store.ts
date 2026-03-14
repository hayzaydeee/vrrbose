'use client';
import { create } from 'zustand';
import type { Session, Event } from '@vrrbose/shared';

interface AppState {
  activeSession: Session | null;
  daemonOnline: boolean;
  recentEvents: Event[];
  setActiveSession: (s: Session | null) => void;
  setDaemonOnline: (v: boolean) => void;
  addEvent: (e: Event) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeSession: null,
  daemonOnline: false,
  recentEvents: [],
  setActiveSession: (activeSession) => set({ activeSession }),
  setDaemonOnline: (daemonOnline) => set({ daemonOnline }),
  addEvent: (e) => set((state) => ({
    recentEvents: [e, ...state.recentEvents].slice(0, 100),
  })),
}));
