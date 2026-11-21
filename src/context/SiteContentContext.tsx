import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Pencil } from 'lucide-react';
import {
  DEFAULT_SITE_CONTENT,
  SiteContentConfig,
  mergeSiteContent,
} from '../types/siteConfig';
import {
  adminLoginWithPin,
  fetchSiteConfig,
  resetSiteConfig,
  saveSiteConfig,
  verifyAdminSession,
} from '../services/surveyService';

const ADMIN_TOKEN_STORAGE_KEY = 'mashro_admin_token_v1';

function readStoredToken(): string | null {
  try {
    return (
      window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ||
      window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
      window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage quota / private mode restrictions
  }
}

interface SiteContentContextValue {
  content: SiteContentConfig;
  adminToken: string | null;
  authChecked: boolean;
  inlineEditMode: boolean;
  savingContent: boolean;
  lastSavedNotice: string | null;
  saveError: string | null;
  clearSaveFeedback: () => void;
  setInlineEditMode: (enabled: boolean) => void;
  loginWithPin: (pin: string) => Promise<void>;
  logoutAdmin: () => void;
  updateContent: (updater: (prev: SiteContentConfig) => SiteContentConfig) => Promise<void>;
  resetContentToDefault: () => Promise<void>;
}

const SiteContentContext = createContext<SiteContentContextValue | null>(null);

export function SiteContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<SiteContentConfig>(DEFAULT_SITE_CONTENT);
  const contentRef = useRef<SiteContentConfig>(DEFAULT_SITE_CONTENT);
  contentRef.current = content;

  const [adminToken, setAdminToken] = useState<string | null>(() => readStoredToken());
  const [authChecked, setAuthChecked] = useState(false);
  const [inlineEditMode, setInlineEditMode] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [lastSavedNotice, setLastSavedNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const showSavedToast = useCallback((msg: string) => {
    setSaveError(null);
    setLastSavedNotice(msg);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setLastSavedNotice(null);
      noticeTimerRef.current = null;
    }, 3200);
  }, []);

  const clearSaveFeedback = useCallback(() => {
    setLastSavedNotice(null);
    setSaveError(null);
  }, []);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      const initialToken = readStoredToken();
      const [remoteSiteConfig, sessionValid] = await Promise.all([
        fetchSiteConfig(),
        initialToken ? verifyAdminSession(initialToken) : Promise.resolve(false),
      ]);

      if (!active) return;

      if (remoteSiteConfig) {
        const merged = mergeSiteContent(remoteSiteConfig);
        contentRef.current = merged;
        setContent(merged);
      }
      if (initialToken && !sessionValid) {
        writeStoredToken(null);
        setAdminToken(null);
        setInlineEditMode(false);
      }
      setAuthChecked(true);
    }

    void hydrate();
    return () => {
      active = false;
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const loginWithPin = useCallback(async (pin: string) => {
    const res = await adminLoginWithPin(pin);
    writeStoredToken(res.token);
    setAdminToken(res.token);
  }, []);

  const logoutAdmin = useCallback(() => {
    writeStoredToken(null);
    setAdminToken(null);
    setInlineEditMode(false);
  }, []);

  const updateContent = useCallback(
    async (updater: (prev: SiteContentConfig) => SiteContentConfig) => {
      if (!adminToken) {
        const err = new Error('Silakan login sebagai admin terlebih dahulu untuk menyimpan perubahan.');
        setSaveError(err.message);
        throw err;
      }
      const previous = contentRef.current;
      const next = updater(previous);
      contentRef.current = next;
      setContent(next);
      setSavingContent(true);
      setSaveError(null);
      try {
        const saved = await saveSiteConfig(next, adminToken);
        const merged = mergeSiteContent(saved);
        contentRef.current = merged;
        setContent(merged);
        showSavedToast('Perubahan tersimpan permanen');
      } catch (err) {
        contentRef.current = previous;
        setContent(previous);
        const msg =
          err instanceof Error ? err.message : 'Gagal menyimpan perubahan. Silakan coba kembali.';
        setSaveError(msg);
        throw err;
      } finally {
        setSavingContent(false);
      }
    },
    [adminToken, showSavedToast]
  );

  const resetContentToDefault = useCallback(async () => {
    if (!adminToken) return;
    setSavingContent(true);
    setSaveError(null);
    try {
      await resetSiteConfig(adminToken);
      contentRef.current = DEFAULT_SITE_CONTENT;
      setContent(DEFAULT_SITE_CONTENT);
      showSavedToast('Konten dikembalikan ke pengaturan bawaan');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengatur ulang konten.';
      setSaveError(msg);
      throw err;
    } finally {
      setSavingContent(false);
    }
  }, [adminToken, showSavedToast]);

  return (
    <SiteContentContext.Provider
      value={{
        content,
        adminToken,
        authChecked,
        inlineEditMode,
        savingContent,
        lastSavedNotice,
        saveError,
        clearSaveFeedback,
        setInlineEditMode,
        loginWithPin,
        logoutAdmin,
        updateContent,
        resetContentToDefault,
      }}
    >
      {children}
    </SiteContentContext.Provider>
  );
}

export function useSiteContent(): SiteContentContextValue {
  const ctx = useContext(SiteContentContext);
  if (!ctx) {
    throw new Error('useSiteContent must be used inside SiteContentProvider');
  }
  return ctx;
}

/**
 * Inline Editable Text wrapper: keeps the editor open during async save,
 * only closes on success, and renders explicit Indonesian error feedback on failure.
 */
