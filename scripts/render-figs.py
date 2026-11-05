"""Rasterise the fig-*.svg sheets to PNGs of one uniform pixel width.

Uniform width matters for the PDF: Pillow writes one resolution for
the whole document, so pages of different pixel widths would come out
at different physical widths. Scaling each sheet to the same number of
pixels means one resolution gives every page the same 210mm width.

A separate Edge profile per file: the shared one deadlocks when nine
headless instances start in a row, and the symptom is a silent
zero-byte PNG rather than an error.
"""
import os, re, subprocess, sys, tempfile
from PIL import Image
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "diagrams"))

# Every PNG comes out this wide. At 210mm that is about 305 dpi.
TARGET_W = 2520

def main(only=None):
    names = sorted(f for f in os.listdir(OUT) if f.startswith("fig-") and f.endswith(".svg"))
    if only:
        names = [n for n in names if any(o in n for o in only)]
    for name in names:
        src, dst = os.path.join(OUT, name), os.path.join(OUT, name[:-4] + ".png")
        head = open(src, encoding="utf-8").read(400)
        w = int(float(re.search(r'width="([\d.]+)"', head).group(1)))
        h = int(float(re.search(r'height="([\d.]+)"', head).group(1)))
        # Scale chosen per sheet so every PNG lands on TARGET_W.
        scale = round(TARGET_W / float(w), 4)
        subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--no-sandbox",
            "--hide-scrollbars", "--force-device-scale-factor=%s" % scale,
            "--user-data-dir=" + tempfile.mkdtemp(prefix="edge-"),
            "--window-size=%d,%d" % (w, h), "--screenshot=" + dst,
            "file:///" + src.replace("\\", "/")], capture_output=True, timeout=240)
        ok = os.path.exists(dst) and os.path.getsize(dst) > 2000
        px = Image.open(dst).width if ok else 0
        print("  %-36s %s %spx" % (name, "OK" if ok else "FAIL", px))

if __name__ == "__main__":
    main(sys.argv[1:] or None)
