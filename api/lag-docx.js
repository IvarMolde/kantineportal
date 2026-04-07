// api/lag-docx.js
// Vercel serverless function – bygger .docx på server med docx npm-pakken
// Mye mer pålitelig enn å bygge ZIP i nettleseren

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, HeadingLevel,
  VerticalAlign, PageBreak
} = require('docx');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ feil: 'Kun POST er tillatt' });

  const { passord, innhold, temaNavn, nivå, ord } = req.body;

  // Passordsjekk
  const riktigPassord = process.env.APP_PASSORD;
  if (!riktigPassord) return res.status(500).json({ feil: 'APP_PASSORD ikke konfigurert.' });
  if (passord !== riktigPassord) return res.status(401).json({ feil: 'Feil passord.' });

  if (!innhold) return res.status(400).json({ feil: 'Mangler innhold.' });

  try {
    const doc = byggDocx(innhold, temaNavn || '', nivå || '', ord || []);
    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${lagFilnavn(temaNavn, nivå)}"`);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('lag-docx feil:', err);
    return res.status(500).json({ feil: 'Feil ved generering av Word-fil: ' + err.message });
  }
};

// ── FARGER ────────────────────────────────────────────────
const C = {
  NAVY:    '1F4E79',
  NAVY2:   '163A5A',
  TEAL:    '1D6A5B',
  AMBER:   'E8A030',
  LBLUE:   'E8F4FD',
  LGREEN:  'EAF7F0',
  LYELLOW: 'FFFBEC',
  LGRAY:   'F5F5F5',
  LPEACH:  'FFF0E8',
  WHITE:   'FFFFFF',
  DARK:    '1A1A1A',
  GRAY:    '555555',
  LGRAY2:  'F4FAF6',
};

// Dagfarger
const DAG_FARGE = {
  MANDAG: { bg: '1F4E79', light: 'EBF3FB' },
  TIRSDAG: { bg: '1D6A5B', light: 'EAF7F0' },
  ONSDAG: { bg: '7B4F00', light: 'FFF8E8' },
  TORSDAG: { bg: '5B2D6E', light: 'F5EEF8' },
  FREDAG: { bg: '8B1A1A', light: 'FDECEA' },
};

// ── HELPERS ───────────────────────────────────────────────
function f(hex) { return { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16) }; }

function rens(t) { return t.replace(/\*\*([^*]+)\*\*/g, '$1').trim(); }

function tekstRun(tekst, opts = {}) {
  return new TextRun({
    text: tekst,
    font: 'Calibri',
    size: opts.size || 22,
    bold: opts.bold || false,
    color: opts.color || C.DARK,
    ...opts.extra
  });
}

function avsnitt(tekst, opts = {}) {
  return new Paragraph({
    children: [tekstRun(tekst, opts)],
    spacing: { before: opts.before || 80, after: opts.after || 80, line: opts.line || 276 },
    indent: opts.indent ? { left: opts.indent } : undefined,
    alignment: opts.align || AlignmentType.LEFT,
  });
}

function shadedAvsnitt(tekst, fyllFarge, tekstFarge, sz = 24, bold = true) {
  return new Paragraph({
    children: [new TextRun({ text: tekst, font: 'Calibri', size: sz, bold, color: tekstFarge })],
    shading: { type: ShadingType.CLEAR, fill: fyllFarge },
    spacing: { before: 160, after: 80 },
    indent: { left: 120, right: 120 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: tekstFarge, space: 4 }
    }
  });
}

function dagAvsnitt(dagNavn, farge) {
  const no = { MANDAG:'Mandag', TIRSDAG:'Tirsdag', ONSDAG:'Onsdag', TORSDAG:'Torsdag', FREDAG:'Fredag' };
  return new Paragraph({
    children: [new TextRun({ text: no[dagNavn] || dagNavn, font: 'Calibri', size: 32, bold: true, color: C.WHITE })],
    shading: { type: ShadingType.CLEAR, fill: farge },
    spacing: { before: 320, after: 120 },
    indent: { left: 160 },
  });
}

