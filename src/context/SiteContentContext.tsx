import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
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

interface SiteContentContextValue {
  content: SiteContentConfig;
  adminToken: string | null;
  authChecked: boolean;
  inlineEditMode: boolean;
  savingContent: boolean;
  setInlineEditMode: (enabled: boolean) => void;
  loginWithPin: (pin: string) => Promise<void>;
  logoutAdmin: () => void;
  updateContent: (updater: (prev: SiteContentConfig) => SiteContentConfig) => Promise<void>;
  resetContentToDefault: () => Promise<void>;
}

const SiteContentContext = createContext<SiteContentContextValue | null>(null);

export function SiteContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<SiteContentConfig>(DEFAULT_SITE_CONTENT);
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [inlineEditMode, setInlineEditMode] = useState(false);
  const [savingContent, setSavingContent] = useState(false);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      const [remoteSiteConfig, sessionValid] = await Promise.all([
        fetchSiteConfig(),
        adminToken ? verifyAdminSession(adminToken) : Promise.resolve(false),
      ]);

      if (!active) return;

      if (remoteSiteConfig) {
        setContent(mergeSiteContent(remoteSiteConfig));
      }
      if (adminToken && !sessionValid) {
        try {
          window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
        } catch {
          // ignore
        }
        setAdminToken(null);
        setInlineEditMode(false);
      }
      setAuthChecked(true);
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  const loginWithPin = useCallback(async (pin: string) => {
    const res = await adminLoginWithPin(pin);
    try {
      window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, res.token);
    } catch {
      // ignore
    }
    setAdminToken(res.token);
  }, []);

  const logoutAdmin = useCallback(() => {
    try {
      window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
    setAdminToken(null);
    setInlineEditMode(false);
  }, []);

  const updateContent = useCallback(
    async (updater: (prev: SiteContentConfig) => SiteContentConfig) => {
      if (!adminToken) {
        throw new Error('Silakan login sebagai admin terlebih dahulu untuk menyimpan perubahan.');
      }
      const next = updater(content);
      setContent(next);
      setSavingContent(true);
      try {
        const saved = await saveSiteConfig(next, adminToken);
        setContent(mergeSiteContent(saved));
      } finally {
        setSavingContent(false);
      }
    },
    [adminToken, content]
  );

  const resetContentToDefault = useCallback(async () => {
    if (!adminToken) return;
    setSavingContent(true);
    try {
      await resetSiteConfig(adminToken);
      setContent(DEFAULT_SITE_CONTENT);
    } finally {
      setSavingContent(false);
    }
  }, [adminToken]);

  return (
    <SiteContentContext.Provider
      value={{
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
 * Inline Editable Text wrapper: displays clean prose normally, and when Admin Inline Edit Mode
 * is active, clicking the text allows editing and saving immediately to the server.
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

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  if (!adminToken || !inlineEditMode) {
    return <span className={className}>{value}</span>;
  }

  if (editing) {
    const commit = async () => {
      const trimmed = draftValue.trim();
      setEditing(false);
      if (trimmed && trimmed !== value) {
        await onSave(trimmed);
      } else {
        setDraftValue(value);
      }
    };

    return (
      <span
        className="inline-flex flex-col gap-1.5 w-full max-w-full my-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        {multiline ? (
          <textarea
            autoFocus
            rows={3}
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-white border-2 border-[#D96B27] text-sm font-sans font-normal text-[#173E2C] leading-relaxed focus:outline-none"
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              } else if (e.key === 'Escape') {
                setDraftValue(value);
                setEditing(false);
              }
            }}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white border-2 border-[#D96B27] text-sm font-sans font-normal text-[#173E2C] focus:outline-none"
          />
        )}
        <span className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => void commit()}
            className="px-3 py-1 rounded-lg bg-[#173E2C] text-[#F7F1E3] text-xs font-sans font-semibold cursor-pointer"
          >
            Simpan
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftValue(value);
              setEditing(false);
            }}
            className="px-3 py-1 rounded-lg border border-[#5C3D28]/25 bg-white text-[#173E2C] text-xs font-sans font-medium cursor-pointer"
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
