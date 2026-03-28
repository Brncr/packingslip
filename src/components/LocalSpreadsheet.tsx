import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { Upload, Download, Plus, Trash2, FileSpreadsheet, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type CellValue = string | number | boolean | null;
type SheetData = CellValue[][];

interface MergeRange {
  s: { r: number; c: number };
  e: { r: number; c: number };
}

interface CellStyle {
  bgColor?: string;
  fgColor?: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  border?: boolean;
  align?: "left" | "center" | "right";
}

interface CellInfo {
  value: CellValue;
  style?: CellStyle;
  rowSpan?: number;
  colSpan?: number;
  hidden?: boolean;
}

export const LocalSpreadsheet = () => {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>("");
  const [data, setData] = useState<SheetData>([
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ]);
  const [merges, setMerges] = useState<MergeRange[]>([]);
  const [cellStyles, setCellStyles] = useState<Map<string, CellStyle>>(new Map());
  const [colWidths, setColWidths] = useState<number[]>([]);
  const [rowHeights, setRowHeights] = useState<number[]>([]);
  const [fileName, setFileName] = useState<string>("nova-planilha");
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert Excel color to CSS
  const excelColorToCss = (color: any): string | undefined => {
    if (!color) return undefined;
    if (color.rgb) return `#${color.rgb}`;
    if (color.argb) return `#${color.argb.substring(2)}`;
    if (color.theme !== undefined) {
      // Basic theme colors
      const themeColors = [
        "#FFFFFF", "#000000", "#E7E6E6", "#44546A", 
        "#4472C4", "#ED7D31", "#A5A5A5", "#FFC000",
        "#5B9BD5", "#70AD47"
      ];
      return themeColors[color.theme] || undefined;
    }
    return undefined;
  };

  const parseSheet = useCallback((sheet: XLSX.WorkSheet) => {
    const ref = sheet['!ref'];
    if (!ref) {
      return { data: [["", "", "", "", ""]], merges: [], styles: new Map(), colWidths: [], rowHeights: [] };
    }
    
    const range = XLSX.utils.decode_range(ref);
    const numCols = range.e.c - range.s.c + 1;
    const numRows = range.e.r - range.s.r + 1;
    
    console.log("Sheet ref:", ref, "Dimensions:", numRows, "x", numCols);

    // Get merges
    const sheetMerges: MergeRange[] = sheet['!merges'] || [];
    console.log("Merges found:", sheetMerges.length);

    // Get column widths
    const cols = sheet['!cols'] || [];
    const widths = cols.map((col: any) => col?.wpx || col?.wch ? (col.wch || 10) * 8 : 100);

    // Get row heights
    const rows = sheet['!rows'] || [];
    const heights = rows.map((row: any) => row?.hpx || row?.hpt || 28);

    // Parse cell styles
    const styles = new Map<string, CellStyle>();
    
    // Parse data
    const jsonData = XLSX.utils.sheet_to_json<CellValue[]>(sheet, { 
      header: 1,
      defval: "",
      blankrows: true,
      raw: false
    });

    // Extract styles from cells
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellAddr];
        if (cell?.s) {
          const style: CellStyle = {};
          if (cell.s.fill?.fgColor) {
            style.bgColor = excelColorToCss(cell.s.fill.fgColor);
          }
          if (cell.s.font?.color) {
            style.fgColor = excelColorToCss(cell.s.font.color);
          }
          if (cell.s.font?.bold) style.bold = true;
          if (cell.s.font?.italic) style.italic = true;
          if (cell.s.font?.sz) style.fontSize = cell.s.font.sz;
          if (cell.s.border) style.border = true;
          if (cell.s.alignment?.horizontal) {
            style.align = cell.s.alignment.horizontal as "left" | "center" | "right";
          }
          if (Object.keys(style).length > 0) {
            styles.set(`${r}-${c}`, style);
          }
        }
      }
    }

    const maxCols = Math.max(numCols, 6, ...jsonData.map(row => (Array.isArray(row) ? row.length : 0)));
    
    const normalizedData = jsonData.map(row => {
      const normalizedRow = Array.isArray(row) ? [...row] : [];
      while (normalizedRow.length < maxCols) normalizedRow.push("");
      return normalizedRow.map(cell => (cell === null || cell === undefined) ? "" : cell);
    });
    
    while (normalizedData.length < 5) {
      normalizedData.push(Array(maxCols).fill(""));
    }

    // Ensure widths array matches columns
    while (widths.length < maxCols) widths.push(100);
    while (heights.length < normalizedData.length) heights.push(28);
    
    return { 
      data: normalizedData, 
      merges: sheetMerges, 
      styles,
      colWidths: widths,
      rowHeights: heights
    };
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("Reading file:", file.name);

    const reader = new FileReader();
    
    reader.onerror = () => {
      toast.error("Erro ao ler o arquivo.");
    };
    
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        
        const wb = XLSX.read(arrayBuffer, { 
          type: "array",
          cellStyles: true,
          cellDates: true,
          cellNF: true,
        });
        
        console.log("Workbook loaded. Sheets:", wb.SheetNames);
        
        if (wb.SheetNames.length === 0) {
          toast.error("Nenhuma aba encontrada.");
          return;
        }
        
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        
        const firstSheet = wb.SheetNames[0];
        setCurrentSheet(firstSheet);
        
        const parsed = parseSheet(wb.Sheets[firstSheet]);
        setData(parsed.data as SheetData);
        setMerges(parsed.merges);
        setCellStyles(parsed.styles);
        setColWidths(parsed.colWidths);
        setRowHeights(parsed.rowHeights);
        
        setFileName(file.name.replace(/\.[^/.]+$/, ""));
        toast.success(`"${file.name}" carregada!`);
        
      } catch (error) {
        console.error("Error:", error);
        toast.error("Erro ao processar o arquivo.");
      }
    };
    
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [parseSheet]);

  const handleSheetChange = useCallback((sheetName: string) => {
    if (!workbook) return;
    
    setCurrentSheet(sheetName);
    const parsed = parseSheet(workbook.Sheets[sheetName]);
    setData(parsed.data as SheetData);
    setMerges(parsed.merges);
    setCellStyles(parsed.styles);
    setColWidths(parsed.colWidths);
    setRowHeights(parsed.rowHeights);
    toast.success(`Aba "${sheetName}" carregada`);
  }, [workbook, parseSheet]);

  const handleCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
    setData(prev => {
      const newData = prev.map(row => [...row]);
      newData[rowIndex][colIndex] = value;
      return newData;
    });
  }, []);

  const addRow = useCallback(() => {
    setData(prev => {
      const cols = prev[0]?.length || 5;
      return [...prev, Array(cols).fill("")];
    });
    setRowHeights(prev => [...prev, 28]);
  }, []);

  const addColumn = useCallback(() => {
    setData(prev => prev.map(row => [...row, ""]));
    setColWidths(prev => [...prev, 100]);
  }, []);

  const exportToExcel = useCallback(() => {
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    if (merges.length > 0) {
      worksheet['!merges'] = merges;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, currentSheet || "Sheet1");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    toast.success("Exportado!");
  }, [data, fileName, currentSheet, merges]);

  const getColumnLetter = (index: number) => {
    let letter = "";
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  // Check if cell is merged and get its info
  const getCellMergeInfo = useCallback((row: number, col: number): { hidden: boolean; rowSpan: number; colSpan: number } => {
    for (const merge of merges) {
      if (row >= merge.s.r && row <= merge.e.r && col >= merge.s.c && col <= merge.e.c) {
        // Check if this is the top-left cell of the merge
        if (row === merge.s.r && col === merge.s.c) {
          return {
            hidden: false,
            rowSpan: merge.e.r - merge.s.r + 1,
            colSpan: merge.e.c - merge.s.c + 1
          };
        }
        // This cell is part of a merge but not the main cell
        return { hidden: true, rowSpan: 1, colSpan: 1 };
      }
    }
    return { hidden: false, rowSpan: 1, colSpan: 1 };
  }, [merges]);

  const getCellStyle = useCallback((row: number, col: number): React.CSSProperties => {
    const style = cellStyles.get(`${row}-${col}`);
    const css: React.CSSProperties = {};
    
    if (style?.bgColor) css.backgroundColor = style.bgColor;
    if (style?.fgColor) css.color = style.fgColor;
    if (style?.bold) css.fontWeight = "bold";
    if (style?.italic) css.fontStyle = "italic";
    if (style?.fontSize) css.fontSize = `${style.fontSize}px`;
    if (style?.align) css.textAlign = style.align;
    
    return css;
  }, [cellStyles]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Google Sheets style toolbar */}
      <div className="flex items-center gap-2 px-2 py-1 border-b bg-[#f9fbfd]">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.ods"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-1 text-xs h-7"
        >
          <Upload className="w-3 h-3" />
          Importar
        </Button>
        
        <div className="w-px h-5 bg-gray-300" />
        
        <Button variant="ghost" size="sm" onClick={exportToExcel} className="gap-1 text-xs h-7">
          <Download className="w-3 h-3" />
          Exportar
        </Button>

        <div className="w-px h-5 bg-gray-300" />
        
        <Button variant="ghost" size="sm" onClick={addColumn} className="gap-1 text-xs h-7">
          <Plus className="w-3 h-3" />
          Coluna
        </Button>
        <Button variant="ghost" size="sm" onClick={addRow} className="gap-1 text-xs h-7">
          <Plus className="w-3 h-3" />
          Linha
        </Button>

        <div className="flex-1" />

        <Input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          className="w-40 h-7 text-xs"
          placeholder="Nome do arquivo"
        />
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 px-2 py-1 border-b bg-white">
        <div className="w-16 px-2 py-1 text-xs font-medium text-center bg-[#f1f3f4] rounded border">
          {selectedCell ? `${getColumnLetter(selectedCell.col)}${selectedCell.row + 1}` : "—"}
        </div>
        <div className="text-gray-400">|</div>
        <Input
          value={selectedCell ? String(data[selectedCell.row]?.[selectedCell.col] ?? "") : ""}
          onChange={(e) => selectedCell && handleCellChange(selectedCell.row, selectedCell.col, e.target.value)}
          className="flex-1 h-7 text-xs border-0 focus-visible:ring-0"
          placeholder="Conteúdo da célula"
        />
      </div>

      {/* Sheet tabs */}
      {sheetNames.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b bg-[#f1f3f4]">
          {sheetNames.map((name) => (
            <button
              key={name}
              onClick={() => handleSheetChange(name)}
              className={`px-3 py-1 text-xs rounded-t ${
                currentSheet === name 
                  ? "bg-white border-t border-l border-r border-gray-300 font-medium" 
                  : "bg-[#e8eaed] hover:bg-[#dee1e3]"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Spreadsheet grid */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <table className="border-collapse" style={{ minWidth: "100%" }}>
          <thead className="sticky top-0 z-20">
            <tr>
              {/* Corner cell */}
              <th className="sticky left-0 z-30 w-10 h-6 bg-[#f8f9fa] border border-[#e2e3e3] text-xs font-normal" />
              {/* Column headers */}
              {data[0]?.map((_, colIndex) => (
                <th
                  key={colIndex}
                  className="h-6 bg-[#f8f9fa] border border-[#e2e3e3] text-xs font-normal text-center text-[#5f6368]"
                  style={{ minWidth: colWidths[colIndex] || 100, maxWidth: 300 }}
                >
                  <div className="flex items-center justify-center">
                    {getColumnLetter(colIndex)}
                    <ChevronDown className="w-3 h-3 ml-1 opacity-0 hover:opacity-100" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {/* Row header */}
                <td className="sticky left-0 z-10 w-10 bg-[#f8f9fa] border border-[#e2e3e3] text-xs text-center text-[#5f6368]"
                    style={{ height: rowHeights[rowIndex] || 28 }}>
                  {rowIndex + 1}
                </td>
                {/* Data cells */}
                {row.map((cell, colIndex) => {
                  const mergeInfo = getCellMergeInfo(rowIndex, colIndex);
                  
                  if (mergeInfo.hidden) return null;
                  
                  const cellStyle = getCellStyle(rowIndex, colIndex);
                  const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                  
                  return (
                    <td
                      key={colIndex}
                      rowSpan={mergeInfo.rowSpan}
                      colSpan={mergeInfo.colSpan}
                      className={`border border-[#e2e3e3] text-xs p-0 ${
                        isSelected ? "outline outline-2 outline-[#1a73e8] outline-offset-[-1px] z-10 relative" : ""
                      }`}
                      style={{
                        ...cellStyle,
                        minWidth: colWidths[colIndex] || 100,
                        height: rowHeights[rowIndex] || 28,
                        maxWidth: 300,
                        verticalAlign: "middle"
                      }}
                      onClick={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                      onDoubleClick={() => setEditingCell({ row: rowIndex, col: colIndex })}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={String(cell ?? "")}
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Escape") {
                              setEditingCell(null);
                            }
                          }}
                          autoFocus
                          className="w-full h-full px-1 text-xs border-0 outline-none bg-white"
                          style={cellStyle}
                        />
                      ) : (
                        <div 
                          className="w-full h-full px-1 flex items-center overflow-hidden whitespace-nowrap"
                          style={{ textAlign: cellStyle.textAlign || "left" }}
                        >
                          {String(cell ?? "")}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t bg-[#f8f9fa] text-xs text-gray-500">
        <span>{data.length} linhas × {data[0]?.length || 0} colunas</span>
        <span>Editor Local</span>
      </div>
    </div>
  );
};
