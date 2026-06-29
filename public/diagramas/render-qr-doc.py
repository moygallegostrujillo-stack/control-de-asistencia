#!/usr/bin/env python3
"""Render the "Uso del Código QR" employee guide HTML to high-quality PNG + PDF.

Outputs:
  /home/z/my-project/public/diagramas/uso-codigo-qr.png  (full-page, 2x device scale)
  /home/z/my-project/public/diagramas/uso-codigo-qr.pdf  (A4, multi-page, background printed)
"""
import asyncio
import os
from playwright.async_api import async_playwright

HTML_PATH = "/home/z/my-project/public/diagramas/uso-codigo-qr.html"
PNG_PATH  = "/home/z/my-project/public/diagramas/uso-codigo-qr.png"
PDF_PATH  = "/home/z/my-project/public/diagramas/uso-codigo-qr.pdf"

# Use a viewport wide enough so the 900px column + padding renders at full width.
INITIAL_W = 1000
INITIAL_H = 1600


async def render():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            viewport={"width": INITIAL_W, "height": INITIAL_H},
            device_scale_factor=2,
        )
        await page.goto(f"file://{HTML_PATH}", wait_until="networkidle")
        await page.wait_for_timeout(500)

        # Measure .page bounding box to expand viewport (full-page screenshot).
        root = page.locator(".page")
        bbox = await root.bounding_box()
        print(f"Initial .page bbox: {bbox}")

        content_w = int(bbox["width"]) + 4
        content_h = int(bbox["height"]) + 4
        expand_w = max(INITIAL_W, content_w)
        expand_h = max(INITIAL_H, content_h)
        await page.set_viewport_size({"width": expand_w, "height": expand_h})
        await page.wait_for_timeout(400)

        # Re-measure in case layout shifted (e.g., fonts loaded).
        bbox2 = await root.bounding_box()
        print(f"Expanded .page bbox: {bbox2}")
        if bbox2 and (bbox2["width"] > expand_w or bbox2["height"] > expand_h):
            expand_w = max(expand_w, int(bbox2["width"]) + 4)
            expand_h = max(expand_h, int(bbox2["height"]) + 4)
            await page.set_viewport_size({"width": expand_w, "height": expand_h})
            await page.wait_for_timeout(400)
            bbox2 = await root.bounding_box()
            print(f"Final .page bbox: {bbox2}")

        # ---- PNG (full-page screenshot clipped to .page) ----
        await root.screenshot(path=PNG_PATH)
        png_size = os.path.getsize(PNG_PATH)
        print(f"PNG OK  {PNG_PATH}  ({png_size/1024:.1f} KB)")

        # ---- PDF (A4 multi-page) ----
        # A4 = 8.27 x 11.69 inches. Use Chrome's standard A4 page size.
        await page.pdf(
            path=PDF_PATH,
            format="A4",
            print_background=True,
            margin={"top": "12mm", "bottom": "12mm", "left": "12mm", "right": "12mm"},
            prefer_css_page_size=False,
        )
        pdf_size = os.path.getsize(PDF_PATH)
        print(f"PDF OK  {PDF_PATH}  ({pdf_size/1024:.1f} KB)")

        await browser.close()
        return png_size, pdf_size


if __name__ == "__main__":
    asyncio.run(render())
