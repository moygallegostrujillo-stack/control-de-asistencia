"""
Generador del PDF: MANUAL DEL SISTEMA DE NOTIFICACIONES
Proyecto: Control de Asistencia v2.2.0
Fecha: actual

Documento de referencia que describe los DOS tipos de notificaciones
del sistema, cada una de las 10 alertas individuales + 3 eventos de audit
log, indicando:
  - Qué hace la notificación
  - Cuándo salta (trigger / condición)
  - Base legal u operacional
  - Severidad / Nivel
  - Recomendación de acción
  - Endpoint y componente UI asociado
"""
import os
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib import colors

OUTPUT = "/home/z/my-project/public/documentos/manual-de-notificaciones.pdf"

# Asegurar que existe el directorio
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

# Colores corporativos
COLOR_PRIMARY = HexColor('#1e3a5f')      # Azul oscuro corporativo
COLOR_SECONDARY = HexColor('#2d5a87')    # Azul medio
COLOR_ACCENT = HexColor('#c9a961')       # Dorado
COLOR_SUCCESS = HexColor('#16a34a')      # Verde
COLOR_DANGER = HexColor('#dc2626')        # Rojo
COLOR_WARNING = HexColor('#d97706')      # Ámbar
COLOR_INFO = HexColor('#0284c7')         # Cian
COLOR_BG_LIGHT = HexColor('#f8fafc')     # Gris muy claro
COLOR_BG_NOM = HexColor('#eef2ff')       # Azul muy claro (NOM-035)
COLOR_BG_SUP = HexColor('#fff7ed')       # Naranja muy claro (supervisor)
COLOR_BG_TABLE = HexColor('#1e3a5f')     # Header de tabla
COLOR_TEXT = HexColor('#1f2937')         # Gris oscuro
COLOR_MUTED = HexColor('#6b7280')        # Gris medio
COLOR_HIGH = HexColor('#dc2626')
COLOR_MEDIUM = HexColor('#d97706')
COLOR_LOW = HexColor('#6b7280')

# Estilos
styles = getSampleStyleSheet()

style_title = ParagraphStyle(
    'CustomTitle', parent=styles['Title'],
    fontSize=24, textColor=COLOR_PRIMARY, spaceAfter=12,
    alignment=TA_CENTER, fontName='Helvetica-Bold'
)

style_subtitle = ParagraphStyle(
    'CustomSubtitle', parent=styles['Normal'],
    fontSize=14, textColor=COLOR_SECONDARY, spaceAfter=6,
    alignment=TA_CENTER, fontName='Helvetica'
)

style_h1 = ParagraphStyle(
    'CustomH1', parent=styles['Heading1'],
    fontSize=18, textColor=COLOR_PRIMARY, spaceAfter=10,
    spaceBefore=16, fontName='Helvetica-Bold'
)

style_h2 = ParagraphStyle(
    'CustomH2', parent=styles['Heading2'],
    fontSize=14, textColor=COLOR_SECONDARY, spaceAfter=8,
    spaceBefore=12, fontName='Helvetica-Bold'
)

style_h3 = ParagraphStyle(
    'CustomH3', parent=styles['Heading3'],
    fontSize=12, textColor=COLOR_TEXT, spaceAfter=6,
    spaceBefore=8, fontName='Helvetica-Bold'
)

style_body = ParagraphStyle(
    'CustomBody', parent=styles['Normal'],
    fontSize=10, textColor=COLOR_TEXT, spaceAfter=6,
    alignment=TA_JUSTIFY, fontName='Helvetica', leading=14
)

style_cell = ParagraphStyle(
    'CustomCell', parent=styles['Normal'],
    fontSize=8.5, textColor=COLOR_TEXT, spaceAfter=0,
    alignment=TA_LEFT, fontName='Helvetica', leading=11
)

style_cell_small = ParagraphStyle(
    'CustomCellSmall', parent=styles['Normal'],
    fontSize=7.5, textColor=COLOR_TEXT, spaceAfter=0,
    alignment=TA_LEFT, fontName='Helvetica', leading=10
)

style_cell_header = ParagraphStyle(
    'CustomCellHeader', parent=styles['Normal'],
    fontSize=9, textColor=white, spaceAfter=0,
    alignment=TA_CENTER, fontName='Helvetica-Bold', leading=12
)

style_legal = ParagraphStyle(
    'CustomLegal', parent=styles['Normal'],
    fontSize=9, textColor=COLOR_MUTED, spaceAfter=4,
    alignment=TA_JUSTIFY, fontName='Helvetica-Oblique', leading=12
)

style_cover_title = ParagraphStyle(
    'CoverTitle', parent=styles['Title'],
    fontSize=30, textColor=COLOR_PRIMARY, spaceAfter=16,
    alignment=TA_CENTER, fontName='Helvetica-Bold'
)

style_cover_subtitle = ParagraphStyle(
    'CoverSubtitle', parent=styles['Normal'],
    fontSize=16, textColor=COLOR_SECONDARY, spaceAfter=8,
    alignment=TA_CENTER, fontName='Helvetica'
)