function lesetekstAvsnitt(tekst, dagFarge, dagLys) {
  return new Paragraph({
    children: [new TextRun({ text: tekst, font: 'Calibri', size: 22, bold: true, color: dagFarge })],
    shading: { type: ShadingType.CLEAR, fill: dagLys },
    spacing: { before: 180, after: 60 },
    indent: { left: 160 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: dagFarge, space: 4 } },
  });
}

function oppgaveAvsnitt(tekst, dagFarge) {
  return new Paragraph({
    children: [new TextRun({ text: tekst, font: 'Calibri', size: 22, bold: true, color: dagFarge })],
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: dagFarge, space: 4 } },
  });
}

function subItemAvsnitt(tekst, erFasit = false) {
  return new Paragraph({
    children: [new TextRun({ text: tekst, font: 'Calibri', size: 22, color: erFasit ? C.GRAY : C.DARK })],
    spacing: { before: 60, after: 60 },
    indent: { left: 480, hanging: 240 },
    shading: erFasit ? { type: ShadingType.CLEAR, fill: 'F9F9F9' } : undefined,
  });
}

function bulletAvsnitt(tekst) {
  return new Paragraph({
    children: [new TextRun({ text: tekst, font: 'Calibri', size: 22, color: '333333' })],
    spacing: { before: 40, after: 40 },
    indent: { left: 480, hanging: 240 },
  });
}

function muntligAvsnitt(tekst) {
  return new Paragraph({
    children: [new TextRun({ text: tekst, font: 'Calibri', size: 22, bold: true, color: '7A5C00' })],
    shading: { type: ShadingType.CLEAR, fill: C.LYELLOW },
    spacing: { before: 160, after: 120 },
    indent: { left: 200, right: 200 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 6, color: C.AMBER, space: 4 },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: C.AMBER, space: 4 },
      left: { style: BorderStyle.SINGLE, size: 18, color: C.AMBER, space: 6 },
      right: { style: BorderStyle.SINGLE, size: 6, color: C.AMBER, space: 4 },
    },
  });
}

function skillelinje(color = 'D0D0D0') {
  return new Paragraph({
    children: [new TextRun({ text: '' })],
    spacing: { before: 60, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color, space: 4 } },
  });
}

// ── TOPPTEKST-TABELL ──────────────────────────────────────
function topptekstTabell(temaNavn, nivå) {
  const cellMargin = { top: 160, bottom: 160, left: 240, right: 160 };

  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [5400, 3626],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 5400, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: C.NAVY },
            margins: cellMargin,
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Molde voksenopplæringssenter', font: 'Calibri', size: 24, bold: true, color: C.WHITE })],
                spacing: { after: 0 },
              }),
              new Paragraph({
                children: [new TextRun({ text: 'MBO – Kantinemedarbeider', font: 'Calibri', size: 18, color: 'AACCDD' })],
                spacing: { after: 0 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 3626, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: C.NAVY2 },
            margins: { top: 160, bottom: 160, left: 200, right: 240 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [new TextRun({ text: `${temaNavn}  |  ${nivå}`, font: 'Calibri', size: 24, bold: true, color: 'FFD966' })],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 0 },
              }),
            ],
          }),
        ],
      }),
      // Navn/dato-rad
      new TableRow({
        children: [
          new TableCell({
            width: { size: 4500, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 0 },
            borders: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, top: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL } },
            children: [new Paragraph({ children: [new TextRun({ text: 'Navn: ___________________________', font: 'Calibri', size: 20, color: '444444' })], spacing: { after: 0 } })],
          }),
          new TableCell({
            width: { size: 2263, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 80 },
            borders: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, top: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL } },
            children: [new Paragraph({ children: [new TextRun({ text: 'Dato: ________________', font: 'Calibri', size: 20, color: '444444' })], spacing: { after: 0 } })],
          }),
          new TableCell({
            width: { size: 2263, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 80, right: 0 },
            borders: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, top: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL } },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Uke: ________', font: 'Calibri', size: 20, color: '444444' })], spacing: { after: 0 } })],
          }),
        ],
      }),
    ],
  });
}

