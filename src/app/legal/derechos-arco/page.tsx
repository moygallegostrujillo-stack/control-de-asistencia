// ============================================================
// src/app/legal/derechos-arco/page.tsx
//   Formulario para que el empleado ejerza sus Derechos ARCO.
//   LFPDPPP arts. 22-36, 100.
//
//   Cuatro tipos de solicitud:
//     ACCESS         — Quiero saber qué datos tienen de mí.
//     RECTIFICATION  — Quiero corregir datos inexactos.
//     CANCELLATION   — Quiero que supriman mis datos ("olvido").
//     OPPOSITION     — Me opongo a cierto tratamiento.
//
//   Esta página es accesible sin haber aceptado el Aviso de Privacidad
//   (es derecho del titular, previo al consentimiento).
// ============================================================

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArcoForm } from '@/components/legal/arco-form';
import { Shield, FileText, Edit, Trash2, Ban } from 'lucide-react';

export const metadata = {
  title: 'Derechos ARCO — Control de Asistencia',
  description: 'Ejercicio de los derechos ARCO (LFPDPPP)',
};

export default function DerechosArcoPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">
              Derechos ARCO
            </h1>
          </div>
          <p className="text-muted-foreground">
            Conforme a los artículos 22 a 36 de la LFPDPPP, usted puede
            ejercer sus derechos de Acceso, Rectificación, Cancelación y
            Oposición sobre sus datos personales.
          </p>
        </div>

        <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>⏱️ Plazo legal de respuesta:</strong> 20 días hábiles
              desde la recepción de la solicitud (art. 100 LFPDPPP). La
              resolución se le notificará por correo electrónico.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-blue-600" />
                Acceso (art. 29)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Conocer qué datos personales tenemos de usted. Puede
                descargarlos inmediatamente sin necesidad de solicitud
                formal:
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link href="/api/user/mydata" target="_blank" download>
                  Descargar mis datos (JSON)
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Edit className="h-4 w-4 text-amber-600" />
                Rectificación (art. 30)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Corregir datos personales inexactos o incompletos.
                Indique qué campo y el valor correcto.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trash2 className="h-4 w-4 text-red-600" />
                Cancelación (art. 31)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Solicitar la supresión de sus datos personales.
              </p>
              <Badge variant="destructive" className="mt-2 text-xs">
                ⚠️ Conflicto legal LFPDPPP vs LFT art. 804
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Los registros de asistencia se conservan anonimizados por
                12 meses (art. 804 LFT). Se suprimirán datos identificativos
                (email, IP, UA, MFA), pero la jornada queda como evidencia
                probatoria sin identidad.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Ban className="h-4 w-4 text-purple-600" />
                Oposición (art. 32)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Oponerse al tratamiento para finalidades específicas
                (ej. estadísticas, marketing). No afecta su relación laboral.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Presentar solicitud formal</CardTitle>
          </CardHeader>
          <CardContent>
            <ArcoForm />
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-between">
          <Button asChild variant="outline">
            <Link href="/legal/aviso-de-privacidad">← Aviso de Privacidad</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
