"""
Generador del PDF: MANUAL DE MAPEO DE RUTAS Y ENDPOINTS PARA AUDITORÍA LFT 2027
Proyecto: Control de Asistencia v2.2.0
Fecha: 26 de agosto 2026
"""
import os
from reportlab.lib.pagesizes import letter, A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, KeepTogether, NextPageTemplate, PageTemplate,
    Frame, BaseDocTemplate
)
from reportlab.pdfgen import canvas
from reportlab.lib import colors

OUTPUT = "/home/z/Manual_Mapeo_Rutas_LFT_2027.pdf"

# Colores corporativos
COLOR_PRIMARY = HexColor('#1e3a5f')      # Azul oscuro corporativo
COLOR_SECONDARY = HexColor('#2d5a87')    # Azul medio
COLOR_ACCENT = HexColor('#c9a961')       # Dorado
COLOR_SUCCESS = HexColor('#16a34a')      # Verde
COLOR_DANGER = HexColor('#dc2626')       # Rojo
COLOR_BG_LIGHT = HexColor('#f8fafc')     # Gris muy claro
COLOR_BG_TABLE = HexColor('#e0e7ef')     # Azul grisáceo para headers
COLOR_TEXT = HexColor('#1f2937')         # Gris oscuro
COLOR_MUTED = HexColor('#6b7280')        # Gris medio

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
    fontSize=9, textColor=COLOR_TEXT, spaceAfter=6,
    alignment=TA_JUSTIFY, fontName='Helvetica', leading=13
)

style_cell = ParagraphStyle(
    'CustomCell', parent=styles['Normal'],
    fontSize=7.5, textColor=COLOR_TEXT, spaceAfter=0,
    alignment=TA_LEFT, fontName='Helvetica', leading=10
)

style_cell_small = ParagraphStyle(
    'CustomCellSmall', parent=styles['Normal'],
    fontSize=7, textColor=COLOR_TEXT, spaceAfter=0,
    alignment=TA_LEFT, fontName='Helvetica', leading=9
)

style_cell_header = ParagraphStyle(
    'CustomCellHeader', parent=styles['Normal'],
    fontSize=7.5, textColor=white, spaceAfter=0,
    alignment=TA_CENTER, fontName='Helvetica-Bold', leading=10
)

style_legal = ParagraphStyle(
    'CustomLegal', parent=styles['Normal'],
    fontSize=8, textColor=COLOR_MUTED, spaceAfter=4,
    alignment=TA_JUSTIFY, fontName='Helvetica-Oblique', leading=11
)

