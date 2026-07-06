'use client';

// ============================================================
// QrCameraScanner — Escáner de QR con cámara
// ============================================================
// Estrategia dual para máxima compatibilidad y rendimiento:
//  1. BarcodeDetector API nativa (Chrome/Edge Android, Safari 17+)
//     — sin librerías externas, decodificación nativa muy rápida.
//  2. Fallback a html5-qrcode vía dynamic import() (resto de navegadores).
// Fuerza facingMode: 'environment' (cámara trasera). Al decodificar,
// llama onScan(decodedText) y detiene la cámara automáticamente.
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface QrCameraScannerProps {
  onScan: (decodedText: string) => boolean | void;
  onError?: (error: string) => void;
  width?: number;
  height?: number;
}

const NATIVE_VIDEO_ID = 'qr-scanner-native-video';
const HTML5_REGION_ID = 'qr-scanner-html5-region';

export function QrCameraScanner({
  onScan,
  onError,
  width = 360,
  height = 360,
}: QrCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const html5ScannerRef = useRef<any>(null);
  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'native' | 'html5' | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      streamRef.current = null;
    }
  }, []);

  const stop = useCallback(async () => {
    runningRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (html5ScannerRef.current) {
      try {
        if (html5ScannerRef.current.isScanning) {
          await html5ScannerRef.current.stop();
        }
        await html5ScannerRef.current.clear();
      } catch {}
      html5ScannerRef.current = null;
    }
    stopTracks();
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch {}
    }
    setMode(null);
    setRunning(false);
  }, [stopTracks]);

  const handleScanResult = useCallback((text: string) => {
    const shouldStop = onScanRef.current(text);
    if (shouldStop !== false) {
      stop();
    }
  }, [stop]);

  // --- Estrategia 2: html5-qrcode vía dynamic import (fallback) ---
  const startHtml5QrcodeDecoding = useCallback(async () => {
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(HTML5_REGION_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
      });
      html5ScannerRef.current = scanner;
      setMode('html5');

      // Antes de que html5-qrcode inicie su propio stream, liberar el nuestro
      stopTracks();
      if (videoRef.current) {
        try { videoRef.current.srcObject = null; } catch {}
      }

      // Enumerar cámaras y usar deviceId de la cámara trasera (evita el error
      // "Only 'facingMode' and 'deviceId' are supported for 'cameraIdOrConfig'"
      // que ocurre en algunos navegadores móviles al pasar { facingMode: 'environment' })
      let cameraId: string | { facingMode: string } = { facingMode: 'environment' };
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const back = cameras.find((c) => /back|rear|environment/i.test(c.label || ''));
          cameraId = back?.id || cameras[cameras.length - 1].id;
        }
      } catch (e) {
        console.warn('Camera enumeration failed, falling back to facingMode:', e);
      }

      await scanner.start(
        cameraId,
        {
          fps: 10,
          qrbox: (vw: number, vh: number) => {
            const min = Math.min(vw, vh);
            const size = Math.min(400, Math.floor(min * 0.8));
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
        },
        (decodedText: string) => {
          handleScanResult(decodedText);
        },
        () => {
          // Errores por frame son normales — ignorar
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('No se pudo iniciar el decodificador: ' + msg);
      onError?.('No se pudo iniciar el decodificador: ' + msg);
      toast.error('No se pudo iniciar el decodificador QR', { description: msg });
      await stop();
    }
  }, [handleScanResult, stopTracks, stop, onError]);

  // --- Estrategia 1: BarcodeDetector nativo (primario) ---
  const startNativeDecoding = useCallback(async (video: HTMLVideoElement) => {
    let detector: any;
    try {
      detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    } catch {
      // Si no se puede crear, caer a html5-qrcode
      await startHtml5QrcodeDecoding();
      return;
    }
    setMode('native');

    const tick = async () => {
      if (!runningRef.current) return;
      try {
        if (video.readyState >= 2) {
          const barcodes = await detector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const text = barcodes[0].rawValue;
            if (text) {
              handleScanResult(text);
              return;
            }
          }
        }
      } catch {
        // Frame no decodificable — continuar
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [handleScanResult, startHtml5QrcodeDecoding]);

  const start = useCallback(async () => {
    if (running || starting) return;
    setStarting(true);
    setError(null);

    try {
      const useNative = 'BarcodeDetector' in window;
      if (useNative) {
        // Path nativo: getUserMedia + BarcodeDetector
        // Enumerar cámaras para usar deviceId de la trasera (más confiable que facingMode)
        let videoConstraints: MediaTrackConstraints = {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        };
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videos = devices.filter((d) => d.kind === 'videoinput');
          if (videos.length > 0) {
            const back = videos.find((d) => /back|rear|environment/i.test(d.label || ''));
            const backId = back?.deviceId || videos[videos.length - 1].deviceId;
            if (backId) {
              videoConstraints = {
                deviceId: { exact: backId },
                width: { ideal: 1280 },
                height: { ideal: 1280 },
              };
            }
          }
        } catch (e) {
          console.warn('Camera enumeration failed, using facingMode:', e);
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
        streamRef.current = stream;

        const video = document.getElementById(NATIVE_VIDEO_ID) as HTMLVideoElement | null;
        if (!video) throw new Error('Elemento de video no encontrado');
        videoRef.current = video;
        video.srcObject = stream;
        await video.play();
        runningRef.current = true;
        setRunning(true);
        await startNativeDecoding(video);
      } else {
        // Path fallback: html5-qrcode gestiona su propio stream
        runningRef.current = true;
        setRunning(true);
        await startHtml5QrcodeDecoding();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      let friendly = msg;
      if (/permission|denied|notallowed/i.test(msg)) {
        friendly = 'Permiso de cámara denegado. Habilita la cámara en el navegador.';
      } else if (/notfound|nofound|no camera/i.test(msg)) {
        friendly = 'No se encontró ninguna cámara en este dispositivo.';
      } else if (/insecure|https|origin/i.test(msg)) {
        friendly = 'La cámara requiere conexión HTTPS (no funciona en HTTP).';
      }
      setError(friendly);
      onError?.(friendly);
      toast.error('No se pudo iniciar la cámara', { description: friendly });
      await stop();
    } finally {
      setStarting(false);
    }
  }, [running, starting, stop, onError, startNativeDecoding, startHtml5QrcodeDecoding]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (html5ScannerRef.current) {
        try {
          if (html5ScannerRef.current.isScanning) {
            html5ScannerRef.current.stop().then(() => html5ScannerRef.current.clear()).catch(() => {});
          } else {
            html5ScannerRef.current.clear().catch(() => {});
          }
        } catch {}
        html5ScannerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        style={{ width: `${width}px`, maxWidth: '100%', height: `${height}px` }}
        className="relative rounded-lg overflow-hidden border-2 border-zinc-200 bg-zinc-900"
      >
        {/* Video para BarcodeDetector nativo */}
        <video
          id={NATIVE_VIDEO_ID}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: mode === 'html5' ? 'none' : 'block' }}
        />
        {/* Contenedor para html5-qrcode (fallback) */}
        <div
          id={HTML5_REGION_ID}
          className="absolute inset-0 w-full h-full"
          style={{ display: mode === 'html5' ? 'block' : 'none' }}
        />

        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 gap-2 pointer-events-none">
            {starting ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-xs">Iniciando cámara…</span>
              </>
            ) : error ? (
              <>
                <CameraOff className="h-8 w-8" />
                <span className="text-xs text-center px-4 text-rose-400">{error}</span>
              </>
            ) : (
              <>
                <Camera className="h-8 w-8" />
                <span className="text-xs">Cámara apagada</span>
              </>
            )}
          </div>
        )}
        {running && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className="border-2 border-emerald-400/80 rounded-lg"
              style={{
                width: '70%',
                height: '70%',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
              }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {!running ? (
          <Button
            type="button"
            onClick={() => start()}
            disabled={starting}
            variant="default"
            className="gap-2"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {starting ? 'Iniciando…' : 'Encender cámara'}
          </Button>
        ) : (
          <Button type="button" onClick={stop} variant="outline" className="gap-2">
            <X className="h-4 w-4" /> Detener
          </Button>
        )}
      </div>

      <p className="text-xs text-zinc-400 text-center max-w-xs">
        {running
          ? `Cámara trasera activa · Apunta al QR del terminal${mode ? ` (${mode === 'native' ? 'BarcodeDetector' : 'html5-qrcode'})` : ''}`
          : 'Usa la cámara trasera para mejor enfoque en códigos densos.'}
      </p>
    </div>
  );
}
