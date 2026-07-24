// ============================================================
// src/app/legal/aviso-de-privacidad/page.tsx
//   Página pública del Aviso de Privacidad (LFPDPPP art. 16).
//
//   ⚠️ NO es texto legal definitivo. Es estructura + placeholders.
//   El texto final DEBE ser redactado por un abogado mexicano y
//   registrado en el REPS (Registro de Personas Acreditadas) del INAI
//   antes de salir a producción.
//
//   Esta página cumple con la estructura mínima del art. 16 LFPDPPP.
// ============================================================

import Link from 'next/link';
import { CURRENT_PRIVACY_VERSION } from '@/lib/privacy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PrivacyConsent } from '@/components/legal/privacy-consent';

export const metadata = {
  title: 'Aviso de Privacidad — Control de Asistencia NOM-037',
  description: 'Aviso de Privacidad conforme a la LFPDPPP',
};

export default function AvisoPrivacidadPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const params = searchParams instanceof Promise
    ? { required: undefined }
    : (searchParams as { required?: string });
  // En Next.js 16, searchParams es sincrónico en server components pero el
  // tipo incluye Promise para compatibilidad. Lo manejamos con await al final.
  return <AvisoContent required={params.required === '1'} />;
}

async function AvisoContent({ required }: { required: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Aviso de Privacidad
            </h1>
            <p className="text-muted-foreground mt-1">
              Conforme a la Ley Federal de Protección de Datos Personales
              en Posesión de los Particulares (LFPDPPP)
            </p>
          </div>
          <Badge variant="secondary">Versión {CURRENT_PRIVACY_VERSION}</Badge>
        </div>

        {required && (
          <Card className="mb-6 border-amber-400 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                <strong>⚠️ Acceso restringido.</strong> Para continuar usando
                el sistema debe leer y aceptar el Aviso de Privacidad. Si
                rechaza, no podrá acceder a las funcionalidades de control
                de asistencia (LFPDPPP art. 17).
              </p>
            </CardContent>
          </Card>
        )}

        <ScrollArea className="h-[60vh] rounded-md border p-6 bg-card">
          <article className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            {/* Sección 1 — Identidad y domicilio del responsable (art. 16 fr. I) */}
            <section>
              <h2 className="text-xl font-semibold mb-2">
                1. Identidad y Domicilio del Responsable
              </h2>
              <p className="text-muted-foreground">
                <strong>Responsable del tratamiento:</strong>{' '}
                [REDACTAR_POR_ABOGADO — razón social de la empresa cliente, ej. "Mi Empresa S.A. de C.V."]
              </p>
              <p className="text-muted-foreground">
                <strong>Domicilio:</strong>{' '}
                [REDACTAR_POR_ABOGADO — domicilio fiscal completo]
              </p>
              <p className="text-muted-foreground">
                <strong>Representante legal:</strong>{' '}
                [REDACTAR_POR_ABOGADO]
              </p>
              <p className="text-muted-foreground">
                <strong>Encargado de Datos Personales (DPO):</strong>{' '}
                [REDACTAR_POR_ABOGADO — nombre y correo del DPO designado]
              </p>
            </section>

            {/* Sección 2 — Finalidades del tratamiento (art. 16 fr. II) */}
            <section>
              <h2 className="text-xl font-semibold mb-2">
                2. Finalidades del Tratamiento
              </h2>
              <p className="font-medium mb-2">Finalidades primarias (no requieren consentimiento adicional):</p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Registro electrónico de asistencia conforme a la NOM-037-STPS-2023 y art. 132 fracc. XXXIV LFT.</li>
                <li>Cálculo de nómina, horas extra (art. 66/68 LFT) y prima por descanso trabajado (art. 73 LFT).</li>
                <li>Cumplimiento de obligaciones laborales y de seguridad social (IMSS, INFONAVIT).</li>
                <li>Conservación de registros por 12 meses (art. 804 LFT).</li>
              </ul>
              <p className="font-medium mt-4 mb-2">Finalidades secundarias (requieren consentimiento, pueden rechazarse sin afectar la prestación del servicio):</p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Estadísticas internas de productividad y asistencia por sucursal.</li>
                <li>Reportes comparativos entre sucursales para análisis gerencial.</li>
                <li>[REDACTAR_POR_ABOGADO — otras finalidades secundarias específicas de la empresa]</li>
              </ul>
            </section>

            {/* Sección 3 — Datos personales recabados (art. 16 fr. III) */}
            <section>
              <h2 className="text-xl font-semibold mb-2">
                3. Datos Personales Recabados
              </h2>
              <p className="mb-2">El sistema trata los siguientes datos personales:</p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li><strong>Identificativos:</strong> nombre completo, correo electrónico, número de empleado, puesto, departamento.</li>
                <li><strong>Laborales:</strong> sucursal asignada, fecha de ingreso, salario base, saldo de vacaciones.</li>
                <li><strong>Geolocalización:</strong> latitud/longitud GPS en cada registro de entrada/salida (cuando el empleado autoriza el permiso del navegador).</li>
                <li><strong>Técnicos:</strong> dirección IP, User-Agent del dispositivo, en cada operación de check-in/out.</li>
                <li><strong>Autenticación:</strong> hash de contraseña (bcrypt), secret TOTP para MFA, códigos de respaldo hasheados.</li>
                <li><strong>Sensibles:</strong> [VERIFICAR CON ABOGADO — el sistema NO recaba datos de salud directamente, pero si se justifica una incapacidad médica, el motivo podría contener información sensible y requerir consentimiento expreso por escrito separado].</li>
              </ul>
            </section>

            {/* Sección 4 — Opciones para limitar uso/divulgación (art. 16 fr. IV) */}
            <section>
              <h2 className="text-xl font-semibold mb-2">
                4. Opciones para Limitar el Uso o Divulgación
              </h2>
              <p className="text-muted-foreground">
                Puede limitar el uso de sus datos personales para finalidades
                secundarias enviando un correo a{' '}
                <a href="mailto:[REDACTAR_POR_ABOGADO]" className="text-primary underline">
                  [REDACTAR_POR_ABOGADO]
                </a>{' '}
                indicando qué finalidades rechaza. El ejercicio del derecho
                de oposición no afecta su relación laboral ni el cumplimiento
                de las finalidades primarias.
              </p>
            </section>

            {/* Sección 5 — Medios para ejercer derechos ARCO (art. 16 fr. V) */}
            <section>
              <h2 className="text-xl font-semibold mb-2">
                5. Medios para Ejercer los Derechos ARCO
              </h2>
              <p className="text-muted-foreground mb-2">
                Puede ejercer sus derechos de Acceso, Rectificación,
                Cancelación y Oposición (LFPDPPP arts. 22-36) a través de:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>
                  <strong>Portal web:</strong>{' '}
                  <Link
                    href="/legal/derechos-arco"
                    className="text-primary underline"
                  >
                    Formulario electrónico de Derechos ARCO
                  </Link>
                </li>
                <li><strong>Correo electrónico:</strong> [REDACTAR_POR_ABOGADO]</li>
                <li><strong>Presencial:</strong> [REDACTAR_POR_ABOGADO — domicilio donde acudir con identificación oficial]</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                El plazo legal de respuesta es de 20 días hábiles (art. 100
                LFPDPPP). La resolución se le notificará por el mismo medio
                por el que presentó la solicitud.
              </p>
            </section>

            {/* Sección 6 — Transferencias (art. 16 fr. VI) */}
            <section>
              <h2 className="text-xl font-semibold mb-2">
                6. Transferencias de Datos
              </h2>
              <p className="text-muted-foreground">
                Sus datos personales se transfieren a las siguientes terceras
                partes, en los términos del art. 37 LFPDPPP:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li><strong>Supabase Inc.</strong> (Estados Unidos) — hospedaje de base de datos PostgreSQL. Transferencia amparada por Cláusulas Contractuales Tipo y Certificación Privacy Shield.</li>
                <li><strong>Vercel Inc.</strong> (Estados Unidos) — hospedaje de la aplicación Next.js.</li>
                <li><strong>IMSS / INFONAVIT</strong> — transferencias obligatorias por ley (art. 37 fr. II LFPDPPP).</li>
                <li><strong>STPS</strong> — en caso de visita inspectiva (art. 37 fr. II).</li>
                <li>[REDACTAR_POR_ABOGADO — cualquier otro proveedor: Stripe para nómina, etc.]</li>
              </ul>
            </section>

            {/* Sección 7 — Medidas de seguridad (art. 16 fr. VII implícita) */}
            <section>
              <h2 className="text-xl font-semibold mb-2">
                7. Medidas de Seguridad
              </h2>
              <p className="text-muted-foreground">
                El responsable mantiene medidas de seguridad técnicas,
                administrativas y físicas razonables para proteger sus datos
                personales contra uso, acceso, divulgación o alteración no
                autorizada (LFPDPPP art. 17 fr. IV), incluyendo:
                cifrado TLS en tránsito, hashing bcrypt para contraseñas,
                JWT firmados con HMAC-SHA512, MFA TOTP opcional, bitácora
                inmutable de auditoría (AuditLog), y anonimización tras el
                periodo de retención legal.
              </p>
            </section>

            {/* Sección 8 — Conservación (art. 12 + LFT art. 804) */}
            <section>
              <h2 className="text-xl font-semibold mb-2">
                8. Conservación y Supresión
              </h2>
              <p className="text-muted-foreground">
                Conforme al art. 12 LFPDPPP, sus datos personales se
                conservarán durante el tiempo necesario para cumplir con
                las finalidades del tratamiento y, en todo caso, durante
                el plazo legal aplicable:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Registros de asistencia: <strong>12 meses</strong> posteriores a la terminación de la relación laboral (art. 804 LFT).</li>
                <li>Direcciones IP y User-Agent: <strong>anonimizados</strong> a los 12 meses (se conserva el registro probatorio sin identidad).</li>
                <li>Datos de autenticación: <strong>suprimidos inmediatamente</strong> tras el cese del usuario.</li>
                <li>Bitácoras de auditoría: <strong>24 meses</strong> [VERIFICAR CON ABOGADO — el plazo de conservación de logs administrativos puede variar].</li>
              </ul>
            </section>

            {/* Sección 9 — Cambios al aviso (art. 17) */}
            <section>
              <h2 className="text-xl font-semibold mb-2">
                9. Cambios al Aviso de Privacidad
              </h2>
              <p className="text-muted-foreground">
                El responsable se reserva el derecho de modificar este aviso
                para adaptarlo a novedades legislativas o jurisprudenciales,
                así como a prácticas de la industria. Cualquier modificación
                se le notificará a través del sistema y se le solicitará
                nuevo consentimiento expreso si la versión vigente cambia
                (LFPDPPP art. 17, principio de lealtad). La versión actual
                es <strong>{CURRENT_PRIVACY_VERSION}</strong>.
              </p>
            </section>

            <hr className="my-6" />
            <p className="text-xs text-muted-foreground italic">
              Este documento es una plantilla de estructura conforme a los
              artículos 16 y 17 de la LFPDPPP. El texto legal definitivo debe
              ser redactado por un abogado mexicano colegiado y, según el
              caso, registrado ante el INAI. Los marcadores
              [REDACTAR_POR_ABOGADO] indican secciones que requieren
              información específica de la empresa responsable.
            </p>
          </article>
        </ScrollArea>

        {/* Componente de consentimiento — solo se muestra si hay sesión */}
        <PrivacyConsent />

        <div className="mt-6 flex justify-between">
          <Button asChild variant="outline">
            <Link href="/">Volver al inicio</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/legal/derechos-arco">Ejercer Derechos ARCO →</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
