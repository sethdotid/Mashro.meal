import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Edit3,
  Loader2,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import { EditableControlWrap, EditableText, useSiteContent } from '../context/SiteContentContext';
import { SiteContentConfig } from '../types/siteConfig';
import {
  ACTIVITY_OPTIONS,
  BOARDING_PASS_STATIONS,
  CONDITION_CASSAVA_OPTIONS,
  CONDITION_CHICKEN_OPTIONS,
  CONDITION_SAUCE_OPTIONS,
  CONDITION_VEGETABLES_OPTIONS,
  FAVORITE_COMPONENT_OPTIONS,
  FOOD_CONDITION_OVERALL_OPTIONS,
  INITIAL_SURVEY_DRAFT,
  PACKAGING_RATING_ITEMS,
  PREORDER_ITEMS,
  PRICE_REASONABLE_OPTIONS,
  PRICE_WORTH_IT_OPTIONS,
  PRODUCT_EXPERIENCE_ITEMS,
  PURCHASE_FREQUENCY_OPTIONS,
  REPURCHASE_INTENTION_OPTIONS,
  SATIETY_OPTIONS,
  SurveyDraft,
  SurveyStepId,
} from '../types/survey';
import { submitSurveyResponse } from '../services/surveyService';
import { playPageTransition, playSuccess, playTap } from '../utils/soundEngine';
import { getVisibleSteps, validateStep } from '../utils/surveyLogic';
import { BotanicalSprig, StarOrnament } from './BrandMotifs';
import { ConfettiBurst } from './ConfettiBurst';
import { ConstellationIndicator } from './ConstellationIndicator';
import { ExpressionIndicator } from './ExpressionIndicator';
import {
  CheckboxOptionGroup,
  RadioOptionGroup,
  Scale1to5,
} from './RatingControls';
import { SoundToggle } from './SoundToggle';
import { VolumeMeter } from './VolumeMeter';
import { WallClockPicker } from './WallClockPicker';

interface SurveyWizardProps {
  onReturnHome: () => void;
}

type WizardOutcome = 'active' | 'never_tasted' | 'thank_you';

