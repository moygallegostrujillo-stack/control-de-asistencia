'use client';

// ============================================================
// src/components/legal/arco-form.tsx
//   Formulario cliente para crear una solicitud ARCO.
//   POST /api/user/arco/request
// ============================================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

type ArcoType = 'ACCESS' | 'RECTIFICATION' | 'CANCELLATION' | 'OPPOSITION';

const TYPE_LABELS: Record<ArcoType, string> = {
  ACCESS: 'Acceso — Quiero saber qué datos tienen de mí',
  RECTIFICATION: 'Rectificación — Quiero corregir datos inexactos',
  CANCELLATION: 'Cancelación — Quiero que supriman mis datos',
  OPPOSITION: 'Oposición — Me opongo a cierto tratamiento',
};

export function ArcoForm() {
  const [type, setType] = useState<ArcoType>('ACCESS');
  const [reason, setReason] = useState('');
  const [fields, setFields] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() && type !== 'ACCESS') {
      toast.error('Debe indicar el motivo de su solicitud.');
      return;
    }
    setLoading(true);
    try {
      const details: Record<string, unknown> = {};
      if (reason.trim()) details.reason = reason.trim();
      if (fields.trim()) details.fields = fields.split(',').map((s) => s.trim()).filter(Boolean);

      const res = await fetch('/api/user/arco/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, details }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al enviar la solicitud');
      }
      const data = await res.json();
      toast.success(data.message || 'Solicitud enviada correctamente.');
      setReason('');
      setFields('');
    } catch (e: any) {
      toast.error(e.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-sm font-medium mb-2 block">
          Tipo de solicitud
        </Label>
        <RadioGroup
          value={type}
          onValueChange={(v) => setType(v as ArcoType)}
          className="grid grid-cols-1 gap-2"
        >
          {(Object.keys(TYPE_LABELS) as ArcoType[]).map((t) => (
            <Card key={t} className={`p-3 cursor-pointer border ${type === t ? 'border-primary bg-primary/5' : ''}`}>
              <div className="flex items-start gap-3">
                <RadioGroupItem value={t} id={`arco-${t}`} className="mt-1" />
                <label htmlFor={`arco-${t}`} className="text-sm cursor-pointer flex-1">
                  {TYPE_LABELS[t]}
                </label>
              </div>
            </Card>
          ))}
        </RadioGroup>
      </div>

      {type === 'RECTIFICATION' && (
        <div>
          <Label htmlFor="fields" className="text-sm font-medium mb-1 block">
            Campos a rectificar (separados por coma)
          </Label>
          <input
            id="fields"
            type="text"
            value={fields}
            onChange={(e) => setFields(e.target.value)}
            placeholder="ej. nombre, email, posición"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm"
          />
        </div>
      )}

      <div>
        <Label htmlFor="reason" className="text-sm font-medium mb-1 block">
          Motivo / Detalles {type === 'ACCESS' ? '(opcional)' : '(requerido)'}
        </Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            type === 'CANCELLATION'
              ? 'Indique el motivo de la cancelación. Recuerde: los registros de asistencia se conservarán anonimizados por 12 meses (art. 804 LFT).'
              : type === 'RECTIFICATION'
              ? 'Indique el valor correcto de los campos a rectificar.'
              : type === 'OPPOSITION'
              ? 'Indique a qué finalidad del tratamiento se opone.'
              : 'Indique qué información específica desea conocer.'
          }
          rows={4}
          maxLength={2000}
        />
      </div>

      {type === 'CANCELLATION' && (
        <Card className="p-3 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <p className="text-xs text-amber-900 dark:text-amber-100">
            <strong>⚠️ Aviso legal:</strong> el ejercicio del derecho de
            cancelación anonimizará sus datos personales identificativos
            (nombre, email, IP, contraseñas). Los registros de asistencia
            se conservarán <strong>anonimizados</strong> por 12 meses
            posteriores a la terminación de su relación laboral, conforme
            al art. 804 LFT. Esta acción es <strong>irreversible</strong>.
          </p>
        </Card>
      )}

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        Enviar solicitud
      </Button>
    </form>
  );
}
