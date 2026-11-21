import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Pencil, Utensils } from 'lucide-react';
import {
  EditableControlWrap,
  EditableText,
  useSiteContent,
} from '../context/SiteContentContext';

export function StarOrnament({ className = 'w-3.5 h-3.5 text-[#D6A23A]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 1.5L14.4 9.6L22.5 12L14.4 14.4L12 22.5L9.6 14.4L1.5 12L9.6 9.6L12 1.5Z" />
    </svg>
  );
}

export function BotanicalSprig({ className = 'w-20 h-10 text-[#173E2C]/25' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 36C34 28 66 20 108 14" />
      <path d="M32 30C27 21 31 12 40 12C43 20 39 27 32 30Z" />
      <path d="M56 24C52 15 58 7 67 8C68 16 63 22 56 24Z" />
      <path d="M82 18C79 11 85 5 93 7C93 13 88 17 82 18Z" />
      <path d="M46 27C52 34 61 36 66 30C60 25 52 24 46 27Z" />
      <path d="M72 21C78 27 86 28 91 23C86 18 78 18 72 21Z" />
    </svg>
  );
}

export function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackTitle,
}: {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#E5ECD9] to-[#F7F1E3] text-[#173E2C] p-6 text-center ${className}`}
      >
        <Utensils className="w-8 h-8 text-[#D6A23A] mb-2" aria-hidden="true" />
        <p className="font-editorial text-lg font-semibold">{fallbackTitle}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function TopHeader({
  mode,
  onNavigateHome,
  onStartSurvey,
}: {
  mode: 'landing' | 'survey' | 'admin';
  onNavigateHome: () => void;
  onStartSurvey: () => void;
}) {
  const {
    content,
    adminToken,
    inlineEditMode,
    savingContent,
    lastSavedNotice,
    saveError,
    clearSaveFeedback,
    setInlineEditMode,
    updateContent,
  } = useSiteContent();

  return (
    <header className="sticky top-0 z-30 bg-[#F7F1E3]/92 backdrop-blur-md border-b border-[#173E2C]/12">
      {adminToken && inlineEditMode && (
        <div className="bg-[#173E2C] text-[#F7F1E3] px-4 py-1.5 text-xs flex flex-wrap items-center justify-center gap-3 border-b border-[#D6A23A]/30">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Pencil className="w-3.5 h-3.5 text-[#D6A23A]" aria-hidden="true" />
            <span>
              Mode Edit Langsung Aktif — Klik ikon pensil di teks atau tombol untuk mengedit
            </span>
          </span>
          {savingContent && (
            <span className="px-2.5 py-0.5 rounded-full bg-[#D6A23A]/20 text-[#F7F1E3] font-semibold">
              Menyimpan...
            </span>
          )}
          {!savingContent && lastSavedNotice && (
            <span
              role="status"
              className="px-2.5 py-0.5 rounded-full bg-[#E5ECD9] text-[#173E2C] font-semibold inline-flex items-center gap-1"
            >
              <Check className="w-3 h-3" aria-hidden="true" />
              <span>{lastSavedNotice}</span>
            </span>
          )}
          {saveError && (
            <button
              type="button"
              onClick={clearSaveFeedback}
              className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <AlertCircle className="w-3 h-3" aria-hidden="true" />
              <span>{saveError}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setInlineEditMode(false)}
            className="px-3 py-0.5 rounded-full bg-[#D96B27] text-[#FCF9F2] font-semibold inline-flex items-center gap-1 hover:bg-[#b8561b] cursor-pointer whitespace-nowrap"
          >
            <Check className="w-3 h-3" aria-hidden="true" />
            <span>Selesai Edit</span>
          </button>
        </div>
      )}

      <div className="max-w-6xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between gap-6">
        <div className="flex items-center gap-2 shrink-0">
          {adminToken && inlineEditMode ? (
            <div className="flex items-center gap-2">
              <EditableText
                value={content.brandName}
                editLabel="Ubah nama merek"
                onSave={(next) =>
                  updateContent((prev) => ({
                    ...prev,
                    brandName: next,
                  }))
                }
                className="font-editorial text-2xl font-bold tracking-[0.06em] text-[#173E2C] whitespace-nowrap"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={onNavigateHome}
              className="font-editorial text-2xl font-bold tracking-[0.06em] text-[#173E2C] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#173E2C]"
            >
              {content.brandName}
            </button>
          )}
        </div>

        {mode === 'landing' ? (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#173E2C]/75">
            <EditableControlWrap
              value={content.navCompositionLabel}
              editLabel="Ubah label menu Komposisi Sajian"
              onSave={(next) =>
                updateContent((prev) => ({ ...prev, navCompositionLabel: next }))
              }
            >
              <a
                href="#tentang-sajian"
                className="hover:text-[#173E2C] transition-colors whitespace-nowrap shrink-0"
              >
                {content.navCompositionLabel}
              </a>
            </EditableControlWrap>

            <EditableControlWrap
              value={content.navFlowLabel}
              editLabel="Ubah label menu Alur Survei"
              onSave={(next) => updateContent((prev) => ({ ...prev, navFlowLabel: next }))}
            >
              <a
                href="#alur-survei"
                className="hover:text-[#173E2C] transition-colors whitespace-nowrap shrink-0"
              >
                {content.navFlowLabel}
              </a>
            </EditableControlWrap>

            <EditableControlWrap
              value={content.navPrivacyLabel}
              editLabel="Ubah label menu Privasi Data"
              onSave={(next) => updateContent((prev) => ({ ...prev, navPrivacyLabel: next }))}
            >
              <a
                href="#privasi"
                className="hover:text-[#173E2C] transition-colors whitespace-nowrap shrink-0"
              >
                {content.navPrivacyLabel}
              </a>
            </EditableControlWrap>
          </nav>
        ) : (
          <div className="hidden md:flex items-center text-sm font-medium text-[#173E2C]/65 whitespace-nowrap">
            {mode === 'survey' ? (
              <EditableText
                value={content.surveyTopBarSubtitle}
                editLabel="Ubah subjudul header survei"
                onSave={(next) =>
                  updateContent((prev) => ({ ...prev, surveyTopBarSubtitle: next }))
                }
              />
            ) : (
              <EditableText
                value={content.adminTopBarSubtitle}
                editLabel="Ubah subjudul header portal pemilik"
                onSave={(next) =>
                  updateContent((prev) => ({ ...prev, adminTopBarSubtitle: next }))
                }
              />
            )}
          </div>
        )}

        <div className="shrink-0">
          {mode === 'landing' ? (
            <EditableControlWrap
              value={content.heroCtaLabel}
              editLabel="Ubah teks tombol Mulai Survei"
              onSave={(next) => updateContent((prev) => ({ ...prev, heroCtaLabel: next }))}
            >
              <button
                type="button"
                onClick={onStartSurvey}
                className="px-5 py-2.5 rounded-full bg-[#173E2C] text-[#F7F1E3] text-xs sm:text-sm font-semibold hover:bg-[#0F2B1E] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173E2C]"
              >
                {content.heroCtaLabel}
              </button>
            </EditableControlWrap>
          ) : (
            <EditableControlWrap
              value={content.homeButtonLabel}
              editLabel="Ubah teks tombol Beranda"
              onSave={(next) => updateContent((prev) => ({ ...prev, homeButtonLabel: next }))}
            >
              <button
                type="button"
                onClick={onNavigateHome}
                className="px-4 py-2 rounded-full border border-[#173E2C]/25 text-[#173E2C] text-xs sm:text-sm font-medium hover:bg-[#E5ECD9]/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {content.homeButtonLabel}
              </button>
            </EditableControlWrap>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const { content, updateContent } = useSiteContent();

  return (
    <footer className="border-t border-[#173E2C]/12 bg-[#F7F1E3] mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#173E2C]/70">
        <div className="flex items-center gap-2.5">
          <StarOrnament className="w-3 h-3 text-[#D6A23A] shrink-0" />
          <EditableText
            value={content.footerText}
            editLabel="Ubah teks footer kiri"
            onSave={(next) =>
              updateContent((prev) => ({
                ...prev,
                footerText: next,
              }))
            }
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <EditableText
            value={content.footerSubtext}
            editLabel="Ubah teks footer kanan"
            onSave={(next) =>
              updateContent((prev) => ({
                ...prev,
                footerSubtext: next,
              }))
            }
          />
          <span aria-hidden="true">·</span>
          <EditableControlWrap
            value={content.portalButtonLabel}
            editLabel="Ubah teks tombol Portal Pemilik"
            onSave={(next) =>
              updateContent((prev) => ({
                ...prev,
                portalButtonLabel: next,
              }))
            }
          >
            <button
              type="button"
              onClick={onOpenAdmin}
              className="text-[#173E2C]/65 hover:text-[#173E2C] underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {content.portalButtonLabel}
            </button>
          </EditableControlWrap>
        </div>
      </div>
    </footer>
  );
}
