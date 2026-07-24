'use client';

// ============================================================
// src/components/legal/privacy-consent.tsx
//   Componente de consentimiento para la página /legal/aviso-de-privacidad.
//   - Checkbox "He leído y acepto el Aviso de Privacidad".
//   - Botón Aceptar (verde) y Rechazar (rojo).
//   - Llama a POST /api/user/privacy/accept.
//   - Si el usuario rechaza → logout y redirige a /.
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Check, X, FileText } from 'lucide-react';
import { toast } from 'sonner';

export function PrivacyConsent() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    if (!accepted) {
      toast.error('Debe marcar la casilla de aceptación para continuar.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/user/privacy/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: '1.0' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al registrar el consentimiento');
      }
      toast.success('Consentimiento registrado. Redirigiendo…');
      router.refresh();
      setTimeout(() => router.push('/'), 800);
    } catch (e: any) {
      toast.error(e.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    try {
      // Usar /api/auth/logout (ruta pública) en lugar de /api/auth/signout.
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      toast.info('Consentimiento rechazado. Sesión cerrada.');
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="privacy-accept"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
            disabled={loading}
          />
          <label
            htmlFor="privacy-accept"
            className="text-sm leading-relaxed cursor-pointer select-none"
          >
            He leído y acepto el Aviso de Privacidad. Entiendo que mis datos
            personales serán tratados conforme a la LFPDPPP y a las finalidades
            descritas en el aviso. Presto mi consentimiento de manera libre,
            informada y expresa (art. 17 LFPDPPP).
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-end">
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={loading}
            className="order-2 sm:order-1"
          >
            <X className="h-4 w-4 mr-2" />
            Rechazar y salir
          </Button>
          <Button
            onClick={handleAccept}
            disabled={loading || !accepted}
            className="order-1 sm:order-2 bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Aceptar y continuar
          </Button>
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <FileText className="h-3 w-3" />
          Si rechaza, no podrá acceder al sistema. La aceptación se registra
          con fecha, hora, IP y versión del aviso (evidencia INAI).
        </p>
      </CardContent>
    </Card>
  );
}
