'use client';

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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  MapPin,
  QrCode,
  FileBarChart,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LayoutDashboard,
  CalendarCheck,
  History,
  KeyRound,
  Fingerprint,
  Navigation,
  Timer,
  FileSpreadsheet,
  Printer,
  Eye,
  Search,
  Download,
  Lock,
  Globe,
  HardDrive,
  HelpCircle,
  Rocket,
  XCircle,
  RefreshCw,
  ClipboardList,
  ArrowRight,
  Building2,
} from 'lucide-react';

// ==================== SECTION WRAPPER ====================
function SectionCard({
  id,
  icon,
  title,
  description,
  children,
  variant = 'default',
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  variant?: 'default' | 'highlight';
}) {
  return (
    <Card
      id={id}
      className={
        variant === 'highlight'
          ? 'border-primary/30 bg-primary/5'
          : ''
      }
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
            {icon}
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-1">
                {description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

// ==================== SUB-SECTION ====================
function SubSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <div className="pl-6 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </div>
  );
}

// ==================== INFO BOX ====================
function InfoBox({
  variant = 'info',
  children,
}: {
  variant?: 'info' | 'warning' | 'success';
  children: React.ReactNode;
}) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300',
    warning:
      'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300',
    success:
      'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300',
  };

  return (
    <div className={`rounded-lg border p-4 text-sm ${styles[variant]}`}>
      {children}
    </div>
  );
}

