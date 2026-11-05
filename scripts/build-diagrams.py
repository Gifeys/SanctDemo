# -*- coding: utf-8 -*-
"""
The capstone figures, drawn to be readable on paper.

## The revision this answers

The panel returned every diagram with one note: they are not readable,
and they do not carry enough detail to build a design from.

The first part was measurable. The old ERD put 79 labels at 9px on a
1460px canvas. Placed on a landscape A4 that is about 4pt type, half
the size of a footnote. Every figure had the same fault.

## Why bigger fonts alone could not fix it

Scaling a drawing up changes nothing: the page is still 250mm wide, so
a figure drawn twice as large is printed at half the scale and the
type lands back where it started. What matters is how MUCH is on one
sheet.

So the rule here is density, not point size:

  * no sheet is wider than SHEET_W, which maps to the usable width of
    a landscape A4
  * no text is smaller than MIN_FONT, enforced inside text() so it
    cannot be waived to squeeze one more box in
  * a figure with too much in it is SPLIT across sheets rather than
    shrunk, which is why the ERD, the flowchart and the HIPO are two
    sheets each

At 1320px wide with 15px type, the smallest text prints at roughly
8pt. That is a floor a reader can actually work from.

## Where the content comes from

Collection names and fields are read off firestore.rules and
src/types.ts; screens off src/App.tsx and src/admin/AdminApp.tsx.
Nothing here is invented, because a diagram that disagrees with the
system is worse than no diagram.

## Why this lives in scripts/ and not tools/

tools/ is gitignored. A generator nobody else can run is a diagram
that goes stale the week after it is drawn, and this project has
already lost two deploys to a build script sitting in that directory.

Run:  python scripts/build-diagrams.py
Then: python tools/render-diagrams.py      (2x PNGs for Word)
"""

import io
import os
from xml.sax.saxutils import escape

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "diagrams")

SHEET_W = 1320        # usable width of a landscape A4
PORTRAIT_W = 1000     # usable width of a portrait A4
MIN_FONT = 15         # ~8pt once the sheet is fitted to the page

# The palette.
#
# Soft, desaturated fills in one tonal family - the same weight as the
# peach in the reference figure, so the set still reads as a printed
# textbook rather than a slide deck. Each fill carries a deeper
# outline of its own hue, which is what keeps the line work crisp
# without any shape needing a heavy stroke.
#
# Colour MEANS something here, which is the difference from the first
# attempt: one hue per kind of thing, used consistently across all
# twelve sheets, so a reader learns it once. The shapes stay
# distinguishable too - rounded for a process, square for an entity -
# so nothing is lost on a monochrome photocopier.
NAVY = "#000000"          # titles: black, like the rest of the ink
INK = "#000000"
MUTED = "#3A3A3A"         # secondary text, still black enough to read
LINE = "#000000"

PROC, PROC_E = "#C9DAEE", "#38506E"      # process
ENT, ENT_E = "#C9DEC4", "#44663F"        # external entity / result
DEC, DEC_E = "#F3DFA6", "#8A6A20"        # decision / refusal
TERM, TERM_E = "#D7CDE8", "#554A77"      # terminator, screen
STORE, STORE_E = "#F2C3B4", "#8C4A3A"    # anything holding data

ACCENT, ACCENT_E = STORE, STORE_E

# Square corners and hairline rules: the reference figure has no
# rounded boxes and no heavy strokes. The one exception is a process,
# which is rounded by DFD convention.
RADIUS = 2
PROC_R = 14
STROKE = 1.4

FONT = "Helvetica, Arial, Segoe UI, sans-serif"


