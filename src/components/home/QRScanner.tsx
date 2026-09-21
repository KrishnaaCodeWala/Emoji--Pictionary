'use client';
import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';

export interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    let isScanning = true;

    scannerRef.current.render(
      (decodedText) => {
        if (!isScanning) return;
        isScanning = false;
        if (scannerRef.current) {
          scannerRef.current.clear().catch(console.error);
        }
        onScan(decodedText);
      },
      (errorMessage) => {
        // ignore parse errors
      }
    );

    return () => {
      isScanning = false;
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-xl border-4 border-border bg-surface p-4 shadow-lg flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
        <h2 className="text-xl font-bold font-display text-center uppercase tracking-widest text-primary">Scan Room QR</h2>
        <div id="qr-reader" className="w-full bg-black rounded-lg overflow-hidden border-2 border-border" />
        <Button onClick={onClose} variant="outline" className="w-full active:scale-95">
          Cancel
        </Button>
      </div>
    </div>
  );
}