// ==================== STEP LIST ====================
function StepList({
  steps,
}: {
  steps: Array<{ title: string; description: string }>;
}) {
  return (
    <ol className="space-y-3">
      {steps.map((step, idx) => (
        <li key={idx} className="flex gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
            {idx + 1}
          </div>
          <div>
            <p className="font-medium text-sm">{step.title}</p>
            <p className="text-sm text-muted-foreground">
              {step.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ==================== FEATURE LIST ====================
function FeatureList({
  items,
}: {
  items: Array<{ icon: React.ReactNode; label: string; description: string }>;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2">
          <span className="text-primary mt-0.5 shrink-0">{item.icon}</span>
          <div>
            <span className="font-medium text-sm">{item.label}</span>
            <span className="text-sm text-muted-foreground">
              {' '}
              — {item.description}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ==================== MAIN USER MANUAL COMPONENT ====================
export function UserManual() {
  const handleDownloadPDF = () => {
    window.open('/api/manual/pdf', '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Manual del Administrador</h1>
              <p className="text-sm text-muted-foreground">
                Sistema de Control de Asistencia — Cumplimiento NOM-037
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            className="shrink-0"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Descargar PDF</span>
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-80px)]">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-8 pb-20">
          {/* ============================================ */}
          {/* ADMIN-ONLY NOTICE */}
          {/* ============================================ */}
          <InfoBox variant="warning">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Este manual está dirigido <strong>exclusivamente a administradores</strong> del
                sistema. Contiene información detallada sobre la configuración, gestión de
                empleados, sucursales, reportes y auditoría. Los empleados del sistema
                cuentan con una interfaz simplificada que no requiere manual técnico.
              </span>
            </div>
          </InfoBox>

          <Separator />

          {/* ============================================ */}
          {/* 1. INTRODUCCIÓN AL SISTEMA */}
          {/* ============================================ */}
          <SectionCard
            id="introduccion"
            icon={<BookOpen className="w-5 h-5" />}
            title="1. Introducción al Sistema"
            description="Conozca el Sistema de Control de Asistencia y su fundamento legal"
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              El <strong>Sistema de Control de Asistencia</strong> es una
              plataforma integral diseñada para el registro, seguimiento y
              gestión de la asistencia laboral de los empleados, cumpliendo
              plenamente con la{' '}
              <strong>
                Norma Oficial Mexicana NOM-037-STPS-2023
              </strong>{' '}
              sobre condiciones de seguridad y salud en el trabajo para la
              prevención de riesgos psicosociales en centros de trabajo.
            </p>

            <InfoBox variant="success">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Este sistema garantiza la inalterabilidad de los registros de
                  asistencia, la trazabilidad completa de acciones y la
                  retención de datos conforme a la legislación mexicana vigente.
                </span>
              </div>
            </InfoBox>

            <SubSection icon={<Fingerprint />} title="Autenticación Dual">
              <p>
                El sistema implementa un esquema de{' '}
                <strong>autenticación dual</strong> que combina código QR y
                contraseña. Esto garantiza que el registro de asistencia sea
                verificado por dos factores, reduciendo significativamente la
                posibilidad de registros fraudulentos.
              </p>
            </SubSection>

            <SubSection icon={<MapPin />} title="Geolocalización GPS">
              <p>
                Cada registro de entrada o salida captura automáticamente las
                coordenadas GPS del dispositivo del empleado, proporcionando
                evidencia de la ubicación física al momento del registro, lo cual
                es un requisito fundamental de la NOM-037.
              </p>
            </SubSection>

            <SubSection
              icon={<Building2 />}
              title="Gestión Multi-Sucursal"
            >
              <p>
                El sistema soporta la gestión de múltiples sucursales o centros
                de trabajo. Cada empleado es asignado a una sucursal específica{' '}
                (<strong>Matriz, Sucursal 1, Sucursal 2, Sucursal 3</strong>),
                lo que permite organizar, filtrar y reportar la asistencia por
                ubicación física. Los reportes pueden filtrarse por sucursal
                para obtener información segmentada de cada centro de trabajo.
              </p>
            </SubSection>

            <SubSection
              icon={<ClipboardList />}
              title="Registros Inalterables"
            >
              <p>
                Todos los registros de asistencia son inmutables una vez
                creados. No es posible modificar o eliminar registros, lo cual
                asegura la integridad de la información para auditorías y
                cumplimiento regulatorio.
              </p>
            </SubSection>
          </SectionCard>

          {/* ============================================ */}
          {/* 2. PRIMEROS PASOS */}
          {/* ============================================ */}
          <SectionCard
            id="primeros-pasos"
            icon={<Rocket className="w-5 h-5" />}
            title="2. Primeros Pasos / Cómo Iniciar"
            description="Configure el sistema y comience a gestionar la asistencia"
          >
            <SubSection
              icon={<LogIn />}
              title="Inicio de Sesión del Administrador"
            >
              <p>
                Al acceder al sistema por primera vez, utilice las credenciales
                de administrador proporcionadas durante la implementación. El
                sistema incluye un usuario administrador por defecto con acceso
                total a todas las funciones.
              </p>
              <StepList
                steps={[
                  {
                    title: 'Acceda a la aplicación',
                    description:
                      'Abra el navegador y navegue a la URL del sistema.',
                  },
                  {
                    title: 'Ingrese sus credenciales de administrador',
                    description:
                      'Introduzca su correo electrónico y contraseña proporcionados por el equipo de implementación.',
                  },
                  {
                    title: 'Seleccione método de acceso',
                    description:
                      'Puede iniciar sesión con contraseña o mediante código QR si tiene un código de administrador asignado.',
                  },
                  {
                    title: 'Panel de Administración',
                    description:
                      'Al iniciar sesión, accederá directamente al Panel de Administración donde podrá gestionar todo el sistema.',
                  },
                ]}
              />
            </SubSection>

            <SubSection icon={<Users />} title="Configuración Inicial">
              <p>
                Una vez dentro del sistema, el administrador debe realizar la
                configuración inicial:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  <strong>Crear empleados</strong> manualmente desde la sección
                  de Empleados, ingresando datos personales, posición,
                  departamento, sucursal y horarios de trabajo
                </li>
                <li>
                  <strong>Configurar horarios</strong> — Los horarios por defecto
                  son: <strong>Lunes a Viernes (09:00–18:00)</strong> y{' '}
                  <strong>Sábado (09:00–14:00)</strong>, con tolerancia de 10
                  minutos. Puede personalizar los horarios para cada empleado
                  según sus necesidades.
                </li>
                <li>
                  <strong>Asignar sucursal</strong> — Al crear cada empleado,
                  seleccione la sucursal correspondiente: Matriz, Sucursal 1,
                  Sucursal 2 o Sucursal 3
                </li>
                <li>
                  <strong>Generar códigos QR</strong> para cada empleado desde su
                  ficha individual
                </li>
              </ul>
              <InfoBox variant="info">
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Los empleados se crean manualmente desde el panel de
                    administración. No existe un proceso automático de carga. El
                    administrador tiene control total sobre el registro de
                    personal.
                  </span>
                </div>
              </InfoBox>
            </SubSection>
          </SectionCard>

          {/* ============================================ */}
          {/* 3. PANEL DEL ADMINISTRADOR */}
          {/* ============================================ */}
          <SectionCard
            id="panel-admin"
            icon={<Shield className="w-5 h-5" />}
            title="3. Panel del Administrador"
            description="Explore todas las funciones disponibles para la gestión del sistema"
          >
            <InfoBox variant="info">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  El panel de administración es accesible únicamente para
                  usuarios con rol de <strong>ADMIN</strong>. Desde aquí se
                  gestiona toda la operación del sistema de asistencia.
                </span>
              </div>
            </InfoBox>

            {/* Dashboard */}
            <SubSection
              icon={<LayoutDashboard />}
              title="Panel Principal (Dashboard)"
            >
              <p>
                El dashboard es la vista inicial del administrador. Muestra un
                resumen en tiempo real de la asistencia del día:
              </p>
              <FeatureList
                items={[
                  {
                    icon: <Users className="w-4 h-4" />,
                    label: 'Total de Empleados',
                    description:
                      'Número total de empleados registrados en el sistema',
                  },
                  {
                    icon: <CheckCircle2 className="w-4 h-4" />,
                    label: 'Presentes',
                    description:
                      'Empleados que registraron entrada a tiempo (sin retardo)',
                  },
                  {
                    icon: <AlertTriangle className="w-4 h-4" />,
                    label: 'Retardos',
                    description:
                      'Empleados que llegaron después de la hora de entrada más la tolerancia',
                  },
                  {
                    icon: <XCircle className="w-4 h-4" />,
                    label: 'Ausentes',
                    description:
                      'Empleados que no han registrado entrada durante el día',
                  },
                ]}
              />
              <p className="mt-2">
                También incluye una tabla detallada con todas las asistencias
                del día, mostrando hora de entrada, salida, estado y método
                utilizado. Al final se muestra una lista de empleados ausentes.
              </p>
            </SubSection>

            <Separator />

            {/* Employees */}
            <SubSection icon={<Users />} title="Empleados">
              <p>
                Gestión completa del personal de la organización. Funcionalidades
                principales:
              </p>
              <FeatureList
                items={[
                  {
                    icon: <Search className="w-4 h-4" />,
                    label: 'Búsqueda y Filtrado',
                    description:
                      'Filtre empleados por nombre, número de empleado, correo, departamento o sucursal',
                  },
                  {
                    icon: <Users className="w-4 h-4" />,
                    label: 'Crear Empleado',
                    description:
                      'Registre nuevos empleados con datos personales, posición, departamento, sucursal y horarios de trabajo personalizados',
                  },
                  {
                    icon: <Building2 className="w-4 h-4" />,
                    label: 'Campo de Sucursal',
                    description:
                      'Al crear un empleado, seleccione la sucursal asignada: Matriz, Sucursal 1, Sucursal 2 o Sucursal 3. Esto permite organizar el personal por centro de trabajo',
                  },
                  {
                    icon: <Clock className="w-4 h-4" />,
                    label: 'Horarios de Trabajo',
                    description:
                      'Configure horarios individuales por día de la semana, incluyendo lunes a viernes, sábado y días especiales. Los horarios por defecto son L-V (09:00–18:00) y Sábado (09:00–14:00)',
                  },
                  {
                    icon: <QrCode className="w-4 h-4" />,
                    label: 'Código QR Individual',
                    description:
                      'Genere y descargue el código QR personal de cada empleado para uso en la terminal de asistencia',
                  },
                ]}
              />
              <InfoBox variant="success">
                <div className="flex items-start gap-2">
                  <QrCode className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Cada empleado recibe un código QR único que puede ser
                    descargado como imagen PNG para imprimir o compartir.
                    Los horarios soportan jornadas de lunes a sábado, con
                    configuración independiente para cada día.
                  </span>
                </div>
              </InfoBox>
            </SubSection>

            <Separator />

            {/* Attendance */}
            <SubSection icon={<CalendarCheck />} title="Asistencias">
              <p>
                Historial completo de registros de asistencia con filtrado por
                período:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Hoy</strong> — Asistencias del día actual
                </li>
                <li>
                  <strong>Esta Semana</strong> — Registros de la semana en curso
                </li>
                <li>
                  <strong>Este Mes</strong> — Todos los registros del mes actual
                </li>
              </ul>
              <p className="mt-2">
                La tabla muestra fecha, empleado, sucursal, hora de entrada/salida, horas
                trabajadas, estado (Presente/Retardo/Ausente/Salida Anticipada)
                y ubicación GPS del registro.
              </p>
            </SubSection>

            <Separator />

            {/* Reports */}
            <SubSection icon={<FileBarChart />} title="Reportes">
              <p>
                Generación de reportes detallados para análisis y cumplimiento.
                Tres tipos de reporte disponibles:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div className="rounded-lg border bg-green-50 p-3 dark:bg-green-950/20">
                  <p className="font-semibold text-sm text-green-800 dark:text-green-300">
                    Reporte Diario
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Resumen de asistencias, retardos, ausencias y horas extra del
                    período seleccionado
                  </p>
                </div>
                <div className="rounded-lg border bg-orange-50 p-3 dark:bg-orange-950/20">
                  <p className="font-semibold text-sm text-orange-800 dark:text-orange-300">
                    Horas Extra
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Detalle de horas extra trabajadas con cálculo de pago doble
                    conforme a la LFT
                  </p>
                </div>
                <div className="rounded-lg border bg-red-50 p-3 dark:bg-red-950/20">
                  <p className="font-semibold text-sm text-red-800 dark:text-red-300">
                    Ausencias
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Listado de empleados ausentes con estadísticas por período
                  </p>
                </div>
              </div>
              <FeatureList
                items={[
                  {
                    icon: <Building2 className="w-4 h-4" />,
                    label: 'Filtrado por Sucursal',
                    description:
                      'Todos los reportes pueden filtrarse por sucursal (Matriz, Sucursal 1, 2, 3) para obtener información segmentada por centro de trabajo',
                  },
                  {
                    icon: <Eye className="w-4 h-4" />,
                    label: 'Vista Previa',
                    description:
                      'Consulte el reporte en pantalla antes de exportarlo',
                  },
                  {
                    icon: <Download className="w-4 h-4" />,
                    label: 'Exportar CSV',
                    description:
                      'Descargue el reporte en formato CSV compatible con cualquier hoja de cálculo',
                  },
                  {
                    icon: <FileSpreadsheet className="w-4 h-4" />,
                    label: 'Exportar Excel',
                    description:
                      'Descargue el reporte en formato Excel (.xls) para análisis avanzado',
                  },
                  {
                    icon: <Printer className="w-4 h-4" />,
                    label: 'Imprimir',
                    description:
                      'Genere una versión optimizada para impresión con formato profesional',
                  },
                ]}
              />
            </SubSection>

            <Separator />

            {/* Audit */}
            <SubSection icon={<Shield />} title="Auditoría">
              <p>
                Registro completo de todas las acciones realizadas en el
                sistema. Cada movimiento queda registrado con:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Fecha y hora</strong> exacta de la acción
                </li>
                <li>
                  <strong>Usuario</strong> que realizó la acción
                </li>
                <li>
                  <strong>Tipo de acción</strong> (login, check-in, check-out,
                  creación, modificación, etc.)
                </li>
                <li>
                  <strong>Detalles</strong> adicionales del evento
                </li>
                <li>
                  <strong>Dirección IP</strong> desde donde se realizó
                </li>
              </ul>
              <InfoBox variant="success">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Los registros de auditoría son inmutables y no pueden ser
                    modificados ni eliminados, garantizando la trazabilidad
                    completa para cumplimiento de la NOM-037.
                  </span>
                </div>
              </InfoBox>
            </SubSection>

            <Separator />

            {/* QR Terminal */}
            <SubSection icon={<QrCode />} title="Terminal QR">
              <p>
                Pantalla diseñada para ser mostrada en un monitor o tablet en la
                entrada del centro de trabajo. Características:
              </p>
              <FeatureList
                items={[
                  {
                    icon: <QrCode className="w-4 h-4" />,
                    label: 'QR Dinámico',
                    description:
                      'Código QR que se regenera automáticamente cada 5 minutos para mayor seguridad',
                  },
                  {
                    icon: <RefreshCw className="w-4 h-4" />,
                    label: 'Auto-actualización',
                    description:
                      'El código se refresca automáticamente sin necesidad de intervención manual',
                  },
                  {
                    icon: <Clock className="w-4 h-4" />,
                    label: 'Temporizador Visible',
                    description:
                      'Muestra el tiempo restante antes de la siguiente actualización del código',
                  },
                ]}
              />
              <InfoBox variant="warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    El QR dinámico debe ser escaneado dentro de su ventana de
                    vigencia (5 minutos). Un código expirado no será aceptado
                    para el registro de asistencia.
                  </span>
                </div>
              </InfoBox>
            </SubSection>
          </SectionCard>

          {/* ============================================ */}
          {/* 4. PANEL DEL EMPLEADO (Breve referencia) */}
          {/* ============================================ */}
          <SectionCard
            id="panel-empleado"
            icon={<Users className="w-5 h-5" />}
            title="4. Panel del Empleado"
            description="Referencia general de la interfaz de empleado"
          >
            <InfoBox variant="info">
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Los empleados acceden a una interfaz simplificada diseñada para
                  ser intuitiva y no requiere capacitación técnica. A continuación
                  se describe de forma general para conocimiento del administrador.
                </span>
              </div>
            </InfoBox>

            <FeatureList
              items={[
                {
                  icon: <Fingerprint className="w-4 h-4" />,
                  label: 'Registrar Asistencia',
                  description:
                    'El empleado registra su entrada y salida con contraseña o código QR. Se captura automáticamente la geolocalización GPS del dispositivo.',
                },
                {
                  icon: <History className="w-4 h-4" />,
                  label: 'Historial Personal',
                  description:
                    'Consulta de su propio historial de asistencias filtrado por semana o mes, con fecha, horas, estado y coordenadas GPS.',
                },
                {
                  icon: <QrCode className="w-4 h-4" />,
                  label: 'Mi QR',
                  description:
                    'Generación y descarga de su código QR personal como imagen PNG para presentarlo en la Terminal QR del centro de trabajo.',
                },
              ]}
            />

            <InfoBox variant="success">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  La interfaz del empleado es auto-explicativa. Los estados
                  posibles son: <strong>Sin registro</strong>,{' '}
                  <strong>En Jornada</strong>,{' '}
                  <strong>Jornada Completada</strong> y{' '}
                  <strong>Retardo</strong>. No se requiere manual
                  adicional para los empleados.
                </span>
              </div>
            </InfoBox>
          </SectionCard>

          {/* ============================================ */}
          {/* 5. SISTEMA DE AUTENTICACIÓN DUAL */}
          {/* ============================================ */}
          <SectionCard
            id="autenticacion-dual"
            icon={<Fingerprint className="w-5 h-5" />}
            title="5. Sistema de Autenticación Dual"
            description="Cómo funciona la verificación de identidad mediante QR y contraseña"
            variant="highlight"
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              La autenticación dual es un pilar fundamental del sistema,
              garantizando que cada registro de asistencia corresponda realmente
              al empleado que lo realiza.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-primary" />
                    <CardTitle className="text-sm">QR Dinámico</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>
                      • Generado en la <strong>Terminal QR</strong> del
                      administrador
                    </li>
                    <li>• Se renueva cada <strong>5 minutos</strong></li>
                    <li>
                      • Escaneado por el empleado al momento del registro
                    </li>
                    <li>• Garantiza presencia física en el lugar</li>
                    <li>• Invalida códigos antiguos automáticamente</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="border-teal-200 dark:border-teal-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    <CardTitle className="text-sm">
                      QR Personal + Contraseña
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>
                      • El empleado muestra su <strong>QR personal</strong> en
                      la terminal
                    </li>
                    <li>• Ingresa su <strong>contraseña</strong> para confirmar</li>
                    <li>
                      • Combinación de algo que <strong>tiene</strong> (QR) + algo
                      que <strong>sabe</strong> (contraseña)
                    </li>
                    <li>• Método alternativo al escaneo del QR dinámico</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <InfoBox variant="success">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Ambos métodos cumplen con los requisitos de la NOM-037 al
                  garantizar la verificación de identidad mediante al menos un
                  factor de autenticación.
                </span>
              </div>
            </InfoBox>
          </SectionCard>

          {/* ============================================ */}
          {/* 6. GEOLOCALIZACIÓN */}
          {/* ============================================ */}
          <SectionCard
            id="geolocalizacion"
            icon={<MapPin className="w-5 h-5" />}
            title="6. Geolocalización"
            description="Registro obligatorio de ubicación GPS conforme a la NOM-037"
          >
            <InfoBox variant="warning">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  La geolocalización es <strong>obligatoria</strong> para todo
                  registro de asistencia. Sin acceso a la ubicación GPS, no es
                  posible registrar entrada ni salida.
                </span>
              </div>
            </InfoBox>

            <SubSection icon={<Navigation />} title="Cómo funciona">
              <StepList
                steps={[
                  {
                    title: 'Solicitud de permisos',
                    description:
                      'Al acceder al sistema, se solicita permiso para usar la ubicación del dispositivo.',
                  },
                  {
                    title: 'Captura de coordenadas',
                    description:
                      'Al registrar entrada o salida, se capturan las coordenadas GPS (latitud y longitud) con alta precisión.',
                  },
                  {
                    title: 'Almacenamiento',
                    description:
                      'Las coordenadas se guardan junto con el registro de asistencia y son visibles en el historial y reportes.',
                  },
                  {
                    title: 'Verificación',
                    description:
                      'El administrador puede consultar la ubicación exacta de cada registro para verificar la presencia del empleado.',
                  },
                ]}
              />
            </SubSection>

            <SubSection
              icon={<Globe />}
              title="¿Por qué es obligatoria?"
            >
              <p>
                La NOM-037 requiere que los registros de asistencia sean
                inalterables y verificables. La geolocalización GPS proporciona
                evidencia objetiva de que el empleado se encontraba físicamente
                en el lugar de trabajo al momento del registro, previniendo el
                registro remoto fraudulento.
              </p>
            </SubSection>
          </SectionCard>

          {/* ============================================ */}
          {/* 7. CÁLCULO DE HORAS EXTRA */}
          {/* ============================================ */}
          <SectionCard
            id="horas-extra"
            icon={<Timer className="w-5 h-5" />}
            title="7. Cálculo de Horas Extra"
            description="Conforme a la Ley Federal del Trabajo de México"
            variant="highlight"
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              El sistema calcula automáticamente las horas extra de acuerdo con
              la <strong>Ley Federal del Trabajo (LFT)</strong> de México.
            </p>

            <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-4 space-y-3 dark:bg-orange-950/20 dark:border-orange-800">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-orange-700 dark:text-orange-400" />
                <h4 className="font-semibold text-orange-900 dark:text-orange-300">
                  Reglas de Cálculo
                </h4>
              </div>
              <ul className="space-y-2 text-sm text-orange-800 dark:text-orange-300">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Jornada estándar:</strong> 8 horas diarias (Lunes a Viernes) conforme
                    al Artículo 61 de la LFT
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Jornada sabatina:</strong> Los sábados tienen un horario
                    reducido (09:00–14:00 por defecto). Las horas extra se calculan
                    respecto al horario configurado para ese día.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Tolerancia:</strong> 10 minutos de margen antes de
                    considerar retardo (configurable por empleado)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Pago doble:</strong> Las horas excedentes después de
                    la jornada se pagan al doble de la tarifa normal (Artículo 67
                    LFT)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Cálculo automático:</strong> El sistema calcula
                    automáticamente las horas extra al registrar la salida,
                    considerando el horario específico de cada día (lunes a sábado)
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
              <p className="font-semibold">Ejemplo de cálculo (Lunes a Viernes):</p>
              <p className="text-muted-foreground">
                Si un empleado con horario de 09:00 - 18:00 registra su salida a
                las 20:30:
              </p>
              <ul className="text-muted-foreground space-y-1">
                <li>• Horario programado: 9 horas (incluyendo hora de comida)</li>
                <li>• Jornada legal: 8 horas</li>
                <li>• Salida real: 20:30 → 2.5 horas después de las 18:00</li>
                <li>
                  • <strong>Horas extra: 2.5 horas pagadas al doble</strong>
                </li>
              </ul>
            </div>

            <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
              <p className="font-semibold">Ejemplo de cálculo (Sábado):</p>
              <p className="text-muted-foreground">
                Si un empleado con horario sabatino de 09:00 - 14:00 registra su salida a
                las 16:00:
              </p>
              <ul className="text-muted-foreground space-y-1">
                <li>• Horario sabatino programado: 5 horas</li>
                <li>• Salida real: 16:00 → 2 horas después de las 14:00</li>
                <li>
                  • <strong>Horas extra: 2 horas pagadas al doble</strong>
                </li>
              </ul>
            </div>
          </SectionCard>

          {/* ============================================ */}
          {/* 8. REPORTES Y EXPORTACIÓN */}
          {/* ============================================ */}
          <SectionCard
            id="reportes"
            icon={<FileBarChart className="w-5 h-5" />}
            title="8. Reportes y Exportación"
            description="Generación, visualización y descarga de reportes de asistencia"
          >
            <SubSection icon={<Eye />} title="Vista Previa">
              <p>
                Antes de exportar, puede consultar la vista previa del reporte
                directamente en pantalla. Los reportes muestran estadísticas
                resumidas y el detalle completo de registros en tablas
                interactivas.
              </p>
            </SubSection>

            <SubSection icon={<Building2 />} title="Filtrado por Sucursal">
              <p>
                Todos los reportes permiten filtrar por sucursal, lo que le
                permite analizar la asistencia de cada centro de trabajo de
                forma independiente. Las sucursales disponibles son:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                <div className="rounded-lg border p-2 text-center">
                  <Building2 className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="font-semibold text-xs">Matriz</p>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <Building2 className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="font-semibold text-xs">Sucursal 1</p>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <Building2 className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="font-semibold text-xs">Sucursal 2</p>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <Building2 className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="font-semibold text-xs">Sucursal 3</p>
                </div>
              </div>
              <InfoBox variant="info">
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Si no selecciona una sucursal, el reporte incluirá los datos
                    de todas las sucursales. Seleccione una específica para
                    obtener información segmentada.
                  </span>
                </div>
              </InfoBox>
            </SubSection>

            <SubSection icon={<Download />} title="Formatos de Exportación">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div className="rounded-lg border p-3 text-center">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <p className="font-semibold text-sm">CSV</p>
                  <p className="text-xs text-muted-foreground">
                    Formato abierto compatible con Excel, Google Sheets y otros
                  </p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-green-700" />
                  <p className="font-semibold text-sm">Excel (.xls)</p>
                  <p className="text-xs text-muted-foreground">
                    Formato nativo para Microsoft Excel con formato tabular
                  </p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <Printer className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                  <p className="font-semibold text-sm">Imprimir</p>
                  <p className="text-xs text-muted-foreground">
                    Versión optimizada para impresión con formato profesional
                  </p>
                </div>
              </div>
            </SubSection>

            <SubSection icon={<FileBarChart />} title="Tipos de Reporte">
              <ul className="space-y-2 mt-2">
                <li className="flex items-start gap-2">
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs shrink-0">
                    Diario
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Resumen completo de asistencias, retardos, ausencias y horas
                    extra del período seleccionado. Filtrable por sucursal.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 text-xs shrink-0">
                    Horas Extra
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Detalle de horas extra trabajadas con cálculo de pago doble
                    conforme a la LFT. Incluye desglose por sucursal.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs shrink-0">
                    Ausencias
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Listado de empleados ausentes con estadísticas y tendencias
                    por período. Filtrable por sucursal.
                  </span>
                </li>
              </ul>
            </SubSection>

            <SubSection icon={<Printer />} title="Impresión Profesional">
              <p>
                Al utilizar la función de impresión, el sistema genera una
                versión formateada profesionalmente que incluye:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Encabezado con nombre del reporte y período</li>
                <li>Sucursal seleccionada (o todas si no se filtró)</li>
                <li>Fecha y hora de generación</li>
                <li>Resumen estadístico</li>
                <li>Tabla detallada de registros</li>
                <li>
                  Pie de página con referencia al sistema y NOM-037
                </li>
              </ul>
            </SubSection>
          </SectionCard>

          {/* ============================================ */}
          {/* 9. AUDITORÍA Y TRAZABILIDAD */}
          {/* ============================================ */}
          <SectionCard
            id="auditoria"
            icon={<Shield className="w-5 h-5" />}
            title="9. Auditoría y Trazabilidad"
            description="Registro inmutable de todas las acciones del sistema"
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              La trazabilidad es un requisito central de la NOM-037. El sistema
              mantiene un registro completo e inmutable de todas las acciones
              realizadas.
            </p>

            <SubSection icon={<ClipboardList />} title="Acciones Registradas">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {[
                  {
                    icon: <LogIn className="w-3 h-3" />,
                    label: 'Inicio de sesión',
                  },
                  {
                    icon: <CheckCircle2 className="w-3 h-3" />,
                    label: 'Registro de entrada',
                  },
                  {
                    icon: <LogIn className="w-3 h-3" />,
                    label: 'Registro de salida',
                  },
                  {
                    icon: <Users className="w-3 h-3" />,
                    label: 'Creación de empleado',
                  },
                  {
                    icon: <QrCode className="w-3 h-3" />,
                    label: 'Generación de QR',
                  },
                  {
                    icon: <FileBarChart className="w-3 h-3" />,
                    label: 'Generación de reportes',
                  },
                  {
                    icon: <Download className="w-3 h-3" />,
                    label: 'Exportación de datos',
                  },
                  {
                    icon: <Lock className="w-3 h-3" />,
                    label: 'Accesos al sistema',
                  },
                ].map((action, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border p-2"
                  >
                    <span className="text-primary">{action.icon}</span>
                    {action.label}
                  </div>
                ))}
              </div>
            </SubSection>

            <SubSection
              icon={<Lock />}
              title="Inmutabilidad de los Registros"
            >
              <p>
                Los registros de auditoría y asistencia son{' '}
                <strong>inalterables</strong>. Una vez creados, no pueden ser
                modificados ni eliminados por ningún usuario, incluyendo al
                administrador. Esto garantiza la integridad de la información
                para cualquier proceso de auditoría o inspección laboral.
              </p>
            </SubSection>

            <InfoBox variant="success">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  La trazabilidad completa es fundamental para demostrar
                  cumplimiento ante inspecciones de la Secretaría del Trabajo y
                  Previsión Social (STPS).
                </span>
              </div>
            </InfoBox>
          </SectionCard>

          {/* ============================================ */}
          {/* 10. RETENCIÓN DE DATOS */}
          {/* ============================================ */}
          <SectionCard
            id="retencion"
            icon={<HardDrive className="w-5 h-5" />}
            title="10. Retención de Datos"
            description="Política de conservación de información conforme a la NOM-037"
          >
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary">
                  <span className="text-2xl font-bold">5</span>
                </div>
                <div>
                  <p className="font-bold text-lg">Años de Retención</p>
                  <p className="text-sm text-muted-foreground">
                    Conforme a lo establecido por la NOM-037-STPS-2023
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              De acuerdo con la NOM-037, los registros de asistencia deben
              conservarse durante un período mínimo de <strong>5 años</strong>.
              El sistema cumple con este requisito manteniendo:
            </p>

            <ul className="space-y-2">
              {[
                {
                  icon: <CalendarCheck className="w-4 h-4" />,
                  label: 'Registros de asistencia',
                  desc: 'Entradas, salidas, retardos y ausencias',
                },
                {
                  icon: <Shield className="w-4 h-4" />,
                  label: 'Logs de auditoría',
                  desc: 'Toda la actividad del sistema registrada',
                },
                {
                  icon: <MapPin className="w-4 h-4" />,
                  label: 'Datos de geolocalización',
                  desc: 'Coordenadas GPS de cada registro',
                },
                {
                  icon: <Users className="w-4 h-4" />,
                  label: 'Información de empleados',
                  desc: 'Datos del personal, sucursales y horarios',
                },
                {
                  icon: <FileBarChart className="w-4 h-4" />,
                  label: 'Reportes generados',
                  desc: 'Historial de reportes exportados',
                },
              ].map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <span className="text-primary mt-0.5">{item.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <InfoBox variant="info">
              <div className="flex items-start gap-2">
                <HardDrive className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  El sistema utiliza una base de datos robusta con respaldo
                  automático que garantiza la persistencia, integridad y
                  disponibilidad de la información en todo momento. Los datos
                  están protegidos contra pérdidas y disponibles para
                  auditorías en cualquier momento.
                </span>
              </div>
            </InfoBox>
          </SectionCard>

          {/* ============================================ */}
          {/* 11. PREGUNTAS FRECUENTES (FAQ) */}
          {/* ============================================ */}
          <SectionCard
            id="faq"
            icon={<HelpCircle className="w-5 h-5" />}
            title="11. Preguntas Frecuentes (FAQ)"
            description="Respuestas a las dudas más comunes sobre el sistema"
          >
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="faq-1">
                <AccordionTrigger>
                  ¿Qué sucede si un empleado olvida registrar su salida?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Si un empleado olvida registrar su salida, el registro quedará como
                    &quot;pendiente&quot; y el sistema lo marcará
                    automáticamente como ausencia parcial. El administrador
                    puede documentar la corrección correspondiente a
                    través del proceso de auditoría.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-2">
                <AccordionTrigger>
                  ¿Los empleados pueden registrar asistencia desde cualquier ubicación?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Técnicamente pueden intentar registrar desde cualquier
                    ubicación, pero el sistema captura las coordenadas GPS en
                    cada registro. El administrador puede verificar que la
                    ubicación corresponda al centro de trabajo. Registros desde
                    ubicaciones fuera del área laboral serán evidentes en los
                    reportes.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-3">
                <AccordionTrigger>
                  ¿Con qué frecuencia se actualiza el QR del terminal?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    El código QR dinámico de la terminal se renueva automáticamente
                    cada <strong>5 minutos</strong>. Esto garantiza la seguridad
                    del sistema, ya que los códigos expirados no son válidos para
                    el registro de asistencia.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-4">
                <AccordionTrigger>
                  ¿Cómo se calculan las horas extra los sábados?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    El sistema calcula las horas extra de forma diferente según
                    el día. Para lunes a viernes, la jornada estándar es de 8 horas.
                    Para sábado, el horario por defecto es de 09:00 a 14:00 (5 horas).
                    Las horas extra se calculan respecto al horario configurado
                    para cada día, y se pagan al doble de la tarifa normal conforme
                    al Artículo 67 de la LFT.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-5">
                <AccordionTrigger>
                  ¿Se pueden modificar los registros de asistencia?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    <strong>No.</strong> Los registros de asistencia son
                    inalterables por diseño, cumpliendo con los requisitos de la
                    NOM-037. Una vez creado un registro, no puede ser modificado
                    ni eliminado, ni siquiera por el administrador. Cualquier
                    corrección se realiza a través de un nuevo registro que queda
                    documentado en la auditoría.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-6">
                <AccordionTrigger>
                  ¿Qué pasa si un empleado no tiene acceso a GPS en su dispositivo?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    La geolocalización es un requisito obligatorio para el
                    registro de asistencia. Sin acceso GPS, el sistema no
                    permitirá registrar entrada ni salida. Asegúrese de que los
                    empleados tengan activados los servicios de ubicación en sus
                    dispositivos y hayan concedido los permisos necesarios al navegador.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-7">
                <AccordionTrigger>
                  ¿Cómo funcionan los reportes por sucursal?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Cada empleado está asignado a una sucursal (Matriz, Sucursal 1,
                    Sucursal 2 o Sucursal 3). Al generar un reporte, puede filtrar
                    por sucursal para ver únicamente los datos del centro de trabajo
                    seleccionado. Si no selecciona ninguna sucursal, el reporte
                    incluirá la información de todas las sucursales.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-8">
                <AccordionTrigger>
                  ¿Cuánto tiempo se conservan los datos?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Conforme a la NOM-037, todos los registros de asistencia se
                    conservan durante un mínimo de <strong>5 años</strong>.
                    Transcurrido este período, los datos son eliminados de forma
                    segura siguiendo los protocolos de protección de datos
                    personales.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-9">
                <AccordionTrigger>
                  ¿Cómo se crea un nuevo empleado?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Desde el Panel de Administración, en la sección de Empleados,
                    haga clic en &quot;Crear Empleado&quot;. Complete los datos
                    personales, posición, departamento, sucursal asignada y
                    configure los horarios de trabajo. El sistema generará
                    automáticamente un código QR personal y las credenciales de
                    acceso para el empleado.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-10">
                <AccordionTrigger>
                  ¿El sistema funciona sin conexión a internet?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    No. El sistema requiere conexión a internet para funcionar,
                    ya que los registros se almacenan en un servidor central que
                    garantiza la inalterabilidad y disponibilidad de los datos.
                    Sin conexión, no es posible registrar asistencia ni consultar
                    historial.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </SectionCard>

          {/* Footer */}
          <Separator />
          <div className="text-center text-sm text-muted-foreground pb-8 space-y-1">
            <p className="font-semibold">
              Sistema de Control de Asistencia — Manual del Administrador
            </p>
            <p>
              Cumplimiento NOM-037-STPS-2023 · Registros Inalterables ·
              Autenticación Dual · Geolocalización GPS · Multi-Sucursal
            </p>
            <p className="text-xs">
              Documentación generada automáticamente · Versión 2.0
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