export function SurveyWizard({ onReturnHome }: SurveyWizardProps) {
  const { content, updateContent } = useSiteContent();

  const [draft, setDraft] = useState<SurveyDraft>(INITIAL_SURVEY_DRAFT);
  const [currentStepId, setCurrentStepId] = useState<SurveyStepId>('respondent');
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [outcome, setOutcome] = useState<WizardOutcome>('active');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const visibleSteps = useMemo(() => {
    return getVisibleSteps(draft).map((step) => {
      const custom = content.steps[step.id];
      return custom
        ? {
            ...step,
            title: custom.title || step.title,
            shortTitle: custom.shortTitle || step.shortTitle,
            subtitle: custom.subtitle || step.subtitle,
          }
        : step;
    });
  }, [draft, content.steps]);

  const currentStepIndex = Math.max(
    0,
    visibleSteps.findIndex((s) => s.id === currentStepId)
  );
  const currentStepMeta = visibleSteps[currentStepIndex] ?? visibleSteps[0];
  const progressPercent = Math.round(((currentStepIndex + 1) / visibleSteps.length) * 100);

  const customQuestionsForStep = useMemo(
    () => content.customQuestions.filter((cq) => cq.placement === currentStepId),
    [content.customQuestions, currentStepId]
  );

  const getStationCopy = (stepId: SurveyStepId) => {
    const base = BOARDING_PASS_STATIONS[stepId];
    const custom = content.steps[stepId];
    return {
      stationCode: base.stationCode,
      stopName: custom?.stopName || base.stopName,
    };
  };

  const getItemCopy = (
    map: Record<string, { label: string; description: string }>,
    key: string,
    fallbackLabel: string,
    fallbackDesc: string
  ) => ({
    label: map[key]?.label || fallbackLabel,
    description: map[key]?.description ?? fallbackDesc,
  });

  const editableQuestionTitle = (
    qKey: keyof SiteContentConfig['questions'],
    editLabel: string
  ) => (
    <EditableText
      value={content.questions[qKey]}
      editLabel={editLabel}
      onSave={(next) =>
        updateContent((prev) => ({
          ...prev,
          questions: { ...prev.questions, [qKey]: next },
        }))
      }
    />
  );

  const editableQuestionDesc = (
    qKey: keyof SiteContentConfig['questions'],
    editLabel: string
  ) => (
    <EditableText
      value={content.questions[qKey]}
      multiline
      editLabel={editLabel}
      onSave={(next) =>
        updateContent((prev) => ({
          ...prev,
          questions: { ...prev.questions, [qKey]: next },
        }))
      }
    />
  );

  const updateField = <K extends keyof SurveyDraft>(key: K, value: SurveyDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (missingFields.includes(String(key))) {
      setMissingFields((prev) => prev.filter((f) => f !== String(key)));
    }
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const updateCustomAnswer = (questionId: string, answer: string) => {
    setDraft((prev) => ({
      ...prev,
      customAnswers: {
        ...prev.customAnswers,
        [questionId]: answer,
      },
    }));
    const missingKey = `custom:${questionId}`;
    if (missingFields.includes(missingKey)) {
      setMissingFields((prev) => prev.filter((f) => f !== missingKey));
    }
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const handleNext = () => {
    setSubmitError(null);
    playTap();

    if (currentStepId === 'respondent' && draft.hasTasted === 'Belum pernah') {
      if (!draft.activity) {
        setValidationErrors(['Pilih aktivitas Anda saat ini sebelum melanjutkan.']);
        setMissingFields(['activity']);
        return;
      }
      setValidationErrors([]);
      setMissingFields([]);
      setOutcome('never_tasted');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const result = validateStep(currentStepId, draft, content.customQuestions);
    if (!result.valid) {
      setValidationErrors(result.errors);
      setMissingFields(result.missingFields);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setValidationErrors([]);
    setMissingFields([]);

    const nextStep = visibleSteps[currentStepIndex + 1];
    if (nextStep) {
      setStepDirection(1);
      playPageTransition('forward');
      setCurrentStepId(nextStep.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    playTap();
    setValidationErrors([]);
    setMissingFields([]);
    setSubmitError(null);

    if (currentStepIndex === 0) {
      onReturnHome();
      return;
    }

    const prevStep = visibleSteps[currentStepIndex - 1];
    if (prevStep) {
      setStepDirection(-1);
      playPageTransition('back');
      setCurrentStepId(prevStep.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleJumpToStep = (stepId: SurveyStepId) => {
    playTap();
    setValidationErrors([]);
    setMissingFields([]);
    setSubmitError(null);
    const targetIdx = visibleSteps.findIndex((s) => s.id === stepId);
    const dir: 1 | -1 = targetIdx >= 0 && targetIdx < currentStepIndex ? -1 : 1;
    setStepDirection(dir);
    playPageTransition(dir === 1 ? 'forward' : 'back');
    setCurrentStepId(stepId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const id = await submitSurveyResponse(draft, content.customQuestions);
      playSuccess();
      setSubmittedId(id);
      setOutcome('thank_you');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan jawaban. Silakan coba beberapa saat lagi.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCustomQuestionsForCurrentStep = () => {
    if (customQuestionsForStep.length === 0) return null;
    return (
      <div className="mt-2 pt-2 border-t border-dashed border-[#5C3D28]/20">
        {customQuestionsForStep.map((cq) => (
          <RadioOptionGroup
            key={cq.id}
            id={`custom-${cq.id}`}
            label={cq.prompt}
            description={cq.description}
            required={cq.required}
            labelNode={
              <EditableText
                value={cq.prompt}
                editLabel={`Ubah pertanyaan tambahan ${cq.id}`}
                onSave={(next) =>
                  updateContent((prev) => ({
                    ...prev,
                    customQuestions: prev.customQuestions.map((item) =>
                      item.id === cq.id ? { ...item, prompt: next } : item
                    ),
                  }))
                }
              />
            }
            options={cq.options.map((opt) => ({ value: opt, label: opt }))}
            value={draft.customAnswers[cq.id] ?? null}
            onChange={(val) => updateCustomAnswer(cq.id, val)}
            hasError={missingFields.includes(`custom:${cq.id}`)}
          />
        ))}
      </div>
    );
  };

  if (outcome === 'never_tasted') {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="mashro-page-enter bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-8 sm:p-10 text-center shadow-sm">
          <div className="flex justify-end mb-2">
            <SoundToggle compact />
          </div>
          <div className="flex justify-center mb-5">
            <BotanicalSprig className="w-24 h-10 text-[#173E2C]/40" />
          </div>
          <p className="text-xs font-semibold tracking-wider text-[#D6A23A] mb-2">
            <EditableText
              value={content.neverTastedEyebrow}
              editLabel="Ubah sublabel penutup"
              onSave={(next) => updateContent((prev) => ({ ...prev, neverTastedEyebrow: next }))}
            />
          </p>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#173E2C] mb-4 text-balance">
            <EditableText
              value={content.neverTastedTitle}
              editLabel="Ubah judul penutup belum mencicipi"
              onSave={(next) => updateContent((prev) => ({ ...prev, neverTastedTitle: next }))}
            />
          </h1>
          <p className="text-sm sm:text-base text-[#173E2C]/80 leading-relaxed mb-8">
            <EditableText
              value={content.neverTastedBody}
              multiline
              editLabel="Ubah isi penutup belum mencicipi"
              onSave={(next) => updateContent((prev) => ({ ...prev, neverTastedBody: next }))}
            />
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setOutcome('active');
                setCurrentStepId('respondent');
              }}
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-full border border-[#173E2C]/25 text-[#173E2C] text-sm font-semibold hover:bg-[#E5ECD9]/60 transition-colors cursor-pointer whitespace-nowrap"
            >
              Ubah Jawaban Saya
            </button>
            <EditableControlWrap
              value={content.neverTastedHomeButtonLabel}
              editLabel="Ubah teks tombol kembali halaman awal"
              onSave={(next) =>
                updateContent((prev) => ({ ...prev, neverTastedHomeButtonLabel: next }))
              }
            >
              <button
                type="button"
                onClick={onReturnHome}
                className="w-full sm:w-auto min-h-[44px] px-7 py-2.5 rounded-full bg-[#173E2C] text-[#F7F1E3] text-sm font-semibold hover:bg-[#0F2B1E] transition-colors cursor-pointer whitespace-nowrap"
              >
                {content.neverTastedHomeButtonLabel}
              </button>
            </EditableControlWrap>
          </div>
        </div>
      </main>
    );
  }

  if (outcome === 'thank_you') {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-14 relative">
        <ConfettiBurst />
        <div className="mashro-page-enter bg-[#FCF9F2] border border-[#173E2C]/15 rounded-3xl p-6 sm:p-10 text-center shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E5ECD9] border border-[#173E2C]/15 font-mono text-[11px] font-semibold text-[#173E2C]">
              <Ticket className="w-3.5 h-3.5 text-[#D96B27]" aria-hidden="true" />
              <span>ST-AKHIR · TUJUAN TERCAPAI</span>
            </span>
            <SoundToggle compact />
          </div>

          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#E5ECD9] border border-[#173E2C]/15 flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-8 h-8 text-[#D96B27]" aria-hidden="true" />
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-semibold tracking-wider text-[#D6A23A] mb-2.5">
            <StarOrnament className="w-3 h-3" />
            <span>{content.brandName}</span>
            <StarOrnament className="w-3 h-3" />
          </div>

          <p className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#E5ECD9]/75 border border-[#173E2C]/15 text-xs sm:text-sm font-semibold text-[#173E2C] mb-4">
            <CheckCircle2 className="w-4 h-4 text-[#D96B27] shrink-0" aria-hidden="true" />
            <EditableText
              value={content.thankYouArrivalBadge}
              editLabel="Ubah pesan tiba di tujuan akhir"
              onSave={(next) => updateContent((prev) => ({ ...prev, thankYouArrivalBadge: next }))}
            />
          </p>

          <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#173E2C] mb-2.5 text-balance">
            <EditableText
              value={content.thankYouTitle}
              editLabel="Ubah judul terima kasih"
              onSave={(next) => updateContent((prev) => ({ ...prev, thankYouTitle: next }))}
            />
          </h1>

          <p className="text-sm sm:text-base text-[#173E2C]/85 leading-relaxed max-w-lg mx-auto mb-5">
            <EditableText
              value={content.thankYouBody}
              multiline
              editLabel="Ubah pesan terima kasih"
              onSave={(next) => updateContent((prev) => ({ ...prev, thankYouBody: next }))}
            />
          </p>

          {submittedId && (
            <p className="font-mono text-xs text-[#173E2C]/60 mb-5 tabular-nums">
              Kode Referensi Tersimpan: {submittedId}
            </p>
          )}

          <div className="flex justify-center">
            <EditableControlWrap
              value={content.thankYouHomeButtonLabel}
              editLabel="Ubah teks tombol kembali beranda"
              onSave={(next) =>
                updateContent((prev) => ({ ...prev, thankYouHomeButtonLabel: next }))
              }
            >
              <button
                type="button"
                onClick={onReturnHome}
                className="min-h-[46px] px-8 py-3 rounded-full bg-[#173E2C] text-[#F7F1E3] text-sm font-semibold hover:bg-[#0F2B1E] transition-colors cursor-pointer whitespace-nowrap shadow-sm"
              >
                {content.thankYouHomeButtonLabel}
              </button>
            </EditableControlWrap>
          </div>
        </div>
      </main>
    );
  }

  const currentStation = getStationCopy(currentStepMeta.id);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-10">
      {/* Boarding Pass Route Progress Strip + Unique Sound Toggle */}
      <div className="mb-6 sm:mb-8 p-4 rounded-2xl bg-[#FCF9F2] border border-[#5C3D28]/18">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-[#5C3D28] mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Ticket className="w-4 h-4 text-[#D96B27] shrink-0" aria-hidden="true" />
            <span className="font-mono font-semibold text-[#173E2C] tabular-nums">
              {currentStation.stationCode}
            </span>
            <span aria-hidden="true" className="text-[#5C3D28]/40">
              ·
            </span>
            <span className="font-semibold text-[#173E2C] truncate">
              Stasiun {currentStation.stopName}
            </span>
            <span className="hidden sm:inline text-[#5C3D28]/65">
              ({currentStepIndex + 1}/{visibleSteps.length})
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <SoundToggle compact />
            <span className="font-mono text-xs font-semibold text-[#173E2C] tabular-nums">
              {progressPercent}%
            </span>
          </div>
        </div>
        <div
          className="w-full h-2.5 rounded-full bg-[#5C3D28]/12 overflow-hidden p-[2px]"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progres pengisian survei MASHRO"
        >
          <div
            className="h-full bg-gradient-to-r from-[#173E2C] via-[#23533C] to-[#D96B27] rounded-full transition-all duration-300 motion-reduce:transition-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[275px_1fr] gap-8 items-start">
        {/* Desktop Boarding Pass Sidebar */}
        <aside className="hidden lg:block sticky top-20 bg-[#FCF9F2] border border-[#5C3D28]/20 rounded-3xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 bg-[#173E2C] text-[#F7F1E3]">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#D6A23A] mb-1">
              <span>
                {content.brandName}{' '}
                <EditableText
                  value={content.boardingPassEyebrow}
                  editLabel="Ubah label Transit Pass"
                  onSave={(next) =>
                    updateContent((prev) => ({ ...prev, boardingPassEyebrow: next }))
                  }
                />
              </span>
              <span>MSH-01</span>
            </div>
            <p className="font-editorial text-xl font-semibold leading-tight">
              <EditableText
                value={content.boardingPassTitle}
                editLabel="Ubah judul Rute Survei"
                onSave={(next) => updateContent((prev) => ({ ...prev, boardingPassTitle: next }))}
              />
            </p>
          </div>

          <div className="ticket-perforation border-b border-dashed border-[#5C3D28]/25 px-5 py-3 bg-[#F7F1E3]/60 flex items-center justify-between text-[11px] font-mono text-[#5C3D28]">
            <EditableText
              value={content.boardingPassOrigin}
              editLabel="Ubah label asal rute"
              onSave={(next) => updateContent((prev) => ({ ...prev, boardingPassOrigin: next }))}
            />
            <span className="text-[#D96B27]">→</span>
            <EditableText
              value={content.boardingPassDestination}
              editLabel="Ubah label tujuan rute"
              onSave={(next) =>
                updateContent((prev) => ({ ...prev, boardingPassDestination: next }))
              }
            />
          </div>

          <div className="p-5">
            <ol className="space-y-1.5">
              {visibleSteps.map((step, idx) => {
                const isCurrent = step.id === currentStepId;
                const isCompleted = idx < currentStepIndex;
                const station = getStationCopy(step.id);
                return (
                  <li key={step.id} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={idx > currentStepIndex}
                      onClick={() => idx <= currentStepIndex && handleJumpToStep(step.id)}
                      className={`flex-1 min-w-0 text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-3 transition-colors ${
                        isCurrent
                          ? 'bg-[#173E2C] text-[#F7F1E3] font-semibold shadow-xs'
                          : isCompleted
                          ? 'text-[#173E2C] hover:bg-[#E5ECD9]/70 cursor-pointer'
                          : 'text-[#5C3D28]/45 cursor-not-allowed'
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 border ${
                          isCurrent
                            ? 'bg-[#D96B27] border-[#FCF9F2]'
                            : isCompleted
                            ? 'bg-[#173E2C] border-[#173E2C]'
                            : 'bg-transparent border-[#5C3D28]/35'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate leading-snug">{station.stopName}</span>
                        <span
                          className={`block font-mono text-[10px] tabular-nums ${
                            isCurrent ? 'text-[#D6A23A]' : 'text-[#5C3D28]/60'
                          }`}
                        >
                          {station.stationCode} · {step.shortTitle}
                        </span>
                      </span>
                    </button>
                    <EditableControlWrap
                      value={station.stopName}
                      editLabel={`Ubah nama stasiun ${station.stationCode}`}
                      onSave={(next) =>
                        updateContent((prev) => ({
                          ...prev,
                          steps: {
                            ...prev.steps,
                            [step.id]: {
                              ...prev.steps[step.id],
                              stopName: next,
                            },
                          },
                        }))
                      }
                    >
                      <span className="sr-only">{station.stopName}</span>
                    </EditableControlWrap>
                  </li>
                );
              })}
            </ol>
            <div className="mt-5 pt-4 border-t border-dashed border-[#5C3D28]/20 text-xs text-[#5C3D28]/75 leading-relaxed">
              <EditableText
                value={content.boardingPassNote}
                multiline
                editLabel="Ubah catatan Boarding Pass"
                onSave={(next) => updateContent((prev) => ({ ...prev, boardingPassNote: next }))}
              />
            </div>
          </div>
        </aside>

        {/* Active Step Card */}
        <section className="bg-[#FCF9F2] border border-[#5C3D28]/18 rounded-3xl p-5 sm:p-8 shadow-sm overflow-x-clip">
          <div
            key={currentStepId}
            className={stepDirection === 1 ? 'mashro-step-forward' : 'mashro-step-back'}
          >
            <div className="pb-5 border-b border-dashed border-[#5C3D28]/20 mb-4">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-semibold text-[#D96B27] mb-1.5 tabular-nums">
              <span>{currentStation.stationCode}</span>
              <span aria-hidden="true" className="text-[#5C3D28]/35">
                ·
              </span>
              <span className="text-[#5C3D28]">
                PEMBERHENTIAN: {currentStation.stopName.toUpperCase()}
              </span>
            </div>
            <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#173E2C] mb-1.5">
              <EditableText
                value={currentStepMeta.title}
                editLabel={`Ubah judul langkah ${currentStepMeta.id}`}
                onSave={(next) =>
                  updateContent((prev) => ({
                    ...prev,
                    steps: {
                      ...prev.steps,
                      [currentStepMeta.id]: {
                        ...prev.steps[currentStepMeta.id],
                        title: next,
                      },
                    },
                  }))
                }
              />
            </h1>
            <p className="text-sm text-[#5C3D28]/85 leading-relaxed">
              <EditableText
                value={currentStepMeta.subtitle}
                multiline
                editLabel={`Ubah subjudul langkah ${currentStepMeta.id}`}
                onSave={(next) =>
                  updateContent((prev) => ({
                    ...prev,
                    steps: {
                      ...prev.steps,
                      [currentStepMeta.id]: {
                        ...prev.steps[currentStepMeta.id],
                        subtitle: next,
                      },
                    },
                  }))
                }
              />
            </p>
          </div>

          {/* Validation Error Summary */}
          {validationErrors.length > 0 && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-2xl bg-red-950/[0.06] border border-red-800/25 text-red-950 text-sm"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-800" aria-hidden="true" />
                <div>
                  <p className="font-semibold mb-1">
                    Mohon lengkapi pertanyaan wajib berikut sebelum melanjutkan:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-xs sm:text-sm">
                    {validationErrors.slice(0, 4).map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                    {validationErrors.length > 4 && (
                      <li>Dan {validationErrors.length - 4} pertanyaan wajib lainnya.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Tentang Responden */}
          {currentStepId === 'respondent' && (
            <div>
              <RadioOptionGroup
                id="hasTasted"
                label={content.questions.hasTastedLabel}
                description={content.questions.hasTastedDescription}
                labelNode={editableQuestionTitle('hasTastedLabel', 'Ubah pertanyaan mencicipi')}
                descriptionNode={editableQuestionDesc('hasTastedDescription', 'Ubah keterangan mencicipi')}
                options={[
                  {
                    value: 'Sudah pernah',
                    label: 'Sudah pernah',
                    detail: 'Saya sudah pernah mencicipi sajian MASHRO',
                  },
                  {
                    value: 'Belum pernah',
                    label: 'Belum pernah',
                    detail: 'Saya belum pernah mencoba sajian MASHRO',
                  },
                ]}
                value={draft.hasTasted}
                onChange={(val) => updateField('hasTasted', val)}
                hasError={missingFields.includes('hasTasted')}
              />

              <RadioOptionGroup
                id="activity"
                label={content.questions.activityLabel}
                labelNode={editableQuestionTitle('activityLabel', 'Ubah pertanyaan aktivitas')}
                columns={2}
                options={ACTIVITY_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                value={draft.activity}
                onChange={(val) => updateField('activity', val)}
                hasError={missingFields.includes('activity')}
              />

              {draft.activity === 'Lainnya' && (
                <div className="py-4 border-b border-[#173E2C]/10">
                  <label
                    htmlFor="activityOther"
                    className="block text-sm font-medium text-[#173E2C] mb-2"
                  >
                    Sebutkan aktivitas Anda (opsional)
                  </label>
                  <input
                    id="activityOther"
                    type="text"
                    maxLength={100}
                    value={draft.activityOther}
                    onChange={(e) => updateField('activityOther', e.target.value)}
                    placeholder="Contoh: Wiraswasta / Freelancer"
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[#173E2C]/20 text-sm text-[#173E2C] focus:outline-none focus:border-[#173E2C]"
                  />
                </div>
              )}

              {draft.hasTasted === 'Sudah pernah' && (
                <RadioOptionGroup
                  id="hasOrdered"
                  label={content.questions.hasOrderedLabel}
                  description={content.questions.hasOrderedDescription}
                  labelNode={editableQuestionTitle('hasOrderedLabel', 'Ubah pertanyaan pre-order')}
                  descriptionNode={editableQuestionDesc('hasOrderedDescription', 'Ubah keterangan pre-order')}
                  options={[
                    {
                      value: 'Ya, pernah memesan',
                      label: 'Ya, pernah memesan',
                      detail: 'Saya memesan langsung melalui sistem Pre-Order MASHRO',
                    },
                    {
                      value: 'Tidak, hanya mencicipi',
                      label: 'Tidak, hanya mencicipi',
                      detail: 'Saya mencicipi sampel / dibelikan orang lain tanpa memesan sendiri',
                    },
                  ]}
                  value={draft.hasOrdered}
                  onChange={(val) => updateField('hasOrdered', val)}
                  hasError={missingFields.includes('hasOrdered')}
                />
              )}

              {renderCustomQuestionsForCurrentStep()}
            </div>
          )}

          {/* STEP 2: Pengalaman Produk */}
          {currentStepId === 'product' && (
            <div>
              <div className="mb-4 p-4 rounded-2xl bg-[#E5ECD9]/55 border border-[#173E2C]/10 text-xs sm:text-sm text-[#173E2C]/85">
                <EditableText
                  value={content.questions.productBannerNote}
                  multiline
                  editLabel="Ubah keterangan skala penilaian produk"
                  onSave={(next) =>
                    updateContent((prev) => ({
                      ...prev,
                      questions: { ...prev.questions, productBannerNote: next },
                    }))
                  }
                />
              </div>
              {PRODUCT_EXPERIENCE_ITEMS.map((item) => {
                const itemCopy = getItemCopy(
                  content.productItems,
                  item.key,
                  item.label,
                  item.description
                );
                return (
                  <VolumeMeter
                    key={item.key}
                    id={item.key}
                    label={itemCopy.label}
                    description={itemCopy.description}
                    labelNode={
                      <EditableText
                        value={itemCopy.label}
                        editLabel={`Ubah pertanyaan ${item.key}`}
                        onSave={(next) =>
                          updateContent((prev) => ({
                            ...prev,
                            productItems: {
                              ...prev.productItems,
                              [item.key]: { ...itemCopy, key: item.key, label: next },
                            },
                          }))
                        }
                      />
                    }
                    descriptionNode={
                      <EditableText
                        value={itemCopy.description}
                        multiline
                        editLabel={`Ubah keterangan ${item.key}`}
                        onSave={(next) =>
                          updateContent((prev) => ({
                            ...prev,
                            productItems: {
                              ...prev.productItems,
                              [item.key]: { ...itemCopy, key: item.key, description: next },
                            },
                          }))
                        }
                      />
                    }
                    value={draft[item.key]}
                    onChange={(val) => updateField(item.key, val)}
                    hasError={missingFields.includes(item.key)}
                  />
                );
              })}

              {renderCustomQuestionsForCurrentStep()}
            </div>
          )}

          {/* STEP 3: Jam Dinding Pengambilan & Kondisi Sajian */}
          {currentStepId === 'condition' && (
            <div>
              <WallClockPicker
                id="pickupTime"
                label={content.questions.pickupTimeLabel}
                description={content.questions.pickupTimeDescription}
                labelNode={editableQuestionTitle('pickupTimeLabel', 'Ubah pertanyaan jam pengambilan')}
                descriptionNode={editableQuestionDesc('pickupTimeDescription', 'Ubah keterangan jam dinding')}
                value={draft.pickupTime}
                onChange={(val) => updateField('pickupTime', val)}
                hasError={missingFields.includes('pickupTime')}
              />

              <RadioOptionGroup
                id="foodConditionOverall"
                label={content.questions.foodConditionOverallLabel}
                labelNode={editableQuestionTitle('foodConditionOverallLabel', 'Ubah pertanyaan kondisi umum makanan')}
                options={FOOD_CONDITION_OVERALL_OPTIONS}
                value={draft.foodConditionOverall}
                onChange={(val) => updateField('foodConditionOverall', val)}
                hasError={missingFields.includes('foodConditionOverall')}
              />

              <RadioOptionGroup
                id="conditionCassava"
                label={content.questions.conditionCassavaLabel}
                labelNode={editableQuestionTitle('conditionCassavaLabel', 'Ubah pertanyaan kondisi singkong')}
                options={CONDITION_CASSAVA_OPTIONS}
                value={draft.conditionCassava}
                onChange={(val) => updateField('conditionCassava', val)}
                hasError={missingFields.includes('conditionCassava')}
              />

              <RadioOptionGroup
                id="conditionChicken"
                label={content.questions.conditionChickenLabel}
                labelNode={editableQuestionTitle('conditionChickenLabel', 'Ubah pertanyaan kondisi ayam')}
                options={CONDITION_CHICKEN_OPTIONS}
                value={draft.conditionChicken}
                onChange={(val) => updateField('conditionChicken', val)}
                hasError={missingFields.includes('conditionChicken')}
              />

              <RadioOptionGroup
                id="conditionVegetables"
                label={content.questions.conditionVegetablesLabel}
                labelNode={editableQuestionTitle('conditionVegetablesLabel', 'Ubah pertanyaan kondisi sayuran')}
                options={CONDITION_VEGETABLES_OPTIONS}
                value={draft.conditionVegetables}
                onChange={(val) => updateField('conditionVegetables', val)}
                hasError={missingFields.includes('conditionVegetables')}
              />

              <RadioOptionGroup
                id="conditionSauce"
                label={content.questions.conditionSauceLabel}
                labelNode={editableQuestionTitle('conditionSauceLabel', 'Ubah pertanyaan kondisi saus')}
                options={CONDITION_SAUCE_OPTIONS}
                value={draft.conditionSauce}
                onChange={(val) => updateField('conditionSauce', val)}
                hasError={missingFields.includes('conditionSauce')}
              />

              {renderCustomQuestionsForCurrentStep()}
            </div>
          )}

          {/* STEP 4: Evaluasi Produk dan Kemasan */}
          {currentStepId === 'packaging' && (
            <div>
              {PACKAGING_RATING_ITEMS.filter((i) => i.group === 'product').map((item) => {
                const itemCopy = getItemCopy(
                  content.packagingItems,
                  item.key,
                  item.label,
                  item.description
                );
                return (
                  <VolumeMeter
                    key={item.key}
                    id={item.key}
                    label={itemCopy.label}
                    description={itemCopy.description}
                    labelNode={
                      <EditableText
                        value={itemCopy.label}
                        editLabel={`Ubah pertanyaan ${item.key}`}
                        onSave={(next) =>
                          updateContent((prev) => ({
                            ...prev,
                            packagingItems: {
                              ...prev.packagingItems,
                              [item.key]: { ...itemCopy, key: item.key, label: next },
                            },
                          }))
                        }
                      />
                    }
                    descriptionNode={
                      <EditableText
                        value={itemCopy.description}
                        multiline
                        editLabel={`Ubah keterangan ${item.key}`}
                        onSave={(next) =>
                          updateContent((prev) => ({
                            ...prev,
                            packagingItems: {
                              ...prev.packagingItems,
                              [item.key]: { ...itemCopy, key: item.key, description: next },
                            },
                          }))
                        }
                      />
                    }
                    value={draft[item.key]}
                    onChange={(val) => updateField(item.key, val)}
                    hasError={missingFields.includes(item.key)}
                  />
                );
              })}

              <RadioOptionGroup
                id="satietyLevel"
                label={content.questions.satietyLabel}
                labelNode={editableQuestionTitle('satietyLabel', 'Ubah pertanyaan rasa kenyang')}
                options={SATIETY_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                value={draft.satietyLevel}
                onChange={(val) => updateField('satietyLevel', val)}
                hasError={missingFields.includes('satietyLevel')}
              />

              {PACKAGING_RATING_ITEMS.filter((i) => i.group === 'packaging').map((item) => {
                const itemCopy = getItemCopy(
                  content.packagingItems,
                  item.key,
                  item.label,
                  item.description
                );
                return (
                  <VolumeMeter
                    key={item.key}
                    id={item.key}
                    label={itemCopy.label}
                    description={itemCopy.description}
                    labelNode={
                      <EditableText
                        value={itemCopy.label}
                        editLabel={`Ubah pertanyaan ${item.key}`}
                        onSave={(next) =>
                          updateContent((prev) => ({
                            ...prev,
                            packagingItems: {
                              ...prev.packagingItems,
                              [item.key]: { ...itemCopy, key: item.key, label: next },
                            },
                          }))
                        }
                      />
                    }
                    descriptionNode={
                      <EditableText
                        value={itemCopy.description}
                        multiline
                        editLabel={`Ubah keterangan ${item.key}`}
                        onSave={(next) =>
                          updateContent((prev) => ({
                            ...prev,
                            packagingItems: {
                              ...prev.packagingItems,
                              [item.key]: { ...itemCopy, key: item.key, description: next },
                            },
                          }))
                        }
                      />
                    }
                    value={draft[item.key]}
                    onChange={(val) => updateField(item.key, val)}
                    hasError={missingFields.includes(item.key)}
                  />
                );
              })}

              {renderCustomQuestionsForCurrentStep()}
            </div>
          )}

          {/* STEP 5: Harga dan Minat Pembelian */}
          {currentStepId === 'pricing' && (
            <div>
              <div className="mb-4 p-5 rounded-2xl bg-[#E5ECD9]/60 border border-[#173E2C]/12">
                <p className="text-xs font-semibold tracking-wider text-[#173E2C]/70 mb-1">
                  {editableQuestionTitle('priceBannerTitle', 'Ubah judul info harga')}
                </p>
                <p className="font-editorial text-2xl font-semibold text-[#173E2C] mb-1.5">
                  {editableQuestionTitle('priceBannerAmount', 'Ubah rentang harga usulan')}
                </p>
                <p className="text-sm text-[#173E2C]/80 leading-relaxed">
                  {editableQuestionDesc('priceBannerNote', 'Ubah catatan kisaran harga')}
                </p>
              </div>

              <RadioOptionGroup
                id="priceReasonable"
                label={content.questions.priceReasonableLabel}
                labelNode={editableQuestionTitle('priceReasonableLabel', 'Ubah pertanyaan kewajaran harga')}
                columns={2}
                options={PRICE_REASONABLE_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                value={draft.priceReasonable}
                onChange={(val) => updateField('priceReasonable', val)}
                hasError={missingFields.includes('priceReasonable')}
              />

              <RadioOptionGroup
                id="priceWorthIt"
                variant="destination"
                label={content.questions.priceWorthItLabel}
                labelNode={editableQuestionTitle('priceWorthItLabel', 'Ubah pertanyaan kesepadanan harga Rp. 20.000')}
                options={PRICE_WORTH_IT_OPTIONS}
                value={draft.priceWorthIt}
                onChange={(val) => updateField('priceWorthIt', val)}
                hasError={missingFields.includes('priceWorthIt')}
              />

              <Scale1to5
                id="purchaseLikelihood"
                variant="destination"
                label={content.questions.purchaseLikelihoodLabel}
                labelNode={editableQuestionTitle('purchaseLikelihoodLabel', 'Ubah pertanyaan kemungkinan membeli')}
                lowLabel="1 · Sangat Tidak Mungkin"
                highLabel="5 · Sangat Mungkin"
                value={draft.purchaseLikelihood}
                onChange={(val) => updateField('purchaseLikelihood', val)}
                hasError={missingFields.includes('purchaseLikelihood')}
              />

              <RadioOptionGroup
                id="purchaseFrequency"
                variant="destination"
                label={content.questions.purchaseFrequencyLabel}
                labelNode={editableQuestionTitle('purchaseFrequencyLabel', 'Ubah pertanyaan frekuensi pembelian')}
                options={PURCHASE_FREQUENCY_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                value={draft.purchaseFrequency}
                onChange={(val) => updateField('purchaseFrequency', val)}
                hasError={missingFields.includes('purchaseFrequency')}
              />

              <RadioOptionGroup
                id="repurchaseIntention"
                variant="destination"
                label={content.questions.repurchaseIntentionLabel}
                labelNode={editableQuestionTitle('repurchaseIntentionLabel', 'Ubah pertanyaan beli ulang')}
                options={REPURCHASE_INTENTION_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                value={draft.repurchaseIntention}
                onChange={(val) => updateField('repurchaseIntention', val)}
                hasError={missingFields.includes('repurchaseIntention')}
              />

              {renderCustomQuestionsForCurrentStep()}
            </div>
          )}

          {/* STEP 6: Evaluasi Layanan Pre-Order */}
          {currentStepId === 'preorder' && (
            <div>
              {PREORDER_ITEMS.map((item) => {
                const itemCopy = getItemCopy(
                  content.preorderItems,
                  item.key,
                  item.label,
                  item.description
                );
                return (
                  <VolumeMeter
                    key={item.key}
                    id={item.key}
                    label={itemCopy.label}
                    description={itemCopy.description}
                    labelNode={
                      <EditableText
                        value={itemCopy.label}
                        editLabel={`Ubah pertanyaan ${item.key}`}
                        onSave={(next) =>
                          updateContent((prev) => ({
                            ...prev,
                            preorderItems: {
                              ...prev.preorderItems,
                              [item.key]: { ...itemCopy, key: item.key, label: next },
                            },
                          }))
                        }
                      />
                    }
                    descriptionNode={
                      <EditableText
                        value={itemCopy.description}
                        multiline
                        editLabel={`Ubah keterangan ${item.key}`}
                        onSave={(next) =>
                          updateContent((prev) => ({
                            ...prev,
                            preorderItems: {
                              ...prev.preorderItems,
                              [item.key]: { ...itemCopy, key: item.key, description: next },
                            },
                          }))
                        }
                      />
                    }
                    value={draft[item.key]}
                    onChange={(val) => updateField(item.key, val)}
                    hasError={missingFields.includes(item.key)}
                  />
                );
              })}
            </div>
          )}

          {/* STEP 7: Kepuasan Keseluruhan */}
          {currentStepId === 'overall' && (
            <div>
              <ExpressionIndicator
                id="expressionMood"
                label={content.questions.expressionLabel}
                description={content.questions.expressionDescription}
                labelNode={editableQuestionTitle('expressionLabel', 'Ubah pertanyaan ragam ekspresi')}
                descriptionNode={editableQuestionDesc('expressionDescription', 'Ubah keterangan ragam ekspresi')}
                value={draft.expressionMood}
                onChange={(val) => updateField('expressionMood', val)}
                hasError={missingFields.includes('expressionMood')}
              />

              <ConstellationIndicator
                id="overallSatisfaction"
                min={1}
                max={5}
                label={content.questions.overallSatisfactionLabel}
                labelNode={editableQuestionTitle('overallSatisfactionLabel', 'Ubah pertanyaan kepuasan total')}
                value={draft.overallSatisfaction}
                onChange={(val) => updateField('overallSatisfaction', val)}
                hasError={missingFields.includes('overallSatisfaction')}
              />

              <ConstellationIndicator
                id="recommendScore"
                min={0}
                max={10}
                label={content.questions.recommendScoreLabel}
                description={content.questions.recommendScoreDescription}
                labelNode={editableQuestionTitle('recommendScoreLabel', 'Ubah pertanyaan rekomendasi')}
                descriptionNode={editableQuestionDesc('recommendScoreDescription', 'Ubah keterangan rekomendasi')}
                value={draft.recommendScore}
                onChange={(val) => updateField('recommendScore', val)}
                hasError={missingFields.includes('recommendScore')}
              />

              <CheckboxOptionGroup
                id="favoriteComponents"
                label={content.questions.favoriteComponentsLabel}
                description={content.questions.favoriteComponentsDescription}
                labelNode={editableQuestionTitle('favoriteComponentsLabel', 'Ubah pertanyaan komponen favorit')}
                descriptionNode={editableQuestionDesc('favoriteComponentsDescription', 'Ubah keterangan komponen favorit')}
                options={FAVORITE_COMPONENT_OPTIONS}
                values={draft.favoriteComponents}
                onChange={(vals) => updateField('favoriteComponents', vals)}
                hasError={missingFields.includes('favoriteComponents')}
              />

              {renderCustomQuestionsForCurrentStep()}

              <div className="py-5">
                <label
                  htmlFor="feedbackNotes"
                  className="block text-base font-semibold text-[#173E2C] mb-1.5"
                >
                  {editableQuestionTitle('feedbackNotesLabel', 'Ubah pertanyaan saran & masukan')}
                </label>
                <p className="text-sm text-[#173E2C]/70 mb-3">
                  {editableQuestionDesc('feedbackNotesDescription', 'Ubah keterangan saran & masukan')}
                </p>
                <textarea
                  id="feedbackNotes"
                  rows={4}
                  maxLength={1000}
                  value={draft.feedbackNotes}
                  onChange={(e) => updateField('feedbackNotes', e.target.value)}
                  placeholder="Tuliskan saran atau masukan Anda di sini..."
                  className="w-full p-4 rounded-2xl bg-white border border-[#173E2C]/20 text-sm text-[#173E2C] leading-relaxed focus:outline-none focus:border-[#173E2C]"
                />
                <div className="text-right text-xs font-mono text-[#173E2C]/55 mt-1 tabular-nums">
                  {draft.feedbackNotes.length} / 1000
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: Tinjauan & Kirim */}
          {currentStepId === 'review' && (
            <div className="space-y-6">
              {submitError && (
                <div
                  role="alert"
                  className="p-4 rounded-2xl bg-red-950/[0.06] border border-red-800/25 text-red-950 text-sm flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-800" aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="divide-y divide-[#173E2C]/10 border border-[#173E2C]/12 rounded-2xl bg-white">
                {/* Summary: Profil */}
                <div className="p-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#D6A23A] mb-1">
                      TENTANG RESPONDEN
                    </p>
                    <p className="text-sm text-[#173E2C]">
                      <strong>Pengalaman:</strong> {draft.hasTasted} ·{' '}
                      <strong>Aktivitas:</strong> {draft.activity}
                      {draft.activity === 'Lainnya' && draft.activityOther
                        ? ` (${draft.activityOther})`
                        : ''}{' '}
                      · <strong>Pre-Order:</strong> {draft.hasOrdered}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep('respondent')}
                    className="text-xs font-semibold text-[#173E2C] hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Ubah</span>
                  </button>
                </div>

                {/* Summary: Produk */}
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[#D6A23A] mb-2">
                      PENGALAMAN PRODUK (SKALA 1–5)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[#173E2C]/85">
                      {PRODUCT_EXPERIENCE_ITEMS.map((item) => (
                        <div key={item.key} className="bg-[#F7F1E3]/70 rounded-lg px-2.5 py-2">
                          <span className="block text-[#173E2C]/70 leading-snug mb-0.5">
                            {item.label.replace(/^Rasa /, '').replace(' (Buncis & Wortel Kukus)', '')}
                          </span>
                          <span className="font-mono font-semibold text-sm tabular-nums">
                            {draft[item.key]}/5
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep('product')}
                    className="text-xs font-semibold text-[#173E2C] hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Ubah</span>
                  </button>
                </div>

                {/* Summary: Jam & Kondisi Sajian */}
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[#D6A23A] mb-1.5">
                      JAM KONSUMSI & KONDISI SAJIAN
                    </p>
                    <p className="text-sm text-[#173E2C] leading-relaxed">
                      <strong>Jam Pengambilan/Makan:</strong> {draft.pickupTime} WIB ·{' '}
                      <strong>Kondisi Umum:</strong> {draft.foodConditionOverall}
                    </p>
                    <p className="text-xs text-[#173E2C]/80 mt-1">
                      Singkong: {draft.conditionCassava} · Ayam: {draft.conditionChicken} ·
                      Sayur: {draft.conditionVegetables} · Saus: {draft.conditionSauce}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep('condition')}
                    className="text-xs font-semibold text-[#173E2C] hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Ubah</span>
                  </button>
                </div>

                {/* Summary: Kemasan */}
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[#D6A23A] mb-1.5">
                      PORSI & KEMASAN
                    </p>
                    <p className="text-sm text-[#173E2C] mb-1">
                      <strong>Rasa kenyang:</strong> {draft.satietyLevel}
                    </p>
                    <p className="text-xs text-[#173E2C]/75 font-mono tabular-nums">
                      Porsi {draft.ratingPortion}/5 · Komposisi {draft.ratingIngredientCombo}/5 ·
                      Praktis {draft.ratingPackPracticality}/5 · Kuat {draft.ratingPackStrength}/5
                      · Anti-bocor {draft.ratingLeakResistance}/5
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep('packaging')}
                    className="text-xs font-semibold text-[#173E2C] hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Ubah</span>
                  </button>
                </div>

                {/* Summary: Harga */}
                <div className="p-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#D6A23A] mb-1">
                      HARGA & MINAT PEMBELIAN
                    </p>
                    <p className="text-sm text-[#173E2C] leading-relaxed">
                      <strong>Kewajaran Rp. 20.000:</strong> {draft.priceReasonable} ·{' '}
                      <strong>Penilaian Harga:</strong> {draft.priceWorthIt} ·{' '}
                      <strong>Minat beli:</strong> {draft.purchaseLikelihood}/5 ·{' '}
                      <strong>Frekuensi:</strong> {draft.purchaseFrequency} ·{' '}
                      <strong>Beli lagi:</strong> {draft.repurchaseIntention}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep('pricing')}
                    className="text-xs font-semibold text-[#173E2C] hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Ubah</span>
                  </button>
                </div>

                {/* Summary: Pre-Order (Conditional) */}
                {draft.hasOrdered === 'Ya, pernah memesan' && (
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-[#D6A23A] mb-1">
                        LAYANAN PRE-ORDER
                      </p>
                      <p className="text-xs text-[#173E2C]/85 font-mono tabular-nums">
                        Kemudahan {draft.preOrderEase}/5 · Respons {draft.preOrderResponsiveness}/5 ·
                        Ketepatan Pesanan {draft.preOrderAccuracy}/5 · Ketepatan Waktu{' '}
                        {draft.preOrderPunctuality}/5
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleJumpToStep('preorder')}
                      className="text-xs font-semibold text-[#173E2C] hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Ubah</span>
                    </button>
                  </div>
                )}

                {/* Summary: Kepuasan Keseluruhan */}
                <div className="p-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#D6A23A] mb-1">
                      KEPUASAN KESELURUHAN
                    </p>
                    <p className="text-sm text-[#173E2C]">
                      <strong>Ragam Ekspresi:</strong> {draft.expressionMood} ·{' '}
                      <strong>Kepuasan:</strong> {draft.overallSatisfaction}/5 ·{' '}
                      <strong>Rekomendasi:</strong> {draft.recommendScore}/10 ·{' '}
                      <strong>Favorit:</strong> {draft.favoriteComponents.join(', ')}
                    </p>
                    {draft.feedbackNotes.trim() && (
                      <p className="text-sm text-[#173E2C]/80 italic mt-1.5">
                        “{draft.feedbackNotes.trim()}”
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep('overall')}
                    className="text-xs font-semibold text-[#173E2C] hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Ubah</span>
                  </button>
                </div>

                {/* Summary: Pertanyaan Pilihan Ganda Tambahan */}
                {content.customQuestions.length > 0 && (
                  <div className="p-5">
                    <p className="text-xs font-semibold text-[#D6A23A] mb-2">
                      PERTANYAAN PILIHAN GANDA TAMBAHAN
                    </p>
                    <div className="space-y-1.5 text-sm text-[#173E2C]">
                      {content.customQuestions.map((cq) => (
                        <p key={cq.id}>
                          <strong>{cq.prompt}:</strong>{' '}
                          {draft.customAnswers[cq.id] || 'Tidak diisi'}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Privacy Notice */}
              <div className="p-4 rounded-2xl bg-[#E5ECD9]/60 border border-[#173E2C]/12 flex items-start gap-3 text-xs sm:text-sm text-[#173E2C]/85">
                <ShieldCheck className="w-5 h-5 text-[#173E2C] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="leading-relaxed space-y-0.5">
                  <p className="font-semibold text-[#173E2C]">
                    <EditableText
                      value={content.reviewPrivacyTitle}
                      editLabel="Ubah judul pemberitahuan privasi tinjauan"
                      onSave={(next) =>
                        updateContent((prev) => ({ ...prev, reviewPrivacyTitle: next }))
                      }
                    />
                  </p>
                  <p>
                    <EditableText
                      value={content.reviewPrivacyBody}
                      multiline
                      editLabel="Ubah isi pemberitahuan privasi tinjauan"
                      onSave={(next) =>
                        updateContent((prev) => ({ ...prev, reviewPrivacyBody: next }))
                      }
                    />
                  </p>
                </div>
              </div>
            </div>
          )}
          </div>

          {/* Footer Navigation Controls */}
          <div className="mt-8 pt-6 border-t border-dashed border-[#5C3D28]/20 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <EditableControlWrap
              value={content.prevButtonLabel}
              editLabel="Ubah teks tombol Sebelumnya"
              onSave={(next) => updateContent((prev) => ({ ...prev, prevButtonLabel: next }))}
            >
              <button
                type="button"
                onClick={handlePrevious}
                disabled={isSubmitting}
                className="min-h-[46px] px-4 sm:px-5 py-2.5 rounded-2xl border border-[#5C3D28]/25 bg-white text-[#173E2C] text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 hover:bg-[#E5ECD9]/60 transition-colors cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4 text-[#5C3D28] shrink-0" aria-hidden="true" />
                <span>{content.prevButtonLabel}</span>
              </button>
            </EditableControlWrap>

            {currentStepId === 'review' ? (
              <EditableControlWrap
                value={content.submitButtonLabel}
                editLabel="Ubah teks tombol Kirim Survei"
                onSave={(next) => updateContent((prev) => ({ ...prev, submitButtonLabel: next }))}
              >
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="min-h-[46px] px-5 sm:px-8 py-2.5 rounded-2xl bg-[#173E2C] text-[#F7F1E3] text-sm font-semibold inline-flex items-center gap-2 sm:gap-2.5 whitespace-nowrap shrink-0 hover:bg-[#0F2B1E] transition-colors shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#D6A23A] shrink-0" aria-hidden="true" />
                      <span>Mengirim Jawaban...</span>
                    </>
                  ) : (
                    <>
                      <span>{content.submitButtonLabel}</span>
                      <CheckCircle2 className="w-4 h-4 text-[#D6A23A] shrink-0" aria-hidden="true" />
                    </>
                  )}
                </button>
              </EditableControlWrap>
            ) : (
              <EditableControlWrap
                value={content.nextButtonLabel}
                editLabel="Ubah teks tombol Selanjutnya"
                onSave={(next) => updateContent((prev) => ({ ...prev, nextButtonLabel: next }))}
              >
                <button
                  type="button"
                  onClick={handleNext}
                  className="min-h-[46px] px-5 sm:px-7 py-2.5 rounded-2xl bg-[#173E2C] text-[#F7F1E3] text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 hover:bg-[#0F2B1E] transition-colors cursor-pointer"
                >
                  <span>{content.nextButtonLabel}</span>
                  <ArrowRight className="w-4 h-4 text-[#D96B27] shrink-0" aria-hidden="true" />
                </button>
              </EditableControlWrap>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
