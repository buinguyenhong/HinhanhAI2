/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Upload, RefreshCw, Check, ArrowRight, Plus, LogOut } from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'dashboard' | 'history' | 'settings'>('editor');

  // Kiểm tra trạng thái đăng nhập từ LocalStorage khi khởi chạy
  useEffect(() => {
    const isLogged = localStorage.getItem('ai_studio_auth') === 'true';
    if (isLogged) {
      setIsAuthenticated(true);
    }
  }, []);

  if (!isAuthenticated) {
    return <LoginView onLogin={() => {
      setIsAuthenticated(true);
      localStorage.setItem('ai_studio_auth', 'true');
    }} />;
  }

  const handleLogout = () => {
    localStorage.removeItem('ai_studio_auth');
    setIsAuthenticated(false);
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-400 flex flex-col font-sans selection:bg-zinc-800 selection:text-zinc-100">
      {/* Header */}
      <header className="px-8 pt-8 pb-6 flex items-end justify-between border-b border-zinc-800/40">
        <div>
          <h1 className="text-lg font-medium tracking-tight text-zinc-100">AI Image Studio</h1>
          <p className="text-[11px] uppercase tracking-widest text-zinc-600 mt-1">High-Fidelity Editor</p>
        </div>
        <nav className="flex items-center gap-8">
          <TabButton active={activeTab === 'editor'} onClick={() => setActiveTab('editor')} label="Chỉnh sửa" />
          <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} label="Tổng quan" />
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} label="Lịch sử" />
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Cấu hình" />
          <div className="w-px h-4 bg-zinc-800/60 ml-2" />
          <button 
            onClick={handleLogout}
            className="text-zinc-500 hover:text-zinc-100 transition-colors"
            title="Đăng xuất"
          >
            <LogOut size={16} />
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto px-8 py-8 w-full max-w-[1600px] mx-auto">
        {activeTab === 'editor' && <EditorView />}
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm tracking-wide transition-colors relative pb-1 ${
        active ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-zinc-100" />
      )}
    </button>
  );
}

