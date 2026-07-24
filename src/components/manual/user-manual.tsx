'use client';

// ============================================================
// Manual de Usuario — Control de Asistencia
// ------------------------------------------------------------
// Manual NO técnico, pensado para que cualquier persona que
// usa el sistema (administrador, supervisor o empleado) pueda
// entender cómo funciona y qué puede hacer.
//
// Incluye diagramas visuales construidos con tarjetas y
// flechas, y una sección dedicada al cumplimiento de la
// LFPDPPP (Ley Federal de Protección de Datos Personales en
// Posesión de los Particulares).
// ============================================================

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  BookOpen,
  Shield,
  Users,
  Clock,
  QrCode,
  FileBarChart,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LayoutDashboard,
  CalendarCheck,
  History,
  KeyRound,
  Timer,
  Download,
  Lock,
  HelpCircle,
  ArrowRight,
  ArrowDown,
  Building2,
  UserCheck,
  UserCog,
  User,
  MapPin,
  Coffee,
  PlayCircle,
  StopCircle,
  PauseCircle,
  Plane,
  FileText,
  Scale,
  Eye,
  Edit3,
  Ban,
  XCircle,
  Menu,
  ScanLine,
  Bell,
  Settings as SettingsIcon,
  BarChart3,
  Fingerprint,
  FileCheck2,
  Trash2,
  Hand,
  Info,
  ClipboardCheck,
  Lightbulb,
} from 'lucide-react';

// ==================== ÍNDICE DE SECCIONES ====================
const SECCIONES = [
  { id: 'bienvenida', titulo: '1. Bienvenida', icon: BookOpen },
  { id: 'primeros-pasos', titulo: '2. Tus primeros pasos', icon: LogIn },
  { id: 'roles', titulo: '3. ¿Qué puedes hacer según tu rol?', icon: Users },
  { id: 'empleado', titulo: '4. Guía para empleados', icon: User },
  { id: 'administrador', titulo: '5. Guía para administradores', icon: UserCog },
  { id: 'privacidad', titulo: '6. Tu privacidad y tus datos', icon: Shield },
  { id: 'cumplimiento', titulo: '7. Leyes que cumple el sistema', icon: Scale },
  { id: 'faq', titulo: '8. Preguntas frecuentes', icon: HelpCircle },
  { id: 'glosario', titulo: '9. Glosario', icon: Info },
];

// ==================== COMPONENTES AUXILIARES ====================