def header_footer(canvas, doc):
    """Header y footer en cada página."""
    canvas.saveState()
    width, height = A4

    # Header
    canvas.setFillColor(COLOR_PRIMARY)
    canvas.rect(0, height - 1.2*cm, width, 1.2*cm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont('Helvetica-Bold', 9)
    canvas.drawString(2*cm, height - 0.75*cm, "MANUAL DEL SISTEMA DE NOTIFICACIONES")
    canvas.setFont('Helvetica', 8)
    canvas.drawRightString(width - 2*cm, height - 0.75*cm, "Control de Asistencia v2.2.0")

    # Footer
    canvas.setFillColor(COLOR_MUTED)
    canvas.rect(0, 0, width, 0.8*cm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont('Helvetica', 8)
    canvas.drawString(2*cm, 0.3*cm, "Control de Asistencia v2.2.0  ·  Documento técnico de referencia")
    canvas.drawRightString(width - 2*cm, 0.3*cm, f"Página {doc.page}")

    canvas.restoreState()


def cover_page(canvas, doc):
    """Página de portada con fondo y diseño distintivo."""
    canvas.saveState()
    width, height = A4

    # Fondo superior
    canvas.setFillColor(COLOR_PRIMARY)
    canvas.rect(0, height - 8*cm, width, 8*cm, fill=1, stroke=0)

    # Banda dorada
    canvas.setFillColor(COLOR_ACCENT)
    canvas.rect(0, height - 8.5*cm, width, 0.5*cm, fill=1, stroke=0)

    # Fondo inferior claro
    canvas.setFillColor(COLOR_BG_LIGHT)
    canvas.rect(0, 0, width, height - 8.5*cm, fill=1, stroke=0)

    # Título principal
    canvas.setFillColor(white)
    canvas.setFont('Helvetica-Bold', 26)
    canvas.drawCentredString(width / 2, height - 4.2*cm, "MANUAL DEL SISTEMA")
    canvas.drawCentredString(width / 2, height - 5*cm, "DE NOTIFICACIONES")

    # Subtítulo
    canvas.setFont('Helvetica', 14)
    canvas.drawCentredString(width / 2, height - 6*cm, "Análisis exhaustivo de las alertas del sistema")
    canvas.setFont('Helvetica-Oblique', 12)
    canvas.drawCentredString(width / 2, height - 6.8*cm, "Control de Asistencia v2.2.0")

    # Caja de meta información (centrada, parte baja)
    meta_y = 4*cm
    canvas.setFillColor(white)
    canvas.setStrokeColor(COLOR_PRIMARY)
    canvas.setLineWidth(1)
    canvas.roundRect(2.5*cm, meta_y, width - 5*cm, 4*cm, 8, fill=1, stroke=1)

    canvas.setFillColor(COLOR_PRIMARY)
    canvas.setFont('Helvetica-Bold', 11)
    canvas.drawCentredString(width / 2, meta_y + 3.2*cm, "DOCUMENTO TÉCNICO DE REFERENCIA")

    canvas.setFillColor(COLOR_TEXT)
    canvas.setFont('Helvetica', 10)
    canvas.drawCentredString(width / 2, meta_y + 2.4*cm, "Sistema: Control de Asistencia v2.2.0")
    canvas.drawCentredString(width / 2, meta_y + 1.8*cm, "Cliente: Microempresa mexicana (< 15 empleados)")
    canvas.drawCentredString(width / 2, meta_y + 1.2*cm, "Tipos de notificaciones: 2 (NOM-035 y Supervisor)")
    canvas.drawCentredString(width / 2, meta_y + 0.6*cm, "Alertas documentadas: 10 + 3 eventos de audit log")

    # Fecha en el footer de la portada
    canvas.setFillColor(COLOR_MUTED)
    canvas.setFont('Helvetica-Oblique', 9)
    today = datetime.now().strftime("%d de %B de %Y")
    # Traducir mes a español
    meses = {'January': 'enero', 'February': 'febrero', 'March': 'marzo',
             'April': 'abril', 'May': 'mayo', 'June': 'junio',
             'July': 'julio', 'August': 'agosto', 'September': 'septiembre',
             'October': 'octubre', 'November': 'noviembre', 'December': 'diciembre'}
    for en, es in meses.items():
        today = today.replace(en, es)
    canvas.drawCentredString(width / 2, 1.2*cm, f"Generado el {today}")

    canvas.restoreState()


# ============================================================
# Definición de las notificaciones (datos centralizados)
# ============================================================

# --- Tipo 1: Alertas NOM-035 ---
NOM035_ALERTS = [
    {
        "code": "WEEKLY_OVERTIME_EXCEEDED",
        "title": "Exceso de horas extra semanales",
        "label": "Exceso horas extra",
        "level": "MEDIUM / HIGH (según excedente)",
        "trigger": (
            "El empleado acumula MÁS de 9 horas extra en la semana ISO (lunes a domingo). "
            "El cálculo se realiza al consultar el endpoint <b>/api/alerts/nom-035</b>, "
            "sumando <i>overtimeDoubleMinutes + overtimeTripleMinutes</i> de todos los "
            "AttendanceRecord de la semana."
        ),
        "threshold": "weeklyOvertimeMinutes &gt; 540 min (9 h) — art. 66 LFT, tope FIJO (no escala con reforma DOF 27-dic-2024).",
        "level_logic": "HIGH si el excedente &gt; 180 min (3 h). MEDIUM en caso contrario.",
        "legal_base": (
            "LFT art. 66 (tope semanal fijo de 9 horas extra). LFT art. 68 (las horas que excedan "
            "el tope semanal se pagan al TRIPLE). NOM-035-STPS-2018, categoría A.5 "
            "“Jornadas de trabajo excesivas” (factor de riesgo psicosocial)."
        ),
        "what_it_does": (
            "Aparece en la campana <b>NotificationBell</b> del header del admin con un badge rojo "
            "(HIGH) o ámbar (MEDIUM). Lista las horas extra acumuladas, el tope y el excedente. "
            "Recomienda redistribuir carga, contratar personal o autorizar expresamente las horas triple."
        ),
        "recommendation": (
            "Redistribuir carga de trabajo, contratar personal adicional, o autorizar expresamente "
            "las horas al triple. Documentar la causa (no es automático el pago triple; debe "
            "quedar evidencia)."
        ),
        "frequency": "Polling cada 5 minutos (300 s) en el badge. Recálculo al cierre de cada jornada.",
        "audit_event": "NOM035_ALERT_WEEKLY_OVERTIME (escrito en audit log al hacer check-out, con triggeredBy=CHECK_OUT).",
    },
    {
        "code": "DAILY_OVERTIME_EXCEEDED",
        "title": "Jornada diaria excesiva",
        "label": "Jornada diaria excesiva",
        "level": "HIGH (siempre)",
        "trigger": (
            "El empleado acumula MÁS de 4 horas extra EN UN SOLO DÍA. Se computa como "
            "<i>maxDailyOvertimeMinutes = max(overtimeDoubleMinutes + overtimeTripleMinutes)</i> "
            "entre todos los registros de la semana."
        ),
        "threshold": "maxDailyOvertimeMinutes &gt; 240 min (4 h) — art. 66 LFT, tope diario.",
        "level_logic": "Siempre HIGH. El tope diario de 4 h extra no puede excederse bajo ninguna circunstancia.",
        "legal_base": (
            "LFT art. 66 (tope diario de 4 horas extra). El excedente NO se paga como extra "
            "autorizada y constituye jornada no permitida. NOM-035-STPS-2018 (riesgo psicosocial)."
        ),
        "what_it_does": (
            "Aparece en la campana <b>NotificationBell</b> con badge rojo. Indica qué día se "
            "excedió y cuántas horas extra tiene ese registro. Advierte que el excedente no es "
            "extra autorizada."
        ),
        "recommendation": (
            "Evitar asignar más de 4 horas extra en un solo día. Si fue emergencia (art. 65 LFT "
            "— caso fortuito o fuerza mayor), documentarla en el expediente del empleado."
        ),
        "frequency": "Polling cada 5 minutos. Recálculo al check-out.",
        "audit_event": "No genera entrada de audit log propia (el cálculo es reactivo, no al check-out). Se evidencia en el detalle del registro de AttendanceRecord.",
    },
    {
        "code": "CONSECUTIVE_LONG_DAYS",
        "title": "Sobrecarga sostenida",
        "label": "Sobrecarga sostenida",
        "level": "MEDIUM / HIGH",
        "trigger": (
            "El empleado registra 3 o más días CONSECUTIVOS con horas extra (cualquier cantidad "
            "&gt; 0) dentro de la semana actual. Se computa recorriendo los registros en orden "
            "cronológico y contando la racha más larga."
        ),
        "threshold": "consecutiveLongDays &gt;= 3 (MEDIUM). consecutiveLongDays &gt;= 5 (HIGH).",
        "level_logic": "HIGH si la racha es ≥ 5 días. MEDIUM si es 3 o 4 días.",
        "legal_base": (
            "NOM-035-STPS-2018, categoría A.5 (identificación de factores de riesgo psicosocial "
            "por sobrecarga sostenida). Referencia: LFT arts. 66/68 (marco de horas extra)."
        ),
        "what_it_does": (
            "Aparece en la campana <b>NotificationBell</b>. Muestra el número de días consecutivos "
            "con overtime y advierte sobre el patrón de sobrecarga como factor de riesgo psicosocial."
        ),
        "recommendation": (
            "Revisar la carga laboral del empleado y organizar turnos para evitar días "
            "consecutivos con overtime. Aplicar referencia NOM-035 para identificación de "
            "riesgos psicosociales."
        ),
        "frequency": "Polling cada 5 minutos. Recálculo al check-out.",
        "audit_event": "No genera entrada de audit log propia. Es una alerta visual informativa.",
    },
    {
        "code": "NO_WEEKLY_REST",
        "title": "Sin día de descanso configurado",
        "label": "Sin descanso semanal",
        "level": "HIGH (siempre)",
        "trigger": (
            "El empleado NO tiene ningún WorkSchedule con <i>isWeeklyRest = true</i> en su "
            "configuración de horario. Es una verificación puramente de configuración (no "
            "depende de los registros de asistencia)."
        ),
        "threshold": "No existe ningún WorkSchedule con isWeeklyRest=true para el empleado.",
        "level_logic": "Siempre HIGH. Es un incumplimiento del art. 71 LFT (descanso semanal obligatorio).",
        "legal_base": (
            "LFT art. 71 (todo empleado tiene derecho a un día de descanso por cada seis de "
            "trabajo, preferentemente domingo). LFT art. 70 (días de descanso)."
        ),
        "what_it_does": (
            "Aparece en la campana <b>NotificationBell</b> con badge rojo. Advierte que el "
            "empleado no tiene día de descanso marcado en su horario y que esto es un "
            "incumplimiento del art. 71 LFT."
        ),
        "recommendation": (
            "Editar el empleado (vista de empleados) y marcar al menos 1 día como "
            "“Descanso” en su horario semanal. Es un cambio de configuración, no de operación."
        ),
        "frequency": "Polling cada 5 minutos. Se resuelve al editar el horario del empleado.",
        "audit_event": "No genera entrada de audit log propia. Se evidencia al revisar WorkSchedule del empleado.",
    },
    {
        "code": "REST_DAY_WORKED",
        "title": "Día de descanso trabajado",
        "label": "Día de descanso trabajado",
        "level": "MEDIUM / HIGH",
        "trigger": (
            "Al menos un AttendanceRecord de la semana tiene <i>isRestDayWorked = true</i>. "
            "Esto ocurre cuando el empleado hace check-in y check-out en su día de descanso "
            "configurado. El recargo del 100% (art. 73 LFT) se aplica automáticamente al "
            "calcular el overtime en check-out."
        ),
        "threshold": "Cualquier registro con isRestDayWorked=true en la semana.",
        "level_logic": "HIGH si fue domingo (también aplica prima dominical art. 71 LFT). MEDIUM si fue otro día de descanso.",
        "legal_base": (
            "LFT art. 73 (si el trabajador labora en su día de descanso, tiene derecho a que "
            "se le pague la jornada completa con una prima del 100% adicional). LFT art. 71 "
            "(prima dominical del 25% sobre el salario ordinario si el descanso es domingo)."
        ),
        "what_it_does": (
            "Aparece en la campana <b>NotificationBell</b>. Muestra el día específico, los "
            "minutos trabajados y si aplica prima dominical. Advierte que debe pagarse la "
            "jornada completa con prima del 100% adicional."
        ),
        "recommendation": (
            "Pagar la jornada completa con prima del 100% adicional (art. 73 LFT). Si fue "
            "domingo, también aplica prima dominical del 25% (art. 71 LFT)."
        ),
        "frequency": "Polling cada 5 minutos. Disparada al hacer check-out en día de descanso.",
        "audit_event": "NOM035_ALERT_REST_DAY_WORKED (escrito en audit log al hacer check-out, con alertLevel HIGH si es domingo, MEDIUM si no).",
    },
]

# --- Tipo 2: Alertas de Asistencia (Supervisor) ---
SUPERVISOR_ALERTS = [
    {
        "code": "RETARDOS_RECURRENTES",
        "title": "Retardos recurrentes",
        "label": "Retardos recurrentes",
        "severity": "warning / critical",
        "trigger": (
            "El empleado acumula 3 o más registros con <i>status = 'LATE'</i> en los últimos "
            "N días (default 7). El estado LATE lo asigna el overtime-calculator cuando el "
            "check-in excede la tolerancia configurada en la sucursal."
        ),
        "threshold": "lateCount &gt;= 3 (warning). lateCount &gt;= 5 (critical).",
        "severity_logic": "CRITICAL si tiene 5+ retardos. WARNING si tiene 3-4 retardos.",
        "legal_base": (
            "Base operacional (no cita un artículo específico de la LFT). Es un patrón de "
            "conducta que puede derivar en rescisión de relación laboral por faltas de "
            "asistencia injustificadas (art. 47 fr. IX LFT) si se acumula y no se justifica."
        ),
        "what_it_does": (
            "Aparece en la campana <b>SupervisorAlertsBell</b> del header del admin. Muestra "
            "el número de retardos en el periodo y permite navegar al calendario del empleado."
        ),
        "recommendation": (
            "Hablar con el empleado para entender las causas. Si reincide, documento de "
            "amonestación por escrito (constituye evidencia laboral). Si el patrón es "
            "justificado (transporte, enfermedad), considerar ajuste de horario."
        ),
        "frequency": "Polling cada 5 minutos. Ventana por defecto: 7 días (configurable hasta 30).",
        "audit_event": "No genera entrada de audit log propia. Es una alerta de gestión operacional.",
    },
    {
        "code": "AUSENCIA_CONSECUTIVA",
        "title": "Ausencia consecutiva",
        "label": "Ausencia consecutiva",
        "severity": "critical (siempre)",
        "trigger": (
            "El empleado está ausente (no tiene registro Y no está en vacaciones / feriado / "
            "día de descanso) en los últimos 3 días consecutivos (hoy, ayer y antier). El "
            "cálculo usa <i>computeAbsentsForDate</i> que respeta vacaciones, feriados y "
            "horarios del empleado."
        ),
        "threshold": "Ausente en los últimos 3 días consecutivos (hoy, ayer, antier).",
        "severity_logic": "Siempre CRITICAL. Tres días de ausencia sin justificar es presunción de abandono de empleo.",
        "legal_base": (
            "Base operacional con fundamento en LFT art. 47 fr. I (falsedades o abandono). "
            "La presunción de abandono de empleo requiere 2 faltas consecutivas sin causa "
            "justificada (jurisprudencia). Tres días consecutivos es presunción fuerte."
        ),
        "what_it_does": (
            "Aparece en la campana <b>SupervisorAlertsBell</b> con badge rojo. Muestra los "
            "días específicos de ausencia y permite navegar al calendario del empleado."
        ),
        "recommendation": (
            "Contactar al empleado de inmediato (teléfono, correo). Si no responde en 24-48 h, "
            "iniciar acta de abandono de empleo. Documentar las fechas de ausencia como "
            "evidencia laboral."
        ),
        "frequency": "Polling cada 5 minutos. Recálculo diario (al caer el día).",
        "audit_event": "No genera entrada de audit log propia. La evidencia queda en los AttendanceRecord con status=ABSENT.",
    },
    {
        "code": "EXCESO_DESCANSO",
        "title": "Exceso de descanso",
        "label": "Exceso de descanso",
        "severity": "info / warning",
        "trigger": (
            "El empleado excede el tiempo de descanso (comida o descanso de 30 min) 2 o más "
            "veces en los últimos N días. Se computa como <i>mealExceeded || restExceeded</i> "
            "en los AttendanceRecord."
        ),
        "threshold": "exceededCount &gt;= 2 (info). exceededCount &gt;= 4 (warning).",
        "severity_logic": "WARNING si tiene 4+ excesos. INFO si tiene 2-3 excesos.",
        "legal_base": (
            "Base operacional. El descanso de 30 min dentro de jornada está regulado por "
            "LFT art. 63 (descanso continuo de media hora en jornadas &gt; 5.5 h). Excederlo "
            "es tiempo no laborado, no overtime."
        ),
        "what_it_does": (
            "Aparece en la campana <b>SupervisorAlertsBell</b>. Muestra el número de excesos "
            "en el periodo y permite navegar al calendario del empleado."
        ),
        "recommendation": (
            "Revisar con el empleado las causas (sobrecarga, fatiga, problemas personales). "
            "Si reincide, amonestación por escrito. Considerar ajustar la duración del "
            "descanso si la naturaleza del trabajo lo justifica (art. 63 LFT)."
        ),
        "frequency": "Polling cada 5 minutos. Ventana por defecto: 7 días.",
        "audit_event": "No genera entrada de audit log propia. La evidencia queda en mealExceeded/restExceeded de los registros.",
    },
    {
        "code": "SALIDAS_TEMPRANO",
        "title": "Salidas temprano",
        "label": "Salidas temprano",
        "severity": "info / warning",
        "trigger": (
            "El empleado acumula 3 o más registros con <i>status = 'EARLY_LEAVE'</i> en los "
            "últimos N días. El estado EARLY_LEAVE lo asigna el overtime-calculator cuando "
            "el check-out es anterior a la hora de salida programada, excediendo la "
            "tolerancia de salida (checkoutToleranceMinutes) de la sucursal."
        ),
        "threshold": "earlyLeaveCount &gt;= 3 (info). earlyLeaveCount &gt;= 5 (warning).",
        "severity_logic": "WARNING si tiene 5+ salidas temprano. INFO si tiene 3-4.",
        "legal_base": (
            "Base operacional. Salidas anticipadas injustificadas pueden considerarse "
            "abandono de jornada (art. 47 fr. X LFT — disminuir el trabajo sin causa justificada)."
        ),
        "what_it_does": (
            "Aparece en la campana <b>SupervisorAlertsBell</b>. Muestra el número de salidas "
            "temprano y permite navegar al calendario del empleado."
        ),
        "recommendation": (
            "Verificar si las salidas están justificadas (cita médica, permiso, etc.). Si no "
            "lo están, amonestación por escrito. Si el horario no encaja con el empleado, "
            "considerar cambio de turno."
        ),
        "frequency": "Polling cada 5 minutos. Ventana por defecto: 7 días.",
        "audit_event": "No genera entrada de audit log propia. La evidencia queda en los AttendanceRecord con status=EARLY_LEAVE.",
    },
    {
        "code": "SIN_CHECKOUT",
        "title": "Sin registro de salida",
        "label": "Sin registro de salida",
        "severity": "warning (siempre)",
        "trigger": (
            "El empleado hizo check-in hoy, NO ha hecho check-out, y ya pasaron al menos 8 "
            "horas desde el check-in. Se computa comparando <i>r.checkInTime</i> con la hora "
            "actual. Solo aplica a registros del día en curso."
        ),
        "threshold": "r.checkInTime &amp;&amp; !r.checkOutTime &amp;&amp; (Date.now() - checkInTime) &gt;= 8 h.",
        "severity_logic": "Siempre WARNING. El empleado se pudo haber ido sin registrar salida.",
        "legal_base": (
            "Base operacional. El registro de salida es obligatorio para calcular horas "
            "trabajadas y overtime (LFT art. 80 — obligación del patrón de llevar registros "
            "de asistencia)."
        ),
        "what_it_does": (
            "Aparece en la campana <b>SupervisorAlertsBell</b> con badge ámbar. Muestra cuántas "
            "horas han pasado desde el check-in y permite navegar al calendario del empleado."
        ),
        "recommendation": (
            "Contactar al empleado para confirmar si se fue. Si sí, registrar la salida "
            "manualmente (vista de correcciones) con la hora real reportada. Si no, el "
            "sistema cierra automáticamente el registro a las 23:59 (sin overtime)."
        ),
        "frequency": "Polling cada 5 minutos. Solo aplica al día en curso.",
        "audit_event": "No genera entrada de audit log propia. La corrección manual (si aplica) genera CORRECTION_APPROVED en audit log.",
    },
]

# --- Eventos adicionales de audit log (no son campana pero son notificaciones) ---
AUDIT_EVENTS = [
    {
        "code": "NOM035_ALERT_WEEKLY_OVERTIME",
        "title": "Alerta automática al cruzar tope semanal de horas extra",
        "trigger": "Al hacer check-out, si el acumulado semanal de overtime del empleado excede 9 h y se generaron minutos al triple (calc.overtimeTripleMinutes > 0).",
        "level": "HIGH si excedente > 180 min (3 h). MEDIUM en caso contrario.",
        "legal_base": "LFT art. 66/68 (tope semanal fijo 9 h); NOM-035-STPS-2018 A.5. Evidencia para auditoría STPS.",
        "where_logged": "Audit log con action=NOM035_ALERT_WEEKLY_OVERTIME, entityType=ATTENDANCE_RECORD, triggeredBy=CHECK_OUT.",
    },
    {
        "code": "NOM035_ALERT_REST_DAY_WORKED",
        "title": "Alerta automática al trabajar en día de descanso",
        "trigger": "Al hacer check-out, si calc.isRestDayWorked = true y restDayWorkedMinutes > 0 (el empleado trabajó en su día de descanso).",
        "level": "HIGH si es domingo (también aplica prima dominical). MEDIUM si es otro día de descanso.",
        "legal_base": "LFT art. 73 (prima del 100% por descanso trabajado); art. 71 (prima dominical).",
        "where_logged": "Audit log con action=NOM035_ALERT_REST_DAY_WORKED, entityType=ATTENDANCE_RECORD, triggeredBy=CHECK_OUT.",
    },
    {
        "code": "MINOR_OVERTIME_BLOCKED",
        "title": "Bloqueo de horas extra para menor de 18 años",
        "trigger": "Al hacer check-out, si calc.minorOvertimeBlocked = true (el empleado es menor de 18 años al momento del registro y el overtime calculator bloqueó el cálculo).",
        "level": "HIGH (siempre). Es un incumplimiento potencial de los arts. 22, 23, 175 LFT.",
        "legal_base": "LFT arts. 22, 23, 175; Art. 123 Constitucional A fr. II (prohibición de horas extra para menores de 18 años).",
        "where_logged": "Audit log con action=MINOR_OVERTIME_BLOCKED, entityType=ATTENDANCE_RECORD, triggeredBy=CHECK_OUT.",
    },
]


def build_alert_card(alert, kind):
    """Construye una tarjeta de alerta como flowable."""
    bg = COLOR_BG_NOM if kind == 'nom035' else COLOR_BG_SUP
    border = COLOR_SECONDARY if kind == 'nom035' else COLOR_WARNING

    # Header
    level_label = "Nivel" if kind == 'nom035' else "Severidad"
    level_value = alert.get('level') or alert.get('severity', '')
    threshold_value = alert.get('threshold', '')
    severity_logic_value = alert.get('level_logic') or alert.get('severity_logic', '')

    header_data = [[
        Paragraph(f"<b>{alert['code']}</b>", ParagraphStyle('h', parent=style_cell, textColor=white, fontSize=10, fontName='Helvetica-Bold')),
        Paragraph(f"<b>{alert['title']}</b>", ParagraphStyle('ht', parent=style_cell, textColor=white, fontSize=10, fontName='Helvetica-Bold', alignment=TA_LEFT)),
    ]]
    header_tbl = Table(header_data, colWidths=[5.5*cm, 11.5*cm])
    header_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), border),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))

    # Body content
    body_rows = [
        [Paragraph(f"<b>{level_label}:</b>", style_cell), Paragraph(level_value, style_cell)],
        [Paragraph("<b>Etiqueta en UI:</b>", style_cell), Paragraph(alert['label'], style_cell)],
        [Paragraph("<b>Trigger (cuándo salta):</b>", style_cell), Paragraph(alert['trigger'], style_cell)],
        [Paragraph("<b>Umbral:</b>", style_cell), Paragraph(threshold_value, style_cell)],
    ]
    if kind == 'nom035':
        body_rows.append([Paragraph("<b>Lógica de nivel:</b>", style_cell), Paragraph(alert['level_logic'], style_cell)])
    else:
        body_rows.append([Paragraph("<b>Lógica de severidad:</b>", style_cell), Paragraph(alert['severity_logic'], style_cell)])

    body_rows.extend([
        [Paragraph("<b>Base legal / operacional:</b>", style_cell), Paragraph(alert['legal_base'], style_cell)],
        [Paragraph("<b>Qué hace:</b>", style_cell), Paragraph(alert['what_it_does'], style_cell)],
        [Paragraph("<b>Recomendación:</b>", style_cell), Paragraph(alert['recommendation'], style_cell)],
        [Paragraph("<b>Frecuencia:</b>", style_cell), Paragraph(alert['frequency'], style_cell)],
        [Paragraph("<b>Evento en audit log:</b>", style_cell), Paragraph(alert['audit_event'], style_cell)],
    ])

    body_tbl = Table(body_rows, colWidths=[4.5*cm, 12.5*cm])
    body_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -2), 0.25, white),
        ('LINEBEFORE', (0, 0), (0, -1), 2, border),
    ]))

    return KeepTogether([header_tbl, body_tbl, Spacer(1, 8)])


