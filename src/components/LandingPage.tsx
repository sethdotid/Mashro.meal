import React, { useState } from 'react';
import { ArrowRight, Clock, Crop, ShieldCheck } from 'lucide-react';
import { EditableControlWrap, EditableText, useSiteContent } from '../context/SiteContentContext';
import { BotanicalSprig, ImageWithFallback, StarOrnament } from './BrandMotifs';
import { ImageCropperModal } from './ImageCropperModal';
import { SoundToggle } from './SoundToggle';

interface LandingPageProps {
  onStartSurvey: () => void;
}

export function LandingPage({ onStartSurvey }: LandingPageProps) {
  const { content, adminToken, inlineEditMode, updateContent } = useSiteContent();
  const [cropTarget, setCropTarget] = useState<'hero' | 'composition' | null>(null);

  const canInlineEdit = Boolean(adminToken && inlineEditMode);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-12 sm:pt-12">
      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-between py-2">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-medium tracking-wider text-[#173E2C]/75">
                <StarOrnament className="w-3.5 h-3.5 text-[#D6A23A] shrink-0" />
                <EditableText
                  value={content.brandName}
                  editLabel="Ubah nama merek"
                  onSave={(next) => updateContent((prev) => ({ ...prev, brandName: next }))}
                />
                <span aria-hidden="true">·</span>
                <EditableText
                  value={content.heroEyebrow}
                  editLabel="Ubah label sub-merek"
                  onSave={(next) => updateContent((prev) => ({ ...prev, heroEyebrow: next }))}
                />
              </div>
              <SoundToggle />
            </div>

            <h1 className="font-editorial text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold leading-[1.08] text-[#173E2C] text-balance mb-5">
              <EditableText
                value={content.heroTitle}
                editLabel="Ubah judul utama"
                onSave={(next) => updateContent((prev) => ({ ...prev, heroTitle: next }))}
              />
            </h1>

            <p className="font-editorial italic text-xl sm:text-2xl text-[#173E2C]/85 mb-6">
              <EditableText
                value={content.heroSubtitle}
                editLabel="Ubah subjudul hero"
                onSave={(next) => updateContent((prev) => ({ ...prev, heroSubtitle: next }))}
              />
            </p>

            <p className="text-base text-[#173E2C]/80 leading-relaxed max-w-xl mb-8">
              <EditableText
                value={content.heroDescription}
                multiline
                editLabel="Ubah deskripsi pengantar"
                onSave={(next) => updateContent((prev) => ({ ...prev, heroDescription: next }))}
              />
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#173E2C]/80 border-y border-[#173E2C]/12 py-3.5">
              <span className="inline-flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D6A23A] shrink-0" aria-hidden="true" />
                <EditableText
                  value={content.heroTimeEstimate}
                  editLabel="Ubah estimasi waktu"
                  onSave={(next) => updateContent((prev) => ({ ...prev, heroTimeEstimate: next }))}
                />
              </span>
              <span aria-hidden="true" className="hidden sm:inline text-[#173E2C]/30">
                ·
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#173E2C]/70 shrink-0" aria-hidden="true" />
                <EditableText
                  value={content.heroPrivacyBadge}
                  editLabel="Ubah lencana privasi"
                  onSave={(next) => updateContent((prev) => ({ ...prev, heroPrivacyBadge: next }))}
                />
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <EditableControlWrap
                  value={content.heroCtaLabel}
                  editLabel="Ubah teks tombol Mulai Survei"
                  onSave={(next) => updateContent((prev) => ({ ...prev, heroCtaLabel: next }))}
                >
                  <button
                    type="button"
                    onClick={onStartSurvey}
                    className="w-full sm:w-auto min-h-[48px] px-8 py-3.5 rounded-2xl bg-[#173E2C] text-[#F7F1E3] text-base font-semibold inline-flex items-center justify-center gap-3 hover:bg-[#0F2B1E] transition-colors shadow-sm cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173E2C]"
                  >
                    <span>{content.heroCtaLabel}</span>
                    <ArrowRight className="w-4 h-4 text-[#D96B27] shrink-0" aria-hidden="true" />
                  </button>
                </EditableControlWrap>
              </div>
              <span className="text-xs text-[#5C3D28]/75">
                <EditableText
                  value={content.heroCtaNote}
                  editLabel="Ubah catatan tombol CTA"
                  onSave={(next) => updateContent((prev) => ({ ...prev, heroCtaNote: next }))}
                />
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="h-full min-h-[280px] sm:min-h-[380px] rounded-3xl overflow-hidden bg-[#E5ECD9]/60 border border-[#173E2C]/10 shadow-sm relative group">
            <ImageWithFallback
              src={content.heroImageUrl}
              alt={content.heroImageAlt}
              fallbackTitle={`${content.brandName} Healthy Meal Bowl`}
              className="w-full h-full object-cover"
            />
            {canInlineEdit && (
              <button
                type="button"
                onClick={() => setCropTarget('hero')}
                className="absolute bottom-4 right-4 min-h-[42px] px-4 py-2 rounded-full bg-[#173E2C]/92 text-[#F7F1E3] border border-[#D6A23A] text-xs font-semibold inline-flex items-center gap-2 shadow-lg hover:bg-[#0F2B1E] cursor-pointer"
              >
                <Crop className="w-4 h-4 text-[#D6A23A]" aria-hidden="true" />
                <span>Ubah & Crop Gambar Utama</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="my-12 sm:my-16 flex items-center justify-center gap-4">
        <div className="h-px flex-1 bg-[#173E2C]/12" />
        <BotanicalSprig className="w-24 h-10 text-[#173E2C]/35" />
        <div className="h-px flex-1 bg-[#173E2C]/12" />
      </div>

      {/* Komposisi Sajian */}
      <section id="tentang-sajian" className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="lg:col-span-5 order-2 lg:order-1">
          <div className="rounded-3xl overflow-hidden border border-[#173E2C]/10 bg-[#FCF9F2] shadow-sm aspect-[4/3] relative">
            <ImageWithFallback
              src={content.compositionImageUrl}
              alt={content.compositionImageAlt}
              fallbackTitle={`Bahan Alami Pilihan ${content.brandName}`}
              className="w-full h-full object-cover"
            />
            {canInlineEdit && (
              <button
                type="button"
                onClick={() => setCropTarget('composition')}
                className="absolute bottom-3 right-3 min-h-[40px] px-3.5 py-2 rounded-full bg-[#173E2C]/92 text-[#F7F1E3] border border-[#D6A23A] text-xs font-semibold inline-flex items-center gap-2 shadow-lg hover:bg-[#0F2B1E] cursor-pointer"
              >
                <Crop className="w-3.5 h-3.5 text-[#D6A23A]" aria-hidden="true" />
                <span>Ubah & Crop Gambar Bahan</span>
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 order-1 lg:order-2">
          <p className="text-xs font-semibold tracking-wider text-[#D6A23A] mb-2">
            <EditableText
              value={content.compositionEyebrow}
              editLabel="Ubah label komposisi"
              onSave={(next) => updateContent((prev) => ({ ...prev, compositionEyebrow: next }))}
            />
          </p>
          <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#173E2C] mb-6 text-balance">
            <EditableText
              value={content.compositionTitle}
              editLabel="Ubah judul komposisi"
              onSave={(next) => updateContent((prev) => ({ ...prev, compositionTitle: next }))}
            />
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {content.bowlComponents.map((item, idx) => (
              <div
                key={`bowl-component-${idx}`}
                className="p-5 rounded-2xl bg-[#FCF9F2] border border-[#173E2C]/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-[#D6A23A] tabular-nums">
                    0{idx + 1}
                  </span>
                  <StarOrnament className="w-3 h-3 text-[#D6A23A]/70" />
                </div>
                <h3 className="font-editorial text-xl font-semibold text-[#173E2C] mb-1.5">
                  <EditableText
                    value={item.name}
                    editLabel={`Ubah nama komponen ${idx + 1}`}
                    onSave={(next) =>
                      updateContent((prev) => ({
                        ...prev,
                        bowlComponents: prev.bowlComponents.map((comp, i) =>
                          i === idx ? { ...comp, name: next } : comp
                        ),
                      }))
                    }
                  />
                </h3>
                <p className="text-sm text-[#173E2C]/75 leading-relaxed">
                  <EditableText
                    value={item.detail}
                    multiline
                    editLabel={`Ubah deskripsi komponen ${idx + 1}`}
                    onSave={(next) =>
                      updateContent((prev) => ({
                        ...prev,
                        bowlComponents: prev.bowlComponents.map((comp, i) =>
                          i === idx ? { ...comp, detail: next } : comp
                        ),
                      }))
                    }
                  />
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Alur Survei & Privasi */}
      <section id="alur-survei" className="mt-14 sm:mt-16 pt-12 border-t border-[#173E2C]/12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#D6A23A] mb-2">
              <EditableText
                value={content.flowEyebrow}
                editLabel="Ubah label alur"
                onSave={(next) => updateContent((prev) => ({ ...prev, flowEyebrow: next }))}
              />
            </p>
            <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#173E2C]">
              <EditableText
                value={content.flowTitle}
                editLabel="Ubah judul alur"
                onSave={(next) => updateContent((prev) => ({ ...prev, flowTitle: next }))}
              />
            </h2>
          </div>
          <p className="text-sm text-[#173E2C]/70 max-w-md">
            <EditableText
              value={content.flowDescription}
              multiline
              editLabel="Ubah deskripsi alur"
              onSave={(next) => updateContent((prev) => ({ ...prev, flowDescription: next }))}
            />
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {content.surveyOutline.map((item, idx) => (
            <div
              key={item.step}
              className="p-6 rounded-2xl bg-[#FCF9F2] border border-[#5C3D28]/15"
            >
              <p className="font-mono text-xs font-semibold text-[#D96B27] mb-3 tabular-nums">
                Stasiun {item.step}
              </p>
              <h3 className="font-editorial text-2xl font-semibold text-[#173E2C] mb-2">
                <EditableText
                  value={item.title}
                  editLabel={`Ubah judul stasiun ${item.step}`}
                  onSave={(next) =>
                    updateContent((prev) => ({
                      ...prev,
                      surveyOutline: prev.surveyOutline.map((o, i) =>
                        i === idx ? { ...o, title: next } : o
                      ),
                    }))
                  }
                />
              </h3>
              <p className="text-sm text-[#5C3D28]/80 leading-relaxed">
                <EditableText
                  value={item.desc}
                  multiline
                  editLabel={`Ubah deskripsi stasiun ${item.step}`}
                  onSave={(next) =>
                    updateContent((prev) => ({
                      ...prev,
                      surveyOutline: prev.surveyOutline.map((o, i) =>
                        i === idx ? { ...o, desc: next } : o
                      ),
                    }))
                  }
                />
              </p>
            </div>
          ))}
        </div>

        <div
          id="privasi"
          className="mt-8 p-6 rounded-2xl bg-[#E5ECD9]/60 border border-[#5C3D28]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <h3 className="font-editorial text-xl font-semibold text-[#173E2C]">
              <EditableText
                value={content.privacyTitle}
                editLabel="Ubah judul privasi"
                onSave={(next) => updateContent((prev) => ({ ...prev, privacyTitle: next }))}
              />
            </h3>
            <p className="text-sm text-[#173E2C]/80 leading-relaxed max-w-2xl">
              <EditableText
                value={content.privacyDescription}
                multiline
                editLabel="Ubah isi pemberitahuan privasi"
                onSave={(next) => updateContent((prev) => ({ ...prev, privacyDescription: next }))}
              />
            </p>
          </div>
          <EditableControlWrap
            value={content.privacyCtaLabel}
            editLabel="Ubah teks tombol Mulai Survei Sekarang"
            onSave={(next) => updateContent((prev) => ({ ...prev, privacyCtaLabel: next }))}
          >
            <button
              type="button"
              onClick={onStartSurvey}
              className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-[#173E2C] text-[#F7F1E3] text-sm font-semibold hover:bg-[#0F2B1E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {content.privacyCtaLabel}
            </button>
          </EditableControlWrap>
        </div>
      </section>

      <ImageCropperModal
        open={cropTarget !== null}
        title={cropTarget === 'hero' ? 'Foto Sajian Utama (Hero)' : 'Foto Komposisi Bahan'}
        initialAspect={4 / 3}
        onClose={() => setCropTarget(null)}
        onApply={async (croppedDataUrl) => {
          const target = cropTarget;
          if (!target) return;
          await updateContent((prev) =>
            target === 'hero'
              ? { ...prev, heroImageUrl: croppedDataUrl }
              : { ...prev, compositionImageUrl: croppedDataUrl }
          );
        }}
      />
    </main>
  );
}