class Sheet:
    def __init__(self, w, h, number, title, subtitle=""):
        self.w, self.h = w, h
        self.number, self.title, self.subtitle = number, title, subtitle
        self.parts = []

    # ------------------------------------------------------------ text
    def text(self, x, y, s, size=MIN_FONT, weight="400", anchor="middle",
             fill=INK, mono=False):
        # The floor, enforced here so no caller can quietly drop under
        # it to make something fit. If a sheet is too full, split the
        # sheet. That is the whole lesson of the returned revision.
        if size < MIN_FONT:
            raise ValueError("%spx is below the %spx readable floor" % (size, MIN_FONT))
        fam = '"Consolas, Courier New, monospace"' if mono else '"%s"' % FONT
        self.parts.append(
            '<text x="%s" y="%s" font-family=%s font-size="%s" font-weight="%s" '
            'text-anchor="%s" fill="%s">%s</text>'
            % (x, y, fam, size, weight, anchor, fill, escape(s)))

    def lines(self, x, y, rows, size=MIN_FONT, weight="400", anchor="middle",
              fill=INK, lh=None, mono=False):
        lh = lh or size + 7
        for i, r in enumerate(rows):
            self.text(x, y + i * lh, r, size, weight, anchor, fill, mono)

    # ---------------------------------------------------------- shapes
    def rect(self, x, y, w, h, fill, edge, rx=RADIUS, sw=STROKE, dash=None):
        d = ' stroke-dasharray="%s"' % dash if dash else ""
        self.parts.append(
            '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s" '
            'stroke="%s" stroke-width="%s"%s/>' % (x, y, w, h, rx, fill, edge, sw, d))

    def box(self, x, y, w, h, rows, fill=PROC, edge=PROC_E, size=MIN_FONT,
            rx=RADIUS, head=None, weight=None):
        self.rect(x, y, w, h, fill, edge, rx)
        cx, lh = x + w / 2.0, size + 7
        top = y + h / 2.0 - (len(rows) - 1) * lh / 2.0 + size * 0.35
        if head:
            self.text(cx, y + 27, head, size, "700", fill=edge)
            top += 15
        self.lines(cx, top, rows, size, weight or ("600" if len(rows) == 1 else "400"))

    def diamond(self, cx, cy, w, h, rows, size=MIN_FONT):
        pts = "%s,%s %s,%s %s,%s %s,%s" % (cx, cy - h / 2.0, cx + w / 2.0, cy,
                                           cx, cy + h / 2.0, cx - w / 2.0, cy)
        self.parts.append('<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"/>'
                          % (pts, DEC, DEC_E, STROKE))
        lh = size + 6
        self.lines(cx, cy - (len(rows) - 1) * lh / 2.0 + size * 0.35, rows, size, "600")

    def stadium(self, cx, cy, w, h, label, size=17):
        self.rect(cx - w / 2.0, cy - h / 2.0, w, h, TERM, TERM_E, rx=h / 2.0)
        self.text(cx, cy + size * 0.35, label, size, "700")

    def ellipse(self, cx, cy, rx, ry, rows, size=MIN_FONT, fill=PROC, edge=PROC_E):
        self.parts.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" '
                          'stroke="%s" stroke-width="%s"/>' % (cx, cy, rx, ry, fill, edge, STROKE))
        lh = size + 5
        self.lines(cx, cy - (len(rows) - 1) * lh / 2.0 + size * 0.35, rows, size, "500")

    def arrow(self, pts, label=None, lx=None, ly=None, dash=None, both=False):
        d = " ".join("%s,%s" % (p[0], p[1]) for p in pts)
        da = ' stroke-dasharray="%s"' % dash if dash else ""
        st = ' marker-start="url(#a)"' if both else ""
        self.parts.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="%s" '
                          'marker-end="url(#a)"%s%s/>' % (d, LINE, STROKE, st, da))
        if label:
            x = lx if lx is not None else (pts[0][0] + pts[-1][0]) / 2.0
            y = ly if ly is not None else (pts[0][1] + pts[-1][1]) / 2.0
            w = len(label) * MIN_FONT * 0.55 + 14
            self.parts.append('<rect x="%s" y="%s" width="%s" height="%s" rx="5" '
                              'fill="#FFFFFF" opacity="0.94"/>'
                              % (x - w / 2.0, y - MIN_FONT, w, MIN_FONT + 9))
            self.text(x, y, label, MIN_FONT, "600", fill=MUTED)

    def plain(self, x1, y1, x2, y2, dash=None, sw=STROKE):
        d = ' stroke-dasharray="%s"' % dash if dash else ""
        self.parts.append('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" '
                          'stroke-width="%s"%s/>' % (x1, y1, x2, y2, LINE, sw, d))

    def legend(self, x, y, items, title="LEGEND"):
        self.text(x, y, title, MIN_FONT, "700", "start", MUTED)
        cy = y + 28
        for fill, edge, label in items:
            self.rect(x, cy - 15, 30, 21, fill, edge, rx=RADIUS)
            self.text(x + 40, cy + 1, label, MIN_FONT, "400", "start", MUTED)
            cy += 31

    # ---------------------------------------------------------- output
    def save(self, name):
        # A sheet shorter than its content crops it silently, which is
        # how the first ministry flowchart lost everything below the
        # decision diamond. Measure before writing, and say so.
        import re as _re
        body = "".join(self.parts)
        # Only y, and only where y is the whole attribute name: a plain
        # [xy] match also caught every x and every rx, so the first
        # version of this check reported an x-coordinate as the height.
        ys = [float(v) for v in _re.findall(r'(?<![a-zA-Z])y[12]?="(-?[\d.]+)"', body)]
        ys += [float(v) for v in _re.findall(r'cy="(-?[\d.]+)"', body)]
        pts = _re.findall(r'points="([^"]+)"', body)
        for ptset in pts:
            for pair in ptset.split():
                ys.append(float(pair.split(",")[1]))
        if ys and max(ys) > self.h - 20:
            print("  WARNING %s: content reaches %.0f but sheet is %s"
                  % (name, max(ys), self.h))

        s = io.StringIO()
        s.write('<svg xmlns="http://www.w3.org/2000/svg" width="%s" height="%s" '
                'viewBox="0 0 %s %s">' % (self.w, self.h, self.w, self.h))
        s.write('<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" '
                'markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
                '<path d="M0,0 L10,5 L0,10 z" fill="%s"/></marker></defs>' % LINE)
        s.write('<rect width="%s" height="%s" fill="#FFFFFF"/>' % (self.w, self.h))
        s.write('<text x="44" y="46" font-family="%s" font-size="25" font-weight="700" '
                'fill="%s">%s</text>' % (FONT, NAVY, escape(self.number + "  " + self.title)))
        if self.subtitle:
            s.write('<text x="44" y="72" font-family="%s" font-size="%s" fill="%s">%s</text>'
                    % (FONT, MIN_FONT + 1, MUTED, escape(self.subtitle)))
        s.write('<line x1="44" y1="86" x2="%s" y2="86" stroke="%s" stroke-width="1.5"/>'
                % (self.w - 44, LINE))
        s.write("".join(self.parts))
        s.write('<text x="%s" y="%s" font-family="%s" font-size="%s" text-anchor="end" '
                'fill="%s">SanctiWalk — Diocese of Kalookan</text>'
                % (self.w - 44, self.h - 22, FONT, MIN_FONT - 1, MUTED))
        s.write("</svg>")
        p = os.path.normpath(os.path.join(OUT, name))
        io.open(p, "w", encoding="utf-8", newline="\n").write(s.getvalue())
        print("  wrote %-34s %sx%s" % (name, self.w, self.h))


