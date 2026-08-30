import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export const DashboardView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-16 transition-colors">
      {/* Header */}
      <div className="flex items-baseline justify-between border-b border-[#E2DDD5] dark:border-[#1D1D1B] pb-4">
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-[#1C1B18] dark:text-[#E8E7E2]">
            Studio Metrics & Ledger
          </h2>
          <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono mt-0.5">
            Tổng quan hiệu suất kết xuất hình ảnh & hạn ngạch tính toán
          </p>
        </div>
        <span className="text-[10px] font-mono text-[#6E6B64] dark:text-[#8C8B84]">
          SESSION ID: HN-7729
        </span>
      </div>

      {/* Numerical Data Rows (Clean Editorial Minimal Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-6 space-y-3">
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#9C988F] dark:text-[#5E5D57] font-mono block">
            Images Rendered
          </span>
          <div className="text-3xl font-light text-[#1C1B18] dark:text-[#E8E7E2] tracking-tight font-sans">
            1,428
          </div>
          <p className="text-[10px] text-[#6E6B64] dark:text-[#8C8B84]">
            +24 tác phẩm trong hôm nay
          </p>
        </div>

        <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-6 space-y-3">
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#9C988F] dark:text-[#5E5D57] font-mono block">
            Compute Credits
          </span>
          <div className="text-3xl font-light text-[#1C1B18] dark:text-[#E8E7E2] tracking-tight font-sans">
            348.5 <span className="text-xs text-[#9C988F] dark:text-[#5E5D57]">/ 1,000</span>
          </div>
          <p className="text-[10px] text-[#6E6B64] dark:text-[#8C8B84]">
            Hạn mức khả dụng 65.1%
          </p>
        </div>

        <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-6 space-y-3">
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#9C988F] dark:text-[#5E5D57] font-mono block">
            Average Render Time
          </span>
          <div className="text-3xl font-light text-[#1C1B18] dark:text-[#E8E7E2] tracking-tight font-sans">
            2.4s
          </div>
          <p className="text-[10px] text-[#6E6B64] dark:text-[#8C8B84]">
            Flux.1 Dev 20-step inferencing
          </p>
        </div>

        <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-6 space-y-3">
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#9C988F] dark:text-[#5E5D57] font-mono block">
            Drive Storage Sync
          </span>
          <div className="text-3xl font-light text-[#1C1B18] dark:text-[#E8E7E2] tracking-tight font-sans">
            98.2%
          </div>
          <p className="text-[10px] text-[#6E6B64] dark:text-[#8C8B84]">
            1,402 ảnh đã đồng bộ an toàn
          </p>
        </div>
      </div>

      {/* Model Utilization Breakdown */}
      <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-[0.18em] text-[#1C1B18] dark:text-[#E8E7E2] font-medium">
            Phân bổ tải mô hình AI
          </h3>
          <span className="text-[10px] font-mono text-[#9C988F] dark:text-[#5E5D57]">
            30 NGÀY QUA
          </span>
        </div>

        <div className="space-y-4">
          <ModelBar
            name="Flux.1 Dev Editorial"
            percentage={68}
            count="972 runs"
            desc="Mô hình chính cho ảnh chân dung & nghệ thuật ánh sáng"
          />
          <ModelBar
            name="SDXL Master Pro"
            percentage={22}
            count="314 runs"
            desc="Mô hình kết xuất bố cục rộng và cảnh quan"
          />
          <ModelBar
            name="Imagen 3 High-Fidelity"
            percentage={10}
            count="142 runs"
            desc="Mô hình siêu thực nghiệm chất liệu chi tiết cao"
          />
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#EDE9E1] dark:border-[#1D1D1B]">
          <h3 className="text-xs uppercase tracking-[0.18em] text-[#1C1B18] dark:text-[#E8E7E2] font-medium">
            Nhật ký tác vụ gần nhất
          </h3>
          <span className="text-[10px] font-mono text-[#9C988F] dark:text-[#5E5D57]">
            REAL-TIME LOGS
          </span>
        </div>

        <div className="space-y-3 font-mono text-xs">
          <LogRow
            time="10:42:15"
            event="Render Completed (Flux.1 Dev)"
            details="Ratio: 4:3 • 4 Variations • Latency: 2.6s"
            status="SUCCESS"
          />
          <LogRow
            time="10:40:02"
            event="Google Drive Synchronized"
            details="Saved: hinhanhai_A7F92B.jpg to /AI_Studio/Works"
            status="SYNCED"
          />
          <LogRow
            time="09:15:33"
            event="Reference Analyzed"
            details="Extracted: 6 style attributes, 85mm lens profile"
            status="SUCCESS"
          />
          <LogRow
            time="08:50:11"
            event="Session Authenticated"
            details="Workspace accessed via Encrypted Code"
            status="AUTH"
          />
        </div>
      </div>
    </div>
  );
};

function ModelBar({
  name,
  percentage,
  count,
  desc,
}: {
  name: string;
  percentage: number;
  count: string;
  desc: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline text-xs">
        <div>
          <span className="text-[#1C1B18] dark:text-[#E8E7E2] font-medium font-sans">{name}</span>
          <span className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] ml-2 hidden sm:inline">
            {desc}
          </span>
        </div>
        <span className="font-mono text-[11px] text-[#6E6B64] dark:text-[#8C8B84]">
          {count} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-[#EDE9E1] dark:bg-[#1A1A18] h-1 overflow-hidden">
        <div
          className="bg-[#1C1B18] dark:bg-[#D8D3C5] h-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function LogRow({
  time,
  event,
  details,
  status,
}: {
  time: string;
  event: string;
  details: string;
  status: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-[#EDE9E1] dark:border-[#161614] gap-1 text-[11px]">
      <div className="flex items-center gap-3">
        <span className="text-[#9C988F] dark:text-[#5E5D57]">{time}</span>
        <span className="text-[#1C1B18] dark:text-[#E8E7E2]">{event}</span>
      </div>
      <div className="flex items-center gap-4 text-[#6E6B64] dark:text-[#8C8B84]">
        <span className="truncate max-w-xs">{details}</span>
        <span className="text-[#1C1B18] dark:text-[#D8D3C5] font-semibold text-[9px]">{status}</span>
      </div>
    </div>
  );
}