// ── ORDLISTE-TABELL ───────────────────────────────────────
function ordlisteTabell(ord) {
  const borderNone = { style: BorderStyle.NIL };
  const borderLight = { style: BorderStyle.SINGLE, size: 4, color: 'C8E6C9' };
  const borderGreen = { style: BorderStyle.SINGLE, size: 6, color: C.TEAL };

  const cMarg = { top: 80, bottom: 80, left: 160, right: 160 };

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        width: { size: 500, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: C.LGREEN },
        margins: cMarg,
        borders: { top: borderGreen, bottom: borderLight, left: borderNone, right: borderNone },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'Nr.', font: 'Calibri', size: 20, bold: true, color: C.TEAL })] })],
      }),
      new TableCell({
        width: { size: 4726, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: C.LGREEN },
        margins: cMarg,
        borders: { top: borderGreen, bottom: borderLight, left: borderNone, right: borderNone },
        children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: 'Norsk ord / uttrykk / setning', font: 'Calibri', size: 20, bold: true, color: C.TEAL })] })],
      }),
      new TableCell({
        width: { size: 3800, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: C.LGREEN },
        margins: cMarg,
        borders: { top: borderGreen, bottom: borderLight, left: borderNone, right: borderNone },
        children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: 'Oversettelse til mitt morsmål', font: 'Calibri', size: 20, bold: true, color: C.TEAL })] })],
      }),
    ],
  });

  const dataRows = [];
  for (let i = 0; i < 15; i++) {
    const radFyll = i % 2 === 0 ? C.WHITE : C.LGRAY2;
    const ordTekst = ord && ord[i] ? rens(ord[i]) : '';
    dataRows.push(new TableRow({
      height: { value: 560, rule: 'atLeast' },
      children: [
        new TableCell({
          width: { size: 600, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: radFyll },
          margins: cMarg,
          verticalAlign: VerticalAlign.CENTER,
          borders: { top: borderLight, bottom: borderLight, left: borderNone, right: borderNone },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: String(i + 1), font: 'Calibri', size: 20, bold: true, color: C.TEAL })] })],
        }),
        new TableCell({
          width: { size: 4726, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: radFyll },
          margins: cMarg,
          verticalAlign: VerticalAlign.CENTER,
          borders: { top: borderLight, bottom: borderLight, left: borderNone, right: borderNone },
          children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: ordTekst, font: 'Calibri', size: 22, color: C.DARK })] })],
        }),
        new TableCell({
          width: { size: 3800, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: 'FAFFF8' },
          margins: cMarg,
          borders: { top: borderLight, bottom: borderLight, left: borderNone, right: borderNone },
          children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '', font: 'Calibri', size: 22 })] })],
        }),
      ],
    }));
  }

  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [500, 4726, 3800],
    rows: [headerRow, ...dataRows],
  });
}

