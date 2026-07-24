#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Manual de Usuario - Control de Asistencia NOM-037 v2.2
Generado con ReportLab. Paleta cascade (minimal mode).
"""
import os, sys, hashlib, shutil
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, Image, Flowable, HRFlowable, NextPageTemplate, PageTemplate,
    Frame, BaseDocTemplate
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ━━ PALETTE (cascade, minimal mode) ━━
PAGE_BG       = colors.HexColor('#f3f3f2')
SECTION_BG    = colors.HexColor('#eae9e6')
CARD_BG       = colors.HexColor('#f0efec')
TABLE_STRIPE  = colors.HexColor('#efeeec')
HEADER_FILL   = colors.HexColor('#63593b')
COVER_BLOCK   = colors.HexColor('#6e664f')
BORDER        = colors.HexColor('#c5c1b3')
ICON          = colors.HexColor('#756944')
ACCENT        = colors.HexColor('#8c7226')
ACCENT_2      = colors.HexColor('#5ca2ba')
TEXT_PRIMARY   = colors.HexColor('#171715')
TEXT_MUTED     = colors.HexColor('#8b8881')
SEM_SUCCESS   = colors.HexColor('#43905d')
SEM_WARNING   = colors.HexColor('#9f7f3e')
SEM_ERROR     = colors.HexColor('#9c4740')
SEM_INFO      = colors.HexColor('#547495')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# Try to register TTF fonts; fall back to Helvetica
FONT_REG = 'Helvetica'
FONT_BOLD = 'Helvetica-Bold'
FONT_ITAL = 'Helvetica-Oblique'
FONT_BI = 'Helvetica-BoldOblique'

try:
    pdfmetrics.registerFont(TTFont('NotoSans', '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('NotoSans-Bold', '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('NotoSans-Italic', '/usr/share/fonts/truetype/noto/NotoSans-Italic.ttf'))
    pdfmetrics.registerFont(TTFont('NotoSans-BoldItalic', '/usr/share/fonts/truetype/noto/NotoSans-BoldItalic.ttf'))
    from reportlab.pdfbase.pdfmetrics import registerFontFamily
    registerFontFamily('NotoSans', normal='NotoSans', bold='NotoSans-Bold',
                       italic='NotoSans-Italic', boldItalic='NotoSans-BoldItalic')
    FONT_REG = 'NotoSans'; FONT_BOLD = 'NotoSans-Bold'; FONT_ITAL = 'NotoSans-Italic'; FONT_BI = 'NotoSans-BoldItalic'
    print("Fuentes NotoSans registradas")
except Exception as e:
    print(f"NotoSans no disponible ({e}), usando Helvetica")

# ━━ STYLES ━━
ss = getSampleStyleSheet()

STY_TITLE = ParagraphStyle('Title', fontName=FONT_BOLD, fontSize=28, leading=34,
                           textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=8)
STY_SUBTITLE = ParagraphStyle('Subtitle', fontName=FONT_REG, fontSize=14, leading=20,
                              textColor=TEXT_MUTED, alignment=TA_LEFT, spaceAfter=24)
STY_H1 = ParagraphStyle('H1', fontName=FONT_BOLD, fontSize=20, leading=26,
                        textColor=HEADER_FILL, spaceBefore=18, spaceAfter=12, keepWithNext=1)
STY_H2 = ParagraphStyle('H2', fontName=FONT_BOLD, fontSize=15, leading=20,
                        textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=8, keepWithNext=1)
STY_H3 = ParagraphStyle('H3', fontName=FONT_BOLD, fontSize=12, leading=16,
                        textColor=ACCENT, spaceBefore=10, spaceAfter=6, keepWithNext=1)
STY_BODY = ParagraphStyle('Body', fontName=FONT_REG, fontSize=10, leading=15,
                          textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=6)
STY_BODY_TIGHT = ParagraphStyle('BodyTight', fontName=FONT_REG, fontSize=10, leading=14,
                                textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=4)
STY_BULLET = ParagraphStyle('Bullet', fontName=FONT_REG, fontSize=10, leading=14,
                            textColor=TEXT_PRIMARY, leftIndent=18, bulletIndent=4, spaceAfter=3)
STY_NOTE = ParagraphStyle('Note', fontName=FONT_ITAL, fontSize=9, leading=13,
                          textColor=TEXT_MUTED, alignment=TA_LEFT, spaceAfter=8,
                          leftIndent=10, borderColor=BORDER, borderWidth=0, borderPadding=4,
                          backColor=CARD_BG)
STY_TABLE_CELL = ParagraphStyle('TblCell', fontName=FONT_REG, fontSize=9, leading=12,
                                textColor=TEXT_PRIMARY, alignment=TA_LEFT)
STY_TABLE_CELL_C = ParagraphStyle('TblCellC', fontName=FONT_REG, fontSize=9, leading=12,
                                  textColor=TEXT_PRIMARY, alignment=TA_CENTER)
STY_TABLE_HEAD = ParagraphStyle('TblHead', fontName=FONT_BOLD, fontSize=9, leading=12,
                                textColor=colors.white, alignment=TA_LEFT)
STY_TABLE_HEAD_C = ParagraphStyle('TblHeadC', fontName=FONT_BOLD, fontSize=9, leading=12,
                                  textColor=colors.white, alignment=TA_CENTER)
STY_CODE = ParagraphStyle('Code', fontName='Courier', fontSize=9, leading=12,
                          textColor=TEXT_PRIMARY, backColor=CARD_BG, borderColor=BORDER,
                          borderWidth=0.5, borderPadding=6, leftIndent=4, rightIndent=4,
                          spaceAfter=8, spaceBefore=4)
STY_FOOTER = ParagraphStyle('Footer', fontName=FONT_REG, fontSize=8, leading=10,
                            textColor=TEXT_MUTED, alignment=TA_CENTER)
STY_COVER_KICKER = ParagraphStyle('CoverKicker', fontName=FONT_REG, fontSize=11, leading=14,
                                  textColor=ACCENT, alignment=TA_LEFT)
STY_COVER_TITLE = ParagraphStyle('CoverTitle', fontName=FONT_BOLD, fontSize=42, leading=48,
                                 textColor=TEXT_PRIMARY, alignment=TA_LEFT)
STY_COVER_SUB = ParagraphStyle('CoverSub', fontName=FONT_REG, fontSize=16, leading=22,
                               textColor=TEXT_MUTED, alignment=TA_LEFT)
STY_COVER_META = ParagraphStyle('CoverMeta', fontName=FONT_REG, fontSize=10, leading=14,
                                textColor=TEXT_MUTED, alignment=TA_LEFT)
STY_COVER_TAG = ParagraphStyle('CoverTag', fontName=FONT_BOLD, fontSize=9, leading=12,
                               textColor=colors.white, alignment=TA_CENTER)

STY_TOC0 = ParagraphStyle('TOC0', fontName=FONT_BOLD, fontSize=11, leading=18,
                          textColor=TEXT_PRIMARY, leftIndent=0, firstLineIndent=0)
STY_TOC1 = ParagraphStyle('TOC1', fontName=FONT_REG, fontSize=10, leading=15,
                          textColor=TEXT_MUTED, leftIndent=16, firstLineIndent=0)

# ━━ DOC TEMPLATE WITH TOC ━━
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

_current_chapter = ['']

def header_footer(canv, doc):
    canv.saveState()
    page_w, page_h = A4
    # Footer
    canv.setFont(FONT_REG, 8)
    canv.setFillColor(TEXT_MUTED)
    if doc.page > 1:
        # Chapter name on left
        if _current_chapter[0]:
            canv.drawString(2*cm, 1.2*cm, _current_chapter[0])
        # Page number on right
        canv.drawRightString(page_w - 2*cm, 1.2*cm, f'Pagina {doc.page}')
        # Thin line above footer
        canv.setStrokeColor(BORDER)
        canv.setLineWidth(0.3)
        canv.line(2*cm, 1.6*cm, page_w - 2*cm, 1.6*cm)
    canv.restoreState()

def cover_page(canv, doc):
    """Cover page - drawn directly on canvas."""
    canv.saveState()
    page_w, page_h = A4
    # Layer 0: page bg subtle
    canv.setFillColor(PAGE_BG)
    canv.rect(0, 0, page_w, page_h, fill=1, stroke=0)
    # Layer 1: large color block top-left (HEADER_FILL area)
    canv.setFillColor(HEADER_FILL)
    canv.rect(0, page_h - 8*cm, 10*cm, 8*cm, fill=1, stroke=0)
    # ACCENT stripe
    canv.setFillColor(ACCENT)
    canv.rect(10*cm, page_h - 8*cm, 0.4*cm, 8*cm, fill=1, stroke=0)
    # Layer 2: decorative thin lines
    canv.setStrokeColor(BORDER)
    canv.setLineWidth(0.5)
    canv.line(2*cm, 4*cm, page_w - 2*cm, 4*cm)
    # Layer 3: text content
    # Kicker (top, in white over dark block)
    canv.setFillColor(colors.white)
    canv.setFont(FONT_BOLD, 11)
    canv.drawString(2*cm, page_h - 2.5*cm, 'MANUAL DE USUARIO  |  v2.2')
    # Hero title (big, bottom of dark block)
    canv.setFillColor(colors.white)
    canv.setFont(FONT_BOLD, 32)
    canv.drawString(2*cm, page_h - 5.2*cm, 'Control de')
    canv.drawString(2*cm, page_h - 6.4*cm, 'Asistencia')
    # Subtitle below dark block
    canv.setFillColor(TEXT_PRIMARY)
    canv.setFont(FONT_REG, 16)
    canv.drawString(2*cm, page_h - 9.5*cm, 'Sistema de registro diario conforme a')
    canv.setFont(FONT_BOLD, 16)
    canv.drawString(2*cm, page_h - 10.4*cm, 'NOM-037-STPS-2023 y Reforma LFT 2027')
    # Summary block
    canv.setFillColor(TEXT_MUTED)
    canv.setFont(FONT_REG, 11)
    summary_lines = [
        'Manual tecnico-operativo para administradores y empleados del sistema.',
        'Contiene procedimientos paso a paso para gestion de empleados, sucursales,',
        'asistencia, vacaciones, reportes, alertas NOM-035 y cumplimiento legal.',
    ]
    y = page_h - 12.5*cm
    for line in summary_lines:
        canv.drawString(2*cm, y, line)
        y -= 0.55*cm
    # Tags
    tag_y = page_h - 16*cm
    tag_x = 2*cm
    tags = ['NOM-037', 'LFT 2027', 'Multi-sucursal', 'MFA TOTP', 'QR dinamico']
    canv.setFont(FONT_BOLD, 9)
    for t in tags:
        tw = canv.stringWidth(t, FONT_BOLD, 9) + 14
        canv.setFillColor(ACCENT)
        canv.roundRect(tag_x, tag_y, tw, 18, 4, fill=1, stroke=0)
        canv.setFillColor(colors.white)
        canv.drawString(tag_x + 7, tag_y + 5, t)
        tag_x += tw + 6
    # Meta block bottom
    canv.setFillColor(TEXT_PRIMARY)
    canv.setFont(FONT_BOLD, 11)
    canv.drawString(2*cm, 3.2*cm, 'Mi Empresa S.A. de C.V.')
    canv.setFillColor(TEXT_MUTED)
    canv.setFont(FONT_REG, 10)
    canv.drawString(2*cm, 2.5*cm, 'Julio 2026  |  Documento operativo interno')
    canv.drawString(2*cm, 1.9*cm, 'Version 2.2.0  |  Produccion: control-asistencia-v22.vercel.app')
    canv.restoreState()

# ━━ HELPERS ━━
def h1(text, chapter_name=None):
    """Heading 1 with bookmark for TOC."""
    if chapter_name:
        _current_chapter[0] = chapter_name
    key = f'h1_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', STY_H1)
    p.bookmark_name = key
    p.bookmark_level = 0
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def h2(text):
    key = f'h2_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', STY_H2)
    p.bookmark_name = key
    p.bookmark_level = 1
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def h3(text):
    return Paragraph(text, STY_H3)

def p(text):
    return Paragraph(text, STY_BODY)

def pt(text):
    return Paragraph(text, STY_BODY_TIGHT)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet>{text}', STY_BULLET)

def num_bullet(n, text):
    return Paragraph(f'<bullet>{n}.</bullet>{text}', STY_BULLET)

def note(text):
    return Paragraph(f'NOTA: {text}', STY_NOTE)

def code(text):
    return Paragraph(text.replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br/>'), STY_CODE)

def hr():
    return HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceBefore=4, spaceAfter=8)

def make_table(headers, rows, col_widths=None, header_align='LEFT'):
    """Build a styled table with header + striped rows. All cells are Paragraphs (wrap-safe)."""
    avail = A4[0] - 4*cm  # 17 cm content width
    if col_widths is None:
        col_widths = [avail / len(headers)] * len(headers)
    else:
        # normalize proportions to avail
        total = sum(col_widths)
        col_widths = [w/total*avail for w in col_widths]
    head_style = STY_TABLE_HEAD_C if header_align == 'CENTER' else STY_TABLE_HEAD
    data = [[Paragraph(str(h), head_style) for h in headers]]
    for r in rows:
        row = []
        for i, c in enumerate(r):
            cell_style = STY_TABLE_CELL_C if header_align == 'CENTER' and i == 0 else STY_TABLE_CELL
            row.append(Paragraph(str(c), cell_style))
        data.append(row)
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ('BACKGROUND', (0,0), (-1,0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0,0), (-1,0), TABLE_HEADER_TEXT),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('GRID', (0,0), (-1,-1), 0.3, BORDER),
        ('LINEBELOW', (0,0), (-1,0), 0.8, HEADER_FILL),
    ]
    # Striped rows
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0,i), (-1,i), TABLE_ROW_ODD))
        else:
            style.append(('BACKGROUND', (0,i), (-1,i), TABLE_ROW_EVEN))
    t.setStyle(TableStyle(style))
    return t

def kpi_grid(items):
    """4-column KPI grid: items = [(label, value, color_hex), ...]"""
    avail = A4[0] - 4*cm
    cw = avail / 4
    cells = []
    for label, value, color in items:
        sty_val = ParagraphStyle('kv', fontName=FONT_BOLD, fontSize=14, leading=18,
                                 textColor=colors.HexColor(color), alignment=TA_CENTER)
        sty_lbl = ParagraphStyle('kl', fontName=FONT_REG, fontSize=8, leading=11,
                                 textColor=TEXT_MUTED, alignment=TA_CENTER)
        inner = Table([[Paragraph(value, sty_val)], [Paragraph(label, sty_lbl)]], colWidths=[cw-0.3*cm])
        inner.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
            ('BOX', (0,0), (-1,-1), 0.3, BORDER),
            ('LEFTPADDING', (0,0), (-1,-1), 4),
            ('RIGHTPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        cells.append(inner)
    while len(cells) % 4 != 0:
        cells.append('')
    rows = [cells[i:i+4] for i in range(0, len(cells), 4)]
    outer = Table(rows, colWidths=[cw]*4)
    outer.setStyle(TableStyle([
        ('LEFTPADDING', (0,0), (-1,-1), 2),
        ('RIGHTPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    return outer

# ━━ BUILD STORY ━━
story = []

# === COVER PAGE ===
story.append(Spacer(1, 1))  # placeholder; cover drawn by cover_page callback
story.append(PageBreak())

# === TOC ===
story.append(Paragraph('Tabla de contenidos', STY_H1))
story.append(Spacer(1, 6))
toc = TableOfContents()
toc.levelStyles = [STY_TOC0, STY_TOC1]
story.append(toc)
story.append(PageBreak())

# === CHAPTER 1: INTRODUCCION ===
story.append(h1('1. Introduccion', 'Capitulo 1. Introduccion'))
story.append(p('El sistema <b>Control de Asistencia NOM-037 v2.2</b> es una plataforma web '
               'multi-sucursal disenada para registrar y gestionar la asistencia del personal '
               'conforme a la <b>NOM-037-STPS-2023</b> (teletrabajo) y la <b>Reforma LFT 2027</b> '
               '(horas extra dobles/triples, prima por descanso trabajado, firma de registros por '
               'el empleado). El sistema esta deployado en Vercel con base de datos PostgreSQL en '
               'Supabase, ambos en la region US East (aws-1-us-east-1) para minima latencia.'))

story.append(h2('1.1 Proposito del sistema'))
story.append(p('El sistema automatiza el ciclo completo de control de asistencia: check-in/out con '
               'GPS o QR, calculo automatico de horas extra dobles (art. 66 LFT) y triples (art. 68), '
               'prima por descanso trabajado (art. 73), gestion de vacaciones y permisos, alertas '
               'NOM-035 de factores de riesgo psicosocial, reportes exportables (CSV/XLSX) con '
               'datos para nomina, y auditoria completa de todas las acciones para cumplimiento legal.'))
story.append(p('Esta disenado para empresas mexicanas con una o varias sucursales, que necesitan '
               'cumplir con la reforma laboral 2027 en cuanto a limites de horas extra y prima '
               'por descanso trabajado, asi como mantener registros inmutables y auditables.'))

story.append(h2('1.2 Cumplimiento legal'))
story.append(p('El sistema implementa de forma nativa las siguientes disposiciones legales:'))
story.append(bullet('<b>NOM-037-STPS-2023</b>: registro de entrada/salida con hora, ubicacion y metodo (GPS/QR/biometrico).'))
story.append(bullet('<b>Art. 66 LFT</b>: tope diario de 4 horas extra; las primeras horas semanales pagan al doble.'))
story.append(bullet('<b>Art. 68 LFT</b>: el excedente del tope semanal paga al triple.'))
story.append(bullet('<b>Art. 71 LFT</b>: minimo un dia de descanso semanal (configurable, no necesariamente domingo).'))
story.append(bullet('<b>Art. 73 LFT</b>: prima del 100% adicional por trabajar en dia de descanso (jornada completa + 100%).'))
story.append(bullet('<b>Art. 74 LFT</b>: dias feriados oficiales (7 feriados 2027 pre-cargados).'))
story.append(bullet('<b>Art. 132 fraccion XXXIV LFT</b>: firma de registros por el empleado (prueba plena, HMAC-SHA256 con PIN).'))
story.append(bullet('<b>Art. 804 LFT</b>: conservacion minima de 12 meses (export XLSX soporta hasta 366 dias).'))
story.append(bullet('<b>Transitorio Cuarto DOF 1-may-2026</b>: tope semanal gradual: 9h (2026-27), 10h (2028), 11h (2029), 12h (2030).'))
story.append(bullet('<b>NOM-035-STPS-2018</b>: alertas automaticas por sobrecarga de horas extra, sin descanso semanal, o trabajo en dia de descanso.'))

story.append(h2('1.3 Arquitectura tecnica'))
story.append(p('El sistema usa Next.js 16 (App Router) con TypeScript estricto, Prisma ORM sobre '
               'PostgreSQL (Supabase), Tailwind CSS + shadcn/ui (estilo New York), Zustand para estado '
               'cliente, TanStack Query para datos servidor, NextAuth.js v4 con JWT HMAC-SHA512 (8h de sesion, '
               'rotacion cada 30 min), y MFA TOTP (otplib + AES-256-GCM). El deploy es en Vercel '
               '(region iad1 = US East). Opcionalmente un mini-service Socket.io en Railway/Render '
               'para notificaciones realtime (push al admin cuando hay check-in/out).'))
story.append(make_table(
    ['Componente', 'Tecnologia', 'Region / Notas'],
    [
        ['Frontend + API', 'Next.js 16 + TypeScript', 'Vercel iad1 (US East)'],
        ['Base de datos', 'PostgreSQL 17', 'Supabase aws-1-us-east-1'],
        ['Autenticacion', 'NextAuth v4 + JWT HMAC-SHA512', 'Cookie httpOnly, SameSite=strict, Secure'],
        ['MFA', 'TOTP (RFC 6238) + AES-256-GCM', 'otplib + 10 backup codes one-time use'],
        ['QR dinamico', 'HMAC-SHA256, expira 5 min', 'Render local (sin servicios externos)'],
        ['Realtime (opcional)', 'Socket.io', 'Railway/Render, no afecta funcionamiento'],
    ],
    col_widths=[3, 5, 5]
))

story.append(h2('1.4 Roles de usuario'))
story.append(p('El sistema maneja 4 roles con permisos jerarquicos. Los permisos se validan en el '
               'middleware (server-side) y en cada handler de API, ademas de en el sidebar (client-side).'))
story.append(make_table(
    ['Rol', 'Descripcion', 'Vistas principales accesibles'],
    [
        ['GENERAL_ADMIN', 'Administra toda la empresa, todas las sucursales, usuarios y configuracion.', 'Todas (13 vistas + Comparativa)'],
        ['SUCURSAL_ADMIN', 'Administra una sucursal especifica: sus empleados, asistencia, vacaciones.', '12 vistas (sin Usuarios y Roles, sin Comparativa)'],
        ['SUPERVISOR', 'Solo lectura: ve dashboard, historial, reportes, auditoria, NOM-035 de su sucursal.', '6 vistas (read-only)'],
        ['EMPLOYEE', 'Empleado individual: registra su asistencia, ve su historial y vacaciones.', 'App empleado (4 tabs: Asistencia, Historial, Vacaciones, Mi QR)'],
    ],
    col_widths=[2.5, 5, 5.5]
))
story.append(p('<b>Bloqueo de cuenta:</b> tras 5 intentos fallidos de login, la cuenta se bloquea '
               'automaticamente por 15 minutos. Un admin puede desbloquearla manualmente desde la '
               'vista "Usuarios y Roles".'))

story.append(h2('1.5 Como iniciar sesion'))
story.append(num_bullet(1, 'Abre la URL de produccion: <b>https://control-asistencia-v22.vercel.app</b>'))
story.append(num_bullet(2, 'En la pestana "Contrasena", ingresa email y password. Usa el toggle "Mostrar contrasena" si necesitas verificar.'))
story.append(num_bullet(3, 'Click en "Iniciar sesion". Si tienes MFA activado, se te pedira el codigo TOTP de 6 digitos (o un backup code).'))
story.append(num_bullet(4, 'Si eres admin, veras el panel de administracion. Si eres empleado, veras la app movil con 4 tabs.'))
story.append(num_bullet(5, 'Alternative: usa "Acceso rapido" (solo en kioscos confiables) seleccionando tu nombre de la lista.'))
story.append(Spacer(1, 6))
story.append(make_table(
    ['Rol', 'Email demo', 'Password'],
    [
        ['Admin General', 'admin@control.com', 'Admin#2025'],
        ['Admin Matriz', 'admin.matriz@control.com', 'Admin#2025'],
        ['Empleado', 'ana.lopez@control.com', 'Empleado#2025'],
    ],
    col_widths=[3, 5, 4]
))
story.append(note('En produccion real debes cambiar los passwords demo y eliminar los empleados seed. La cuenta demo actual solo incluye admin@control.com (la BD fue limpiada en julio 2026).'))

story.append(PageBreak())

# === CHAPTER 2: PANEL DE ADMINISTRACION ===
story.append(h1('2. Panel de administracion', 'Capitulo 2. Panel de administracion'))
story.append(p('El panel de administracion tiene un sidebar colapsable con 13 vistas (segun rol), '
               'un header con titulo de vista, nombre del usuario, sucursal (si aplica) y campana de '
               'notificaciones NOM-035, y un footer "Control de Asistencia v2.2". En movil el sidebar '
               'se reemplaza por un menu lateral deslizable. A continuacion se documenta cada vista.'))

# 2.1 Dashboard
story.append(h2('2.1 Dashboard'))
story.append(p('Vista principal al iniciar sesion. Muestra una fotografia del dia: cuantos empleados '
               'activos hay, porcentaje de asistencia, impuntualidad y horas extra acumuladas. Solo '
               'GENERAL_ADMIN ve el filtro de sucursal ("Todas las sucursales" + una por cada sucursal).'))
story.append(h3('KPIs principales (4 tarjetas)'))
story.append(kpi_grid([
    ('Empleados activos', '8', '#8c7226'),
    ('Asistencia hoy', '75%', '#43905d'),
    ('Impuntualidad', '12%', '#9f7f3e'),
    ('Horas extra', '4.5h', '#547495'),
]))
story.append(Spacer(1, 8))
story.append(h3('Tabla "Asistencia de hoy"'))
story.append(p('Lista todos los registros de asistencia del dia. Columnas: Empleado (nombre + numero), '
               'Sucursal (solo GA), Departamento, Entrada, Descanso (meal/rest inicio-fin), Salida, '
               'Estado (Presente/Retardo/Ausente/Salida anticipada), Metodo (QR/GPS/Manual/Biometrico), '
               'Ubicacion (Validada o Sin geo), Acciones.'))
story.append(p('<b>Correccion manual:</b> click en el icono lapiz por fila abre un dialog con inputs '
               'para Entrada (HH:mm), Salida (HH:mm) y Notas. La correccion se marca como pendiente '
               'de justificacion segun NOM-037 y se preserva el horario original (originalCheckInTime/OutTime). '
               'Solo roles con permiso <i>attendance:correct</i> (GA y SA).'))
story.append(h3('Resumen de breaks (4 tarjetas)'))
story.append(p('Comidas completadas, en curso, excedidos, y minutos totales (formato Xh Ymin).'))
story.append(h3('Ausentes hoy'))
story.append(p('Card lateral con la lista de empleados sin check-in en dia laboral. Cada item muestra '
               'nombre, numero y sucursal, con badge rose "Ausente".'))
story.append(h3('Grafica "Puntualidad por sucursal"'))
story.append(p('BarChart (recharts) con el porcentaje de puntualidad por sucursal (0-100%). Color emerald.'))

# 2.2 Empleados
story.append(h2('2.2 Empleados'))
story.append(p('Gestion del catologo de empleados: crear, editar, desactivar, ver QR, asignar horario '
               'y transferir entre sucursales. Disponible para GA y SA (SA solo ve empleados de su sucursal).'))
story.append(h3('Barra de filtros'))
story.append(bullet('Input "Buscar" (debounced 350ms) — busca por nombre, email o numero de empleado.'))
story.append(bullet('Select "Sucursal" (solo GA) — "Todas las sucursales" + una opcion por sucursal.'))
story.append(bullet('Select "Departamento" — opciones dinamicas basadas en los empleados cargados.'))
story.append(bullet('Boton "Nuevo empleado" (icono UserPlus) — abre el formulario de alta.'))
story.append(h3('Tabla de empleados'))
story.append(p('Columnas: Empleado (nombre + email + #numero), Sucursal (GA), Departamento, Puesto, '
               'Estado (Activo/Inactivo badge), Acciones. Acciones por fila:'))
story.append(make_table(
    ['Accion', 'Icono', 'Quien', 'Descripcion'],
    [
        ['Editar', 'Lapiz', 'GA, SA', 'Abre EmployeeFormDialog con datos del empleado.'],
        ['Ver QR', 'QrCode', 'GA, SA', 'Muestra el QR personal del empleado (EMP:numero:hmac). Descarga PNG.'],
        ['Horario', 'Reloj', 'GA, SA', 'Abre ScheduleDialog para ver/editar horario semanal.'],
        ['Transferir', 'ArrowRightLeft', 'GA solo', 'Mover empleado a otra sucursal.'],
        ['Desactivar/Activar', 'UserX/UserCheck', 'GA, SA', 'Cambia isActive. Desactivado no puede iniciar sesion.'],
    ],
    col_widths=[2, 2, 2, 7]
))
story.append(h3('Formulario de empleado (crear/editar)'))
story.append(p('Campos: Nombre *, Email *, Numero de empleado * (solo en crear), Puesto *, Departamento *, '
               'Sucursal * (SA bloqueado en la suya), Contrasena * + Confirmar contrasena * (solo crear, min 6 chars, '
               'toggle ojo para mostrar/ocultar, validacion de coincidencia en vivo).'))
story.append(h3('ScheduleEditor (horario semanal)'))
story.append(p('Editor de 7 dias (Domingo -> Sabado). Cada dia tiene 3 estados mediante control segmentado:'))
story.append(make_table(
    ['Estado', 'Color', 'Comportamiento'],
    [
        ['Trabaja', 'Verde', 'Muestra inputs Entrada (HH:mm), Salida (HH:mm), Tolerancia (min 0-60).'],
        ['Descanso', 'Ambar', 'Texto fijo "Dia de descanso semanal (art. 71 LFT)". Marca isWeeklyRest=true.'],
        ['No laborable', 'Zinc', 'Texto "No trabaja este dia". No se crea WorkSchedule.'],
    ],
    col_widths=[2.5, 2, 8]
))
story.append(p('<b>Validaciones:</b> el horario debe incluir al menos 1 dia de descanso (error: "Falta '
               'dia de descanso / art. 71 LFT"). Los dias "Trabaja" requieren startTime y endTime. '
               'Default al crear: Lun-Vie 9-18 con 10 min tolerancia, Domingo descanso, Sabado no laborable.'))

# 2.3 Sucursales
story.append(h2('2.3 Sucursales'))
story.append(p('Gestion de sucursales. GA ve todas y puede crear/eliminar. SA ve solo "Mi Sucursal" '
               'y puede editarla. Cada sucursal tiene configuracion de geofence, tolerancias y duraciones.'))
story.append(h3('Campos del formulario de sucursal'))
story.append(make_table(
    ['Campo', 'Default', 'Descripcion'],
    [
        ['Nombre *', '-', 'Nombre unico (ej. "Matriz").'],
        ['Codigo de local', '-', 'Ej. "261" — usado para reportes SAT/IMSS.'],
        ['Direccion', '-', 'Domicilio fiscal operativo.'],
        ['Latitud / Longitud', '-', 'Coordenadas para geofence (ej. 19.4326 / -99.1332).'],
        ['Radio geofence (m)', '150', 'Radio permitido para check-in GPS.'],
        ['Tol. salida (min)', '10', 'Se descuenta antes de calcular horas extra (art. 66).'],
        ['Duracion comida (min)', '30', 'Duracion esperada de comida.'],
        ['Tol. comida (min)', '5', 'Tolerancia: 30+5=35 min maximo antes de excedido.'],
        ['Duracion descanso (min)', '15', 'Duracion esperada de descanso corto.'],
        ['Tol. descanso (min)', '3', 'Tolerancia: 15+3=18 min maximo.'],
        ['Aplicar geofence', 'Off', 'Si On, rechaza check-in fuera del radio.'],
        ['Activa', 'On', 'Si Off, la sucursal no aparece en selectores.'],
    ],
    col_widths=[3.5, 2, 7]
))

# 2.4 Usuarios y Roles
story.append(h2('2.4 Usuarios y Roles'))
story.append(p('Gestion de cuentas de usuario (no empleados): crear/editar usuarios, asignar roles, '
               'resetear password, desbloquear cuentas. Solo GENERAL_ADMIN tiene acceso.'))
story.append(h3('Acciones por usuario'))
story.append(make_table(
    ['Accion', 'Descripcion'],
    [
        ['Editar', 'Cambia nombre, email, rol, sucursal, datos de empleado (si aplica).'],
        ['Resetear contrasena', 'Genera auto o manual. Si se deja vacia, se genera automaticamente, se desbloquea la cuenta y se muestra una vez para copiar.'],
        ['Desbloquear', 'Reinicia intentos fallidos y lockedUntil. Solo aparece cuando la cuenta esta bloqueada.'],
        ['Desactivar/Activar', 'Cambia isActive. Desactivado no puede iniciar sesion pero sus registros se conservan.'],
    ],
    col_widths=[3, 9]
))
story.append(h3('Formulario de usuario'))
story.append(p('Campos: Nombre *, Email *, Rol * (4 opciones: Administrador General, Admin de Sucursal, '
               'Supervisor, Empleado), Sucursal * (visible si rol es SA/SUPERVISOR/EMPLOYEE), Numero de '
               'empleado * + Puesto + Departamento (si rol=EMPLOYEE), Contrasena * (solo crear, min 6). '
               'No se puede cambiar el rol de un GENERAL_ADMIN existente (proteccion anti-lockout).'))

# 2.5 Vacaciones
story.append(h2('2.5 Vacaciones y Permisos'))
story.append(p('Gestion de vacaciones y permisos del personal. 3 tabs: Pendientes, Historial, Saldos. '
               'GA y SA pueden aprobar/rechazar solicitudes y otorgar permisos directamente.'))
story.append(h3('Tab Pendientes'))
story.append(p('Grid de Cards con solicitudes en estado PENDING. Cada card muestra: nombre, numero, '
               'sucursal, tipo (Vacaciones/Permiso/Incapacidad/Maternidad/Paternidad/Otro), periodo '
               '(fecha inicio -> fecha fin), dias, motivo. Botones "Aprobar" (emerald) y "Rechazar" (outline).'))
story.append(h3('Tab Historial'))
story.append(p('Filtros: Empleado (search), Tipo, Estado (PENDING/APPROVED/REJECTED/CANCELLED), Desde, '
               'Hasta. Tabla con: Empleado, Tipo, Periodo, Dias, Estado, Origen (Badge "Otorgado" si '
               'ADMIN_GRANTED, "Solicitud" si EMPLOYEE_REQUEST), Solicitado (fecha).'))
story.append(h3('Tab Saldos'))
story.append(p('Tabla con: Empleado (nombre + numero), Saldo (dias totales), Usados, Pendientes (badge '
               'ambar si >0), Disponibles (dias disponibles + % usado). Carga empleados activos + balance '
               'via /api/vacations/balance/{id} en paralelo.'))
story.append(h3('Otorgar permiso / vacaciones (dialog)'))
story.append(p('Crea y aprueba directamente una vacacion/permiso sin necesidad de solicitud previa del '
               'empleado. Campos: Empleado *, Tipo *, Switch "Permiso parcial (por horas)".'))
story.append(p('<b>Permiso parcial:</b> si esta activo, pide Fecha *, Hora de salida *, Hora de regreso '
               '(opcional). Las horas se calculan automaticamente. Los permisos parciales <b>NO descuentan</b> '
               'dias de vacaciones (art. 76 LFT aplica a dias completos).'))
story.append(p('<b>Vacaciones completas:</b> pide Fecha de inicio *, Fecha de fin *. Aviso dinamico: '
               '"Se descontaran N dia(s) del saldo de {nombre}". Textarea "Motivo / notas (opcional)".'))

# 2.6 Historial
story.append(h2('2.6 Historial'))
story.append(p('Consulta del historial de asistencia con filtros avanzados y export CSV. Disponible '
               'para GA, SA y SUPERVISOR (cada uno con su scope de sucursal).'))
story.append(h3('Filtros'))
story.append(bullet('Select "Periodo" — Dia / Semana / Mes (default: Semana).'))
story.append(bullet('Input "Fecha" (type=date, default: hoy).'))
story.append(bullet('Select "Sucursal" (solo GA).'))
story.append(bullet('Select "Estado" — Todos / Presente / Retardo / Salida anticipada / Ausente.'))
story.append(bullet('Input "Buscar empleado" — ademas dispara dropdown con empleados encontrados; click en uno abre su historial individual de 30 dias.'))
story.append(h3('Export CSV'))
story.append(p('Boton "CSV" (icono Download). Filename: <i>historial_{period}_{date}.csv</i>. Incluye BOM UTF-8 '
               'para compatibilidad con Excel. Columnas: Empleado, Numero, Sucursal, Fecha, Entrada, Salida, '
               'Comida, Descanso, Estado, Min. trabajados, Min. extra, <b>Horas Extra Dobles (min)</b>, '
               '<b>Horas Extra Triples (min)</b>, <b>Dia de Descanso Trabajado</b> (Si/No), <b>Prima 100% (min)</b>.'))
story.append(h3('Tabla principal'))
story.append(p('Columnas: Fecha, Empleado (nombre + #numero), Sucursal (GA), Entrada, Salida, Estado, '
               'Trabajado, Extra, Dobles (ambar), Triples (rose), Descanso (badge "Dom." o "Si" si '
               'isRestDayWorked con tooltip "Dia de descanso trabajado - prima 100% (art. 73 LFT) - Domingo").'))

# 2.7 Reportes
story.append(h2('2.7 Reportes'))
story.append(p('Generacion de 5 tipos de reportes con export CSV y XLSX. GA ve los 5; SA/SUPERVISOR '
               'ven 4 (sin Comparativa). Cada reporte tiene filtros (fecha o rango, sucursal, empleado) '
               'y botones "Generar", "CSV" y "XLSX".'))
story.append(h3('Tipos de reporte'))
story.append(make_table(
    ['Reporte', 'Filtros', 'KPIs principales', 'Export'],
    [
        ['Diario', 'Fecha, Sucursal', 'Total, Presentes, Retardos, Ausentes, HE Dobles (h), HE Triples (h), Descansos trab., Prima 100% (h)', 'CSV, XLSX (4 hojas)'],
        ['Horas Extra', 'Rango, Sucursal, Empleado', 'Empleados, Horas extra total, Promedio/emp, Registros, HE Dobles, HE Triples, Descansos trab., Prima 100% descanso', 'CSV, XLSX'],
        ['Ausencias', 'Rango, Sucursal', 'Empleados con faltas, Total faltas, Dias evaluados', 'CSV, XLSX'],
        ['Incidencias', 'Rango, Sucursal', 'Dias laborados, Retardos, Faltas, HE h, HE Dobles h, HE Triples h, Descansos trab., Prima 100% (h)', 'CSV, XLSX'],
        ['Comparativa (GA)', 'Rango', 'Sucursales, Empleados, % asist. promedio, HE total, HE Dobles, HE Triples, Descansos trab., Prima 100% (h)', 'CSV, XLSX'],
    ],
    col_widths=[2.5, 3, 6, 3]
))
story.append(h3('Export XLSX — estructura de 3-4 hojas'))
story.append(bullet('<b>Hoja "Portada"</b>: tipo de reporte, periodo, generado el/por, datos empresa (razonSocial, RFC, registroPatronal, domicilioFiscal, telefono, email, representanteLegal).'))
story.append(bullet('<b>Hoja "Datos"</b>: headers con fill azul #1F4E78 texto blanco bold, bordes, auto-width.'))
story.append(bullet('<b>Hoja "Resumen"</b>: totales agregados (si aplica).'))
story.append(bullet('<b>Hoja "Auditoria"</b> (solo daily): metodo/IP/lat/lng de entrada y salida por registro.'))

# 2.8 Alertas NOM-035
story.append(h2('2.8 Alertas NOM-035'))
story.append(p('Panel de factores de riesgo psicosocial conforme a NOM-035-STPS-2018. Muestra alertas '
               'automaticas generadas por el sistema en base a los registros de la semana. Disponible '
               'para GA, SA y SUPERVISOR.'))
story.append(h3('Resumen (4 tarjetas)'))
story.append(p('Total alertas, Altas (red), Medias (ambar), Bajas (zinc).'))
story.append(h3('Selector de semana'))
story.append(p('Select "Semana actual" / "Semana anterior". Subtitulo muestra el rango de fechas, '
               'numero de empleados revisados y el tope semanal aplicable (9h en 2027).'))
story.append(h3('5 tipos de alerta'))
story.append(make_table(
    ['Tipo', 'Label', 'Nivel', 'Cuando se dispara', 'Recomendacion'],
    [
        ['WEEKLY_OVERTIME_EXCEEDED', 'Tope semanal excedido', 'MEDIUM (>0-180 min) / HIGH (>180 min)', 'weeklyOvertimeMinutes > weeklyCap (9h en 2027)', 'Revisar carga laboral; redistribuir tareas.'],
        ['DAILY_OVERTIME_EXCEEDED', 'Tope diario excedido', 'HIGH', 'maxDailyOvertimeMinutes > 240 (4h, art. 66)', 'Autorizar explicitamente o ajustar jornada.'],
        ['CONSECUTIVE_LONG_DAYS', 'Sobrecarga sostenida', 'MEDIUM (>=3 dias) / HIGH (>=5 dias)', '3+ dias seguidos con horas extra', 'Descanso compensatorio; revisar planeacion.'],
        ['NO_WEEKLY_REST', 'Sin descanso semanal', 'HIGH', 'Empleado sin dia con isWeeklyRest=true en su horario', 'Configurar dia de descanso (art. 71 LFT).'],
        ['REST_DAY_WORKED', 'Dia de descanso trabajado', 'HIGH (domingo) / MEDIUM (otro)', 'Al menos un AttendanceRecord con isRestDayWorked=true en la semana', 'Pagar jornada completa con prima del 100% adicional. Si fue domingo, tambien aplica prima dominical (art. 71 LFT).'],
    ],
    col_widths=[3, 2.5, 2.5, 4, 4]
))
story.append(p('Cada alerta muestra: badge level, titulo (ej. "Exceso de horas extra semanales (Juan Perez)"), '
               'descripcion detallada, recomendacion, referencia legal (ej. "LFT art. 66/68 + Transitorio '
               'Cuarto DOF 1-may-2026; NOM-035-STPS-2018 A.5"), sucursal y numero de empleado. Orden: HIGH -> MEDIUM -> LOW.'))

# 2.9 Auditoria
story.append(h2('2.9 Auditoria'))
story.append(p('Registro completo de todas las acciones del sistema (AuditLog). Disponible para GA, '
               'SA y SUPERVISOR (con scope de sucursal). Paginacion de 50 registros por pagina.'))
story.append(h3('Filtros'))
story.append(bullet('Select "Accion" — todas las acciones categorizadas (ver lista abajo).'))
story.append(bullet('Input "Usuario" (por ID).'))
story.append(bullet('Inputs "Desde" y "Hasta" (rango de fechas).'))
story.append(bullet('Select "Sucursal" (solo GA).'))
story.append(h3('Acciones registradas (35 categorizadas)'))
story.append(make_table(
    ['Categoria', 'Acciones'],
    [
        ['Sesion', 'LOGIN, LOGOUT, LOGIN_FAILED, QR_LOGIN, QUICK_LOGIN'],
        ['Empleados', 'CREATE_EMPLOYEE, UPDATE_EMPLOYEE, DEACTIVATE_EMPLOYEE, TRANSFER'],
        ['Sucursales', 'CREATE_SUCURSAL, UPDATE_SUCURSAL, DELETE_SUCURSAL'],
        ['Usuarios', 'CREATE_USER, UPDATE_USER, PASSWORD_RESET, ACCOUNT_UNLOCK'],
        ['Asistencia', 'CHECK_IN, CHECK_OUT, MEAL_START, MEAL_END, MEAL_CANCEL, REST_START, REST_END, REST_CANCEL, MANUAL_CORRECTION, ATTENDANCE_SIGN, JUSTIFICATION_SUBMIT'],
        ['Vacaciones', 'VACATION_REQUEST, VACATION_GRANT, VACATION_APPROVE, VACATION_REJECT, VACATION_CANCEL'],
        ['Empresa', 'CREATE_COMPANY, UPDATE_COMPANY, COMPANY_LOGO_UPLOAD, HOLIDAY_CREATE, HOLIDAY_DELETE'],
        ['QR', 'QR_DYNAMIC_GENERATE'],
        ['MFA', 'MFA_SETUP_INITIATED, MFA_ENABLED, MFA_DISABLED'],
        ['Reportes', 'EXPORT_REPORT, EMPLOYEE_EXPORT'],
        ['NOM-035', 'NOM035_ALERT_WEEKLY_OVERTIME, NOM035_ALERT_REST_DAY_WORKED'],
    ],
    col_widths=[2.5, 10]
))
story.append(p('Cada registro de auditoria incluye: fecha/hora, accion, usuario (nombre + email), IP, '
               'tipo de entidad, ID de entidad, user agent y detalles (JSON pretty-printed).'))

# 2.10 Terminal QR
story.append(h2('2.10 Terminal QR'))
story.append(p('Generador de QR dinamico para login kiosco. El admin genera un QR que expira en 5 '
               'minutos; el empleado lo escanea con la app movil (tab "Mi QR" -> escanear) y queda '
               'autenticado en el kiosco. Disponible para GA y SA.'))
story.append(h3('Modo normal'))
story.append(p('Muestra QR 300x300 con borde gris, token truncado (primeros 60 chars), botones '
               '"Generar nuevo" y "Descargar PNG", aviso verde: "El QR se genera localmente en tu '
               'navegador. El token nunca se envia a servicios externos."'))
story.append(h3('Modo kiosco (fullscreen)'))
story.append(p('Boton "Modo kiosco" (icono Maximize2). Pantalla completa z-100 con QR gigante 400x400, '
               'countdown grande (mono font 3xl: "MM:SS restantes"), botones "Generar nuevo codigo" '
               'y salir (Minimize2). Auto-refresh al expirar (5 min).'))

# 2.11 Empresa y Feriados
story.append(h2('2.11 Empresa y Feriados'))
story.append(p('Configuracion de datos de la empresa (singleton) y gestion de dias feriados. Solo GA.'))
story.append(h3('Datos de la empresa'))
story.append(p('Campos: Razon Social, RFC (auto-uppercase), Registro Patronal, Representante Legal, '
               'Domicilio Fiscal, Telefono, Email. Estos datos aparecen en la portada de los reportes XLSX.'))
story.append(h3('Dias feriados oficiales'))
story.append(p('Botones "Cargar oficiales 2027" (Sparkles) y "Agregar feriado" (Plus). Tabla con: '
               'Fecha, Nombre, Descripcion, Oficial (badge), Acciones (boton rojo eliminar).'))
story.append(p('Los 7 feriados oficiales 2027 (art. 74 LFT) pre-cargables:'))
story.append(make_table(
    ['Fecha', 'Nombre', 'Fraccion art. 74'],
    [
        ['2027-01-01', 'Ano Nuevo', 'I'],
        ['2027-02-01', 'Dia de la Constitucion (primer lunes de febrero)', 'II'],
        ['2027-03-15', 'Natalicio de Benito Juarez (tercer lunes de marzo)', 'III'],
        ['2027-05-01', 'Dia del Trabajo', 'IV'],
        ['2027-09-16', 'Dia de la Independencia', 'V'],
        ['2027-11-15', 'Dia de la Revolucion (tercer lunes de noviembre)', 'VI'],
        ['2027-12-25', 'Navidad', 'VII'],
    ],
    col_widths=[2.5, 7, 3]
))

# 2.12 Documentacion
story.append(h2('2.12 Documentacion'))
story.append(p('Acceso a documentos y diagramas del proyecto. Disponible para GA, SA y SUPERVISOR.'))
story.append(bullet('Documento de Cumplimiento Legal - Reforma LFT 2027 (PDF).'))
story.append(bullet('Recomendacion de Infraestructura (HTML + PDF).'))
story.append(bullet('Diagrama: Arquitectura del Sistema (Rev. 2).'))
story.append(bullet('Diagrama: Flujo de Procesos (7 fases / 34 pasos).'))
story.append(bullet('Diagrama: Activacion de MFA TOTP (5 fases con screenshots).'))
story.append(bullet('Diagrama: Uso del Codigo QR (guia para empleados).'))
story.append(bullet('Diagrama: Puesta en Marcha (6 fases / 19 pasos).'))
story.append(p('Cada documento disponible en 3 formatos: HTML (vista rapida), PNG (imagen), PDF (imprimir).'))

# 2.13 Configuracion
story.append(h2('2.13 Configuracion'))
story.append(p('Configuracion de MFA TOTP y preferencias de cuenta. Disponible para GA y SA.'))
story.append(h3('MFA TOTP (autenticacion de dos factores)'))
story.append(p('Anade una capa extra de seguridad. Necesitaras un codigo de tu app autenticadora '
               '(Google Authenticator, Authy, 1Password) cada vez que inicies sesion.'))
story.append(p('<b>Activacion (3 pasos):</b>'))
story.append(num_bullet(1, '<b>Escanea el QR</b>: abre tu app autenticadora, escanea el QR de 240x240. Si no puedes escanear, ingresa el codigo secreto manualmente (botones copiar). Click "Ya lo escaneé, continuar".'))
story.append(num_bullet(2, '<b>Verifica el codigo</b>: ingresa los 6 digitos de tu app en el InputOTP. Click "Verificar y activar".'))
story.append(num_bullet(3, '<b>Backup codes</b>: se muestran 10 codigos en grid 2 columnas. Descargalos (boton "Descargar codigos" -> codigos-respaldo-mfa.txt). Cada codigo es one-time use, formato XXXX-XXXX-XXXX-XXXX. Click "He guardado los codigos, finalizar".'))
story.append(p('<b>Desactivar MFA:</b> pide verificar con codigo TOTP o un backup code. Si usas backup code, se elimina de la lista (one-time use).'))

story.append(PageBreak())

# === CHAPTER 3: APP DE EMPLEADO ===
story.append(h1('3. App de empleado', 'Capitulo 3. App de empleado'))
story.append(p('La app de empleado es mobile-first con 4 tabs en bottom nav: Asistencia, Historial, '
               'Vacaciones, Mi QR. Paleta zinc/emerald/ambar/rose. Header con saludo dinamico (Buenos '
               'dias / Buenas tardes / Buenas noches segun hora), nombre y dropdown de usuario.'))

# 3.1 Asistencia
story.append(h2('3.1 Asistencia'))
story.append(p('Tab principal. Muestra la hora actual (mono font 4xl, actualizada cada segundo), '
               'card con datos de la sucursal, card de estado principal que cambia de color segun '
               'el estado del dia.'))
story.append(h3('Estados del card principal'))
story.append(make_table(
    ['Estado', 'Color', 'Icono', 'Mensaje'],
    [
        ['No checado entrada', 'Zinc', 'LogIn', 'No has checado entrada'],
        ['En descanso', 'Ambar', 'Coffee', 'En descanso'],
        ['Jornada finalizada', 'Emerald', 'CheckCircle2', 'Jornada finalizada'],
        ['En jornada', 'Emerald', 'Clock', 'En jornada'],
    ],
    col_widths=[3, 2, 2, 5]
))
story.append(h3('BreakCountdown (countdown de descanso)'))
story.append(p('Solo visible si hay comida/descanso en curso. Countdown MM:SS en mono 3xl con colores:'))
story.append(bullet('<b>Verde (0-25 min)</b>: "Quedan X min Y seg de los 30 min permitidos".'))
story.append(bullet('<b>Ambar (25-30 min)</b>: "Acerca el limite".'))
story.append(bullet('<b>Rose (>30 min)</b>: "Tiempo excedido por X min. Termine su descanso."'))
story.append(h3('Toggle GPS / QR'))
story.append(p('Dos pestañas para elegir el metodo de check-in:'))
story.append(bullet('<b>GPS</b>: muestra estado de ubicacion (Esperando / Obteniendo / Lista con lat-lng / Error con boton reintentar).'))
story.append(bullet('<b>QR</b>: selector "Accion a ejecutar al escanear" (Registrar Entrada / Iniciar Descanso / Terminar Descanso / Registrar Salida). Sub-tabs "Escanear QR" (camara) o "Manual" (pegar codigo NOM037:...).'))
story.append(h3('Botones de accion (segun estado)'))
story.append(p('<b>Si no hay check-in:</b> boton "Registrar Entrada" (icono LogIn, h-12).'))
story.append(p('<b>Si checked-in y no checked-out:</b> boton "Iniciar Descanso" / "Terminar Descanso" '
               '(ambar si en curso, outline si no). Si descanso completado: texto "Descanso completado - N min" '
               '(+ "Excedido" en rose si aplica). Boton "Registrar Fin de Jornada" (destructive rose, icono LogOut).'))
story.append(p('<b>Si checked-out:</b> texto emerald "Jornada cerrada correctamente."'))
story.append(h3('Resumen de hoy'))
story.append(p('Grid 2x3: Entrada, Salida, Descanso inicio, Descanso fin, Horas trabajadas, Horas '
               'extra (con desglose "Dobles Xmin / Triples Xmin" si aplica). Badge ambar "Descanso '
               'trabajado - prima 100%" si isRestDayWorked.'))

# 3.2 Historial
story.append(h2('3.2 Historial'))
story.append(p('Consulta del propio historial de asistencia. Filtros: Select "Periodo" (Dia/Semana/Mes), '
               'Input "Fecha", boton "Refrescar". Tabla con: Fecha, Entrada, Descanso Inicio, Descanso '
               'Fin (con icono de warning si excedido), Salida, Estado, Hrs. Trabajadas, Hrs. Extra '
               '(con sub "D: Xmin - T: Xmin" si aplica), Descanso (badge ambar "Dom."/"Si" con tooltip '
               'prima 100%), Notas. Boton "CSV" para export personal.'))

# 3.3 Vacaciones
story.append(h2('3.3 Vacaciones'))
story.append(p('Gestion de vacaciones del propio empleado. Header "Mis Vacaciones y Permisos" + boton '
               '"Nueva solicitud" (Plus).'))
story.append(h3('Card "Mi saldo" (4 tarjetas)'))
story.append(kpi_grid([
    ('Dias totales', '12', '#8c7226'),
    ('Dias usados', '3', '#43905d'),
    ('Dias pendientes', '1', '#9f7f3e'),
    ('Dias disponibles', '8', '#43905d'),
]))
story.append(Spacer(1, 8))
story.append(h3('Mis solicitudes'))
story.append(p('Tabla con: Fecha solicitud, Tipo (badge), Inicio, Fin, Dias, Estado (PENDING/APPROVED/'
               'REJECTED/CANCELLED). Boton "Cancelar" (rose) solo si PENDING. Si REJECTED muestra motivo truncado.'))
story.append(h3('Nueva solicitud (dialog)'))
story.append(p('Select "Tipo" (6 opciones), Inputs "Fecha inicio" + "Fecha fin" (fin tiene min={formStart}), '
               'Textarea "Motivo (opcional)", texto dinamico "Dias naturales solicitados: N". Boton "Enviar solicitud".'))

# 3.4 Mi QR
story.append(h2('3.4 Mi QR'))
story.append(p('Muestra el codigo QR personal del empleado (formato EMP:numero:hmac). Header "Mi Codigo QR". '
               'Card con texto "Presenta este codigo QR al administrador o terminal de asistencia para '
               'registrar tu entrada o salida." Imagen QR 224x224 (PNG data URL), nombre + #numero, '
               'boton "Descargar PNG" (filename qr_{nombre}.png).'))
story.append(p('Card advertencia: "Mostrar para check-in por admin - Si el administrador necesita '
               'registrar tu entrada o salida desde el panel, muestra este codigo QR para que lo escanee."'))

story.append(PageBreak())

# === CHAPTER 4: CALCULOS LABORALES ===
story.append(h1('4. Calculos laborales (Reforma LFT 2027)', 'Capitulo 4. Calculos laborales'))
story.append(p('Este capitulo documenta como el sistema calcula automaticamente horas extra, primas y '
               'estados de asistencia. Todos los calculos se persisten en el AttendanceRecord al momento '
               'del check-out, por lo que los reportes leen los valores pre-calculados (no recalculan).'))

story.append(h2('4.1 Horas extra dobles (art. 66 LFT)'))
story.append(p('Las primeras horas extra de la semana, hasta el tope semanal aplicable, se pagan al '
               '<b>doble</b>. El tope semanal es gradual segun el ano:'))
story.append(make_table(
    ['Periodo', 'Tope semanal (doble)', 'Base legal'],
    [
        ['2026-2027', '9 horas (540 min)', 'Transitorio Cuarto DOF 1-may-2026'],
        ['2028', '10 horas (600 min)', 'Escalado gradual'],
        ['2029', '11 horas (660 min)', 'Escalado gradual'],
        ['2030 en adelante', '12 horas (720 min)', 'Tope final'],
    ],
    col_widths=[3, 4, 6]
))
story.append(p('Ademas, el tope <b>diario</b> es de 4 horas extra (art. 66). Cualquier excedente sobre '
               '4h en un mismo dia no se cuenta como extra autorizada ese dia.'))

story.append(h2('4.2 Horas extra triples (art. 68 LFT)'))
story.append(p('El excedente del tope semanal se paga al <b>triple</b>. La distribucion se calcula '
               'considerando el acumulado semanal previo (lunes hasta el dia anterior al registro actual):'))
story.append(code(
    'overtimeDaily = min(overtimeMinutes, 240)               // art. 66 tope diario\n'
    'cabeEnDoble  = max(0, weeklyCap - weeklyAccumulated)    // lo que cabe en el tope semanal\n'
    'overtimeDoubleMinutes = min(overtimeDaily, cabeEnDoble) // art. 66 — DOBLE\n'
    'overtimeTripleMinutes = max(0, overtimeDaily - overtimeDoubleMinutes) // art. 68 — TRIPLE'
))

story.append(h2('4.3 Prima por descanso trabajado (art. 73 LFT)'))
story.append(p('Si un empleado trabaja en su dia de descanso semanal configurado (isWeeklyRest=true), '
               'la jornada completa se paga con prima del <b>100% adicional</b> (es decir, 200% del '
               'salario ordinario). En este caso NO se calcula overtime (art. 66/68 no aplican).'))
story.append(make_table(
    ['Campo', 'Calculo', 'Persistido en'],
    [
        ['isRestDayWorked', 'true si la fecha es dia de descanso del empleado y hay check-in', 'AttendanceRecord.isRestDayWorked'],
        ['restDayWorkedMinutes', '= netWorkedMinutes (jornada neta)', 'AttendanceRecord.restDayWorkedMinutes'],
        ['restDayPremiumMinutes', '= netWorkedMinutes (igual cantidad adicional = 200% salario)', 'AttendanceRecord.restDayPremiumMinutes'],
        ['isSunday', 'true si dow === 0 (para prima dominical art. 71)', 'AttendanceRecord.isSunday'],
    ],
    col_widths=[3, 6, 4]
))

story.append(h2('4.4 Tolerancia de check-out'))
story.append(p('Antes de calcular overtime, se descuenta la tolerancia de salida configurada en la '
               'sucursal (checkoutToleranceMinutes, default 10 min):'))
story.append(code('overtimeMinutes = max(0, workedMinutes - scheduledMinutes - sucursal.checkoutToleranceMinutes)'))

story.append(h2('4.5 Estados de un AttendanceRecord'))
story.append(make_table(
    ['Estado', 'Color UI', 'Cuando aplica'],
    [
        ['PRESENT', 'Emerald', 'Check-in a tiempo + sin early leave.'],
        ['LATE', 'Ambar', 'checkInTime > scheduled startTime + toleranceMinutes.'],
        ['EARLY_LEAVE', 'Zinc', 'checkOutTime < scheduled endTime - toleranceMinutes (solo si no LATE).'],
        ['ABSENT', 'Rose', 'Sin registro en dia laboral (calculado por isAbsentOnDate, no seteado en el record).'],
    ],
    col_widths=[3, 2, 8]
))
story.append(p('<b>Prioridad:</b> si LATE && EARLY_LEAVE -> status = LATE. En correccion manual, '
               'LATE se preserva si ya estaba.'))

story.append(h2('4.6 Determinacion de dia laboral vs descanso'))
story.append(p('La determinacion se basa <b>exclusivamente</b> en el WorkSchedule del empleado. No se '
               'asume que domingo es descanso. Si el horario indica que domingo es dia laboral, el '
               'empleado puede trabajar domingo sin prima de descanso.'))
story.append(code(
    "esDiaLaboral = schedules.some(s => s.dayOfWeek === dow && !s.isWeeklyRest)\n"
    "esDescanso   = schedules.some(s => s.dayOfWeek === dow && s.isWeeklyRest)\n"
    "sinSchedule  = !schedules.some(s => s.dayOfWeek === dow)"
))

story.append(h2('4.7 Calculo de ausencias'))
story.append(p('Orden de evaluacion en isAbsentOnDate:'))
story.append(num_bullet(1, 'Empleado inactivo -> no ausente (reason: inactive).'))
story.append(num_bullet(2, 'Feriado oficial (Holiday) -> no ausente (reason: holiday).'))
story.append(num_bullet(3, 'Vacaciones aprobadas que cubren la fecha -> no ausente (reason: vacation).'))
story.append(num_bullet(4, 'No es dia laboral (sin schedule con !isWeeklyRest) -> no ausente (reason: rest_day o no_schedule).'))
story.append(num_bullet(5, 'Es dia laboral pero no hay record (o record.status=ABSENT) -> AUSENTE (reason: absent).'))
story.append(num_bullet(6, 'Caso default -> presente.'))

story.append(h2('4.8 Ejemplo numererico completo'))
story.append(p('Empleado con horario L-V 9-18 (9h programadas, tolerancia 10 min), sucursal con '
               'checkoutTolerance=10. Semana ya con 7h extra acumuladas (todas en doble). El viernes '
               'trabaja 9-21 (12h brutas, 11.5h netas tras 30 min comida).'))
story.append(make_table(
    ['Concepto', 'Calculo', 'Resultado'],
    [
        ['workedMinutes', '12h - 30min comida = 11.5h = 690 min', '690 min'],
        ['scheduledMinutes', '9h = 540 min', '540 min'],
        ['overtimeMinutes', 'max(0, 690 - 540 - 10) = 140 min', '140 min'],
        ['overtimeDaily', 'min(140, 240) = 140 min', '140 min'],
        ['weeklyCap (2027)', '9h = 540 min', '540 min'],
        ['weeklyAccumulated', '7h = 420 min', '420 min'],
        ['cabeEnDoble', 'max(0, 540 - 420) = 120 min', '120 min'],
        ['overtimeDoubleMinutes', 'min(140, 120) = 120 min', '120 min (art. 66)'],
        ['overtimeTripleMinutes', 'max(0, 140 - 120) = 20 min', '20 min (art. 68)'],
        ['overtimeWeeklyTotal', '420 + 140 = 560 min (9h 20m)', 'Excede tope (540)'],
    ],
    col_widths=[4, 6, 4]
))
story.append(note('En este ejemplo se generan 2 alertas NOM-035 automaticas: WEEKLY_OVERTIME_EXCEEDED '
                  '(level HIGH porque el exceso > 180 min) y ninguna alerta de descanso (es dia laboral).'))

story.append(PageBreak())

# === CHAPTER 5: SISTEMA MFA ===
story.append(h1('5. Sistema MFA', 'Capitulo 5. Sistema MFA'))
story.append(p('La autenticacion de dos factores (MFA) anade una capa extra de seguridad. Ademas de la '
               'contrasena, necesitas un codigo de 6 digitos que cambia cada 30 segundos, generado por '
               'una app autenticadora en tu telefono. Solo disponible para administradores (no EMPLOYEE).'))

story.append(h2('5.1 Que es MFA TOTP y por que usarlo'))
story.append(p('TOTP (Time-based One-Time Password, RFC 6238) es un estandar que genera codigos de 6 '
               'digitos que cambian cada 30 segundos. La ventaja sobre SMS es que no requiere cobertura '
               'celular, es mas seguro (no es interceptable) y funciona offline. El sistema usa otplib '
               'y el secreto se guarda encriptado con AES-256-GCM (clave derivada de NEXTAUTH_SECRET con SHA-256).'))
story.append(p('Si un atacante roba tu password, no podra iniciar sesion sin tu telefono. Es obligatorio '
               'para GENERAL_ADMIN en produccion.'))

story.append(h2('5.2 Como activarlo (3 pasos)'))
story.append(num_bullet(1, '<b>Escanea el QR</b>: ve a Configuracion -> "Activar MFA". Abre tu app autenticadora (Google Authenticator, Authy, 1Password, Microsoft Authenticator). Anade nueva cuenta, escanea el QR de 240x240. Si no puedes escanear, ingresa el codigo secreto manualmente (boton copiar). Click "Ya lo escanee, continuar".'))
story.append(num_bullet(2, '<b>Verifica el codigo</b>: ingresa los 6 digitos actuales de tu app en el InputOTP de 6 slots. Click "Verificar y activar". Si el codigo es invalido, verifica la hora de tu telefono (los codigos TOTP dependen del reloj).'))
story.append(num_bullet(3, '<b>Backup codes</b>: se muestran 10 codigos de respaldo en grid 2 columnas, formato XXXX-XXXX-XXXX-XXXX. Descargalos (boton "Descargar codigos" -> archivo codigos-respaldo-mfa.txt). Guardalos en un lugar seguro (no en el correo). Click "He guardado los codigos, finalizar".'))

story.append(h2('5.3 Apps autenticadoras compatibles'))
story.append(make_table(
    ['App', 'Plataforma', 'Gratuito'],
    [
        ['Google Authenticator', 'iOS, Android', 'Si'],
        ['Microsoft Authenticator', 'iOS, Android, Windows', 'Si'],
        ['Authy', 'iOS, Android, Desktop', 'Si'],
        ['1Password', 'iOS, Android, Desktop', 'De pago'],
        ['Bitwarden Authenticator', 'iOS, Android, Desktop', 'Si'],
        ['FreeOTP+', 'iOS, Android', 'Si (open source)'],
    ],
    col_widths=[4, 5, 3]
))

story.append(h2('5.4 Como usar backup codes'))
story.append(p('Los 10 backup codes son one-time use. Sirven para iniciar sesion si pierdes o cambias '
               'tu telefono. Cada codigo se invalida al usarse una vez. Formato: XXXX-XXXX-XXXX-XXXX '
               '(uppercase hex).'))
story.append(bullet('Cuando ingresas un backup code en el login, el sistema lo compara (bcrypt) y lo elimina del array.'))
story.append(bullet('Si agotas los 10 codigos, debes desactivar y reactivar MFA para generar nuevos.'))
story.append(bullet('Si pierdes el telefono Y los backup codes, contacta a otro GENERAL_ADMIN para resetear tu MFA desde "Usuarios y Roles".'))

story.append(h2('5.5 Como desactivar MFA'))
story.append(p('Ve a Configuracion -> "Desactivar MFA". Se pedira verificar con codigo TOTP (6 digitos) '
               'o un backup code. Toggle entre "Usar codigo de respaldo en su lugar" / "Usar codigo de '
               'la app autenticadora". Click "Desactivar MFA" (destructive).'))

story.append(h2('5.6 Login con MFA habilitado'))
story.append(num_bullet(1, 'Ingresa email y password. Click "Iniciar sesion".'))
story.append(num_bullet(2, 'Si las credenciales son validas y tienes MFA, el sistema responde { needsMfa: true } sin completar el login.'))
story.append(num_bullet(3, 'Se muestra pantalla pidiendo codigo TOTP (o backup code alternativo).'))
story.append(num_bullet(4, 'Ingresa los 6 digitos. Si es valido, se completa el login (cookie JWT 8h).'))
story.append(num_bullet(5, 'Si es invalido, se devuelve 401 sin incrementar failedLoginAttempts (solo la password fallida cuenta para el bloqueo).'))

story.append(PageBreak())

# === CHAPTER 6: SISTEMA DE QR ===
story.append(h1('6. Sistema de QR', 'Capitulo 6. Sistema de QR'))
story.append(p('El sistema maneja 2 tipos de QR con propositos distintos: el QR <b>dinamico del terminal</b> '
               '(para login kiosco, expira 5 min, one-time use) y el QR <b>personal del empleado</b> '
               '(permanente, para check-in via admin). Ambos se firman con HMAC-SHA256 usando QR_HMAC_SECRET.'))

story.append(h2('6.1 QR dinamico del terminal'))
story.append(p('Generado por un admin desde "Terminal QR". Se muestra en pantalla grande (modo kiosco) '
               'y el empleado lo escanea con la app movil para autenticarse en ese dispositivo.'))
story.append(h3('Formato del token'))
story.append(code('NOM037:<randomHex16>:<epochSeconds>:<hmac>'))
story.append(bullet('<b>randomHex</b>: 32 caracteres hex (crypto.randomBytes(16)).'))
story.append(bullet('<b>epochSeconds</b>: timestamp Unix en segundos.'))
story.append(bullet('<b>hmac</b>: HMAC-SHA256(QR_HMAC_SECRET, "randomHex:epoch") en hex.'))
story.append(h3('Caracteristicas de seguridad'))
story.append(bullet('Expira en 5 minutos (EXPIRY_SECONDS = 300).'))
story.append(bullet('One-time use: al validar, se marca used=true en DB (anti-replay).'))
story.append(bullet('Si se usa un codigo ya usado -> 401 "ya fue utilizado".'))
story.append(bullet('Si expira -> 401 "ha expirado".'))
story.append(bullet('Si la firma HMAC no coincide -> 401 "Firma invalida".'))
story.append(bullet('El QR se renderiza localmente en el navegador (libreria qrcode). El token nunca se envia a servicios externos como api.qrserver.com.'))

story.append(h2('6.2 QR personal del empleado'))
story.append(p('Codigo permanente del empleado, visible en su app (tab "Mi QR"). Lo muestra al admin '
               'o a la terminal para que este lo escanee y registre entrada/salida en su nombre.'))
story.append(h3('Formato del token'))
story.append(code('EMP:<employeeNumber>:<hmac>'))
story.append(bullet('<b>employeeNumber</b>: numero de empleado (ej. EMP-001).'))
story.append(bullet('<b>hmac</b>: HMAC-SHA256(QR_HMAC_SECRET, "EMP:{employeeNumber}") en hex.'))
story.append(h3('Generacion y descarga'))
story.append(p('Endpoint: GET /api/employees/{id}/qr. Permisos: EMPLOYEE solo su propio id, SA solo '
               'empleados de su sucursal, GA cualquiera. Retorna { qrDataUrl, qrToken, employeeNumber, name }. '
               'El PNG es 320x320 con errorCorrectionLevel M y margin 2.'))

story.append(h2('6.3 Login kiosco (qr-login)'))
story.append(p('Endpoint publico POST /api/auth/qr-login con body { code }. Flujo:'))
story.append(num_bullet(1, 'validateQRToken(code) — verifica HMAC y expiracion de 5 min.'))
story.append(num_bullet(2, 'Lookup DynamicQR por code en DB.'))
story.append(num_bullet(3, 'Verifica !used (si used -> 401).'))
story.append(num_bullet(4, 'Verifica expiresAt > now (si no -> 401).'))
story.append(num_bullet(5, 'Marca used = true (one-time use, anti-replay).'))
story.append(num_bullet(6, 'Resuelve createdById -> usuario. Verifica isActive.'))
story.append(num_bullet(7, 'Construye payload sesion, emite cookies JWT (8h).'))
story.append(num_bullet(8, 'AuditLog QR_LOGIN con { method: qr, qrId }.'))
story.append(num_bullet(9, 'Retorna { user: payload }.'))

story.append(h2('6.4 Quick-login kiosco'))
story.append(p('Endpoint publico POST /api/auth/quick-login con body { userId }. Disenado para botones '
               'de acceso rapido en un dispositivo confiable (kiosco). Lookup user por id, verifica '
               'isActive, construye payload con mfaVerified=false (el kiosco confia en el dispositivo). '
               'Emite cookies JWT. AuditLog QUICK_LOGIN.'))

story.append(h2('6.5 Seguridad del sistema QR'))
story.append(make_table(
    ['Propiedad', 'Implementacion'],
    [
        ['Firma criptografica', 'HMAC-SHA256 con QR_HMAC_SECRET (secreto separado de NEXTAUTH_SECRET)'],
        ['Anti-replay', 'DynamicQR.used = true al validar (one-time use)'],
        ['Expiracion', '5 min (EXPIRY_SECONDS = 300)'],
        ['Render local', 'Libreria qrcode en navegador, sin servicios externos'],
        ['Validacion servidor', 'Recalcula HMAC y compara; verifica expiracion; verifica used'],
        ['AuditLog', 'QR_DYNAMIC_GENERATE al crear; QR_LOGIN al usar'],
    ],
    col_widths=[3, 9]
))

story.append(PageBreak())

# === CHAPTER 7: AUDITORIA Y CUMPLIMIENTO ===
story.append(h1('7. Auditoria y cumplimiento', 'Capitulo 7. Auditoria y cumplimiento'))
story.append(p('El sistema mantiene un registro inmutable de todas las acciones relevantes para '
               'cumplimiento legal. Esto permite reconstruir cualquier evento ante una auditoria '
               'de la STPS o un conflicto laboral.'))

story.append(h2('7.1 Registro de auditoria'))
story.append(p('Cada accion relevante genera un AuditLog con:'))
story.append(bullet('userId (quien realizo la accion).'))
story.append(bullet('action (tipo de accion, ver lista en Capitulo 2.9).'))
story.append(bullet('entityType y entityId (sobre que entidad actuo).'))
story.append(bullet('sucursalId (en que sucursal, si aplica).'))
story.append(bullet('ipAddress (IP del cliente).'))
story.append(bullet('userAgent (browser/SO del cliente).'))
story.append(bullet('details (JSON string con detalles especificos de la accion).'))
story.append(bullet('createdAt (timestamp automatico).'))

story.append(h2('7.2 Inmutabilidad de registros de asistencia'))
story.append(p('Los AttendanceRecord se crean con isLocked=true por defecto. Esto significa que no se '
               'pueden modificar directamente. Para corregir un registro:'))
story.append(num_bullet(1, 'El admin abre el dialog "Correccion manual" desde el Dashboard o Historial.'))
story.append(num_bullet(2, 'Si isLocked=true, se debe marcar "forceUnlock" y proporcionar un "correctionReason" obligatorio.'))
story.append(num_bullet(3, 'El sistema preserva los campos originalCheckInTime y originalCheckOutTime (solo la primera vez).'))
story.append(num_bullet(4, 'Se actualizan checkInTime/checkOutTime, method=MANUAL, ip/ua, se recalcula workedMinutes/overtime.'))
story.append(num_bullet(5, 'Se marca justificationStatus=PENDING para que el empleado lo justifique o firme.'))
story.append(num_bullet(6, 'Se registra AuditLog MANUAL_CORRECTION con before/after completo.'))
story.append(num_bullet(7, 'Se setea correctedById y correctedAt.'))

story.append(h2('7.3 Firma de registros por el empleado (art. 132 XXXIV LFT)'))
story.append(p('La Reforma LFT 2027 exige que los registros de asistencia sean "prueba plena" cuando '
               'estan firmados por el empleado. El sistema implementa esto con HMAC-SHA256:'))
story.append(h3('Endpoint POST /api/attendance/sign'))
story.append(p('Body: { startDate, endDate, signaturePin }. Validaciones:'))
story.append(bullet('user.employeeId requerido (solo empleados firman).'))
story.append(bullet('signaturePin minimo 4 caracteres (definido por el empleado).'))
story.append(bullet('Rango maximo: 92 dias (trimestre).'))
story.append(bullet('startDate <= endDate.'))
story.append(h3('Proceso de firma'))
story.append(num_bullet(1, 'Carga registros del periodo que tengan checkOutTime y employeeSignedAt=null.'))
story.append(num_bullet(2, 'Construye contenido canonico: "date|checkInISO|checkOutISO|workedMinutes|overtimeMinutes" por cada registro, separados por salto de linea.'))
story.append(num_bullet(3, 'Calcula sigHash = HMAC-SHA256(NEXTAUTH_SECRET:signaturePin, canonical).'))
story.append(num_bullet(4, 'UpdateMany: setea employeeSignedAt=now, employeeSignatureHash=sigHash, employeeSignedIp=ip.'))
story.append(num_bullet(5, 'AuditLog ATTENDANCE_SIGN con signedCount y preview del hash.'))
story.append(p('El PIN del empleado no se guarda; solo se usa para derivar la clave HMAC. Cualquier '
               'modificacion posterior al registro invalidaria el hash (deteccion de tampering).'))

story.append(h2('7.4 Conservacion minima (art. 804 LFT)'))
story.append(p('El articulo 804 de la LFT exige conservar los registros de asistencia por al menos 12 '
               'meses. El sistema soporta export XLSX con rangos de hasta 366 dias. Los AuditLog no '
               'tienen expiracion automatica (se conservan indefinidamente en Supabase).'))

story.append(h2('7.5 Lista completa de acciones auditadas'))
story.append(p('Ver Capitulo 2.9 (Vista Auditoria) para la lista completa de 35 acciones categorizadas.'))

story.append(PageBreak())

# === CHAPTER 8: FAQ ===
story.append(h1('8. Preguntas frecuentes (FAQ)', 'Capitulo 8. FAQ'))

story.append(h2('8.1 No puedo iniciar sesion'))
story.append(p('<b>Causa 1: Cuenta bloqueada.</b> Tras 5 intentos fallidos, la cuenta se bloquea 15 min. '
               'Espera o pide a un admin que la desbloquee desde "Usuarios y Roles" -> "Desbloquear".'))
story.append(p('<b>Causa 2: Credenciales incorrectas.</b> Verifica email y password. Usa el toggle '
               '"Mostrar contrasena" para ver lo que escribes. Si olvidaste tu password, pide a un '
               'admin resetearla desde "Usuarios y Roles" -> "Resetear contrasena".'))
story.append(p('<b>Causa 3: MFA perdido.</b> Si tienes MFA activado pero no tienes tu telefono ni backup '
               'codes, contacta a otro GENERAL_ADMIN para desactivar tu MFA desde "Usuarios y Roles".'))
story.append(p('<b>Causa 4: Cuenta inactiva.</b> Si tu cuenta fue desactivada, no aparece el formulario '
               'de login. Contacta al admin.'))

story.append(h2('8.2 Como creo un empleado nuevo'))
story.append(num_bullet(1, 'Inicia sesion como admin (GA o SA).'))
story.append(num_bullet(2, 'Ve a "Empleados" en el sidebar.'))
story.append(num_bullet(3, 'Click en "Nuevo empleado" (icono UserPlus).'))
story.append(num_bullet(4, 'Completa: Nombre, Email, Numero de empleado, Puesto, Departamento, Sucursal.'))
story.append(num_bullet(5, 'Asigna password (min 6 chars) y confirmala.'))
story.append(num_bullet(6, 'Configura el horario semanal en el ScheduleEditor (default: L-V 9-18, Domingo descanso).'))
story.append(num_bullet(7, 'Click en "Crear empleado". El empleado podra iniciar sesion inmediatamente.'))

story.append(h2('8.3 Como cambio el horario de un empleado'))
story.append(num_bullet(1, 'Ve a "Empleados".'))
story.append(num_bullet(2, 'Click en el icono reloj ("Horario") en la fila del empleado.'))
story.append(num_bullet(3, 'Modifica los 7 dias segun necesidad (Trabaja / Descanso / No laborable).'))
story.append(num_bullet(4, 'Recuerda: minimo 1 dia de descanso (art. 71 LFT).'))
story.append(num_bullet(5, 'Click en "Guardar horario".'))

story.append(h2('8.4 Como justifico una falta'))
story.append(p('Los empleados justifican sus propias faltas. Hay 2 formas:'))
story.append(p('<b>Forma 1 (empleado):</b> en su app, tab Historial, encuentra la fecha ausente y '
               'envia una justificacion (min 5 caracteres). El admin la aprueba o rechaza.'))
story.append(p('<b>Forma 2 (admin):</b> ve a Dashboard o Historial, encuentra el registro, click en '
               'editar, proporciona notas y correctionReason. La correccion se marca como pendiente '
               'de justificacion (justificationStatus=PENDING).'))

story.append(h2('8.5 Como corrijo un registro'))
story.append(num_bullet(1, 'Ve a Dashboard (para el dia actual) o Historial (para cualquier fecha).'))
story.append(num_bullet(2, 'Encuentra el registro, click en el icono lapiz ("Corregir").'))
story.append(num_bullet(3, 'Si el registro esta bloqueado (isLocked=true), marca "forceUnlock" y proporciona un "correctionReason" obligatorio.'))
story.append(num_bullet(4, 'Ajusta Entrada (HH:mm) y Salida (HH:mm) segun corresponda.'))
story.append(num_bullet(5, 'Opcional: agrega notas.'))
story.append(num_bullet(6, 'Click en "Guardar correccion". Se preserva el horario original, se recalcula overtime, y se marca como pendiente de justificacion.'))

story.append(h2('8.6 Como exporto reportes'))
story.append(num_bullet(1, 'Ve a "Reportes".'))
story.append(num_bullet(2, 'Selecciona el tipo de reporte (Diario, Horas Extra, Ausencias, Incidencias, Comparativa).'))
story.append(num_bullet(3, 'Configura filtros (fecha o rango, sucursal, empleado segun el tipo).'))
story.append(num_bullet(4, 'Click en "Generar" para ver el reporte en pantalla.'))
story.append(num_bullet(5, 'Click en "CSV" para exportar como CSV (BOM UTF-8, abre en Excel) o "XLSX" para Excel con 3-4 hojas (Portada, Datos, Resumen, Auditoria).'))
story.append(p('El CSV es ideal para importar a otros sistemas. El XLSX es mejor para imprimir o '
               'compartir porque incluye datos de empresa en la portada.'))

story.append(h2('8.7 Como transfiero un empleado entre sucursales'))
story.append(num_bullet(1, 'Ve a "Empleados" (solo GA puede transferir).'))
story.append(num_bullet(2, 'Click en el icono ArrowRightLeft ("Transferir") en la fila del empleado.'))
story.append(num_bullet(3, 'Selecciona la sucursal destino (no puede ser la actual).'))
story.append(num_bullet(4, 'Click en "Transferir". Se actualiza sucursalId del empleado y se registra AuditLog TRANSFER.'))

story.append(h2('8.8 Como otorgo vacaciones sin solicitud previa'))
story.append(num_bullet(1, 'Ve a "Vacaciones y Permisos".'))
story.append(num_bullet(2, 'Click en "Otorgar permiso / vacaciones" (emerald, icono Plus).'))
story.append(num_bullet(3, 'Selecciona Empleado y Tipo (Vacaciones, Permiso, Incapacidad, etc.).'))
story.append(num_bullet(4, 'Si es permiso parcial (por horas), activa el switch y completa Fecha, Hora de salida, Hora de regreso.'))
story.append(num_bullet(5, 'Si es vacaciones completas, completa Fecha de inicio y Fecha de fin. Se mostrara cuantos dias se descontaran del saldo.'))
story.append(num_bullet(6, 'Opcional: agrega motivo/notas.'))
story.append(num_bullet(7, 'Click en "Otorgar". La vacacion queda en estado APPROVED inmediatamente.'))

story.append(h2('8.9 Que hago si un empleado trabajo su dia de descanso'))
story.append(p('El sistema detecta automaticamente esta situacion al hacer check-out. No necesitas '
               'hacer nada manualmente. El registro quedara con:'))
story.append(bullet('isRestDayWorked = true'))
story.append(bullet('restDayWorkedMinutes = jornada neta trabajada'))
story.append(bullet('restDayPremiumMinutes = igual cantidad (prima 100% adicional, art. 73)'))
story.append(bullet('isSunday = true/false (para prima dominical art. 71)'))
story.append(p('Ademas se generan:'))
story.append(bullet('Alerta NOM-035 tipo REST_DAY_WORKED (HIGH si domingo, MEDIUM otro dia).'))
story.append(bullet('AuditLog NOM035_ALERT_REST_DAY_WORKED.'))
story.append(p('En los reportes (Diario, Horas Extra, Incidencias, Comparativa) aparecen columnas '
               '"Dia de Descanso Trabajado" y "Prima 100% (h)" para que nomina lo pague correctamente.'))

story.append(h2('8.10 Como configuro geofence'))
story.append(num_bullet(1, 'Ve a "Sucursales" (GA) o "Mi Sucursal" (SA).'))
story.append(num_bullet(2, 'Edita la sucursal.'))
story.append(num_bullet(3, 'Completa Latitud y Longitud (puedes obtenerlas de Google Maps: click derecho -> coordenadas).'))
story.append(num_bullet(4, 'Ajusta "Radio geofence (m)" (default 150m).'))
story.append(num_bullet(5, 'Activa el switch "Aplicar geofence".'))
story.append(num_bullet(6, 'Click en "Guardar".'))
story.append(p('A partir de ahora, los check-in GPS que esten fuera del radio seran rechazados con '
               'error 403 mostrando la distancia y el radio permitido. Los check-in por QR no validan geofence.'))

story.append(PageBreak())

# === CHAPTER 9: GLOSARIO Y REFERENCIAS ===
story.append(h1('9. Glosario y referencias', 'Capitulo 9. Glosario y referencias'))

story.append(h2('9.1 Glosario de terminos'))
story.append(make_table(
    ['Termino', 'Definicion'],
    [
        ['NOM-037', 'Norma Oficial Mexicana NOM-037-STPS-2023, telefonos y trabajo a distancia. Registra asistencia, horas y lugar.'],
        ['LFT', 'Ley Federal del Trabajo (Mexico). Reformada en 2026 (DOF 1-may-2026) con cambios graduales en horas extra.'],
        ['MFA', 'Multi-Factor Authentication. Segundo factor ademas del password (en este sistema: TOTP).'],
        ['TOTP', 'Time-based One-Time Password (RFC 6238). Codigo de 6 digitos que cambia cada 30 segundos.'],
        ['HMAC', 'Hash-based Message Authentication Code. Firma criptografica con clave secreta (SHA-256 en este sistema).'],
        ['Geofence', 'Cerco geografico virtual. Define un radio permitido para check-in GPS.'],
        ['Prima dominical', 'Pago adicional del 25% por trabajar domingo (art. 71 LFT, opcional segun contrato).'],
        ['Prima por descanso trabajado', 'Pago del 100% adicional por trabajar en dia de descanso (art. 73 LFT).'],
        ['Horas extra dobles', 'Primeras horas extra semanales, hasta el tope (9h en 2027). Pagan al doble (art. 66).'],
        ['Horas extra triples', 'Excedente del tope semanal. Pagan al triple (art. 68).'],
        ['Tope semanal', 'Maximo de horas extra semanales que pagan al doble (gradual: 9h 2027, 12h 2030).'],
        ['Tope diario', 'Maximo de 4 horas extra por dia (art. 66).'],
        ['WorkSchedule', 'Horario semanal del empleado (7 dias, cada uno con startTime/endTime/tolerance/isWeeklyRest).'],
        ['AttendanceRecord', 'Registro diario de asistencia (check-in/out, breaks, overtime, status).'],
        ['DynamicQR', 'Token QR de un solo uso, generado por admin para login kiosco (5 min expiracion).'],
        ['Backup codes', '10 codigos one-time use para emergencias MFA (formato XXXX-XXXX-XXXX-XXXX).'],
        ['Proof plena', 'Firma del registro por el empleado (art. 132 XXXIV LFT). HMAC-SHA256 con PIN.'],
        ['Sucursal', 'Centro de trabajo (Local 261 = Matriz, etc.). Cada sucursal tiene su geofence y tolerancias.'],
        ['GENERAL_ADMIN', 'Administrador general. Ve toda la empresa, todas las sucursales.'],
        ['SUCURSAL_ADMIN', 'Admin de una sucursal especifica. Solo ve su sucursal.'],
        ['SUPERVISOR', 'Rol read-only. Ve dashboard, historial, reportes, auditoria, NOM-035 de su sucursal.'],
        ['EMPLOYEE', 'Empleado individual. Registra su asistencia, ve su historial, vacaciones y QR.'],
    ],
    col_widths=[3, 10]
))

story.append(h2('9.2 Referencias legales'))
story.append(make_table(
    ['Referencia', 'Disposicion', 'Implementacion en el sistema'],
    [
        ['NOM-037-STPS-2023', 'Registro de asistencia con hora, lugar y metodo', 'AttendanceRecord con checkInTime/checkOutTime, lat/lng, method (GPS/QR/Manual)'],
        ['LFT art. 66', 'Tope diario 4h extra; primeras horas semanales al doble', 'overtimeDoubleMinutes (max 240/dia, hasta tope semanal)'],
        ['LFT art. 68', 'Excedente del tope semanal al triple', 'overtimeTripleMinutes (max(0, daily - cabeEnDoble))'],
        ['LFT art. 71', 'Descanso semanal obligatorio + prima dominical 25%', 'WorkSchedule.isWeeklyRest (validacion: min 1 dia); isSunday flag'],
        ['LFT art. 73', 'Prima 100% adicional por descanso trabajado', 'isRestDayWorked, restDayWorkedMinutes, restDayPremiumMinutes'],
        ['LFT art. 74', '7 dias feriados oficiales', 'Tabla Holiday con MEXICO_OFFICIAL_HOLIDAYS_2027'],
        ['LFT art. 132 XXXIV', 'Firma de registros por el empleado (prueba plena)', 'POST /api/attendance/sign con HMAC-SHA256 + PIN'],
        ['LFT art. 76', 'Vacaciones (dias completos)', 'Vacation type=VACACIONES descuenta saldo; permisos parciales no descuentan'],
        ['LFT art. 804', 'Conservacion minima 12 meses', 'Export XLSX soporta hasta 366 dias; AuditLog sin expiracion'],
        ['Transitorio Cuarto DOF 1-may-2026', 'Tope semanal gradual: 9h (2026-27) -> 12h (2030)', 'getWeeklyOvertimeCapMinutes(year)'],
        ['NOM-035-STPS-2018', 'Factores de riesgo psicosocial', '/api/alerts/nom-035 genera 5 tipos de alerta automaticas'],
    ],
    col_widths=[3, 4, 6]
))

story.append(h2('9.3 Soporte tecnico'))
story.append(p('Para soporte tecnico, contacta al administrador del sistema:'))
story.append(bullet('Email: contacto@miempresa.com'))
story.append(bullet('Telefono: +52 55 1234 5678'))
story.append(bullet('URL produccion: https://control-asistencia-v22.vercel.app'))
story.append(bullet('Repositorio: https://github.com/moygallegostrujillo-stack/control-de-asistencia'))
story.append(Spacer(1, 12))
story.append(p('<b>Documentacion complementaria disponible en la app</b> (vista "Documentacion"):'))
story.append(bullet('Documento de Cumplimiento Legal - Reforma LFT 2027 (PDF).'))
story.append(bullet('Recomendacion de Infraestructura (HTML + PDF).'))
story.append(bullet('Diagrama: Arquitectura del Sistema.'))
story.append(bullet('Diagrama: Flujo de Procesos.'))
story.append(bullet('Diagrama: Activacion de MFA TOTP.'))
story.append(bullet('Diagrama: Uso del Codigo QR.'))
story.append(bullet('Diagrama: Puesta en Marcha.'))

# === BUILD ===
output_path = '/home/z/my-project/documentos/manual-usuario-v2.2.pdf'

class ManualDocTemplate(TocDocTemplate):
    pass

doc = ManualDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=2*cm, rightMargin=2*cm,
    topMargin=2*cm, bottomMargin=2*cm,
    title='Manual de Usuario - Control de Asistencia NOM-037 v2.2',
    author='Mi Empresa S.A. de C.V.',
    subject='Manual de usuario del sistema',
    creator='Z.ai',
)

# Page templates: cover (no header/footer), body (with header/footer)
frame_cover = Frame(0, 0, A4[0], A4[1], leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id='cover')
frame_body = Frame(2*cm, 2*cm, A4[0]-4*cm, A4[1]-4*cm, id='body')

doc.addPageTemplates([
    PageTemplate(id='Cover', frames=[frame_cover], onPage=cover_page),
    PageTemplate(id='Body', frames=[frame_body], onPage=header_footer),
])

# Insert template switch: first page uses Cover, then Body
story.insert(0, NextPageTemplate('Body'))

# multiBuild for TOC
doc.multiBuild(story)

# === VERIFY ===
size = os.path.getsize(output_path)
print(f"\n[OK] PDF generado: {output_path}")
print(f"   Tamano: {size:,} bytes ({size/1024:.1f} KB)")

try:
    from pypdf import PdfReader
    r = PdfReader(output_path)
    print(f"   Paginas: {len(r.pages)}")
    print(f"   Metadata: title={r.metadata.title!r}, author={r.metadata.author!r}")
except Exception as e:
    print(f"   (no se pudo leer metadata: {e})")

# Copy to public/documentos/
public_path = '/home/z/my-project/public/documentos/manual-usuario-v2.2.pdf'
os.makedirs(os.path.dirname(public_path), exist_ok=True)
shutil.copy2(output_path, public_path)
print(f"[OK] Copia: {public_path}")
