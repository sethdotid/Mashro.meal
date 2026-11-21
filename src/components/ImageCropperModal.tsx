import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, RotateCw, Upload, X, ZoomIn } from 'lucide-react';

export interface ImageCropperModalProps {
  open: boolean;
  title: string;
  initialAspect?: number; // e.g., 4 / 3
  onClose: () => void;
  onApply: (croppedDataUrl: string) => Promise<void> | void;
}

const ASPECT_OPTIONS: { label: string; value: number }[] = [
  { label: '4 : 3', value: 4 / 3 },
  { label: '16 : 10', value: 16 / 10 },
  { label: '1 : 1', value: 1 },
];

export function ImageCropperModal({
  open,
  title,
  initialAspect = 4 / 3,
  onClose,
  onApply,
}: ImageCropperModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [aspect, setAspect] = useState<number>(initialAspect);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (!open) {
      setErrorMsg(null);
      setIsDragging(false);
      setIsApplying(false);
    }
  }, [open]);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const previewWidth = 480;
    const previewHeight = Math.round(previewWidth / aspect);
    canvas.width = previewWidth;
    canvas.height = previewHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0F2B1E';
    ctx.fillRect(0, 0, previewWidth, previewHeight);

    const isRotatedOdd = rotation % 180 !== 0;
    const naturalW = isRotatedOdd ? img.naturalHeight : img.naturalWidth;
    const naturalH = isRotatedOdd ? img.naturalWidth : img.naturalHeight;
    if (!naturalW || !naturalH) return;

    const coverScale = Math.max(previewWidth / naturalW, previewHeight / naturalH);
    const scale = coverScale * zoom;

    ctx.save();
    ctx.translate(previewWidth / 2 + offset.x, previewHeight / 2 + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  }, [aspect, offset, rotation, zoom]);

  useEffect(() => {
    if (imageSrc && imageRef.current?.complete) {
      drawPreview();
    }
  }, [imageSrc, drawPreview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Pilih file gambar yang valid (JPG, PNG, atau WebP).');
      return;
    }
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) return;
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setZoom(1);
        setRotation(0);
        setOffset({ x: 0, y: 0 });
        setImageSrc(result);
      };
      img.onerror = () => {
        setErrorMsg('Gambar tidak dapat dibaca. Coba pilih file lain.');
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!imageSrc) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: dragStartRef.current.origX + dx,
      y: dragStartRef.current.origY + dy,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const renderCroppedJpeg = (
    img: HTMLImageElement,
    outWidth: number,
    quality: number
  ): string => {
    const outHeight = Math.round(outWidth / aspect);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = outWidth;
    exportCanvas.height = outHeight;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#F7F1E3';
    ctx.fillRect(0, 0, outWidth, outHeight);

    const previewWidth = 480;
    const ratio = outWidth / previewWidth;

    const isRotatedOdd = rotation % 180 !== 0;
    const naturalW = isRotatedOdd ? img.naturalHeight : img.naturalWidth;
    const naturalH = isRotatedOdd ? img.naturalWidth : img.naturalHeight;
    const coverScale = Math.max(outWidth / naturalW, outHeight / naturalH);
    const scale = coverScale * zoom;

    ctx.save();
    ctx.translate(outWidth / 2 + offset.x * ratio, outHeight / 2 + offset.y * ratio);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();

    return exportCanvas.toDataURL('image/jpeg', quality);
  };

  const handleConfirmCrop = async () => {
    const img = imageRef.current;
    if (!img || !imageSrc) {
      setErrorMsg('Unggah gambar terlebih dahulu sebelum menerapkan crop.');
      return;
    }

    const candidates: [number, number][] = [
      [800, 0.78],
      [800, 0.66],
      [720, 0.58],
      [600, 0.52],
    ];
    let dataUrl = '';
    for (const [w, q] of candidates) {
      dataUrl = renderCroppedJpeg(img, w, q);
      if (dataUrl && dataUrl.length <= 480_000) break;
    }

    if (!dataUrl || dataUrl.length > 720_000) {
      setErrorMsg('Ukuran gambar masih terlalu besar untuk disimpan. Pilih gambar lain.');
      return;
    }

    setIsApplying(true);
    setErrorMsg(null);
    try {
      await onApply(dataUrl);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menyimpan gambar hasil crop. Silakan coba lagi.'
      );
    } finally {
      setIsApplying(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cropper-modal-title"
      className="fixed inset-0 z-50 bg-[#0F2B1E]/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="max-w-xl w-full bg-[#FCF9F2] border border-[#173E2C]/20 rounded-3xl p-5 sm:p-7 shadow-xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold text-[#D96B27] mb-1">
              UNGGAH & CROP GAMBAR
            </p>
            <h2 id="cropper-modal-title" className="font-editorial text-2xl font-semibold text-[#173E2C]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela crop gambar"
            className="min-w-[40px] min-h-[40px] rounded-full border border-[#5C3D28]/20 flex items-center justify-center text-[#173E2C] hover:bg-[#E5ECD9]/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-red-950/[0.06] border border-red-800/25 text-red-950 text-xs"
          >
            {errorMsg}
          </div>
        )}

        {/* Upload Trigger */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#173E2C] text-[#F7F1E3] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#0F2B1E] cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#D6A23A]" aria-hidden="true" />
            <span>{imageSrc ? 'Ganti File Gambar' : 'Pilih Gambar dari Perangkat'}</span>
          </button>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F7F1E3] border border-[#5C3D28]/15">
            {ASPECT_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  setAspect(opt.value);
                  setOffset({ x: 0, y: 0 });
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                  Math.abs(aspect - opt.value) < 0.02
                    ? 'bg-[#173E2C] text-[#F7F1E3]'
                    : 'text-[#5C3D28] hover:text-[#173E2C]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Crop Canvas */}
        <div className="relative rounded-2xl overflow-hidden bg-[#0F2B1E] border border-[#5C3D28]/25 flex items-center justify-center min-h-[240px]">
          {!imageSrc ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-14 px-6 text-center text-[#F7F1E3]/80 hover:text-[#F7F1E3] cursor-pointer"
            >
              <Upload className="w-8 h-8 text-[#D6A23A] mx-auto mb-2.5" aria-hidden="true" />
              <p className="text-sm font-semibold">Klik untuk mengunggah foto sajian atau bahan</p>
              <p className="text-xs text-[#C9D8B5]/75 mt-1">
                Format JPG, PNG, atau WebP · Bisa digeser, diperbesar, dan diputar sebelum disimpan
              </p>
            </button>
          ) : (
            <div className="relative w-full flex items-center justify-center bg-[#0F2B1E]">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="max-w-full max-h-[340px] touch-none cursor-grab active:cursor-grabbing block"
              />
              {/* Rule-of-thirds crop guide overlay */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 border-2 border-[#D6A23A]/70 grid grid-cols-3 grid-rows-3"
              >
                {Array.from({ length: 9 }).map((_, idx) => (
                  <div key={idx} className="border border-[#F7F1E3]/15" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Zoom & Rotate Controls */}
        {imageSrc && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-2xl bg-[#F7F1E3]/80 border border-[#5C3D28]/15">
            <label className="flex items-center gap-3 flex-1 min-w-[180px] text-xs font-semibold text-[#173E2C]">
              <ZoomIn className="w-4 h-4 text-[#D96B27] shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap">Zoom ({zoom.toFixed(1)}×)</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-[#173E2C] cursor-pointer"
              />
            </label>

            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#5C3D28]/25 bg-white text-xs font-semibold text-[#173E2C] inline-flex items-center gap-1.5 hover:bg-[#E5ECD9]/60 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Putar 90°</span>
            </button>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#5C3D28]/15">
          <button
            type="button"
            disabled={isApplying}
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-full border border-[#173E2C]/25 text-[#173E2C] text-sm font-semibold hover:bg-[#E5ECD9]/60 cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void handleConfirmCrop()}
            disabled={!imageSrc || isApplying}
            className="min-h-[44px] px-6 py-2 rounded-full bg-[#173E2C] text-[#F7F1E3] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#0F2B1E] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4 text-[#D6A23A]" aria-hidden="true" />
            <span>{isApplying ? 'Menyimpan Gambar...' : 'Simpan Hasil Crop'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
