import { create } from 'zustand';
import { storage } from '../api/client';

export interface DownloadTask {
  id: string; // url hash or filename or custom id
  title: string;
  url: string;
  progress: number;
  speed: string; // e.g. "2.4 MB/s"
  eta: string; // e.g. "0:12"
  status: 'pending' | 'downloading' | 'paused' | 'failed' | 'completed';
  localPath?: string;
  sizeEstimate?: string;
}

export interface CompletedDownload {
  id: string;
  title: string;
  size: string;
  localPath: string;
  timestamp: number;
}

interface AppState {
  recentLinks: string[];
  downloadQueue: DownloadTask[];
  completedDownloads: CompletedDownload[];
  defaultQuality: string;
  downloadDirectory: string;
  
  // Actions
  addRecentLink: (link: string) => void;
  clearRecentLinks: () => void;
  setDefaultQuality: (quality: string) => void;
  setDownloadDirectory: (path: string) => void;
  
  // Download Queue Actions
  addDownloadTask: (task: DownloadTask) => void;
  updateDownloadProgress: (id: string, progress: number, speed?: string, eta?: string) => void;
  updateDownloadStatus: (id: string, status: DownloadTask['status'], localPath?: string) => void;
  removeDownloadTask: (id: string) => void;
  
  // Completed Downloads Actions
  addCompletedDownload: (item: CompletedDownload) => void;
  clearCompletedDownloads: () => void;
}

// Read initial state from MMKV
const getStoredRecentLinks = (): string[] => {
  try {
    const raw = storage.getString('vidra:recent_links');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getStoredCompleted = (): CompletedDownload[] => {
  try {
    const raw = storage.getString('vidra:completed_downloads');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const useAppStore = create<AppState>((set) => ({
  recentLinks: getStoredRecentLinks(),
  downloadQueue: [],
  completedDownloads: getStoredCompleted(),
  defaultQuality: storage.getString('vidra:default_quality') || '1080p',
  downloadDirectory: storage.getString('vidra:download_directory') || '/storage/emulated/0/Download/Vidra',

  addRecentLink: (link) => set((state) => {
    const filtered = state.recentLinks.filter(l => l !== link);
    const updated = [link, ...filtered].slice(0, 10); // Limit to 10 entries
    storage.set('vidra:recent_links', JSON.stringify(updated));
    return { recentLinks: updated };
  }),

  clearRecentLinks: () => set(() => {
    storage.delete('vidra:recent_links');
    return { recentLinks: [] };
  }),

  setDefaultQuality: (quality) => set(() => {
    storage.set('vidra:default_quality', quality);
    return { defaultQuality: quality };
  }),

  setDownloadDirectory: (path) => set(() => {
    storage.set('vidra:download_directory', path);
    return { downloadDirectory: path };
  }),

  addDownloadTask: (task) => set((state) => {
    // Prevent duplicate tasks
    if (state.downloadQueue.some(t => t.id === task.id)) {
      return {};
    }
    return { downloadQueue: [...state.downloadQueue, task] };
  }),

  updateDownloadProgress: (id, progress, speed = '0 KB/s', eta = 'Calculating...') => set((state) => ({
    downloadQueue: state.downloadQueue.map((t) =>
      t.id === id ? { ...t, progress, speed, eta, status: 'downloading' } : t
    )
  })),

  updateDownloadStatus: (id, status, localPath) => set((state) => ({
    downloadQueue: state.downloadQueue.map((t) =>
      t.id === id ? { ...t, status, ...(localPath ? { localPath } : {}) } : t
    )
  })),

  removeDownloadTask: (id) => set((state) => ({
    downloadQueue: state.downloadQueue.filter((t) => t.id !== id)
  })),

  addCompletedDownload: (item) => set((state) => {
    const updated = [item, ...state.completedDownloads];
    storage.set('vidra:completed_downloads', JSON.stringify(updated));
    return { completedDownloads: updated };
  }),

  clearCompletedDownloads: () => set(() => {
    storage.delete('vidra:completed_downloads');
    return { completedDownloads: [] };
  })
}));
