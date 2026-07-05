#!/usr/bin/env python3
"""Render the MFA TOTP activation diagram HTML to a self-contained HTML,
high-quality PNG (2x device scale), and PDF (custom wide format).

Steps:
  1. Read 5 screenshots from /home/z/my-project/public/screenshots/
  2. Base64-encode each as data URL and substitute into the HTML template
     (tokens __B64_*__ and __DATE__).
  3. Launch Playwright chromium, navigate to the templated HTML, expand
     viewport to #root bounding box, screenshot PNG (clip-to-root) and PDF
     (single page, custom size).

Outputs:
  /home/z/my-project/public/diagramas/activacion-mfa-totp.html  (self-contained)
  /home/z/my-project/public/diagramas/activacion-mfa-totp.png   (2x device scale)
  /home/z/my-project/public/diagramas/activacion-mfa-totp.pdf   (single wide page)
"""
import asyncio
import base64
import os
import sys
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright

# ------------------------------------------------------------------
# Paths
# ------------------------------------------------------------------
PROJECT_ROOT = Path("/home/z/my-project")
HTML_PATH     = PROJECT_ROOT / "public/diagramas/activacion-mfa-totp.html"
PNG_PATH      = PROJECT_ROOT / "public/diagramas/activacion-mfa-totp.png"
PDF_PATH      = PROJECT_ROOT / "public/diagramas/activacion-mfa-totp.pdf"
SCREEN_DIR    = PROJECT_ROOT / "public/screenshots"

# Map of placeholder token -> screenshot filename
SCREEN_MAP = {
    "__B64_STEP1_QR__":      "mfa-dialog-step1-qr.png",
    "__B64_STEP2_OTP__":     "mfa-dialog-step2-otp-filled.png",
    "__B64_STEP3_BACKUP__":  "mfa-dialog-step3-backup-codes.png",
    "__B64_LOGIN_MFA__":     "login-mfa-step2.png",
    "__B64_SETTINGS_ACTIVE__": "mfa-settings-active.png",
}

INITIAL_W = 1700
INITIAL_H = 1400


# ------------------------------------------------------------------
# Build self-contained HTML with embedded base64 images
# ------------------------------------------------------------------
def build_html() -> str:
    html = HTML_PATH.read_text(encoding="utf-8")

    for token, fname in SCREEN_MAP.items():
        fpath = SCREEN_DIR / fname
        if not fpath.exists():
            print(f"ERROR: screenshot not found: {fpath}", file=sys.stderr)
            sys.exit(1)
        raw = fpath.read_bytes()
        b64 = base64.b64encode(raw).decode("ascii")
        data_url = f"data:image/png;base64,{b64}"
        if token not in html:
            print(f"WARNING: token {token} not present in HTML template", file=sys.stderr)
        html = html.replace(token, data_url)
        print(f"  embedded {fname} ({len(raw)/1024:.1f} KB) -> {token}")

    # Date in es-MX format
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    html = html.replace("__DATE__", now)

    HTML_PATH.write_text(html, encoding="utf-8")
    print(f"HTML self-contained written: {HTML_PATH} ({len(html)/1024:.1f} KB)")
    return html


# ------------------------------------------------------------------
# Playwright render
# ------------------------------------------------------------------
async def render():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            viewport={"width": INITIAL_W, "height": INITIAL_H},
            device_scale_factor=2,
        )
        await page.goto(f"file://{HTML_PATH}", wait_until="networkidle")
        await page.wait_for_timeout(600)  # let images decode

        # Measure #root bounding box
        root = page.locator("#root")
        bbox = await root.bounding_box()
        print(f"Initial #root bbox: {bbox}")

        # Expand viewport to fit content
        content_w = int(bbox["width"]) + 8
        content_h = int(bbox["height"]) + 8
        expand_w = max(INITIAL_W, content_w)
        expand_h = max(INITIAL_H, content_h)
        await page.set_viewport_size({"width": expand_w, "height": expand_h})
        await page.wait_for_timeout(500)

        # Re-measure
        bbox2 = await root.bounding_box()
        print(f"Expanded #root bbox: {bbox2}")

        # One extra pass if content still overflows viewport
        if bbox2 and (bbox2["width"] > expand_w or bbox2["height"] > expand_h):
            expand_w = max(expand_w, int(bbox2["width"]) + 8)
            expand_h = max(expand_h, int(bbox2["height"]) + 8)
            await page.set_viewport_size({"width": expand_w, "height": expand_h})
            await page.wait_for_timeout(400)
            bbox2 = await root.bounding_box()
            print(f"Final #root bbox: {bbox2}")

        # ---- PNG screenshot (clip to root bounding box) ----
        await root.screenshot(path=str(PNG_PATH))
        png_size = os.path.getsize(PNG_PATH)
        print(f"PNG OK  {PNG_PATH}  ({png_size/1024:.1f} KB)")

        # ---- PDF (single page, custom size = content dimensions in inches @ 96dpi) ----
        # Add a small margin around the content
        page_w_in = (expand_w / 96.0) + 0.5
        page_h_in = (expand_h / 96.0) + 0.5
        await page.pdf(
            path=str(PDF_PATH),
            width=f"{page_w_in}in",
            height=f"{page_h_in}in",
            print_background=True,
            margin={"top": "0.2in", "bottom": "0.2in", "left": "0.2in", "right": "0.2in"},
            prefer_css_page_size=False,
        )
        pdf_size = os.path.getsize(PDF_PATH)
        print(f"PDF OK  {PDF_PATH}  ({pdf_size/1024:.1f} KB)")

        await browser.close()
        return png_size, pdf_size


if __name__ == "__main__":
    print("=== Step 1: Build self-contained HTML with embedded base64 ===")
    build_html()
    print()
    print("=== Step 2: Render PNG + PDF via Playwright ===")
    asyncio.run(render())
    print()
    print("=== Done ===")
