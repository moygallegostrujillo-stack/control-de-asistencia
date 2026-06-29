#!/usr/bin/env python3
"""
Generador del PDF: Control de Asistencia NOM-037 — Descripción v2.2
Incluye las mejoras de Fase 1: NextAuth, WebSockets, SUPERVISOR.
"""

import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Fonts
try:
    pdfmetrics.registerFont(TTFont('Inter', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
    pdfmetrics.registerFont(TTFont('Inter-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('Inter-Italic', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf'))
    BODY_FONT = 'Inter'
    BOLD_FONT = 'Inter-Bold'
    ITALIC_FONT = 'Inter-Italic'
except:
    BODY_FONT = 'Helvetica'
    BOLD_FONT = 'Helvetica-Bold'
    ITALIC_FONT = 'Helvetica-Oblique'

# Colors
C_BG = colors.HexColor('#F8FAFC')
C_TEXT = colors.HexColor('#1E293B')
C_MUTED = colors.HexColor('#64748B')
C_ACCENT = colors.HexColor('#0F766E')
C_ACCENT_LIGHT = colors.HexColor('#CCFBF1')
C_HEADER = colors.HexColor('#0F172A')
C_BORDER = colors.HexColor('#E2E8F0')
C_GREEN = colors.HexColor('#047857')
C_GREEN_BG = colors.HexColor('#D1FAE5')
C_AMBER = colors.HexColor('#B45309')
C_AMBER_BG = colors.HexColor('#FEF3C7')
C_RED = colors.HexColor('#BE123C')

styles = getSampleStyleSheet()

S_TITLE = ParagraphStyle('T', fontName=BOLD_FONT, fontSize=24, leading=30, textColor=C_HEADER, spaceAfter=6)
S_H1 = ParagraphStyle('H1', fontName=BOLD_FONT, fontSize=16, leading=22, textColor=C_HEADER, spaceBefore=24, spaceAfter=10)
S_H2 = ParagraphStyle('H2', fontName=BOLD_FONT, fontSize=13, leading=18, textColor=C_ACCENT, spaceBefore=16, spaceAfter=8)
S_BODY = ParagraphStyle('B', fontName=BODY_FONT, fontSize=10, leading=15, textColor=C_TEXT, spaceAfter=6, alignment=TA_JUSTIFY)
S_MUTED = ParagraphStyle('M', fontName=ITALIC_FONT, fontSize=9, leading=13, textColor=C_MUTED)
S_TH = ParagraphStyle('TH', fontName=BOLD_FONT, fontSize=9, leading=12, textColor=colors.white)
S_TC = ParagraphStyle('TC', fontName=BODY_FONT, fontSize=9, leading=12, textColor=C_TEXT, spaceAfter=0)
S_TCB = ParagraphStyle('TCB', fontName=BOLD_FONT, fontSize=9, leading=12, textColor=C_TEXT, spaceAfter=0)

def p(text, style=S_BODY):
    return Paragraph(text, style)

def status_badge(text, status='done'):
    cmap = {'done': C_GREEN, 'new': C_ACCENT, 'partial': C_AMBER, 'pending': C_RED}
    icons = {'done': '✓', 'new': '★', 'partial': '◐', 'pending': '✗'}
    c = cmap.get(status, C_MUTED)
    return f'<font color="{c.hexval()}"><b>{icons.get(status, "○")} {text}</b></font>'

def make_table(data, col_widths=None):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), BOLD_FONT),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, C_BG]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t

def on_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(C_ACCENT)
    canvas.setLineWidth(2)
    canvas.line(20*mm, A4[1] - 15*mm, A4[0] - 20*mm, A4[1] - 15*mm)
    canvas.setFont(BODY_FONT, 8)
    canvas.setFillColor(C_MUTED)
    canvas.drawString(20*mm, A4[1] - 12*mm, 'Control de Asistencia NOM-037 · v2.2')
    canvas.drawRightString(A4[0] - 20*mm, A4[1] - 12*mm, 'Descripción del Proyecto')
    canvas.setStrokeColor(C_BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, 15*mm, A4[0] - 20*mm, 15*mm)
    canvas.setFont(BODY_FONT, 8)
    canvas.setFillColor(C_MUTED)
    canvas.drawString(20*mm, 10*mm, 'control-asistencia-v22.vercel.app')
    canvas.drawRightString(A4[0] - 20*mm, 10*mm, f'Página {doc.page}')
    canvas.restoreState()

