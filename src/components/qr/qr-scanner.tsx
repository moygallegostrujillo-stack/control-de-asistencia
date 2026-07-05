'use client';

// ============================================================
// QrScanner — Escáner de cámara QR reutilizable (html5-qrcode)
// ---
// Componente genérico de UI: se encarga ÚNICAMENTE de pedir
// permiso de cámara, mostrar el preview y llamar `onScan` cuando
// decodifica un código. NO contiene lógica de negocio (validar
// tokens, llamar a la API, etc.).
//
// Diseño:
// - 'use client' obligatorio (accede a navigator.mediaDevices).
// - iOS Safari requiere gesture del usuario → el inicio de la
//   cámara se dispara desde un botón (no automático).
// - Por defecto `autoStop=true` detiene la cámara tras el primer
//   decode exitoso (evita duplicados). El componente permanece
//   montado y se puede re-iniciar con el botón «Iniciar cámara».
// - Limpia recursos (stop + clear) en `useEffect` cleanup.
// - Sin colores azul/índigo: paleta emerald/slate/zinc.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Camera,
  CameraOff,
  RotateCcw,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface QrScannerProps {
  /** Se llama con el texto decodificado del QR. */
  onScan: (decodedText: string) => void;
  /** Se llama cuando ocurre un error fatal de cámara (no transient). */
  onError?: (error: string) => void;
  /** Clases extra para el wrapper externo. */
  className?: string;
  /**
   * Si `true` (default), detiene la cámara automáticamente tras el
   * primer decode exitoso. El componente sigue montado y el usuario
   * puede volver a pulsar «Iniciar cámara» para un nuevo escaneo.
   */
  autoStop?: boolean;
}

type CameraFacing = 'environment' | 'user';

// Estado interno de Html5Qrcode (https://github.com/mebjas/html5-qrcode#getState)
// 0 = NOT_STARTED, 1 = PAUSED, 2 = SCANNING, 3 = STOPPED.
const STATE_SCANNING = 2;
const STATE_PAUSED = 1;

const SCANNER_ELEMENT_ID = 'qr-reader-container';