def branch(d, cx, half, target_x, y, label):
    """
    A Yes/No arm leaving a decision diamond sideways.

    The label goes in the MIDDLE of the gap between the diamond's
    vertex and whatever the arrow points at, lifted clear of the line.
    Placing these by eye is what put every "No" on a sloped edge: the
    gap is narrower than it looks, because a diamond's widest point is
    its vertex and the text was being centred past it.
    """
    left = target_x < cx
    vertex = cx - half if left else cx + half
    d.arrow([(vertex, y), (target_x, y)])
    d.text((vertex + target_x) / 2.0, y - 14, label, MIN_FONT, "600", "middle", MUTED)



# =====================================================================
# FIGURE 1 - USE CASE DIAGRAM
# =====================================================================
def fig1_use_case():
    """
    Two actors, each with its own column of use cases.

    The actors sit on opposite edges and each connects only to the
    column beside it, so no association line crosses another or passes
    over an oval. One shared column needs sixteen lines fanning across
    the sheet, which is what made the earlier attempt a tangle.
    """
    d = Sheet(1320, 1340, "Figure 1:", "Use Case Diagram",
              "What a parishioner and a parish administrator can each do in SanctiWalk")

    pilgrim = [
        ["Sign in, or continue", "as a guest"],
        ["Choose a parish"],
        ["View the bulletin and", "Mass schedule"],
        ["Pray the Holy Rosary"],
        ["Read the church history", "and take the quiz"],
        ["Find and walk to", "the parish"],
        ["Scan with AI Scanner", "or the AR Museum tour"],
        ["Apply to a ministry", "or a sacrament"],
        ["Track status and", "notifications"],
    ]
    admin = [
        ["Sign in to the", "parish portal"],
        ["Review pending", "applications"],
        ["Approve or reject,", "with a note"],
        ["Edit parish content", "and history"],
        ["Open or close", "applications"],
        ["Post announcements"],
        ["View parish analytics"],
    ]

    d.rect(250, 120, 900, 1150, "#FFFFFF", INK, rx=RADIUS, sw=1.2, dash="6 5")
    d.text(700, 154, "SanctiWalk System", 18, "700", fill=NAVY)

    def actor(cx, cy, label):
        d.parts.append('<circle cx="%s" cy="%s" r="24" fill="#FFFFFF" stroke="%s" '
                       'stroke-width="2"/>' % (cx, cy, INK))
        d.parts.append('<path d="M%s,%s L%s,%s M%s,%s L%s,%s M%s,%s L%s,%s M%s,%s L%s,%s" '
                       'stroke="%s" stroke-width="2" fill="none" stroke-linecap="round"/>'
                       % (cx, cy + 24, cx, cy + 86, cx - 36, cy + 46, cx + 36, cy + 46,
                          cx, cy + 86, cx - 28, cy + 136, cx, cy + 86, cx + 28, cy + 136, INK))
        d.lines(cx, cy + 172, label, 17, "700")

    PX, AX = 450, 950
    actor(110, 520, ["PILGRIM"])
    actor(1230, 560, ["PARISH", "ADMINISTRATOR"])

    for i, rows in enumerate(pilgrim):
        cy = 220 + i * 120
        d.ellipse(PX, cy, 185, 46, rows, MIN_FONT, PROC, PROC_E)
        d.arrow([(146, 520), (PX - 185, cy)])

    for i, rows in enumerate(admin):
        cy = 270 + i * 120
        d.ellipse(AX, cy, 175, 46, rows, MIN_FONT, ENT, ENT_E)
        d.arrow([(1194, 560), (AX + 175, cy)])

    d.save("fig-1-use-case.svg")


# =====================================================================
# FIGURES 2 AND 3 - FLOW CHARTS
# =====================================================================
def _feature_fan(d, cx, top, w, columns, gap=18):
    """
    The row of branches that both flowcharts end in.

    Returns the bottom of each column so the caller can rejoin them,
    rather than the caller guessing where they ended - the guess is
    what left a join line cutting through the last row of boxes.
    """
    n = len(columns)
    total = n * w + (n - 1) * gap
    x0 = cx - total / 2.0
    bottoms = []
    for i, (head, steps) in enumerate(columns):
        x = x0 + i * (w + gap)
        bx = x + w / 2.0
        d.arrow([(cx, top - 44), (bx, top - 22), (bx, top)])
        d.box(x, top, w, 58, [head], PROC, PROC_E, size=MIN_FONT)
        y = top + 58
        for s in steps:
            d.plain(bx, y, bx, y + 22)
            d.box(x, y + 22, w, 58, s, "#FFFFFF", PROC_E, size=MIN_FONT)
            y += 80
        bottoms.append((bx, y))
    return bottoms