// ── HOVED: BYGG DOCUMENT ─────────────────────────────────
function byggDocx(innhold, temaNavn, nivå, ord) {
  const linjer = innhold.split('\n');
  const children = [];

  const DAGER = ['MANDAG', 'TIRSDAG', 'ONSDAG', 'TORSDAG', 'FREDAG'];
  let aktivDagFarge = C.NAVY;
  let aktivDagLys = 'EBF3FB';
  let inFasit = false;
  let prevBlank = false;

  // Topptekst
  children.push(topptekstTabell(temaNavn, nivå));
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  let i = 0;
  while (i < linjer.length) {
    const linje = linjer[i].trim();

    // Skip header og separator-linjer
    if (!linje ||
        linje.startsWith('Molde voksen') ||
        linje.startsWith('Navn:') ||
        linje.startsWith('TOPPTEKST') ||
        linje.startsWith('Tema: ') ||
        linje.startsWith('═══') ||
        linje.startsWith('════')) {
      if (!linje && !prevBlank) {
        children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        prevBlank = true;
      } else prevBlank = false;
      i++; continue;
    }
    prevBlank = false;

    // Horisontale linjer
    if (linje.startsWith('───')) {
      children.push(skillelinje());
      i++; continue;
    }

    // Markdown-tabell – hopp over (ordliste lages fra ord-array)
    if (linje.startsWith('|')) {
      while (i < linjer.length && linjer[i].trim().startsWith('|')) i++;
      continue;
    }

    // ORDLISTE-linjer fra AI (ORDLISTE:1. ord...)
    if (linje.startsWith('ORDLISTE:')) { i++; continue; }

    // FASIT
    if (linje === 'FASIT') {
      inFasit = true;
      children.push(new Paragraph({ spacing: { before: 400, after: 0 }, border: { top: { style: BorderStyle.SINGLE, size: 12, color: C.NAVY, space: 4 } }, children: [] }));
      children.push(shadedAvsnitt('📋 FASIT – SVAR', C.LGRAY, C.NAVY, 26));
      i++; continue;
    }

    // Dagheadere
    if (DAGER.includes(linje)) {
      const d = DAG_FARGE[linje] || { bg: C.NAVY, light: 'EBF3FB' };
      aktivDagFarge = d.bg;
      aktivDagLys = d.light;
      children.push(dagAvsnitt(linje, aktivDagFarge));
      i++; continue;
    }

    // LÆRINGSMÅL
    if (linje === 'LÆRINGSMÅL') {
      children.push(shadedAvsnitt('🎯 LÆRINGSMÅL', C.LBLUE, C.NAVY, 24));
      i++; continue;
    }

    // UKES-ORDLISTE – legg inn tabell
    if (linje === 'UKES-ORDLISTE') {
      children.push(shadedAvsnitt('📝 UKES-ORDLISTE', C.LGREEN, C.TEAL, 24));
      children.push(ordlisteTabell(ord));
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      // Hopp over eventuelle AI-genererte ordliste-linjer
      i++;
      while (i < linjer.length) {
        const n = linjer[i].trim();
        if (!n || DAGER.some(d => n.startsWith(d)) || n === 'LÆRINGSMÅL') break;
        i++;
      }
      continue;
    }

    // Muntlig øvelse
    if (linje.startsWith('🗣')) {
      children.push(muntligAvsnitt(linje));
      i++; continue;
    }

    // Lesetekst-header
    if (linje.startsWith('📖')) {
      children.push(lesetekstAvsnitt(linje, aktivDagFarge, aktivDagLys));
      i++; continue;
    }

    // Oppgave-header
    if (/^Oppgave\s+\d+/.test(linje)) {
      children.push(oppgaveAvsnitt(linje, aktivDagFarge));
      i++; continue;
    }

    // Sub-items a)–e)
    if (/^[a-e]\)/.test(linje)) {
      children.push(subItemAvsnitt(linje, inFasit));
      i++; continue;
    }

    // Bullets
    if (linje.startsWith('•') || (linje.startsWith('-') && linje.length > 2)) {
      children.push(bulletAvsnitt(linje));
      i++; continue;
    }

    // Vanlig avsnitt
    children.push(new Paragraph({
      children: [new TextRun({ text: linje, font: 'Calibri', size: 22, color: inFasit ? C.GRAY : C.DARK })],
      spacing: { before: inFasit ? 60 : 100, after: inFasit ? 60 : 100, line: 276 },
    }));
    i++;
  }

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1300, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });
}

function lagFilnavn(temaNavn, nivå) {
  const base = (temaNavn || 'kantinemedarbeider').toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .replace(/[^a-z0-9_]/g, '');
  return `${base}_${nivå || 'A2'}.docx`;
}
