import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Terjadi kendala yang tidak terduga.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F1E3] text-[#173E2C] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#FCF9F2] border border-[#173E2C]/15 rounded-3xl p-8 text-center shadow-sm">
            <p className="text-xs tracking-widest text-[#D6A23A] font-semibold mb-3">MASHRO</p>
            <h1 className="font-editorial text-3xl font-semibold mb-3">
              Terjadi Gangguan Sistem
            </h1>
            <p className="text-sm text-[#173E2C]/75 mb-6 leading-relaxed">
              Maaf, aplikasi mengalami kendala saat memproses permintaan Anda. Silakan muat ulang halaman untuk mencoba kembali.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-full bg-[#173E2C] text-[#F7F1E3] text-sm font-semibold hover:bg-[#0F2B1E] transition-colors cursor-pointer"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
