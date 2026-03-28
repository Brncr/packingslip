import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShortcutHelp } from "@/hooks/useKeyboardShortcuts";
import type { Language } from "@/hooks/useLanguage";

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
}

export function KeyboardShortcutsHelp({ isOpen, onClose, language = "en" }: KeyboardShortcutsHelpProps) {
  const shortcuts = useShortcutHelp();
  const t = (en: string, zh: string) => language === "zh" ? zh : en;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Keyboard className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">{t("Keyboard Shortcuts", "键盘快捷键")}</h2>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <motion.div
                    key={shortcut.key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm text-foreground">
                      {language === "zh" ? shortcut.descriptionZh : shortcut.description}
                    </span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border border-border text-muted-foreground">
                      {shortcut.key}
                    </kbd>
                  </motion.div>
                ))}
              </div>
              
              <p className="text-xs text-muted-foreground text-center mt-6">
                {t(
                  "Press",
                  "按"
                )} <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded border border-border">?</kbd> {t(
                  "anytime to show this help",
                  "随时显示此帮助"
                )}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
