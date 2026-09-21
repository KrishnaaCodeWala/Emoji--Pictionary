/** Scanline flood fill on ImageData. Mutates and returns `img`. */

/** #rrggbb -> opaque RGBA tuple. */
export function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return [r, g, b, 255];
}

export function floodFill(
  img: ImageData,
  x: number,
  y: number,
  rgba: [number, number, number, number],
  tolerance = 32,
): ImageData {
  const { width, height, data } = img;
  const sx = Math.floor(x);
  const sy = Math.floor(y);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return img;

  const idx = (px: number, py: number) => (py * width + px) * 4;
  const startI = idx(sx, sy);
  const startR = data[startI];
  const startG = data[startI + 1];
  const startB = data[startI + 2];
  const startA = data[startI + 3];
  const [fr, fg, fb, fa] = rgba;

  if (startR === fr && startG === fg && startB === fb && startA === fa) return img;

  const matches = (i: number) => {
    const dr = data[i] - startR;
    const dg = data[i + 1] - startG;
    const db = data[i + 2] - startB;
    const da = data[i + 3] - startA;
    return Math.sqrt(dr * dr + dg * dg + db * db + da * da) <= tolerance;
  };

  const visited = new Uint8Array(width * height);
  const stack: [number, number][] = [[sx, sy]];

  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) break;
    const [cx, cy] = next;

    // Find the extent of the matching span on this row through cx.
    let left = cx;
    while (left > 0) {
      const vi = cy * width + (left - 1);
      if (visited[vi] || !matches(idx(left - 1, cy))) break;
      left--;
    }
    let right = cx;
    while (right < width - 1) {
      const vi = cy * width + (right + 1);
      if (visited[vi] || !matches(idx(right + 1, cy))) break;
      right++;
    }

    let spanAbove = false;
    let spanBelow = false;
    for (let px = left; px <= right; px++) {
      const vi = cy * width + px;
      if (visited[vi]) continue;
      const pi = idx(px, cy);
      if (!matches(pi)) continue;
      visited[vi] = 1;
      data[pi] = fr;
      data[pi + 1] = fg;
      data[pi + 2] = fb;
      data[pi + 3] = fa;

      if (cy > 0) {
        const upVi = (cy - 1) * width + px;
        const upMatch = !visited[upVi] && matches(idx(px, cy - 1));
        if (upMatch && !spanAbove) {
          stack.push([px, cy - 1]);
          spanAbove = true;
        } else if (!upMatch) {
          spanAbove = false;
        }
      }
      if (cy < height - 1) {
        const downVi = (cy + 1) * width + px;
        const downMatch = !visited[downVi] && matches(idx(px, cy + 1));
        if (downMatch && !spanBelow) {
          stack.push([px, cy + 1]);
          spanBelow = true;
        } else if (!downMatch) {
          spanBelow = false;
        }
      }
    }
  }

  return img;
}