def fig2_flow_user():
    d = Sheet(1320, 1540, "Figure 2:", "Flow Chart (User Side)",
              "A parishioner's path through SanctiWalk, from opening the app to the feature they came for")
    C = 660

    d.stadium(C, 140, 240, 54, "START")
    d.arrow([(C, 167), (C, 212)])
    d.box(C - 220, 212, 440, 62, ["Open SanctiWalk (app or PWA)"], PROC, PROC_E)
    d.arrow([(C, 274), (C, 330)])

    d.diamond(C, 380, 300, 100, ["Signed in?"])
    d.box(110, 340, 300, 80, ["Sign in with Google,", "or continue as a guest"], TERM, TERM_E)
    branch(d, C, 150, 410, 380, "No")
    d.arrow([(260, 420), (260, 476), (C, 476)])
    d.text(380, 464, "Signed in", MIN_FONT, "600", "middle", MUTED)
    d.arrow([(C, 430), (C, 500)])
    d.text(C + 16, 470, "Yes", MIN_FONT, "600", "start", MUTED)

    d.box(C - 180, 500, 360, 58, ["Choose a parish"], PROC, PROC_E)
    d.arrow([(C, 558), (C, 606)])
    d.box(C - 220, 606, 440, 58, ["Home — parish bulletin"], ENT, ENT_E)
    d.arrow([(C, 664), (C, 712)])
    d.diamond(C, 762, 300, 96, ["Choose feature"])

    bottoms = _feature_fan(d, C, 866, 150, [
        ("Holy Rosary", [["Pick a mystery"], ["Pray the five", "decades"]]),
        ("Mass Schedule", [["View times", "and days"]]),
        ("Church History", [["Read the history"], ["Take the quiz"]]),
        ("Map & Navigate", [["Find the parish"], ["Walk there"]]),
        ("Scan", [["AI Scanner"], ["AR Museum tour"]]),
        ("Ministries", [["Browse and apply"], ["Track the status"]]),
        ("Sacraments", [["Choose a rite", "and apply"], ["Track the status"]]),
    ])

    join = max(b[1] for b in bottoms) + 46
    for bx, by in bottoms:
        d.plain(bx, by, bx, join)
    d.plain(min(b[0] for b in bottoms), join, max(b[0] for b in bottoms), join)
    d.arrow([(C, join), (C, join + 44)])

    d.diamond(C, join + 92, 300, 96, ["Continue?"])
    # Back to the bulletin, routed round the outside so it crosses
    # nothing on the way up.
    d.arrow([(C - 150, join + 92), (42, join + 92), (42, 635), (C - 220, 635)])
    d.text(250, join + 78, "Yes", MIN_FONT, "600", "middle", MUTED)
    d.arrow([(C, join + 140), (C, join + 188)])
    d.text(C + 16, join + 164, "No", MIN_FONT, "600", "start", MUTED)
    d.stadium(C, join + 216, 240, 54, "END")
    d.save("fig-2-flow-user.svg")


def fig3_flow_admin():
    d = Sheet(1320, 1360, "Figure 3:", "Flow Chart (Admin Side)",
              "A parish administrator's path through the portal, which appears only for a listed administrator")
    C = 660

    d.stadium(C, 140, 240, 54, "START")
    d.arrow([(C, 167), (C, 212)])
    d.box(C - 200, 212, 400, 62, ["Sign in with Google"], PROC, PROC_E)
    d.arrow([(C, 274), (C, 330)])

    d.diamond(C, 386, 360, 112, ["Listed as an", "administrator?"])
    d.box(100, 346, 310, 80, ["Stays an ordinary user —", "the portal never appears"], DEC, DEC_E)
    branch(d, C, 180, 410, 386, "No")
    d.arrow([(C, 442), (C, 506)])
    d.text(C + 16, 478, "Yes", MIN_FONT, "600", "start", MUTED)

    d.box(C - 230, 506, 460, 58, ["Admin portal for their own parish"], ENT, ENT_E)
    d.arrow([(C, 564), (C, 612)])
    d.diamond(C, 662, 300, 96, ["Choose section"])

    bottoms = _feature_fan(d, C, 766, 250, [
        ("Dashboard", [["Review an", "application"], ["Approve or reject,", "with a note"]]),
        ("Content", [["Edit history", "and photos"], ["Open or close", "applications"]]),
        ("Analytics", [["Visitors and", "AR usage"], ["Peak hours,", "engagement"]]),
        ("Database", [["Post", "announcements"], ["Parish record,", "admins"]]),
    ])

    join = max(b[1] for b in bottoms) + 46
    for bx, by in bottoms:
        d.plain(bx, by, bx, join)
    d.plain(min(b[0] for b in bottoms), join, max(b[0] for b in bottoms), join)
    d.arrow([(C, join), (C, join + 44)])

    d.diamond(C, join + 92, 300, 96, ["Continue?"])
    d.arrow([(C - 150, join + 92), (55, join + 92), (55, 535), (C - 230, 535)])
    d.text(250, join + 78, "Yes", MIN_FONT, "600", "middle", MUTED)
    d.arrow([(C, join + 140), (C, join + 188)])
    d.text(C + 16, join + 164, "No", MIN_FONT, "600", "start", MUTED)
    d.stadium(C, join + 216, 240, 54, "END")
    d.save("fig-3-flow-admin.svg")


