import type { GameMode, Player } from './types';

interface ResultsCardOptions {
  mode: GameMode;
  scoreboard: Player[];
  roomCode: string;
  funniestChain?: string;
}

/**
 * Client-side only. Renders a shareable PNG data URL on a hidden canvas.
 */
export async function generateResultsCard(options: ResultsCardOptions): Promise<string> {
  const { mode, scoreboard, roomCode, funniestChain } = options;
  
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  // Background
  ctx.fillStyle = '#0f172a'; // slate-900
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Decorative header
  ctx.fillStyle = '#3b82f6'; // blue-500
  ctx.fillRect(0, 0, canvas.width, 20);

  // Title
  ctx.fillStyle = '#f8fafc'; // slate-50
  ctx.font = 'bold 80px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Emoji Pictionary', canvas.width / 2, 120);

  // Room Info
  ctx.fillStyle = '#94a3b8'; // slate-400
  ctx.font = '40px monospace';
  ctx.fillText(`Room: ${roomCode}  •  Mode: ${mode.toUpperCase()}`, canvas.width / 2, 180);

  let y = 300;

  if (mode === 'relay' && funniestChain) {
    ctx.fillStyle = '#fef08a'; // yellow-200
    ctx.font = 'italic 50px sans-serif';
    ctx.fillText(`🏆 Funniest Chain:`, canvas.width / 2, y);
    y += 70;
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 60px sans-serif';
    ctx.fillText(funniestChain, canvas.width / 2, y);
    y += 120;
  }

  // Top 5 Scoreboard
  ctx.fillStyle = '#38bdf8'; // sky-400
  ctx.font = 'bold 50px sans-serif';
  ctx.fillText('Scoreboard', canvas.width / 2, y);
  y += 80;

  const top = scoreboard.slice(0, 5);
  ctx.font = '50px sans-serif';
  
  top.forEach((p, i) => {
    // Medal or number
    let rank = `${i + 1}.`;
    if (i === 0) rank = '🥇';
    if (i === 1) rank = '🥈';
    if (i === 2) rank = '🥉';

    ctx.textAlign = 'left';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`${rank}  ${p.avatar || '😎'} ${p.nickname}`, 250, y);
    
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`${p.score} pts`, 830, y);
    y += 80;
  });

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b'; // slate-500
  ctx.font = '30px sans-serif';
  ctx.fillText('Play at pictionary.example.com', canvas.width / 2, canvas.height - 60);

  return canvas.toDataURL('image/png');
}