def on_first_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(C_HEADER)
    canvas.rect(0, A4[1] - 60*mm, A4[0], 60*mm, fill=1, stroke=0)
    canvas.setFillColor(C_ACCENT)
    canvas.rect(0, A4[1] - 63*mm, A4[0], 3*mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont(BOLD_FONT, 26)
    canvas.drawString(20*mm, A4[1] - 35*mm, 'Control de Asistencia')
    canvas.setFont(BOLD_FONT, 18)
    canvas.setFillColor(C_ACCENT_LIGHT)
    canvas.drawString(20*mm, A4[1] - 48*mm, 'NOM-037-STPS-2023')
    canvas.setFillColor(C_ACCENT)
    canvas.roundRect(20*mm, A4[1] - 58*mm, 60*mm, 8*mm, 4*mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont(BOLD_FONT, 9)
    canvas.drawCentredString(50*mm, A4[1] - 55*mm, 'VERSION 2.2 - PRODUCCION')
    canvas.setFillColor(C_TEXT)
    canvas.setFont(BODY_FONT, 11)
    canvas.drawString(20*mm, A4[1] - 80*mm, 'Descripcion Completa del Proyecto')
    canvas.setFillColor(C_MUTED)
    canvas.setFont(ITALIC_FONT, 10)
    canvas.drawString(20*mm, A4[1] - 87*mm, 'Sistema web de control de asistencia laboral con geolocalizacion,')
    canvas.drawString(20*mm, A4[1] - 93*mm, 'codigos QR dinamicos, gestion de descansos y reportes NOM-037.')
    canvas.setFillColor(C_MUTED)
    canvas.setFont(BODY_FONT, 8)
    canvas.drawString(20*mm, 15*mm, 'control-asistencia-v22.vercel.app')
    canvas.drawRightString(A4[0] - 20*mm, 15*mm, 'Generado: 2025 - Mexico')
    canvas.restoreState()

def build_pdf(output_path):
    doc = SimpleDocTemplate(output_path, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm,
        topMargin=22*mm, bottomMargin=20*mm,
        title='Control de Asistencia NOM-037 v2.2', author='Control de Asistencia',
        subject='Descripcion tecnica del proyecto', creator='Control de Asistencia v2.2')
    story = []

    # COVER
    story.append(Spacer(1, 100*mm))
    cover_data = [
        [p('Documento', S_TCB), p('Descripcion Completa del Proyecto', S_TC)],
        [p('Version', S_TCB), p('2.2 (Produccion)', S_TC)],
        [p('Framework', S_TCB), p('Next.js 16 + TypeScript 5', S_TC)],
        [p('Base de datos', S_TCB), p('Supabase PostgreSQL', S_TC)],
        [p('Deploy', S_TCB), p('Vercel (control-asistencia-v22.vercel.app)', S_TC)],
        [p('Cumplimiento', S_TCB), p('NOM-037-STPS-2023 - LFT Mexico', S_TC)],
    ]
    t = Table(cover_data, colWidths=[40*mm, 120*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), C_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, C_BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(t)
    story.append(PageBreak())

    # 1. DESCRIPCION
    story.append(p('Descripcion del Proyecto', S_H1))
    story.append(p('<b>Control de Asistencia</b> es un sistema web completo de control de asistencia laboral disenado para cumplir con la <b>NOM-037-STPS-2023</b> (Norma Oficial Mexicana de Condiciones de Seguridad y Salud en el Trabajo - Trabajo a Distancia y Teletrabajo). El sistema permite registrar y monitorear la asistencia de empleados con geolocalizacion, codigos QR dinamicos, gestion de descansos y generacion de reportes, todo bajo un marco de auditoria inmutable.'))
    story.append(p('La version 2.2 incorpora mejoras significativas de seguridad y funcionalidad: autenticacion robusta con NextAuth.js v4 (JWT firmado + MFA TOTP), notificaciones en tiempo real via WebSockets/Socket.io, y un sistema de control de acceso basado en roles (RBAC) de 4 niveles con el nuevo rol Supervisor.'))

    # 2. TECNOLOGIAS
    story.append(p('Tecnologias Utilizadas', S_H1))
    tech_data = [
        [p('Categoria', S_TH), p('Tecnologia', S_TH), p('Detalle', S_TH)],
        [p('Framework', S_TCB), p('Next.js 16 (App Router)', S_TC), p('Output standalone, SSR/CSR', S_TC)],
        [p('Lenguaje', S_TCB), p('TypeScript 5', S_TC), p('Strict mode', S_TC)],
        [p('Frontend', S_TCB), p('React 19 + Tailwind CSS 4', S_TC), p('shadcn/ui New York style', S_TC)],
        [p('Animaciones', S_TCB), p('Framer Motion', S_TC), p('Transiciones, hover effects', S_TC)],
        [p('Estado', S_TCB), p('Zustand 5 + TanStack Query', S_TC), p('Auth store + Server state', S_TC)],
        [p('Base de datos', S_TCB), p('Supabase PostgreSQL', S_TC), p('Prisma ORM 6 nativo', S_TC)],
        [p('<b>Autenticacion</b>', S_TCB), p('<b>NextAuth.js v4 (JWT)</b>', S_TC), p('<b>Firmado HMAC-SHA512 + MFA TOTP</b>', S_TC)],
        [p('Encriptacion', S_TCB), p('bcryptjs + AES-256-GCM', S_TC), p('Hash passwords + secreto MFA', S_TC)],
        [p('Codigos QR', S_TCB), p('qrcode + crypto', S_TC), p('HMAC-SHA256, 5 min expiracion', S_TC)],
        [p('<b>Tiempo real</b>', S_TCB), p('<b>Socket.io</b>', S_TC), p('<b>Mini-service puerto 3003</b>', S_TC)],
        [p('Fechas', S_TCB), p('date-fns', S_TC), p('America/Mexico_City', S_TC)],
        [p('Export', S_TCB), p('exceljs', S_TC), p('XLSX multi-hoja + CSV', S_TC)],
        [p('Deploy', S_TCB), p('Vercel', S_TC), p('Region iad1, build automatico', S_TC)],
    ]
    story.append(make_table(tech_data, col_widths=[35*mm, 55*mm, 70*mm]))

    # 3. FUNCIONALIDADES
    story.append(PageBreak())
    story.append(p('Funcionalidades Implementadas', S_H1))

    story.append(p('1. Autenticacion Robusta (Fase 1 - Mejorada)', S_H2))
    story.append(p('El sistema migro de cookies base64 sin firma a <b>NextAuth.js v4 con JWT firmado</b>. El token esta encriptado con NEXTAUTH_SECRET usando AES-256-GCM, lo que hace imposible la falsificacion de sesiones. Adicionalmente, se implemento MFA TOTP (RFC 6238) opcional para cuentas de administrador, compatible con Google Authenticator, Authy y 1Password.'))
    auth_data = [
        [p('Feature', S_TH), p('Estado', S_TH), p('Detalle', S_TH)],
        [p('Login con email + password', S_TC), p(status_badge('Implementado', 'done'), S_TC), p('bcryptjs + lockout 5 intentos', S_TC)],
        [p('Login rapido (kiosco)', S_TC), p(status_badge('Implementado', 'done'), S_TC), p('Botones sin contraseña', S_TC)],
        [p('Login con QR dinamico', S_TC), p(status_badge('Implementado', 'done'), S_TC), p('HMAC-SHA256, 5 min', S_TC)],
        [p('JWT firmado (NextAuth)', S_TC), p(status_badge('NUEVO v2.2', 'new'), S_TC), p('AES-256-GCM, rotacion 30 min', S_TC)],
        [p('MFA TOTP opcional', S_TC), p(status_badge('NUEVO v2.2', 'new'), S_TC), p('otplib + 10 backup codes', S_TC)],
        [p('Cookie HttpOnly + SameSite', S_TC), p(status_badge('NUEVO v2.2', 'new'), S_TC), p('Proteccion CSRF + XSS', S_TC)],
    ]
    story.append(make_table(auth_data, col_widths=[55*mm, 35*mm, 70*mm]))

    story.append(p('2. Panel de Administrador (9 vistas)', S_H2))
    admin_data = [
        [p('Vista', S_TH), p('Funcionalidad', S_TH)],
        [p('Dashboard', S_TCB), p('KPIs en tiempo real, tabla de asistencia, resumen de descansos, ausentes', S_TC)],
        [p('Empleados', S_TCB), p('CRUD completo, QR individual, transferencia, horarios L-V', S_TC)],
        [p('Sucursales', S_TCB), p('CRUD con geofencing (Haversine), codigo de local (Local 261)', S_TC)],
        [p('Asistencia', S_TCB), p('Historial con filtros, correccion manual, justificaciones, CSV', S_TC)],
        [p('Reportes', S_TCB), p('5 tipos: Diario, HE, Ausencias, Incidencias, Comparativo - CSV + XLSX', S_TC)],
        [p('Vacaciones', S_TCB), p('Solicitudes, aprobacion, balance automatico, tipos multiples', S_TC)],
        [p('Auditoria', S_TCB), p('Log inmutable con IP, user-agent, paginacion, filtros', S_TC)],
        [p('Terminal QR', S_TCB), p('Codigos QR dinamicos con auto-refresh cada 4 min', S_TC)],
        [p('Empresa', S_TCB), p('Razon social, RFC, registro patronal (NOM-037)', S_TC)],
    ]
    story.append(make_table(admin_data, col_widths=[40*mm, 120*mm]))

    story.append(p('3. Panel de Empleado (4 vistas)', S_H2))
    emp_data = [
        [p('Vista', S_TH), p('Funcionalidad', S_TH)],
        [p('Asistencia', S_TCB), p('Check-in/out GPS o QR, descanso 30 min con timer visual, mapa', S_TC)],
        [p('Historial', S_TCB), p('Registro propio con filtros y descarga CSV', S_TC)],
        [p('Vacaciones', S_TCB), p('Balance de dias, solicitud y cancelacion', S_TC)],
        [p('Mi QR', S_TCB), p('Codigo QR personal estatico para descarga PNG', S_TC)],
    ]
    story.append(make_table(emp_data, col_widths=[40*mm, 120*mm]))

    # 4. NOVEDADES V2.2
    story.append(PageBreak())
    story.append(p('Novedades de la Version 2.2 (Fase 1)', S_H1))
    story.append(p('La version 2.2 introduce tres mejoras fundamentales que elevan el sistema al siguiente nivel de seguridad, usabilidad y escalabilidad.'))

    story.append(p('A. NextAuth.js v4 - Seguridad Robusta', S_H2))
    story.append(p('Se migro del sistema de cookies base64 sin firma a <b>NextAuth.js v4 con JWT firmado</b>. El token de sesion ahora esta encriptado con AES-256-GCM usando NEXTAUTH_SECRET, lo que elimina el riesgo de falsificacion de sesiones. Se mantienen los tres flujos de login (password, QR dinamico, quick-login) que ahora emiten JWT firmados. Adicionalmente, se implemento <b>MFA TOTP</b> opcional para administradores, con generacion de backup codes y encriptacion del secreto a nivel aplicacion.'))

    story.append(p('B. WebSockets/Socket.io - Tiempo Real', S_H2))
    story.append(p('Se implemento un mini-service independiente con Socket.io (puerto 3003) que permite al panel de administrador recibir notificaciones instantaneas cuando un empleado hace check-in, check-out, inicia/termina descanso, o solicita vacaciones. El frontend usa el hook <b>useRealtime</b> que invalida automaticamente las queries de TanStack Query, eliminando la necesidad de refresco manual.'))
    rt_data = [
        [p('Evento', S_TH), p('Trigger', S_TH), p('Destinatario', S_TH)],
        [p('attendance:check-in', S_TC), p('POST /api/attendance/check-in', S_TC), p('Admins de la sucursal', S_TC)],
        [p('attendance:check-out', S_TC), p('POST /api/attendance/check-out', S_TC), p('Admins de la sucursal', S_TC)],
        [p('attendance:break-start', S_TC), p('POST /api/attendance/meal-start', S_TC), p('Admins de la sucursal', S_TC)],
        [p('attendance:break-end', S_TC), p('POST /api/attendance/meal-end', S_TC), p('Admins de la sucursal', S_TC)],
        [p('vacation:requested', S_TC), p('POST /api/vacations', S_TC), p('Admins de la sucursal', S_TC)],
        [p('vacation:status', S_TC), p('PUT /api/vacations/[id]', S_TC), p('Admins + empleado', S_TC)],
    ]
    story.append(make_table(rt_data, col_widths=[50*mm, 60*mm, 50*mm]))

    story.append(p('C. Rol Supervisor - RBAC de 4 Niveles', S_H2))
    story.append(p('Se anadio el rol <b>SUPERVISOR</b> al sistema de control de acceso basado en roles. Este rol es intermedio entre Admin de Sucursal y Empleado: puede <b>ver</b> asistencia, empleados, reportes y auditoria de su sucursal, pero <b>no puede</b> crear/editar/eliminar empleados, aprobar vacaciones, corregir registros, ni generar QR.'))
    roles_data = [
        [p('Rol', S_TH), p('Alcance', S_TH), p('Permisos clave', S_TH)],
        [p('GENERAL_ADMIN', S_TCB), p('Global', S_TC), p('Todo: CRUD, reportes comparativos, empresa, usuarios', S_TC)],
        [p('SUCURSAL_ADMIN', S_TCB), p('Su sucursal', S_TC), p('CRUD empleados, aprobar vacaciones, corregir, QR', S_TC)],
        [p('<b>SUPERVISOR</b>', S_TCB), p('Su sucursal', S_TC), p('<b>Solo lectura</b>: dashboard, asistencia, reportes, auditoria', S_TC)],
        [p('EMPLOYEE', S_TCB), p('Propio', S_TC), p('Check-in/out, historial, vacaciones, Mi QR', S_TC)],
    ]
    story.append(make_table(roles_data, col_widths=[40*mm, 40*mm, 80*mm]))

    # 5. NOM-037
    story.append(PageBreak())
    story.append(p('Cumplimiento NOM-037', S_H1))
    story.append(p('El sistema esta disenado para cumplir con los requisitos de la NOM-037-STPS-2023 y la Ley Federal del Trabajo de Mexico. Los registros son inmutables, la geolocalizacion es obligatoria, y cada accion queda registrada en la bitacora de auditoria.'))
    nom_data = [
        [p('Requisito', S_TH), p('Implementacion', S_TH)],
        [p('Registros inmutables', S_TCB), p('isLocked: true - no se pueden alterar una vez creados', S_TC)],
        [p('Geolocalizacion obligatoria', S_TCB), p('Lat/long en check-in/out + geofencing Haversine', S_TC)],
        [p('Auditoria completa', S_TCB), p('Cada accion con IP, user-agent, timestamp, usuario', S_TC)],
        [p('Sistema de justificaciones', S_TCB), p('Para registros inconsistentes (PENDING/APPROVED/REJECTED)', S_TC)],
        [p('Calculo de horas extra', S_TCB), p('Automatico segun horario, historico 90 dias', S_TC)],
        [p('Tolerancia configurable', S_TCB), p('Por sucursal: entrada, salida, descanso', S_TC)],
        [p('Descanso de 30 min', S_TCB), p('Para jornadas >=8h, con deteccion de exceso', S_TC)],
        [p('Datos de empresa', S_TCB), p('Razon social, RFC, registro patronal en reportes', S_TC)],
        [p('Dias feriados', S_TCB), p('Calendario de dias no laborables', S_TC)],
    ]
    story.append(make_table(nom_data, col_widths=[50*mm, 110*mm]))

    # 6. REPORTES
    story.append(p('Reportes y Exportacion', S_H1))
    story.append(p('El sistema genera 5 tipos de reportes con exportacion a CSV y XLSX (multi-hoja con Portada, Datos y Resumen). Todos los reportes respetan el scope de sucursal del usuario.'))
    rep_data = [
        [p('Reporte', S_TH), p('Contenido', S_TH), p('Acceso', S_TH)],
        [p('Diario', S_TCB), p('Asistencia por fecha con desglose por sucursal', S_TC), p('Todos los admins', S_TC)],
        [p('Horas Extra', S_TCB), p('Calculo automatico, historico 90 dias, por empleado', S_TC), p('Todos los admins', S_TC)],
        [p('Ausencias', S_TCB), p('Faltas justificadas e injustificadas', S_TC), p('Todos los admins', S_TC)],
        [p('Incidencias', S_TCB), p('Consolidado: faltas, retardos, salidas anticipadas, HE', S_TC), p('Todos los admins', S_TC)],
        [p('Comparativo', S_TCB), p('Comparativo entre sucursales con attendanceRate', S_TC), p('Solo GENERAL_ADMIN', S_TC)],
    ]
    story.append(make_table(rep_data, col_widths=[35*mm, 90*mm, 35*mm]))

    # 7. METRICAS
    story.append(PageBreak())
    story.append(p('Resumen en Numeros', S_H1))
    met_data = [
        [p('Metrica', S_TH), p('Valor', S_TH)],
        [p('Modelos de base de datos', S_TCB), p('10 (User, Employee, Company, Sucursal, WorkSchedule, AttendanceRecord, Vacation, Holiday, AuditLog, DynamicQR)', S_TC)],
        [p('Rutas API', S_TCB), p('~70 endpoints en 55 archivos', S_TC)],
        [p('Roles de usuario', S_TCB), p('4 (GENERAL_ADMIN, SUCURSAL_ADMIN, SUPERVISOR, EMPLOYEE)', S_TC)],
        [p('Tipos de reportes', S_TCB), p('5 (Diario, Horas Extra, Ausencias, Incidencias, Comparativo)', S_TC)],
        [p('Vistas panel admin', S_TCB), p('9 (Dashboard, Empleados, Sucursales, Asistencia, Reportes, Vacaciones, Auditoria, QR, Empresa)', S_TC)],
        [p('Vistas panel empleado', S_TCB), p('4 (Asistencia, Historial, Vacaciones, Mi QR)', S_TC)],
        [p('Componentes shadcn/ui', S_TCB), p('40+', S_TC)],
        [p('Eventos Socket.io', S_TCB), p('6 (check-in, check-out, break-start/end, vacation-requested/status)', S_TC)],
        [p('URL produccion', S_TCB), p('control-asistencia-v22.vercel.app', S_TC)],
    ]
    story.append(make_table(met_data, col_widths=[55*mm, 105*mm]))

    # 8. ROADMAP
    story.append(p('Roadmap de Evolucion', S_H1))
    story.append(p('El sistema tiene una base solida y funcional para cumplimiento NOM-037. Las siguientes mejoras estan identificadas como siguientes pasos para escalar como producto SaaS.'))
    rm_data = [
        [p('Prioridad', S_TH), p('Area', S_TH), p('Estado', S_TH)],
        [p('Critico', S_TCB), p('NextAuth.js v4 con JWT + MFA', S_TC), p(status_badge('Completado v2.2', 'done'), S_TC)],
        [p('Critico', S_TCB), p('WebSockets tiempo real (Socket.io)', S_TC), p(status_badge('Completado v2.2', 'done'), S_TC)],
        [p('Critico', S_TCB), p('RBAC granular (4 roles con Supervisor)', S_TC), p(status_badge('Completado v2.2', 'done'), S_TC)],
        [p('Importante', S_TCB), p('App movil PWA instalable', S_TC), p(status_badge('Pendiente', 'pending'), S_TC)],
        [p('Importante', S_TCB), p('Notificaciones push/email', S_TC), p(status_badge('Pendiente', 'pending'), S_TC)],
        [p('Importante', S_TCB), p('Integracion con nomina (SAP, Odoo)', S_TC), p(status_badge('Pendiente', 'pending'), S_TC)],
        [p('Importante', S_TCB), p('Dashboard analytics avanzado', S_TC), p(status_badge('Parcial', 'partial'), S_TC)],
        [p('Deseable', S_TCB), p('Turnos rotativos', S_TC), p(status_badge('Pendiente', 'pending'), S_TC)],
        [p('Deseable', S_TCB), p('Modo offline (Service Worker)', S_TC), p(status_badge('Pendiente', 'pending'), S_TC)],
        [p('Deseable', S_TCB), p('Multi-tenant SaaS', S_TC), p(status_badge('Pendiente', 'pending'), S_TC)],
        [p('Deseable', S_TCB), p('CI/CD GitHub Actions', S_TC), p(status_badge('Pendiente', 'pending'), S_TC)],
        [p('Deseable', S_TCB), p('API publica (Swagger/OpenAPI)', S_TC), p(status_badge('Pendiente', 'pending'), S_TC)],
    ]
    story.append(make_table(rm_data, col_widths=[25*mm, 85*mm, 50*mm]))

    story.append(Spacer(1, 15*mm))
    story.append(p('<i>El proyecto tiene una base solida y funcional para cumplimiento NOM-037. La Fase 1 (autenticacion robusta, tiempo real, RBAC granular) esta completa. Los pilares clave para el siguiente nivel son: app movil/PWA, notificaciones, integracion con nomina, y multi-tenant SaaS.</i>', S_MUTED))

    doc.build(story, onFirstPage=on_first_page, onLaterPages=on_page)
    print(f'OK {output_path} ({os.path.getsize(output_path)/1024:.1f}KB)')

if __name__ == '__main__':
    build_pdf('/home/z/my-project/public/Proyecto-Asistencias-v2.2.pdf')
