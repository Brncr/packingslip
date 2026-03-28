import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSpreadsheetMetadata, extractSpreadsheetId } from '@/lib/googleSheets';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileSpreadsheet, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';

export function GoogleSheetViewer() {
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [selectedSheet, setSelectedSheet] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleConnect = () => {
    const id = extractSpreadsheetId(spreadsheetUrl);
    if (!id) {
      toast.error('URL inválida. Cole um link do Google Sheets.');
      return;
    }
    setSpreadsheetId(id);
    setSelectedSheet('');
    toast.success('Conectado! Selecione uma aba para visualizar.');
  };

  const { data: metadata, isLoading: loadingMetadata, error } = useQuery({
    queryKey: ['sheet-metadata', spreadsheetId],
    queryFn: () => getSpreadsheetMetadata(spreadsheetId),
    enabled: !!spreadsheetId,
  });

  // Build the embed URL - this embeds the actual Google Sheets editor
  const getEmbedUrl = () => {
    if (!spreadsheetId) return '';
    
    // Find the sheet's gid (ID)
    const sheet = metadata?.sheets?.find(s => s.properties.title === selectedSheet);
    const gid = sheet?.properties?.sheetId || 0;
    
    // Embed URL with edit mode
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=${gid}&rm=minimal`;
  };

  const openInNewTab = () => {
    const sheet = metadata?.sheets?.find(s => s.properties.title === selectedSheet);
    const gid = sheet?.properties?.sheetId || 0;
    window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${gid}`, '_blank');
  };

  if (error) {
    toast.error('Erro ao conectar. Verifique se a planilha está compartilhada com a Service Account.');
  }

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'h-full'}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center p-3 border-b bg-[#f9fbfd]">
        <div className="flex-1 min-w-[300px]">
          <Input
            placeholder="Cole a URL do Google Sheets aqui..."
            value={spreadsheetUrl}
            onChange={(e) => setSpreadsheetUrl(e.target.value)}
            className="h-9"
          />
        </div>
        <Button onClick={handleConnect} disabled={!spreadsheetUrl} size="sm" className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Conectar
        </Button>

        {metadata && (
          <>
            <div className="w-px h-6 bg-gray-300" />
            <span className="text-sm font-medium truncate max-w-[200px]">
              {metadata.properties.title}
            </span>
            <Select value={selectedSheet} onValueChange={setSelectedSheet}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Selecione a aba" />
              </SelectTrigger>
              <SelectContent>
                {metadata.sheets.map((sheet) => (
                  <SelectItem key={sheet.properties.sheetId} value={sheet.properties.title}>
                    {sheet.properties.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {selectedSheet && (
          <>
            <Button variant="outline" size="sm" onClick={openInNewTab} className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Abrir no Google
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-9 w-9"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {loadingMetadata && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Conectando...</p>
            </div>
          </div>
        )}

        {!spreadsheetId && (
          <div className="flex items-center justify-center h-full text-center p-8">
            <div className="max-w-md">
              <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">Conecte uma planilha do Google Sheets</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Cole o link da planilha acima. A planilha deve estar compartilhada com:
              </p>
              <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                brncrysis007@compact-garage-457923-q3.iam.gserviceaccount.com
              </code>
            </div>
          </div>
        )}

        {spreadsheetId && !selectedSheet && metadata && (
          <div className="flex items-center justify-center h-full text-center p-8">
            <div>
              <h3 className="text-lg font-medium mb-2">✅ Conectado!</h3>
              <p className="text-sm text-muted-foreground">
                Selecione uma aba acima para visualizar e editar
              </p>
            </div>
          </div>
        )}

        {spreadsheetId && selectedSheet && (
          <iframe
            src={getEmbedUrl()}
            className="w-full h-full border-0"
            style={{ minHeight: isFullscreen ? '100vh' : '600px' }}
            allow="clipboard-read; clipboard-write"
            title={`Google Sheets - ${selectedSheet}`}
          />
        )}
      </div>

      {/* Info bar */}
      {spreadsheetId && selectedSheet && (
        <div className="flex items-center justify-between px-3 py-1 border-t bg-[#f8f9fa] text-xs text-gray-500">
          <span>Editando diretamente no Google Sheets</span>
          <span>As alterações são salvas automaticamente no Google Drive</span>
        </div>
      )}
    </div>
  );
}