export function EditableText({
  value,
  onSave,
  multiline = false,
  className = '',
  editLabel = 'Ubah teks',
}: {
  value: string;
  onSave: (nextValue: string) => Promise<void> | void;
  multiline?: boolean;
  className?: string;
  editLabel?: string;
}) {
  const { adminToken, inlineEditMode } = useSiteContent();
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraftValue(value);
    }
  }, [value, editing]);

  if (!adminToken || !inlineEditMode) {
    return <span className={className}>{value}</span>;
  }

  if (editing) {
    const commit = async () => {
      const trimmed = draftValue.trim();
      if (!trimmed) {
        setErrorMsg('Teks tidak boleh kosong.');
        return;
      }
      if (trimmed === value) {
        setErrorMsg(null);
        setEditing(false);
        return;
      }
      setIsSaving(true);
      setErrorMsg(null);
      try {
        await onSave(trimmed);
        setEditing(false);
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Gagal menyimpan perubahan. Coba tekan Simpan lagi.'
        );
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <span
        className="inline-flex flex-col gap-1.5 w-full min-w-[200px] max-w-full my-0.5 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {multiline ? (
          <textarea
            autoFocus
            rows={3}
            disabled={isSaving}
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-white border-2 border-[#D96B27] text-sm font-sans font-normal text-[#173E2C] leading-relaxed focus:outline-none disabled:opacity-65"
          />
        ) : (
          <input
            autoFocus
            type="text"
            disabled={isSaving}
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              } else if (e.key === 'Escape' && !isSaving) {
                setDraftValue(value);
                setErrorMsg(null);
                setEditing(false);
              }
            }}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white border-2 border-[#D96B27] text-sm font-sans font-normal text-[#173E2C] focus:outline-none disabled:opacity-65"
          />
        )}
        {errorMsg && (
          <span
            role="alert"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/[0.08] border border-red-800/30 text-red-900 text-xs font-sans font-medium"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void commit()}
            className="px-3 py-1 rounded-lg bg-[#173E2C] text-[#F7F1E3] text-xs font-sans font-semibold cursor-pointer disabled:opacity-60 inline-flex items-center gap-1"
          >
            <Check className="w-3 h-3 text-[#D6A23A]" aria-hidden="true" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              setDraftValue(value);
              setErrorMsg(null);
              setEditing(false);
            }}
            className="px-3 py-1 rounded-lg border border-[#5C3D28]/25 bg-white text-[#173E2C] text-xs font-sans font-medium cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
        </span>
      </span>
    );
  }

  return (
    <span className={`group/edit relative inline-flex items-baseline gap-1.5 ${className}`}>
      <span className="underline decoration-dashed decoration-[#D96B27]/65 underline-offset-4">
        {value}
      </span>
      <button
        type="button"
        aria-label={editLabel}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setErrorMsg(null);
          setEditing(true);
        }}
        className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#D96B27] text-[#FCF9F2] text-[10px] shrink-0 cursor-pointer hover:bg-[#b8561b]"
        title={editLabel}
      >
        <Pencil className="w-3 h-3" aria-hidden="true" />
      </button>
    </span>
  );
}

/**
 * Editable companion control intended for use NEXT TO (not nested inside) interactive buttons or links,
 * preventing invalid nested <button> / <a> DOM while still allowing every button & nav label to be edited inline.
 */
export function EditableControlWrap({
  value,
  onSave,
  editLabel,
  children,
}: {
  value: string;
  onSave: (nextValue: string) => Promise<void> | void;
  editLabel: string;
  children: React.ReactNode;
}) {
  const { adminToken, inlineEditMode } = useSiteContent();
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraftValue(value);
    }
  }, [value, editing]);

  if (!adminToken || !inlineEditMode) {
    return <>{children}</>;
  }

  if (editing) {
    const commit = async () => {
      const trimmed = draftValue.trim();
      if (!trimmed) {
        setErrorMsg('Teks tombol tidak boleh kosong.');
        return;
      }
      if (trimmed === value) {
        setErrorMsg(null);
        setEditing(false);
        return;
      }
      setIsSaving(true);
      setErrorMsg(null);
      try {
        await onSave(trimmed);
        setEditing(false);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan teks.');
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="inline-flex flex-col gap-1.5 bg-[#FCF9F2] border-2 border-[#D96B27] rounded-xl p-2 shadow-sm">
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            type="text"
            disabled={isSaving}
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              } else if (e.key === 'Escape' && !isSaving) {
                setDraftValue(value);
                setErrorMsg(null);
                setEditing(false);
              }
            }}
            className="min-w-[140px] px-2.5 py-1 rounded-lg bg-white border border-[#5C3D28]/25 text-xs font-sans text-[#173E2C] focus:outline-none"
          />
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void commit()}
            className="px-2.5 py-1 rounded-lg bg-[#173E2C] text-[#F7F1E3] text-xs font-semibold cursor-pointer disabled:opacity-60"
          >
            {isSaving ? '...' : 'Simpan'}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              setDraftValue(value);
              setErrorMsg(null);
              setEditing(false);
            }}
            className="px-2 py-1 rounded-lg border border-[#5C3D28]/25 bg-white text-[#173E2C] text-xs cursor-pointer"
          >
            Batal
          </button>
        </div>
        {errorMsg && (
          <span role="alert" className="text-[11px] text-red-900 font-medium">
            {errorMsg}
          </span>
        )}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <button
        type="button"
        aria-label={editLabel}
        title={editLabel}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setErrorMsg(null);
          setEditing(true);
        }}
        className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#D96B27] text-[#FCF9F2] shrink-0 cursor-pointer hover:bg-[#b8561b] shadow-2xs"
      >
        <Pencil className="w-3 h-3" aria-hidden="true" />
      </button>
    </span>
  );
}