def build_audit_event_card(event):
    """Construye una tarjeta compacta para un evento de audit log."""
    header_data = [[
        Paragraph(f"<b>{event['code']}</b>", ParagraphStyle('h', parent=style_cell, textColor=white, fontSize=10, fontName='Helvetica-Bold')),
        Paragraph(f"<b>{event['title']}</b>", ParagraphStyle('ht', parent=style_cell, textColor=white, fontSize=10, fontName='Helvetica-Bold', alignment=TA_LEFT)),
    ]]
    header_tbl = Table(header_data, colWidths=[6.5*cm, 10.5*cm])
    header_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_DANGER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))

    body_rows = [
        [Paragraph("<b>Trigger:</b>", style_cell), Paragraph(event['trigger'], style_cell)],
        [Paragraph("<b>Nivel:</b>", style_cell), Paragraph(event['level'], style_cell)],
        [Paragraph("<b>Base legal:</b>", style_cell), Paragraph(event['legal_base'], style_cell)],
        [Paragraph("<b>Dónde se registra:</b>", style_cell), Paragraph(event['where_logged'], style_cell)],
    ]
    body_tbl = Table(body_rows, colWidths=[4.5*cm, 12.5*cm])
    body_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#fef2f2')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -2), 0.25, white),
        ('LINEBEFORE', (0, 0), (0, -1), 2, COLOR_DANGER),
    ]))

    return KeepTogether([header_tbl, body_tbl, Spacer(1, 8)])


