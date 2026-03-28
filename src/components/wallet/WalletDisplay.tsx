import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { Language } from "@/hooks/useLanguage";

interface WalletDisplayProps {
  balance: number;
  currency: string;
  language: Language;
}

export function WalletDisplay({ balance, currency, language }: WalletDisplayProps) {
  const navigate = useNavigate();
  
  const isLow = balance < 500;
  const isNegative = balance < 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Button
      variant="outline"
      className={`gap-2 h-10 px-4 font-semibold transition-all ${
        isNegative
          ? "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20"
          : isLow
          ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"
          : "border-primary/30 bg-primary/5 hover:bg-primary/10"
      }`}
      onClick={() => navigate("/wallet")}
    >
      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
        isNegative ? "bg-destructive/20" : isLow ? "bg-yellow-500/20" : "bg-primary/20"
      }`}>
        <Wallet className="h-3.5 w-3.5" />
      </div>
      <span className="text-sm">
        {language === "zh" ? "余额:" : "Balance:"}
      </span>
      <span className={`font-bold ${isNegative ? "text-destructive" : ""}`}>
        {formatCurrency(balance)}
      </span>
      {isNegative ? (
        <TrendingDown className="h-4 w-4 text-destructive" />
      ) : isLow ? (
        <TrendingDown className="h-4 w-4 text-yellow-600" />
      ) : (
        <TrendingUp className="h-4 w-4 text-primary" />
      )}
    </Button>
  );
}
