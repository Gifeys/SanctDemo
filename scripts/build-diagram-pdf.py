# -*- coding: utf-8 -*-
"""
Collects the figures into one PDF, one figure per page.

## Why each page is sized to its own figure

A figure forced onto a fixed A4 page gets scaled to fit, and scaling
is exactly what made the first set unreadable: a tall flowchart
squeezed onto a portrait page prints its labels at about 5pt.

So the page is sized to the drawing instead. Every page is PAGE_MM
wide and as tall as that figure needs, which keeps a 15px label at the
same physical size - roughly 8pt - on every page, however tall the
figure is. Mixed page sizes in an appendix of figures are ordinary;
unreadable type is not.

## Why it is built from the PNGs

Edge's --print-to-pdf exits 0 and writes nothing on this machine, in
both headless modes, with the SVG linked or inlined. Rather than fight
it, the pages are composed from the 2x PNGs that the figure pipeline
already produces. At 2640px across 250mm that is about 268 dpi, which
is more than a printed appendix needs, and it is the same raster the
README already recommends for print because it cannot be re-laid-out
by a missing font.

Run:  python scripts/build-diagrams.py
      python scripts/render-figs.py
      python scripts/build-diagram-pdf.py
"""

import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "docs", "diagrams"))

# Every page is A4 wide and only as tall as its figure needs.
#
# A4 width because anything wider is scaled down by the printer, which
# would undo the readability this revision is for. Each sheet is drawn
# so its height stays within A4's proportions too, which is why the
# ministry flowchart is three sheets.
PAGE_MM = 210.0   # A4 width, so a printer never scales a page down
MM_PER_INCH = 25.4

# The order the paper will reference them in.
ORDER = [
    "fig-1-use-case",
    "fig-2-flow-user",
    "fig-3-flow-admin",
    "fig-4-dfd-level0",
    "fig-5-dfd-level1",
    "fig-6-erd",
    "fig-7-hipo-user",
    "fig-8-hipo-admin",
]


def main():
    pages = []
    for name in ORDER:
        path = os.path.join(OUT, name + ".png")
        if not os.path.exists(path):
            print("  MISSING %s.png" % name)
            continue

        img = Image.open(path)
        # PDFs have no alpha; an unflattened PNG goes black where it
        # was transparent.
        if img.mode in ("RGBA", "LA", "P"):
            flat = Image.new("RGB", img.size, "white")
            img = img.convert("RGBA")
            flat.paste(img, mask=img.split()[-1])
            img = flat
        else:
            img = img.convert("RGB")

        pages.append(img)
        dpi = img.width / (PAGE_MM / MM_PER_INCH)
        print("  page %2d  %-32s %.0f x %.0f mm  (%.0f dpi)"
              % (len(pages), name, PAGE_MM, PAGE_MM * img.height / img.width, dpi))

    if not pages:
        print("  nothing to collect")
        return

    # One resolution for the whole document, so every page comes out
    # the same physical width whatever its pixel size.
    dpi = pages[0].width / (PAGE_MM / MM_PER_INCH)
    dst = os.path.join(OUT, "SanctiWalk-System-Diagrams.pdf")
    pages[0].save(dst, "PDF", save_all=True, append_images=pages[1:],
                  resolution=dpi, title="SanctiWalk System Diagrams")
    print("\n  %d pages -> %s  (%.1f MB)"
          % (len(pages), dst, os.path.getsize(dst) / 1048576.0))


if __name__ == "__main__":
    main()