# =====================================================================
# FIGURE 4 - DATA FLOW DIAGRAM (LEVEL 0)
# =====================================================================
def fig4_dfd0():
    """
    The six external entities the system exchanges data with.

    Labels are the whole difficulty: twelve phrases have to sit in the
    gaps around one circle. Each gap is measured first and the label
    written to fit it - two short lines, stacked clear of the arrow
    rather than straddling it.
    """
    d = Sheet(1320, 1080, "Figure 4:", "Data Flow Diagram (Level 0)",
              "SanctiWalk as a single process, and everything outside it that it exchanges data with")

    CX, CY, R = 660, 520, 130
    d.parts.append('<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>'
                   % (CX, CY, R, PROC, PROC_E, STROKE))
    d.lines(CX, CY - 28, ["0.0", "SanctiWalk", "System"], 18, "700")

    d.box(510, 150, 300, 90, ["E1", "User (public)"], ENT, ENT_E, size=16)
    d.box(40, 400, 290, 90, ["E2", "Parish admin"], ENT, ENT_E, size=16)
    d.box(990, 320, 290, 100, ["E3", "SanctiWalk AR app", "(Unity / ARCore)"], ENT, ENT_E, size=16)
    d.box(990, 620, 290, 90, ["E4", "Google / Firebase"], ENT, ENT_E, size=16)
    d.box(40, 660, 290, 100, ["E5", "AI vision service", "(Gemini)"], ENT, ENT_E, size=16)
    d.box(510, 880, 300, 100, ["E6", "Map & routing", "services"], ENT, ENT_E, size=16)

    # User, straight down the middle.
    d.arrow([(600, 240), (600, CY - R + 10)])
    d.lines(470, 300, ["requests: browse, pray,", "apply, scan, navigate"], MIN_FONT, "600", "end", MUTED)
    d.arrow([(730, CY - R + 10), (730, 240)])
    d.lines(860, 300, ["bulletin, schedules,", "history, status, alerts"], MIN_FONT, "600", "start", MUTED)

    # Parish admin, left.
    d.arrow([(330, 428), (CX - R + 14, CY - 54)])
    d.lines(370, 382, ["content", "& decisions"], MIN_FONT, "600", "start", MUTED)
    d.arrow([(CX - R + 6, CY - 10), (330, 470)])
    d.lines(370, 502, ["applications,", "analytics"], MIN_FONT, "600", "start", MUTED)

    # AR app, upper right.
    d.arrow([(CX + R - 14, CY - 54), (990, 352)])
    d.lines(950, 322, ["parish id", "(deep link)"], MIN_FONT, "600", "end", MUTED)
    d.arrow([(990, 396), (CX + R - 6, CY - 10)])
    d.lines(950, 420, ["tour", "handed back"], MIN_FONT, "600", "end", MUTED)

    # Firebase, lower right.
    d.arrow([(CX + R - 6, CY + 32), (990, 652)])
    d.lines(950, 622, ["sign-in,", "reads & writes"], MIN_FONT, "600", "end", MUTED)
    d.arrow([(990, 694), (CX + R - 18, CY + 74)])
    d.lines(950, 718, ["identity,", "documents"], MIN_FONT, "600", "end", MUTED)

    # Gemini, lower left.
    d.arrow([(CX - R + 6, CY + 32), (330, 690)])
    d.lines(370, 660, ["photograph"], MIN_FONT, "600", "start", MUTED)
    d.arrow([(330, 730), (CX - R + 18, CY + 74)])
    d.lines(370, 754, ["identification"], MIN_FONT, "600", "start", MUTED)

    # Map services, bottom.
    d.arrow([(600, CY + R - 10), (600, 880)])
    d.lines(580, 790, ["where am I"], MIN_FONT, "600", "end", MUTED)
    d.arrow([(730, 880), (730, CY + R - 10)])
    d.lines(750, 790, ["tiles,", "walking route"], MIN_FONT, "600", "start", MUTED)

    d.save("fig-4-dfd-level0.svg")


