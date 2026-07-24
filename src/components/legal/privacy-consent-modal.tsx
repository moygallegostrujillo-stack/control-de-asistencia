'use client';

// ============================================================
// src/components/legal/privacy-consent-modal.tsx
//   Modal obligatorio que bloquea la app si el usuario NO ha
//   aceptado el Aviso de Privacidad (o si la versión cambió).
//
//   Se monta en el layout principal. Hace polling a
//   /api/user/privacy/status al montar; si hasAccepted=false
//   o needsReaccept=true → abre el modal.
//
//   No se puede cerrar sin aceptar. Si rechaza → logout.
// ============================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface PrivacyStatus {
  hasAccepted: boolean;
  currentVersion: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  needsReaccept: boolean;
}

export function PrivacyConsentModal() {
  const router = useRouter();
  const [status, setStatus] = useState<PrivacyStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cargar el estado al montar. Si no hay sesión, no se hace nada
  // (el middleware redirige a /legal/aviso-de-privacidad directamente).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/user/privacy/status');
        if (!res.ok) return; // silencioso si no hay sesión
        const data: PrivacyStatus = await res.json();
        if (cancelled) return;
        setStatus(data);
        setOpen(!data.hasAccepted);
      } catch {
        // silencioso
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAccept() {
    if (!accepted || !status) {
      toast.error('Debe marcar la casilla de aceptación.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/user/privacy/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: status.currentVersion }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al registrar consentimiento');
      }
      toast.success('Consentimiento registrado. Cargando…');
      setOpen(false);
      // Recarga completa para que TODAS las queries (React Query) se
      // refresquen con el JWT nuevo que ya tiene privacyAccepted=true.
      // router.refresh() solo re-renderiza server components y no
      // invalida el cache de cliente; un reload sí garantiza que las
      // peticiones bloqueadas (attendance, etc.) se reintenten.
      if (typeof window !== 'undefined') {
        window.location.reload();
      } else {
        router.refresh();
      }
    } catch (e: any) {
      toast.error(e.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    try {
      // Usar /api/auth/logout (ruta pública, funciona siempre) en lugar
      // de /api/auth/signout que puede no existir.
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      toast.info('Consentimiento rechazado. Sesión cerrada.');
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  // No renderizar el modal si ya aceptó.
  if (!status || status.hasAccepted) return null;

  const isReaccept = status.needsReaccept;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setOpen(true)}>
      {/* onOpenChange: NO permitir cerrar clicando fuera */}
      <DialogContent
        className="sm:max-w-[600px]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <DialogTitle className="text-lg">
              {isReaccept
                ? 'Hemos actualizado el Aviso de Privacidad'
                : 'Aviso de Privacidad — Consentimiento requerido'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {isReaccept ? (
              <>
                La versión del Aviso de Privacidad cambió ({status.acceptedVersion} →{' '}
                <Badge variant="secondary" className="text-xs">
                  v{status.currentVersion}
                </Badge>
                ). Debe revisarlo y prestar su consentimiento nuevamente para
                continuar usando el sistema (LFPDPPP art. 17, principio de lealtad).
              </>
            ) : (
              <>
                Para usar el sistema de Control de Asistencia debe leer y
                aceptar el Aviso de Privacidad conforme a la LFPDPPP
                (Ley Federal de Protección de Datos Personales en Posesión
                de los Particulares). Si rechaza, no podrá acceder.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-4 my-2 max-h-[200px] overflow-y-auto text-sm text-muted-foreground">
          <p className="mb-2">
            El sistema trata datos personales identificativos (nombre, email,
            número de empleado), laborales (puesto, sucursal, salario, vacaciones),
            de geolocalización (GPS en check-in/out) y técnicos (IP, User-Agent),
            conforme a las finalidades descritas en el aviso.
          </p>
          <p>
            Sus datos se conservan por 12 meses post-terminación laboral
            (art. 804 LFT). Puede ejercer sus derechos ARCO en cualquier
            momento. La aceptación se registra con IP, fecha y versión para
            evidencia INAI.
          </p>
        </div>

        <Button asChild variant="link" className="self-start h-auto p-0">
          <a href="/legal/aviso-de-privacidad" target="_blank" rel="noopener">
            Leer aviso completo <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </Button>

        <div className="flex items-start gap-3 mt-2">
          <Checkbox
            id="modal-accept"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
            disabled={loading}
          />
          <label htmlFor="modal-accept" className="text-sm cursor-pointer">
            He leído y acepto el Aviso de Privacidad (versión {status.currentVersion}).
            Presto mi consentimiento de manera libre, informada y expresa.
          </label>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={loading}
          >
            Rechazar y salir
          </Button>
          <Button
            onClick={handleAccept}
            disabled={loading || !accepted}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Aceptar y continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