function LoginView({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const correctPassword = import.meta.env.VITE_APP_PASSWORD || 'admin';
      if (password === correctPassword) {
        onLogin();
      } else {
        setError('Thông tin không chính xác.');
      }
      setIsLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-12">
          <h1 className="text-xl font-medium tracking-tight text-zinc-100 mb-2">Hệ thống quản trị</h1>
          <p className="text-sm text-zinc-500">Vui lòng xác thực để tiếp tục.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-3">
            <label className="block text-[10px] uppercase tracking-widest text-zinc-500">Mã truy cập</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border-b border-zinc-700 p-2 pl-0 text-zinc-100 focus:outline-none focus:border-zinc-300 transition-colors rounded-none"
              placeholder="Nhập mã..."
              autoFocus
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full bg-zinc-100 text-[#09090B] hover:bg-white font-medium py-3 px-4 flex items-center justify-between transition-colors disabled:opacity-50"
          >
            <span className="text-sm">{isLoading ? "Đang xác thực..." : "Tiếp tục"}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

function EditorView() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [numImages, setNumImages] = useState(1);
  const [genState, setGenState] = useState<'idle' | 'generating' | 'done'>('idle');
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setPrompt("Chân dung nghệ thuật, chất lượng cao 8k, siêu chi tiết. Ánh sáng điện ảnh, màu sắc tương phản mạnh. Giữ nguyên tỷ lệ khuôn mặt và cấu trúc chủ thể, áp dụng phong cách dark academia với ánh sáng tự nhiên hắt qua cửa sổ...");
      setIsAnalyzing(false);
    }, 1500);
  };

  const handleGenerate = () => {
    setGenState('generating');
    setTimeout(() => {
      setGenState('done');
      setSelectedImage(0);
    }, 2500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
      {/* Left Column: Controls (Span 4) */}
      <div className="space-y-12 lg:col-span-4">
        
        {/* Upload Section */}
        <div className="space-y-6">
          <h2 className="text-[10px] uppercase tracking-widest text-zinc-500">Dữ liệu đầu vào</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="aspect-square border border-zinc-800/60 bg-[#0F0F11] hover:border-zinc-500 transition-colors cursor-pointer flex flex-col items-center justify-center p-4 group">
              <Plus size={16} className="text-zinc-600 group-hover:text-zinc-300 mb-3" />
              <p className="text-xs text-zinc-500 group-hover:text-zinc-300">Ảnh gốc</p>
            </div>
            <div className="aspect-square border border-zinc-800/60 bg-[#0F0F11] hover:border-zinc-500 transition-colors cursor-pointer flex flex-col items-center justify-center p-4 group">
              <Plus size={16} className="text-zinc-600 group-hover:text-zinc-300 mb-3" />
              <p className="text-xs text-zinc-500 group-hover:text-zinc-300">Ảnh phong cách</p>
            </div>
          </div>
        </div>

        {/* AI & Prompt Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] uppercase tracking-widest text-zinc-500">Chỉ thị (Prompt)</h2>
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="text-xs text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? "Đang phân tích..." : "Tự động nội suy từ ảnh"}
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full bg-transparent border-b border-zinc-800/60 p-2 pl-0 text-sm text-zinc-100 focus:outline-none focus:border-zinc-400 min-h-[100px] resize-none rounded-none"
            placeholder="Miêu tả chi tiết hình ảnh mong muốn..."
          />
        </div>

        {/* Parameters */}
        <div className="space-y-6">
          <h2 className="text-[10px] uppercase tracking-widest text-zinc-500">Tham số cấu hình</h2>
          
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800/40 pb-4">
              <span className="text-sm text-zinc-400">Kích thước (Max)</span>
              <select className="bg-transparent text-sm text-zinc-100 focus:outline-none cursor-pointer text-right appearance-none hover:text-white transition-colors">
                <option value="1024" className="bg-[#121214]">1024px</option>
                <option value="2048" className="bg-[#121214]">2048px (2K)</option>
                <option value="4096" className="bg-[#121214]">4096px (4K)</option>
              </select>
            </div>

            <div className="flex items-center justify-between border-b border-zinc-800/40 pb-4">
              <span className="text-sm text-zinc-400">Chất lượng</span>
              <select className="bg-transparent text-sm text-zinc-100 focus:outline-none cursor-pointer text-right appearance-none hover:text-white transition-colors">
                <option value="standard" className="bg-[#121214]">Tiêu chuẩn</option>
                <option value="high" className="bg-[#121214]">Chất lượng cao</option>
                <option value="raw" className="bg-[#121214]">Tối đa (Lossless)</option>
              </select>
            </div>

            <div className="flex items-center justify-between border-b border-zinc-800/40 pb-4">
              <span className="text-sm text-zinc-400">Số lượng kết quả</span>
              <div className="flex items-center gap-4">
                <input 
                  type="range" min="1" max="4" value={numImages} 
                  onChange={(e) => setNumImages(parseInt(e.target.value))}
                  className="w-24 accent-zinc-300"
                />
                <span className="text-xs font-medium text-zinc-100 w-4">{numImages}</span>
              </div>
            </div>
            
            <label className="flex items-center justify-between cursor-pointer border-b border-zinc-800/40 pb-4 group">
              <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Cố định cấu trúc chủ thể (ControlNet)</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 accent-zinc-100 bg-[#0F0F11] border-zinc-700" />
            </label>

            <div className="flex items-center justify-between border-b border-zinc-800/40 pb-4">
              <span className="text-sm text-zinc-400">Tỷ lệ (Aspect Ratio)</span>
              <select className="bg-transparent text-sm text-zinc-100 focus:outline-none cursor-pointer text-right appearance-none hover:text-white transition-colors">
                <option value="original" className="bg-[#121214]">Theo ảnh gốc</option>
                <option value="1:1" className="bg-[#121214]">1:1 (Vuông)</option>
                <option value="16:9" className="bg-[#121214]">16:9 (Ngang)</option>
                <option value="9:16" className="bg-[#121214]">9:16 (Dọc)</option>
                <option value="4:3" className="bg-[#121214]">4:3 (Tiêu chuẩn)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="pt-4">
          <button 
            onClick={handleGenerate}
            disabled={genState === 'generating'}
            className="w-full bg-zinc-100 text-[#09090B] hover:bg-white font-medium py-3 px-4 flex items-center justify-between transition-colors disabled:opacity-70"
          >
            <span className="text-sm">{genState === 'generating' ? "Đang xử lý dữ liệu..." : "Bắt đầu tạo ảnh"}</span>
            {genState === 'generating' ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          </button>
        </div>
      </div>

      {/* Right Column: Preview (Span 8) */}
      <div className="lg:col-span-8 flex flex-col h-full min-h-[700px] border border-zinc-800/40 bg-[#0C0C0E] relative p-8">
        
        {genState === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
            <p className="text-sm font-light tracking-wide">Chưa có kết xuất hình ảnh.</p>
            <p className="text-xs mt-2 text-zinc-700">Không gian hiển thị kết quả.</p>
          </div>
        )}

        {genState === 'generating' && (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-300">
            <RefreshCw size={24} className="animate-spin mb-4 text-zinc-500" />
            <p className="text-sm tracking-wide">Hệ thống đang nội suy...</p>
          </div>
        )}

        {genState === 'done' && (
          <div className="flex flex-col h-full">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h3 className="text-lg font-medium text-zinc-100">Kết xuất hoàn tất</h3>
                <p className="text-xs text-zinc-500 mt-1">Chọn phiên bản đạt chất lượng tốt nhất.</p>
              </div>
            </div>

            {/* Grid */}
            <div className={`grid gap-4 flex-1 ${numImages === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {Array.from({ length: numImages }).map((_, idx) => (
                <div 
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`relative cursor-pointer transition-all border ${
                    selectedImage === idx ? 'border-zinc-300' : 'border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div className="absolute inset-0 bg-[#121214] flex items-center justify-center">
                    <span className="text-xs text-zinc-700 tracking-widest uppercase">Variant 0{idx + 1}</span>
                  </div>
                  {selectedImage === idx && (
                    <div className="absolute top-4 right-4 text-zinc-100">
                      <Check size={18} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-8 pt-6 border-t border-zinc-800/40 flex items-center justify-between">
              <button 
                onClick={() => setGenState('idle')}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Hủy bỏ & Thử lại
              </button>
              <button 
                disabled={selectedImage === null}
                className="px-6 py-2 bg-zinc-100 text-[#09090B] text-sm font-medium hover:bg-white transition-colors disabled:opacity-30 disabled:hover:bg-zinc-100"
              >
                Xuất file lên Drive
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardView() {
  return (
    <div className="max-w-5xl space-y-16">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-800/40 border border-zinc-800/40">
        <div className="bg-[#09090B] p-8">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Token đã sử dụng</p>
          <div className="text-4xl font-light text-zinc-100">1,250</div>
          <p className="text-xs text-zinc-500 mt-2">Trên tổng số 5,000 token / tháng</p>
        </div>
        <div className="bg-[#09090B] p-8">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Kết xuất</p>
          <div className="text-4xl font-light text-zinc-100">42</div>
          <p className="text-xs text-zinc-500 mt-2">Hình ảnh đã được tạo</p>
        </div>
        <div className="bg-[#09090B] p-8">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Dung lượng Drive</p>
          <div className="text-4xl font-light text-zinc-100">84<span className="text-xl text-zinc-500 ml-1">MB</span></div>
          <p className="text-xs text-zinc-500 mt-2">Đã đồng bộ trữ lượng</p>
        </div>
      </div>

      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 mb-6">Định mức hệ thống</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm w-32 text-zinc-400">Tiêu chuẩn</span>
            <div className="flex-1 h-[1px] bg-zinc-800">
              <div className="h-[1px] bg-zinc-400 w-[25%]" />
            </div>
            <span className="text-xs text-zinc-500 w-16 text-right">25%</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm w-32 text-zinc-400">ControlNet</span>
            <div className="flex-1 h-[1px] bg-zinc-800">
              <div className="h-[1px] bg-zinc-400 w-[45%]" />
            </div>
            <span className="text-xs text-zinc-500 w-16 text-right">45%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryView() {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-500">Lịch sử kết xuất</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-800/40 border border-zinc-800/40">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-[#09090B] aspect-square relative group p-6 flex flex-col justify-between cursor-pointer hover:bg-[#121214] transition-colors">
            <p className="text-xs text-zinc-600 tracking-widest uppercase">0{i}</p>
            <div>
              <p className="text-sm text-zinc-300 line-clamp-2 leading-relaxed">Chân dung nghệ thuật, chất lượng cao 8k, siêu chi tiết...</p>
              <p className="text-[10px] text-zinc-600 mt-3">{i * 2} giờ trước</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="max-w-2xl space-y-16">
      <div className="space-y-8">
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-500">Kết nối API</h2>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs text-zinc-400">Endpoint URL</label>
            <input 
              type="text" 
              className="w-full bg-transparent border-b border-zinc-800/60 p-2 pl-0 text-sm text-zinc-100 focus:outline-none focus:border-zinc-400 rounded-none transition-colors" 
              placeholder="https://api.domain.com/v1/..."
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs text-zinc-400">API Key</label>
            <input 
              type="password" 
              className="w-full bg-transparent border-b border-zinc-800/60 p-2 pl-0 text-sm text-zinc-100 focus:outline-none focus:border-zinc-400 rounded-none transition-colors" 
              placeholder="Nhập khóa bảo mật..."
            />
            <p className="text-[11px] text-zinc-600 mt-2">Dữ liệu được mã hóa và lưu trữ cục bộ.</p>
          </div>
        </div>
      </div>

      <div className="space-y-8 pt-8 border-t border-zinc-800/40">
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-500">Lưu trữ đám mây</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-200">Google Drive</p>
            <p className="text-xs text-zinc-500 mt-1">Trạng thái: Chưa kết nối</p>
          </div>
          <button className="px-4 py-2 border border-zinc-800 hover:border-zinc-500 text-sm text-zinc-300 transition-colors">
            Khởi tạo kết nối
          </button>
        </div>
      </div>
    </div>
  );
}

