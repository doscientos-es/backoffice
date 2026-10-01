import { deflateRawSync } from "node:zlib";

export type QuarterlyPeriod = {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  start: string;
  end: string;
  label: string;
};

export type ZipEntry = {
  name: string;
  body: Uint8Array;
  modifiedAt?: Date;
};

const MAX_UINT16 = 0xffff;
const MAX_UINT32 = 0xffffffff;
const textEncoder = new TextEncoder();

export function quarterlyPeriod(
  yearValue: string | null,
  quarterValue: string | null,
): QuarterlyPeriod | null {
  if (!yearValue || !quarterValue || !/^\d{4}$/.test(yearValue) || !/^[1-4]$/.test(quarterValue)) {
    return null;
  }

  const year = Number(yearValue);
  const quarter = Number(quarterValue) as QuarterlyPeriod["quarter"];
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 3;
  const start = new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, endMonth, 1)).toISOString().slice(0, 10);
  return { year, quarter, start, end, label: `T${quarter} ${year}` };
}

export function safeFilePart(value: string | null | undefined, fallback: string): string {
  const sanitized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/[-_.]{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  return sanitized || fallback;
}

export function expenseArchiveFilename(input: {
  id: string;
  date: string;
  vendor: string;
  reference: string | null;
  name: string;
}): string {
  const extension = /\.[a-zA-Z0-9]{1,10}$/.exec(input.name)?.[0] ?? "";
  const baseName = safeFilePart(
    input.name.slice(0, input.name.length - extension.length),
    "documento",
  );
  return `${input.date}_${safeFilePart(input.vendor, "proveedor")}_${safeFilePart(input.reference, "sin-ref")}_${baseName}-${input.id.slice(0, 8)}${extension.toLowerCase()}`;
}

export function csvWithBom(
  rows: ReadonlyArray<Record<string, string | number | null>>,
  headers?: ReadonlyArray<string>,
): Uint8Array {
  const columns = headers ? [...headers] : [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escapeCell = (value: string | number | null | undefined) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const body = [
    columns.map(escapeCell).join(","),
    ...rows.map((row) => columns.map((header) => escapeCell(row[header])).join(",")),
  ].join("\r\n");
  return textEncoder.encode(`\uFEFF${body}\r\n`);
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(value: Date): { date: number; time: number } {
  const year = Math.min(2107, Math.max(1980, value.getFullYear()));
  return {
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
  };
}

function archiveName(name: string): Buffer {
  if (!name || name.startsWith("/") || name.includes("\\") || name.split("/").includes("..")) {
    throw new Error("Nombre de archivo ZIP inválido");
  }
  const value = Buffer.from(name, "utf8");
  if (value.length > MAX_UINT16) throw new Error("El nombre de archivo ZIP es demasiado largo");
  return value;
}

/** Creates a standards-compliant ZIP using only Node built-ins. */
export function createZip(entries: ReadonlyArray<ZipEntry>): Buffer {
  if (entries.length > MAX_UINT16) throw new Error("La exportación contiene demasiados archivos");

  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = archiveName(entry.name);
    const source = Buffer.from(entry.body);
    if (source.length > MAX_UINT32) throw new Error("Un archivo supera el límite del formato ZIP");
    const deflated = deflateRawSync(source);
    const compressed = deflated.length < source.length ? deflated : source;
    const method = compressed === source ? 0 : 8;
    const { date, time } = dosDateTime(entry.modifiedAt ?? new Date());
    const checksum = crc32(source);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(source.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    localRecords.push(local, compressed);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(source.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralRecords.push(central);
    offset += local.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  if (offset > MAX_UINT32 || centralDirectory.length > MAX_UINT32) {
    throw new Error("La exportación supera el límite del formato ZIP");
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localRecords, centralDirectory, end]);
}

/** Plain numbers render as amounts (#,##0.00); dates and integers use their own formats. */
export type XlsxCell = string | number | null | { date: string } | { integer: number };

export type XlsxSheet = {
  name: string;
  rows: ReadonlyArray<ReadonlyArray<XlsxCell>>;
};

const XLSX_STYLE = { header: 1, amount: 2, date: 3 } as const;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

// XML 1.0 forbids C0 control characters other than tab, LF and CR.
function stripXmlInvalid(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) out += char;
  }
  return out;
}

function xmlEscape(value: string): string {
  return stripXmlInvalid(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

function xlsxSheetName(name: string, index: number): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31);
  return cleaned || `Hoja ${index + 1}`;
}

function xlsxCell(cell: XlsxCell, ref: string, header: boolean): string {
  if (cell === null || cell === "") return "";
  if (typeof cell === "string") {
    const style = header ? ` s="${XLSX_STYLE.header}"` : "";
    return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`;
  }
  if (typeof cell === "number") {
    return Number.isFinite(cell) ? `<c r="${ref}" s="${XLSX_STYLE.amount}"><v>${cell}</v></c>` : "";
  }
  if ("integer" in cell) return `<c r="${ref}"><v>${Math.trunc(cell.integer)}</v></c>`;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(cell.date);
  if (!match) return "";
  const serial =
    (Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - EXCEL_EPOCH_UTC) /
    86_400_000;
  return `<c r="${ref}" s="${XLSX_STYLE.date}"><v>${serial}</v></c>`;
}

function cellWidth(cell: XlsxCell): number {
  if (cell === null) return 0;
  if (typeof cell === "string") return cell.length;
  if (typeof cell === "number") return cell.toFixed(2).length + 2;
  return "integer" in cell ? String(cell.integer).length : 10;
}

function xlsxWorksheet(sheet: XlsxSheet): string {
  const columnCount = Math.max(1, ...sheet.rows.map((row) => row.length));
  const widths = Array.from({ length: columnCount }, (_, column) =>
    Math.min(60, Math.max(8, ...sheet.rows.map((row) => cellWidth(row[column] ?? null) + 2))),
  );
  const cols = widths
    .map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
    .join("");
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, column) => xlsxCell(cell, `${columnName(column)}${rowIndex + 1}`, rowIndex === 0))
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const lastRef = `${columnName(columnCount - 1)}${Math.max(1, sheet.rows.length)}`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols><sheetData>${rows}</sheetData>` +
    `<autoFilter ref="A1:${lastRef}"/></worksheet>`
  );
}

/** Creates a minimal Office Open XML workbook (.xlsx). The first row of each sheet is a bold header. */
export function createXlsx(sheets: ReadonlyArray<XlsxSheet>): Buffer {
  if (sheets.length === 0) throw new Error("El Excel necesita al menos una hoja");
  const names = sheets.map((sheet, index) => xlsxSheetName(sheet.name, index));
  const xml = (body: string) => textEncoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`);

  const entries: ZipEntry[] = [
    {
      name: "[Content_Types].xml",
      body: xml(
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          names
            .map(
              (_, i) =>
                `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
            )
            .join("") +
          `</Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      body: xml(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      body: xml(
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
          names
            .map((name, i) => `<sheet name="${xmlEscape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
            .join("") +
          `</sheets></workbook>`,
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      body: xml(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          names
            .map(
              (_, i) =>
                `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
            )
            .join("") +
          `<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          `</Relationships>`,
      ),
    },
    {
      name: "xl/styles.xml",
      body: xml(
        `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
          `<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>` +
          `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
          `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
          `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
          `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
          `<cellXfs count="4">` +
          `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
          `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
          `<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
          `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
          `</cellXfs>` +
          `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
          `</styleSheet>`,
      ),
    },
    ...sheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      body: textEncoder.encode(xlsxWorksheet(sheet)),
    })),
  ];
  return createZip(entries);
}