# =====================================================================
# FIGURE 5 - DATA FLOW DIAGRAM (LEVEL 1)
# =====================================================================
def fig5_dfd1():
    """
    One process per row, with the stores it touches beside it.

    The paper's version put six circles in a line with the stores in a
    row underneath, and every flow then had to cross the band between
    them. Rows keep each flow to a short horizontal run across an
    empty gutter, which is where its label goes. Same six processes,
    same six stores - only the arrangement changes.
    """
    rows = [
        ("1.0", ["Sign in &", "choose parish"], ["E1", "User"],
         [("D1", "users", "profile, language, progress", "account, language")]),
        ("2.0", ["View bulletin", "& schedule"], ["E1", "User"],
         [("D2", "churches & parishContent", "history, Mass times, theme", "parish content"),
          ("D3", "announcements", "parish notices", "notices")]),
        ("3.0", ["Pray the", "Rosary"], ["E1", "User"],
         [("D1", "users", "mystery, language, place kept", "progress")]),
        ("4.0", ["Read history", "& take quiz"], ["E1", "User"],
         [("D2", "churches & parishContent", "history text and photographs", "history"),
          ("D6", "visits & activity", "presence and analytics", "quiz score")]),
        ("5.0", ["Scan & run", "AR tour"], ["E3", "AR app (Unity)"],
         [("D6", "visits & activity", "presence and analytics", "scan event")]),
        ("6.0", ["Apply & track", "status"], ["E2", "Parish admin"],
         [("D4", "applications", "ministry & sacraments, with audit trail", "application"),
          ("D5", "notifications", "decisions sent to the applicant", "decision")]),
    ]

    gap, store_h, row_pad = 20, 76, 54
    heights = [max(150, len(r[3]) * (store_h + gap) - gap + 16) for r in rows]
    total = sum(h + row_pad for h in heights)

    d = Sheet(SHEET_W, 150 + total + 140, "Figure 5:", "Data Flow Diagram (Level 1)",
              "One process per row, with the entity it serves and the data stores it reads and writes")

    EX, EW = 50, 230
    PX, PW = 340, 400
    SX, SW = 858, 418

    y = 140
    for (num, prows, ent, stores), h in zip(rows, heights):
        cy = y + h / 2.0
        d.box(EX, cy - 44, EW, 88, ent, ENT, ENT_E, size=16)
        d.arrow([(EX + EW, cy), (PX, cy)])

        d.rect(PX, cy - h / 2.0 + 8, PW, h - 16, PROC, PROC_E, rx=PROC_R)
        d.text(PX + PW / 2.0, cy - 30, num, 20, "700", fill=PROC_E)
        d.lines(PX + PW / 2.0, cy + 6, prows, 17, "600")

        for i, (ref, name, fields, label) in enumerate(stores):
            sy = y + 8 + i * (store_h + gap)
            scy = sy + store_h / 2.0
            d.rect(SX, sy, SW, store_h, STORE, STORE_E, rx=RADIUS)
            d.plain(SX + 54, sy, SX + 54, sy + store_h, sw=STROKE)
            d.text(SX + 27, scy + 6, ref, 18, "700", fill=STORE_E)
            d.text(SX + 68, scy - 8, name, 16, "600", "start")
            d.text(SX + 68, scy + 16, fields, MIN_FONT, "400", "start", MUTED)
            d.arrow([(PX + PW, cy), (800, cy), (800, scy), (SX, scy)], both=True)
            d.text(PX + PW + 14, scy - 13, label, MIN_FONT, "600", "start", MUTED)

        y += h + row_pad

    d.text(EX, y + 10, "LEGEND", MIN_FONT, "700", "start", MUTED)
    d.rect(EX, y + 28, 30, 21, ENT, ENT_E)
    d.text(EX + 40, y + 44, "External entity (square)", MIN_FONT, "400", "start", MUTED)
    d.rect(EX, y + 59, 30, 21, PROC, PROC_E, rx=PROC_R)
    d.text(EX + 40, y + 75, "Process (rounded)", MIN_FONT, "400", "start", MUTED)
    d.rect(EX, y + 90, 30, 21, STORE, STORE_E)
    d.text(EX + 40, y + 106, "Data store", MIN_FONT, "400", "start", MUTED)
    d.save("fig-5-dfd-level1.svg")


# =====================================================================
# FIGURE 6 - ENTITY RELATIONSHIP DIAGRAM
# =====================================================================
def entity(d, x, y, w, name, path, rows, fill=PROC, edge=PROC_E):
    """One collection: its name, its document path, then its fields."""
    h = 70 + len(rows) * 25
    d.rect(x, y, w, h, "#FFFFFF", edge, rx=RADIUS)
    d.rect(x, y, w, 48, fill, edge, rx=RADIUS)
    d.rect(x, y + 32, w, 16, fill, fill, rx=0, sw=0)
    d.plain(x, y + 48, x + w, y + 48, sw=STROKE)
    d.text(x + w / 2.0, y + 22, name, 17, "700", fill=edge)
    d.text(x + w / 2.0, y + 41, path, MIN_FONT, "400", fill=MUTED, mono=True)
    ty = y + 72
    for key, field in rows:
        d.text(x + 14, ty, key, MIN_FONT, "700", "start", fill=edge, mono=True)
        d.text(x + 54, ty, field, MIN_FONT, "400", "start", mono=True)
        ty += 25
    return h


