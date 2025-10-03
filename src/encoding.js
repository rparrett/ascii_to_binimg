// Text to binary image encoding functionality

export function generateAsciiBinaryImage(text, options, canvas) {
  const { oneColor, zeroColor, bgColor, cellSize, charSpacing, lineSpacing, margin } = options;

  const layout = 'col';

  const rowsPerChar = 4;
  const colsPerChar = 2;

  const lines = text.length ? text.split(/\r?\n/) : [''];
  const maxLen = lines.reduce((len, line) => Math.max(len, line.length), 0);
  const paddedLines = lines.map((line) => line.padEnd(maxLen, ' '));

  const gridWidth = colsPerChar * cellSize;
  const gridHeight = rowsPerChar * cellSize;

  const width = margin * 2 + (maxLen > 0 ? maxLen * gridWidth + (maxLen - 1) * charSpacing : 0);
  const height =
    margin * 2 +
    paddedLines.length * gridHeight +
    Math.max(0, paddedLines.length - 1) * lineSpacing;

  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let lineIdx = 0; lineIdx < paddedLines.length; lineIdx += 1) {
    const line = paddedLines[lineIdx];
    const yLine = margin + lineIdx * (gridHeight + lineSpacing);

    for (let charIdx = 0; charIdx < line.length; charIdx += 1) {
      const ch = line[charIdx];
      const code = ch === ' ' ? 0 : ch.charCodeAt(0);
      if (code > 127) {
        throw new Error(`Non-ASCII character encountered: ${ch}`);
      }
      const xChar = margin + charIdx * (gridWidth + charSpacing);

      for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
        let r;
        let c;
        if (layout === 'row') {
          r = Math.floor(bitIndex / colsPerChar);
          c = bitIndex % colsPerChar;
        } else {
          c = Math.floor(bitIndex / rowsPerChar);
          r = bitIndex % rowsPerChar;
        }
        const bit = (code >> (7 - bitIndex)) & 1;
        const color = bit ? oneColor : zeroColor;
        const x0 = xChar + c * cellSize;
        const y0 = yLine + r * cellSize;
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.fillRect(x0, y0, cellSize, cellSize);
      }
    }
  }

  return canvas;
}
