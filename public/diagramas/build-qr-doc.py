#!/usr/bin/env python3
"""Build the standalone HTML "Uso del Código QR" employee guide.

Reads the 4 real screenshots from /home/z/my-project/public/screenshots/,
encodes them as base64 data URLs, and writes a fully self-contained HTML
file with inline CSS and embedded images to
/home/z/my-project/public/diagramas/uso-codigo-qr.html.
"""
import base64
import datetime as dt
from pathlib import Path

SCREENSHOTS_DIR = Path("/home/z/my-project/public/screenshots")
OUT_HTML = Path("/home/z/my-project/public/diagramas/uso-codigo-qr.html")

# (filename, alt_text, max_width_css_px)
IMAGES = [
    ("qr-terminal.png",         "Terminal QR del administrador",            560),
    ("employee-qr-tab.png",     "Vista del empleado — pestaña QR, escanear", 600),
    ("employee-qr-manual.png",  "Vista del empleado — sub-pestaña Manual",   600),
    ("employee-my-qr.png",      "Vista del empleado — Mi QR personal",       560),
]


def b64_img(filename: str) -> str:
    p = SCREENSHOTS_DIR / filename
    data = p.read_bytes()
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:image/png;base64,{b64}"


def main() -> None:
    today = dt.date.today().strftime("%d/%m/%Y")
    iso_today = dt.date.today().isoformat()

    # Pre-encode all images
    img = {fname: b64_img(fname) for fname, _, _ in IMAGES}

    # ------------------------------------------------------------------ HTML
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Uso del Código QR — Sistema de Control de Asistencia NOM-037</title>
<style>
/* ============================================================
   Reset + base
   ============================================================ */
