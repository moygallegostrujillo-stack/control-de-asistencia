'use client';

// Escáner QR para iOS/Safari usando cámara nativa del iPhone.
// Toma una foto del QR y la decodifica con BarcodeDetector nativo
// (iOS 16.4+) o jsQR como fallback, intentando múltiples tamaños.

import { useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface QrScannerIOSProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function QrScannerIOS({ onScan, onError, className }: QrScannerIOSProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [decoding, setDecoding] = useState(false);

  const tryDecode = (canvas: HTMLCanvasElement): string | null => {
    // Intento 1: BarcodeDetector nativo (iOS 16.4+)
    const BD = (window as any).BarcodeDetector;
    if (BD) {
      try {
        const detector = new BD({ formats: ['qr_code'] });
        // BarcodeDetector.detect es async, pero no podemos await aquí.
        // Se maneja separadamente abajo.
      } catch {
        // continuar a jsQR
      }
    }
    return null;
  };

  const handleFile = async (file: File) => {
    setDecoding(true);
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      });

      // Canvas a tamaño original (con tope de 2000px)
      const maxDim = 2000;
      let ow = img.width;
      let oh = img.height;
      if (ow > maxDim || oh > maxDim) {
        const scale = maxDim / Math.max(ow, oh);
        ow = Math.floor(ow * scale);
        oh = Math.floor(oh * scale);
      }

      // Intento 1: BarcodeDetector nativo con imagen original
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo crear contexto');
      canvas.width = ow;
      canvas.height = oh;
      ctx.drawImage(img, 0, 0, ow, oh);
      URL.revokeObjectURL(url);

      const BD = (window as any).BarcodeDetector;
      if (BD) {
        try {
          const detector = new BD({ formats: ['qr_code'] });
          const barcodes = await detector.detect(canvas);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            onScan(barcodes[0].rawValue);
            return;
          }
        } catch {
          // continuar a jsQR
        }
      }

      // Intento 2: jsQR con imagen original
      try {
        const imageData = ctx.getImageData(0, 0, ow, oh);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) {
          onScan(code.data);
          return;
        }
      } catch {
        // continuar
      }

      // Intento 3: jsQR con escalado a 1000px (mejor para QR densos)
      for (const targetDim of [1000, 800, 600, 500, 400, 1200, 1500]) {
        const scale = targetDim / Math.max(ow, oh);
        if (scale === 1) continue; // ya intentamos tamaño original
        const sw = Math.floor(ow * scale);
        const sh = Math.floor(oh * scale);
        const smallCanvas = document.createElement('canvas');
        const smallCtx = smallCanvas.getContext('2d');
        if (!smallCtx) continue;
        smallCanvas.width = sw;
        smallCanvas.height = sh;
        smallCtx.drawImage(img, 0, 0, sw, sh);
        try {
          const imageData = smallCtx.getImageData(0, 0, sw, sh);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code && code.data) {
            onScan(code.data);
            return;
          }
        } catch {
          // continuar
        }
      }

      // Si llegamos aquí, no se pudo decodificar
      const msg = 'No se pudo leer el QR. Intenta acercarte más, mejorar la iluminación, o usa el modo Manual.';
      toast.error('QR no detectado', { description: msg });
      onError?.(msg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al procesar';
      toast.error('Error', { description: msg });
      onError?.(msg);
    } finally {
      setDecoding(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
        id="ios-qr-input"
      />
      <Button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={decoding}
        className="w-full h-14 text-base gap-2"
      >
        {decoding ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Leyendo QR…
          </>
        ) : (
          <>
            <Camera className="w-5 h-5" />
            Escanear QR con cámara
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Al presionar se abre la cámara de tu iPhone. Toma una foto clara del QR del terminal.
      </p>
    </div>
  );
}