def fig6_erd():
    """
    Nine collections on one sheet, in three columns.

    1120px wide rather than the usual 1320: a narrower sheet printed
    at the same page width makes every label physically larger, which
    is what this figure needs most - it carries more text than any
    other.
    """
    d = Sheet(1120, 1400, "Figure 6:", "Entity-Relationship Diagram",
              "Cloud Firestore. PK = document id, FK = a reference to another collection. There are no joins; references are resolved by the client.")

    L, M, R = 25, 410, 795
    W = 300

    h_users = entity(d, L, 130, W, "users", "users/{uid}", [
        ("PK", "uid : string"),
        ("", "email : string"),
        ("", "fullName : string"),
        ("", "nickname : string?"),
        ("", "photoUrl : string?"),
        ("", "phoneNumber : string?"),
        ("", "role : user |"),
        ("", "  church_admin"),
        ("FK", "churchId : string"),
        ("", "preferredLanguage :"),
        ("", "  en | fil"),
        ("", "points / steps : number?"),
        ("", "completedStations :"),
        ("", "  string[]"),
        ("", "badges : string[]"),
        ("", "lastActiveAt : timestamp"),
        ("", "createdAt / updatedAt"),
    ])

    h_ch = entity(d, M, 130, W, "churches", "churches/{churchId}", [
        ("PK", "id : string"),
        ("", "name : string"),
        ("", "location : string"),
        ("", "contactEmail : string?"),
        ("", "contactNumber : string?"),
        ("FK", "adminUid : string"),
        ("", "createdAt / updatedAt"),
    ], ENT, ENT_E)

    h_app = entity(d, R, 130, W, "applications", "applications/{id}", [
        ("PK", "id : string"),
        ("FK", "uid : string"),
        ("FK", "churchId : string"),
        ("", "kind : sacrament |"),
        ("", "  ministry"),
        ("", "itemId : string"),
        ("", "type : string"),
        ("", "applicantName / Email"),
        ("", "referenceNumber : string"),
        ("", "formData : map"),
        ("", "documentPaths : string[]"),
        ("", "status : pending |"),
        ("", "  under_review |"),
        ("", "  approved | rejected |"),
        ("", "  completed"),
        ("", "adminNote : string?"),
        ("FK", "reviewedBy / reviewedAt"),
        ("", "history : event[]"),
        ("", "createdAt / updatedAt"),
    ], STORE, STORE_E)

    PC_Y = 130 + h_ch + 70
    h_pc = entity(d, M, PC_Y, W, "parishContent", "parishContent/{parishId}", [
        ("PK", "parishId (= churchId)"),
        ("", "description : string"),
        ("", "photoUrl : string?"),
        ("", "historyTitle / historyBody"),
        ("", "historyPhotoUrl : string?"),
        ("", "commemorationText"),
        ("", "massSchedule : Mass[]"),
        ("", "massImageUrl : string?"),
        ("", "themeColor : string"),
        ("", "closedApplications :"),
        ("", "  string[]"),
        ("", "itemContent : map"),
        ("", "updatedBy / updatedAt"),
    ], ENT, ENT_E)

    NOT_Y = 130 + h_app + 70
    h_not = entity(d, R, NOT_Y, W, "notifications", "notifications/{id}", [
        ("PK", "id : string"),
        ("FK", "userId : string"),
        ("FK", "churchId : string"),
        ("FK", "applicationId : string"),
        ("", "title : string"),
        ("", "body : string"),
        ("", "createdAt : timestamp"),
        ("", "readAt : timestamp | null"),
    ], STORE, STORE_E)

    ANN_Y = NOT_Y + h_not + 60
    entity(d, R, ANN_Y, W, "announcements", "announcements/{id}", [
        ("PK", "id : string"),
        ("FK", "churchId : string"),
        ("", "title : string"),
        ("", "body : string"),
        ("", "date : string"),
        ("", "time : string"),
    ], STORE, STORE_E)

    VIS_Y = 130 + h_users + 70
    h_vis = entity(d, L, VIS_Y, W, "visits", "visits/{id}", [
        ("PK", "id : string"),
        ("FK", "uid : string"),
        ("FK", "churchId : string"),
        ("", "at : timestamp"),
        ("", "createdAt : server time"),
    ], DEC, DEC_E)

    ACT_Y = VIS_Y + h_vis + 55
    h_act = entity(d, L, ACT_Y, W, "activity", "activity/{entryId}", [
        ("PK", "entryId : string"),
        ("FK", "uid : string"),
        ("", "action / detail : string"),
        ("", "createdAt : timestamp"),
    ], DEC, DEC_E)

    ADM_Y = ACT_Y + h_act + 55
    entity(d, L, ADM_Y, W, "admins", "admins/{uid}", [
        ("PK", "uid (= users uid)"),
        ("FK", "churchId : string"),
        ("", "presence grants the role"),
    ], DEC, DEC_E)

    def rel(x1, y1, x2, y2, card, verb, lx, ly):
        """Cardinality above the line, verb below, both in the gutter."""
        d.arrow([(x1, y1), (x2, y2)], both=True)
        d.text(lx, ly, card, MIN_FONT, "700", fill=MUTED)
        d.text(lx, ly + 20, verb, MIN_FONT, "400", fill=MUTED)

    rel(L + W, 250, M, 250, "N : 1", "belongs", (L + W + M) / 2.0, 222)
    rel(M + W, 250, R, 250, "1 : N", "receives", (M + W + R) / 2.0, 222)

    # Vertical pairs: the label goes beside the line, never on it.
    d.arrow([(M + 150, 130 + h_ch), (M + 150, PC_Y)], both=True)
    d.text(M + 168, (130 + h_ch + PC_Y) / 2.0 - 4, "1 : 1", MIN_FONT, "700", "start", MUTED)
    d.text(M + 168, (130 + h_ch + PC_Y) / 2.0 + 16, "extends", MIN_FONT, "400", "start", MUTED)

    d.arrow([(R + 150, 130 + h_app), (R + 150, NOT_Y)], both=True)
    d.text(R + 168, (130 + h_app + NOT_Y) / 2.0 - 4, "1 : N", MIN_FONT, "700", "start", MUTED)
    d.text(R + 168, (130 + h_app + NOT_Y) / 2.0 + 16, "notifies", MIN_FONT, "400", "start", MUTED)

    # churches -> announcements, routed orthogonally up the gutter
    # rather than as a diagonal across the middle of the sheet.
    lane = M + W + 35
    d.arrow([(R, ANN_Y + 60), (lane, ANN_Y + 60), (lane, 340), (M + W, 340)], both=True)
    # Centred in the gutter, not started at the lane: left-aligned it
    # ran 38px into the applications box.
    d.text((M + W + R) / 2.0, 560, "N : 1", MIN_FONT, "700", "middle", MUTED)
    d.text((M + W + R) / 2.0, 580, "posted by", MIN_FONT, "400", "middle", MUTED)

    d.text(L + 150, VIS_Y - 24, "each row holds a uid", MIN_FONT, "600", fill=MUTED)
    d.plain(L + 150, 130 + h_users, L + 150, VIS_Y - 40, sw=STROKE)

    d.save("fig-6-erd.svg")


