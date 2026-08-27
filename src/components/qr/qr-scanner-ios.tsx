'use client';

// Escáner QR para iOS/Safari usando cámara nativa del iPhone.
// html5-qrcode no decodifica QR en iOS Safari. Este componente usa
// <input type="file" capture="environment"> que abre la cámara nativa.

import { useRef, useState } from 'react';
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
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo crear contexto');
      const maxDim = 1500;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.floor(w * scale);
        h = Math.floor(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      // BarcodeDetector nativo (iOS 16.4+)
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
          // continuar al mensaje
        }
      }

      const msg = 'No se pudo leer el QR. Intenta acercarte más o usa modo Manual.';
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
