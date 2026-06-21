import { NextRequest, NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, convertInchesToTwip,
} from 'docx'

type LetterHeader = {
  letterDate: string
  insurerName: string
  insurerBranch: string
  contractSum: string
  projectName: string
  principal: string
  contractor: string
  agentName: string
  agentCode: string
}

type LetterContent = {
  subjectLine: string
  letterBody: string   // full body text with {{docList}} placeholder
  docLines: string[]   // pre-resolved list items in order
}

function noBorder() {
  const b = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b }
}

function boldPara(text: string, opts?: { underline?: boolean }): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, underline: opts?.underline ? {} : undefined })],
  })
}

function regularPara(text: string, opts?: { spacingAfter?: number }): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: opts?.spacingAfter ?? 0 },
  })
}

function emptyPara(): Paragraph {
  return new Paragraph({ children: [] })
}

// Convert a block of text (double-newline separated paragraphs) into Paragraph[]
function textToParas(text: string): Paragraph[] {
  if (!text.trim()) return []
  const paras = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
  const result: Paragraph[] = []
  paras.forEach((para, i) => {
    result.push(regularPara(para))
    if (i < paras.length - 1) result.push(emptyPara())
  })
  return result
}

function headerTableRow(label: string, value: string, underlineValue = false): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 2200, type: WidthType.DXA },
        borders: noBorder(),
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 22 })] })],
      }),
      new TableCell({
        width: { size: 400, type: WidthType.DXA },
        borders: noBorder(),
        children: [new Paragraph({ children: [new TextRun({ text: ':', bold: true, size: 22 })] })],
      }),
      new TableCell({
        width: { size: 6800, type: WidthType.DXA },
        borders: noBorder(),
        children: [new Paragraph({
          children: [new TextRun({ text: value, bold: true, size: 22, underline: underlineValue ? {} : undefined })],
        })],
      }),
    ],
  })
}

export async function POST(req: NextRequest) {
  const { header, content }: { header: LetterHeader; content: LetterContent } = await req.json()

  // Split body at {{docList}}
  const bodyText = content.letterBody ?? ''
  const splitIdx = bodyText.indexOf('{{docList}}')
  const bodyBefore = splitIdx === -1 ? bodyText : bodyText.slice(0, splitIdx).trimEnd()
  const bodyAfter = splitIdx === -1 ? '' : bodyText.slice(splitIdx + '{{docList}}'.length).trimStart()

  const headerTable = new Table({
    width: { size: 9400, type: WidthType.DXA },
    borders: noBorder(),
    rows: [
      headerTableRow('CONTRACT SUM', header.contractSum ?? ''),
      headerTableRow('PROJECT', (header.projectName ?? '').toUpperCase()),
      new TableRow({
        children: [new TableCell({
          columnSpan: 3, borders: noBorder(),
          children: [emptyPara()],
        })],
      }),
      headerTableRow('PRINCIPAL', (header.principal ?? '').toUpperCase()),
      headerTableRow('CONTRACTOR', (header.contractor ?? '').toUpperCase(), true),
    ],
  })

  const docListParas = content.docLines.length > 0
    ? content.docLines.map((line, i) =>
        new Paragraph({
          children: [new TextRun({ text: `${i + 1}.\t${line}`, size: 22 })],
          indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) },
          spacing: { after: 80 },
        })
      )
    : []

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.25),
            right: convertInchesToTwip(1.25),
          },
        },
      },
      children: [
        regularPara(header.letterDate ?? ''),
        emptyPara(),
        boldPara((header.insurerName ?? '').toUpperCase()),
        ...(header.insurerBranch ? [boldPara(header.insurerBranch.toUpperCase())] : []),
        emptyPara(),
        boldPara((content.subjectLine ?? '').toUpperCase()),
        headerTable,
        emptyPara(),
        ...textToParas(bodyBefore),
        ...(bodyBefore.trim() ? [emptyPara()] : []),
        ...docListParas,
        ...(bodyAfter.trim() ? [emptyPara()] : []),
        ...textToParas(bodyAfter),
        emptyPara(),
        emptyPara(),
        boldPara((header.agentName ?? '').toUpperCase()),
        ...(header.agentCode ? [regularPara(header.agentCode)] : []),
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="submission-letter.docx"',
    },
  })
}
