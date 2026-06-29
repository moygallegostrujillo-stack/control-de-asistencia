#!/usr/bin/env python3
"""Render the NOM-037 process flow diagram HTML to high-quality PNG + PDF.

Outputs:
  /home/z/my-project/public/diagramas/flujo-procesos.png  (2x device scale)
  /home/z/my-project/public/diagramas/flujo-procesos.pdf  (custom wide format)
"""
import asyncio
import os
from playwright.async_api import async_playwright

HTML_PATH = "/home/z/my-project/public/diagramas/flujo-procesos.html"
PNG_PATH  = "/home/z/my-project/public/diagramas/flujo-procesos.png"
PDF_PATH  = "/home/z/my-project/public/diagramas/flujo-procesos.pdf"

INITIAL_W = 1600
INITIAL_H = 1200


async def render():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            viewport={"width": INITIAL_W, "height": INITIAL_H},
            device_scale_factor=2,
        )
        await page.goto(f"file://{HTML_PATH}", wait_until="networkidle")
        await page.wait_for_timeout(500)

        # Measure #root bounding box
        root = page.locator("#root")
        bbox = await root.bounding_box()
        print(f"Initial #root bbox: {bbox}")

        # Expand viewport to fit content + padding (account for device_scale_factor by using logical px)
        content_w = int(bbox["width"]) + 4   # tiny margin
        content_h = int(bbox["height"]) + 4
        expand_w = max(INITIAL_W, content_w)
        expand_h = max(INITIAL_H, content_h)
        await page.set_viewport_size({"width": expand_w, "height": expand_h})
        await page.wait_for_timeout(400)

        # Re-measure after expand (in case layout shifted)
        bbox2 = await root.bounding_box()
        print(f"Expanded #root bbox: {bbox2}")

        # Re-expand if needed (one extra pass for safety)
        if bbox2 and (bbox2["width"] > expand_w or bbox2["height"] > expand_h):
            expand_w = max(expand_w, int(bbox2["width"]) + 4)
            expand_h = max(expand_h, int(bbox2["height"]) + 4)
            await page.set_viewport_size({"width": expand_w, "height": expand_h})
            await page.wait_for_timeout(400)
            bbox2 = await root.bounding_box()
            print(f"Final #root bbox: {bbox2}")

        # ---- PNG screenshot (clip to root bounding box for crisp edges) ----
        await root.screenshot(path=PNG_PATH)
        png_size = os.path.getsize(PNG_PATH)
        print(f"PNG OK  {PNG_PATH}  ({png_size/1024:.1f} KB)")

        # ---- PDF (single page, custom size = content dimensions in inches @ 96dpi) ----
        # Convert CSS pixels to inches (96 px = 1 inch). Add a small margin.
        page_w_in = (expand_w / 96.0) + 0.4
        page_h_in = (expand_h / 96.0) + 0.4
        await page.pdf(
            path=PDF_PATH,
            width=f"{page_w_in}in",
            height=f"{page_h_in}in",
            print_background=True,
            margin={"top": "0.15in", "bottom": "0.15in", "left": "0.15in", "right": "0.15in"},
            prefer_css_page_size=False,
        )
        pdf_size = os.path.getsize(PDF_PATH)
        print(f"PDF OK  {PDF_PATH}  ({pdf_size/1024:.1f} KB)")

        await browser.close()
        return png_size, pdf_size


if __name__ == "__main__":
    asyncio.run(render())
