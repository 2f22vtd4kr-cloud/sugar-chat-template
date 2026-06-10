import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <AppLayout>
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative mb-6"
        >
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          <div className="w-24 h-24 bg-card border border-white/10 rounded-full flex items-center justify-center relative z-10 shadow-xl">
            <Search className="w-10 h-10 text-primary" />
          </div>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-4xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent mb-3"
        >
          Lost in the void
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground max-w-[250px] mb-8"
        >
          We couldn't find the page you're looking for. It might have drifted away.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Link href="/" className="inline-flex items-center justify-center h-10 px-8 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/30 transition-all">
            Return Home
          </Link>
        </motion.div>
      </div>
    </AppLayout>
  );
}
