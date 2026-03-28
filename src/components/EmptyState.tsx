import { Package, FileSpreadsheet, Printer, Sparkles } from "lucide-react";

export function EmptyState() {
  return (
    <div className="bg-gradient-to-br from-card via-card to-primary/5 rounded-xl border border-border p-12 text-center relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10">
        {/* Animated icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6 animate-[pulse_3s_ease-in-out_infinite]">
          <Package className="w-10 h-10 text-primary" />
        </div>
        
        <h2 className="text-2xl font-bold mb-3 text-foreground">
          Select an Order
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Choose an order from the list to preview and generate the packing slip
        </p>

        {/* Quick tips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
          <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-background/50 border border-border/50">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground text-center">Export to Google Sheets</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-background/50 border border-border/50">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Printer className="w-4 h-4 text-accent" />
            </div>
            <span className="text-xs text-muted-foreground text-center">Print Packing Slip</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-background/50 border border-border/50">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground text-center">Automatic Processing</span>
          </div>
        </div>
      </div>
    </div>
  );
}
