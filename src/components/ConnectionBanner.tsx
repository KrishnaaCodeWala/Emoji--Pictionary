'use client';
// v5 Wave 1 Track D: ConnectionBanner — slim banner shown when not connected.
import type { ConnectionState } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

export interface ConnectionBannerProps {
  connection: ConnectionState;
}

export default function ConnectionBanner({ connection }: ConnectionBannerProps) {
  const show = connection !== 'connected';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="conn-banner"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div
            role="status"
            aria-live="polite"
            className={`gutter flex items-center gap-2 py-1.5 text-sm font-semibold ${
              connection === 'offline'
                ? 'bg-red-500/15 text-red-700'
                : 'bg-yellow-400/20 text-yellow-800'
            }`}
          >
            <span className="animate-pulse">
              {connection === 'offline' ? '🔴' : '🟡'}
            </span>
            {connection === 'offline'
              ? 'You are offline — changes won\'t sync until you reconnect.'
              : 'Reconnecting…'}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
