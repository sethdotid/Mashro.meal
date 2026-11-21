import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Check,
  Clock,
  Copy,
  Crop,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Image as ImageIcon,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useSiteContent } from '../context/SiteContentContext';
import {
  OwnerGoogleFormConfig,
  deleteSurveyResponse,
  fetchSurveyResponses,
  loadOwnerGoogleFormConfig,
  saveOwnerGoogleFormConfig,
} from '../services/surveyService';
import {
  CustomMcqQuestion,
  CustomQuestionPlacement,
  DEFAULT_SITE_CONTENT,
  SiteContentConfig,
  mergeSiteContent,
} from '../types/siteConfig';
import { StoredSurveyResponse } from '../types/survey';
import { buildExcelWorkbookBytes } from '../utils/excelExport';
import { buildCsvContent, computeDashboardStats } from '../utils/surveyLogic';
import { playSuccess, playTap } from '../utils/soundEngine';
import { ImageWithFallback, StarOrnament } from './BrandMotifs';
import { DashboardSummaryCharts } from './DashboardSummaryCharts';
import { ImageCropperModal } from './ImageCropperModal';
import { SoundToggle } from './SoundToggle';

type AttributeFilter = 'Semua' | 'Produk' | 'Kemasan & Porsi' | 'Layanan Pre-Order';
type DashboardTab = 'responses' | 'editor' | 'google_form';

interface OwnerDashboardProps {
  onNavigateHome?: () => void;
}

