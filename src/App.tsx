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

function AppContent() {
  const { theme } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');

  // Check login state on mount
  useEffect(() => {
    if (isUserAuthenticated()) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearAuthToken();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
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
