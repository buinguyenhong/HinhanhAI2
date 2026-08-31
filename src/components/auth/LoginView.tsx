import React, { useState } from 'react';
import { ArrowUpRight, Loader2, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { loginWithServer } from '../../services/authService';

interface LoginViewProps {
  onLogin: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setError('');
    setIsLoading(true);

    try {
      const result = await loginWithServer(password.trim());
      if (result.success) {
        onLogin();
      } else {
        setError(result.error || 'Mã truy cập không hợp lệ. Vui lòng kiểm tra lại.');
      }
    } catch (err: any) {
      setError('Lỗi kết nối đến máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-theme={theme}
      className={`min-h-screen ${
        theme === 'dark' ? 'dark bg-[#0B0B0A] text-[#8C8B84]' : 'light bg-[#F8F7F4] text-[#6E6B64]'
      } flex flex-col justify-between p-8 sm:p-14 transition-colors`}
    >
      {/* Top watermark & theme toggle */}
      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.2em] text-[#9C988F] dark:text-[#5E5D57]">
        <span>HINHANHAI</span>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] transition-colors cursor-pointer"
            title="Chuyển chế độ giao diện"
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            <span className="font-mono">{theme === 'dark' ? 'LIGHT' : 'DARK'}</span>
          </button>
          <span className="hidden sm:inline">IMAGE STUDIO</span>
        </div>
      </div>

      {/* Main access box */}
      <div className="w-full max-w-sm mx-auto my-auto py-12">
        <div className="mb-14 text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-light tracking-[0.12em] text-[#1C1B18] dark:text-[#E8E7E2] uppercase font-sans mb-2">
            HinhanhAI
          </h1>
          <p className="text-xs text-[#9C988F] dark:text-[#5E5D57] tracking-wider uppercase">
            Professional Creative Image Workspace
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="space-y-3">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-[#6E6B64] dark:text-[#5E5D57]">
              Access Code
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mã truy cập..."
                autoFocus
                className="w-full bg-transparent border-b border-[#E2DDD5] dark:border-[#292925] focus:border-[#1C1B18] dark:focus:border-[#E8E7E2] py-3 text-sm text-[#1C1B18] dark:text-[#E8E7E2] placeholder-[#A3A096] dark:placeholder-[#3A3935] focus:outline-none transition-colors tracking-widest font-mono"
              />
            </div>
            {error && (
              <p className="text-[11px] text-[#C2410C] dark:text-[#A85848] tracking-wide pt-1 font-mono">
                {error}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full bg-[#1C1B18] hover:bg-[#2F2E2B] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:hover:bg-[#E8E7E2] dark:text-[#0B0B0A] text-xs uppercase tracking-[0.16em] font-medium py-3.5 px-5 flex items-center justify-between transition-all disabled:opacity-40 cursor-pointer"
            >
              <span>{isLoading ? 'Đang xác thực...' : 'Vào Workspace'}</span>
              {isLoading ? (
                <Loader2 size={14} className="animate-spin text-inherit" />
              ) : (
                <ArrowUpRight size={15} strokeWidth={2} />
              )}
            </button>

            <p className="text-[10px] text-[#9C988F] dark:text-[#3E3D38] tracking-wide text-center">
              Mã truy cập mặc định: <span className="text-[#6E6B64] dark:text-[#5E5D57] font-mono font-medium">admin</span>
            </p>
          </div>
        </form>
      </div>

      {/* Bottom info */}
      <div className="flex justify-between items-center text-[10px] tracking-widest text-[#9C988F] dark:text-[#3E3D38]">
        <span>ENCRYPTED SESSION</span>
        <span>VERSION 2.4</span>
      </div>
    </div>
  );
};
