import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface NsfwModalProps {
  onConfirm: () => Promise<void>;
  onDecline: () => void;
}

export function NsfwModal({ onConfirm, onDecline }: NsfwModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="nsfw-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
        style={{ background: "rgba(8,2,4,0.92)" }}
      >
        {/* Ambient glow blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, hsl(348 76% 49%) 0%, transparent 70%)", filter: "blur(60px)" }} />
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, hsl(351 88% 62%) 0%, transparent 70%)", filter: "blur(40px)" }} />
        </div>

        <motion.div
          initial={{ scale: 0.88, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
          className="glass-card rounded-3xl p-8 max-w-sm w-full text-center space-y-6 relative"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.25 }}
            className="w-20 h-20 mx-auto rounded-full flex items-center justify-center glow-red"
            style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))" }}
          >
            <ShieldAlert className="w-9 h-9 text-white" />
          </motion.div>

          {/* Text */}
          <div className="space-y-3">
            <h2 className="text-2xl font-serif font-bold text-gradient-red">
              {t("nsfw.title")}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("nsfw.body")}
            </p>
          </div>

          {/* Divider */}
          <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(225,29,72,0.3), transparent)" }} />

          {/* Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full h-12 text-base font-semibold rounded-2xl glow-red"
              style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))" }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("nsfw.confirm")}
                </span>
              ) : t("nsfw.confirm")}
            </Button>
            <Button
              variant="ghost"
              onClick={onDecline}
              className="w-full h-10 text-sm text-muted-foreground hover:text-foreground"
            >
              {t("nsfw.decline")}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
