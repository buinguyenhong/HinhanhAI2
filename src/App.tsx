/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ActiveTab } from './types';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Header } from './components/layout/Header';
import { LoginView } from './components/auth/LoginView';
import { EditorView } from './components/editor/EditorView';
import { HistoryView } from './components/history/HistoryView';
import { DashboardView } from './components/dashboard/DashboardView';
import { SettingsView } from './components/settings/SettingsView';
import { isUserAuthenticated, clearAuthToken } from './services/authService';
import { performInitialSync } from './services/syncService';
import { loadAppSettings } from './services/storageService';

function AppContent() {
  const { theme, setTheme } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');

  // Check login state on mount
  useEffect(() => {
    if (isUserAuthenticated()) {
      setIsAuthenticated(true);
    }
  }, []);

  // Sau khi xác thực: đồng bộ cài đặt + lịch sử từ server về local (chỉ 1 lần mỗi phiên đăng nhập).
  const hasSyncedRef = React.useRef(false);
  useEffect(() => {
    if (!isAuthenticated || hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    let cancelled = false;
    (async () => {
      setIsSyncing(true);
      try {
        const { mergedSettings } = await performInitialSync();
        if (cancelled) return;
        if (mergedSettings) {
          const remoteTheme = mergedSettings.theme;
          if (remoteTheme === 'dark' || remoteTheme === 'light') {
            setTheme(remoteTheme);
          }
        } else {
          // Local giữ nguyên — đồng bộ theme từ local settings nếu chúng lệch nhau.
          const localTheme = loadAppSettings().theme;
          if (localTheme === 'dark' || localTheme === 'light') {
            setTheme(localTheme);
          }
        }
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setTheme]);

  const handleLogin = () => {
    hasSyncedRef.current = false;
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    hasSyncedRef.current = false;
    clearAuthToken();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  if (isSyncing) {
    return (
      <div
        data-theme={theme}
        className={`min-h-screen ${
          theme === 'dark' ? 'dark bg-[#0B0B0A] text-[#8C8B84]' : 'light bg-[#F8F7F4] text-[#6E6B64]'
        } flex flex-col items-center justify-center gap-4 transition-colors`}
      >
        <div className="w-8 h-8 border border-[#E2DDD5] dark:border-[#292925] border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#9C988F] dark:text-[#5E5D57] font-mono">
          Đang đồng bộ cài đặt &amp; lịch sử...
        </p>
      </div>
    );
  }

  return (
    <div
      data-theme={theme}
      className={`min-h-screen ${
        theme === 'dark' ? 'dark bg-[#0B0B0A] text-[#8C8B84]' : 'light bg-[#F8F7F4] text-[#6E6B64]'
      } flex flex-col font-sans selection:bg-[#E2DDD5] dark:selection:bg-[#292925] selection:text-[#1C1B18] dark:selection:text-[#E8E7E2] transition-colors`}
    >
      {/* Editorial Minimal Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 overflow-auto px-6 sm:px-10 py-8 w-full max-w-[1680px] mx-auto">
        {activeTab === 'editor' && <EditorView />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