export function QrScanner({
  onScan,
  onError,
  className,
  autoStop = true,
}: QrScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacing>('environment');
  const [supported, setSupported] = useState<boolean | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);

  // Refs vivos para que el callback interno de html5-qrcode siempre
  // vea las últimas props sin reiniciar la cámara.
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  const autoStopRef = useRef(autoStop);
  const facingModeRef = useRef(facingMode);

  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
    autoStopRef.current = autoStop;
  }, [onScan, onError, autoStop]);

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  // ---------- detección de capacidades ----------
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      setSupported(false);
      return;
    }
    const hasGetUserMedia = !!(
      navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'
    );
    const isSecureContext = window.isSecureContext;
    const ok = hasGetUserMedia && isSecureContext;
    setSupported(ok);
    if (!ok) {
      // No lanzamos toast aquí para no molestar en SSR o cuando el
      // usuario nunca intenta escanear. El botón «Iniciar cámara»
      // mostrará el mensaje adecuado.
      // (Lo hacemos igual si el contexto es inseguro porque es un
      // error silencioso común en staging.)
      if (!isSecureContext) {
        toast.error('La cámara requiere conexión HTTPS');
      } else if (!hasGetUserMedia) {
        toast.error('No se encontró cámara en este dispositivo');
      }
    }
  }, []);

  // ---------- limpieza al desmontar ----------
  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (!scanner) return;
      try {
        const state = scanner.getState?.();
        if (state === STATE_SCANNING || state === STATE_PAUSED) {
          scanner.stop().catch(() => {});
        }
        scanner.clear();
      } catch {
        // noop
      }
      scannerRef.current = null;
    };
  }, []);

  // ---------- helpers ----------
  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) {
      setIsScanning(false);
      return;
    }
    try {
      const state = scanner.getState?.();
      if (state === STATE_SCANNING || state === STATE_PAUSED) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // probablemente ya estaba detenido — ignorar
    } finally {
      scannerRef.current = null;
      setIsScanning(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (isStarting || isScanning) return;

    if (typeof window === 'undefined' || !window.isSecureContext) {
      const msg = 'La cámara requiere conexión HTTPS';
      toast.error(msg);
      onErrorRef.current?.(msg);
      return;
    }
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      const msg = 'No se encontró cámara en este dispositivo';
      toast.error(msg);
      onErrorRef.current?.(msg);
      return;
    }

    setIsStarting(true);
    try {
      if (scannerRef.current) {
        await stopCamera();
      }

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: facingModeRef.current },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.333,
        },
        (decodedText) => {
          // Anti-duplicado: ignorar el mismo código en <1.5s.
          const now = Date.now();
          const last = lastScanRef.current;
          if (last && last.text === decodedText && now - last.at < 1500) {
            return;
          }
          lastScanRef.current = { text: decodedText, at: now };
          try {
            onScanRef.current(decodedText);
          } finally {
            if (autoStopRef.current) {
              // Detener en background; no bloquea el callback.
              stopCamera().catch(() => {});
            }
          }
        },
        // Per-frame error callback — usualmente transitorio, ignorar.
        () => undefined,
      );
      setIsScanning(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'No se pudo acceder a la cámara';
      if (/Permission|NotAllowed/i.test(message)) {
        toast.error('Necesitas permitir acceso a la cámara', {
          description: 'Revisa los permisos del navegador y vuelve a intentarlo.',
        });
      } else if (/NotFound|DevicesNotFound|NotFoundError|Overconstrained/i.test(message)) {
        toast.error('No se encontró cámara en este dispositivo');
      } else if (/NotReadable|TrackStart|AbortError/i.test(message)) {
        toast.error('La cámara está siendo usada por otra aplicación');
      } else if (/HTTPS|secure/i.test(message)) {
        toast.error('La cámara requiere conexión HTTPS');
      } else {
        toast.error('Error al iniciar la cámara', { description: message });
      }
      onErrorRef.current?.(message);

      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch {
          // noop
        }
        scannerRef.current = null;
      }
      setIsScanning(false);
    } finally {
      setIsStarting(false);
    }
  }, [isStarting, isScanning, stopCamera]);

  const flipCamera = useCallback(async () => {
    // Cambiar de cámara requiere detener y reiniciar.
    await stopCamera();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    // El efecto de facingModeRef se actualiza sincrónicamente con el
    // setState, pero para garantizar el orden usamos un microtask.
    setTimeout(() => {
      startCamera();
    }, 60);
  }, [stopCamera, startCamera]);

  return (
    <div className={cn('w-full max-w-md mx-auto space-y-3', className)}>
      {/* Marco de preview — el div interno con id es requerido por html5-qrcode. */}
      <div
        className={cn(
          'relative rounded-xl overflow-hidden border-2 bg-zinc-900',
          isScanning ? 'border-emerald-400' : 'border-zinc-200',
          'aspect-[4/3]',
        )}
      >
        <div
          id={SCANNER_ELEMENT_ID}
          className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
        />

        {/* Overlay con marco de escaneo animado (solo mientras escanea) */}
        {isScanning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative w-[62%] aspect-square">
              <div className="absolute -top-px -left-px w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <div className="absolute -top-px -right-px w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <div className="absolute -bottom-px -left-px w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <div className="absolute -bottom-px -right-px w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
              <motion.div
                className="absolute left-0 right-0 h-0.5 bg-emerald-400"
                style={{ boxShadow: '0 0 8px 2px rgba(16,185,129,0.7)' }}
                initial={{ top: '0%' }}
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </div>
        )}

        {/* Overlay idle / loading / error */}
        {!isScanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900/85 text-zinc-100 p-4 text-center">
            {isStarting ? (
              <>
                <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
                <p className="text-sm">Iniciando cámara…</p>
              </>
            ) : supported === false ? (
              <>
                <AlertTriangle className="w-7 h-7 text-amber-400" />
                <p className="text-sm font-medium">Cámara no disponible</p>
                <p className="text-xs text-zinc-400 max-w-xs">
                  {typeof window !== 'undefined' && !window.isSecureContext
                    ? 'La cámara requiere conexión HTTPS para funcionar.'
                    : 'No se detectó una cámara accesible en este dispositivo.'}
                </p>
              </>
            ) : (
              <>
                <Camera className="w-7 h-7 text-emerald-400" />
                <p className="text-sm font-medium">Cámara detenida</p>
                <p className="text-xs text-zinc-400">
                  Pulsa «Iniciar cámara» para escanear un código QR.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {!isScanning ? (
          <Button
            type="button"
            onClick={startCamera}
            disabled={isStarting || supported === false}
            className="gap-2"
          >
            {isStarting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            Iniciar cámara
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            onClick={stopCamera}
            className="gap-2"
          >
            <CameraOff className="w-4 h-4" />
            Detener cámara
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={flipCamera}
          disabled={isStarting || supported === false}
          className="gap-2"
          title="Cambiar entre cámara frontal y trasera"
        >
          <RotateCcw className="w-4 h-4" />
          {facingMode === 'environment' ? 'Trasera' : 'Frontal'}
        </Button>
      </div>
    </div>
  );
}

export default QrScanner;
