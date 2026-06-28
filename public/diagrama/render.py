#!/usr/bin/env python3
"""Render the system mindmap HTML to a high-quality PNG."""
import asyncio
import os
from playwright.async_api import async_playwright

HTML_PATH = "/home/z/my-project/public/diagrama/sistema.html"
PNG_PATH = "/home/z/my-project/public/diagrama/sistema-diagrama.png"

async def render():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            viewport={"width": 1900, "height": 1400},
            device_scale_factor=2,
        )
        await page.goto(f"file://{HTML_PATH}", wait_until="networkidle")
        await page.wait_for_timeout(600)

        # Measure the #mindmap bounding box
        el = page.locator("#mindmap")
        bbox = await el.bounding_box()
        print(f"Initial bbox: {bbox}")

        # Expand viewport to fit content + padding
        expand_w = max(1900, int(bbox["width"] + 120))
        expand_h = int(bbox["height"] + 120)
        await page.set_viewport_size({"width": expand_w, "height": expand_h})
        await page.wait_for_timeout(300)

        # Draw connectors
        await page.evaluate('if(typeof drawAllLines==="function") drawAllLines()')
        await page.wait_for_timeout(300)

        # Trim to actual content bounds
        trim = await page.evaluate('''() => {
            const map = document.getElementById('mindmap');
            const nodes = map.querySelectorAll('.root-node,.branch-node,.sub-node,.leaf,.deep-node,.title-block,.legend');
            const mapRect = map.getBoundingClientRect();
            let maxR = 0, maxB = 0, minL = mapRect.width, minT = mapRect.height;
            nodes.forEach(n => {
                const r = n.getBoundingClientRect();
                maxR = Math.max(maxR, r.right - mapRect.left);
                maxB = Math.max(maxB, r.bottom - mapRect.top);
                minL = Math.min(minL, r.left - mapRect.left);
                minT = Math.min(minT, r.top - mapRect.top);
            });
            return {
                contentW: Math.ceil(maxR - minL) + 100,
                contentH: Math.ceil(maxB - minT) + 100,
            };
        }''')
        print(f"Trim size: {trim}")
        await page.set_viewport_size({"width": trim["contentW"], "height": trim["contentH"]})
        await page.wait_for_timeout(300)
        await page.evaluate('if(typeof drawAllLines==="function") drawAllLines()')
        await page.wait_for_timeout(300)

        await el.screenshot(path=PNG_PATH)
        await browser.close()

        size = os.path.getsize(PNG_PATH)
        print(f"OK {PNG_PATH} ({size/1024:.1f}KB)")

asyncio.run(render())
