import React from 'react';
import { ActiveTab } from '../../types';
import { LogOut, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onLogout }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="w-full border-b border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#F8F7F4] dark:bg-[#0B0B0A] px-6 sm:px-10 py-5 flex items-center justify-between transition-colors">
      {/* Brand */}
      <div
        className="flex items-baseline gap-3 cursor-pointer select-none"
        onClick={() => setActiveTab('editor')}
      >
        <span className="text-base sm:text-lg font-medium tracking-[0.18em] text-[#1C1B18] dark:text-[#E8E7E2] uppercase font-sans">
          Hinhanh<span className="text-[#8C8B84] font-light">AI</span>
        </span>
        <span className="hidden sm:inline-block text-[9px] uppercase tracking-[0.25em] text-[#9C988F] dark:text-[#5E5D57] font-medium border-l border-[#E2DDD5] dark:border-[#292925] pl-3">
          Workspace
        </span>
      </div>

      {/* Navigation & Controls */}
      <div className="flex items-center gap-5 sm:gap-8">
        <nav className="flex items-center gap-5 sm:gap-8">
          <NavButton
            active={activeTab === 'editor'}
            onClick={() => setActiveTab('editor')}
            label="Workspace"
          />
          <NavButton
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            label="History"
          />
          <NavButton
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            label="Overview"
          />
          <NavButton
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            label="Settings"
          />
        </nav>

        <div className="h-3 w-[1px] bg-[#E2DDD5] dark:bg-[#292925] hidden sm:block" />

        <div className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            className="text-[#6E6B64] dark:text-[#8C8B84] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] transition-colors p-1.5 rounded-sm hover:bg-[#EDE9E1] dark:hover:bg-[#161614] flex items-center gap-1.5 cursor-pointer"
            title={theme === 'dark' ? 'Giao diện sáng (Light mode)' : 'Giao diện tối (Dark mode)'}
          >
            {theme === 'dark' ? (
              <Sun size={15} strokeWidth={1.5} className="text-[#D8D3C5]" />
            ) : (
              <Moon size={15} strokeWidth={1.5} className="text-[#1C1B18]" />
            )}
            <span className="text-[10px] font-mono uppercase tracking-wider hidden md:inline">
              {theme === 'dark' ? 'Light' : 'Dark'}
            </span>
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            aria-label="Đăng xuất"
            className="text-[#9C988F] dark:text-[#5E5D57] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] transition-colors p-1.5 cursor-pointer"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </header>
  );
};

function NavButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] sm:text-xs uppercase tracking-[0.14em] font-medium transition-all relative pb-1 cursor-pointer ${
        active
          ? 'text-[#1C1B18] dark:text-[#E8E7E2]'
          : 'text-[#9C988F] dark:text-[#5E5D57] hover:text-[#6E6B64] dark:hover:text-[#8C8B84]'
      }`}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-[#1C1B18] dark:bg-[#E8E7E2]" />
      )}
    </button>
  );
}