def build_summary_table():
    """Tabla comparativa de los dos tipos de notificaciones."""
    header = ['Característica', 'NOM-035 (Jornada excesiva)', 'Supervisor (Asistencia)']

    rows = [
        ['Componente UI', 'NotificationBell', 'SupervisorAlertsBell'],
        ['Endpoint', '/api/alerts/nom-035', '/api/alerts/supervisor-alerts'],
        ['Query params', '?week=current|last|startDate|endDate', '?days=7|sucursalId'],
        ['Polling', 'Cada 5 minutos (300 s)', 'Cada 5 minutos (300 s)'],
        ['Niveles', 'HIGH / MEDIUM / LOW', 'critical / warning / info'],
        ['Núm. de alertas', '5 tipos', '5 tipos'],
        ['Base principal', 'NOM-035-STPS-2018 + LFT arts. 66, 68, 71, 73', 'Patrones operacionales de asistencia'],
        ['Visible para', 'GENERAL_ADMIN, SUCURSAL_ADMIN, SUPERVISOR', 'GENERAL_ADMIN, SUCURSAL_ADMIN, SUPERVISOR'],
        ['Filtro por sucursal', 'Sí (SUCURSAL_ADMIN auto-filtrado)', 'Sí (GA opcional, SUCURSAL_ADMIN auto-filtrado)'],
        ['Navega a', 'Vista "Alertas de jornada" del admin', 'Calendario del empleado'],
        ['Genera audit log', 'Sí (NOM035_ALERT_WEEKLY_OVERTIME, NOM035_ALERT_REST_DAY_WORKED)', 'No (solo alerta visual)'],
    ]

    data = [[Paragraph(f"<b>{h}</b>", style_cell_header) for h in header]]
    for row in rows:
        data.append([Paragraph(c, style_cell) for c in row])

    tbl = Table(data, colWidths=[3.5*cm, 7*cm, 6.5*cm])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_MUTED),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, COLOR_BG_LIGHT]),
    ]))
    return tbl


