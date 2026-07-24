#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Manual de Usuario v3.0 - Control de Asistencia
Generado con ReportLab. Paleta cascade (minimal mode).

Cubre TODAS las funcionalidades del sistema:
  - 4 roles (Admin General, Admin Sucursal, Supervisor, Empleado)
  - MFA TOTP
  - Vacaciones y Permisos
  - LFPDPPP (Aviso de Privacidad + ARCO)
  - NOM-035 Alertas
  - NOM-037 Geolocalizacion
  - Reforma LFT 2027 (arts. 61/66/67/68/71/73/804/132)
  - Multi-sucursal con geocerca
  - Terminal QR + Modo kiosco
  - Auditoria completa
"""
import os
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
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ============================================================
# PALETTE (cascade, minimal mode)
# ============================================================
PAGE_BG       = colors.HexColor('#f5f5f4')
SECTION_BG    = colors.HexColor('#efeeed')
CARD_BG       = colors.HexColor('#edece9')
TABLE_STRIPE  = colors.HexColor('#f0efee')
HEADER_FILL   = colors.HexColor('#625b46')
COVER_BLOCK   = colors.HexColor('#615c4c')
BORDER        = colors.HexColor('#cac1a9')
ICON          = colors.HexColor('#8f7a3b')
ACCENT        = colors.HexColor('#9c8130')
ACCENT_2      = colors.HexColor('#547495')
TEXT_PRIMARY   = colors.HexColor('#201f1d')
TEXT_MUTED     = colors.HexColor('#908e87')
SEM_SUCCESS   = colors.HexColor('#41915b')
SEM_WARNING   = colors.HexColor('#8f7746')
SEM_ERROR     = colors.HexColor('#8f4a44')
SEM_INFO      = colors.HexColor('#4d7195')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ============================================================
# FONTS
# ============================================================
FONT_REG = 'Helvetica'
FONT_BOLD = 'Helvetica-Bold'
FONT_ITAL = 'Helvetica-Oblique'
FONT_BI = 'Helvetica-BoldOblique'

try:
    pdfmetrics.registerFont(TTFont('LibSans', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('LibSans-Bold', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('LibSans-Italic', '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf'))
    pdfmetrics.registerFont(TTFont('LibSans-BoldItalic', '/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf'))
    from reportlab.pdfbase.pdfmetrics import registerFontFamily
    registerFontFamily('LibSans', normal='LibSans', bold='LibSans-Bold',
                       italic='LibSans-Italic', boldItalic='LibSans-BoldItalic')
    FONT_REG = 'LibSans'; FONT_BOLD = 'LibSans-Bold'; FONT_ITAL = 'LibSans-Italic'; FONT_BI = 'LibSans-BoldItalic'
    print("Fuentes LiberationSans registradas")
except Exception as e:
    print(f"LiberationSans no disponible ({e}), usando Helvetica")

# ============================================================
# STYLES
# ============================================================
ss = getSampleStyleSheet()

# ============================================================
# SPANISH ACCENTS HELPER
# ============================================================
import re

# Mapa de reemplazos: palabra sin acento -> palabra con acento
# Solo palabras completas (word boundary) para evitar corrupcion
_ACCENT_MAP = {
    # Sustantivos terminados en -cion/-sion
    'administracion': 'administración', 'Administracion': 'Administración',
    'informacion': 'información', 'Informacion': 'Información',
    'configuracion': 'configuración', 'Configuracion': 'Configuración',
    'verificacion': 'verificación', 'Verificacion': 'Verificación',
    'autenticacion': 'autenticación', 'Autenticacion': 'Autenticación',
    'ubicacion': 'ubicación', 'Ubicacion': 'Ubicación',
    'conservacion': 'conservación', 'Conservacion': 'Conservación',
    'cancelacion': 'cancelación', 'Cancelacion': 'Cancelación',
    'rectificacion': 'rectificación', 'Rectificacion': 'Rectificación',
    'oposicion': 'oposición', 'Oposicion': 'Oposición',
    'descripcion': 'descripción', 'Descripcion': 'Descripción',
    'seccion': 'sección', 'Seccion': 'Sección',
    'funcion': 'función', 'Funcion': 'Función',
    'operacion': 'operación', 'Operacion': 'Operación',
    'generacion': 'generación', 'Generacion': 'Generación',
    'validacion': 'validación', 'Validacion': 'Validación',
    'actualizacion': 'actualización', 'Actualizacion': 'Actualización',
    'creacion': 'creación', 'Creacion': 'Creación',
    'edicion': 'edición', 'Edicion': 'Edición',
    'modificacion': 'modificación', 'Modificacion': 'Modificación',
    'correccion': 'corrección', 'Correccion': 'Corrección',
    'gestion': 'gestión', 'Gestion': 'Gestión',
    'comunicacion': 'comunicación', 'Comunicacion': 'Comunicación',
    'proteccion': 'protección', 'Proteccion': 'Protección',
    'explicacion': 'explicación', 'Explicacion': 'Explicación',
    'introduccion': 'introducción', 'Introduccion': 'Introducción',
    'instruccion': 'instrucción', 'Instruccion': 'Instrucción',
    'conexion': 'conexión', 'Conexion': 'Conexión',
    'sancion': 'sanción', 'Sancion': 'Sanción',
    'autenticación': 'autenticación',
    # Sesión, número, código, teléfono, página
    'sesion': 'sesión', 'Sesion': 'Sesión',
    'numero': 'número', 'Numero': 'Número',
    'codigo': 'código', 'Codigo': 'Código',
    'codigos': 'códigos', 'Codigos': 'Códigos',
    'telefono': 'teléfono', 'Telefono': 'Teléfono',
    'pagina': 'página', 'Pagina': 'Página',
    # Adverbios y conectivos
    'tambien': 'también', 'Tambien': 'También',
    'ademas': 'además', 'Ademas': 'Además',
    'despues': 'después', 'Despues': 'Después',
    'asi': 'así', 'Asi': 'Así',
    'aqui': 'aquí', 'Aqui': 'Aquí',
    'ahi': 'ahí', 'Ahi': 'Ahí',
    # Adjetivos comunes
    'electronico': 'electrónico', 'Electronico': 'Electrónico',
    'minimo': 'mínimo', 'Minimo': 'Mínimo',
    'maximo': 'máximo', 'Maximo': 'Máximo',
    'unico': 'único', 'Unico': 'Único',
    'ultima': 'última', 'Ultima': 'Última',
    'ultimo': 'último', 'Ultimo': 'Último',
    'publico': 'público', 'Publico': 'Público',
    'tecnico': 'técnico', 'Tecnico': 'Técnico',
    'tecnica': 'técnica', 'Tecnica': 'Técnica',
    'practica': 'práctica', 'Practica': 'Práctica',
    'rapido': 'rápido', 'Rapido': 'Rápido',
    'proximo': 'próximo', 'Proximo': 'Próximo',
    'proxima': 'próxima', 'Proxima': 'Próxima',
    'especifico': 'específico', 'Especifico': 'Específico',
    'basica': 'básica', 'Basica': 'Básica',
    'analisis': 'análisis', 'Analisis': 'Análisis',
    # Sustantivos varios
    'dias': 'días', 'Dias': 'Días',
    'anos': 'años', 'Anos': 'Años',
    'movil': 'móvil', 'Movil': 'Móvil',
    'documento': 'documento',
    'documentos': 'documentos',
    # Verbos futuro
    'sera': 'será', 'Sera': 'Será',
    'tendra': 'tendrá', 'Tendra': 'Tendrá',
    'podra': 'podrá', 'Podra': 'Podrá',
    'debera': 'deberá', 'Debera': 'Deberá',
    'mostrara': 'mostrará',
    'permitira': 'permitirá',
    'cumplira': 'cumplirá',
    'registrara': 'registrará',
    'pedira': 'pedirá',
    'subira': 'subirá',
    'necesitara': 'necesitará',
    'podran': 'podrán',
    'deberan': 'deberán',
    'hara': 'hará',
    'vera': 'verá',
    'saldra': 'saldrá',
    'entrara': 'entrará',
    'obtendra': 'obtendrá',
    'revisara': 'revisará',
    'utilizara': 'utilizará',
    'recibira': 'recibirá',
    'descargara': 'descargará',
    'generara': 'generará',
    'actualizara': 'actualizará',
    'funcionara': 'funcionará',
    'aceptara': 'aceptará',
    'seleccion': 'selección', 'Seleccion': 'Selección',
    # Mexico
    'Mexico': 'México',
    # Adverbios terminados en -mente
    'automaticamente': 'automáticamente',
    'rapidamente': 'rápidamente',
    'unicamente': 'únicamente',
    'especificamente': 'específicamente',
    # Palabras sueltas comunes
    'presici': 'precisi',  # precision -> precisión
    'presicion': 'precisión',
    'precision': 'precisión',
    'decision': 'decisión',
    'expresion': 'expresión',
    'dimension': 'dimensión',
    'mision': 'misión',
    'permiso': 'permiso',  # sin acento
    'permisos': 'permisos',
    'vacaciones': 'vacaciones',  # sin acento
    'vacacion': 'vacación',
    'solicitud': 'solicitud',  # sin acento
    'revisi': 'revisi',  # revisión
    'revision': 'revisión',
    'excepcion': 'excepción',
    'opcion': 'opción',
    'relacion': 'relación',
    'organizacion': 'organización',
    'aplicacion': 'aplicación',
    'implementacion': 'implementación',
    'integridad': 'integridad',
    'veracidad': 'veracidad',
    'responsabilidad': 'responsabilidad',
    'trazabilidad': 'trazabilidad',
    'disponibilidad': 'disponibilidad',
    'confidencialidad': 'confidencialidad',
}

# Compilar regex con word boundaries para todas las palabras del mapa
_ACCENT_PATTERN = re.compile(
    r'\b(' + '|'.join(re.escape(k) for k in sorted(_ACCENT_MAP.keys(), key=len, reverse=True)) + r')\b'
)

def _t(text):
    """Aplica acentos españoles a una cadena de texto (respeta limites de palabra)."""
    if not isinstance(text, str):
        return text
    return _ACCENT_PATTERN.sub(lambda m: _ACCENT_MAP[m.group(0)], text)

# Sobrecargar Paragraph para aplicar acentos automáticamente
_OriginalParagraph = Paragraph
def Paragraph(text, style=None, *args, **kwargs):
    return _OriginalParagraph(_t(text), style, *args, **kwargs)

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
                            textColor=TEXT_PRIMARY, alignment=TA_LEFT, leftIndent=16,
                            bulletIndent=4, spaceAfter=3)
STY_NUMBER = ParagraphStyle('Number', fontName=FONT_REG, fontSize=10, leading=14,
                            textColor=TEXT_PRIMARY, alignment=TA_LEFT, leftIndent=20,
                            spaceAfter=4)
STY_CAPTION = ParagraphStyle('Caption', fontName=FONT_ITAL, fontSize=9, leading=12,
                             textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=10, spaceBefore=4)
STY_TABLE_CELL = ParagraphStyle('TableCell', fontName=FONT_REG, fontSize=8.5, leading=11,
                                textColor=TEXT_PRIMARY, alignment=TA_LEFT)
STY_TABLE_CELL_C = ParagraphStyle('TableCellC', fontName=FONT_REG, fontSize=8.5, leading=11,
                                  textColor=TEXT_PRIMARY, alignment=TA_CENTER)
STY_TABLE_HEADER = ParagraphStyle('TableHeader', fontName=FONT_BOLD, fontSize=9, leading=12,
                                  textColor=colors.white, alignment=TA_CENTER)
STY_CALLOUT = ParagraphStyle('Callout', fontName=FONT_REG, fontSize=9.5, leading=14,
                             textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=4)
STY_CODE = ParagraphStyle('Code', fontName='Courier', fontSize=9, leading=12,
                          textColor=TEXT_PRIMARY, alignment=TA_LEFT, leftIndent=12,
                          backColor=CARD_BG, borderColor=BORDER, borderWidth=0.5,
                          borderPadding=6, spaceAfter=6)
STY_LEGAL = ParagraphStyle('Legal', fontName=FONT_ITAL, fontSize=9, leading=12,
                           textColor=SEM_INFO, alignment=TA_LEFT, spaceAfter=4)
STY_FOOTER = ParagraphStyle('Footer', fontName=FONT_REG, fontSize=8, leading=10,
                            textColor=TEXT_MUTED, alignment=TA_CENTER)

# ============================================================
# CALLOUT BOXES (Info, Warning, Success, Legal)
# ============================================================
def callout(text, kind='info'):
    """Crea una caja de aviso (info/warning/success/legal)."""
    color_map = {
        'info':    (SEM_INFO, colors.HexColor('#eaf0f6')),
        'warning': (SEM_WARNING, colors.HexColor('#f6f0e6')),
        'success': (SEM_SUCCESS, colors.HexColor('#e8f3ec')),
        'legal':   (ACCENT, colors.HexColor('#f5f0e0')),
        'error':   (SEM_ERROR, colors.HexColor('#f6e8e7')),
    }
    border_color, bg_color = color_map.get(kind, color_map['info'])
    label_map = {
        'info':    'Información',
        'warning': 'Precaución',
        'success': 'Cumplimiento',
        'legal':   'Marco legal',
        'error':   'Importante',
    }
    label = label_map.get(kind, 'Información')

    inner = [
        Paragraph(f'<b>{label}</b>', ParagraphStyle('cl', fontName=FONT_BOLD, fontSize=9,
                   textColor=border_color, leading=12, spaceAfter=3)),
        Paragraph(text, STY_CALLOUT),
    ]
    t = Table([[inner]], colWidths=[16*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_color),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEBEFORE', (0,0), (0,-1), 4, border_color),
    ]))
    return KeepTogether([t, Spacer(1, 8)])

# ============================================================
# STEP LIST (numbered steps)
# ============================================================
def step_list(steps):
    """Lista numerada de pasos. steps = [(title, desc), ...]"""
    rows = []
    for i, (title, desc) in enumerate(steps, 1):
        num_cell = Paragraph(f'<b>{i}</b>', ParagraphStyle('n', fontName=FONT_BOLD,
                             fontSize=11, textColor=colors.white, alignment=TA_CENTER, leading=14))
        text_cell = [
            Paragraph(f'<b>{title}</b>', ParagraphStyle('st', fontName=FONT_BOLD,
                       fontSize=10, textColor=TEXT_PRIMARY, leading=13, spaceAfter=2)),
            Paragraph(desc, ParagraphStyle('sd', fontName=FONT_REG, fontSize=9.5,
                       textColor=TEXT_PRIMARY, leading=13)),
        ]
        rows.append([num_cell, text_cell])
    t = Table(rows, colWidths=[0.9*cm, 15.1*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), ACCENT),
        ('TEXTCOLOR', (0,0), (0,-1), colors.white),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (1,0), (1,-1), [colors.white, TABLE_STRIPE]),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.25, BORDER),
    ]))
    return KeepTogether([t, Spacer(1, 8)])

# ============================================================
# DIAGRAM (simple flowchart using tables)
# ============================================================
def flow_diagram(nodes, title=None):
    """Diagrama de flujo vertical. nodes = [(label, kind), ...]
    kind: 'start', 'process', 'decision', 'end', 'accent'"""
    kind_colors = {
        'start':    (SEM_SUCCESS, colors.HexColor('#e8f3ec')),
        'process':  (SEM_INFO, colors.HexColor('#eaf0f6')),
        'decision': (SEM_WARNING, colors.HexColor('#f6f0e6')),
        'end':      (SEM_ERROR, colors.HexColor('#f6e8e7')),
        'accent':   (ACCENT, colors.HexColor('#f5f0e0')),
    }
    rows = []
    for i, (label, kind) in enumerate(nodes):
        border_c, bg_c = kind_colors.get(kind, kind_colors['process'])
        cell = Paragraph(label, ParagraphStyle('fl', fontName=FONT_BOLD, fontSize=9.5,
                         textColor=TEXT_PRIMARY, alignment=TA_CENTER, leading=12))
        rows.append([cell])
        if i < len(nodes) - 1:
            arrow = Paragraph('↓', ParagraphStyle('ar', fontName=FONT_BOLD, fontSize=12,
                              textColor=ACCENT, alignment=TA_CENTER, leading=14))
            rows.append([arrow])
    t = Table(rows, colWidths=[10*cm])
    style_cmds = [
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]
    for i, (label, kind) in enumerate(nodes):
        border_c, bg_c = kind_colors.get(kind, kind_colors['process'])
        row_idx = i * 2
        style_cmds.extend([
            ('BACKGROUND', (0, row_idx), (0, row_idx), bg_c),
            ('BOX', (0, row_idx), (0, row_idx), 1.2, border_c),
            ('ROUNDEDCORNERS', [4, 4, 4, 4]),
        ])
    t.setStyle(TableStyle(style_cmds))
    elems = []
    if title:
        elems.append(Paragraph(f'<b>{title}</b>', ParagraphStyle('dt', fontName=FONT_BOLD,
                       fontSize=10, textColor=ACCENT, alignment=TA_CENTER, spaceAfter=6)))
    elems.append(t)
    elems.append(Spacer(1, 10))
    return KeepTogether(elems)

# ============================================================
# DATA TABLE
# ============================================================
def data_table(headers, rows, col_widths=None, header_bg=None):
    """Tabla de datos con cabecera oscura y filas alternadas."""
    if header_bg is None:
        header_bg = HEADER_FILL
    if col_widths is None:
        n = len(headers)
        col_widths = [16*cm / n] * n
    data = [[Paragraph(h, STY_TABLE_HEADER) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), STY_TABLE_CELL) for c in row])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), header_bg),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), FONT_BOLD),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('ALIGN', (0,0), (-1,0), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [TABLE_ROW_EVEN, TABLE_ROW_ODD]),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.25, BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    return KeepTogether([t, Spacer(1, 8)])

# ============================================================
# SECTION DIVIDER
# ============================================================
def section_divider():
    return [Spacer(1, 4), HRFlowable(width='100%', thickness=0.5, color=BORDER,
                                     spaceBefore=2, spaceAfter=10)]

# ============================================================
# COVER PAGE
# ============================================================
class CoverPage(Flowable):
    def __init__(self, width, height):
        Flowable.__init__(self)
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        # Fondo
        c.setFillColor(PAGE_BG)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        # Bloque lateral izquierdo
        c.setFillColor(COVER_BLOCK)
        c.rect(0, 0, 2.2*cm, self.height, fill=1, stroke=0)
        # Banda decorativa
        c.setFillColor(ACCENT)
        c.rect(2.2*cm, self.height - 1.2*cm, self.width - 2.2*cm, 0.15*cm, fill=1, stroke=0)
        # Titulo
        c.setFillColor(TEXT_PRIMARY)
        c.setFont(FONT_BOLD, 32)
        c.drawString(3.2*cm, self.height - 6*cm, "Manual de")
        c.drawString(3.2*cm, self.height - 7.2*cm, "Usuario")
        # Subtitulo
        c.setFillColor(ACCENT)
        c.setFont(FONT_BOLD, 16)
        c.drawString(3.2*cm, self.height - 8.6*cm, "Control de Asistencia v3.0")
        # Descripcion
        c.setFillColor(TEXT_MUTED)
        c.setFont(FONT_REG, 11)
        c.drawString(3.2*cm, self.height - 10*cm, "Sistema integral de registro y gestión de asistencia laboral")
        # Etiquetas legales
        tags = [
            "Reforma LFT 2027 (arts. 61, 66, 67, 68, 71, 73, 804, 132)",
            "NOM-037-STPS-2023 (Trabajo a distancia)",
            "NOM-035-STPS-2018 (Riesgos psicosociales)",
            "LFPDPPP (Protección de datos personales)",
        ]
        y = self.height - 12.5*cm
        for tag in tags:
            c.setFillColor(SECTION_BG)
            c.roundRect(3.2*cm, y - 0.35*cm, 14*cm, 0.55*cm, 3, fill=1, stroke=0)
            c.setFillColor(TEXT_PRIMARY)
            c.setFont(FONT_REG, 9.5)
            c.drawString(3.5*cm, y - 0.1*cm, tag)
            y -= 0.75*cm
        # Bloque de roles
        c.setFillColor(CARD_BG)
        c.roundRect(3.2*cm, 4.5*cm, 14*cm, 4.5*cm, 6, fill=1, stroke=0)
        c.setFillColor(HEADER_FILL)
        c.setFont(FONT_BOLD, 12)
        c.drawString(3.7*cm, 8.2*cm, "Dirigido a")
        roles = [
            ("Administrador General", "Gestión total del sistema, todas las sucursales"),
            ("Administrador de Sucursal", "Gestión de su centro de trabajo"),
            ("Supervisor", "Consulta y reportes de su sucursal"),
            ("Empleado", "Registro de asistencia y solicitudes"),
        ]
        y = 7.4*cm
        for nombre, desc in roles:
            c.setFillColor(ACCENT)
            c.circle(4.0*cm, y + 0.1*cm, 0.08*cm, fill=1, stroke=0)
            c.setFillColor(TEXT_PRIMARY)
            c.setFont(FONT_BOLD, 9.5)
            c.drawString(4.3*cm, y, nombre)
            c.setFillColor(TEXT_MUTED)
            c.setFont(FONT_REG, 9)
            c.drawString(4.3*cm, y - 0.35*cm, desc)
            y -= 0.75*cm
        # Footer
        c.setFillColor(TEXT_MUTED)
        c.setFont(FONT_REG, 8.5)
        c.drawString(3.2*cm, 2*cm, "Documento operativo · No técnico")
        c.drawString(3.2*cm, 1.5*cm, "Versión 3.0 · Julio 2026")

# ============================================================
# PAGE TEMPLATE (header + footer)
# ============================================================
def add_page_chrome(canvas_obj, doc):
    canvas_obj.saveState()
    page_w, page_h = A4
    # Header
    canvas_obj.setFillColor(HEADER_FILL)
    canvas_obj.rect(0, page_h - 1.1*cm, page_w, 1.1*cm, fill=1, stroke=0)
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont(FONT_BOLD, 8.5)
    canvas_obj.drawString(1.8*cm, page_h - 0.7*cm, "Manual de Usuario · Control de Asistencia v3.0")
    canvas_obj.setFont(FONT_REG, 8)
    canvas_obj.drawRightString(page_w - 1.8*cm, page_h - 0.7*cm, "Cumplimiento LFT 2027 · NOM-037 · NOM-035 · LFPDPPP")
    # Footer
    canvas_obj.setFillColor(TEXT_MUTED)
    canvas_obj.setFont(FONT_REG, 8)
    canvas_obj.drawCentredString(page_w/2, 1*cm, f"Pagina {doc.page}")
    canvas_obj.setStrokeColor(BORDER)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(1.8*cm, 1.4*cm, page_w - 1.8*cm, 1.4*cm)
    canvas_obj.restoreState()

def cover_chrome(canvas_obj, doc):
    """Cover page: sin header/footer."""
    canvas_obj.saveState()
    canvas_obj.setFillColor(PAGE_BG)
    canvas_obj.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas_obj.restoreState()

# ============================================================
# CONTENT SECTIONS
# ============================================================
def section_introduccion():
    elems = []
    elems.append(Paragraph("1. Introduccion y Bienvenida", STY_H1))
    elems.append(Paragraph(
        "Bienvenido al <b>Sistema de Control de Asistencia</b>. Este manual esta pensado para que "
        "cualquier persona —sin importar si tiene conocimientos de computacion o no— pueda usar el "
        "sistema de forma correcta, entender para que sirve cada boton, y conocer que leyes mexicanas "
        "se cumplen al utilizarlo. El sistema no es solo un reloj checador digital: es una herramienta "
        "que protege tanto al trabajador como al patron, registrando con presicion quien entro, cuando, "
        "desde donde y durante cuanto tiempo.", STY_BODY))
    elems.append(Paragraph(
        "A diferencia de un reloj checador de papel, este sistema <b>no permite modificar los registros</b> "
        "una vez creados. Si alguien se equivoca al registrar su entrada, la hora original queda guardada "
        "para siempre y cualquier correccion queda documentada con el nombre de quien la hizo, la fecha y "
        "el motivo. Esto es asi porque la ley federal del trabajo, a partir de la reforma que entra en vigor "
        "el 1 de enero de 2027, exige que los registros de asistencia sean inalterables y verificables.", STY_BODY))
    elems.append(Paragraph(
        "El sistema puede ser usado por cuatro tipos de personas (roles), cada uno con permisos diferentes. "
        "No todos ven lo mismo: un empleado solo ve su propia informacion; un supervisor puede consultar "
        "los reportes de su sucursal pero no modificar nada; un administrador de sucursal gestiona su "
        "centro de trabajo; y el administrador general tiene acceso total a todo el sistema. Esta separacion "
        "de funciones cumple con las buenas practicas de seguridad de la informacion.", STY_BODY))
    elems.append(callout(
        "Este sistema cumple simultaneamente con <b>cuatro marcos legales mexicanos</b>: la Ley Federal "
        "del Trabajo (LFT) incluyendo la reforma 2027, la NOM-037-STPS-2023 sobre trabajo a distancia, "
        "la NOM-035-STPS-2018 sobre riesgos psicosociales y la Ley Federal de Proteccion de Datos "
        "Personales en Posesion de los Particulares (LFPDPPP).", 'success'))
    elems.append(Paragraph("Que encontrara en este manual", STY_H2))
    elems.append(Paragraph(
        "El manual esta organizado en nueve secciones. Las primeras tres explican el marco legal y los "
        "roles del sistema. La cuarta describe como iniciar sesion por primera vez, aceptar el aviso de "
        "privacidad y configurar la verificacion en dos pasos. La quinta y sexta detallan, paso a paso, "
        "lo que puede hacer un empleado y un administrador respectivamente. La septima es una tabla que "
        "cruza cada funcion del sistema con el articulo de ley que cumple. Las dos ultimas son preguntas "
        "frecuentes y un glosario de terminos.", STY_BODY))
    elems += section_divider()
    return elems

def section_marco_legal():
    elems = []
    elems.append(PageBreak())
    elems.append(Paragraph("2. Marco Legal de Cumplimiento", STY_H1))
    elems.append(Paragraph(
        "El sistema fue diseñado desde su origen para cumplir con la legislacion laboral mexicana vigente "
        "y la que entra en vigor en 2027. No se trata de cumplir la ley solo 'en papel': el sistema "
        "<b>obliga</b> al cumplimiento en los puntos criticos. Por ejemplo, no permite guardar el horario "
        "de un empleado si no se le ha asignado al menos un dia de descanso semanal, porque la ley lo exige.", STY_BODY))
    elems.append(Paragraph(
        "A continuacion se presentan los cuatro marcos legales que el sistema cumple, con una explicacion "
        "breve de cada uno y que funciones del sistema le corresponden. El detalle completo (articulo por "
        "articulo) se encuentra en la seccion 7 de este manual.", STY_BODY))

    elems.append(Paragraph("2.1 Reforma a la Ley Federal del Trabajo (LFT) 2027", STY_H2))
    elems.append(Paragraph(
        "La reforma publicada en el Diario Oficial de la Federacion el 1 de mayo de 2026 entra en vigor "
        "el 1 de enero de 2027. Obliga a todos los patrones a llevar un <b>registro electronico de "
        "asistencia</b> que permita conocer con precision la hora de entrada, salida y tiempo de comida "
        "de cada trabajador. Tambien establece un tope maximo de 9 horas extra por semana (que subira a "
        "12 en 2030) y obliga a conservar los registros por al menos 12 meses.", STY_BODY))
    elems.append(callout(
        "<b>Articulos clave cumplidos:</b> 61 (jornada maxima 8h), 66 (horas extra dobles), 67 y 68 "
        "(horas extra triples), 69 y 71 (dia de descanso obligatorio), 73 (prima del 100% por descanso "
        "trabajado), 76 (vacaciones), 804 (conservacion 12 meses), 132 fraccion XXXIV (registro electronico).",
        'legal'))

    elems.append(Paragraph("2.2 NOM-037-STPS-2023 (Trabajo a distancia)", STY_H2))
    elems.append(Paragraph(
        "Esta norma regula el trabajo a distancia (teletrabajo). Entre sus requisitos exige que el patron "
        "pueda <b>verificar la ubicacion</b> desde donde el trabajador registra su asistencia, para "
        "acreditar que efectivamente esta trabajando desde el lugar convenido. Tambien exige que los "
        "registros sean inalterables y que el trabajador tenga acceso a su propio historial.", STY_BODY))
    elems.append(callout(
        "El sistema captura las <b>coordenadas GPS</b> en cada registro, las compara con la ubicacion "
        "configurada de la sucursal (geocerca) y marca el registro como 'validado' o 'no validado' segun "
        "corresponda. El trabajador puede consultar y descargar su propio historial en cualquier momento.",
        'success'))

    elems.append(Paragraph("2.3 NOM-035-STPS-2018 (Riesgos psicosociales)", STY_H2))
    elems.append(Paragraph(
        "Esta norma obliga a identificar factores de riesgo psicosocial en el trabajo. Uno de los factores "
        "mas importantes son las <b>jornadas excesivas</b>. Un trabajador que sistematiamente excede las "
        "horas extra permitidas esta en riesgo psicosocial, y el patron tiene la obligacion de "
        "identificarlo y actuar.", STY_BODY))
    elems.append(Paragraph(
        "El sistema genera <b>alertas automaticas</b> en cinco situaciones de riesgo: exceso de horas "
        "extra semanales, exceso de horas extra diarias, dias largos consecutivos, falta de dia de "
        "descanso y trabajo en dia de descanso. Las alertas se clasifican en tres niveles (alta, media, "
        "baja) y aparecen en una campana de notificaciones en la pantalla del administrador.", STY_BODY))

    elems.append(Paragraph("2.4 LFPDPPP (Proteccion de datos personales)", STY_H2))
    elems.append(Paragraph(
        "La Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares regula el "
        "tratamiento de datos personales. Otorga a los titulares de los datos (en este caso, los "
        "empleados) cuatro derechos conocidos como <b>derechos ARCO</b>: Acceso, Rectificacion, "
        "Cancelacion y Oposicion.", STY_BODY))
    elems.append(Paragraph(
        "El sistema cumple esta ley de la siguiente manera: al primer inicio de sesion, el empleado debe "
        "<b>aceptar el aviso de privacidad</b> (no puede usar el sistema si no lo hace). El sistema "
        "guarda la fecha, la direccion IP y la version del aviso aceptado, como evidencia del "
        "consentimiento. Si el aviso cambia en el futuro, el sistema pedira al empleado que lo acepte de "
        "nuevo. Ademas, el empleado puede descargar todos sus datos personales en formato JSON y puede "
        "presentar solicitudes ARCO desde una pagina dedicada.", STY_BODY))
    elems.append(callout(
        "Cuando se ejerce el derecho de cancelacion (que un empleado pide que se borren sus datos), "
        "existe un conflicto entre la LFPDPPP (que ordena suprimir) y la LFT art. 804 (que obliga a "
        "conservar los registros 12 meses por si hay demanda laboral). El sistema lo resuelve "
        "<b>anonimizando</b> los datos identificativos (nombre, correo, contraseña) pero conservando los "
        "registros de asistencia anonimos durante 12 meses, como exige la LFT.", 'warning'))
    elems += section_divider()
    return elems

def section_roles():
    elems = []
    elems.append(PageBreak())
    elems.append(Paragraph("3. Roles del Sistema", STY_H1))
    elems.append(Paragraph(
        "El sistema maneja <b>cuatro roles diferentes</b>. Cada rol ve solo lo que necesita ver y puede "
        "hacer solo lo que su rol le permite. Esta separacion es una medida de seguridad: si un rol no "
        "necesita una funcion para su trabajo, no tiene acceso a ella. Asi se reducen los riesgos de "
        "errores accidentales y de uso indebido.", STY_BODY))

    roles_desc = [
        ("Administrador General",
         "Acceso total al sistema. Ve todas las sucursales, gestiona empleados, usuarios, sucursales, "
         "feriados, datos de la empresa, reportes comparativos y la configuracion del MFA. Es el unico "
         "rol que puede crear otros administradores y eliminar registros."),
        ("Administrador de Sucursal",
         "Gestiona su propia sucursal. Puede crear y editar empleados de su sucursal, aprobar o "
         "rechazar vacaciones, generar reportes y la terminal QR. No puede ver otras sucursales ni "
         "crear usuarios."),
        ("Supervisor",
         "Rol de solo lectura. Puede consultar el dashboard, historial, reportes, alertas NOM-035 y "
         "auditoria de su sucursal. No puede modificar nada, ni crear, ni aprobar. Esta pensado para "
         "gerentes o auditores que necesitan ver informacion sin alterarla."),
        ("Empleado",
         "Interfaz simplificada con cuatro botones: registrar su asistencia, ver su historial, "
         "solicitar vacaciones y ver su codigo QR personal. No ve informacion de otros empleados ni "
         "ninguna pantalla administrativa."),
    ]
    for nombre, desc in roles_desc:
        elems.append(Paragraph(f"<b>{nombre}</b>", STY_H3))
        elems.append(Paragraph(desc, STY_BODY))

    elems.append(Paragraph("3.1 Matriz de permisos", STY_H2))
    elems.append(Paragraph(
        "La siguiente tabla resume que puede hacer cada rol. Una marca indica que la funcion esta "
        "disponible; un guion indica que no.", STY_BODY))

    headers = ["Funcion", "Admin General", "Admin Sucursal", "Supervisor", "Empleado"]
    rows = [
        ("Ver dashboard global", "Si", "-", "-", "-"),
        ("Ver dashboard de sucursal", "Si", "Si", "Si", "-"),
        ("Crear / editar empleados", "Si", "Si", "-", "-"),
        ("Eliminar empleados", "Si", "-", "-", "-"),
        ("Transferir entre sucursales", "Si", "-", "-", "-"),
        ("Crear / editar sucursales", "Si", "Solo la suya", "-", "-"),
        ("Gestionar usuarios y roles", "Si", "-", "-", "-"),
        ("Aprobar / rechazar vacaciones", "Si", "Si", "-", "-"),
        ("Solicitar vacaciones propias", "Si", "Si", "Si", "Si"),
        ("Corregir registros de asistencia", "Si", "Si", "-", "-"),
        ("Reporte comparativo", "Si", "-", "-", "-"),
        ("Reportes de sucursal", "Si", "Si", "Si", "-"),
        ("Ver auditoria", "Si", "Sucursal", "Sucursal", "-"),
        ("Terminal QR + Modo kiosco", "Si", "Si", "-", "-"),
        ("Gestionar feriados y empresa", "Si", "-", "-", "-"),
        ("Activar MFA en su cuenta", "Si", "Si", "Si", "-"),
        ("Descargar sus propios datos (ARCO)", "Si", "Si", "Si", "Si"),
    ]
    elems.append(data_table(headers, rows, col_widths=[5.5*cm, 2.6*cm, 2.6*cm, 2.6*cm, 2.7*cm]))
    elems.append(callout(
        "Aunque un usuario tenga el rol de Administrador General, el sistema <b>registra en la bitacora "
        "de auditoria</b> cada accion que realiza, con su nombre, la fecha, la hora y la direccion IP. "
        "Nadie puede hacer cambios sin dejar rastro.", 'info'))
    elems += section_divider()
    return elems

def section_primeros_pasos():
    elems = []
    elems.append(PageBreak())
    elems.append(Paragraph("4. Primeros Pasos", STY_H1))
    elems.append(Paragraph(
        "Esta seccion explica como iniciar sesion por primera vez, aceptar el aviso de privacidad "
        "(obligatorio) y, para administradores, configurar la verificacion en dos pasos (recomendado).", STY_BODY))

    elems.append(Paragraph("4.1 Inicio de sesion", STY_H2))
    elems.append(Paragraph(
        "Para entrar al sistema necesita un correo electronico y una contraseña que le fueron "
        "proporcionados por el administrador. Existen tres formas de iniciar sesion, aunque la mas "
        "comun es la primera.", STY_BODY))

    elems.append(Paragraph("Metodo A: Contraseña (recomendado)", STY_H3))
    elems.append(step_list([
        ("Abra el sistema en su navegador",
         "Ingrese a la direccion web del sistema que le proporcionaron."),
        ("Escriba su correo y contraseña",
         "En la pestana 'Contraseña' del formulario de inicio de sesion."),
        ("Pulse 'Iniciar sesion'",
         "Si sus datos son correctos, el sistema le pedira aceptar el aviso de privacidad (solo la "
         "primera vez) y luego entrara a su panel."),
        ("Verificacion en dos pasos (solo administradores con MFA activado)",
         "Si tiene MFA configurado, el sistema le pedira un codigo de 6 digitos de su aplicacion "
         "autenticadora (Google Authenticator, Authy, etc.) o un codigo de respaldo."),
    ]))

    elems.append(Paragraph("Metodo B: Acceso rapido (kiosco)", STY_H3))
    elems.append(Paragraph(
        "En la pestana 'Acceso rapido' del formulario de inicio de sesion aparecen todos los usuarios "
        "como tarjetas. Al pulsar una tarjeta, el sistema inicia sesion con ese usuario sin pedir "
        "contraseña. <b>Este metodo esta pensado solo para kioscos confiables</b> (una tablet en la "
        "entrada del centro de trabajo, por ejemplo) y no debe usarse en dispositivos compartidos o "
        "publicos.", STY_BODY))

    elems.append(Paragraph("Metodo C: Codigo QR dinamico (kiosco)", STY_H3))
    elems.append(Paragraph(
        "Un administrador genera un codigo QR desde la terminal QR. El kiosco escanea ese codigo y "
        "entra al sistema con la identidad del administrador. El codigo expira en 5 minutos y solo se "
        "puede usar una vez.", STY_BODY))

    elems.append(callout(
        "<b>Bloqueo por intentos fallidos.</b> Si alguien intenta iniciar sesion 5 veces con una "
        "contraseña incorrecta, la cuenta se bloquea durante 15 minutos. Un administrador puede "
        "desbloquearla manualmente desde 'Usuarios y Roles'.", 'warning'))

    elems.append(Paragraph("4.2 Aviso de Privacidad (LFPDPPP)", STY_H2))
    elems.append(Paragraph(
        "La primera vez que un usuario entra al sistema (y cada vez que el aviso de privacidad cambia "
        "de version), debe aceptar el aviso de privacidad. <b>No puede usar el sistema sin aceptarlo</b>. "
        "Esto cumple el articulo 17 de la LFPDPPP, que exige un consentimiento informado y expreso para "
        "tratar datos personales.", STY_BODY))
    elems.append(step_list([
        ("Lea el aviso completo",
         "El aviso aparece automaticamente. Tiene 9 secciones: que datos se recaban, para que se usan, "
         "con quien se comparten, durante cuanto tiempo se conservan, etc."),
        ("Marque la casilla de aceptacion",
         "Al final del aviso hay una casilla que dice 'He leido y acepto el aviso de privacidad'."),
        ("Pulse 'Aceptar'",
         "El sistema guarda la fecha, la hora, la direccion IP y la version del aviso aceptado. Esto "
         "sirve como evidencia legal del consentimiento."),
    ]))
    elems.append(callout(
        "Si el aviso de privacidad cambia en el futuro (por ejemplo, porque la empresa empieza a "
        "compartir datos con un nuevo proveedor), la version subira de '1.0' a '1.1' y el sistema "
        "pedira a todos los usuarios que acepten el nuevo aviso en su proximo inicio de sesion.", 'info'))

    elems.append(Paragraph("4.3 Verificacion en dos pasos (MFA)", STY_H2))
    elems.append(Paragraph(
        "La verificacion en dos pasos (Multi-Factor Authentication, MFA) es una capa adicional de "
        "seguridad. Ademas de la contraseña, pide un codigo de 6 digitos que cambia cada 30 segundos "
        "y se genera en el telefono del usuario mediante una aplicacion autenticadora. <b>Solo los "
        "administradores pueden activar MFA</b>; los empleados no, porque su acceso ya es de solo lectura "
        "sobre su propia informacion.", STY_BODY))
    elems.append(Paragraph(
        "MFA es <b>opcional pero muy recomendado</b> para administradores. Si un administrador no lo "
        "tiene activado y alguien roba su contraseña, el atacante podria entrar al sistema. Con MFA "
        "activado, el atacante necesitaria ademas el telefono del administrador.", STY_BODY))

    elems.append(Paragraph("Como activar MFA (3 pasos)", STY_H3))
    elems.append(step_list([
        ("Paso 1: Escanear el codigo QR",
         "Vaya a 'Configuracion' y pulse 'Activar MFA'. Aparecera un codigo QR. Abra su aplicacion "
         "autenticadora (Google Authenticator, Authy, 1Password) y escanee el codigo. La app empezara "
         "a generar codigos de 6 digitos que cambian cada 30 segundos."),
        ("Paso 2: Verificar",
         "Escriba el codigo de 6 digitos que muestra la app en este momento. Si el codigo es correcto, "
         "MFA queda activado."),
        ("Paso 3: Guardar los codigos de respaldo",
         "El sistema le mostrara 10 codigos de respaldo. <b>Guardelos en un lugar seguro</b> (por "
         "ejemplo, imprimidos en una caja fuerte). Si pierde su telefono, podra usar uno de estos "
         "codigos en lugar del codigo de la app. Cada codigo solo se puede usar una vez."),
    ]))

    elems.append(flow_diagram([
        ("Inicio de sesion con correo y contraseña", 'process'),
        ("¿Tiene MFA activado?", 'decision'),
        ("Pedir codigo de 6 digitos (app) o codigo de respaldo", 'process'),
        ("¿Codigo correcto?", 'decision'),
        ("Sesion iniciada · Registro en auditoria", 'success'),
        ("Tras 5 intentos fallidos: bloqueo 15 minutos", 'error'),
    ], title="Flujo de inicio de sesion (con MFA)"))

    elems.append(callout(
        "Si pierde su telefono y no tiene los codigos de respaldo, contacte al Administrador General. "
        "Un administrador puede desactivar MFA de su cuenta, pero la accion quedara registrada en la "
        "bitacora de auditoria.", 'warning'))
    elems += section_divider()
    return elems

def section_panel_empleado():
    elems = []
    elems.append(PageBreak())
    elems.append(Paragraph("5. Panel del Empleado", STY_H1))
    elems.append(Paragraph(
        "El empleado ve una interfaz simplificada con cuatro botones en la parte inferior: "
        "<b>Asistencia</b>, <b>Historial</b>, <b>Vacaciones</b> y <b>Mi QR</b>. No ve informacion de "
        "otros empleados ni pantallas administrativas. Esta seccion explica cada uno.", STY_BODY))

    elems.append(Paragraph("5.1 Registrar Asistencia", STY_H2))
    elems.append(Paragraph(
        "Aqui el empleado registra su entrada, salida y los periodos de comida. El sistema puede "
        "funcionar de dos modos: por GPS (el navegador pide la ubicacion del dispositivo) o por QR "
        "(el empleado escanea un codigo con la camara o lo pega manualmente).", STY_BODY))
    elems.append(step_list([
        ("Seleccione el modo",
         "Pulse el boton 'GPS' o 'QR' segun como vaya a registrarse."),
        ("Seleccione la accion",
         "Elija si va a registrar entrada, salida, inicio de comida o fin de comida."),
        ("Pulse el boton de registro",
         "Si es modo GPS, el navegador le pedira permiso para usar su ubicacion. Aceptelo. Si es modo "
         "QR, escanee el codigo de la terminal o peguelo manualmente."),
        ("Confirme",
         "El sistema le mostrara la hora exacta del registro y la ubicacion capturada. El registro "
         "queda guardado y ya no puede modificarse."),
    ]))
    elems.append(callout(
        "El GPS es <b>obligatorio</b> en modo GPS. Si el empleado no activa los servicios de ubicacion "
        "de su dispositivo o no concede permiso al navegador, no podra registrar su asistencia. Esto "
        "cumple el requisito de la NOM-037 de verificar la ubicacion del registro.", 'warning'))

    elems.append(Paragraph("5.2 Mi Historial", STY_H2))
    elems.append(Paragraph(
        "Aqui el empleado puede ver todos sus registros de asistencia, filtrados por dia, semana o mes. "
        "La tabla muestra la fecha, la hora de entrada, el inicio y fin de comida, la hora de salida, "
        "el estado (presente, retardo, etc.), las horas trabajadas y las horas extra (separadas en "
        "dobles y triples). Tambien puede descargar su historial en formato CSV (compatible con Excel).", STY_BODY))
    elems.append(callout(
        "El empleado <b>no necesita pedir permiso al patron</b> para ver o descargar su historial. "
        "Esto cumple el articulo 804 de la LFT y la NOM-037, que garantizan el acceso del trabajador "
        "a sus propios registros de jornada.", 'success'))

    elems.append(Paragraph("5.3 Mis Vacaciones y Permisos", STY_H2))
    elems.append(Paragraph(
        "El empleado puede solicitar vacaciones o permisos (por incapacidad, maternidad, paternidad u "
        "otros) y ver el saldo de dias que le corresponden. La pantalla muestra cuatro numeros: dias "
        "totales, dias usados, dias pendientes de aprobacion y dias disponibles.", STY_BODY))
    elems.append(step_list([
        ("Pulse 'Nueva solicitud'",
         "Se abrira un formulario."),
        ("Seleccione el tipo",
         "Vacaciones, Permiso, Incapacidad, Maternidad, Paternidad u Otro."),
        ("Seleccione las fechas",
         "Fecha de inicio y fecha de fin. Si es un permiso por horas dentro de un dia, marque la "
         "casilla 'Parcial' y especifique la hora de inicio y fin."),
        ("Escriba un motivo (opcional)",
         "Puede anadir un comentario para que el administrador sepa el motivo."),
        ("Pulse 'Enviar'",
         "La solicitud queda en estado 'Pendiente'. El administrador la aprobara o rechazara. Puede "
         "cancelarla mientras este pendiente."),
    ]))
    elems.append(callout(
        "Cuando el administrador aprueba unas vacaciones, el sistema <b>descuenta automaticamente</b> "
        "los dias del saldo del empleado. Esto cumple el articulo 76 de la LFT, que regula el derecho "
        "a vacaciones y su calculo.", 'legal'))

    elems.append(Paragraph("5.4 Mi QR personal", STY_H2))
    elems.append(Paragraph(
        "Cada empleado tiene un codigo QR unico y personal. Puede verlo en esta pantalla y descargarlo "
        "como imagen PNG para imprimirlo o tenerlo en el telefono. El QR personal se usa en la terminal "
        "QR del centro de trabajo: el empleado lo muestra y el administrador lo escanea para registrar "
        "su asistencia.", STY_BODY))
    elems.append(flow_diagram([
        ("El empleado abre 'Mi QR'", 'process'),
        ("Muestra el codigo en su pantalla", 'process'),
        ("El admin lo escanea en la Terminal QR", 'process'),
        ("El sistema registra la asistencia con GPS", 'accent'),
        ("El registro queda inalterable en el historial", 'success'),
    ], title="Uso del QR personal"))
    elems += section_divider()
    return elems

def section_panel_admin():
    elems = []
    elems.append(PageBreak())
    elems.append(Paragraph("6. Panel del Administrador", STY_H1))
    elems.append(Paragraph(
        "El panel del administrador tiene 13 secciones, accesibles desde el menu lateral. El "
        "administrador general ve todas; el de sucursal ve solo las de su sucursal; el supervisor ve "
        "solo las de consulta. Esta seccion describe cada una.", STY_BODY))

    # 6.1 Dashboard
    elems.append(Paragraph("6.1 Dashboard (Panel principal)", STY_H2))
    elems.append(Paragraph(
        "Es la pantalla inicial. Muestra un resumen en tiempo real de la asistencia del dia: total de "
        "empleados, presentes, retardos, ausentes, horas extra dobles y triples del dia, y dias de "
        "descanso trabajados. Incluye una tabla con todas las asistencias del dia y una lista de "
        "ausentes. El administrador general puede filtrar por sucursal; el de sucursal solo ve la suya.", STY_BODY))
    elems.append(Paragraph(
        "Si un registro tiene un error (por ejemplo, el empleado escaneo dos veces la entrada), el "
        "administrador puede corregirlo desde aqui. La hora original no se borra: se anade una "
        "correccion con el motivo, y todo queda registrado en la bitacora de auditoria.", STY_BODY))

    # 6.2 Empleados
    elems.append(Paragraph("6.2 Empleados", STY_H2))
    elems.append(Paragraph(
        "Gestion del personal. Aqui se crean, editan y desactivan empleados. Para cada empleado se "
        "capturan: nombre, correo, numero de empleado, posicion, departamento, sucursal asignada, RFC, "
        "CURP, contraseña y horario semanal.", STY_BODY))
    elems.append(Paragraph("El horario semanal se configura dia por dia con tres opciones:", STY_BODY))
    elems.append(Paragraph(
        "<b>Trabaja</b> — El empleado trabaja ese dia, con hora de entrada y salida.<br/>"
        "<b>Descanso semanal</b> — Dia de descanso obligatorio (art. 71 LFT).<br/>"
        "<b>No laborable</b> — El empleado no trabaja ese dia (por ejemplo, domingo).", STY_CALLOUT))
    elems.append(callout(
        "El sistema <b>no permite guardar</b> un horario si no tiene al menos un dia marcado como "
        "'Descanso semanal'. Si lo intenta, vera el mensaje: 'El horario debe incluir al menos 1 dia "
        "de descanso semanal (art. 71 LFT)'. Esto obliga al cumplimiento de la ley.", 'legal'))

    elems.append(Paragraph("Acciones por empleado:", STY_H3))
    elems.append(Paragraph(
        "<b>Editar</b> · <b>Ver QR</b> (descarga el codigo QR personal como PNG) · <b>Horario</b> "
        "(abre el editor de horario semanal) · <b>Transferir</b> (solo admin general, mueve al "
        "empleado a otra sucursal) · <b>Activar/Desactivar</b> (un empleado desactivado no puede "
        "iniciar sesion pero sus registros historicos se conservan).", STY_BODY))

    # 6.3 Sucursales
    elems.append(Paragraph("6.3 Sucursales", STY_H2))
    elems.append(Paragraph(
        "Gestion de los centros de trabajo. Cada sucursal tiene: nombre, codigo de local, direccion, "
        "ubicacion GPS (latitud y longitud), radio de geocerca (en metros) y configuracion de "
        "tolerancias (de comida, descanso y salida).", STY_BODY))
    elems.append(Paragraph(
        "La <b>geocerca</b> es el area dentro de la cual un registro se considera valido. Si un "
        "empleado registra su entrada a 50 metros de la sucursal y la geocerca es de 100 metros, el "
        "registro se marca como 'validado'. Si esta a 200 metros, se marca como 'no validado' (pero "
        "el registro se guarda, con la evidencia de la ubicacion).", STY_BODY))
    elems.append(callout(
        "El admin general puede crear, editar y eliminar sucursales. El admin de sucursal solo puede "
        "editar los datos de su propia sucursal. Esta separacion cumple el articulo 132 de la LFT, "
        "que exige el control por centro de trabajo.", 'legal'))

    # 6.4 Usuarios y Roles
    elems.append(Paragraph("6.4 Usuarios y Roles", STY_H2))
    elems.append(Paragraph(
        "Solo el administrador general ve esta seccion. Aqui se gestionan los usuarios del sistema "
        "(no los empleados: un usuario es quien puede iniciar sesion, un empleado es quien registra "
        "asistencia). Puede crear usuarios, asignarles rol, restablecer contraseñas, desbloquear "
        "cuentas bloqueadas por intentos fallidos, y activar o desactivar usuarios.", STY_BODY))

    # 6.5 Vacaciones y Permisos
    elems.append(Paragraph("6.5 Vacaciones y Permisos", STY_H2))
    elems.append(Paragraph(
        "Gestion de vacaciones y permisos de los empleados. Tres pestanas:", STY_BODY))
    elems.append(Paragraph(
        "<b>Pendientes:</b> Lista de solicitudes pendientes. Cada una tiene un boton 'Aprobar' y "
        "otro 'Rechazar' (el rechazo requiere un motivo). Al aprobar vacaciones, el sistema descuenta "
        "automaticamente los dias del saldo del empleado.<br/><br/>"
        "<b>Historial:</b> Todas las solicitudes (aprobadas, rechazadas, canceladas), con filtros por "
        "empleado, tipo, estado y rango de fechas. Muestra si la solicitud la hizo el empleado "
        "('Solicitud') o la otorgo directamente el administrador ('Otorgado').<br/><br/>"
        "<b>Saldos:</b> Tabla con el saldo de vacaciones de cada empleado: dias totales, usados, "
        "pendientes y disponibles.", STY_CALLOUT))
    elems.append(Paragraph(
        "El administrador tambien puede <b>otorgar vacaciones o permisos directamente</b>, sin que el "
        "empleado lo haya solicitado. Esto es util para dias festivos, permisos patronales o "
        "incapacidades. Estas solicitudes nacen en estado 'Aprobado' y, si son de tipo vacaciones, "
        "descuentan el saldo automaticamente.", STY_BODY))

    # 6.6 Historial
    elems.append(Paragraph("6.6 Historial", STY_H2))
    elems.append(Paragraph(
        "Consulta de todos los registros de asistencia, con filtros por periodo (dia, semana, mes), "
        "sucursal, estado (presente, retardo, ausente, etc.) y busqueda por empleado. Se puede "
        "exportar a CSV. Si busca un empleado especifico, se abre una tarjeta con su historial de "
        "30 dias.", STY_BODY))

    # 6.7 Reportes
    elems.append(Paragraph("6.7 Reportes", STY_H2))
    elems.append(Paragraph(
        "Generacion de reportes para analisis y nomina. Hay cinco tipos de reporte (el comparativo "
        "solo lo ve el admin general):", STY_BODY))
    elems.append(data_table(
        ["Reporte", "Que incluye", "Para que sirve"],
        [
            ("Diario", "Resumen de asistencias, retardos, ausencias y horas extra del periodo",
             "Control diario de la operacion"),
            ("Horas Extra", "Detalle de horas extra dobles y triples por empleado",
             "Calculo de nomina (arts. 66, 67, 68 LFT)"),
            ("Ausencias", "Listado de empleados ausentes con estadisticas",
             "Control de faltas y descuentos"),
            ("Incidencias", "Retardos, salidas anticipadas, dias de descanso trabajados",
             "Gestion disciplinaria y prima del 100% (art. 73)"),
            ("Comparativa", "Comparacion entre sucursales (solo admin general)",
             "Toma de decisiones gerenciales"),
        ],
        col_widths=[3.2*cm, 6.5*cm, 6.3*cm]))
    elems.append(Paragraph(
        "Todos los reportes se pueden ver en pantalla, exportar a CSV (compatible con Excel) o "
        "exportar a XLSX. El admin general puede filtrar por sucursal; los demas ven solo su sucursal.", STY_BODY))

    # 6.8 Alertas NOM-035
    elems.append(Paragraph("6.8 Alertas NOM-035", STY_H2))
    elems.append(Paragraph(
        "Aqui se ven las alertas automaticas que genera el sistema cuando detecta un riesgo "
        "psicosocial por exceso de horas. Hay cinco tipos de alerta:", STY_BODY))
    elems.append(data_table(
        ["Tipo de alerta", "Se genera cuando...", "Nivel"],
        [
            ("Exceso semanal", "Un empleado supera las 9 horas extra en la semana (tope 2027)",
             "Alta"),
            ("Exceso diario", "Un empleado hace muchas horas extra en un solo dia", "Media"),
            ("Dias largos consecutivos", "Varios dias seguidos con jornadas muy largas", "Media"),
            ("Sin dia de descanso", "El empleado trabajo toda la semana sin descansar", "Alta"),
            ("Descanso trabajado", "El empleado registro asistencia en su dia de descanso",
             "Alta si es domingo / Media"),
        ],
        col_widths=[4*cm, 8.5*cm, 3.5*cm]))
    elems.append(callout(
        "Una <b>campana de notificaciones</b> en la parte superior derecha de la pantalla muestra "
        "cuantas alertas hay activas, con un contador en rojo si hay alertas de nivel alto. La campana "
        "se actualiza automaticamente cada minuto.", 'info'))

    # 6.9 Auditoria
    elems.append(Paragraph("6.9 Auditoria", STY_H2))
    elems.append(Paragraph(
        "Bitacora completa de todas las acciones realizadas en el sistema. Cada entrada incluye: "
        "usuario que hizo la accion, fecha y hora, direccion IP, tipo de accion y detalles. Se pueden "
        "filtrar por tipo de accion, usuario, fecha y sucursal.", STY_BODY))
    elems.append(Paragraph(
        "Hay mas de 30 tipos de accion registrados, entre ellos: inicio de sesion (correcto y "
        "fallido), registro de entrada y salida, creacion y edicion de empleados, transferencias, "
        "aprobacion y rechazo de vacaciones, correcciones de registros, generacion de QR, activacion "
        "y desactivacion de MFA, aceptacion del aviso de privacidad, solicitudes ARCO, y alertas "
        "NOM-035 generadas automaticamente.", STY_BODY))
    elems.append(callout(
        "Los registros de auditoria son <b>inmutables</b>: nadie, ni siquiera el administrador "
        "general, puede modificarlos o eliminarlos. Esto garantiza la trazabilidad completa para "
        "cualquier inspeccion de la STPS o demanda laboral.", 'success'))

    # 6.10 Terminal QR
    elems.append(Paragraph("6.10 Terminal QR", STY_H2))
    elems.append(Paragraph(
        "Pantalla diseñada para mostrarse en un monitor o tablet en la entrada del centro de trabajo. "
        "Muestra un codigo QR dinamico que se regenera automaticamente cada 5 minutos. Los empleados "
        "lo escanean para registrar su asistencia.", STY_BODY))
    elems.append(Paragraph(
        "Hay un <b>Modo kiosco</b> que muestra el QR en pantalla completa (sin menus ni botones), "
        "pensado para una tablet montada en la pared. Tambien se puede descargar el QR como imagen "
        "PNG.", STY_BODY))
    elems.append(callout(
        "El QR se genera localmente en el navegador, no se envia a ningun servicio externo. Esto "
        "garantiza que el token de validacion no salga del dispositivo del administrador.", 'info'))

    # 6.11 Empresa y Feriados
    elems.append(Paragraph("6.11 Empresa y Feriados", STY_H2))
    elems.append(Paragraph(
        "Solo el admin general ve esta seccion. Aqui se configuran los datos de la empresa (razon "
        "social, RFC, registro patronal, domicilio fiscal, telefono, correo, representante legal y "
        "logotipo) y los dias feriados del año. Hay un boton para cargar automaticamente los dias "
        "feriados oficiales de Mexico del 2027.", STY_BODY))

    # 6.12 Documentacion
    elems.append(Paragraph("6.12 Documentacion", STY_H2))
    elems.append(Paragraph(
        "Enlaces de descarga para este manual, el documento de cumplimiento LFT 2027, la "
        "recomendacion de infraestructura y cinco diagramas del sistema (arquitectura, flujo de "
        "procesos, activacion de MFA, uso del codigo QR y puesta en marcha).", STY_BODY))

    # 6.13 Configuracion
    elems.append(Paragraph("6.13 Configuracion", STY_H2))
    elems.append(Paragraph(
        "Aqui el administrador gestiona su propia verificacion en dos pasos (MFA). Puede activarla "
        "(siguiendo los 3 pasos descritos en la seccion 4.3), desactivarla (necesita un codigo TOTP "
        "valido o un codigo de respaldo), y descargar de nuevo los codigos de respaldo si los perdio.", STY_BODY))
    elems += section_divider()
    return elems

def section_cumplimiento_detalle():
    elems = []
    elems.append(PageBreak())
    elems.append(Paragraph("7. Cumplimiento Legal Detallado", STY_H1))
    elems.append(Paragraph(
        "Esta tabla cruza cada funcion del sistema con el articulo de ley que cumple. Use esta tabla "
        "como referencia rapida si necesita justificar el cumplimiento ante una auditoria.", STY_BODY))

    headers = ["Funcion del sistema", "Articulo de ley", "Como se cumple"]
    rows = [
        ("Registro electronico de entrada/salida/comida",
         "Art. 132 fr. XXXIV LFT (Reforma 2027)",
         "Cada registro se captura con hora exacta, no editable por el trabajador"),
        ("Conservacion de registros 12 meses",
         "Art. 804 LFT",
         "Base de datos permanente; consulta y exportacion hasta 366 dias por reporte"),
        ("Asignacion manual de horario semanal",
         "Art. 61 LFT",
         "El patron define dia a dia si trabaja, descansa o no labora, con horas"),
        ("Calculo automatico de horas extra dobles",
         "Art. 66 LFT",
         "Las primeras 9 h extra/semana se calculan y reportan al doble"),
        ("Calculo automatico de horas extra triples",
         "Arts. 67 y 68 LFT",
         "Las horas extra que excedan 9/semana se calculan y reportan al triple"),
        ("Tope de 9 horas extra semanales (2027)",
         "Transitorio Cuarto DOF 1-may-2026",
         "Alerta automatica NOM-035 si se excede el tope"),
        ("Dia de descanso semanal obligatorio",
         "Arts. 69 y 71 LFT",
         "El sistema bloquea el alta/edicion si no hay dia de descanso marcado"),
        ("Deteccion de descanso trabajado + prima del 100%",
         "Art. 73 LFT",
         "El sistema detecta registros en dias de descanso, calcula restDayPremiumMinutes, "
         "marca isSunday y genera alerta NOM-035"),
        ("Registros inalterables",
         "NOM-037 y Reforma LFT 2027",
         "Hora original bloqueada; correcciones dejan rastro en auditoria"),
        ("Acceso del trabajador a sus registros",
         "Art. 804 LFT + NOM-037",
         "El empleado ve y exporta su historial sin intermediarios"),
        ("Alertas por exceso de horas",
         "NOM-035-STPS-2018",
         "Alertas automaticas (alta/media/baja) con recomendacion y referencia legal"),
        ("Geolocalizacion del registro",
         "NOM-037-STPS-2023",
         "GPS capturado en cada registro; validacion contra radio de sucursal"),
        ("Autenticacion segura del usuario",
         "Espritu Reforma LFT 2027",
         "Correo + contraseña encriptada + MFA opcional + QR personal"),
        ("Control multi-sucursal",
         "Art. 132 LFT + NOM-037",
         "Sucursales con GPS propio; empleados asignados a una sucursal"),
        ("Reportes exportables PDF/Excel",
         "Art. 804 LFT",
         "Reportes por rango, empleado, sucursal; formatos CSV y XLSX"),
        ("Bitacora de auditoria",
         "Espritu NOM-035 + Reforma LFT 2027",
         "Trazabilidad de acciones con usuario, IP, fecha y detalle"),
        ("Registro de vacaciones y permisos",
         "Art. 76 LFT",
         "Solicitudes, aprobaciones y saldo de dias registrados"),
        ("Códigos de respaldo MFA",
         "Buena practica de seguridad",
         "Códigos de un solo uso si se pierde el telefono"),
        ("Consentimiento de privacidad",
         "LFPDPPP art. 17",
         "Modal bloqueante + privacyAcceptedAt/Version/Ip"),
        ("Versionado del aviso de privacidad",
         "LFPDPPP art. 16",
         "Si la version cambia, se fuerza re-consentimiento"),
        ("Derecho de acceso (descargar mis datos)",
         "LFPDPPP art. 29",
         "Endpoint /api/user/mydata descarga JSON con todos los datos"),
        ("Derecho de rectificacion",
         "LFPDPPP art. 30",
         "Solicitud ARCO tipo RECTIFICATION"),
        ("Derecho de cancelacion (anonimizacion)",
         "LFPDPPP art. 31 + LFT art. 804",
         "Anonimiza datos identificativos; conserva registros 12 meses"),
        ("Derecho de oposicion",
         "LFPDPPP art. 32",
         "Solicitud ARCO tipo OPPOSITION"),
        ("Plazo legal 20 dias habiles para ARCO",
         "LFPDPPP art. 100",
         "El sistema calcula daysRemaining y marca isOverdue"),
    ]
    elems.append(data_table(headers, rows, col_widths=[5*cm, 4*cm, 7*cm]))
    elems += section_divider()
    return elems

def section_faq():
    elems = []
    elems.append(PageBreak())
    elems.append(Paragraph("8. Preguntas Frecuentes", STY_H1))

    faqs = [
        ("¿Que pasa si un empleado olvida registrar su salida?",
         "El registro queda como 'pendiente' y el sistema lo marca automaticamente como ausencia "
         "parcial. El administrador puede documentar la correccion a traves del proceso de auditoria, "
         "pero la hora original no se borra: se anade una correccion con el motivo."),
        ("¿Los empleados pueden registrar asistencia desde cualquier ubicacion?",
         "Tecnicamente pueden intentar registrar desde cualquier ubicacion, pero el sistema captura "
         "las coordenadas GPS en cada registro. Si estan fuera del radio de la sucursal, el registro "
         "se marca como 'no validado' y queda visible en los reportes para revision del administrador."),
        ("¿Con que frecuencia se actualiza el QR de la terminal?",
         "Cada 5 minutos. Los codigos expirados no son validos para el registro de asistencia. Esto "
         "evita que alguien fotografie el codigo y lo use despues."),
        ("¿Como se calculan las horas extra los sabados?",
         "El sistema calcula las horas extra respecto al horario configurado para cada dia. Para "
         "lunes a viernes, la jornada estandar es de 8 horas. Para sabado, el horario por defecto es "
         "de 09:00 a 14:00 (5 horas). Las horas extra se pagan al doble las primeras 9 de la semana "
         "(art. 66 LFT) y al triple las que excedan de 9 (arts. 67 y 68 LFT)."),
        ("¿Se pueden modificar los registros de asistencia?",
         "No. Los registros son inalterables por diseno, cumpliendo con la NOM-037 y la Reforma LFT "
         "2027. Si se necesita corregir un error, el sistema conserva la hora original y anade una "
         "correccion documentada con el nombre del administrador, la fecha, el motivo y la IP."),
        ("¿Que pasa si un empleado no tiene GPS en su dispositivo?",
         "La geolocalizacion es obligatoria en modo GPS. Sin acceso GPS, el sistema no permitira "
         "registrar entrada ni salida. Asegurese de que los empleados tengan activados los servicios "
         "de ubicacion y hayan concedido permiso al navegador. Como alternativa, pueden usar el modo "
         "QR (que tambien registra la ubicacion si esta disponible)."),
        ("¿Como funcionan los reportes por sucursal?",
         "Cada empleado esta asignado a una sucursal. Al generar un reporte, el admin general puede "
         "filtrar por sucursal para ver unicamente los datos del centro de trabajo seleccionado. Si "
         "no selecciona ninguna, el reporte incluye todas. El admin de sucursal y el supervisor solo "
         "ven su propia sucursal."),
        ("¿Cuanto tiempo se conservan los datos?",
         "Los registros de asistencia se conservan de forma indefinida, superando el minimo legal de "
         "12 meses que exige el articulo 804 de la LFT. Cuando se ejerce el derecho de cancelacion "
         "(LFPDPPP art. 31), los datos identificativos se anonimizan pero los registros de asistencia "
         "se conservan anonimamente durante 12 meses."),
        ("¿Como se crea un nuevo empleado?",
         "Desde el panel del administrador, seccion 'Empleados', pulse 'Crear Empleado'. Complete los "
         "datos personales, posicion, departamento, sucursal asignada y configure los horarios de "
         "trabajo. El sistema generara automaticamente un codigo QR personal y las credenciales de "
         "acceso para el empleado."),
        ("¿El sistema funciona sin conexion a internet?",
         "No. El sistema requiere conexion a internet para funcionar, ya que los registros se "
         "almacenan en un servidor central que garantiza la inalterabilidad y disponibilidad de los "
         "datos. Sin conexion, no es posible registrar asistencia ni consultar el historial."),
        ("¿Que hago si pierdo mi telefono con el autenticador?",
         "Use uno de los 10 codigos de respaldo que guardo al activar MFA. Cada codigo sirve para un "
         "inicio de sesion. Si tambien perdio los codigos de respaldo, contacte al Administrador "
         "General, que puede desactivar MFA de su cuenta (la accion quedara registrada en auditoria)."),
        ("¿Puedo solicitar vacaciones desde mi telefono?",
         "Si. El sistema funciona en cualquier dispositivo con navegador web: telefono, tablet o "
         "computadora. El empleado puede solicitar vacaciones, ver su historial y descargar su QR "
         "desde su telefono movil."),
        ("¿El aviso de privacidad cambia alguna vez?",
         "Puede cambiar si la empresa modifica como trata los datos personales (por ejemplo, si "
         "empieza a compartirlos con un nuevo proveedor). Cuando el aviso cambia, la version sube "
         "(de '1.0' a '1.1', por ejemplo) y todos los usuarios deben aceptar el nuevo aviso en su "
         "proximo inicio de sesion."),
        ("¿Quien puede ver mis datos personales?",
         "Solo el administrador general y el administrador de su sucursal pueden ver sus datos. El "
         "supervisor solo ve la informacion operativa (asistencia, retardos), no sus datos "
         "personales. Otros empleados no ven nada suyo. Usted mismo puede descargar todos sus datos "
         "en formato JSON desde la pagina de derechos ARCO."),
    ]
    for i, (q, a) in enumerate(faqs, 1):
        elems.append(Paragraph(f"<b>{i}. {q}</b>", STY_H3))
        elems.append(Paragraph(a, STY_BODY))
    elems += section_divider()
    return elems

def section_glosario():
    elems = []
    elems.append(PageBreak())
    elems.append(Paragraph("9. Glosario de Terminos", STY_H1))
    elems.append(Paragraph(
        "Si encuentra una palabra que no conoce en este manual, busquela aqui. Los terminos estan "
        "ordenados alfabeticamente.", STY_BODY))

    glosario = [
        ("ARCO",
         "Acrónimo de Acceso, Rectificacion, Cancelacion y Oposicion. Son los cuatro derechos que "
         "tiene toda persona sobre sus datos personales, segun la LFPDPPP."),
        ("Auditoria (bitacora de)",
         "Registro chronological de todas las acciones importantes que se hacen en el sistema, con "
         "quien, cuando y desde donde (direccion IP). No se puede modificar ni borrar."),
        ("Autenticador (app)",
         "Aplicacion de telefono que genera codigos de 6 digitos que cambian cada 30 segundos. "
         "Ejemplos: Google Authenticator, Authy, 1Password. Se usa para la verificacion en dos pasos."),
        ("Cookie",
         "Pequeño archivo que el sistema guarda en el navegador para recordar quien inicio sesion. "
         "Las cookies de este sistema estan protegidas (httpOnly) y no pueden ser robadas por scripts "
         "maliciosos."),
        ("CSV",
         "Formato de archivo de texto donde los datos estan separados por comas. Se abre con Excel, "
         "Google Sheets o cualquier hoja de calculo."),
        ("Geocerca",
         "Area circular alrededor de la sucursal (definida por un radio en metros) dentro de la cual "
         "un registro de asistencia se considera valido."),
        ("GPS",
         "Sistema de posicionamiento que indica en que lugar fisico (latitud y longitud) se encuentra "
         "un dispositivo."),
        ("Horas extra dobles",
         "Las primeras 9 horas extra de la semana, pagadas al doble del salario ordinario (art. 66 LFT)."),
        ("Horas extra triples",
         "Las horas extra que exceden de 9 a la semana, pagadas al triple del salario ordinario "
         "(arts. 67 y 68 LFT)."),
        ("LFPDPPP",
         "Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares. Regula el "
         "tratamiento de datos personales en Mexico."),
        ("LFT",
         "Ley Federal del Trabajo. La ley laboral principal de Mexico."),
        ("MFA",
         "Multi-Factor Authentication (autenticacion en dos pasos). Medida de seguridad que pide, "
         "ademas de la contraseña, un codigo del telefono."),
        ("NOM",
         "Norma Oficial Mexicana. NOM-037 regula el trabajo a distancia; NOM-035 regula los riesgos "
         "psicosociales."),
        ("NOM-035",
         "Norma que obliga a identificar factores de riesgo psicosocial, entre ellos las jornadas "
         "excesivas. El sistema genera alertas automaticas cuando detecta riesgos."),
        ("NOM-037",
         "Norma que regula el trabajo a distancia. Exige verificar la ubicacion del registro de "
         "asistencia y que los registros sean inalterables."),
        ("QR",
         "Codigo de barras cuadrado que, al escanearse con la camara, identifica a una persona o accion."),
        ("STPS",
         "Secretaria del Trabajo y Prevision Social. Es la autoridad laboral en Mexico que puede "
         "inspeccionar el cumplimiento de la LFT y las NOM."),
        ("TOTP",
         "Time-based One-Time Password. Es el algoritmo que usan las apps autenticadoras para "
         "generar codigos de 6 digitos que cambian cada 30 segundos."),
        ("Trazabilidad",
         "Capacidad de seguir el rastro de una accion hasta su origen. En este sistema, toda accion "
         "se puede rastrear hasta el usuario que la hizo, cuando y desde donde."),
        ("XLSX",
         "Formato de archivo de Microsoft Excel. Es el formato nativo para hojas de calculo."),
    ]
    headers = ["Termino", "Definicion"]
    rows = [(t, d) for t, d in glosario]
    elems.append(data_table(headers, rows, col_widths=[3.5*cm, 12.5*cm]))

    elems.append(Spacer(1, 20))
    elems.append(Paragraph(
        "<b>¿Necesita mas ayuda?</b> Contacte al Administrador General de su sistema. Si tiene dudas "
        "sobre el cumplimiento legal especifico de algun articulo, consulte la seccion 7 de este "
        "manual o el documento 'Cumplimiento LFT 2027' disponible en la seccion Documentacion del "
        "sistema.", STY_BODY))
    elems.append(Spacer(1, 30))
    elems.append(HRFlowable(width='100%', thickness=1, color=ACCENT, spaceBefore=10, spaceAfter=10))
    elems.append(Paragraph(
        "Sistema de Control de Asistencia v3.0 · Cumple Reforma LFT 2027, NOM-037-STPS-2023, "
        "NOM-035-STPS-2018 y LFPDPPP · Registros inalterables · Autenticacion dual · Geolocalizacion "
        "GPS · Multi-sucursal", ParagraphStyle('end', fontName=FONT_ITAL, fontSize=9,
        textColor=TEXT_MUTED, alignment=TA_CENTER, leading=13)))
    return elems

# ============================================================
# BUILD PDF
# ============================================================
def build_pdf(output_path):
    page_w, page_h = A4

    doc = BaseDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=1.8*cm, rightMargin=1.8*cm,
        topMargin=1.6*cm, bottomMargin=1.8*cm,
        title="Manual de Usuario - Control de Asistencia v3.0",
        author="Control de Asistencia",
        subject="Manual operativo del sistema de Control de Asistencia",
        creator="Control de Asistencia v3.0",
    )

    # Frame for cover (full page, no margins)
    cover_frame = Frame(0, 0, page_w, page_h, id='cover',
                        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    # Frame for content pages
    content_frame = Frame(1.8*cm, 1.6*cm, page_w - 3.6*cm, page_h - 3.4*cm, id='content',
                          leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)

    cover_template = PageTemplate(id='cover', frames=[cover_frame], onPage=cover_chrome)
    content_template = PageTemplate(id='content', frames=[content_frame], onPage=add_page_chrome)
    doc.addPageTemplates([cover_template, content_template])

    story = []
    # Cover
    story.append(CoverPage(page_w, page_h))
    story.append(NextPageTemplate('content'))
    story.append(PageBreak())

    # Table of Contents (manual)
    story.append(Paragraph("Tabla de Contenido", STY_H1))
    toc_items = [
        ("1. Introduccion y Bienvenida", "3"),
        ("2. Marco Legal de Cumplimiento", "4"),
        ("3. Roles del Sistema", "6"),
        ("4. Primeros Pasos", "8"),
        ("5. Panel del Empleado", "11"),
        ("6. Panel del Administrador", "13"),
        ("7. Cumplimiento Legal Detallado", "19"),
        ("8. Preguntas Frecuentes", "22"),
        ("9. Glosario de Terminos", "25"),
    ]
    toc_rows = []
    for title, page in toc_items:
        toc_rows.append([
            Paragraph(title, ParagraphStyle('toc', fontName=FONT_REG, fontSize=11,
                       textColor=TEXT_PRIMARY, leading=16)),
            Paragraph(page, ParagraphStyle('tocp', fontName=FONT_BOLD, fontSize=11,
                       textColor=ACCENT, alignment=TA_RIGHT, leading=16)),
        ])
    toc_table = Table(toc_rows, colWidths=[14*cm, 2*cm])
    toc_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LINEBELOW', (0,0), (-1,-1), 0.25, BORDER),
    ]))
    story.append(toc_table)
    story.append(Spacer(1, 20))
    story.append(callout(
        "Este manual describe la version 3.0 del sistema, que incluye la verificacion en dos pasos "
        "(MFA), el modulo de vacaciones y permisos, el cumplimiento de la LFPDPPP (aviso de "
        "privacidad, derechos ARCO, descarga de datos personales) y la deteccion automatica de "
        "riesgos psicosociales (NOM-035).", 'info'))

    # Sections
    story += section_introduccion()
    story += section_marco_legal()
    story += section_roles()
    story += section_primeros_pasos()
    story += section_panel_empleado()
    story += section_panel_admin()
    story += section_cumplimiento_detalle()
    story += section_faq()
    story += section_glosario()

    doc.build(story)
    print(f"PDF generado: {output_path}")
    print(f"Tamano: {os.path.getsize(output_path) / 1024:.1f} KB")

if __name__ == '__main__':
    output = '/home/z/my-project/public/documentos/manual-usuario-v3.0.pdf'
    build_pdf(output)