export function OwnerDashboard({ onNavigateHome }: OwnerDashboardProps) {
  const {
    content,
    adminToken,
    authChecked,
    inlineEditMode,
    savingContent,
    setInlineEditMode,
    loginWithPin,
    logoutAdmin,
    updateContent,
    resetContentToDefault,
  } = useSiteContent();

  // PIN Login form state
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Dashboard active tab & survey responses state
  const [activeTab, setActiveTab] = useState<DashboardTab>('responses');
  const [responses, setResponses] = useState<StoredSurveyResponse[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [attrFilter, setAttrFilter] = useState<AttributeFilter>('Semua');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Content & Image Editor draft state
  const [editorDraft, setEditorDraft] = useState<SiteContentConfig>(content);
  const [editorSuccess, setEditorSuccess] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'hero' | 'composition' | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Google Form share link config state
  const [formTitleInput, setFormTitleInput] = useState(
    'MASHRO – Survei Pengalaman dan Kepuasan Pelanggan'
  );
  const [formResponderUriInput, setFormResponderUriInput] = useState('');
  const [formIdInput, setFormIdInput] = useState('');
  const [savedFormConfig, setSavedFormConfig] = useState<OwnerGoogleFormConfig | null>(null);
  const [formsSaving, setFormsSaving] = useState(false);
  const [formsError, setFormsError] = useState<string | null>(null);
  const [formsSuccess, setFormsSuccess] = useState<string | null>(null);
  const [copiedFormLink, setCopiedFormLink] = useState(false);

  useEffect(() => {
    setEditorDraft(content);
  }, [content]);

  const loadDashboardData = useCallback(async () => {
    if (!adminToken) return;
    setLoadingData(true);
    setDataError(null);
    try {
      const [rows, gform] = await Promise.all([
        fetchSurveyResponses(adminToken),
        loadOwnerGoogleFormConfig(adminToken),
      ]);
      setResponses(rows);
      if (gform) {
        setSavedFormConfig(gform);
        setFormTitleInput(gform.formTitle || 'MASHRO – Survei Pengalaman dan Kepuasan Pelanggan');
        setFormResponderUriInput(gform.responderUri || '');
        setFormIdInput(gform.formId || '');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data respons dari Firebase Firestore.';
      setDataError(msg);
      if (msg.includes('Sesi admin tidak valid')) {
        logoutAdmin();
      }
    } finally {
      setLoadingData(false);
    }
  }, [adminToken, logoutAdmin]);

  useEffect(() => {
    if (adminToken) {
      void loadDashboardData();
    } else {
      setResponses([]);
    }
  }, [adminToken, loadDashboardData]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const trimmed = pinInput.trim();
    if (!trimmed) {
      setAuthError('Masukkan Password / PIN Admin terlebih dahulu.');
      return;
    }
    setIsLoggingIn(true);
    try {
      await loginWithPin(trimmed);
      setPinInput('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'PIN Admin tidak sesuai.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    logoutAdmin();
    setResponses([]);
    setDataError(null);
    setPinInput('');
  };

  const stats = useMemo(() => computeDashboardStats(responses), [responses]);

  const filteredAttributes = useMemo(() => {
    if (attrFilter === 'Semua') return stats.attributeAverages;
    return stats.attributeAverages.filter((a) => a.category === attrFilter);
  }, [stats.attributeAverages, attrFilter]);

  const handleExportCsv = () => {
    if (responses.length === 0) return;
    playTap();
    const csv = buildCsvContent(responses, content.customQuestions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mashro-survei-respons-${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    if (responses.length === 0) return;
    playTap();
    const workbookBytes = buildExcelWorkbookBytes(responses, stats, content.customQuestions);
    const blob = new Blob([new Uint8Array(workbookBytes)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mashro-survei-respons-${dateStr}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const executeDeleteResponse = async () => {
    if (!confirmDeleteId || !adminToken) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await deleteSurveyResponse(id, adminToken);
      setResponses((prev) => prev.filter((r) => r.id !== id));
      playTap();
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Gagal menghapus respons.');
    }
  };

  const handleSaveEditorDraft = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEditorError(null);
    setEditorSuccess(null);

    const validatedCustomQuestions: CustomMcqQuestion[] = [];
    for (let idx = 0; idx < editorDraft.customQuestions.length; idx += 1) {
      const cq = editorDraft.customQuestions[idx];
      const trimmedPrompt = cq.prompt.trim();
      const cleanedOptions = cq.options.map((o) => o.trim()).filter((o) => o.length > 0);
      if (!trimmedPrompt) {
        setEditorError(`Pertanyaan pilihan ganda #${idx + 1} wajib memiliki teks pertanyaan.`);
        return;
      }
      if (cleanedOptions.length < 2) {
        setEditorError(
          `Pertanyaan "${trimmedPrompt}" minimal harus memiliki 2 pilihan jawaban yang terisi.`
        );
        return;
      }
      validatedCustomQuestions.push({
        ...cq,
        prompt: trimmedPrompt,
        description: cq.description?.trim() ? cq.description.trim() : undefined,
        options: cleanedOptions,
      });
    }

    const cleanedDraft: SiteContentConfig = {
      ...editorDraft,
      customQuestions: validatedCustomQuestions,
    };

    try {
      await updateContent(() => mergeSiteContent(cleanedDraft));
      playSuccess();
      setEditorSuccess(
        'Seluruh perubahan teks, gambar, dan pertanyaan pilihan ganda telah disimpan dan aktif.'
      );
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan konten.');
    }
  };

  const handleResetContent = async () => {
    setConfirmResetOpen(false);
    setEditorError(null);
    setEditorSuccess(null);
    try {
      await resetContentToDefault();
      setEditorDraft(DEFAULT_SITE_CONTENT);
      setEditorSuccess('Seluruh teks dan gambar telah dikembalikan ke pengaturan bawaan.');
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Gagal mengatur ulang konten.');
    }
  };

  const handleSaveGoogleFormLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setFormsError(null);
    setFormsSuccess(null);

    const trimmedUri = formResponderUriInput.trim();
    if (!trimmedUri || (!trimmedUri.startsWith('https://') && !trimmedUri.startsWith('http://'))) {
      setFormsError('Masukkan URL Google Form yang valid (diawali dengan https://).');
      return;
    }

    const derivedId =
      formIdInput.trim() ||
      trimmedUri.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/)?.[1] ||
      'manual-form';

    setFormsSaving(true);
    try {
      const saved = await saveOwnerGoogleFormConfig(
        {
          formId: derivedId,
          formTitle: formTitleInput.trim() || 'MASHRO – Survei Pengalaman dan Kepuasan Pelanggan',
          responderUri: trimmedUri,
        },
        adminToken
      );
      setSavedFormConfig(saved);
      setFormIdInput(saved.formId);
      setFormsSuccess('Tautan Google Form MASHRO berhasil disimpan.');
    } catch (err) {
      setFormsError(err instanceof Error ? err.message : 'Gagal menyimpan tautan Google Form.');
    } finally {
      setFormsSaving(false);
    }
  };

  const handleCopyResponderUri = async (uri: string) => {
    if (!uri) return;
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedFormLink(true);
      setTimeout(() => setCopiedFormLink(false), 2500);
    } catch {
      setFormsError('Tidak dapat menyalin otomatis. Silakan salin link secara manual.');
    }
  };

  if (!authChecked) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#173E2C] mb-3" />
        <p className="text-sm text-[#173E2C]/75">Memeriksa sesi Portal Pemilik MASHRO...</p>
      </main>
    );
  }

  // Unauthenticated view: Direct Admin PIN Login (No Firebase Auth / Google Sign-In)
  if (!adminToken) {
    return (
      <main className="max-w-lg mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="bg-[#FCF9F2] border border-[#173E2C]/15 rounded-3xl p-7 sm:p-10 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#D6A23A]">
              <StarOrnament className="w-3.5 h-3.5" />
              <span>PORTAL PEMILIK MASHRO</span>
            </div>
            <SoundToggle compact />
          </div>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#173E2C] text-center mb-2.5">
            Masuk Dashboard Admin
          </h1>
          <p className="text-sm text-[#173E2C]/75 leading-relaxed text-center mb-7">
            Masukkan Password / PIN khusus pemilik bisnis untuk mengakses statistik respons survei,
            ekspor Excel/CSV, serta editor teks dan gambar.
          </p>

          {authError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-950/[0.06] border border-red-800/25 text-red-950 text-xs sm:text-sm flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-800" aria-hidden="true" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-pin-input"
                className="block text-xs font-semibold tracking-wider text-[#173E2C]/80 mb-2"
              >
                PASSWORD / PIN ADMIN
              </label>
              <div className="relative flex items-center">
                <KeyRound
                  className="w-4 h-4 text-[#5C3D28]/65 absolute left-3.5 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="admin-pin-input"
                  type={showPin ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Masukkan PIN (contoh: MASHRO2026)"
                  className="w-full min-h-[48px] pl-10 pr-12 py-2.5 rounded-2xl bg-white border border-[#5C3D28]/25 text-sm font-mono text-[#173E2C] focus:outline-none focus:border-[#173E2C]"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((s) => !s)}
                  aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                  className="absolute right-2 min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center text-[#5C3D28]/70 hover:text-[#173E2C] cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-[#5C3D28]/70 mt-2">
                Gunakan PIN admin Anda (bawaan: <code className="font-mono font-semibold text-[#173E2C]">MASHRO2026</code>). Seluruh data &amp; editan tersimpan langsung di Firebase Firestore.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full min-h-[48px] px-6 py-3 rounded-2xl bg-[#173E2C] text-[#F7F1E3] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#0F2B1E] transition-colors shadow-sm cursor-pointer disabled:opacity-60"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#D6A23A]" aria-hidden="true" />
                  <span>Memverifikasi PIN...</span>
                </>
              ) : (
                <span>Masuk ke Dashboard</span>
              )}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#173E2C]/12">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#D6A23A] mb-1">
            <StarOrnament className="w-3 h-3" />
            <span>DASHBOARD PEMILIK</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#173E2C]/70">Akses PIN Admin Aktif</span>
          </div>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#173E2C]">
            Portal Manajemen {content.brandName}
          </h1>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
          <SoundToggle compact />

          <button
            type="button"
            onClick={loadDashboardData}
            disabled={loadingData}
            className="min-h-[42px] px-3.5 py-2 rounded-full border border-[#173E2C]/20 bg-[#FCF9F2] text-[#173E2C] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-[#E5ECD9]/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Muat Ulang</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={responses.length === 0}
            className="min-h-[42px] px-4 py-2 rounded-full bg-[#173E2C] text-[#F7F1E3] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-[#0F2B1E] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#D6A23A]" aria-hidden="true" />
            <span>Ekspor Excel ({responses.length})</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={responses.length === 0}
            className="min-h-[42px] px-3.5 py-2 rounded-full border border-[#173E2C]/25 bg-[#FCF9F2] text-[#173E2C] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-[#E5ECD9]/60 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Ekspor CSV</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[42px] px-4 py-2 rounded-full border border-[#173E2C]/20 text-[#173E2C]/80 text-xs sm:text-sm font-medium inline-flex items-center gap-2 hover:bg-red-950/5 hover:text-red-900 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Primary Dashboard Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Navigasi bagian dashboard pemilik"
        className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-[#FCF9F2] border border-[#173E2C]/12 w-full sm:w-fit"
      >
        {(
          [
            { id: 'responses', label: 'Ringkasan & Respons', icon: BarChart3 },
            { id: 'editor', label: 'Editor Konten & Gambar', icon: Pencil },
            { id: 'google_form', label: 'Link Google Form', icon: FileSpreadsheet },
          ] as { id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#173E2C] text-[#F7F1E3] shadow-xs'
                  : 'text-[#173E2C]/75 hover:text-[#173E2C] hover:bg-[#E5ECD9]/45'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-[#D6A23A]' : ''}`} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {dataError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-950/[0.06] border border-red-800/25 text-red-950 text-sm flex items-center gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{dataError}</span>
        </div>
      )}

      {/* TAB 1: RINGKASAN & RESPONS */}
      {activeTab === 'responses' && (
        <>
          {loadingData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-[#FCF9F2] border border-[#173E2C]/10 animate-pulse"
                />
              ))}
            </div>
          ) : responses.length === 0 ? (
            <section className="bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-8 sm:p-12 text-center">
              <BarChart3 className="w-10 h-10 text-[#D6A23A] mx-auto mb-4" aria-hidden="true" />
              <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#173E2C] mb-2">
                Belum Ada Respons Masuk
              </h2>
              <p className="text-sm text-[#173E2C]/75 max-w-lg mx-auto leading-relaxed">
                Saat ini belum ada data pengiriman survei yang tersimpan. Statistik, grafik rata-rata
                kepuasan, ragam ekspresi, dan ekspor CSV akan muncul otomatis segera setelah responden
                mengirimkan survei asli.
              </p>
            </section>
          ) : (
            <div className="space-y-8">
              <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="p-5 rounded-2xl bg-[#FCF9F2] border border-[#173E2C]/10">
                  <p className="text-xs text-[#173E2C]/65 mb-2">Total Respons Asli</p>
                  <p className="font-mono text-3xl font-semibold text-[#173E2C] tabular-nums">
                    {stats.totalResponses}
                  </p>
                  <p className="text-xs text-[#173E2C]/60 mt-1 tabular-nums">
                    {stats.preOrderCount} via Pre-Order
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#FCF9F2] border border-[#173E2C]/10">
                  <p className="text-xs text-[#173E2C]/65 mb-2">Kepuasan Keseluruhan</p>
                  <p className="font-mono text-3xl font-semibold text-[#173E2C] tabular-nums">
                    {stats.avgOverallSatisfaction?.toFixed(1) ?? '—'}
                    <span className="text-base font-normal text-[#173E2C]/55"> / 5</span>
                  </p>
                  <p className="text-xs text-[#173E2C]/60 mt-1">Rata-rata keseluruhan</p>
                </div>

                <div className="p-5 rounded-2xl bg-[#FCF9F2] border border-[#173E2C]/10">
                  <p className="text-xs text-[#173E2C]/65 mb-2">Skor Rekomendasi</p>
                  <p className="font-mono text-3xl font-semibold text-[#173E2C] tabular-nums">
                    {stats.avgRecommendScore?.toFixed(1) ?? '—'}
                    <span className="text-base font-normal text-[#173E2C]/55"> / 10</span>
                  </p>
                  <p className="text-xs text-[#173E2C]/60 mt-1 tabular-nums">
                    NPS Bersih: {stats.npsNetScore !== null ? `${stats.npsNetScore}` : '—'}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#FCF9F2] border border-[#173E2C]/10">
                  <p className="text-xs text-[#173E2C]/65 mb-2">Penerimaan Harga</p>
                  <p className="font-mono text-3xl font-semibold text-[#173E2C] tabular-nums">
                    {stats.priceAcceptancePct ?? 0}%
                  </p>
                  <p className="text-xs text-[#173E2C]/60 mt-1">Menilai Wajar / Sangat Wajar</p>
                </div>

                <div className="p-5 rounded-2xl bg-[#FCF9F2] border border-[#173E2C]/10 col-span-2 lg:col-span-1">
                  <p className="text-xs text-[#173E2C]/65 mb-2">Minat Beli Ulang</p>
                  <p className="font-mono text-3xl font-semibold text-[#173E2C] tabular-nums">
                    {stats.positiveRepurchasePct ?? 0}%
                  </p>
                  <p className="text-xs text-[#173E2C]/60 mt-1 tabular-nums">
                    Minat beli: {stats.avgPurchaseLikelihood?.toFixed(1) ?? '—'}/5
                  </p>
                </div>
              </section>

              <DashboardSummaryCharts stats={stats} />

              {/* Attribute Averages Bar Chart */}
              <section className="bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#173E2C]">
                      Rata-Rata Kepuasan per Atribut
                    </h2>
                    <p className="text-xs sm:text-sm text-[#173E2C]/70">
                      Dihitung langsung dari {stats.totalResponses} respons masuk (skala 1.0 – 5.0).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F7F1E3] rounded-xl border border-[#173E2C]/10">
                    {(['Semua', 'Produk', 'Kemasan & Porsi', 'Layanan Pre-Order'] as AttributeFilter[]).map(
                      (tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setAttrFilter(tab)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                            attrFilter === tab
                              ? 'bg-[#173E2C] text-[#F7F1E3]'
                              : 'text-[#173E2C]/75 hover:text-[#173E2C]'
                          }`}
                        >
                          {tab}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-3.5">
                  {filteredAttributes.map((attr) => {
                    const widthPct = Math.round((attr.average / 5) * 100);
                    return (
                      <div
                        key={attr.key}
                        className="grid grid-cols-1 sm:grid-cols-[240px_1fr_78px] gap-2 sm:gap-4 items-center"
                      >
                        <div className="text-sm font-medium text-[#173E2C] truncate" title={attr.label}>
                          {attr.label}
                        </div>
                        <div className="h-3 rounded-full bg-[#173E2C]/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#173E2C] transition-all duration-300"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <div className="text-right font-mono text-sm font-semibold text-[#173E2C] tabular-nums">
                          {attr.average.toFixed(1)}{' '}
                          <span className="text-xs font-normal text-[#173E2C]/55">
                            (n={attr.count})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Distribution Breakdowns */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6">
                  <h3 className="font-editorial text-2xl font-semibold text-[#173E2C] mb-4">
                    Harga (Rp. 20.000) & Minat Beli Ulang
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold text-[#D6A23A] mb-2.5">
                        PENILAIAN KEWAJARAN HARGA RP. 20.000
                      </p>
                      <div className="space-y-2">
                        {stats.priceDistribution.map((d) => (
                          <div key={d.label} className="flex items-center justify-between text-sm">
                            <span className="text-[#173E2C]/85">{d.label}</span>
                            <span className="font-mono text-xs text-[#173E2C] tabular-nums">
                              {d.count} ({d.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#173E2C]/10">
                      <p className="text-xs font-semibold text-[#D6A23A] mb-2.5">
                        KESEPADANAN HARGA RP. 20.000 (WORTH IT)
                      </p>
                      <div className="space-y-2">
                        {stats.priceWorthItDistribution.map((d) => (
                          <div key={d.label} className="flex items-center justify-between text-sm">
                            <span className="text-[#173E2C]/85">{d.label}</span>
                            <span className="font-mono text-xs text-[#173E2C] tabular-nums">
                              {d.count} ({d.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#173E2C]/10">
                      <p className="text-xs font-semibold text-[#D6A23A] mb-2.5">
                        MINAT MEMBELI KEMBALI
                      </p>
                      <div className="space-y-2">
                        {stats.repurchaseDistribution.map((d) => (
                          <div key={d.label} className="flex items-center justify-between text-sm">
                            <span className="text-[#173E2C]/85">{d.label}</span>
                            <span className="font-mono text-xs text-[#173E2C] tabular-nums">
                              {d.count} ({d.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6">
                  <h3 className="font-editorial text-2xl font-semibold text-[#173E2C] mb-4">
                    Ragam Ekspresi, Favorit & Rasa Kenyang
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold text-[#D6A23A] mb-2.5">
                        RAGAM EKSPRESI PELANGGAN
                      </p>
                      <div className="space-y-2">
                        {stats.expressionDistribution.map((d) => (
                          <div key={d.label} className="flex items-center justify-between text-sm">
                            <span className="text-[#173E2C]/85">{d.label}</span>
                            <span className="font-mono text-xs text-[#173E2C] tabular-nums">
                              {d.count} ({d.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#173E2C]/10">
                      <p className="text-xs font-semibold text-[#D6A23A] mb-2.5">
                        KOMPONEN PRODUK FAVORIT
                      </p>
                      <div className="space-y-2">
                        {stats.favoriteDistribution.map((d) => (
                          <div key={d.label} className="flex items-center justify-between text-sm">
                            <span className="text-[#173E2C]/85">{d.label}</span>
                            <span className="font-mono text-xs text-[#173E2C] tabular-nums">
                              {d.count} pemilih ({d.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Food Condition After Pickup Summary */}
              <section className="bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 sm:p-8 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#D96B27]/12 border border-[#D96B27]/25 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-[#D96B27]" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#173E2C]">
                      Ketahanan & Kondisi Sajian Setelah Pengambilan
                    </h2>
                    <p className="text-xs sm:text-sm text-[#173E2C]/70">
                      Evaluasi kondisi kesegaran singkong, ayam, sayuran, dan pumpkin puree sauce pada jam konsumsi responden.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { title: 'Kondisi Makanan Keseluruhan', items: stats.foodConditionOverallDistribution },
                    { title: 'Mashed Cassava (Singkong)', items: stats.conditionCassavaDistribution },
                    { title: 'Pan-Seared Chicken (Ayam)', items: stats.conditionChickenDistribution },
                    { title: 'Sayuran (Buncis & Wortel)', items: stats.conditionVegetablesDistribution },
                    { title: 'Pumpkin Puree Sauce', items: stats.conditionSauceDistribution },
                  ].map((group) => (
                    <div
                      key={group.title}
                      className="p-4 rounded-2xl bg-white border border-[#173E2C]/10 space-y-2.5"
                    >
                      <p className="text-xs font-semibold tracking-wider text-[#D6A23A]">
                        {group.title.toUpperCase()}
                      </p>
                      <div className="space-y-1.5">
                        {group.items.map((d) => (
                          <div key={d.label} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-[#173E2C]/85">{d.label}</span>
                            <span className="font-mono font-semibold text-[#173E2C] tabular-nums shrink-0">
                              {d.count} ({d.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Custom Multiple Choice Answers Summary */}
              {content.customQuestions.length > 0 && (
                <section className="bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 sm:p-8 space-y-5">
                  <div>
                    <h2 className="font-editorial text-2xl font-semibold text-[#173E2C]">
                      Ringkasan Pertanyaan Pilihan Ganda Tambahan
                    </h2>
                    <p className="text-xs text-[#173E2C]/70">
                      Distribusi jawaban untuk pertanyaan tambahan yang Anda buat.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {content.customQuestions.map((cq) => {
                      const counts = new Map<string, number>();
                      let answeredCount = 0;
                      for (const r of responses) {
                        const ans = r.customAnswers?.[cq.id];
                        if (ans) {
                          answeredCount += 1;
                          counts.set(ans, (counts.get(ans) ?? 0) + 1);
                        }
                      }
                      return (
                        <div
                          key={cq.id}
                          className="p-4 rounded-2xl bg-white border border-[#173E2C]/10 space-y-2"
                        >
                          <p className="text-sm font-semibold text-[#173E2C]">{cq.prompt}</p>
                          <div className="space-y-1.5">
                            {cq.options.map((opt) => {
                              const count = counts.get(opt) ?? 0;
                              const pct = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;
                              return (
                                <div key={opt} className="flex items-center justify-between text-xs">
                                  <span className="text-[#173E2C]/85">{opt}</span>
                                  <span className="font-mono font-semibold text-[#173E2C] tabular-nums">
                                    {count} ({pct}%)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Individual Submissions Table */}
              <section className="bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 sm:p-8">
                <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#173E2C] mb-1">
                  Daftar Respons Pelanggan
                </h2>
                <p className="text-xs sm:text-sm text-[#173E2C]/70 mb-5">
                  Seluruh masukan terbaru beserta jam konsumsi, kondisi makanan, ragam ekspresi, dan catatan saran dari responden.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#173E2C]/15 text-xs text-[#173E2C]/65">
                        <th className="py-3 pr-4 font-semibold">Waktu Kirim</th>
                        <th className="py-3 px-3 font-semibold">Aktivitas</th>
                        <th className="py-3 px-3 font-semibold">Jam & Kondisi</th>
                        <th className="py-3 px-3 font-semibold">Ekspresi</th>
                        <th className="py-3 px-3 font-semibold text-right">Kepuasan</th>
                        <th className="py-3 px-3 font-semibold text-right">Rekomendasi</th>
                        <th className="py-3 px-3 font-semibold">Harga Rp. 20.000</th>
                        <th className="py-3 px-3 font-semibold">Saran / Masukan</th>
                        <th className="py-3 pl-3 text-right font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#173E2C]/10">
                      {responses.map((r) => (
                        <tr key={r.id} className="hover:bg-[#E5ECD9]/25 transition-colors">
                          <td className="py-3 pr-4 font-mono text-xs text-[#173E2C]/75 whitespace-nowrap tabular-nums">
                            {new Date(r.createdAtMs).toLocaleString('id-ID', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-3 px-3 text-[#173E2C] whitespace-nowrap">
                            {r.activity}
                            {r.hasOrdered === 'Ya, pernah memesan' ? ' · PO' : ''}
                          </td>
                          <td className="py-3 px-3 text-xs text-[#173E2C]/85 whitespace-nowrap">
                            <span className="font-mono font-semibold text-[#173E2C]">
                              {r.pickupTime ? `${r.pickupTime} WIB` : '—'}
                            </span>
                            {r.foodConditionOverall && (
                              <span className="block text-[11px] text-[#5C3D28]/75">
                                {r.foodConditionOverall}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-xs font-semibold text-[#173E2C] whitespace-nowrap">
                            {r.expressionMood ?? '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums">
                            {r.overallSatisfaction}/5
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums">
                            {r.recommendScore}/10
                          </td>
                          <td className="py-3 px-3 text-xs text-[#173E2C]/80 whitespace-nowrap">
                            <span className="block font-medium text-[#173E2C]">{r.priceReasonable}</span>
                            {r.priceWorthIt && (
                              <span className="block text-[11px] text-[#5C3D28]/80">{r.priceWorthIt}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-xs text-[#173E2C]/80 max-w-xs">
                            {r.feedbackNotes ? r.feedbackNotes : '—'}
                          </td>
                          <td className="py-3 pl-3 text-right">
                            <button
                              type="button"
                              aria-label={`Hapus respons ${r.id}`}
                              onClick={() => setConfirmDeleteId(r.id)}
                              className="p-2 rounded-lg text-[#173E2C]/55 hover:text-red-800 hover:bg-red-950/5 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {/* TAB 2: EDITOR KONTEN & GAMBAR */}
      {activeTab === 'editor' && (
        <form onSubmit={handleSaveEditorDraft} className="space-y-6">
          <div className="bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wider text-[#D6A23A] mb-1">
                KUSTOMISASI PENUH HALAMAN & PERTANYAAN
              </p>
              <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#173E2C]">
                Editor Teks & Cropper Gambar MASHRO
              </h2>
              <p className="text-xs sm:text-sm text-[#173E2C]/75 mt-1 max-w-2xl">
                Ubah seluruh teks halaman utama maupun pertanyaan survei di bawah ini, atau aktifkan
                Mode Edit Langsung untuk menyunting teks dan meng-crop foto tepat di tampilan halaman.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setInlineEditMode(!inlineEditMode);
                }}
                className={`min-h-[42px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap border ${
                  inlineEditMode
                    ? 'bg-[#D96B27] border-[#D96B27] text-[#FCF9F2]'
                    : 'bg-white border-[#173E2C]/25 text-[#173E2C] hover:bg-[#E5ECD9]/60'
                }`}
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
                <span>{inlineEditMode ? 'Edit Langsung: Aktif' : 'Edit Langsung: Nonaktif'}</span>
              </button>

              {onNavigateHome && (
                <button
                  type="button"
                  onClick={() => {
                    setInlineEditMode(true);
                    onNavigateHome();
                  }}
                  className="min-h-[42px] px-4 py-2 rounded-full bg-[#173E2C] text-[#F7F1E3] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#0F2B1E] cursor-pointer whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4 text-[#D6A23A]" aria-hidden="true" />
                  <span>Buka Beranda & Edit Langsung</span>
                </button>
              )}
            </div>
          </div>

          {editorError && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-red-950/[0.06] border border-red-800/25 text-red-950 text-sm"
            >
              {editorError}
            </div>
          )}
          {editorSuccess && (
            <div className="p-4 rounded-2xl bg-[#E5ECD9] border border-[#173E2C]/20 text-[#173E2C] text-sm flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{editorSuccess}</span>
            </div>
          )}

          {/* Section A: Image Upload & Interactive Cropper */}
          <section className="bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 sm:p-7 space-y-5">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#D96B27]" aria-hidden="true" />
              <h3 className="font-editorial text-2xl font-semibold text-[#173E2C]">
                Foto Sajian & Komposisi (Unggah & Crop Sendiri)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Hero Image Card */}
              <div className="p-4 rounded-2xl bg-white border border-[#173E2C]/12 space-y-3">
                <p className="text-xs font-semibold tracking-wider text-[#D6A23A]">
                  GAMBAR UTAMA (HERO BOWL)
                </p>
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#E5ECD9]/60 border border-[#173E2C]/10">
                  <ImageWithFallback
                    src={editorDraft.heroImageUrl}
                    alt={editorDraft.heroImageAlt}
                    fallbackTitle="Hero MASHRO"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCropTarget('hero')}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#173E2C] text-[#F7F1E3] text-xs font-semibold inline-flex items-center gap-2 hover:bg-[#0F2B1E] cursor-pointer"
                  >
                    <Crop className="w-4 h-4 text-[#D6A23A]" aria-hidden="true" />
                    <span>Unggah & Crop Foto Utama</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditorDraft((prev) => ({
                        ...prev,
                        heroImageUrl: DEFAULT_SITE_CONTENT.heroImageUrl,
                      }))
                    }
                    className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#5C3D28]/25 text-xs font-medium text-[#5C3D28] hover:bg-[#F7F1E3] cursor-pointer"
                  >
                    Reset Gambar
                  </button>
                </div>
              </div>

              {/* Composition Image Card */}
              <div className="p-4 rounded-2xl bg-white border border-[#173E2C]/12 space-y-3">
                <p className="text-xs font-semibold tracking-wider text-[#D6A23A]">
                  GAMBAR KOMPOSISI BAHAN ALAMI
                </p>
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#E5ECD9]/60 border border-[#173E2C]/10">
                  <ImageWithFallback
                    src={editorDraft.compositionImageUrl}
                    alt={editorDraft.compositionImageAlt}
                    fallbackTitle="Komposisi Bahan MASHRO"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCropTarget('composition')}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#173E2C] text-[#F7F1E3] text-xs font-semibold inline-flex items-center gap-2 hover:bg-[#0F2B1E] cursor-pointer"
                  >
                    <Crop className="w-4 h-4 text-[#D6A23A]" aria-hidden="true" />
                    <span>Unggah & Crop Foto Bahan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditorDraft((prev) => ({
                        ...prev,
                        compositionImageUrl: DEFAULT_SITE_CONTENT.compositionImageUrl,
                      }))
                    }
                    className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#5C3D28]/25 text-xs font-medium text-[#5C3D28] hover:bg-[#F7F1E3] cursor-pointer"
                  >
                    Reset Gambar
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section B: Brand & Landing Page Copy */}
          <section className="bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 sm:p-7 space-y-5">
            <h3 className="font-editorial text-2xl font-semibold text-[#173E2C]">
              Teks Merek, Halaman Depan & Privasi
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Nama Merek</span>
                <input
                  type="text"
                  value={editorDraft.brandName}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, brandName: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Label Sub-Merek (Eyebrow)</span>
                <input
                  type="text"
                  value={editorDraft.heroEyebrow}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, heroEyebrow: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-[#173E2C]/80">Judul Utama Hero</span>
                <input
                  type="text"
                  value={editorDraft.heroTitle}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, heroTitle: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-[#173E2C]/80">Subjudul Hero</span>
                <input
                  type="text"
                  value={editorDraft.heroSubtitle}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, heroSubtitle: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-[#173E2C]/80">Paragraf Pengantar Hero</span>
                <textarea
                  rows={3}
                  value={editorDraft.heroDescription}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, heroDescription: e.target.value }))}
                  className="w-full p-3.5 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Teks Tombol Mulai Survei</span>
                <input
                  type="text"
                  value={editorDraft.heroCtaLabel}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, heroCtaLabel: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Estimasi Waktu Pengisian</span>
                <input
                  type="text"
                  value={editorDraft.heroTimeEstimate}
                  onChange={(e) =>
                    setEditorDraft((p) => ({ ...p, heroTimeEstimate: e.target.value }))
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Judul Bagian Komposisi</span>
                <input
                  type="text"
                  value={editorDraft.compositionTitle}
                  onChange={(e) =>
                    setEditorDraft((p) => ({ ...p, compositionTitle: e.target.value }))
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Judul Pemberitahuan Privasi</span>
                <input
                  type="text"
                  value={editorDraft.privacyTitle}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, privacyTitle: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-[#173E2C]/80">Isi Pemberitahuan Privasi</span>
                <textarea
                  rows={2}
                  value={editorDraft.privacyDescription}
                  onChange={(e) =>
                    setEditorDraft((p) => ({ ...p, privacyDescription: e.target.value }))
                  }
                  className="w-full p-3.5 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Teks Footer Kiri</span>
                <input
                  type="text"
                  value={editorDraft.footerText}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, footerText: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Teks Footer Kanan</span>
                <input
                  type="text"
                  value={editorDraft.footerSubtext}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, footerSubtext: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Teks Tombol Mulai di Panel Privasi</span>
                <input
                  type="text"
                  value={editorDraft.privacyCtaLabel}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, privacyCtaLabel: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Label Navigasi: Komposisi</span>
                <input
                  type="text"
                  value={editorDraft.navCompositionLabel}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, navCompositionLabel: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Label Navigasi: Alur</span>
                <input
                  type="text"
                  value={editorDraft.navFlowLabel}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, navFlowLabel: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Label Navigasi: Privasi</span>
                <input
                  type="text"
                  value={editorDraft.navPrivacyLabel}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, navPrivacyLabel: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Judul Kartu Boarding Pass Survei</span>
                <input
                  type="text"
                  value={editorDraft.boardingPassTitle}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, boardingPassTitle: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-[#173E2C]/80">Catatan Kartu Boarding Pass Survei</span>
                <input
                  type="text"
                  value={editorDraft.boardingPassNote}
                  onChange={(e) => setEditorDraft((p) => ({ ...p, boardingPassNote: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>
            </div>

            {/* 4 Komponen Sajian */}
            <div className="pt-4 border-t border-[#173E2C]/10">
              <p className="text-xs font-semibold tracking-wider text-[#D6A23A] mb-3">
                KOMPONEN SAJIAN BOWL (4 KARTU)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editorDraft.bowlComponents.map((comp, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white border border-[#5C3D28]/15 space-y-2.5">
                    <input
                      type="text"
                      aria-label={`Nama komponen ${idx + 1}`}
                      value={comp.name}
                      onChange={(e) =>
                        setEditorDraft((p) => ({
                          ...p,
                          bowlComponents: p.bowlComponents.map((c, i) =>
                            i === idx ? { ...c, name: e.target.value } : c
                          ),
                        }))
                      }
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#F7F1E3]/45 border border-[#5C3D28]/20 text-sm font-semibold text-[#173E2C]"
                    />
                    <textarea
                      rows={2}
                      aria-label={`Deskripsi komponen ${idx + 1}`}
                      value={comp.detail}
                      onChange={(e) =>
                        setEditorDraft((p) => ({
                          ...p,
                          bowlComponents: p.bowlComponents.map((c, i) =>
                            i === idx ? { ...c, detail: e.target.value } : c
                          ),
                        }))
                      }
                      className="w-full p-2.5 rounded-lg bg-[#F7F1E3]/45 border border-[#5C3D28]/20 text-xs text-[#173E2C]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section C: Survey Steps & Full Question Text Editor */}
          <section className="bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 sm:p-7 space-y-6">
            <div>
              <h3 className="font-editorial text-2xl font-semibold text-[#173E2C]">
                Judul Stasiun, Seluruh Pertanyaan Survei & Pesan Penutup
              </h3>
              <p className="text-xs text-[#173E2C]/70 mt-1">
                Semua teks pertanyaan di bawah ini dapat diubah langsung lalu disimpan permanen ke aplikasi survei.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(editorDraft.steps).map((step) => (
                <div
                  key={step.id}
                  className="p-4 rounded-2xl bg-white border border-[#5C3D28]/15 space-y-2"
                >
                  <p className="font-mono text-[11px] font-semibold text-[#D96B27]">
                    LANGKAH: {step.id.toUpperCase()}
                  </p>
                  <input
                    type="text"
                    aria-label={`Judul langkah ${step.id}`}
                    value={step.title}
                    onChange={(e) =>
                      setEditorDraft((p) => ({
                        ...p,
                        steps: {
                          ...p.steps,
                          [step.id]: { ...p.steps[step.id], title: e.target.value },
                        },
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[#F7F1E3]/45 border border-[#5C3D28]/20 text-sm font-semibold text-[#173E2C]"
                  />
                  <input
                    type="text"
                    aria-label={`Nama stasiun ${step.id}`}
                    value={step.stopName}
                    onChange={(e) =>
                      setEditorDraft((p) => ({
                        ...p,
                        steps: {
                          ...p.steps,
                          [step.id]: { ...p.steps[step.id], stopName: e.target.value },
                        },
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[#F7F1E3]/45 border border-[#5C3D28]/20 text-xs text-[#173E2C]"
                  />
                </div>
              ))}
            </div>

            {/* Editable Core Questions */}
            <div className="pt-4 border-t border-[#173E2C]/10 space-y-5">
              <p className="text-xs font-semibold tracking-wider text-[#D6A23A]">
                EDIT TEKS PERTANYAAN PROFIL, JAM DINDING & KONDISI SAJIAN
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    { key: 'hasTastedLabel', label: 'Pertanyaan Pernah Mencicipi' },
                    { key: 'activityLabel', label: 'Pertanyaan Aktivitas Saat Ini' },
                    { key: 'hasOrderedLabel', label: 'Pertanyaan Pernah Pre-Order' },
                    { key: 'pickupTimeLabel', label: 'Pertanyaan Jam Dinding (Jam Ambil/Makan)' },
                    { key: 'pickupTimeDescription', label: 'Petunjuk Jam Dinding' },
                    { key: 'foodConditionOverallLabel', label: 'Kondisi Makanan Keseluruhan' },
                    { key: 'conditionCassavaLabel', label: 'Kondisi Mashed Cassava (Singkong)' },
                    { key: 'conditionChickenLabel', label: 'Kondisi Pan-Seared Chicken (Ayam)' },
                    { key: 'conditionVegetablesLabel', label: 'Kondisi Sayuran (Buncis & Wortel)' },
                    { key: 'conditionSauceLabel', label: 'Kondisi Pumpkin Puree Sauce' },
                  ] as { key: keyof SiteContentConfig['questions']; label: string }[]
                ).map((field) => (
                  <label key={field.key} className="block space-y-1.5">
                    <span className="text-xs font-semibold text-[#173E2C]/80">{field.label}</span>
                    <input
                      type="text"
                      value={editorDraft.questions[field.key]}
                      onChange={(e) =>
                        setEditorDraft((p) => ({
                          ...p,
                          questions: { ...p.questions, [field.key]: e.target.value },
                        }))
                      }
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Editable Volume Meter Product Items */}
            <div className="pt-4 border-t border-[#173E2C]/10 space-y-3">
              <p className="text-xs font-semibold tracking-wider text-[#D6A23A]">
                EDIT PERTANYAAN PRODUK & VOLUME METER (8 ITEM)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {Object.values(editorDraft.productItems).map((item) => (
                  <div key={item.key} className="p-3.5 rounded-2xl bg-white border border-[#5C3D28]/15 space-y-2">
                    <input
                      type="text"
                      aria-label={`Judul item ${item.key}`}
                      value={item.label}
                      onChange={(e) =>
                        setEditorDraft((p) => ({
                          ...p,
                          productItems: {
                            ...p.productItems,
                            [item.key]: { ...p.productItems[item.key], label: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-[#F7F1E3]/45 border border-[#5C3D28]/20 text-sm font-semibold text-[#173E2C]"
                    />
                    <input
                      type="text"
                      aria-label={`Deskripsi item ${item.key}`}
                      value={item.description}
                      onChange={(e) =>
                        setEditorDraft((p) => ({
                          ...p,
                          productItems: {
                            ...p.productItems,
                            [item.key]: { ...p.productItems[item.key], description: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-[#F7F1E3]/45 border border-[#5C3D28]/20 text-xs text-[#173E2C]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Editable Packaging & Pre-Order Items */}
            <div className="pt-4 border-t border-[#173E2C]/10 space-y-3">
              <p className="text-xs font-semibold tracking-wider text-[#D6A23A]">
                EDIT PERTANYAAN KEMASAN, PORSI & LAYANAN PRE-ORDER
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {Object.values(editorDraft.packagingItems).map((item) => (
                  <div key={item.key} className="p-3.5 rounded-2xl bg-white border border-[#5C3D28]/15 space-y-2">
                    <input
                      type="text"
                      aria-label={`Judul kemasan ${item.key}`}
                      value={item.label}
                      onChange={(e) =>
                        setEditorDraft((p) => ({
                          ...p,
                          packagingItems: {
                            ...p.packagingItems,
                            [item.key]: { ...p.packagingItems[item.key], label: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-[#F7F1E3]/45 border border-[#5C3D28]/20 text-sm font-semibold text-[#173E2C]"
                    />
                    <input
                      type="text"
                      aria-label={`Deskripsi kemasan ${item.key}`}
                      value={item.description}
                      onChange={(e) =>
                        setEditorDraft((p) => ({
                          ...p,
                          packagingItems: {
                            ...p.packagingItems,
                            [item.key]: { ...p.packagingItems[item.key], description: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-[#F7F1E3]/45 border border-[#5C3D28]/20 text-xs text-[#173E2C]"
                    />
                  </div>
                ))}

                {Object.values(editorDraft.preorderItems).map((item) => (
                  <div key={item.key} className="p-3.5 rounded-2xl bg-white border border-[#5C3D28]/15 space-y-2">
                    <input
                      type="text"
                      aria-label={`Judul pre-order ${item.key}`}
                      value={item.label}
                      onChange={(e) =>
                        setEditorDraft((p) => ({
                          ...p,
                          preorderItems: {
                            ...p.preorderItems,
                            [item.key]: { ...p.preorderItems[item.key], label: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-[#F7F1E3]/45 border border-[#5C3D28]/20 text-sm font-semibold text-[#173E2C]"
                    />
                    <input
                      type="text"
                      aria-label={`Deskripsi pre-order ${item.key}`}
                      value={item.description}
                      onChange={(e) =>
                        setEditorDraft((p) => ({
                          ...p,
                          preorderItems: {
                            ...p.preorderItems,
                            [item.key]: { ...p.preorderItems[item.key], description: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-[#F7F1E3]/45 border border-[#5C3D28]/20 text-xs text-[#173E2C]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing, Expression, Constellation & Thank You Questions */}
            <div className="pt-4 border-t border-[#173E2C]/10 grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  { key: 'satietyLabel', label: 'Pertanyaan Tingkat Rasa Kenyang' },
                  { key: 'priceBannerTitle', label: 'Judul Banner Harga Tetap' },
                  { key: 'priceBannerAmount', label: 'Nominal Harga Resmi (Rp. 20.000)' },
                  { key: 'priceBannerNote', label: 'Keterangan Banner Harga' },
                  { key: 'priceReasonableLabel', label: 'Pertanyaan Kewajaran Harga Rp. 20.000' },
                  { key: 'priceWorthItLabel', label: 'Pertanyaan Kesepadanan Harga (Worth It)' },
                  { key: 'purchaseLikelihoodLabel', label: 'Pertanyaan Minat Membeli' },
                  { key: 'purchaseFrequencyLabel', label: 'Pertanyaan Frekuensi Pembelian' },
                  { key: 'repurchaseIntentionLabel', label: 'Pertanyaan Minat Beli Ulang' },
                  { key: 'expressionLabel', label: 'Pertanyaan Ragam Ekspresi' },
                  { key: 'overallSatisfactionLabel', label: 'Pertanyaan Kepuasan Total (1–5)' },
                  { key: 'recommendScoreLabel', label: 'Pertanyaan Skor Rekomendasi (0–10)' },
                  { key: 'favoriteComponentsLabel', label: 'Pertanyaan Komponen Favorit' },
                  { key: 'feedbackNotesLabel', label: 'Pertanyaan Saran & Masukan' },
                ] as { key: keyof SiteContentConfig['questions']; label: string }[]
              ).map((field) => (
                <label key={field.key} className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[#173E2C]/80">{field.label}</span>
                  <input
                    type="text"
                    value={editorDraft.questions[field.key]}
                    onChange={(e) =>
                      setEditorDraft((p) => ({
                        ...p,
                        questions: { ...p.questions, [field.key]: e.target.value },
                      }))
                    }
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                  />
                </label>
              ))}

              <label className="block space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-[#173E2C]/80">
                  Pesan Kedatangan Tujuan Akhir (Halaman Terima Kasih)
                </span>
                <input
                  type="text"
                  value={editorDraft.thankYouArrivalBadge}
                  onChange={(e) =>
                    setEditorDraft((p) => ({ ...p, thankYouArrivalBadge: e.target.value }))
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">
                  Judul Halaman Terima Kasih
                </span>
                <input
                  type="text"
                  value={editorDraft.thankYouTitle}
                  onChange={(e) =>
                    setEditorDraft((p) => ({ ...p, thankYouTitle: e.target.value }))
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">
                  Teks Tombol Kembali (Terima Kasih)
                </span>
                <input
                  type="text"
                  value={editorDraft.thankYouHomeButtonLabel}
                  onChange={(e) =>
                    setEditorDraft((p) => ({ ...p, thankYouHomeButtonLabel: e.target.value }))
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-[#173E2C]/80">
                  Pesan Ucapan Terima Kasih
                </span>
                <input
                  type="text"
                  value={editorDraft.thankYouBody}
                  onChange={(e) =>
                    setEditorDraft((p) => ({ ...p, thankYouBody: e.target.value }))
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                />
              </label>
            </div>
          </section>

          {/* Section D: Custom Multiple-Choice Question Builder */}
          <section className="bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wider text-[#D6A23A] mb-1">
                  PEMBUAT PERTANYAAN PILIHAN GANDA
                </p>
                <h3 className="font-editorial text-2xl font-semibold text-[#173E2C]">
                  Tambah Pertanyaan Pilihan Ganda Sendiri
                </h3>
                <p className="text-xs text-[#173E2C]/70 mt-1">
                  Buat pertanyaan pilihan ganda tambahan dan tentukan pada bagian survei mana pertanyaan tersebut muncul.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  playTap();
                  const newQuestion: CustomMcqQuestion = {
                    id: `cq_${Date.now()}`,
                    prompt: '',
                    description: '',
                    options: ['Pilihan 1', 'Pilihan 2'],
                    required: true,
                    placement: 'overall',
                  };
                  setEditorDraft((p) => ({
                    ...p,
                    customQuestions: [...p.customQuestions, newQuestion],
                  }));
                }}
                className="min-h-[42px] px-4 py-2 rounded-full bg-[#D96B27] text-[#FCF9F2] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#B8561A] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Tambah Pertanyaan Pilihan Ganda</span>
              </button>
            </div>

            {editorDraft.customQuestions.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/70 border border-dashed border-[#5C3D28]/25 text-center text-xs sm:text-sm text-[#5C3D28]/75">
                Belum ada pertanyaan pilihan ganda tambahan. Klik tombol &ldquo;+ Tambah Pertanyaan Pilihan Ganda&rdquo; di atas untuk menambahkan pertanyaan baru.
              </div>
            ) : (
              <div className="space-y-4">
                {editorDraft.customQuestions.map((cq, qIdx) => (
                  <div
                    key={cq.id}
                    className="p-5 rounded-2xl bg-white border border-[#5C3D28]/18 space-y-4 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-bold text-[#D96B27]">
                        PERTANYAAN TAMBAHAN #{qIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          playTap();
                          setEditorDraft((p) => ({
                            ...p,
                            customQuestions: p.customQuestions.filter((item) => item.id !== cq.id),
                          }));
                        }}
                        className="min-h-[34px] px-3 py-1 rounded-lg border border-red-800/25 text-red-900 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-red-950/5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Hapus Pertanyaan</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <label className="block space-y-1 md:col-span-2">
                        <span className="text-xs font-semibold text-[#173E2C]/80">
                          Teks Pertanyaan
                        </span>
                        <input
                          type="text"
                          value={cq.prompt}
                          placeholder="Contoh: Varian saus baru apa yang paling ingin Anda coba?"
                          onChange={(e) =>
                            setEditorDraft((p) => ({
                              ...p,
                              customQuestions: p.customQuestions.map((item) =>
                                item.id === cq.id ? { ...item, prompt: e.target.value } : item
                              ),
                            }))
                          }
                          className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F1E3]/40 border border-[#5C3D28]/20 text-sm text-[#173E2C]"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-[#173E2C]/80">
                          Keterangan Singkat (Opsional)
                        </span>
                        <input
                          type="text"
                          value={cq.description ?? ''}
                          placeholder="Penjelasan tambahan untuk responden"
                          onChange={(e) =>
                            setEditorDraft((p) => ({
                              ...p,
                              customQuestions: p.customQuestions.map((item) =>
                                item.id === cq.id ? { ...item, description: e.target.value } : item
                              ),
                            }))
                          }
                          className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F7F1E3]/40 border border-[#5C3D28]/20 text-xs text-[#173E2C]"
                        />
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-[#173E2C]/80">
                            Tampilkan Pada Bagian
                          </span>
                          <select
                            value={cq.placement}
                            onChange={(e) =>
                              setEditorDraft((p) => ({
                                ...p,
                                customQuestions: p.customQuestions.map((item) =>
                                  item.id === cq.id
                                    ? {
                                        ...item,
                                        placement: e.target.value as CustomQuestionPlacement,
                                      }
                                    : item
                                ),
                              }))
                            }
                            className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F7F1E3]/40 border border-[#5C3D28]/20 text-xs font-semibold text-[#173E2C]"
                          >
                            <option value="respondent">ST-01 · Profil Responden</option>
                            <option value="product">ST-02 · Penilaian Produk</option>
                            <option value="condition">ST-03 · Jam & Kondisi Sajian</option>
                            <option value="packaging">ST-04 · Porsi & Kemasan</option>
                            <option value="pricing">ST-05 · Harga & Minat Beli</option>
                            <option value="overall">ST-07 · Kepuasan Akhir</option>
                          </select>
                        </label>

                        <label className="flex items-center gap-2 min-h-[40px] px-3 py-2 rounded-xl bg-[#F7F1E3]/40 border border-[#5C3D28]/15 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cq.required}
                            onChange={(e) =>
                              setEditorDraft((p) => ({
                                ...p,
                                customQuestions: p.customQuestions.map((item) =>
                                  item.id === cq.id ? { ...item, required: e.target.checked } : item
                                ),
                              }))
                            }
                            className="w-4 h-4 accent-[#173E2C]"
                          />
                          <span className="text-xs font-semibold text-[#173E2C]">Wajib diisi</span>
                        </label>
                      </div>
                    </div>

                    {/* Options list */}
                    <div className="space-y-2 pt-2 border-t border-[#173E2C]/10">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#173E2C]/80">
                          Daftar Pilihan Jawaban (Min. 2)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            playTap();
                            setEditorDraft((p) => ({
                              ...p,
                              customQuestions: p.customQuestions.map((item) =>
                                item.id === cq.id
                                  ? {
                                      ...item,
                                      options: [
                                        ...item.options,
                                        `Pilihan ${item.options.length + 1}`,
                                      ],
                                    }
                                  : item
                              ),
                            }));
                          }}
                          className="px-3 py-1 rounded-lg bg-[#E5ECD9] text-[#173E2C] text-xs font-semibold inline-flex items-center gap-1 hover:bg-[#D4E2C1] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Tambah Pilihan</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {cq.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              aria-label={`Pilihan ${optIdx + 1} untuk pertanyaan ${qIdx + 1}`}
                              value={opt}
                              onChange={(e) =>
                                setEditorDraft((p) => ({
                                  ...p,
                                  customQuestions: p.customQuestions.map((item) =>
                                    item.id === cq.id
                                      ? {
                                          ...item,
                                          options: item.options.map((o, i) =>
                                            i === optIdx ? e.target.value : o
                                          ),
                                        }
                                      : item
                                  ),
                                }))
                              }
                              className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#5C3D28]/20 text-xs text-[#173E2C]"
                            />
                            <button
                              type="button"
                              aria-label={`Hapus pilihan ${optIdx + 1}`}
                              disabled={cq.options.length <= 2}
                              onClick={() => {
                                playTap();
                                setEditorDraft((p) => ({
                                  ...p,
                                  customQuestions: p.customQuestions.map((item) =>
                                    item.id === cq.id && item.options.length > 2
                                      ? {
                                          ...item,
                                          options: item.options.filter((_, i) => i !== optIdx),
                                        }
                                      : item
                                  ),
                                }));
                              }}
                              className="p-2 rounded-lg text-[#5C3D28]/60 hover:text-red-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Save / Reset Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-[#FCF9F2] border border-[#173E2C]/15">
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              disabled={savingContent}
              className="min-h-[44px] px-5 py-2 rounded-full border border-red-800/30 text-red-900 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 hover:bg-red-950/5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Reset Semua ke Bawaan</span>
            </button>

            <button
              type="submit"
              disabled={savingContent}
              className="min-h-[46px] px-7 py-2.5 rounded-full bg-[#173E2C] text-[#F7F1E3] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#0F2B1E] shadow-sm cursor-pointer disabled:opacity-60"
            >
              {savingContent ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#D6A23A]" aria-hidden="true" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-[#D6A23A]" aria-hidden="true" />
                  <span>Simpan Semua Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: LINK GOOGLE FORM (GRATIS VIA DRIVE, TANPA LOGIN GOOGLE) */}
      {activeTab === 'google_form' && (
        <section className="bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#D6A23A] mb-1">
              <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
              <span>PUBLIKASI LINK GOOGLE FORM & GOOGLE DRIVE (GRATIS)</span>
            </div>
            <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#173E2C]">
              Simpan & Bagikan Link Google Form MASHRO
            </h2>
            <p className="text-sm text-[#173E2C]/75 mt-1 max-w-2xl leading-relaxed">
              Anda dapat membuat formulir gratis di Google Drive / Google Forms lalu menyimpan tautan
              pengisiannya di sini agar mudah disalin kapan saja. Catatan teknis: versi Google Forms
              menggunakan komponen bawaan standar, sedangkan kontrol analog khusus (Volume Meter, Radio
              Tuner, Rasi Bintang Simetris, Ragam Ekspresi, Boarding Pass, dan Destination Indicator)
              berjalan pada aplikasi web MASHRO ini.
            </p>
          </div>

          {formsError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-950/[0.06] border border-red-800/25 text-red-950 text-xs sm:text-sm"
            >
              {formsError}
            </div>
          )}
          {formsSuccess && (
            <div className="p-3.5 rounded-xl bg-[#E5ECD9] border border-[#173E2C]/20 text-[#173E2C] text-xs sm:text-sm">
              {formsSuccess}
            </div>
          )}

          {savedFormConfig?.responderUri && (
            <div className="p-5 rounded-2xl bg-[#E5ECD9]/60 border border-[#173E2C]/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#173E2C]/70">
                    LINK GOOGLE FORM TERSIMPAN
                  </p>
                  <p className="text-sm font-semibold text-[#173E2C]">{savedFormConfig.formTitle}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyResponderUri(savedFormConfig.responderUri)}
                    className="min-h-[40px] px-4 py-2 rounded-full bg-[#173E2C] text-[#F7F1E3] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#0F2B1E] cursor-pointer whitespace-nowrap"
                  >
                    {copiedFormLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Link Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Salin Link Google Form</span>
                      </>
                    )}
                  </button>
                  <a
                    href={savedFormConfig.responderUri}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[40px] px-4 py-2 rounded-full border border-[#173E2C]/25 bg-white text-[#173E2C] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#FCF9F2] whitespace-nowrap"
                  >
                    <span>Buka Google Form</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
              <div className="px-3.5 py-2.5 rounded-xl bg-white/90 border border-[#173E2C]/15 font-mono text-xs text-[#173E2C] break-all select-all">
                {savedFormConfig.responderUri}
              </div>
            </div>
          )}

          <form onSubmit={handleSaveGoogleFormLink} className="p-5 rounded-2xl bg-white border border-[#173E2C]/10 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">Judul Formulir</span>
                <input
                  type="text"
                  value={formTitleInput}
                  onChange={(e) => setFormTitleInput(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F7F1E3]/40 border border-[#173E2C]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#173E2C]/80">ID Google Form (Opsional)</span>
                <input
                  type="text"
                  value={formIdInput}
                  onChange={(e) => setFormIdInput(e.target.value)}
                  placeholder="Otomatis terdeteksi dari URL"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F7F1E3]/40 border border-[#173E2C]/20 text-sm text-[#173E2C]"
                />
              </label>

              <label className="block space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-[#173E2C]/80">
                  Link Pengisian Google Form (Responder URL)
                </span>
                <input
                  type="url"
                  value={formResponderUriInput}
                  onChange={(e) => setFormResponderUriInput(e.target.value)}
                  placeholder="https://docs.google.com/forms/d/e/.../viewform"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F7F1E3]/40 border border-[#173E2C]/20 text-sm text-[#173E2C]"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={formsSaving}
              className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#173E2C] text-[#F7F1E3] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#0F2B1E] cursor-pointer disabled:opacity-50"
            >
              {formsSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Link2 className="w-4 h-4 text-[#D6A23A]" aria-hidden="true" />
              )}
              <span>Simpan Link Google Form</span>
            </button>
          </form>
        </section>
      )}

      {/* Image Cropper Modal for Editor Tab */}
      <ImageCropperModal
        open={cropTarget !== null}
        title={cropTarget === 'hero' ? 'Crop Foto Sajian Utama (Hero)' : 'Crop Foto Komposisi Bahan'}
        initialAspect={4 / 3}
        onClose={() => setCropTarget(null)}
        onApply={async (croppedDataUrl) => {
          const target = cropTarget;
          if (!target) return;
          const next =
            target === 'hero'
              ? { ...editorDraft, heroImageUrl: croppedDataUrl }
              : { ...editorDraft, compositionImageUrl: croppedDataUrl };
          await updateContent(() => mergeSiteContent(next));
          setEditorDraft(next);
          setEditorSuccess('Foto berhasil di-crop dan langsung tersimpan permanen.');
        }}
      />

      {/* Confirmation Modal: Reset Site Content */}
      {confirmResetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-reset-content-title"
          className="fixed inset-0 z-50 bg-[#0F2B1E]/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full bg-[#FCF9F2] border border-[#173E2C]/15 rounded-3xl p-6 sm:p-7 shadow-xl">
            <h3
              id="confirm-reset-content-title"
              className="font-editorial text-2xl font-semibold text-[#173E2C] mb-2"
            >
              Reset Konten & Gambar ke Bawaan?
            </h3>
            <p className="text-sm text-[#173E2C]/80 leading-relaxed mb-6">
              Seluruh perubahan teks dan gambar kustom akan dikembalikan ke teks dan foto awal MASHRO.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="min-h-[42px] px-5 py-2 rounded-full border border-[#173E2C]/25 text-[#173E2C] text-sm font-semibold hover:bg-[#E5ECD9]/60 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetContent}
                className="min-h-[42px] px-6 py-2 rounded-full bg-red-800 text-white text-sm font-semibold hover:bg-red-900 cursor-pointer"
              >
                Ya, Reset Bawaan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Survey Response */}
      {confirmDeleteId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          className="fixed inset-0 z-50 bg-[#0F2B1E]/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full bg-[#FCF9F2] border border-[#173E2C]/15 rounded-3xl p-6 sm:p-7 shadow-xl">
            <h3
              id="confirm-delete-title"
              className="font-editorial text-2xl font-semibold text-[#173E2C] mb-2"
            >
              Hapus Respons Survei?
            </h3>
            <p className="text-sm text-[#173E2C]/80 leading-relaxed mb-6">
              Apakah Anda yakin ingin menghapus respons dengan kode{' '}
              <span className="font-mono">{confirmDeleteId}</span> secara permanen?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="min-h-[42px] px-5 py-2 rounded-full border border-[#173E2C]/25 text-[#173E2C] text-sm font-semibold hover:bg-[#E5ECD9]/60 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDeleteResponse}
                className="min-h-[42px] px-6 py-2 rounded-full bg-red-800 text-white text-sm font-semibold hover:bg-red-900 cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