def build_alert_codes_table(alerts, kind):
    """Tabla con el código, etiqueta y severidad/nivel de cada alerta."""
    if kind == 'nom035':
        header = ['Código (type)', 'Etiqueta UI', 'Nivel', 'Disparador principal']
    else:
        header = ['Código (type)', 'Etiqueta UI', 'Severidad', 'Disparador principal']

    data = [[Paragraph(f"<b>{h}</b>", style_cell_header) for h in header]]

    short_triggers = {
        'WEEKLY_OVERTIME_EXCEEDED': 'Overtime semanal &gt; 9 h (art. 66 LFT)',
        'DAILY_OVERTIME_EXCEEDED': 'Overtime diario &gt; 4 h (art. 66 LFT)',
        'CONSECUTIVE_LONG_DAYS': '3+ días consecutivos con overtime',
        'NO_WEEKLY_REST': 'No hay WorkSchedule.isWeeklyRest=true',
        'REST_DAY_WORKED': 'isRestDayWorked=true en registro (art. 73)',
        'RETARDOS_RECURRENTES': '3+ status=LATE en 7 días',
        'AUSENCIA_CONSECUTIVA': 'Ausente 3 días consecutivos (hoy, ayer, antier)',
        'EXCESO_DESCANSO': '2+ excesos mealExceeded|restExceeded en 7 días',
        'SALIDAS_TEMPRANO': '3+ status=EARLY_LEAVE en 7 días',
        'SIN_CHECKOUT': 'check-in sin check-out 8 h después',
    }

    for a in alerts:
        level = a.get('level') or a.get('severity', '')
        trigger = short_triggers.get(a['code'], '')
        data.append([
            Paragraph(f"<font face='Helvetica-Bold'>{a['code']}</font>", style_cell_small),
            Paragraph(a['label'], style_cell_small),
            Paragraph(level, style_cell_small),
            Paragraph(trigger, style_cell_small),
        ])

    tbl = Table(data, colWidths=[5*cm, 3.8*cm, 2.7*cm, 5.5*cm])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_MUTED),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, COLOR_BG_LIGHT]),
    ]))
    return tbl


