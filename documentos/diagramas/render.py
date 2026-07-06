"""Renderiza puesta-en-marcha.html a PNG con Playwright (Chromium)."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

HTML = Path(__file__).parent / "puesta-en-marcha.html"
OUT_PNG = Path(__file__).parent / "puesta-en-marcha.png"
OUT_PDF = Path(__file__).parent / "puesta-en-marcha.pdf"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            device_scale_factor=2,
        )
        page = await ctx.new_page()
        await page.goto(f"file://{HTML.resolve()}")
        await page.wait_for_load_state("networkidle")
        # Medir el contenido real para ajustar el viewport
        box = await page.evaluate(
            "() => { const r = document.getElementById('root').getBoundingClientRect(); "
            "return { w: Math.ceil(r.width + 80), h: Math.ceil(r.bottom + 40) }; }"
        )
        await page.set_viewport_size({"width": box["w"], "height": box["h"]})
        await page.wait_for_timeout(300)
        await page.screenshot(path=str(OUT_PNG), full_page=True)
        await page.pdf(path=str(OUT_PDF), print_background=True,
                       width=f"{box['w']}px", height=f"{box['h']}px",
                       margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        await browser.close()
    print(f"PNG: {OUT_PNG} ({OUT_PNG.stat().st_size // 1024} KB)")
    print(f"PDF: {OUT_PDF} ({OUT_PDF.stat().st_size // 1024} KB)")

asyncio.run(main())