# =====================================================================
# FIGURES 7 AND 8 - HIPO CHARTS
# =====================================================================
def hipo(number, title, subtitle, root, columns, filename, width=SHEET_W):
    """
    A visual table of contents: the root, its modules, and their steps.

    The sub-boxes carry the module number on its own line above the
    label. Keeping them on one line needs a wider box than seven
    columns allow, and widening the sheet would shrink every label on
    the printed page.
    """
    n = len(columns)
    deepest = max(len(c[2]) for c in columns)
    h = 300 + deepest * 86 + 90
    d = Sheet(width, h, number, title, subtitle)

    span = width - 100
    w = min(250, (span - (n - 1) * 16) / float(n))
    gap = (span - w * n) / float(n - 1)

    d.box(width / 2.0 - 210, 120, 420, 70, [root], TERM, TERM_E, size=18)

    for i, (num, name, steps) in enumerate(columns):
        x = 50 + i * (w + gap)
        cx = x + w / 2.0
        d.arrow([(width / 2.0, 190), (cx, 232), (cx, 262)])
        d.box(x, 262, w, 72, [num, name], PROC, PROC_E, size=16)
        y = 334
        for s in steps:
            d.plain(cx, y, cx, y + 20, sw=STROKE)
            d.box(x, y + 20, w, 66, s, "#FFFFFF", PROC_E, size=MIN_FONT)
            y += 86
    d.save(filename)


def fig7_hipo_user():
    hipo("Figure 7:", "HIPO Chart (User Side)",
         "Visual table of contents for the parishioner's side of SanctiWalk",
         "SanctiWalk (User)",
         [("1.0", "Access", [["1.1 Sign in with", "Google"], ["1.2 Continue as", "a guest"],
                             ["1.3 Choose a parish"], ["1.4 Set the language"]]),
          ("2.0", "Home", [["2.1 Parish bulletin"], ["2.2 Verse of the day"],
                           ["2.3 Announcements"], ["2.4 Ask Sancti"]]),
          ("3.0", "Worship", [["3.1 Mass schedule"], ["3.2 Holy Rosary"],
                              ["3.3 Pick a mystery"], ["3.4 Pray, undo, next"]]),
          ("4.0", "Heritage", [["4.1 Church history"], ["4.2 Photographs"],
                               ["4.3 History quiz"], ["4.4 See the score"]]),
          ("5.0", "Discover", [["5.1 Map of the parish"], ["5.2 Walk there"],
                               ["5.3 AI Scanner"], ["5.4 AR Museum tour"]]),
          ("6.0", "Participate", [["6.1 Browse ministries"], ["6.2 Choose a", "sacrament"],
                                  ["6.3 Submit application"], ["6.4 Track the status"]]),
          ("7.0", "Account", [["7.1 My profile"], ["7.2 My applications"],
                              ["7.3 Notifications"]])],
         "fig-7-hipo-user.svg")


def fig8_hipo_admin():
    hipo("Figure 8:", "HIPO Chart (Admin Side)",
         "Visual table of contents for the parish office portal",
         "SanctiWalk Admin Portal",
         [("1.0", "Access", [["1.1 Sign in with Google"], ["1.2 Admin check"],
                             ["1.3 Scoped to own parish"]]),
          ("2.0", "Dashboard", [["2.1 Pending applications"], ["2.2 Review an application"],
                                ["2.3 Approve or reject"], ["2.4 Leave a note"]]),
          ("3.0", "Content", [["3.1 Parish description"], ["3.2 Church history & photo"],
                              ["3.3 Mass schedule"], ["3.4 Open / close applications"]]),
          ("4.0", "Analytics", [["4.1 Total visitors"], ["4.2 AR usage"],
                                ["4.3 Peak visiting hours"], ["4.4 Engagement rate"]]),
          ("5.0", "Database", [["5.1 Announcements"], ["5.2 Parish record"],
                               ["5.3 Admin accounts"]])],
         "fig-8-hipo-admin.svg")


def main():
    print("Building the capstone figures at a readable scale...")
    fig1_use_case()
    fig2_flow_user()
    fig3_flow_admin()
    fig4_dfd0()
    fig5_dfd1()
    fig6_erd()
    fig7_hipo_user()
    fig8_hipo_admin()
    print("Done. Now run: python scripts/render-figs.py")


if __name__ == "__main__":
    main()