def build_doc():
    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=1.6*cm, bottomMargin=1.4*cm,
        title="Manual del Sistema de Notificaciones — Control de Asistencia v2.2.0",
        author="Control de Asistencia v2.2.0",
        subject="Análisis exhaustivo de las notificaciones del sistema",
    )

    story = []

    # ============================================================
    # PORTADA (la dibuja canvas; aquí solo un page break vacío)
    # ============================================================
    story.append(Spacer(1, 1))  # placeholder, la portada se dibuja con canvas
    story.append(PageBreak())

    # ============================================================
    # ÍNDICE / RESUMEN EJECUTIVO
    # ============================================================
    story.append(Paragraph("Resumen ejecutivo", style_h1))
    story.append(Paragraph(
        "El sistema de Control de Asistencia v2.2.0 implementa <b>dos tipos de notificaciones</b> "
        "diferenciados por su propósito, base normativa y patrón de disparo. Este documento "
        "describe en detalle cada una de las 10 alertas que componen el sistema, más 3 "
        "eventos adicionales de audit log que también constituyen notificaciones para efectos "
        "de evidencia y cumplimiento normativo.",
        style_body))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Las notificaciones NO son mensajes push ni correos electrónicos. Son <b>badges en el "
        "header del panel de administrador</b> que muestran un contador con el total de alertas "
        "activas y, al hacer clic, despliegan una lista con los detalles. Cada alerta puede "
        "navegar a una vista específica del admin para revisar el caso concreto.",
        style_body))
    story.append(Spacer(1, 8))

    # Los dos tipos en tarjetas
    nom_card = [
        Paragraph("<b>TIPO 1</b>", ParagraphStyle('t1', parent=style_cell, fontSize=9, textColor=white, alignment=TA_CENTER, fontName='Helvetica-Bold')),
        Paragraph("<b>Alertas de Jornada Excesiva</b>", ParagraphStyle('t1b', parent=style_cell, fontSize=11, textColor=white, alignment=TA_CENTER, fontName='Helvetica-Bold')),
        Paragraph("(NOM-035)", ParagraphStyle('t1c', parent=style_cell, fontSize=9, textColor=white, alignment=TA_CENTER, fontName='Helvetica-Oblique')),
        Paragraph("5 tipos de alerta", ParagraphStyle('t1d', parent=style_cell, fontSize=8, textColor=white, alignment=TA_CENTER)),
        Paragraph("Base legal: LFT + NOM-035", ParagraphStyle('t1e', parent=style_cell, fontSize=8, textColor=white, alignment=TA_CENTER)),
    ]
    sup_card = [
        Paragraph("<b>TIPO 2</b>", ParagraphStyle('t2', parent=style_cell, fontSize=9, textColor=white, alignment=TA_CENTER, fontName='Helvetica-Bold')),
        Paragraph("<b>Alertas de Asistencia</b>", ParagraphStyle('t2b', parent=style_cell, fontSize=11, textColor=white, alignment=TA_CENTER, fontName='Helvetica-Bold')),
        Paragraph("(Supervisor)", ParagraphStyle('t2c', parent=style_cell, fontSize=9, textColor=white, alignment=TA_CENTER, fontName='Helvetica-Oblique')),
        Paragraph("5 tipos de alerta", ParagraphStyle('t2d', parent=style_cell, fontSize=8, textColor=white, alignment=TA_CENTER)),
        Paragraph("Base operacional", ParagraphStyle('t2e', parent=style_cell, fontSize=8, textColor=white, alignment=TA_CENTER)),
    ]

    cards_tbl = Table(
        [[nom_card, sup_card]],
        colWidths=[8.5*cm, 8.5*cm],
        rowHeights=[3.2*cm],
    )
    cards_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), COLOR_SECONDARY),
        ('BACKGROUND', (1, 0), (1, 0), COLOR_WARNING),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(cards_tbl)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Tabla comparativa", style_h2))
    story.append(build_summary_table())
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        "Las notificaciones son <b>reactivas (polling)</b>, no push. Cada campana consulta su "
        "endpoint cada 5 minutos. Esto significa que entre el evento que dispara la alerta "
        "(por ejemplo, un check-out) y la aparición del badge puede haber hasta 5 minutos de "
        "latencia. Para casos que requieren evidencia inmediata (tope semanal de horas extra, "
        "día de descanso trabajado, menor de edad con overtime bloqueado), el sistema escribe "
        "<b>además</b> una entrada en el audit log al momento del check-out, sin esperar al "
        "próximo ciclo de polling.",
        style_body))

    story.append(PageBreak())

    # ============================================================
    # TIPO 1: NOM-035
    # ============================================================
    story.append(Paragraph("Tipo 1 — Alertas de Jornada Excesiva (NOM-035)", style_h1))
    story.append(Paragraph(
        "Estas alertas detectan <b>factores de riesgo psicosocial</b> derivados de jornadas "
        "de trabajo excesivas. La base normativa principal es la NOM-035-STPS-2018 (categoría "
        "A.5 “Jornadas de trabajo excesivas”), complementada con la LFT en los artículos 66, "
        "68, 71 y 73. El objetivo es que el administrador identifique proactivamente patrones "
        "de sobrecarga laboral que puedan derivar en riesgo psicosocial, multas de la STPS "
        "o reclamos laborales.",
        style_body))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Componentes y endpoints", style_h2))
    story.append(Paragraph(
        "<b>Campana UI:</b> <font face='Courier'>NotificationBell</font> "
        "(<font face='Courier'>src/components/admin/notification-bell.tsx</font>).<br/>"
        "<b>Endpoint:</b> <font face='Courier'>GET /api/alerts/nom-035</font>.<br/>"
        "<b>Query params:</b> "
        "<font face='Courier'>?week=current|last</font> (semana actual o anterior), o "
        "<font face='Courier'>?startDate=YYYY-MM-DD&amp;endDate=YYYY-MM-DD</font> "
        "(rango arbitrario, dividido en semanas ISO).<br/>"
        "<b>Polling:</b> cada 5 minutos (300 s).<br/>"
        "<b>Acceso:</b> GENERAL_ADMIN (todas las sucursales), SUCURSAL_ADMIN (solo su sucursal), "
        "SUPERVISOR (solo su sucursal, desde 26-ago-2026).<br/>"
        "<b>Navega a:</b> vista “Alertas de jornada” del admin "
        "(<font face='Courier'>adminView = 'nom-035'</font>).",
        style_body))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Códigos de alerta — resumen", style_h2))
    story.append(build_alert_codes_table(NOM035_ALERTS, 'nom035'))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Detalle de cada alerta", style_h2))
    story.append(Paragraph(
        "A continuación se documenta cada una de las 5 alertas del Tipo 1, con su trigger, "
        "umbral, lógica de nivel, base legal, qué hace la notificación en la UI, recomendación "
        "de acción y evento de audit log asociado.",
        style_body))
    story.append(Spacer(1, 6))

    for alert in NOM035_ALERTS:
        story.append(build_alert_card(alert, 'nom035'))

    story.append(PageBreak())

    # ============================================================
    # TIPO 2: SUPERVISOR
    # ============================================================
    story.append(Paragraph("Tipo 2 — Alertas de Asistencia (Supervisor)", style_h1))
    story.append(Paragraph(
        "Estas alertas detectan <b>patrones de conducta inadecuada</b> en la asistencia de "
        "los empleados. Su base es operacional (no citan un artículo específico de la LFT), "
        "pero los patrones que detectan pueden derivar en causales de rescisión de la relación "
        "laboral (art. 47 LFT) si no se gestionan. El objetivo es que el supervisor identifique "
        "proactivamente empleados con problemas de puntualidad, ausencias, o registros "
        "incompletos, y pueda intervenir antes de que el patrón escale a medidas disciplinarias.",
        style_body))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Componentes y endpoints", style_h2))
    story.append(Paragraph(
        "<b>Campana UI:</b> <font face='Courier'>SupervisorAlertsBell</font> "
        "(<font face='Courier'>src/components/admin/supervisor-alerts-bell.tsx</font>).<br/>"
        "<b>Endpoint:</b> <font face='Courier'>GET /api/alerts/supervisor-alerts</font>.<br/>"
        "<b>Query params:</b> "
        "<font face='Courier'>?days=7</font> (ventana de análisis, 1-30), "
        "<font face='Courier'>?sucursalId=X</font> (GA puede elegir; SUCURSAL_ADMIN forzado "
        "al propio).<br/>"
        "<b>Polling:</b> cada 5 minutos (300 s).<br/>"
        "<b>Acceso:</b> GENERAL_ADMIN, SUCURSAL_ADMIN, SUPERVISOR. EMPLOYEE no tiene acceso "
        "(403).<br/>"
        "<b>Navega a:</b> calendario del empleado "
        "(<font face='Courier'>adminView = 'calendar'</font> con "
        "<font face='Courier'>preselectedEmployeeId = alert.employeeId</font>).<br/>"
        "<b>Visibilidad:</b> si no hay alertas activas, el componente retorna null (no se "
        "muestra el badge). Esto es dist del NotificationBell, que siempre se muestra.",
        style_body))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Códigos de alerta — resumen", style_h2))
    story.append(build_alert_codes_table(SUPERVISOR_ALERTS, 'supervisor'))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Detalle de cada alerta", style_h2))
    story.append(Paragraph(
        "A continuación se documenta cada una de las 5 alertas del Tipo 2, con su trigger, "
        "umbral, lógica de severidad, base operacional, qué hace la notificación en la UI, "
        "recomendación de acción y evento de audit log asociado.",
        style_body))
    story.append(Spacer(1, 6))

    for alert in SUPERVISOR_ALERTS:
        story.append(build_alert_card(alert, 'supervisor'))

    story.append(PageBreak())

    # ============================================================
    # EVENTOS DE AUDIT LOG
    # ============================================================
    story.append(Paragraph("Eventos adicionales de audit log", style_h1))
    story.append(Paragraph(
        "Además de las 10 alertas que aparecen en las campanas, el sistema escribe 3 eventos "
        "especiales en el audit log al momento del check-out. Estos NO aparecen como badge "
        "en el header, pero constituyen <b>notificaciones auditables</b> que el administrador "
        "puede consultar en la vista “Auditoría” del panel. Su propósito es dejar evidencia "
        "inmediata (sin esperar al próximo ciclo de polling) de eventos críticos desde el "
        "punto de vista legal.",
        style_body))
    story.append(Spacer(1, 8))

    for event in AUDIT_EVENTS:
        story.append(build_audit_event_card(event))

    story.append(Spacer(1, 12))

    # ============================================================
    # MATRIZ DE DISPARO
    # ============================================================
    story.append(Paragraph("Matriz de disparo — cuándo salta cada notificación", style_h1))
    story.append(Paragraph(
        "Tabla condensada que resume, para cada notificación, el evento que la dispara y "
        "el componente donde se evidencia.",
        style_body))
    story.append(Spacer(1, 6))

    matriz_header = ['Notificación', 'Evento disparador', 'Dónde se evidencia']
    matriz_rows = [
        ['WEEKLY_OVERTIME_EXCEEDED', 'Cierre de jornada (check-out) con overtime semanal > 9 h', 'Campana NOM-035'],
        ['DAILY_OVERTIME_EXCEEDED', 'Cierre de jornada (check-out) con overtime diario > 4 h', 'Campana NOM-035'],
        ['CONSECUTIVE_LONG_DAYS', '3+ días consecutivos con overtime en la semana', 'Campana NOM-035'],
        ['NO_WEEKLY_REST', 'Empleado sin WorkSchedule.isWeeklyRest=true (configuración)', 'Campana NOM-035'],
        ['REST_DAY_WORKED', 'Check-in + check-out en día de descanso semanal', 'Campana NOM-035 + audit log'],
        ['NOM035_ALERT_WEEKLY_OVERTIME', 'Check-out que hace cruzar tope semanal de overtime', 'Audit log (vista Auditoría)'],
        ['NOM035_ALERT_REST_DAY_WORKED', 'Check-out con isRestDayWorked=true y minutos > 0', 'Audit log (vista Auditoría)'],
        ['MINOR_OVERTIME_BLOCKED', 'Check-out de empleado menor de 18 años con overtime bloqueado', 'Audit log (vista Auditoría)'],
        ['RETARDOS_RECURRENTES', '3+ check-ins con status=LATE en ventana de 7 días', 'Campana Supervisor'],
        ['AUSENCIA_CONSECUTIVA', 'Ausente 3 días consecutivos (hoy, ayer, antier)', 'Campana Supervisor'],
        ['EXCESO_DESCANSO', '2+ registros con mealExceeded||restExceeded en 7 días', 'Campana Supervisor'],
        ['SALIDAS_TEMPRANO', '3+ check-outs con status=EARLY_LEAVE en 7 días', 'Campana Supervisor'],
        ['SIN_CHECKOUT', 'Check-in sin check-out después de 8 h (solo hoy)', 'Campana Supervisor'],
    ]

    data = [[Paragraph(f"<b>{h}</b>", style_cell_header) for h in matriz_header]]
    for row in matriz_rows:
        data.append([Paragraph(c, style_cell_small) for c in row])

    matriz_tbl = Table(data, colWidths=[5.5*cm, 7*cm, 4.5*cm])
    matriz_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_MUTED),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, COLOR_BG_LIGHT]),
    ]))
    story.append(matriz_tbl)
    story.append(Spacer(1, 12))

    # ============================================================
    # BASE LEGAL CONSOLIDADA
    # ============================================================
    story.append(Paragraph("Base legal y normativa consolidada", style_h1))
    story.append(Paragraph(
        "Las notificaciones del Tipo 1 (NOM-035) se sustentan en la siguiente normativa:",
        style_body))
    story.append(Spacer(1, 4))

    legal_items = [
        ("<b>NOM-035-STPS-2018</b>, categoría A.5 “Jornadas de trabajo excesivas”: identificación "
         "de factores de riesgo psicosocial. Las alertas CONSECUTIVE_LONG_DAYS y "
         "WEEKLY_OVERTIME_EXCEEDED se mapean directamente a esta categoría."),
        ("<b>LFT art. 66</b>: tope semanal FIJO de 9 horas extra (no escala con la reforma "
         "DOF 27-dic-2024, que solo reduce la jornada ordinaria). Tope diario de 4 horas extra."),
        ("<b>LFT art. 68</b>: las horas que excedan el tope semanal se pagan al TRIPLE. "
         "El sistema separa overtimeDoubleMinutes (art. 66) de overtimeTripleMinutes (art. 68)."),
        ("<b>LFT art. 71</b>: derecho a un día de descanso por cada seis de trabajo, "
         "preferentemente domingo. La alerta NO_WEEKLY_REST verifica configuración; "
         "REST_DAY_WORKED verifica operación."),
        ("<b>LFT art. 73</b>: si el trabajador labora en su día de descanso, tiene derecho "
         "a que se le pague la jornada completa con una prima del 100% adicional. El "
         "sistema calcula restDayWorkedMinutes y restDayPremiumMinutes automáticamente."),
        ("<b>LFT arts. 22, 23, 175 + Art. 123 Constitucional A fr. II</b>: prohibición de "
         "horas extra para menores de 18 años. El sistema bloquea el overtime y emite "
         "MINOR_OVERTIME_BLOCKED."),
    ]
    for item in legal_items:
        story.append(Paragraph(f"• {item}", style_body))
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Las notificaciones del Tipo 2 (Supervisor) no citan un artículo específico pero "
        "operan como alertas tempranas para gestionar patrones que, de escalar, podrían "
        "derivar en causales de rescisión de relación laboral (art. 47 LFT):",
        style_body))
    story.append(Spacer(1, 4))
    supervisor_legal = [
        "<b>LFT art. 47 fr. IX</b>: faltas de asistencia injustificadas (relacionado con AUSENCIA_CONSECUTIVA).",
        "<b>LFT art. 47 fr. X</b>: disminuir el trabajo sin causa justificada (relacionado con SALIDAS_TEMPRANO).",
        "<b>LFT art. 47 fr. I</b>: falsedades o abandono de empleo (relacionado con AUSENCIA_CONSECUTIVA).",
        "<b>LFT art. 63</b>: descanso continuo de media hora en jornadas &gt; 5.5 h (relacionado con EXCESO_DESCANSO).",
        "<b>LFT art. 80</b>: obligación del patrón de llevar registros de asistencia (relacionado con SIN_CHECKOUT).",
    ]
    for item in supervisor_legal:
        story.append(Paragraph(f"• {item}", style_body))
        story.append(Spacer(1, 2))

    story.append(PageBreak())

    # ============================================================
    # ANEXO TÉCNICO
    # ============================================================
    story.append(Paragraph("Anexo técnico — archivos del sistema", style_h1))
    story.append(Paragraph(
        "Referencia de los archivos que implementan el sistema de notificaciones, en caso "
        "de necesitar auditar, modificar o extender la lógica.",
        style_body))
    story.append(Spacer(1, 6))

    anexo_header = ['Tipo', 'Archivo', 'Propósito']
    anexo_rows = [
        ['Campana NOM-035', 'src/components/admin/notification-bell.tsx', 'Componente UI con polling y dropdown'],
        ['Campana Supervisor', 'src/components/admin/supervisor-alerts-bell.tsx', 'Componente UI con polling y popover'],
        ['API NOM-035', 'src/app/api/alerts/nom-035/route.ts', 'Endpoint que computa alertas por semana ISO'],
        ['API Supervisor', 'src/app/api/alerts/supervisor-alerts/route.ts', 'Endpoint que computa patrones de asistencia'],
        ['Lógica overtime', 'src/lib/overtime-calculator.ts', 'Cálculo de overtime (dobles/triples), primas y bloqueo menores'],
        ['Lógica ausencias', 'src/lib/absence-calculator.ts', 'computeAbsentsForDate (respeta vacaciones, feriados, descansos)'],
        ['Hook check-out', 'src/app/api/attendance/check-out/route.ts', 'Escribe eventos NOM035_* y MINOR_OVERTIME_BLOCKED en audit log'],
        ['Layout admin', 'src/components/layout/admin-layout.tsx', 'Monta ambas campanas (línea 8999-9000)'],
        ['API descarga PDF', 'src/app/api/download/manual-notificaciones/route.ts', 'Sirve este PDF con Content-Disposition: attachment'],
        ['Script generador', 'scripts/gen-notifications-pdf.py', 'Genera este PDF con reportlab'],
    ]
    data = [[Paragraph(f"<b>{h}</b>", style_cell_header) for h in anexo_header]]
    for row in anexo_rows:
        data.append([Paragraph(c, style_cell_small) for c in row])

    anexo_tbl = Table(data, colWidths=[3.5*cm, 6.5*cm, 7*cm])
    anexo_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_MUTED),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, COLOR_BG_LIGHT]),
    ]))
    story.append(anexo_tbl)

    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=0.5, color=COLOR_MUTED))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<i>Documento generado automáticamente por el sistema Control de Asistencia v2.2.0. "
        "Para cualquier duda sobre la interpretación legal de las notificaciones, consultar "
        "al área jurídico-laboral. Para reportes de cumplimiento ante la STPS, los eventos "
        "NOM035_* y MINOR_OVERTIME_BLOCKED del audit log constituyen evidencia auditable.</i>",
        style_legal))

    # ============================================================
    # BUILD
    # ============================================================
    # Página 1 = portada con canvas, resto = header_footer
    doc.build(
        story,
        onFirstPage=cover_page,
        onLaterPages=header_footer,
    )
    print(f"OK: PDF generado en {OUTPUT}")
    print(f"     Tamaño: {os.path.getsize(OUTPUT)} bytes")


if __name__ == '__main__':
    build_doc()
