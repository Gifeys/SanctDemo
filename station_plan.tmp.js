const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, WidthType, AlignmentType, ShadingType, BorderStyle,
  LevelFormat, PageBreak,
} = require("docx");

const NAVY = "142C56";
const INK = "14171F";
const MUTED = "5A6B8C";
const HAIR = "DBE5F5";
const TINT = "EEF3FC";

const W = 9360;              // usable width on A4 with 1" margins, in DXA
const COLS = [640, 1180, 2600, 2400, 2540];

function cell(children, opts = {}) {
  return new TableCell({
    width: { size: opts.w, type: WidthType.DXA },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    children,
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 0, before: opts.before ?? 0 },
    alignment: opts.align,
    children: [new TextRun({
      text,
      bold: opts.bold,
      italics: opts.italics,
      size: (opts.size ?? 10) * 2,
      color: opts.color ?? INK,
      font: "Calibri",
    })],
  });
}

function head(text) {
  return cell([p(text, { bold: true, size: 9, color: "FFFFFF" })],
    { w: 0, fill: NAVY });
}

// ---------------------------------------------------------------- the table
const HEADERS = ["#", "Side", "What it is (the real object)", "Station name shown in the app", "Content"];

function headerRow() {
  return new TableRow({
    tableHeader: true,
    children: HEADERS.map((h, i) => new TableCell({
      width: { size: COLS[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: NAVY },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      children: [p(h, { bold: true, size: 9, color: "FFFFFF" })],
    })),
  });
}

// Two worked examples, then blank rows. The examples are marked so nobody
// ships them by accident.
const EXAMPLES = [
  ["1", "Left", "Main altar", "Ang Dambana", "panel-01.png"],
  ["2", "Right", "Statue of Maria Auxiliadora", "Maria Auxiliadora", "panel-02.png"],
];

function bodyRow(values, { example = false } = {}) {
  return new TableRow({
    children: values.map((v, i) => new TableCell({
      width: { size: COLS[i], type: WidthType.DXA },
      shading: example ? { type: ShadingType.CLEAR, fill: TINT } : undefined,
      margins: { top: 130, bottom: 130, left: 120, right: 120 },
      children: [p(v, { color: example ? MUTED : INK, italics: example })],
    })),
  });
}

const rows = [headerRow()];
EXAMPLES.forEach(e => rows.push(bodyRow(e, { example: true })));
for (let i = 3; i <= 16; i++) rows.push(bodyRow([String(i), "", "", "", ""]));

const table = new Table({
  columnWidths: COLS,
  width: { size: W, type: WidthType.DXA },
  rows,
});

// ---------------------------------------------------------------- document
const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 240 } } },
      }],
    }],
  },
  sections: [{
    properties: { page: { margin: { top: 1440, bottom: 1440, left: 1080, right: 1080 } } },
    children: [
      p("SANCTIWALK", { bold: true, size: 9, color: MUTED }),
      new Paragraph({
        spacing: { after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: HAIR, space: 10 } },
        children: [new TextRun({
          text: "Station plan — Mary Help of Christians Parish",
          bold: true, size: 30, color: NAVY, font: "Calibri",
        })],
      }),

      p("Fill this in before the church is scanned. Once the scan exists, every station on this sheet is placed by clicking it on the scan — nothing here has to be decided on the day.",
        { color: MUTED, after: 260 }),

      p("How to fill it in", { bold: true, size: 13, color: NAVY, after: 120 }),

      p("Walk the aisle from the main door towards the altar and list the stations in the order somebody meets them. Number them 1, 2, 3 in that walking order, and say which side each one is on. Left and right are as you face the altar.", { after: 120 }),

      p("Put them in facing pairs where you can — 1 on the left and 2 on the right at roughly the same point in the aisle, then 3 and 4 further up. A visitor standing between them sees one on each side, which is what makes it read as a walk rather than a list.", { after: 120 }),

      p("Keep them at least three or four paces apart along the aisle. Two stations closer than that both trigger at once and the app has to pick one, so the visitor gets whichever is marginally nearer rather than the one they are looking at.", { after: 260 }),

      p("The columns", { bold: true, size: 13, color: NAVY, after: 120 }),

      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 },
        children: [new TextRun({ text: "What it is — the real, physical thing in the church. This is what gets pointed at on the scan, so name something anyone can find: “the statue in the left niche”, not “devotion area”.", size: 20, font: "Calibri", color: INK })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 },
        children: [new TextRun({ text: "Station name — the short label that floats over it in the app. Two or three words. It has to fit on a pill.", size: 20, font: "Calibri", color: INK })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 260 },
        children: [new TextRun({ text: "Content — the file name of the panel image for that station. See over.", size: 20, font: "Calibri", color: INK })] }),

      table,

      new Paragraph({ children: [new PageBreak()] }),

      p("The content for each station", { bold: true, size: 13, color: NAVY, after: 120 }),

      p("The four history panels already in the app are the model, and they work well: one designed image per station, carrying its own heading, its own paragraph and its own photograph. The app shows that image full screen and puts nothing around it.", { after: 120 }),

      p("That is the format to aim for, because it keeps the parish in control of how its own history reads — the wording, the photographs and the layout are all yours, and none of it has to survive being retyped.", { after: 200 }),

      p("What each image should be", { bold: true, size: 11, after: 100 }),

      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 },
        children: [new TextRun({ text: "Landscape, roughly 16:9. Around 1400 pixels wide is plenty — it is shown a few hundred pixels wide on a phone and a larger file only makes the app slower to open.", size: 20, font: "Calibri", color: INK })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 },
        children: [new TextRun({ text: "PNG or JPG. Named simply — panel-01.png, panel-02.png — and the same name written in the Content column above.", size: 20, font: "Calibri", color: INK })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 },
        children: [new TextRun({ text: "Text large enough to read on a phone held at arm's length. If it is hard to read on your own screen at a quarter size, it will be hard to read in the church.", size: 20, font: "Calibri", color: INK })] }),

      p("If you would rather send words than images", { bold: true, size: 11, after: 100 }),

      p("Type the heading and the paragraph into the Content column instead and send any photographs separately, named to match. It will be laid out in the app's own style rather than yours, which is the trade.", { after: 260 }),

      p("What happens once the church is scanned", { bold: true, size: 13, color: NAVY, after: 120 }),

      p("Send the MultiSet scan. The scan is opened in the station placer — the same tool used for the test room — with every station on this sheet already listed down the side. Click one, then click the real object on the scan. Repeat, and save.", { after: 120 }),

      p("The positions go into the app and the next build carries them to every phone. Nobody has to place anything again, and a visitor who has never set the app up sees the stations where they belong.", { after: 200 }),

      p("The one thing that cannot be prepared in advance is the scan itself. Everything on this sheet can be finished before it exists.", { italics: true, color: MUTED }),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(process.argv[2], buf);
  console.log("wrote", process.argv[2], buf.length, "bytes");
});