/** Tarjeta de sección con encabezado icono + título. */
function Seccion({
  id,
  icon: Icon,
  titulo,
  descripcion,
  children,
  destacada = false,
}: {
  id: string;
  icon: React.ElementType;
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
  destacada?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card
        className={
          destacada
            ? 'border-emerald-200 bg-emerald-50/40'
            : ''
        }
      >
        <CardHeader>
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                destacada
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-900 text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">{titulo}</CardTitle>
              {descripcion && (
                <CardDescription className="mt-1 text-sm leading-relaxed">
                  {descripcion}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </section>
  );
}

/** Caja de texto destacada (tip / advertencia / nota). */
function Nota({
  tipo = 'info',
  titulo,
  children,
}: {
  tipo?: 'info' | 'tip' | 'alerta' | 'ok';
  titulo: string;
  children: React.ReactNode;
}) {
  const estilos = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    tip: 'border-violet-200 bg-violet-50 text-violet-900',
    alerta: 'border-amber-300 bg-amber-50 text-amber-900',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
  const Icon =
    tipo === 'alerta'
      ? AlertTriangle
      : tipo === 'ok'
        ? CheckCircle2
        : tipo === 'tip'
          ? Lightbulb
          : Info;
  return (
    <div className={`flex gap-3 rounded-lg border p-4 ${estilos[tipo]}`}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold mb-1">{titulo}</p>
        <div className="[&_p]:mb-1 [&_p:last-child]:mb-0">{children}</div>
      </div>
    </div>
  );
}

/** Paso numerado dentro de un procedimiento. */
function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white">
        {numero}
      </div>
      <div className="flex-1 pt-0.5">
        <p className="font-medium text-sm text-zinc-900">{titulo}</p>
        <div className="text-sm text-zinc-600 mt-1 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Diagrama de flujo horizontal (para escritorio) / vertical (móvil). */
function Flujo({
  pasos,
}: {
  pasos: { icon: React.ElementType; titulo: string; detalle?: string; color?: string }[];
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-1">
        {pasos.map((paso, i) => {
          const Icon = paso.icon;
          const colorBg = paso.color || 'bg-white';
          return (
            <div key={i} className="contents">
              <div
                className={`flex flex-1 items-center gap-3 rounded-lg border border-zinc-200 ${colorBg} p-3`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 leading-tight">
                    {paso.titulo}
                  </p>
                  {paso.detalle && (
                    <p className="text-xs text-zinc-500 mt-0.5 leading-tight">
                      {paso.detalle}
                    </p>
                  )}
                </div>
              </div>
              {i < pasos.length - 1 && (
                <>
                  <div className="hidden lg:flex items-center px-1">
                    <ArrowRight className="h-5 w-5 text-zinc-400 shrink-0" />
                  </div>
                  <div className="flex lg:hidden items-center justify-center py-0.5">
                    <ArrowDown className="h-4 w-4 text-zinc-400" />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mini-tarjeta de característica para las guías. */
function TarjetaAccion({
  icon: Icon,
  titulo,
  descripcion,
}: {
  icon: React.ElementType;
  titulo: string;
  descripcion: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
        <Icon className="h-4 w-4 text-zinc-700" />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-900">{titulo}</p>
        <p className="text-sm text-zinc-600 mt-0.5 leading-relaxed">
          {descripcion}
        </p>
      </div>
    </div>
  );
}

// ==================== COMPONENTE PRINCIPAL ====================
export function UserManual() {
  const [indiceAbierto, setIndiceAbierto] = useState(false);

  const irA = (id: string) => {
    setIndiceAbierto(false);
    // Usamos scrollTo manual para saltarnos la ambigüedad de contenedores
    // anidados con overflow-auto (scrollIntoView no siempre llega al destino).
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const headerOffset = 96; // altura aproximada del header fijo + margen
      const y =
        el.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    });
  };

  return (
    <div className="relative">
      {/* ====== Botón de índice (móvil) ====== */}
      <div className="lg:hidden mb-4">
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => setIndiceAbierto((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <Menu className="h-4 w-4" />
            Índice del manual
          </span>
          <ArrowDown
            className={`h-4 w-4 transition-transform ${indiceAbierto ? 'rotate-180' : ''}`}
          />
        </Button>
        {indiceAbierto && (
          <Card className="mt-2">
            <CardContent className="p-2">
              <nav className="flex flex-col">
                {SECCIONES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => irA(s.id)}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                  >
                    <s.icon className="h-4 w-4 text-zinc-400" />
                    {s.titulo}
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex gap-6">
        {/* ====== Índice lateral (escritorio) ====== */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-20">
            <Card>
              <CardContent className="p-3">
                <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Contenido
                </p>
                <nav className="flex flex-col gap-0.5">
                  {SECCIONES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => irA(s.id)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      <s.icon className="h-3.5 w-3.5 text-zinc-400" />
                      {s.titulo}
                    </button>
                  ))}
                </nav>
                <Separator className="my-3" />
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5"
                >
                  <a
                    href="/documentos/manual-usuario-v3.0.pdf"
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Versión PDF
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* ====== Contenido principal ====== */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* Portada */}
          <Card className="overflow-hidden border-zinc-900">
            <div className="bg-zinc-900 p-8 text-white">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-2">
                <BookOpen className="h-4 w-4" />
                Manual de Usuario
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Sistema de Control de Asistencia
              </h1>
              <p className="mt-2 text-zinc-300 max-w-2xl leading-relaxed">
                Esta guía te explica, en palabras sencillas, cómo usar el
                sistema para registrar tu asistencia, solicitar vacaciones,
                revisar reportes y proteger tus datos personales.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className="bg-emerald-600 hover:bg-emerald-600">
                  Cumple LFPDPPP
                </Badge>
                <Badge className="bg-amber-600 hover:bg-amber-600">
                  NOM-037-STPS-2023
                </Badge>
                <Badge className="bg-rose-600 hover:bg-rose-600">
                  NOM-035-STPS
                </Badge>
                <Badge className="bg-sky-700 hover:bg-sky-700">
                  Reforma LFT 2027
                </Badge>
              </div>
            </div>
          </Card>

          {/* ============ 1. BIENVENIDA ============ */}
          <Seccion
            id="bienvenida"
            icon={BookOpen}
            titulo="Bienvenida"
            descripcion="Conoce para qué sirve el sistema y quién puede usarlo."
          >
            <div className="space-y-4 text-sm leading-relaxed text-zinc-700">
              <p>
                El <strong>Sistema de Control de Asistencia</strong> es una
                herramienta que permite a las empresas registrar de manera
                electrónica la entrada y salida de sus empleados, llevar un
                historial ordenado de las jornadas de trabajo, gestionar
                vacaciones y permisos, y generar reportes para el pago de
                nómina — todo cumpliendo con las leyes mexicanas vigentes.
              </p>
              <p>
                A diferencia de un reloj checador de papel, este sistema
                guarda cada registro con <strong>fecha, hora y ubicación</strong>,
                calcula automáticamente las horas extra y los tiempos de
                comida, y mantiene todo seguro en la nube. Además, respeta tu
                derecho a la <strong>privacidad</strong> y te permite acceder a
                tus propios datos cuando lo necesites.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <TarjetaAccion
                icon={Clock}
                titulo="Registro de asistencia"
                descripcion="Marca tu entrada, salida, comida y descansos con un clic."
              />
              <TarjetaAccion
                icon={Plane}
                titulo="Vacaciones y permisos"
                descripcion="Pide días libres y sigue el estado de tu solicitud."
              />
              <TarjetaAccion
                icon={Shield}
                titulo="Tus datos protegidos"
                descripcion="Decides cómo se usan tus datos personales y puedes consultarlos."
              />
            </div>

            <Nota tipo="ok" titulo="¿Para quién es este manual?">
              <p>
                Para todas las personas que usan el sistema: empleados,
                supervisores, administradores de sucursal y administradores
                generales. No necesitas conocimientos técnicos.
              </p>
            </Nota>
          </Seccion>

          {/* ============ 2. PRIMEROS PASOS ============ */}
          <Seccion
            id="primeros-pasos"
            icon={LogIn}
            titulo="Tus primeros pasos"
            descripcion="Cómo entras al sistema por primera vez y qué debes hacer antes de empezar."
          >
            {/* 2.1 Iniciar sesión */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <LogIn className="h-4 w-4 text-zinc-500" />
                Iniciar sesión
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Paso numero={1} titulo="Abre la página del sistema">
                  Ingresa desde tu navegador a la dirección que te indicó tu
                  empresa. Puedes hacerlo desde una computadora, tablet o
                  teléfono.
                </Paso>
                <Paso numero={2} titulo="Escribe tu correo y contraseña">
                  Usa el correo y la contraseña que te asignó el
                  administrador. Si olvidaste tu contraseña, pídele al
                  administrador que te la restablezca.
                </Paso>
                <Paso numero={3} titulo="¡Bienvenido!">
                  Al entrar verás el panel principal. Dependiendo de tu rol,
                  verás distintas opciones en el menú.
                </Paso>
              </div>
            </div>

            <Separator />

            {/* 2.2 Aviso de privacidad */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <Shield className="h-4 w-4 text-emerald-600" />
                El Aviso de Privacidad
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                La primera vez que entres (y cada vez que el aviso se
                actualice), verás una ventana que te pide{' '}
                <strong>aceptar el Aviso de Privacidad</strong>. Esto es un
                requisito de la{' '}
                <strong>Ley Federal de Protección de Datos Personales en
                Posesión de los Particulares (LFPDPPP)</strong>, que protege
                tu información personal.
              </p>
              <Flujo
                pasos={[
                  {
                    icon: LogIn,
                    titulo: 'Entras al sistema',
                    detalle: 'Primer inicio de sesión',
                  },
                  {
                    icon: Shield,
                    titulo: 'Lees el aviso',
                    detalle: 'Qué datos se usan y para qué',
                    color: 'bg-emerald-50 border-emerald-200',
                  },
                  {
                    icon: CheckCircle2,
                    titulo: 'Aceptas o rechazas',
                    detalle: 'Tu decisión queda registrada',
                    color: 'bg-emerald-50 border-emerald-200',
                  },
                  {
                    icon: LayoutDashboard,
                    titulo: 'Usas el sistema',
                    detalle: 'Solo si aceptaste',
                  },
                ]}
              />
              <Nota tipo="alerta" titulo="Si rechazas el aviso">
                <p>
                  No podrás usar ninguna función del sistema (registrar
                  asistencia, ver reportes, etc.). La ley exige que aceptes
                  antes de que se traten tus datos personales. Si tienes dudas
                  sobre el aviso, consulta la sección{' '}
                  <button
                    className="underline font-medium"
                    onClick={() => irA('privacidad')}
                  >
                    Tu privacidad y tus datos
                  </button>
                  .
                </p>
              </Nota>
            </div>

            <Separator />

            {/* 2.3 Verificación en dos pasos */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <Fingerprint className="h-4 w-4 text-zinc-500" />
                Verificación en dos pasos (opcional pero recomendada)
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                La verificación en dos pasos (también llamada{' '}
                <strong>MFA</strong>) añade una capa extra de seguridad a tu
                cuenta. Aunque no es obligatoria,{' '}
                <strong>te recomendamos activarla</strong>, sobre todo si eres
                administrador.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TarjetaAccion
                  icon={KeyRound}
                  titulo="¿Cómo funciona?"
                  descripcion="Además de tu contraseña, pides un código de 6 dígitos que genera una app como Google Authenticator. El código cambia cada 30 segundos."
                />
                <TarjetaAccion
                  icon={FileText}
                  titulo="Códigos de respaldo"
                  descripcion="Al activarla, el sistema te da códigos de emergencia. Guárdalos en un lugar seguro por si pierdes tu teléfono."
                />
              </div>
              <Nota tipo="tip" titulo="Consejo">
                <p>
                  Puedes activar la verificación en dos pasos desde{' '}
                  <strong>Configuración</strong> dentro del sistema. Si pierdes
                  tu teléfono, comunícate con el administrador para que
                  restablezca tu acceso.
                </p>
              </Nota>
            </div>
          </Seccion>

          {/* ============ 3. ROLES ============ */}
          <Seccion
            id="roles"
            icon={Users}
            titulo="¿Qué puedes hacer según tu rol?"
            descripcion="El sistema muestra distintas opciones según el rol que tengas asignado."
          >
            <p className="text-sm text-zinc-700 leading-relaxed">
              Existen <strong>4 roles</strong>. Cada uno puede hacer cosas
              distintas. Así se mantiene el orden y la seguridad de la
              información.
            </p>

            {/* Tarjetas de roles */}
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="border-zinc-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">
                      Administrador General
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-zinc-600 space-y-2">
                  <p>Es el responsable de toda la empresa.</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Ve el panel de todas las sucursales</li>
                    <li>Dar de alta, editar y eliminar empleados</li>
                    <li>Crea sucursales y usuarios</li>
                    <li>Aprueba vacaciones y corrige asistencias</li>
                    <li>Genera todos los reportes</li>
                    <li>Configura la empresa y ve la auditoría</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-amber-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white">
                      <UserCog className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">
                      Administrador de Sucursal
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-zinc-600 space-y-2">
                  <p>Encargado de una sucursal en específico.</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Ve el panel de su sucursal</li>
                    <li>Dar de alta y editar empleados de su sucursal</li>
                    <li>Aprueba vacaciones de su equipo</li>
                    <li>Corrige asistencias y justifica faltas</li>
                    <li>Genera reportes de su sucursal</li>
                    <li>Usa la terminal QR en modo kiosco</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-sky-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-700 text-white">
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">Supervisor</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-zinc-600 space-y-2">
                  <p>Revisa la información, pero no la modifica.</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Ve el panel y el historial de su sucursal</li>
                    <li>Consulta reportes y la auditoría</li>
                    <li>Puede solicitar sus propias vacaciones</li>
                    <li>Usa la terminal QR en modo kiosco</li>
                    <li>No puede crear, editar ni eliminar información</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-emerald-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                      <User className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">Empleado</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-zinc-600 space-y-2">
                  <p>Usa el sistema para registrar su propia asistencia.</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Registra su entrada, salida, comida y descansos</li>
                    <li>Ve su propio historial</li>
                    <li>Solicita vacaciones y permisos</li>
                    <li>Ve y usa su código QR personal</li>
                    <li>Descarga sus propios datos (Derecho de Acceso)</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Nota tipo="info" titulo="¿No ves una opción que esperabas?">
              <p>
                Probablemente tu rol no tiene permiso para usarla. Habla con
                el administrador general si crees que necesitas acceso a algo
                más.
              </p>
            </Nota>
          </Seccion>

          {/* ============ 4. GUÍA PARA EMPLEADOS ============ */}
          <Seccion
            id="empleado"
            icon={User}
            titulo="Guía para empleados"
            descripcion="Cómo registrar tu asistencia, revisar tu historial, pedir vacaciones y usar tu QR."
          >
            <p className="text-sm text-zinc-700 leading-relaxed">
              Si eres empleado, al entrar al sistema verás cuatro secciones en
              la parte inferior: <strong>Asistencia</strong>,{' '}
              <strong>Historial</strong>, <strong>Vacaciones</strong> y{' '}
              <strong>QR</strong>.
            </p>

            {/* 4.1 Registrar asistencia */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <Clock className="h-4 w-4 text-emerald-600" />
                Registrar tu asistencia
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                En la pestaña <strong>Asistencia</strong> encuentras los
                botones para marcar tu jornada. Así funciona un día normal:
              </p>
              <Flujo
                pasos={[
                  {
                    icon: PlayCircle,
                    titulo: 'Entrada',
                    detalle: 'Al empezar tu jornada',
                    color: 'bg-emerald-50 border-emerald-200',
                  },
                  {
                    icon: Coffee,
                    titulo: 'Salida a comer',
                    detalle: 'Pausa de comida',
                    color: 'bg-amber-50 border-amber-200',
                  },
                  {
                    icon: PlayCircle,
                    titulo: 'Regreso de comer',
                    detalle: 'Fin de la pausa',
                    color: 'bg-amber-50 border-amber-200',
                  },
                  {
                    icon: StopCircle,
                    titulo: 'Salida',
                    detalle: 'Al terminar tu día',
                    color: 'bg-rose-50 border-rose-200',
                  },
                ]}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Paso numero={1} titulo="Abre la pestaña Asistencia">
                  Toca el icono de reloj en la parte inferior.
                </Paso>
                <Paso numero={2} titulo="Toca el botón correspondiente">
                  &ldquo;Registrar entrada&rdquo;, &ldquo;Salida a comer&rdquo;,
                  etc. El botón que puedes usar se ilumina según el momento
                  del día.
                </Paso>
                <Paso numero={3} titulo="Permite ver tu ubicación">
                  El sistema te pedirá permiso para guardar tu ubicación. Esto
                  sirve para comprobar que estás en tu sucursal (lo exige la
                  NOM-037). Puedes rechazarlo, pero el registro quedará sin
                  ubicación.
                </Paso>
                <Paso numero={4} titulo="¡Listo!">
                  Verás la hora registrada y un mensaje de confirmación. Tu
                  administrador puede ver el registro en tiempo real.
                </Paso>
              </div>
              <Nota tipo="info" titulo="Pausa para descanso">
                <p>
                  Además de la pausa de comida, puedes marcar una{' '}
                  <strong>pausa para descanso</strong> breve si tu jornada lo
                  permite. El sistema descuenta automáticamente ese tiempo de
                  tu jornada total.
                </p>
              </Nota>
            </div>

            <Separator />

            {/* 4.2 Historial */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <History className="h-4 w-4 text-zinc-500" />
                Tu historial de asistencia
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                En la pestaña <strong>Historial</strong> puedes revisar todos
                tus registros pasados: qué días trabajaste, cuántas horas, si
                tuviste pausas, y si faltaste o llegaste tarde. Es tu registro
                personal y nadie más que tú (y los administradores) puede
                verlo.
              </p>
              <TarjetaAccion
                icon={Eye}
                titulo="¿Para qué te sirve?"
                descripcion="Para comprobar que tus horas estén correctas antes del pago de nómina, y para llevar un control de tus días trabajados."
              />
            </div>

            <Separator />

            {/* 4.3 Vacaciones y permisos */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <Plane className="h-4 w-4 text-sky-600" />
                Solicitar vacaciones y permisos
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                En la pestaña <strong>Vacaciones</strong> puedes pedir días
                libres. El sistema lleva el conteo de los días que te
                corresponden y te muestra cuántos te quedan.
              </p>
              <Flujo
                pasos={[
                  {
                    icon: Plane,
                    titulo: 'Pides vacaciones',
                    detalle: 'Eliges las fechas',
                    color: 'bg-sky-50 border-sky-200',
                  },
                  {
                    icon: Bell,
                    titulo: 'Tu jefe recibe aviso',
                    detalle: 'Revisa tu solicitud',
                    color: 'bg-amber-50 border-amber-200',
                  },
                  {
                    icon: CheckCircle2,
                    titulo: 'Aprueba o rechaza',
                    detalle: 'Te llega la respuesta',
                    color: 'bg-emerald-50 border-emerald-200',
                  },
                  {
                    icon: CalendarCheck,
                    titulo: 'Se descuentan los días',
                    detalle: 'Solo si se aprueban',
                    color: 'bg-emerald-50 border-emerald-200',
                  },
                ]}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <TarjetaAccion
                  icon={Plane}
                  titulo="Vacaciones"
                  descripcion="Días libres pagados que te corresponden por ley. El sistema lleva el saldo automáticamente."
                />
                <TarjetaAccion
                  icon={FileText}
                  titulo="Permisos"
                  descripcion="Ausencias justificadas (médicas, familiares, etc.). Puedes adjuntar el motivo."
                />
              </div>
              <Nota tipo="tip" titulo="Consejo">
                <p>
                  Pide tus vacaciones con anticipación. El sistema avisa a tu
                  supervisor en cuanto envías la solicitud, pero es buena
                  práctica avisarle también en persona.
                </p>
              </Nota>
            </div>

            <Separator />

            {/* 4.4 Mi QR */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <QrCode className="h-4 w-4 text-zinc-700" />
                Tu código QR
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                En la pestaña <strong>QR</strong> encuentras un código
                personal que cambia cada poco tiempo. Lo puedes usar para
                registrar tu asistencia en una terminal o kiosco (por ejemplo,
                si no traes tu teléfono o prefieres no usarlo).
              </p>
              <Flujo
                pasos={[
                  {
                    icon: QrCode,
                    titulo: 'Abres tu QR',
                    detalle: 'En tu teléfono',
                    color: 'bg-zinc-50 border-zinc-300',
                  },
                  {
                    icon: ScanLine,
                    titulo: 'Lo escaneas',
                    detalle: 'En la terminal de la sucursal',
                    color: 'bg-zinc-50 border-zinc-300',
                  },
                  {
                    icon: CheckCircle2,
                    titulo: 'Se registra',
                    detalle: 'Entrada o salida',
                    color: 'bg-emerald-50 border-emerald-200',
                  },
                ]}
              />
              <Nota tipo="alerta" titulo="No compartas tu QR">
                <p>
                  Tu código es personal e intransferible. Si lo compartes,
                  otra persona podría registrar asistencia a tu nombre, lo cual
                  es una falta grave. El código cambia automáticamente para
                  evitar copias.
                </p>
              </Nota>
            </div>
          </Seccion>

          {/* ============ 5. GUÍA PARA ADMINISTRADORES ============ */}
          <Seccion
            id="administrador"
            icon={UserCog}
            titulo="Guía para administradores"
            descripcion="Las funciones que verás en el menú si eres administrador o supervisor."
          >
            <p className="text-sm text-zinc-700 leading-relaxed">
              Al entrar como administrador o supervisor verás un menú lateral
              con varias secciones. Aquí te explicamos cada una.
            </p>

            {/* 5.1 Panel */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <LayoutDashboard className="h-4 w-4 text-zinc-500" />
                Panel (Dashboard)
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Es la pantalla de inicio. Muestra un resumen del día: cuántos
                empleados están activos, quiénes llegaron, quiénes faltaron y
                alertas que requieren tu atención. El administrador general ve
                todas las sucursales; el de sucursal, solo la suya.
              </p>
            </div>

            <Separator />

            {/* 5.2 Empleados */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <Users className="h-4 w-4 text-zinc-500" />
                Empleados
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Aquí gestionas a las personas de tu sucursal. Puedes{' '}
                <strong>dar de alta</strong> un empleado nuevo,{' '}
                <strong>editar</strong> sus datos (puesto, departamento,
                salario), <strong>transferirlo</strong> a otra sucursal o{' '}
                <strong>eliminarlo</strong> si ya no trabaja ahí.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <TarjetaAccion
                  icon={UserCheck}
                  titulo="Dar de alta"
                  descripcion="Capturas nombre, puesto, sucursal y datos laborales. El sistema crea su acceso."
                />
                <TarjetaAccion
                  icon={Edit3}
                  titulo="Editar"
                  descripcion="Cambias puesto, departamento, horario o salario."
                />
                <TarjetaAccion
                  icon={ArrowRight}
                  titulo="Transferir"
                  descripcion="Mueves al empleado a otra sucursal conservando su historial."
                />
                <TarjetaAccion
                  icon={Trash2}
                  titulo="Eliminar"
                  descripcion="Solo el administrador general. Los registros se conservan por ley 12 meses."
                />
              </div>
            </div>

            <Separator />

            {/* 5.3 Vacaciones y permisos */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <CalendarCheck className="h-4 w-4 text-zinc-500" />
                Vacaciones y permisos
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Aquí llegan las solicitudes de vacaciones y permisos de tu
                equipo. Puedes <strong>aprobarlas</strong> o{' '}
                <strong>rechazarlas</strong>. Al aprobar, los días se
                descuentan automáticamente del saldo del empleado.
              </p>
              <Flujo
                pasos={[
                  {
                    icon: Bell,
                    titulo: 'Llega la solicitud',
                    detalle: 'Aparece en tu lista',
                    color: 'bg-amber-50 border-amber-200',
                  },
                  {
                    icon: Eye,
                    titulo: 'La revisas',
                    detalle: 'Fechas y motivo',
                  },
                  {
                    icon: CheckCircle2,
                    titulo: 'Apruebas',
                    detalle: 'O rechazas',
                    color: 'bg-emerald-50 border-emerald-200',
                  },
                  {
                    icon: Bell,
                    titulo: 'Se avisa al empleado',
                    detalle: 'Recibe la respuesta',
                    color: 'bg-emerald-50 border-emerald-200',
                  },
                ]}
              />
            </div>

            <Separator />

            {/* 5.4 Historial */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <History className="h-4 w-4 text-zinc-500" />
                Historial de asistencia
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Aquí ves todos los registros de asistencia de tus empleados,
                filtrados por fecha, sucursal o persona. Puedes{' '}
                <strong>corregir</strong> un registro si hubo un error (por
                ejemplo, si alguien olvidó marcar la salida) y{' '}
                <strong>justificar</strong> una falta (enfermedad, permiso
                especial). Toda corrección queda registrada en la auditoría.
              </p>
            </div>

            <Separator />

            {/* 5.5 Reportes */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <FileBarChart className="h-4 w-4 text-zinc-500" />
                Reportes
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                El sistema genera reportes listos para usar en el pago de
                nómina y para auditorías. Los puedes exportar en Excel o PDF.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <TarjetaAccion
                  icon={FileText}
                  titulo="Reporte diario"
                  descripcion="Quién entró, quién faltó y quién llegó tarde en un día específico."
                />
                <TarjetaAccion
                  icon={Ban}
                  titulo="Ausencias"
                  descripcion="Lista de faltas injustificadas en un periodo."
                />
                <TarjetaAccion
                  icon={AlertTriangle}
                  titulo="Incidencias"
                  descripcion="Llegadas tarde, salidas anticipadas, omisiones."
                />
                <TarjetaAccion
                  icon={Timer}
                  titulo="Horas extra"
                  descripcion="Horas trabajadas después de la jornada, con cálculo de pago doble y triple."
                />
                <TarjetaAccion
                  icon={FileCheck2}
                  titulo="Formato STPS"
                  descripcion="Reporte listo para una visita de inspección de la Secretaría del Trabajo."
                />
                <TarjetaAccion
                  icon={BarChart3}
                  titulo="Comparativo"
                  descripcion="Compara asistencia entre sucursales (solo administrador general)."
                />
              </div>
              <Nota tipo="ok" titulo="Cumplimiento garantizado">
                <p>
                  Los reportes están diseñados para cumplir con la{' '}
                  <strong>Reforma a la Ley Federal del Trabajo (LFT) de
                  2027</strong> y la <strong>NOM-037-STPS-2023</strong>. Si
                  una autoridad laboral te los pide, ya están en el formato
                  correcto.
                </p>
              </Nota>
            </div>

            <Separator />

            {/* 5.6 Terminal QR */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <ScanLine className="h-4 w-4 text-zinc-500" />
                Terminal QR (modo kiosco)
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Puedes convertir una tablet o computadora en una{' '}
                <strong>terminal de registro</strong> que los empleados usan
                al entrar y salir. Cada empleado escanea su QR personal y el
                sistema registra la asistencia. Es ideal para la entrada de la
                sucursal.
              </p>
              <Flujo
                pasos={[
                  {
                    icon: SettingsIcon,
                    titulo: 'Activas el kiosco',
                    detalle: 'En una pantalla fija',
                  },
                  {
                    icon: QrCode,
                    titulo: 'El empleado muestra su QR',
                    detalle: 'Desde su teléfono',
                    color: 'bg-zinc-50 border-zinc-300',
                  },
                  {
                    icon: ScanLine,
                    titulo: 'La terminal lo lee',
                    detalle: 'Cámara o lector',
                    color: 'bg-zinc-50 border-zinc-300',
                  },
                  {
                    icon: CheckCircle2,
                    titulo: 'Registro confirmado',
                    detalle: 'Entrada o salida',
                    color: 'bg-emerald-50 border-emerald-200',
                  },
                ]}
              />
            </div>

            <Separator />

            {/* 5.7 Auditoría */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <ClipboardCheck className="h-4 w-4 text-zinc-500" />
                Auditoría
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Es un registro <strong>inmutable</strong> (no se puede borrar
                ni modificar) de todo lo que pasa en el sistema: quién entró,
                quién cambió qué dato, quién aprobó qué solicitud. Sirve para
                resolver disputas y para auditorías de la autoridad laboral.
              </p>
              <Nota tipo="info" titulo="¿Por qué es importante?">
                <p>
                  Si un empleado dice que sí marcó su asistencia y el sistema
                  no lo muestra, la auditoría es la prueba definitiva de qué
                  pasó. La ley laboral exige que estos registros no puedan
                  alterarse (art. 804 LFT).
                </p>
              </Nota>
            </div>

            <Separator />

            {/* 5.8 Empresa y configuración */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <SettingsIcon className="h-4 w-4 text-zinc-500" />
                Empresa y configuración
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Aquí el administrador general ajusta los datos de la empresa
                (nombre, logo), las sucursales (dirección y{' '}
                <strong>geocerca</strong> — el área dentro de la cual un
                empleado puede registrar asistencia), los días festivos, los
                horarios de trabajo y los usuarios del sistema.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <TarjetaAccion
                  icon={Building2}
                  titulo="Sucursales"
                  descripcion="Dirección y geocerca (radio permitido para registrar asistencia)."
                />
                <TarjetaAccion
                  icon={CalendarCheck}
                  titulo="Días festivos"
                  descripcion="Días no laborables oficiales. El sistema los respeta al calcular faltas."
                />
                <TarjetaAccion
                  icon={Clock}
                  titulo="Horarios"
                  descripcion="Jornada, hora de entrada y salida, tiempo de comida."
                />
                <TarjetaAccion
                  icon={Users}
                  titulo="Usuarios"
                  descripcion="Cuentas de acceso del personal administrativo y sus roles."
                />
              </div>
            </div>

            <Separator />

            {/* 5.9 Alertas NOM-035 */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <Bell className="h-4 w-4 text-rose-600" />
                Alertas NOM-035
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                La <strong>NOM-035-STPS</strong> identifica factores de riesgo
                psicosocial en el trabajo. El sistema detecta automáticamente
                situaciones que podrían indicar estrés o sobrecarga — por
                ejemplo, jornadas muy largas, demasiadas horas extra o falta
                de descansos — y te avisa para que puedas prevenir problemas.
              </p>
            </div>
          </Seccion>

          {/* ============ 6. PRIVACIDAD ============ */}
          <Seccion
            id="privacidad"
            icon={Shield}
            titulo="Tu privacidad y tus datos"
            descripcion="Cómo protege el sistema tu información personal y qué derechos tienes."
            destacada
          >
            <p className="text-sm text-zinc-700 leading-relaxed">
              El sistema cumple con la{' '}
              <strong>Ley Federal de Protección de Datos Personales en
              Posesión de los Particulares (LFPDPPP)</strong>. Esta ley
              obliga a las empresas a cuidar tu información personal y a
              respetar tus derechos. Aquí te explicamos, sin tecnicismos, qué
              hace el sistema para cumplir.
            </p>

            {/* 6.1 Qué datos guardamos */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <Lock className="h-4 w-4 text-emerald-600" />
                ¿Qué datos guardamos y para qué?
              </h3>
              <div className="overflow-x-auto rounded-lg border border-zinc-200">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-zinc-700">
                        Dato
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-zinc-700">
                        Para qué se usa
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    <tr>
                      <td className="px-4 py-2 font-medium">Nombre y correo</td>
                      <td className="px-4 py-2 text-zinc-600">
                        Identificarte y comunicarnos contigo.
                      </td>
                    </tr>
                    <tr className="bg-zinc-50/50">
                      <td className="px-4 py-2 font-medium">Puesto y sucursal</td>
                      <td className="px-4 py-2 text-zinc-600">
                        Asignarte permisos y calcular tu nómina.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-medium">
                        Registros de asistencia
                      </td>
                      <td className="px-4 py-2 text-zinc-600">
                        Cumplir con la ley laboral (LFT art. 804).
                      </td>
                    </tr>
                    <tr className="bg-zinc-50/50">
                      <td className="px-4 py-2 font-medium">Ubicación GPS</td>
                      <td className="px-4 py-2 text-zinc-600">
                        Comprobar que estás en tu sucursal (NOM-037). Solo al
                        registrar asistencia.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-medium">
                        Dirección de red (IP)
                      </td>
                      <td className="px-4 py-2 text-zinc-600">
                        Seguridad: detectar accesos sospechosos. Se anonimiza
                        a los 12 meses.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6.2 Cómo protegemos */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <Shield className="h-4 w-4 text-emerald-600" />
                ¿Cómo protegemos tu información?
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <TarjetaAccion
                  icon={Lock}
                  titulo="Contraseñas cifradas"
                  descripcion="Nunca se guardan en texto plano. Nadie, ni el administrador, puede ver tu contraseña."
                />
                <TarjetaAccion
                  icon={Fingerprint}
                  titulo="Verificación en dos pasos"
                  descripcion="Capa extra de seguridad opcional para tu cuenta."
                />
                <TarjetaAccion
                  icon={KeyRound}
                  titulo="Sesiones seguras"
                  descripcion="Tu acceso se firma digitalmente; no se puede falsificar."
                />
                <TarjetaAccion
                  icon={ClipboardCheck}
                  titulo="Bitácora de auditoría"
                  descripcion="Todo cambio queda registrado. Si alguien ve o modifica tus datos, queda la huella."
                />
                <TarjetaAccion
                  icon={MapPin}
                  titulo="Ubicación solo al registrar"
                  descripcion="Solo se guarda tu ubicación cuando marcas asistencia. No se rastrea tu teléfono."
                />
                <TarjetaAccion
                  icon={Trash2}
                  titulo="Anonimización"
                  descripcion="Las direcciones de red se borran a los 12 meses. Tus registros se conservan (por ley) sin identificarte."
                />
              </div>
            </div>

            <Separator />

            {/* 6.3 Derechos ARCO */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <Scale className="h-4 w-4 text-emerald-600" />
                Tus Derechos ARCO
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                La LFPDPPP te da cuatro derechos sobre tus datos personales,
                conocidos como <strong>Derechos ARCO</strong>. El sistema te
                permite ejercerlos directamente, sin trámites complicados.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="border-emerald-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                        <Eye className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-sm">Acceso</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs text-zinc-600">
                    Puedes descargar todos los datos personales que el sistema
                    tiene de ti. Es un botón directo: no necesitas pedir
                    permiso.
                  </CardContent>
                </Card>

                <Card className="border-amber-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-white">
                        <Edit3 className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-sm">Rectificación</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs text-zinc-600">
                    Si algún dato está mal (tu nombre, tu puesto, etc.),
                    puedes pedir que se corrija.
                  </CardContent>
                </Card>

                <Card className="border-rose-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white">
                        <Ban className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-sm">Cancelación</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs text-zinc-600">
                    Puedes pedir que se borren tus datos. Ojo: los registros de
                    asistencia se conservan 12 meses por exigencia de la ley
                    laboral, pero se anonimizan (ya no te identifican).
                  </CardContent>
                </Card>

                <Card className="border-sky-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-700 text-white">
                        <Hand className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-sm">Oposición</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs text-zinc-600">
                    Puedes oponerte a que tus datos se usen para fines
                    secundarios (como estadísticas internas) sin que afecte tu
                    relación laboral.
                  </CardContent>
                </Card>
              </div>

              <Flujo
                pasos={[
                  {
                    icon: Hand,
                    titulo: 'Envías tu solicitud',
                    detalle: 'Desde la página de Derechos ARCO',
                    color: 'bg-emerald-50 border-emerald-200',
                  },
                  {
                    icon: Bell,
                    titulo: 'El responsable la recibe',
                    detalle: 'Tiene 20 días hábiles',
                    color: 'bg-amber-50 border-amber-200',
                  },
                  {
                    icon: FileCheck2,
                    titulo: 'Te responde',
                    detalle: 'Por el mismo medio',
                    color: 'bg-emerald-50 border-emerald-200',
                  },
                ]}
              />
              <Nota tipo="ok" titulo="Plazo legal">
                <p>
                  La ley da al responsable <strong>20 días hábiles</strong>
                  para responder una solicitud ARCO. El sistema lleva el
                  conteo automáticamente y avisa si se acerca el vencimiento.
                </p>
              </Nota>
            </div>

            <Separator />

            {/* 6.4 Consentimiento */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                Tu consentimiento queda registrado
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                Cuando aceptas el Aviso de Privacidad, el sistema guarda:
              </p>
              <ul className="list-disc pl-5 text-sm text-zinc-600 space-y-1">
                <li>
                  <strong>La fecha y hora</strong> en que aceptaste.
                </li>
                <li>
                  <strong>La versión</strong> del aviso que aceptaste (si el
                  aviso cambia, se te pedirá aceptar de nuevo).
                </li>
                <li>
                  <strong>Una referencia a tu conexión</strong> (dirección de
                  red), como prueba de que fuiste tú.
                </li>
              </ul>
              <p className="text-sm text-zinc-700 leading-relaxed">
                Esto se guarda en un registro que no se puede modificar, así
                que es una prueba legal de tu consentimiento.
              </p>
            </div>
          </Seccion>

          {/* ============ 7. CUMPLIMIENTO LEGAL ============ */}
          <Seccion
            id="cumplimiento"
            icon={Scale}
            titulo="Leyes que cumple el sistema"
            descripcion="En qué ayuda el sistema a tu empresa para cumplir con la ley mexicana."
          >
            <p className="text-sm text-zinc-700 leading-relaxed">
              El sistema está diseñado para que tu empresa cumpla con las
              principales leyes laborales y de protección de datos de México.
              Aquí está el resumen, en palabras sencillas.
            </p>

            <div className="space-y-3">
              {/* LFPDPPP */}
              <Card className="border-emerald-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        LFPDPPP — Protección de Datos Personales
                      </CardTitle>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Ley Federal de Protección de Datos Personales en
                        Posesión de los Particulares
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-zinc-600 space-y-1.5">
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Aviso de Privacidad</strong> completo y
                        aceptación expresa antes de usar el sistema.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Derechos ARCO</strong> (Acceso, Rectificación,
                        Cancelación, Oposición) disponibles desde el sistema.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Descarga de tus datos</strong> con un clic
                        (Derecho de Acceso).
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Plazo de 20 días hábiles</strong> para
                        responder solicitudes, contado automáticamente.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Anonimización</strong> de datos identificativos
                        tras el periodo legal de conservación.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Bitácora inmutable</strong> de quién accede y
                        modifica datos personales.
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* LFT */}
              <Card className="border-sky-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-700 text-white">
                      <Scale className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        LFT — Ley Federal del Trabajo (Reforma 2027)
                      </CardTitle>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Registro electrónico de asistencia, horas extra y
                        conservación de registros
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-zinc-600 space-y-1.5">
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
                      <span>
                        <strong>Registro electrónico</strong> de asistencia con
                        fecha, hora y ubicación (art. 132).
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
                      <span>
                        <strong>Cálculo automático de horas extra</strong> con
                        pago doble y triple (arts. 66 y 68).
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
                      <span>
                        <strong>Prima por descanso trabajado</strong> (art. 73).
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
                      <span>
                        <strong>Conservación de registros 12 meses</strong>{' '}
                        tras el fin de la relación laboral (art. 804).
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
                      <span>
                        <strong>Registros inmutables</strong>: no se pueden
                        borrar ni alterar, solo corregir con justificación.
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* NOM-037 */}
              <Card className="border-amber-300">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        NOM-037-STPS-2023 — Teletrabajo
                      </CardTitle>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Trabajo a distancia y registro de jornada
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-zinc-600 space-y-1.5">
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Geolocalización</strong> en cada registro para
                        comprobar el lugar de trabajo.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Geocercas por sucursal</strong>: solo se
                        permite registrar dentro del área definida.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Códigos QR dinámicos</strong> que rotan para
                        evitar suplantaciones.
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* NOM-035 */}
              <Card className="border-rose-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 text-white">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        NOM-035-STPS — Factores de Riesgo Psicosocial
                      </CardTitle>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Detección de sobrecarga y estrés laboral
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-zinc-600 space-y-1.5">
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Alertas automáticas</strong> de jornadas
                        excesivas y exceso de horas extra.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Notificaciones</strong> al administrador cuando
                        se detectan patrones de riesgo.
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Nota tipo="info" titulo="Nota importante">
              <p>
                El Aviso de Privacidad del sistema es una plantilla que cumple
                con la estructura que exige la ley. El texto legal definitivo
                debe ser revisado por un abogado y, según el caso, registrado
                ante el INAI. Si tienes dudas, consulta la página{' '}
                <em>Aviso de Privacidad</em> dentro del sistema.
              </p>
            </Nota>
          </Seccion>

          {/* ============ 8. PREGUNTAS FRECUENTES ============ */}
          <Seccion
            id="faq"
            icon={HelpCircle}
            titulo="Preguntas frecuentes"
            descripcion="Las dudas más comunes, resueltas en palabras sencillas."
          >
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="p1">
                <AccordionTrigger className="text-left text-sm">
                  Olvidé marcar mi entrada. ¿Qué hago?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-600">
                  Avísale a tu supervisor o administrador. Ellos pueden{' '}
                  <strong>corregir tu registro</strong> desde el historial de
                  asistencia, añadiendo una justificación. El cambio queda
                  registrado en la auditoría, así que es transparente.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="p2">
                <AccordionTrigger className="text-left text-sm">
                  ¿Pueden saber dónde estoy en todo momento?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-600">
                  No. La ubicación solo se guarda <strong>en el momento exacto
                  en que registras tu entrada o salida</strong>. El sistema no
                  rastrea tu teléfono ni sabe dónde estás el resto del tiempo.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="p3">
                <AccordionTrigger className="text-left text-sm">
                  Olvidé mi contraseña. ¿Cómo la recupero?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-600">
                  Pídele al administrador que te la restablezca. Te asignará
                  una contraseña temporal que deberás cambiar al entrar.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="p4">
                <AccordionTrigger className="text-left text-sm">
                  ¿Qué pasa si rechazo el Aviso de Privacidad?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-600">
                  No podrás usar el sistema. La ley exige que aceptes antes de
                  que se traten tus datos. Si tienes dudas sobre el aviso,
                  revisa la sección{' '}
                  <em>Tu privacidad y tus datos</em> de este manual o pídele
                  al administrador que te explique.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="p5">
                <AccordionTrigger className="text-left text-sm">
                  ¿Puedo ver los datos que el sistema tiene de mí?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-600">
                  Sí. Es tu <strong>Derecho de Acceso</strong>. Desde la
                  página de <em>Derechos ARCO</em> puedes descargar todos tus
                  datos personales en un archivo, sin tener que pedirle permiso
                  a nadie.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="p6">
                <AccordionTrigger className="text-left text-sm">
                  ¿Las horas extra se calculan solas?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-600">
                  Sí. El sistema detecta automáticamente cuando trabajas más
                  de tu jornada y calcula el pago correspondiente (doble o
                  triple según corresponda por ley). Lo ves en el reporte de
                  horas extra.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="p7">
                <AccordionTrigger className="text-left text-sm">
                  Mi QR no funciona en la terminal. ¿Qué hago?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-600">
                  Los códigos QR <strong>rotan cada poco tiempo</strong> por
                  seguridad. Actualiza la pantalla de tu QR (cierra y vuelve a
                  abrir la pestaña) e inténtalo de nuevo. Si sigue sin
                  funcionar, registra tu asistencia directamente desde tu
                  teléfono en la pestaña <em>Asistencia</em>.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="p8">
                <AccordionTrigger className="text-left text-sm">
                  ¿Por cuánto tiempo se guardan mis registros?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-600">
                  La Ley Federal del Trabajo obliga a conservar los registros
                  de asistencia <strong>12 meses</strong> después de que
                  termines tu relación laboral. Después, los datos que te
                  identifican se anonimizan (ya no se puede saber que eres tú),
                  pero el registro se conserva como estadística.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="p9">
                <AccordionTrigger className="text-left text-sm">
                  ¿Puedo pedir que borren todos mis datos?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-600">
                  Puedes ejercer tu <strong>Derecho de Cancelación</strong>{' '}
                  desde la página de Derechos ARCO. Tus datos identificativos
                  (nombre, correo, etc.) se suprimen, pero los registros de
                  asistencia se conservan anonimizados durante el plazo legal
                  (12 meses) por si se necesitan en una auditoría o disputa
                  laboral.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="p10">
                <AccordionTrigger className="text-left text-sm">
                  ¿Quién puede ver mi historial de asistencia?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-600">
                  Tú, el administrador de tu sucursal, el supervisor de tu
                  sucursal y el administrador general. Nadie más. Cada vez que
                  alguien consulta o modifica tu información, queda registrado
                  en la auditoría.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Seccion>

          {/* ============ 9. GLOSARIO ============ */}
          <Seccion
            id="glosario"
            icon={Info}
            titulo="Glosario"
            descripcion="Palabras que aparecen en el sistema y lo que significan."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                {
                  termino: 'ARCO',
                  def: 'Acrónimo de Acceso, Rectificación, Cancelación y Oposición. Son tus derechos sobre tus datos personales.',
                },
                {
                  termino: 'Asistencia',
                  def: 'El registro de que llegaste o saliste del trabajo, con fecha y hora.',
                },
                {
                  termino: 'Auditoría',
                  def: 'Registro inmutable de todo lo que pasa en el sistema. Sirve como prueba legal.',
                },
                {
                  termino: 'Aviso de Privacidad',
                  def: 'Documento que explica qué datos personales se recaban, para qué, y cómo se protegen.',
                },
                {
                  termino: 'Check-in / Check-out',
                  def: 'Registro de entrada (check-in) y de salida (check-out) de tu jornada.',
                },
                {
                  termino: 'Geocerca',
                  def: 'Área geográfica definida por el administrador dentro de la cual se permite registrar asistencia.',
                },
                {
                  termino: 'INAI',
                  def: 'Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales.',
                },
                {
                  termino: 'Jornada',
                  def: 'El tiempo total que trabajas en un día, descontando las pausas.',
                },
                {
                  termino: 'LFPDPPP',
                  def: 'Ley Federal de Protección de Datos Personales en Posesión de los Particulares.',
                },
                {
                  termino: 'LFT',
                  def: 'Ley Federal del Trabajo.',
                },
                {
                  termino: 'MFA',
                  def: 'Verificación en dos pasos. Pide un código además de tu contraseña para mayor seguridad.',
                },
                {
                  termino: 'NOM-035',
                  def: 'Norma sobre factores de riesgo psicosocial en el trabajo (estrés, sobrecarga).',
                },
                {
                  termino: 'NOM-037',
                  def: 'Norma sobre teletrabajo (trabajo a distancia), que exige registro electrónico de asistencia.',
                },
                {
                  termino: 'Panel / Dashboard',
                  def: 'Pantalla principal con el resumen del día.',
                },
                {
                  termino: 'Permiso',
                  def: 'Ausencia justificada (médica, familiar) que no descuenta días de vacaciones.',
                },
                {
                  termino: 'Rol',
                  def: 'El tipo de usuario que eres: empleado, supervisor, administrador de sucursal o administrador general.',
                },
                {
                  termino: 'STPS',
                  def: 'Secretaría del Trabajo y Previsión Social. La autoridad laboral federal.',
                },
                {
                  termino: 'Terminal QR',
                  def: 'Pantalla en modo kiosco donde los empleados escanean su QR para registrar asistencia.',
                },
              ].map((g) => (
                <div
                  key={g.termino}
                  className="rounded-lg border border-zinc-200 bg-white p-3"
                >
                  <p className="text-sm font-semibold text-zinc-900">
                    {g.termino}
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
                    {g.def}
                  </p>
                </div>
              ))}
            </div>
          </Seccion>

          {/* Pie del manual */}
          <Card className="border-zinc-200 bg-zinc-50">
            <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
              <BookOpen className="h-6 w-6 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-700">
                Manual de Usuario — Sistema de Control de Asistencia
              </p>
              <p className="text-xs text-zinc-500 max-w-md">
                Si tienes alguna duda que no se resuelva en este manual,
                comunícate con el administrador del sistema de tu empresa.
              </p>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="mt-2 gap-1.5"
              >
                <a
                  href="/documentos/manual-usuario-v3.0.pdf"
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar versión PDF
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