*, *::before, *::after {{ box-sizing: border-box; }}
html {{ -webkit-text-size-adjust: 100%; }}
body {{
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #1F2937;
  background: #F5F7FA;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}}
img {{ max-width: 100%; display: block; }}
h1, h2, h3, h4, p, ul, ol, table {{ margin: 0; padding: 0; }}
ul, ol {{ list-style: none; }}
a {{ color: #1F6F6B; text-decoration: none; }}

/* ============================================================
   Page shell
   ============================================================ */
.page {{
  max-width: 900px;
  margin: 0 auto;
  padding: 56px 32px 80px;
  background: #FFFFFF;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
}}

/* ============================================================
   Cover
   ============================================================ */
.cover {{
  padding: 64px 40px 56px;
  background: linear-gradient(135deg, #1F2937 0%, #2A3441 55%, #3AAFA9 200%);
  border-radius: 16px;
  color: #FFFFFF;
  text-align: center;
  margin-bottom: 48px;
}}
.cover .eyebrow {{
  display: inline-block;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 600;
  padding: 6px 14px;
  border: 1px solid rgba(255,255,255,0.35);
  border-radius: 999px;
  color: #B8E5E2;
  margin-bottom: 28px;
}}
.cover h1 {{
  font-size: 38px;
  line-height: 1.18;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 14px;
}}
.cover .subtitle {{
  font-size: 18px;
  color: #D8E3EC;
  font-weight: 400;
  margin-bottom: 36px;
}}
.cover .meta {{
  display: inline-flex;
  gap: 28px;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 13px;
  color: #B8C4D0;
  border-top: 1px solid rgba(255,255,255,0.15);
  padding-top: 22px;
}}
.cover .meta strong {{ color: #FFFFFF; font-weight: 600; }}

/* ============================================================
   Section headers
   ============================================================ */
.section {{
  margin-top: 56px;
}}
.section-head {{
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
  padding-bottom: 14px;
  border-bottom: 2px solid #E6ECF2;
}}
.section-num {{
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #3AAFA9;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
}}
.section-head h2 {{
  font-size: 22px;
  font-weight: 700;
  color: #1F2937;
  letter-spacing: -0.005em;
}}
.section-head .icon-wrap {{
  margin-left: auto;
  color: #3AAFA9;
  display: inline-flex;
}}
.section-intro {{
  font-size: 15px;
  color: #475569;
  margin-bottom: 22px;
  max-width: 760px;
}}

/* ============================================================
   Cards & blocks
   ============================================================ */
.card {{
  background: #FFFFFF;
  border: 1px solid #E6ECF2;
  border-radius: 12px;
  padding: 22px 24px;
  margin-bottom: 18px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}}
.card.accent {{
  border-left: 4px solid #3AAFA9;
  background: #F5FBFA;
}}
.card.tip {{
  border-left: 4px solid #3AAFA9;
  background: #ECF8F7;
}}
.card.warn {{
  border-left: 4px solid #D97706;
  background: #FFF7ED;
}}
.card.danger {{
  border-left: 4px solid #DC2626;
  background: #FEF2F2;
}}

/* Step card (numbered) */
.step {{
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 22px;
  align-items: start;
  background: #FFFFFF;
  border: 1px solid #E6ECF2;
  border-radius: 14px;
  padding: 24px 26px;
  margin-bottom: 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}}
.step-num {{
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #3AAFA9 0%, #2A8C87 100%);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 22px;
  box-shadow: 0 4px 10px rgba(58, 175, 169, 0.25);
}}
.step-body h3 {{
  font-size: 18px;
  font-weight: 600;
  color: #1F2937;
  margin-bottom: 8px;
}}
.step-body p {{
  font-size: 14.5px;
  color: #475569;
  margin-bottom: 8px;
}}
.step-body ul.bullets {{
  margin: 8px 0 0;
  padding-left: 0;
  list-style: none;
}}
.step-body ul.bullets li {{
  position: relative;
  padding-left: 22px;
  font-size: 14.5px;
  color: #475569;
  margin-bottom: 6px;
}}
.step-body ul.bullets li::before {{
  content: '';
  position: absolute;
  left: 4px;
  top: 9px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3AAFA9;
}}

/* Screenshots */
.shot {{
  margin-top: 16px;
  border: 1px solid #E6ECF2;
  border-radius: 10px;
  padding: 8px;
  background: #F5F7FA;
}}
.shot img {{
  border-radius: 6px;
  display: block;
  margin: 0 auto;
  border: 1px solid #DDE3EA;
}}
.shot .caption {{
  font-size: 12.5px;
  color: #64748B;
  text-align: center;
  margin-top: 10px;
  font-style: italic;
}}

/* Lists */
.bullet-list {{
  list-style: none;
  padding-left: 0;
  margin: 4px 0 0;
}}
.bullet-list li {{
  position: relative;
  padding-left: 28px;
  font-size: 15px;
  color: #334155;
  margin-bottom: 12px;
  line-height: 1.55;
}}
.bullet-list li .ico {{
  position: absolute;
  left: 0;
  top: 1px;
  width: 20px;
  height: 20px;
  color: #3AAFA9;
}}
.bullet-list li strong {{ color: #1F2937; font-weight: 600; }}

.check-list li .ico {{ color: #3AAFA9; }}
.x-list li .ico {{ color: #DC2626; }}

/* Two-column comparisons */
.two-col {{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}}
.qr-type {{
  background: #FFFFFF;
  border: 1px solid #E6ECF2;
  border-radius: 12px;
  padding: 18px 20px;
}}
.qr-type.dynamic {{ border-top: 4px solid #3AAFA9; }}
.qr-type.personal {{ border-top: 4px solid #1F6F6B; }}
.qr-type h4 {{
  font-size: 15px;
  font-weight: 600;
  color: #1F2937;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}}
.qr-type p {{
  font-size: 13.5px;
  color: #475569;
  line-height: 1.5;
}}
.qr-type .tag {{
  display: inline-block;
  margin-top: 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #1F6F6B;
  background: #ECF8F7;
  padding: 3px 10px;
  border-radius: 999px;
}}

/* FAQ */
.faq-item {{
  background: #FFFFFF;
  border: 1px solid #E6ECF2;
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 12px;
}}
.faq-q {{
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  color: #1F2937;
  margin-bottom: 6px;
}}
.faq-q .q-mark {{
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: #ECF8F7;
  color: #1F6F6B;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}}
.faq-a {{
  font-size: 14px;
  color: #475569;
  padding-left: 32px;
  line-height: 1.55;
}}

/* Errors table */
table.errors {{
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 13.5px;
  background: #FFFFFF;
  border: 1px solid #E6ECF2;
  border-radius: 10px;
  overflow: hidden;
}}
table.errors thead {{
  background: #1F2937;
  color: #FFFFFF;
}}
table.errors th {{
  text-align: left;
  padding: 12px 14px;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.02em;
}}
table.errors td {{
  padding: 12px 14px;
  border-top: 1px solid #E6ECF2;
  vertical-align: top;
  color: #334155;
}}
table.errors td:first-child {{
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: 12.5px;
  color: #B91C1C;
  font-weight: 600;
  white-space: nowrap;
}}
table.errors tr:nth-child(even) td {{ background: #F8FAFC; }}

/* Action pills */
.action-grid {{
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 14px 0 4px;
}}
.action-pill {{
  display: flex;
  align-items: center;
  gap: 8px;
  background: #F5FBFA;
  border: 1px solid #CBE7E5;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13.5px;
  color: #1F2937;
  font-weight: 500;
}}
.action-pill .ico {{ color: #1F6F6B; flex-shrink: 0; }}

/* Big intro stat row */
.intro-stats {{
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin: 22px 0 8px;
}}
.intro-stat {{
  background: #F5F7FA;
  border: 1px solid #E6ECF2;
  border-radius: 10px;
  padding: 16px 18px;
  text-align: center;
}}
.intro-stat .num {{
  font-size: 26px;
  font-weight: 700;
  color: #1F6F6B;
  letter-spacing: -0.02em;
  line-height: 1.1;
}}
.intro-stat .lbl {{
  font-size: 12.5px;
  color: #64748B;
  margin-top: 4px;
  letter-spacing: 0.02em;
}}

/* Support block */
.support {{
  background: linear-gradient(135deg, #1F2937 0%, #2A3441 100%);
  border-radius: 14px;
  padding: 28px 30px;
  color: #FFFFFF;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}}
.support h3 {{
  font-size: 17px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}}
.support p {{
  font-size: 14px;
  color: #C8D3DD;
  line-height: 1.55;
}}
.support .field {{
  margin-top: 12px;
  font-size: 13px;
  color: #94A3B8;
}}
.support .field .lbl {{
  display: inline-block;
  min-width: 140px;
  color: #94A3B8;
}}
.support .field .val {{
  display: inline-block;
  border-bottom: 1px dashed #475569;
  min-width: 200px;
  padding-bottom: 2px;
  color: #E2E8F0;
}}

/* Footer */
.footer {{
  margin-top: 56px;
  padding-top: 22px;
  border-top: 1px solid #E6ECF2;
  text-align: center;
  font-size: 12.5px;
  color: #94A3B8;
  line-height: 1.6;
}}
.footer strong {{ color: #475569; font-weight: 600; }}

/* Print / responsive */
@media (max-width: 720px) {{
  .page {{ padding: 24px 16px 48px; }}
  .cover {{ padding: 40px 22px 32px; }}
  .cover h1 {{ font-size: 26px; }}
  .cover .subtitle {{ font-size: 15px; }}
  .step {{ grid-template-columns: 1fr; gap: 14px; }}
  .step-num {{ width: 48px; height: 48px; font-size: 18px; }}
  .two-col {{ grid-template-columns: 1fr; }}
  .intro-stats {{ grid-template-columns: 1fr; }}
  .action-grid {{ grid-template-columns: 1fr; }}
  .support {{ grid-template-columns: 1fr; padding: 22px; }}
  table.errors {{ font-size: 12.5px; }}
  table.errors th, table.errors td {{ padding: 10px 10px; }}
}}

@media print {{
  body {{ background: #FFFFFF; }}
  .page {{ box-shadow: none; max-width: none; }}
  .step, .card, .qr-type, .faq-item, .action-pill, .intro-stat {{
    break-inside: avoid;
  }}
}}
</style>
</head>
<body>
<div class="page">

  <!-- ============================================================
       COVER
       ============================================================ -->
  <header class="cover">
    <span class="eyebrow">Guía para empleados</span>
    <h1>Uso del Código QR<br>Sistema de Control de Asistencia NOM-037</h1>
    <p class="subtitle">Guía paso a paso para registrar tu entrada, salida y pausas con código QR</p>
    <div class="meta">
      <span><strong>Versión:</strong> v2.2.0</span>
      <span><strong>Generado:</strong> {today}</span>
      <span><strong>Tipo:</strong> Documento operativo</span>
    </div>
  </header>

  <!-- ============================================================
       1. INTRODUCCIÓN
       ============================================================ -->
  <section class="section">
    <div class="section-head">
      <div class="section-num">1</div>
      <h2>Introducción</h2>
      <span class="icon-wrap" title="Información">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      </span>
    </div>
    <p class="section-intro">
      El sistema de Control de Asistencia NOM-037 incluye un módulo de código QR que te permite
      registrar tu entrada, salida y pausas de comida o descanso de manera rápida y segura,
      usando la cámara de tu celular o el kiosco de la empresa. Esta guía explica, paso a paso
      y sin tecnicismos, cómo usarlo en el día a día.
    </p>

    <div class="intro-stats">
      <div class="intro-stat">
        <div class="num">5 min</div>
        <div class="lbl">Validez del QR del terminal</div>
      </div>
      <div class="intro-stat">
        <div class="num">2 tipos</div>
        <div class="lbl">de códigos QR en el sistema</div>
      </div>
      <div class="intro-stat">
        <div class="num">100%</div>
        <div class="lbl">Registros inmutables NOM-037</div>
      </div>
    </div>

    <div class="card accent" style="margin-top:18px;">
      <p style="font-size:14.5px; color:#334155;">
        <strong style="color:#1F2937;">¿Por qué se usa QR?</strong> El código QR es un método
        rápido y verificable de registrar asistencia que cumple con la NOM-037: cada registro
        queda firmado digitalmente, no puede modificarse ni borrarse, y el token del terminal
        expira cada 5 minutos para evitar que alguien más lo reutilice o lo copie paraRegistrar
        asistencia a tu nombre desde otro lugar.
      </p>
    </div>

    <h3 style="font-size:16px; font-weight:600; color:#1F2937; margin:24px 0 12px;">
      Los dos tipos de QR del sistema
    </h3>
    <div class="two-col">
      <div class="qr-type dynamic">
        <h4>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3AAFA9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><polyline points="21 4 21 9 16 9"/></svg>
          QR dinámico del terminal
        </h4>
        <p>
          Se muestra en la pantalla del kiosco o terminal del administrador. Cambia
          automáticamente cada 5 minutos. Es el código que <strong>debes escanear</strong> con
          tu celular para registrar tu asistencia.
        </p>
        <span class="tag">Vigencia: 5 minutos</span>
      </div>
      <div class="qr-type personal">
        <h4>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F6F6B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          QR personal del empleado
        </h4>
        <p>
          Es el código QR asignado a ti, visible en tu vista "Mi QR". Es permanente (no expira).
          Lo usa <strong>únicamente el administrador</strong> para registrarte desde el panel.
          Tú no puedes usarlo para auto-registrarte.
        </p>
        <span class="tag">Permanente</span>
      </div>
    </div>
  </section>

  <!-- ============================================================
       2. REQUISITOS PREVIOS
       ============================================================ -->
  <section class="section">
    <div class="section-head">
      <div class="section-num">2</div>
      <h2>Requisitos previos</h2>
      <span class="icon-wrap" title="Requisitos">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      </span>
    </div>
    <p class="section-intro">
      Antes de usar el sistema QR por primera vez, verifica que cuentas con lo siguiente:
    </p>
    <ul class="bullet-list check-list">
      <li>
        <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
        <strong>Cuenta de empleado activa.</strong> Tu email y contraseña deben estar dados de
        alta por el administrador. Si no puedes iniciar sesión, contacta a RR.HH.
      </li>
      <li>
        <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
        <strong>Dispositivo con cámara</strong> (celular o tablet) <em>o</em> acceso al kiosco
        de la empresa. No necesitas instalar ninguna app: el escáner funciona dentro del
        navegador.
      </li>
      <li>
        <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
        <strong>Navegador moderno:</strong> Chrome, Safari, Firefox o Edge actualizado (últimos
        2 años). No uses Internet Explorer.
      </li>
      <li>
        <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
        <strong>Conexión segura HTTPS.</strong> El sistema lo maneja automáticamente. La cámara
        del navegador solo funciona bajo HTTPS (por seguridad).
      </li>
      <li>
        <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
        <strong>Permiso de cámara.</strong> Cuando el navegador te pida acceso a la cámara por
        primera vez, debes seleccionar "Permitir". Si lo bloqueas, podrás usar el modo Manual.
      </li>
    </ul>

    <div class="card tip">
      <p style="font-size:14px; color:#1F2937;">
        <svg width="16" height="16" style="display:inline; vertical-align:-3px; color:#1F6F6B; margin-right:6px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>
        <strong>Tip:</strong> Si tu sucursal tiene activado el geofence (cerca geográfica), debes
        estar físicamente dentro del radio permitido (por defecto 150 metros) al momento del
        registro.
      </p>
    </div>
  </section>

  <!-- ============================================================
       3. INICIAR SESIÓN
       ============================================================ -->
  <section class="section">
    <div class="section-head">
      <div class="section-num">3</div>
      <h2>Cómo iniciar sesión</h2>
      <span class="icon-wrap" title="Login">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
      </span>
    </div>
    <p class="section-intro">
      Si aún no has iniciado sesión, sigue estos pasos. (Si ya estás dentro del sistema, salta a
      la sección 4.)
    </p>

    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <h3>Abre la URL del sistema</h3>
        <p>
          En el navegador de tu dispositivo, abre la dirección que te proporcionó tu empresa:
        </p>
        <p style="font-family:'SF Mono','Menlo',monospace; font-size:13.5px; color:#1F6F6B; background:#ECF8F7; display:inline-block; padding:6px 12px; border-radius:6px; margin-top:4px;">
          https://control-asistencia-v22.vercel.app
        </p>
      </div>
    </div>

    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <h3>Ingresa tus credenciales</h3>
        <p>
          En la pestaña <strong>"Contraseña"</strong> del formulario de inicio de sesión, escribe
          tu <strong>correo electrónico</strong> y tu <strong>contraseña</strong> tal como te
          fueron asignados. Verifica que el correo no tenga errores tipográficos.
        </p>
      </div>
    </div>

    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <h3>Pulsa "Iniciar sesión"</h3>
        <p>
          Si tus datos son correctos, entrarás a la vista principal del empleado. Si tu cuenta
          tiene activada la verificación en dos pasos (MFA), se te pedirá el código de 6 dígitos
          de tu app de autenticación (Google Authenticator, Authy, etc.).
        </p>
        <div class="shot">
          <img src="{img['qr-terminal.png']}" alt="Pantalla del sistema NOM-037" style="max-width:560px;">
          <div class="caption">Referencia visual del sistema. La pantalla del empleado es similar en estilo.</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ============================================================
       4. FLUJO PRINCIPAL — ESCANEAR QR
       ============================================================ -->
  <section class="section">
    <div class="section-head">
      <div class="section-num">4</div>
      <h2>Registrar asistencia escaneando el QR del terminal</h2>
      <span class="icon-wrap" title="Flujo principal">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="14" y1="14" x2="21" y2="14"/><line x1="14" y1="18" x2="17" y2="18"/><line x1="14" y1="21" x2="21" y2="21"/></svg>
      </span>
    </div>
    <p class="section-intro">
      Este es el flujo principal y el más usado. Sigue los pasos en orden. Cada paso incluye una
      captura real del sistema para que sepas exactamente qué verás en pantalla.
    </p>

    <!-- Step 1 -->
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <h3>Ve a la vista "Asistencia" → pestaña "QR"</h3>
        <p>
          Al iniciar sesión verás la hora actual grande arriba y tu estado del día
          ("No has checado entrada", "Checaste entrada a las 09:05", etc.). Debajo hay dos
          pestañas: <strong>GPS</strong> y <strong>QR</strong>. Pulsa <strong>QR</strong>.
        </p>
        <div class="shot">
          <img src="{img['employee-qr-tab.png']}" alt="Vista del empleado — pestaña QR" style="max-width:600px;">
          <div class="caption">Vista del empleado en la pestaña QR, sub-pestaña "Escanear QR".</div>
        </div>
      </div>
    </div>

    <!-- Step 2 -->
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <h3>Selecciona la acción que vas a registrar</h3>
        <p>
          Arriba del escáner hay un menú desplegable llamado
          <strong>"Acción a ejecutar al escanear"</strong>. Pulsa sobre él y elige la acción
          correspondiente. El sistema solo muestra las acciones válidas según tu estado del día
          (por ejemplo, no puedes "Registrar Salida" si aún no has entrado).
        </p>
        <div class="action-grid">
          <div class="action-pill">
            <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Registrar Entrada
          </div>
          <div class="action-pill">
            <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Registrar Salida
          </div>
          <div class="action-pill">
            <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
            Iniciar Comida
          </div>
          <div class="action-pill">
            <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/></svg>
            Terminar Comida
          </div>
          <div class="action-pill">
            <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Iniciar Descanso
          </div>
          <div class="action-pill">
            <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Terminar Descanso
          </div>
        </div>
      </div>
    </div>

    <!-- Step 3 -->
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <h3>Inicia la cámara</h3>
        <p>
          Pulsa el botón <strong>"Iniciar cámara"</strong>. El navegador te pedirá permiso para
          usar la cámara la primera vez. Selecciona <strong>"Permitir"</strong>.
        </p>
        <ul class="bullets">
          <li>Verás la vista en vivo de la cámara con un marco de escaneo central.</li>
          <li>Si tu dispositivo tiene varias cámaras, puedes alternar entre <strong>Frontal</strong> y <strong>Trasera</strong> con el botón correspondiente.</li>
          <li>El botón cambiará a <strong>"Detener cámara"</strong> mientras está activa.</li>
        </ul>
        <div class="card warn" style="margin-top:14px;">
          <p style="font-size:13.5px; color:#92400E;">
            <svg width="15" height="15" style="display:inline; vertical-align:-3px; margin-right:6px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <strong>Importante:</strong> si bloqueas el permiso de cámara, no podrás escanear.
            En ese caso, usa el modo Manual (sección 5) o habilita el permiso desde la
            configuración del navegador y recarga la página.
          </p>
        </div>
      </div>
    </div>

    <!-- Step 4 -->
    <div class="step">
      <div class="step-num">4</div>
      <div class="step-body">
        <h3>Apunta al QR del terminal</h3>
        <p>
          Ve al kiosco o terminal de la empresa (la pantalla con el QR grande que muestra el
          administrador). Apunta la cámara de tu dispositivo al código QR, manteniéndolo
          centrado dentro del marco de escaneo. A una distancia de 15 a 30 cm funciona mejor.
        </p>
        <ul class="bullets">
          <li>El sistema detecta el código automáticamente — no necesitas pulsar nada más.</li>
          <li>La cámara se detendrá sola tras una lectura exitosa para evitar duplicados.</li>
          <li>Verás un mensaje de confirmación del tipo: <strong>"✅ Entrada registrada a las 09:05"</strong>.</li>
        </ul>
        <div class="card tip">
          <p style="font-size:13.5px; color:#1F2937;">
            <svg width="15" height="15" style="display:inline; vertical-align:-3px; color:#1F6F6B; margin-right:6px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>
            <strong>Para el siguiente registro:</strong> pulsa nuevamente "Iniciar cámara" y
            repite el proceso. Cada acción (entrada, comida, salida, descanso) requiere su
            propio escaneo.
          </p>
        </div>
      </div>
    </div>

    <!-- Step 5 -->
    <div class="step">
      <div class="step-num">5</div>
      <div class="step-body">
        <h3>Verifica el resultado</h3>
        <p>
          Tras el escaneo exitoso, en pantalla verás:
        </p>
        <ul class="bullets">
          <li>La <strong>hora exacta</strong> del registro (con minutos y segundos).</li>
          <li>El <strong>estado del día</strong> actualizado en la parte superior ("Checaste entrada a las 09:05", etc.).</li>
          <li>Un mensaje verde confirmando el tipo de acción realizada.</li>
        </ul>
        <div class="card danger">
          <p style="font-size:13.5px; color:#991B1B;">
            <svg width="15" height="15" style="display:inline; vertical-align:-3px; margin-right:6px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <strong>Si hay un error</strong> (QR expirado, formato inválido, fuera de geofence,
            etc.), verás un mensaje rojo explicando el problema. Consulta la sección 8 para
            resolver los más comunes.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- ============================================================
       5. FLUJO ALTERNATIVO — MANUAL
       ============================================================ -->
  <section class="section">
    <div class="section-head">
      <div class="section-num">5</div>
      <h2>Flujo alternativo: ingresar el código manualmente</h2>
      <span class="icon-wrap" title="Modo manual">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/></svg>
      </span>
    </div>
    <p class="section-intro">
      Si no puedes usar la cámara (no tienes permiso, no hay cámara, o está siendo usada por
      otra app), puedes ingresar el código del terminal manualmente:
    </p>

    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <h3>Cambia al sub-tab "Manual"</h3>
        <p>
          Debajo del selector de acción, verás dos sub-pestañas: <strong>"Escanear QR"</strong>
          y <strong>"Manual"</strong>. Pulsa <strong>Manual</strong>.
        </p>
        <div class="shot">
          <img src="{img['employee-qr-manual.png']}" alt="Vista del empleado — sub-pestaña Manual" style="max-width:600px;">
          <div class="caption">Sub-pestaña Manual con campo de texto para pegar el código.</div>
        </div>
      </div>
    </div>

    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <h3>Teclea o pega el código del terminal</h3>
        <p>
          Pídele al administrador que te comparta el código actual (o cópialo del kiosco si está
          visible). El formato siempre empieza con <code style="font-family:'SF Mono',monospace; background:#ECF8F7; color:#1F6F6B; padding:2px 6px; border-radius:4px; font-size:13px;">NOM037:</code> seguido de varias
          cadenas separadas por dos puntos. Por ejemplo:
        </p>
        <p style="font-family:'SF Mono','Menlo',monospace; font-size:12px; color:#475569; background:#F5F7FA; border:1px solid #E6ECF2; padding:10px 12px; border-radius:6px; word-break:break-all; margin-top:6px;">
          NOM037:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4:1700000000:9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e
        </p>
      </div>
    </div>

    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <h3>Selecciona la acción y ejecuta</h3>
        <p>
          En el menú "Acción a ejecutar al escanear" elige la acción correspondiente y luego
          pulsa el botón grande de acción (Registrar Entrada / Salida / Comida / Descanso).
        </p>
        <div class="card warn">
          <p style="font-size:13.5px; color:#92400E;">
            <svg width="15" height="15" style="display:inline; vertical-align:-3px; margin-right:6px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <strong>Ojo:</strong> el código del terminal <strong>expira cada 5 minutos</strong>.
            Si lo copiaste hace rato y al enviarlo recibes "Código expirado", pídele al admin el
            código nuevo y vuelve a intentarlo.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- ============================================================
       6. MI QR PERSONAL
       ============================================================ -->
  <section class="section">
    <div class="section-head">
      <div class="section-num">6</div>
      <h2>Tu QR personal</h2>
      <span class="icon-wrap" title="Mi QR">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><path d="M14 14h7v7h-7z"/><path d="M14 3h2"/><path d="M3 14h2"/><path d="M14 10v.01"/><path d="M10 21v.01"/><path d="M21 14v.01"/></svg>
      </span>
    </div>
    <p class="section-intro">
      Además del QR del terminal, el sistema te asigna un <strong>QR personal permanente</strong>
      que solo tú puedes ver y que solo el administrador puede escanear.
    </p>

    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <h3>Abre "Mi QR" en la navegación inferior</h3>
        <p>
          En la barra inferior de la app verás los íconos: <strong>Asistencia · Historial ·
          Vacaciones · Mi QR</strong>. Pulsa <strong>Mi QR</strong>.
        </p>
        <div class="shot">
          <img src="{img['employee-my-qr.png']}" alt="Vista del empleado — Mi QR personal" style="max-width:560px;">
          <div class="caption">Tu QR personal con tu nombre y número de empleado.</div>
        </div>
      </div>
    </div>

    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <h3>¿Para qué sirve tu QR personal?</h3>
        <ul class="bullets">
          <li>Lo usan los administradores para <strong>registrarte desde el panel admin</strong> cuando tú no puedas hacerlo (olvido, dispositivo sin batería, etc.).</li>
          <li>Puedes <strong>descargarlo como PNG</strong> con el botón "Descargar PNG" para tenerlo guardado o impreso en tu gafete.</li>
          <li>Es <strong>permanente</strong>: no cambia ni expira. Si lo pierdes, el administrador puede revocarlo y generar uno nuevo.</li>
        </ul>
        <div class="card danger" style="margin-top:14px;">
          <p style="font-size:13.5px; color:#991B1B;">
            <svg width="15" height="15" style="display:inline; vertical-align:-3px; margin-right:6px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <strong>Por seguridad:</strong> tú <strong>no puedes</strong> usar tu propio QR
            personal para auto-registrarte. El sistema lo rechazará con el mensaje "No puedes
            usar tu propio QR personal". Esta restricción evita que alguien copie tu QR y se
            auto-registre a tu nombre desde otro dispositivo.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- ============================================================
       7. FAQ
       ============================================================ -->
  <section class="section">
    <div class="section-head">
      <div class="section-num">7</div>
      <h2>Preguntas frecuentes (FAQ)</h2>
      <span class="icon-wrap" title="FAQ">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </span>
    </div>

    <div class="faq-item">
      <div class="faq-q"><span class="q-mark">?</span> ¿El QR del terminal expira?</div>
      <div class="faq-a">Sí. Cada 5 minutos se genera uno nuevo. Si escaneas uno ya expirado, verás el mensaje "Código expirado". Solo tienes que esperar al QR actual o pedir al admin que pulse "Generar nuevo".</div>
    </div>

    <div class="faq-item">
      <div class="faq-q"><span class="q-mark">?</span> ¿Puedo reutilizar un QR?</div>
      <div class="faq-a">No. Cada QR dinámico del terminal está pensado para un solo uso. Aunque el sistema no bloquea reusarlo dentro de su ventana de 5 minutos, por seguridad y cumplimiento NOM-037 cada registro debe hacerse con el QR vigente en ese momento.</div>
    </div>

    <div class="faq-item">
      <div class="faq-q"><span class="q-mark">?</span> ¿Qué pasa si no tengo cámara en mi dispositivo?</div>
      <div class="faq-a">Usa el modo Manual (sección 5 de esta guía) y teclea o pega el código del terminal. También puedes pedirle a un administrador que escanee tu QR personal desde el panel admin.</div>
    </div>

    <div class="faq-item">
      <div class="faq-q"><span class="q-mark">?</span> ¿Necesito estar físicamente en la sucursal?</div>
      <div class="faq-a">Depende. Si tu sucursal tiene activado el geofence (cerca geográfica), debes estar dentro del radio permitido (por defecto 150 metros) en el momento del registro. Si no está activado, puedes registrar desde cualquier lado con el QR del terminal.</div>
    </div>

    <div class="faq-item">
      <div class="faq-q"><span class="q-mark">?</span> ¿Puedo usar mi QR personal para auto-registrarme?</div>
      <div class="faq-a">No, por seguridad. Tu QR personal solo lo usa el administrador desde el panel admin. Si intentas escanearlo con tu propia cámara, verás el mensaje "No puedes usar tu propio QR personal para registrar asistencia".</div>
    </div>

    <div class="faq-item">
      <div class="faq-q"><span class="q-mark">?</span> ¿El registro se puede deshacer o borrar?</div>
      <div class="faq-a">No. Los registros son inmutables por cumplimiento NOM-037 — eso garantiza que nadie pueda manipular el historial. Si te equivocaste (por ejemplo, registraste salida sin haber salido), contacta al administrador para que agregue una justificación en tu historial.</div>
    </div>

    <div class="faq-item">
      <div class="faq-q"><span class="q-mark">?</span> ¿Qué hago si la cámara no funciona?</div>
      <div class="faq-a">Sigue estos pasos en orden: 1) Verifica que diste permiso de cámara al sitio (ícono del candado en la barra del navegador). 2) Cierra otras apps que estén usando la cámara. 3) Recarga la página y vuelve a pulsar "Iniciar cámara". 4) Si sigue fallando, usa el modo Manual. 5) Contacta a soporte si el problema persiste.</div>
    </div>

    <div class="faq-item">
      <div class="faq-q"><span class="q-mark">?</span> ¿El sistema funciona sin internet?</div>
      <div class="faq-a">No. El registro de asistencia requiere conexión a internet para validar el token HMAC del QR contra el servidor y guardar el registro en la base de datos. Si no tienes señal, espera a recuperarla y registra en ese momento (no importa si el QR del terminal ya cambió — se usará el vigente).</div>
    </div>

    <div class="faq-item">
      <div class="faq-q"><span class="q-mark">?</span> ¿Puedo usar el sistema desde mi celular personal?</div>
      <div class="faq-a">Sí, siempre y cuando tu empresa lo permita. Solo necesitas un navegador moderno y conexión HTTPS. La cámara funciona tanto en iOS (Safari/Chrome) como en Android (Chrome/Firefox).</div>
    </div>

    <div class="faq-item">
      <div class="faq-q"><span class="q-mark">?</span> ¿Qué dispositivo usa el kiosco de la empresa?</div>
      <div class="faq-a">El kiosco es simplemente un navegador en modo pantalla completa mostrando la "Terminal QR" del administrador. Puede ser una tablet, una laptop o un monitor con mini-PC. El QR se genera localmente en ese navegador y el token nunca sale del dispositivo.</div>
    </div>
  </section>

  <!-- ============================================================
       8. ERRORES COMUNES
       ============================================================ -->
  <section class="section">
    <div class="section-head">
      <div class="section-num">8</div>
      <h2>Errores comunes y soluciones</h2>
      <span class="icon-wrap" title="Errores">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </span>
    </div>
    <p class="section-intro">
      Si te aparece alguno de estos mensajes, aquí tienes la causa y la solución:
    </p>

    <table class="errors">
      <thead>
        <tr>
          <th style="width:30%">Mensaje de error</th>
          <th style="width:32%">Causa</th>
          <th>Solución</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Código expirado</td>
          <td>El QR del terminal ya pasó sus 5 minutos de validez.</td>
          <td>Espera a que aparezca el QR nuevo en el kiosco o pídele al admin que pulse "Generar nuevo". Escanea el QR actualizado.</td>
        </tr>
        <tr>
          <td>Formato de QR no reconocido</td>
          <td>Escaneaste un QR que no pertenece al sistema (menú de restaurante, código de barras, etc.).</td>
          <td>Asegúrate de apuntar únicamente al QR del terminal NOM-037. Si hay otros códigos cerca, acércate más al QR correcto.</td>
        </tr>
        <tr>
          <td>No puedes usar tu propio QR personal</td>
          <td>Escaneaste tu QR de empleado (el de la vista "Mi QR") en lugar del QR del terminal.</td>
          <td>Tu QR personal solo lo usa el administrador. Para auto-registrarte, escanea siempre el QR del terminal/kiosco.</td>
        </tr>
        <tr>
          <td>Fuera de geofence</td>
          <td>Tu sucursal tiene geofence activado y no estás dentro del radio permitido (150 m por defecto).</td>
          <td>Acércate físicamente a tu sucursal. Si estás en home office o trabajo de campo, contacta al admin para que evalúe tu caso.</td>
        </tr>
        <tr>
          <td>Ya tienes entrada registrada hoy</td>
          <td>Intentaste registrar entrada dos veces el mismo día.</td>
          <td>No necesitas hacerlo de nuevo: ya estás registrado. Si el primer registro fue un error, contacta al admin para agregar una justificación.</td>
        </tr>
        <tr>
          <td>Firma inválida</td>
          <td>El código escaneado fue modificado o no fue generado por el sistema.</td>
          <td>No intentes modificar el código manualmente. Pídele al admin el código vigente del terminal.</td>
        </tr>
        <tr>
          <td>Cámara no disponible</td>
          <td>Permiso de cámara denegado, o el dispositivo no tiene cámara, o está siendo usada por otra app.</td>
          <td>1) Habilita el permiso de cámara en el navegador. 2) Cierra otras apps que usen cámara. 3) Recarga la página. 4) Si sigue fallando, usa el modo Manual.</td>
        </tr>
        <tr>
          <td>La cámara requiere conexión HTTPS</td>
          <td>Estás accediendo al sistema por una URL no segura (http://).</td>
          <td>Usa siempre la URL oficial con https://. El sistema lo maneja automáticamente en producción.</td>
        </tr>
        <tr>
          <td>No se pudo registrar</td>
          <td>Error de red o de servidor. Posiblemente no hay internet.</td>
          <td>Verifica tu conexión a internet y vuelve a intentar. Si el problema persiste, contacta a soporte.</td>
        </tr>
      </tbody>
    </table>
  </section>

  <!-- ============================================================
       9. SOPORTE
       ============================================================ -->
  <section class="section">
    <div class="section-head">
      <div class="section-num">9</div>
      <h2>Soporte</h2>
      <span class="icon-wrap" title="Soporte">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </span>
    </div>
    <p class="section-intro">
      Si después de seguir esta guía sigues con problemas, contacta al equipo de soporte de tu
      empresa. Ten a la mano tu número de empleado y una captura del error que ves en pantalla.
    </p>

    <div class="support">
      <div>
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3AAFA9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Correo de soporte
        </h3>
        <p>Para consultas sobre acceso, errores recurrentes o solicitudes de cambio de contraseña.</p>
        <div class="field">
          <span class="lbl">Email:</span>
          <span class="val">&nbsp;</span>
        </div>
        <div class="field">
          <span class="lbl">Persona responsable:</span>
          <span class="val">&nbsp;</span>
        </div>
      </div>
      <div>
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3AAFA9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          Soporte telefónico
        </h3>
        <p>Para incidencias urgentes durante tu turno (no puedes checar entrada/salida).</p>
        <div class="field">
          <span class="lbl">Teléfono:</span>
          <span class="val">&nbsp;</span>
        </div>
        <div class="field">
          <span class="lbl">Extensión:</span>
          <span class="val">&nbsp;</span>
        </div>
      </div>
    </div>

    <div class="card tip" style="margin-top:18px;">
      <p style="font-size:14px; color:#1F2937;">
        <svg width="16" height="16" style="display:inline; vertical-align:-3px; color:#1F6F6B; margin-right:6px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <strong>Horario de soporte:</strong> <span style="border-bottom:1px dashed #94A3B8; padding:0 24px;">&nbsp;</span>
        a <span style="border-bottom:1px dashed #94A3B8; padding:0 24px;">&nbsp;</span>, de lunes a viernes.
        Fuera de horario, deja tu mensaje por correo y te responderán al día hábil siguiente.
      </p>
    </div>
  </section>

  <!-- ============================================================
       FOOTER
       ============================================================ -->
  <footer class="footer">
    <p>
      <strong>Control de Asistencia NOM-037</strong> v2.2.0 &middot; Guía de Uso del Código QR
    </p>
    <p>
      Generado: {today} ({iso_today}) &middot; Documento operativo para piloto empresarial
    </p>
    <p style="margin-top:8px; font-size:11.5px; color:#94A3B8;">
      Las capturas de pantalla son reales del sistema en producción. Este documento es autocontenido
      y puede imprimirse o compartirse sin conexión.
    </p>
  </footer>

</div>
</body>
</html>
"""

    OUT_HTML.write_text(html, encoding="utf-8")
    size_kb = OUT_HTML.stat().st_size / 1024
    print(f"HTML OK  {OUT_HTML}  ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
