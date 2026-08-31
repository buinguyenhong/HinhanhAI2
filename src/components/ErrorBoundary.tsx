import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled application error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    (this as any).setState({ hasError: false, message: undefined });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#F8F7F4] text-[#1C1B18] flex items-center justify-center p-8">
        <div className="w-full max-w-md border border-[#E2DDD5] bg-white p-8 text-center space-y-5">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#9C988F] font-mono">
              HinhanhAI / Application Error
            </p>
            <h1 className="text-lg font-medium">Không thể hiển thị trang</h1>
            <p className="text-xs text-[#6E6B64] leading-relaxed">
              Ứng dụng gặp lỗi ngoài dự kiến. Vui lòng tải lại trang để tiếp tục làm việc.
            </p>
            {this.state.message && (
              <p className="text-[10px] font-mono text-[#DC2626] break-all px-2 py-1 bg-red-50 border border-red-100">
                {this.state.message}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex-1 border border-[#E2DDD5] text-[#1C1B18] text-xs uppercase tracking-[0.16em] font-medium py-3 px-5 hover:bg-[#F2EFE9] transition-colors cursor-pointer"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 bg-[#1C1B18] text-[#F8F7F4] text-xs uppercase tracking-[0.16em] font-medium py-3 px-5 hover:bg-[#2F2E2B] transition-colors cursor-pointer"
            >
              Tải lại ứng dụng
            </button>
          </div>
        </div>
      </div>
    );
  }
}
