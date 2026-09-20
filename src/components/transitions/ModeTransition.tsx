import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameMode } from '@/lib/types';
import { Settings, Film } from 'lucide-react';

interface Props {
  mode: GameMode;
  children: React.ReactNode;
}

export function ModeTransition({ mode, children }: Props) {
  const [isPlaying, setIsPlaying] = React.useState(true);

  if (mode === 'charades') {
    return (
      <div className="relative w-full min-h-[calc(100vh-64px)]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          {children}
        </motion.div>

        <AnimatePresence>
          {isPlaying && (
            <motion.div 
              className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
              onAnimationComplete={() => setIsPlaying(false)}
            >
              {/* Top half of clapper */}
              <motion.div
                initial={{ y: "-100vh", rotateZ: -10 }}
                animate={{ y: ["-100vh", "0vh", "0vh", "-100vh"], rotateZ: [-10, 0, 0, -10] }}
                transition={{ duration: 2.2, times: [0, 0.2, 0.7, 1], ease: "easeInOut" }}
                className="absolute top-0 h-1/2 w-full bg-[#111] border-b-8 border-dashed border-white flex items-end justify-center pb-8 shadow-2xl"
              >
                <div className="flex items-center gap-4 text-white font-display text-6xl tracking-widest">
                  <Film className="w-12 h-12" /> SCENE 1
                </div>
              </motion.div>
              
              {/* Bottom half of clapper */}
              <motion.div
                initial={{ y: "100vh" }}
                animate={{ y: ["100vh", "0vh", "0vh", "100vh"] }}
                transition={{ duration: 2.2, times: [0, 0.2, 0.7, 1], ease: "easeInOut" }}
                className="absolute bottom-0 h-1/2 w-full bg-[#111] border-t-8 border-dashed border-white flex items-start justify-center pt-8 shadow-2xl"
              >
                <div className="text-white font-display text-6xl tracking-widest">
                  ACTION!
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (mode === 'relay') {
    return (
      <div className="relative w-full min-h-[calc(100vh-64px)]">
        <motion.div 
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 1.2, type: "spring", stiffness: 100, damping: 15 }}
        >
          {children}
        </motion.div>

        <AnimatePresence>
          {isPlaying && (
            <motion.div 
              className="fixed inset-0 z-50 flex items-center justify-center bg-foreground pointer-events-none overflow-hidden"
              initial={{ opacity: 1 }}
              animate={{ opacity: [1, 1, 0] }}
              transition={{ duration: 1.5, times: [0, 0.8, 1] }}
              onAnimationComplete={() => setIsPlaying(false)}
            >
              <motion.div
                initial={{ x: "-100vw" }}
                animate={{ x: "100vw" }}
                transition={{ duration: 1.2, ease: "linear" }}
                className="flex items-center gap-12"
              >
                <Settings className="w-32 h-32 text-primary animate-spin-slow" />
                <div className="font-display text-5xl text-background tracking-widest uppercase">Assembly Line Starting...</div>
                <Settings className="w-32 h-32 text-primary animate-spin-slow" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (mode === 'classic') {
    return (
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        {children}
      </motion.div>
    );
  }

  return <>{children}</>;
}