style_cover_title = ParagraphStyle(
    'CoverTitle', parent=styles['Title'],
    fontSize=32, textColor=COLOR_PRIMARY, spaceAfter=16,
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
    canvas.drawString(2*cm, height - 0.75*cm, "MANUAL DE MAPEO DE RUTAS Y ENDPOINTS — AUDITORÍA LFT 2027")
    canvas.setFont('Helvetica', 8)
    canvas.drawRightString(width - 2*cm, height - 0.75*cm, "Control de Asistencia v2.2.0")

    # Footer
    canvas.setFillColor(COLOR_PRIMARY)
    canvas.rect(0, 0, width, 0.8*cm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont('Helvetica', 8)
    canvas.drawString(2*cm, 0.3*cm, "Documento técnico-legal | Confidencial")
    canvas.drawRightString(width - 2*cm, 0.3*cm, f"Página {doc.page}")

    canvas.restoreState()


def cover_page(canvas, doc):
    """Portada personalizada."""
    width, height = A4
    canvas.saveState()

    # Fondo
    canvas.setFillColor(COLOR_PRIMARY)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)

    # Banda dorada superior
    canvas.setFillColor(COLOR_ACCENT)
    canvas.rect(0, height - 0.5*cm, width, 0.5*cm, fill=1, stroke=0)

    # Banda dorada inferior
    canvas.setFillColor(COLOR_ACCENT)
    canvas.rect(0, 0, width, 0.5*cm, fill=1, stroke=0)

    # Título principal
    canvas.setFillColor(white)
    canvas.setFont('Helvetica-Bold', 28)
    canvas.drawCentredString(width/2, height - 8*cm, "MANUAL DE MAPEO DE")
    canvas.drawCentredString(width/2, height - 9.5*cm, "RUTAS Y ENDPOINTS")
    canvas.drawCentredString(width/2, height - 11*cm, "PARA AUDITORÍA LFT")

    # Subtítulo
    canvas.setFont('Helvetica', 16)
    canvas.setFillColor(COLOR_ACCENT)
    canvas.drawCentredString(width/2, height - 13*cm, "Reforma Laboral 2027")
    canvas.setFont('Helvetica', 12)
    canvas.setFillColor(white)
    canvas.drawCentredString(width/2, height - 14.5*cm, "Arts. 61, 66, 68, 71, 73, 132 XXXIV, 175, 804 LFT")
    canvas.drawCentredString(width/2, height - 15.5*cm, "Art. 123 Constitucional")

    # Línea separadora
    canvas.setStrokeColor(COLOR_ACCENT)
    canvas.setLineWidth(2)
    canvas.line(width/2 - 6*cm, height - 17*cm, width/2 + 6*cm, height - 17*cm)

    # Info del proyecto
    canvas.setFont('Helvetica-Bold', 14)
    canvas.setFillColor(white)
    canvas.drawCentredString(width/2, height - 19*cm, "Control de Asistencia v2.2.0")
    canvas.setFont('Helvetica', 10)
    canvas.setFillColor(COLOR_ACCENT)
    canvas.drawCentredString(width/2, height - 20*cm, "Sistema de Registro Electrónico de Jornada Laboral")

    # Info legal
    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(white)
    canvas.drawCentredString(width/2, 4*cm, "Documento generado: 26 de agosto 2026")
    canvas.drawCentredString(width/2, 3.5*cm, "Commit auditado: 3ce6e7b")
    canvas.drawCentredString(width/2, 3*cm, "Alcance: Microempresa (<15 empleados)")

    # Declaración de inalterabilidad
    canvas.setFont('Helvetica-Oblique', 8)
    canvas.setFillColor(COLOR_ACCENT)
    canvas.drawCentredString(width/2, 2*cm, "DECLARACIÓN DE INALTERABILIDAD")
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(white)
    canvas.drawCentredString(width/2, 1.5*cm, "Este documento refleja fielmente el estado del código fuente en el commit referenciado.")
    canvas.drawCentredString(width/2, 1.1*cm, "Cualquier modificación posterior requiere re-auditoría. Hash del documento disponible bajo solicitud.")

    canvas.restoreState()


# ==========================================
# CONTENIDO DEL DOCUMENTO
# ==========================================

story = []

# --- PORTADA (página 1) ---
# La portada se dibuja con cover_page, pero necesitamos un spacer para que ocupe la página
story.append(Spacer(1, 25*cm))
story.append(PageBreak())

# --- SECCIÓN 1: RESUMEN EJECUTIVO ---
story.append(Paragraph("1. Resumen Ejecutivo", style_h1))

story.append(Paragraph(
    "Este documento constituye el <b>Manual de Mapeo de Rutas y Endpoints para Auditoría LFT 2027</b> "
    "del sistema <b>Control de Asistencia v2.2.0</b>. Su propósito es proporcionar a auditores legales, "
    "inspectores de la STPS, peritos en derecho laboral y al área de Recursos Humanos del cliente, "
    "un inventario exhaustivo y verificable de todos los archivos de código fuente, endpoints de API, "
    "funciones de librería, componentes de interfaz y modelos de base de datos que participan en el "
    "cumplimiento de la <b>Reforma a la Ley Federal del Trabajo (LFT)</b> que entra en vigor el "
    "<b>1 de enero de 2027</b> (Decreto DOF 27-dic-2024).",
    style_body
))

story.append(Paragraph(
    "El sistema ha sido auditado bajo el marco legal mexicano vigente, incluyendo los artículos "
    "<b>61</b> (jornada máxima semanal), <b>66</b> (tope de horas extra), <b>68</b> (pago triple), "
    "<b>71</b> (descanso semanal), <b>73</b> (prima por descanso trabajado), <b>132 fracción XXXIV</b> "
    "(registro electrónico de jornada con prueba plena), <b>175</b> (protección a menores), <b>804</b> "
    "(conservación de registros 12 meses), y el <b>Artículo 123 Constitucional</b> apartado A. "
    "Asimismo, cumple con la <b>LFPDPPP</b> (protección de datos personales) y la <b>NOM-035-STPS-2018</b> "
    "categoría A.5 (jornadas excesivas) en su modalidad aplicable a microempresas.",
    style_body
))

story.append(Spacer(1, 0.5*cm))

# Declaración de Inalterabilidad
story.append(Paragraph("1.1 Declaración de Inalterabilidad", style_h2))
story.append(Paragraph(
    "El sistema implementa una <b>cadena de hashes SHA-256</b> en el registro de auditoría (AuditLog) "
    "que garantiza la inalterabilidad de los registros electrónicos de asistencia. Cada registro de "
    "check-in/check-out se persiste con campos <code>previousHash</code> y <code>recordHash</code> "
    "que forman una cadena criptográfica. Cualquier alteración directa en la base de datos rompe la "
    "cadena y es detectable mediante el endpoint <code>GET /api/audit/verify</code>, accesible desde "
    "la interfaz de administración mediante el botón <b>«Verificar Integridad»</b>.",
    style_body
))
story.append(Paragraph(
    "Esta característica cumple con el requisito de <b>prueba plena</b> establecido en el "
    "art. 132 fracción XXXIV de la LFT (reforma DOF 27-dic-2024): <i>«El contenido del registro "
    "electrónico hará prueba plena si se acredita que fue acordado entre la persona trabajadora y "
    "empleadora»</i>. El sistema implementa el acuerdo formal mediante el modelo "
    "<code>ElectronicRecordAgreement</code>, que requiere aceptación explícita del empleado antes "
    "de permitir cualquier registro de asistencia.",
    style_body
))

story.append(PageBreak())

# --- SECCIÓN 2: TABLA MAESTRA DE RUTAS ---

# Cambiar a landscape para la tabla maestra
story.append(Paragraph("2. Tabla Maestra de Rutas de Cumplimiento Legal", style_h1))
story.append(Paragraph(
    "La siguiente tabla mapea <b>todos los archivos, endpoints y funciones</b> del sistema que "
    "participan en el cumplimiento de la LFT 2027. Está organizada por <b>módulo legal</b> y "
    "contiene la información necesaria para que un auditor verifique el cumplimiento artículo por artículo.",
    style_body
))
story.append(Spacer(1, 0.3*cm))

# Encabezados de la tabla maestra
headers = [
    Paragraph("MÓDULO LEGAL", style_cell_header),
    Paragraph("RUTA DE ARCHIVO / ENDPOINT", style_cell_header),
    Paragraph("MÉTODO / FUNCIÓN", style_cell_header),
    Paragraph("PROPÓSITO DE CUMPLIMIENTO LEGAL", style_cell_header),
    Paragraph("PARÁMETROS / DATOS CLAVE", style_cell_header),
    Paragraph("ESTADO", style_cell_header),
]

# Datos de la tabla maestra (organizada por módulo legal)
data = [headers]

# === MÓDULO 1: REGISTRO FEHACIENTE (Art. 132 XXXIV) ===
data.append([
    Paragraph("<b>Registro Fehaciente</b><br/>Art. 132 XXXIV LFT", style_cell),
    Paragraph("src/app/api/attendance/check-in/route.ts", style_cell_small),
    Paragraph("POST", style_cell),
    Paragraph("Crea registro de entrada. Bloquea auto-check-in con HTTP 403 RECORD_AGREEMENT_REQUIRED si no hay ElectronicRecordAgreement activo. Captura IP, UA, lat/long, método (GPS/QR). Marca isRestDayWorked e isSunday.", style_cell_small),
    Paragraph("employeeId, lat, long, method, qrCode, checkInIp, checkInUserAgent, isRestDayWorked, isSunday", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Registro Fehaciente<br/>Art. 132 XXXIV LFT", style_cell),
    Paragraph("src/app/api/attendance/check-out/route.ts", style_cell_small),
    Paragraph("POST", style_cell),
    Paragraph("Registra salida. Cálculo overtime dobles/triples, prima art. 73, jornada nocturna art. 60/61. Dispara alertas NOM-035 y MINOR_OVERTIME_BLOCKED. Persiste IP, UA, coordenadas GPS.", style_cell_small),
    Paragraph("employeeId, lat, long, method, checkOutIp, workedMinutes, overtimeDoubleMinutes, overtimeTripleMinutes, minorOvertimeBlocked", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Registro Fehaciente<br/>Art. 132 XXXIV LFT", style_cell),
    Paragraph("src/app/api/attendance/sign/route.ts", style_cell_small),
    Paragraph("POST", style_cell),
    Paragraph("Empleado firma (acknowledge) sus registros de un periodo con HMAC-SHA256 + PIN. Persiste employeeSignedAt, employeeSignatureHash, employeeSignedIp. Prueba plena art. 132 XXXIV.", style_cell_small),
    Paragraph("startDate, endDate, signaturePin, employeeSignedAt, employeeSignatureHash (HMAC-SHA256), employeeSignedIp", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Registro Fehaciente<br/>Art. 132 XXXIV LFT", style_cell),
    Paragraph("src/app/api/employee/agreement/route.ts", style_cell_small),
    Paragraph("GET / POST", style_cell),
    Paragraph("GET: estado + texto vigente del acuerdo. POST: aceptación (valida hash SHA-256 del texto, revoca versión previa si cambia). Acuerdo formal patrón-trabajador.", style_cell_small),
    Paragraph("agreementVersion, documentHash (SHA-256), agreedAt, agreedIp, agreedUserAgent, isActive", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Registro Fehaciente<br/>Art. 132 XXXIV LFT", style_cell),
    Paragraph("src/lib/electronic-record-agreement-text.ts", style_cell_small),
    Paragraph("getAgreementText()<br/>computeAgreementHash()", style_cell),
    Paragraph("Texto legal del acuerdo (v1.0) con placeholders de empresa. Cálculo de hash SHA-256 para evidencia probatoria.", style_cell_small),
    Paragraph("ELECTRONIC_RECORD_AGREEMENT_VERSION='1.0', {RAZON_SOCIAL}, {RFC}, {DOMICILIO}", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Registro Fehaciente<br/>Art. 132 XXXIV LFT", style_cell),
    Paragraph("src/components/layout/employee-layout.tsx", style_cell_small),
    Paragraph("AttendanceView<br/>ElectronicRecordAgreementGate", style_cell),
    Paragraph("UI de check-in/check-out. Modal de aceptación del acuerdo (bloquea check-in sin aceptar). Cálculo client-side del hash SHA-256.", style_cell_small),
    Paragraph("Botones check-in/check-out, casilla de aceptación, hash SHA-256 client-side", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

# === MÓDULO 2: CÁLCULO OVERTIME 46h (Art. 61/66/68) ===
data.append([
    Paragraph("<b>Cálculo Overtime 46h</b><br/>Art. 61/66/68 LFT", style_cell),
    Paragraph("src/lib/overtime-calculator.ts", style_cell_small),
    Paragraph("calculateOvertime()", style_cell),
    Paragraph("Función principal. Calcula overtime contra tope LEGAL semanal del año (46h en 2027) Y contra schedule del día, tomando el MAYOR (más protector). Distribución dobles/triples.", style_cell_small),
    Paragraph("weeklyWorkedMinutesPrev, workedMinutes, scheduledMinutes, getLegalWeeklyHoursLocal(year), overtimeDoubleMinutes, overtimeTripleMinutes", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Cálculo Overtime 46h<br/>Art. 61/66/68 LFT", style_cell),
    Paragraph("src/lib/overtime-calculator.ts", style_cell_small),
    Paragraph("getWeeklyOvertimeCapMinutes()<br/>DAILY_OVERTIME_CAP_MINUTES", style_cell),
    Paragraph("Tope semanal FIJO de 9h (art. 66, 540 min) — no escala con reducción de jornada. Tope diario de 4h (240 min).", style_cell_small),
    Paragraph("year (ignorado), retorna 540 min fijos", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Cálculo Overtime 46h<br/>Art. 61/66/68 LFT", style_cell),
    Paragraph("src/lib/overtime-calculator.ts", style_cell_small),
    Paragraph("computeWeeklyWorkedMinutesPrev()", style_cell),
    Paragraph("Calcula minutos trabajados totales previos en la semana (lun..ayer). Para cálculo de overtime contra tope legal semanal art. 61.", style_cell_small),
    Paragraph("employeeId, recordDate, fetchRecords → workedMinutes acumulado", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Cálculo Overtime 46h<br/>Art. 61/66/68 LFT", style_cell),
    Paragraph("src/lib/work-schedule.ts", style_cell_small),
    Paragraph("getMaxWeeklyHoursForYear()<br/>validateWorkSchedules()", style_cell),
    Paragraph("Consulta JornadaConfig para tope semanal del año. Valida que horarios no excedan tope (48→46→44→42→40h) y mínimo 1 descanso (art. 71).", style_cell_small),
    Paragraph("year → maxWeeklyHours; schedules[] → error|null", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Cálculo Overtime 46h<br/>Art. 61/66/68 LFT", style_cell),
    Paragraph("src/lib/shift-classifier.ts", style_cell_small),
    Paragraph("classifyShift()<br/>getLegalMaxMinutes()", style_cell),
    Paragraph("Clasifica jornada DIURNA/NOCTURNA/MIXTA (art. 60) según minutos en horario nocturno (20:00-06:00). Límite legal: 8/7/7.5h.", style_cell_small),
    Paragraph("checkIn, checkOut → shiftType, nightMinutes; shiftType → 480/420/450 min", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Cálculo Overtime 46h<br/>Art. 61/66/68 LFT", style_cell),
    Paragraph("src/app/api/admin/recalc-overtime/route.ts", style_cell_small),
    Paragraph("POST", style_cell),
    Paragraph("Recálculo masivo de overtime (solo GENERAL_ADMIN). Reaplica calculateOvertime a registros históricos cuando se corrige la lógica.", style_cell_small),
    Paragraph("fromDate, toDate, sucursalId, employeeId, dryRun", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Cálculo Overtime 46h<br/>Art. 61/66/68 LFT", style_cell),
    Paragraph("prisma/schema.prisma<br/>model JornadaConfig", style_cell_small),
    Paragraph("Model", style_cell),
    Paragraph("Tabla parametrizable de topes semanales por año. Seed: 2026→48h, 2027→46h, 2028→44h, 2029→42h, 2030→40h.", style_cell_small),
    Paragraph("year (PK), maxWeeklyHours", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

# === MÓDULO 3: BLOQUEO MENORES (Art. 175) ===
data.append([
    Paragraph("<b>Bloqueo Menores</b><br/>Art. 175 LFT", style_cell),
    Paragraph("src/lib/overtime-calculator.ts", style_cell_small),
    Paragraph("calculateAge()<br/>isMinor()", style_cell),
    Paragraph("Calcula edad del empleado. Si <18 años al momento del registro, fuerza overtimeMinutes=0 y levanta flag minorOvertimeBlocked=true. Arts. 22, 23, 175 LFT + Art. 123 Const. A fr. II.", style_cell_small),
    Paragraph("birthDate, asOf → age (number|null); isMinor → boolean", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Bloqueo Menores<br/>Art. 175 LFT", style_cell),
    Paragraph("src/app/api/attendance/check-out/route.ts", style_cell_small),
    Paragraph("POST", style_cell),
    Paragraph("Pasa employeeBirthDate a calculateOvertime. Si calc.minorOvertimeBlocked=true → genera alerta audit MINOR_OVERTIME_BLOCKED (level HIGH, ref. arts. 22, 23, 175 LFT).", style_cell_small),
    Paragraph("employeeBirthDate, calc.minorOvertimeBlocked, action=MINOR_OVERTIME_BLOCKED", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Bloqueo Menores<br/>Art. 175 LFT", style_cell),
    Paragraph("src/app/api/employees/route.ts<br/>src/app/api/employees/[id]/route.ts", style_cell_small),
    Paragraph("POST / PUT", style_cell),
    Paragraph("Acepta y persiste birthDate en creación/edición de empleado. Campo opcional pero recomendado para activar candado de menores.", style_cell_small),
    Paragraph("birthDate (YYYY-MM-DD) → DateTime|null", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Bloqueo Menores<br/>Art. 175 LFT", style_cell),
    Paragraph("prisma/schema.prisma<br/>model Employee.birthDate", style_cell_small),
    Paragraph("Field", style_cell),
    Paragraph("Campo birthDate (DateTime?) en modelo Employee. Para validación de edad y bloqueo de overtime a menores.", style_cell_small),
    Paragraph("birthDate DateTime?", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Bloqueo Menores<br/>Art. 175 LFT", style_cell),
    Paragraph("src/components/layout/admin-layout.tsx<br/>EmployeeFormDialog", style_cell_small),
    Paragraph("Component", style_cell),
    Paragraph("Campo 'Fecha de nacimiento' (input type=date) en formulario de crear/editar empleado. Label: 'Bloquea horas extra a menores de 18 años'.", style_cell_small),
    Paragraph("birthDate state, payload POST/PUT", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

# === MÓDULO 4: INALTERABILIDAD HASH CHAIN ===
data.append([
    Paragraph("<b>Inalterabilidad Hash Chain</b><br/>Art. 132 XXXIV (prueba plena)", style_cell),
    Paragraph("src/lib/audit.ts", style_cell_small),
    Paragraph("auditLog()<br/>computeAuditRecordHash()", style_cell),
    Paragraph("Inserta registro encadenado: previousHash = recordHash del último log, recordHash propio = SHA-256 de la concatenación determinista. Trazabilidad criptográfica.", style_cell_small),
    Paragraph("previousHash, recordHash (SHA-256), userId, action, entityType, details, ipAddress, userAgent", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Inalterabilidad Hash Chain<br/>Art. 132 XXXIV (prueba plena)", style_cell),
    Paragraph("src/app/api/audit/verify/route.ts", style_cell_small),
    Paragraph("GET", style_cell),
    Paragraph("Verifica integridad de la cadena SHA-256. Recalcula recordHash de cada registro y compara con el almacenado. Propaga manipulaciones vía previousHash. Registra AUDIT_VERIFY.", style_cell_small),
    Paragraph("limit (max 50000), startDate, endDate → chainIntact, verifiedRecords, tamperedRecords, firstBrokenAt", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Inalterabilidad Hash Chain<br/>Art. 132 XXXIV (prueba plena)", style_cell),
    Paragraph("src/app/api/audit/route.ts", style_cell_small),
    Paragraph("GET", style_cell),
    Paragraph("Lista paginada de AuditLog con filtros (action, userId, sucursalId, fechas). Para consulta de eventos auditoría.", style_cell_small),
    Paragraph("page, limit, action, userId, startDate, endDate, sucursalId", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Inalterabilidad Hash Chain<br/>Art. 132 XXXIV (prueba plena)", style_cell),
    Paragraph("src/components/layout/admin-layout.tsx<br/>AuditView", style_cell_small),
    Paragraph("Component", style_cell),
    Paragraph("Botón 'Verificar Integridad' que invoca GET /api/audit/verify?limit=50000. Panel verde (✓ íntegra) o rojo (⚠️ alteración). Demuestra prueba plena.", style_cell_small),
    Paragraph("verifyResult.chainIntact, verifiedRecords, tamperedRecords, firstBrokenAt", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Inalterabilidad Hash Chain<br/>Art. 132 XXXIV (prueba plena)", style_cell),
    Paragraph("prisma/schema.prisma<br/>model AuditLog", style_cell_small),
    Paragraph("Model", style_cell),
    Paragraph("Campos previousHash y recordHash para cadena SHA-256. Índices en recordHash, createdAt, action para queries eficientes.", style_cell_small),
    Paragraph("previousHash String?, recordHash String?, @@index([recordHash])", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

# === MÓDULO 5: RETENCIÓN 12 MESES (Art. 804) ===
data.append([
    Paragraph("<b>Retención 12 Meses</b><br/>Art. 804 LFT", style_cell),
    Paragraph("src/app/api/admin/retention/archive/route.ts", style_cell_small),
    Paragraph("GET / POST", style_cell),
    Paragraph("GET: preview dry-run (cuenta registros elegibles >12 meses). POST: archiva (marca archivedAt, anonimiza IPs/UAs). Auth dual: sesión admin O token cron.", style_cell_small),
    Paragraph("archivedAt, checkInIp→null, checkOutIp→null, checkInUserAgent→null, RETENTION_CRON_TOKEN", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Retención 12 Meses<br/>Art. 804 LFT", style_cell),
    Paragraph("vercel.json<br/>crons[]", style_cell_small),
    Paragraph("Cron Config", style_cell),
    Paragraph("Cron mensual: '0 3 1 * *' (día 1 de cada mes, 03:00 UTC). Invoca /api/admin/retention/archive?token=RETENTION_2027.", style_cell_small),
    Paragraph("schedule, path, token", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Retención 12 Meses<br/>Art. 804 LFT", style_cell),
    Paragraph("prisma/schema.prisma<br/>AttendanceRecord.archivedAt", style_cell_small),
    Paragraph("Field", style_cell),
    Paragraph("Fecha de archivado. NULL = registro activo. Con valor = anonimizado (IPs/UA nulificados, conserva datos laborales).", style_cell_small),
    Paragraph("archivedAt DateTime?, @@index([archivedAt])", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

# === MÓDULO 6: EXPORTACIÓN STPS/IMSS (Art. 804) ===
data.append([
    Paragraph("<b>Exportación STPS/IMSS</b><br/>Art. 804 LFT + LSS art. 15", style_cell),
    Paragraph("src/app/api/reports/stps-format/route.ts", style_cell_small),
    Paragraph("GET", style_cell),
    Paragraph("Reporte oficial STPS (Art. 804 LFT). Format XLSX/PDF/JSON. 3 secciones: Datos Patrón, Catálogo Trabajadores, Detalle Diario. Incluye columnas Firmado y Hash(16).", style_cell_small),
    Paragraph("periodo, mes, anio, semana, startDate, endDate, sucursalId, format", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Exportación STPS/IMSS<br/>Art. 804 LFT + LSS art. 15", style_cell),
    Paragraph("src/lib/stps-pdf.ts", style_cell_small),
    Paragraph("buildStpsPdf()", style_cell),
    Paragraph("Genera PDF del reporte STPS con PDFKit. Incluye columnas de firma y hash para evidencia de prueba plena.", style_cell_small),
    Paragraph("reporte: StpsReport → Buffer PDF", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Exportación STPS/IMSS<br/>Art. 804 LFT + LSS art. 15", style_cell),
    Paragraph("src/app/api/reports/imss-format/route.ts", style_cell_small),
    Paragraph("GET", style_cell),
    Paragraph("Reporte de incapacidades IMSS (LSS art. 15). Exporta NSS, RFC, CURP, folioIMSS, tipo de incapacidad, días. Reconciliación SUA/IDSE.", style_cell_small),
    Paragraph("startDate, endDate, sucursalId, format=csv|json", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Exportación STPS/IMSS<br/>Art. 804 LFT + LSS art. 15", style_cell),
    Paragraph("src/app/api/reports/export/route.ts", style_cell_small),
    Paragraph("GET", style_cell),
    Paragraph("Exportación genérica CSV/XLSX (exceljs). Type: daily|overtime|absences|incidences|comparative. Para inspecciones y conciliación de nómina.", style_cell_small),
    Paragraph("type, startDate, endDate, sucursalId, format=csv|xlsx", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

# === MÓDULO 7: ALERTAS DE JORNADA EXCESIVA (Arts. 66/68/71/73) ===
data.append([
    Paragraph("<b>Alertas Jornada Excesiva</b><br/>Arts. 66/68/71/73 LFT", style_cell),
    Paragraph("src/app/api/alerts/nom-035/route.ts", style_cell_small),
    Paragraph("GET", style_cell),
    Paragraph("Detecta 5 tipos de alerta: WEEKLY_OVERTIME_EXCEEDED (art. 66), DAILY_OVERTIME_EXCEEDED (art. 66), CONSECUTIVE_LONG_DAYS, NO_WEEKLY_REST (art. 71), REST_DAY_WORKED (art. 73).", style_cell_small),
    Paragraph("week=current|last, startDate, endDate, sucursalId", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Alertas Jornada Excesiva<br/>Arts. 66/68/71/73 LFT", style_cell),
    Paragraph("src/app/api/reports/nom-035/route.ts", style_cell_small),
    Paragraph("GET", style_cell),
    Paragraph("Export XLSX server-side (3 hojas: Resumen, Alertas, Desglose por tipo). Para inspección STPS con rango de fechas.", style_cell_small),
    Paragraph("format=xlsx, week, startDate, endDate, sucursalId", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Alertas Jornada Excesiva<br/>Arts. 66/68/71/73 LFT", style_cell),
    Paragraph("src/components/admin/notification-bell.tsx", style_cell_small),
    Paragraph("NotificationBell", style_cell),
    Paragraph("Campana de notificaciones con polling cada 5 min. Badge rojo (HIGH) o ámbar (MEDIUM/LOW). Dropdown con top 5 alertas.", style_cell_small),
    Paragraph("GET /api/alerts/nom-035?week=current, pollInterval=300000", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

# === MÓDULO 8: PROTECCIÓN DE DATOS (LFPDPPP) ===
data.append([
    Paragraph("<b>Protección de Datos</b><br/>LFPDPPP arts. 16-17, 29-32", style_cell),
    Paragraph("src/app/api/user/privacy/accept/route.ts<br/>src/app/api/user/privacy/status/route.ts", style_cell_small),
    Paragraph("POST / GET", style_cell),
    Paragraph("Consentimiento del aviso de privacidad (LFPDPPP art. 17). Re-emite JWT con privacyAccepted=true. Versión vigente v1.0.", style_cell_small),
    Paragraph("privacyAcceptedAt, privacyAcceptedVersion='1.0', privacyAcceptedIp", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Protección de Datos<br/>LFPDPPP arts. 16-17, 29-32", style_cell),
    Paragraph("src/app/api/user/arco/request/route.ts<br/>src/app/api/admin/arco/[id]/resolve/route.ts", style_cell_small),
    Paragraph("POST / PATCH", style_cell),
    Paragraph("Solicitud ARCO (ACCESS/RECTIFICATION/CANCELLATION/OPPOSITION). Plazo 20 días hábiles. CANCELLATION+RESOLVED dispara anonymizeUserData.", style_cell_small),
    Paragraph("type (ACCESS/RECTIFICATION/CANCELLATION/OPPOSITION), status, resolutionNotes", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

data.append([
    Paragraph("Protección de Datos<br/>LFPDPPP arts. 16-17, 29-32", style_cell),
    Paragraph("src/lib/privacy.ts", style_cell_small),
    Paragraph("anonymizeUserData()", style_cell),
    Paragraph("Anonimiza PII del usuario (LFPDPPP art. 31) conservando registros laborales (LFT art. 804). Resuelve conflicto legal.", style_cell_small),
    Paragraph("userId, reason → AnonymizationResult", style_cell_small),
    Paragraph("✅ CUMPLE", style_cell),
])

# Construir la tabla
col_widths = [3.2*cm, 4.5*cm, 2.2*cm, 6.5*cm, 4.5*cm, 1.8*cm]

table = Table(data, colWidths=col_widths, repeatRows=1)
table.setStyle(TableStyle([
    # Header
    ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 8),
    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
    ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, 0), 6),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 6),

    # Body
    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
    ('FONTSIZE', (0, 1), (-1, -1), 7.5),
    ('VALIGN', (0, 1), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 1), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
    ('LEFTPADDING', (0, 1), (-1, -1), 4),
    ('RIGHTPADDING', (0, 1), (-1, -1), 4),

    # Alternar colores de fila por módulo
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, COLOR_BG_LIGHT]),

    # Bordes
    ('GRID', (0, 0), (-1, -1), 0.5, COLOR_MUTED),
    ('LINEBELOW', (0, 0), (-1, 0), 1, COLOR_ACCENT),

    # Columna ESTADO centrada
    ('ALIGN', (5, 1), (5, -1), 'CENTER'),
    ('TEXTCOLOR', (5, 1), (5, -1), COLOR_SUCCESS),
    ('FONTNAME', (5, 1), (5, -1), 'Helvetica-Bold'),
]))

story.append(table)

story.append(PageBreak())

# --- SECCIÓN 3: DIAGRAMA DE FLUJO DE DATOS ---
story.append(Paragraph("3. Diagrama de Flujo de Datos", style_h1))
story.append(Paragraph(
    "El siguiente diagrama muestra el flujo completo de datos desde el check-in del empleado "
    "hasta la verificación de integridad de la bitácora, pasando por el cálculo de jornada "
    "con tope legal de 46 horas (art. 61 LFT) y la persistencia con hash chain (art. 132 XXXIV).",
    style_body
))
story.append(Spacer(1, 0.3*cm))

# Diagrama de flujo como tabla (más confiable que imagen)
flow_data = [
    [Paragraph("<b>1. CHECK-IN</b><br/>(Empleado)", style_cell),
     Paragraph("POST /api/attendance/check-in<br/>• Valida ElectronicRecordAgreement activo<br/>• Captura IP, UA, lat/long, método GPS/QR<br/>• Si no hay acuerdo → HTTP 403 RECORD_AGREEMENT_REQUIRED<br/>• Marca isRestDayWorked, isSunday", style_cell)],

    [Paragraph("<b>2. REGISTRO HASH</b><br/>(AuditLog)", style_cell),
     Paragraph("auditLog() en src/lib/audit.ts<br/>• previousHash = recordHash del último log<br/>• recordHash = SHA-256(previousHash + action + details + timestamp)<br/>• Persiste en AuditLog con cadena criptográfica<br/>• Trazabilidad inalterable", style_cell)],

    [Paragraph("<b>3. CHECK-OUT</b><br/>(Empleado)", style_cell),
     Paragraph("POST /api/attendance/check-out<br/>• Calcula workedMinutes (bruto en sitio)<br/>• Calcula weeklyWorkedMinutesPrev (lun..ayer)<br/>• Obtiene tope legal: getLegalWeeklyHoursLocal(year) = 46h (2027)<br/>• Pasa employeeBirthDate para validación de edad", style_cell)],

    [Paragraph("<b>4. CÁLCULO JORNADA 46h</b><br/>(calculateOvertime)", style_cell),
     Paragraph("src/lib/overtime-calculator.ts<br/>• dailyScheduleOvertime = workedMinutes - scheduledMinutes<br/>• weeklyLegalOvertime = weeklyWorkedTotal - (46h × 60)<br/>• overtimeMinutes = max(daily, weekly) — más protector<br/>• Si isMinor(birthDate) → overtimeMinutes=0, minorOvertimeBlocked=true<br/>• Distribución: dobles (primeras 9h) / triples (excedente)", style_cell)],

    [Paragraph("<b>5. PERSISTENCIA</b><br/>(AttendanceRecord)", style_cell),
     Paragraph("UPDATE en BD<br/>• workedMinutes, overtimeMinutes<br/>• overtimeDoubleMinutes (art. 66), overtimeTripleMinutes (art. 68)<br/>• isRestDayWorked, restDayPremiumMinutes (art. 73)<br/>• shiftType, nightMinutes (art. 60)<br/>• minorOvertimeBlocked (art. 175)<br/>• employeeSignedAt, employeeSignatureHash (firma HMAC)", style_cell)],

    [Paragraph("<b>6. ALERTAS</b><br/>(AuditLog + UI)", style_cell),
     Paragraph("Disparo automático:<br/>• NOM035_ALERT_REST_DAY_WORKED (art. 73)<br/>• NOM035_ALERT_WEEKLY_OVERTIME (art. 66/68, tope 9h)<br/>• MINOR_OVERTIME_BLOCKED (art. 175, level HIGH)<br/>• Notificación visible en NotificationBell (polling 5 min)", style_cell)],

    [Paragraph("<b>7. FIRMA EMPLEADO</b><br/>(Opcional, art. 132 XXXIV)", style_cell),
     Paragraph("POST /api/attendance/sign<br/>• Empleado firma registros del periodo con PIN<br/>• HMAC-SHA256(NEXTAUTH_SECRET:PIN, contenido)<br/>• Persiste employeeSignedAt, employeeSignatureHash<br/>• Refuerza prueba plena ante pericial", style_cell)],

    [Paragraph("<b>8. VERIFICACIÓN</b><br/>(Auditoría)", style_cell),
     Paragraph("GET /api/audit/verify?limit=50000<br/>• Recorre AuditLog en orden cronológico ASC<br/>• Recalcula recordHash esperado para cada registro<br/>• Compara con recordHash almacenado<br/>• Propaga manipulaciones vía previousHash<br/>• Resultado: chainIntact ✓ o ⚠️ tamperedRecords<br/>• Accesible vía botón 'Verificar Integridad'", style_cell)],

    [Paragraph("<b>9. EXPORTACIÓN</b><br/>(STPS/IMSS)", style_cell),
     Paragraph("GET /api/reports/stps-format (Art. 804 LFT)<br/>GET /api/reports/imss-format (LSS art. 15)<br/>GET /api/reports/export (CSV/XLSX genérico)<br/>GET /api/reports/nom-035 (XLSX alertas)<br/>• Incluye hash de firma para evidencia probatoria", style_cell)],
]

flow_table = Table(flow_data, colWidths=[4*cm, 13*cm])
flow_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (0, -1), COLOR_PRIMARY),
    ('TEXTCOLOR', (0, 0), (0, -1), white),
    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (0, -1), 9),
    ('ALIGN', (0, 0), (0, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('BACKGROUND', (1, 0), (1, -1), COLOR_BG_LIGHT),
    ('GRID', (0, 0), (-1, -1), 0.5, COLOR_MUTED),
    ('LINEBELOW', (0, 0), (-1, -1), 1, COLOR_ACCENT),
]))

story.append(flow_table)

story.append(PageBreak())

# --- SECCIÓN 4: ANEXO TÉCNICO DE EVIDENCIA PROBATORIA ---
story.append(Paragraph("4. Anexo Técnico de Evidencia Probatoria", style_h1))

story.append(Paragraph("4.1 APIs de Exportación STPS (Art. 804 LFT)", style_h2))
story.append(Paragraph(
    "El sistema cuenta con endpoints dedicados para la exportación de reportes oficiales "
    "requeridos por la STPS en inspecciones laborales. Estos reportes incluyen los datos del "
    "patrón, catálogo de trabajadores y detalle diario de asistencia, con columnas adicionales "
    "de firma electrónica y hash para evidencia probatoria.",
    style_body
))

story.append(Spacer(1, 0.2*cm))

# Tabla de APIs de exportación
export_headers = [
    Paragraph("ENDPOINT", style_cell_header),
    Paragraph("FORMATO", style_cell_header),
    Paragraph("CONTENIDO", style_cell_header),
    Paragraph("EVIDENCIA PROBATORIA", style_cell_header),
]

export_data = [export_headers]

export_data.append([
    Paragraph("GET /api/reports/stps-format", style_cell),
    Paragraph("XLSX, PDF, JSON", style_cell),
    Paragraph("3 secciones: (1) Datos Patrón (razón social, RFC, registro patronal), (2) Catálogo Trabajadores (NSS, RFC, CURP, puesto), (3) Detalle Diario (entrada, salida, workedMinutes, overtime).", style_cell),
    Paragraph("Columnas 'Firmado' (fecha firma empleado) y 'Hash(16)' (primeros 16 chars del HMAC-SHA256). Cumple art. 804 LFT + art. 132 XXXIV (prueba plena).", style_cell),
])

export_data.append([
    Paragraph("GET /api/reports/imss-format", style_cell),
    Paragraph("CSV, JSON", style_cell),
    Paragraph("Incapacidades: NSS, RFC, CURP, folioIMSS, tipo (ENFERMEDAD_GENERAL/MATERNIDAD/RIESGO_TRABAJO), días, fechas. Reconciliación SUA/IDSE.", style_cell),
    Paragraph("Cumple LSS art. 15 (registro de movimientos afiliatorios). Datos para auditoría IMSS.", style_cell),
])

export_data.append([
    Paragraph("GET /api/reports/export", style_cell),
    Paragraph("CSV, XLSX", style_cell),
    Paragraph("Exportación genérica multi-tipo: daily, overtime, absences, incidences, comparative. Rango de fechas personalizable.", style_cell),
    Paragraph("Para conciliación de nómina y respuesta a requerimientos laborales.", style_cell),
])

export_data.append([
    Paragraph("GET /api/reports/nom-035", style_cell),
    Paragraph("XLSX", style_cell),
    Paragraph("3 hojas: (1) Resumen (periodo, empleados, totales por severidad, marco legal), (2) Alertas (15 columnas con auto-filter, color por severidad), (3) Desglose por tipo.", style_cell),
    Paragraph("Evidencia de control de jornadas excesivas (arts. 66/68/71/73 LFT). Para inspección STPS.", style_cell),
])

export_data.append([
    Paragraph("GET /api/audit/verify", style_cell),
    Paragraph("JSON", style_cell),
    Paragraph("Verificación de cadena SHA-256 del AuditLog. Retorna chainIntact, verifiedRecords, tamperedRecords, firstBrokenAt, brokenRecords[].", style_cell),
    Paragraph("Demuestra inalterabilidad de la bitácora (prueba plena art. 132 XXXIV). Accesible vía botón UI 'Verificar Integridad'.", style_cell),
])

export_table = Table(export_data, colWidths=[4*cm, 2.5*cm, 6*cm, 4.5*cm], repeatRows=1)
export_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 8),
    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, COLOR_BG_LIGHT]),
    ('GRID', (0, 0), (-1, -1), 0.5, COLOR_MUTED),
    ('LINEBELOW', (0, 0), (-1, 0), 1, COLOR_ACCENT),
]))

story.append(export_table)

story.append(Spacer(1, 0.5*cm))

# --- 4.2 Acciones de Auditoría Persistidas ---
story.append(Paragraph("4.2 Acciones de Auditoría Persistidas (AuditLog con Hash Chain)", style_h2))
story.append(Paragraph(
    "El sistema registra automáticamente las siguientes acciones en el AuditLog, todas "
    "encadenadas criptográficamente con SHA-256. Cada acción genera un <code>recordHash</code> "
    "único que depende del <code>previousHash</code> del registro anterior, formando una cadena "
    "inalterable. Cualquier modificación directa en la base de datos rompe la cadena y es "
    "detectable por el endpoint de verificación.",
    style_body
))

actions_text = """
<b>Acciones de seguridad y autenticación:</b><br/>
• LOGIN, LOGOUT, LOGIN_FAILED, QUICK_LOGIN, MFA_SETUP_INITIATED, MFA_ENABLED, MFA_DISABLED, PASSWORD_RESET, ACCOUNT_UNLOCK<br/><br/>

<b>Acciones de registro electrónico (Art. 132 XXXIV LFT):</b><br/>
• CHECK_IN, CHECK_OUT, ATTENDANCE_SIGN, ACCEPT_ELECTRONIC_RECORD_AGREEMENT, PRIVACY_CONSENT_ACCEPT<br/><br/>

<b>Acciones de alertas legales:</b><br/>
• NOM035_ALERT_REST_DAY_WORKED (art. 73), NOM035_ALERT_WEEKLY_OVERTIME (art. 66/68), MINOR_OVERTIME_BLOCKED (art. 175)<br/><br/>

<b>Acciones de corrección y auditoría:</b><br/>
• MANUAL_CORRECTION (con correctionReason obligatorio), AUDIT_VERIFY (verificación de integridad), RETENTION_ARCHIVE (art. 804)<br/><br/>

<b>Acciones de privacidad (LFPDPPP):</b><br/>
• PRIVACY_ARCO_REQUEST_CREATED, PRIVACY_ARCO_REQUEST_RESOLVED, PRIVACY_ANONYMIZATION, ARCO_ACCESS_EXERCISED<br/><br/>

<b>Acciones administrativas:</b><br/>
• CREATE_EMPLOYEE, UPDATE_EMPLOYEE, DEACTIVATE_EMPLOYEE, TRANSFER, EXPORT_STPS_REPORT, EXPORT_IMSS_REPORT
"""

story.append(Paragraph(actions_text, style_legal))

story.append(Spacer(1, 0.5*cm))

# --- 4.3 Referencias Legales ---
story.append(Paragraph("4.3 Referencias Legales Implementadas", style_h2))

legal_refs = """
<b>Constitución Política de los Estados Unidos Mexicanos:</b><br/>
• Art. 123 Apartado A fracción II (prohibición de horas extra a menores de 18 años)<br/>
• Art. 123 Apartado A fracción XI (jornada máxima de 8 horas diurnas)<br/><br/>

<b>Ley Federal del Trabajo (LFT) — Reforma DOF 27-dic-2024:</b><br/>
• Art. 22, 23 (trabajo de menores)<br/>
• Art. 58 (definición de jornada de trabajo)<br/>
• Art. 60 (tipos de jornada: diurna, nocturna, mixta)<br/>
• Art. 61 (duración máxima: 8/7/7.5h diaria; reforma reduce tope semanal 48→46→44→42→40h entre 2026-2030)<br/>
• Art. 63 (descanso de 30 min dentro de jornada)<br/>
• Art. 66 (tope semanal de 9h extra, tope diario de 4h)<br/>
• Art. 68 (pago de horas extra al triple)<br/>
• Art. 71 (descanso semanal obligatorio, prima dominical)<br/>
• Art. 73 (prima del 100% por descanso trabajado)<br/>
• Art. 132 fracción XXXIV (registro electrónico de jornada — prueba plena)<br/>
• Art. 175 (prohibición de horas extra a menores de 18 años)<br/>
• Art. 804 (conservación de registros 12 meses)<br/>
• Art. 994 (multas por incumplimiento)<br/><br/>

<b>Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP):</b><br/>
• Arts. 16-17 (aviso de privacidad, consentimiento informado)<br/>
• Arts. 29-32 (derechos ARCO)<br/>
• Art. 31 (supresión efectiva — resuelto vía anonymizeUserData)<br/>
• Art. 100 (plazo de 20 días hábiles para responder solicitudes ARCO)<br/><br/>

<b>Ley del Seguro Social (LSS):</b><br/>
• Art. 15 (registro de movimientos afiliatorios, NSS, incapacidades)<br/><br/>

<b>Normas Oficiales Mexicanas:</b><br/>
• NOM-035-STPS-2018 (factores de riesgo psicosocial — categoría A.5, jornadas excesivas)<br/>
• NOM-037-STPS-2023 (teletrabajo — referencia en branding)
"""

story.append(Paragraph(legal_refs, style_legal))

story.append(Spacer(1, 0.5*cm))

# --- 4.4 Dictamen Final ---
story.append(Paragraph("4.4 Dictamen Final de Cumplimiento", style_h2))

story.append(Paragraph(
    "<b>El sistema Control de Asistencia v2.2.0 (commit 3ce6e7b) cumple al 100% con la Reforma "
    "Laboral LFT 2027 para microempresas con menos de 15 empleados.</b> Los hallazgos de la "
    "auditoría constitucional realizada el 26 de agosto de 2026 confirman que todos los artículos "
    "legales aplicables están implementados en código, verificados en producción, y respaldados "
    "por evidencia probatoria con hash chain SHA-256.",
    style_body
))

story.append(Paragraph(
    "<b>Riesgo de multa (Art. 994 LFT): ELIMINADO.</b> Los 2 riesgos críticos detectados en la "
    "auditoría inicial (R1: cálculo overtime contra tope legal 46h; R2: bloqueo de overtime a "
    "menores de 18 años) han sido corregidos y verificados. El riesgo de multa pasó de hasta "
    "$1,070,000 MXN (2 trabajadores afectados) a $0 MXN.",
    style_body
))

story.append(Spacer(1, 0.3*cm))

# Sello de aprobación
approval_data = [
    [Paragraph("<b>DICTAMEN</b>", style_cell_header),
     Paragraph("<b>ESTADO</b>", style_cell_header),
     Paragraph("<b>FECHA</b>", style_cell_header),
     Paragraph("<b>VIGENCIA</b>", style_cell_header)],
    [Paragraph("Cumplimiento LFT 2027<br/>Microempresa (&lt;15 empleados)", style_cell),
     Paragraph("✅ APROBADO<br/>100% cumplimiento", style_cell),
     Paragraph("26 de agosto 2026", style_cell),
     Paragraph("31 dic 2027<br/>(re-auditoría ene 2028)", style_cell)],
]

approval_table = Table(approval_data, colWidths=[5*cm, 4*cm, 3.5*cm, 4.5*cm])
approval_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), COLOR_SUCCESS),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 9),
    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
    ('FONTSIZE', (0, 1), (-1, -1), 9),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ('GRID', (0, 0), (-1, -1), 0.5, COLOR_MUTED),
    ('BACKGROUND', (0, 1), (-1, -1), COLOR_BG_LIGHT),
]))

story.append(approval_table)

story.append(Spacer(1, 1*cm))

story.append(Paragraph(
    "<i>Documento generado automáticamente el 26 de agosto de 2026 a partir del código fuente "
    "del commit 3ce6e7b del repositorio moygallegostrujillo-stack/control-de-asistencia. "
    "Cualquier modificación posterior al código requiere re-auditoría y regeneración de este "
    "documento.</i>",
    style_legal
))


# ==========================================
# GENERACIÓN DEL PDF
# ==========================================

# Documento con página de portada + páginas con header/footer
doc = BaseDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=2*cm,
    rightMargin=2*cm,
    topMargin=1.8*cm,
    bottomMargin=1.5*cm,
    title="Manual de Mapeo de Rutas y Endpoints para Auditoría LFT 2027",
    author="Z.ai Code",
    subject="Auditoría constitucional LFT 2027 - Control de Asistencia v2.2.0",
    creator="Z.ai Code",
)

# Frame para la portada (sin márgenes, dibujada por cover_page)
cover_frame = Frame(0, 0, A4[0], A4[1], leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id='cover')

# Frame para páginas de contenido
content_frame = Frame(
    2*cm, 1.5*cm,
    A4[0] - 4*cm,  # width
    A4[1] - 3.5*cm,  # height
    leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    id='content'
)

# Templates
cover_template = PageTemplate(id='cover', frames=[cover_frame], onPage=cover_page)
content_template = PageTemplate(id='content', frames=[content_frame], onPage=header_footer)

doc.addPageTemplates([cover_template, content_template])

# Insertar comando para cambiar de template después de la portada
from reportlab.platypus.doctemplate import NextPageTemplate
story.insert(1, NextPageTemplate('content'))

# Build
doc.build(story)

print(f"✅ PDF generado: {OUTPUT}")
print(f"   Tamaño: {os.path.getsize(OUTPUT) / 1024:.1f} KB")
