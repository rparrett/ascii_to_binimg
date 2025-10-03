// Binary image to text decoding functionality

function pixelCategory(r, g, b) {
  const thresh = 30;
  if (r < thresh && g < thresh && b < thresh) {
    return 1; // black
  }
  if (r > 255 - thresh && g > 255 - thresh && b > 255 - thresh) {
    return 0; // white
  }
  return null; // padding / margin
}

function cropToData(dataMask, width, height) {
  let minY = height;
  let maxY = -1;
  let minX = width;
  let maxX = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (dataMask[y * width + x]) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    throw new Error('No bit data detected in image');
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
  };
}

function contiguousSegments(maskLine) {
  const segments = [];
  let start = null;
  for (let idx = 0; idx < maskLine.length; idx += 1) {
    if (maskLine[idx]) {
      if (start === null) {
        start = idx;
      }
    } else if (start !== null) {
      segments.push([start, idx]);
      start = null;
    }
  }
  if (start !== null) {
    segments.push([start, maskLine.length]);
  }
  return segments;
}

function collectRunLengths(arr, width, height) {
  const lengths = [];
  for (let y = 0; y < height; y += 1) {
    let run = 0;
    const offset = y * width;
    for (let x = 0; x < width; x += 1) {
      if (arr[offset + x]) {
        run += 1;
      } else if (run) {
        lengths.push(run);
        run = 0;
      }
    }
    if (run) lengths.push(run);
  }
  for (let x = 0; x < width; x += 1) {
    let run = 0;
    for (let y = 0; y < height; y += 1) {
      if (arr[y * width + x]) {
        run += 1;
      } else if (run) {
        lengths.push(run);
        run = 0;
      }
    }
    if (run) lengths.push(run);
  }
  return lengths;
}

function selectLength(lengths) {
  const counter = new Map();
  let maxCount = 0;
  for (const value of lengths) {
    counter.set(value, (counter.get(value) || 0) + 1);
    maxCount = Math.max(maxCount, counter.get(value));
  }
  const sorted = Array.from(counter.entries()).sort((a, b) => a[0] - b[0]);
  for (const [length, count] of sorted) {
    if (count >= maxCount * 0.1) {
      return length;
    }
  }
  return sorted[0][0];
}

function estimateBitSize(width, height, colSegs, rowSegs, blackRuns, whiteRuns) {
  const bitCandidates = [];
  if (colSegs.length > 1) {
    const widths = colSegs.map(([start, end]) => end - start);
    bitCandidates.push(Math.round(widths.reduce((a, b) => a + b, 0) / widths.length / 2));
  }
  if (rowSegs.length > 1) {
    const heights = rowSegs.map(([start, end]) => end - start);
    bitCandidates.push(Math.round(heights.reduce((a, b) => a + b, 0) / heights.length / 4));
  }
  const allLengths = [...blackRuns, ...whiteRuns];
  if (blackRuns.length) bitCandidates.push(selectLength(blackRuns));
  if (whiteRuns.length) bitCandidates.push(selectLength(whiteRuns));
  if (allLengths.length) bitCandidates.push(Math.min(...allLengths));
  const widthHalf = Math.floor(width / 2);
  const heightQuarter = Math.floor(height / 4);
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const gcdBase = widthHalf && heightQuarter ? gcd(widthHalf, heightQuarter) : 0;
  if (gcdBase) {
    bitCandidates.push(gcdBase);
    if (allLengths.length) bitCandidates.push(gcd(gcdBase, Math.min(...allLengths)));
  }
  const filtered = Array.from(new Set(bitCandidates.filter((n) => Number.isFinite(n) && n > 0)));
  if (!filtered.length) {
    throw new Error('Unable to infer bit size');
  }
  const score = (candidate) => {
    const tol = Math.max(1, Math.floor(candidate / 5));
    let totalError = 0;
    for (const length of allLengths) {
      const remainder = length % candidate;
      const error = Math.min(remainder, candidate - remainder);
      totalError += error > tol ? error * 5 : error;
    }
    return totalError / Math.max(1, allLengths.length);
  };
  return filtered.reduce((best, value) => (score(value) < score(best) ? value : best));
}

function splitSegments(length, count) {
  const boundaries = [0];
  for (let idx = 1; idx < count; idx += 1) {
    boundaries.push(Math.round((idx * length) / count));
  }
  boundaries.push(length);
  const segments = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    segments.push([boundaries[i], boundaries[i + 1]]);
  }
  return segments;
}

function sampleBits(gray, width, height, rowSegs, colSegs) {
  const bits = [];
  for (const [yStart, yEnd] of rowSegs) {
    const rowCells = [];
    const cellHeight = yEnd - yStart;
    for (const [xStart, xEnd] of colSegs) {
      const cellWidth = xEnd - xStart;
      const cell = Array.from({ length: 4 }, () => Array(2).fill(0));
      for (let r = 0; r < 4; r += 1) {
        const yCenter = yStart + (r + 0.5) * (cellHeight / 4);
        const yIdx = Math.max(0, Math.min(height - 1, Math.round(yCenter)));
        for (let c = 0; c < 2; c += 1) {
          const xCenter = xStart + (c + 0.5) * (cellWidth / 2);
          const xIdx = Math.max(0, Math.min(width - 1, Math.round(xCenter)));
          const radius = Math.max(0, Math.floor(Math.min(cellHeight / 4, cellWidth / 2) / 4));
          const y0 = Math.max(0, yIdx - radius);
          const y1 = Math.min(height, yIdx + radius + 1);
          const x0 = Math.max(0, xIdx - radius);
          const x1 = Math.min(width, xIdx + radius + 1);
          let sum = 0;
          let count = 0;
          for (let y = y0; y < y1; y += 1) {
            const offset = y * width;
            for (let x = x0; x < x1; x += 1) {
              sum += gray[offset + x];
              count += 1;
            }
          }
          const value = count ? sum / count : gray[yIdx * width + xIdx];
          cell[r][c] = value < 0.5 ? 1 : 0;
        }
      }
      rowCells.push(cell);
    }
    bits.push(rowCells);
  }
  return bits;
}

function bitsToByte(bits, layout) {
  let value = 0;
  for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
    let r;
    let c;
    if (layout === 'row') {
      r = Math.floor(bitIndex / 2);
      c = bitIndex % 2;
    } else {
      c = Math.floor(bitIndex / 4);
      r = bitIndex % 4;
    }
    value = (value << 1) | bits[r][c];
  }
  return value;
}

function decodeBytes(bitsGrid, layout) {
  return bitsGrid.map((row) => row.map((cell) => bitsToByte(cell, layout)));
}

function chooseLayout(bitsGrid) {
  const printable = new Set(Array.from({ length: 95 }, (_, i) => 32 + i));
  const letters = new Set(
    Array.from({ length: 26 }, (_, i) => 65 + i).concat(
      Array.from({ length: 26 }, (_, i) => 97 + i)
    )
  );
  const digits = new Set(Array.from({ length: 10 }, (_, i) => 48 + i));
  const spaces = new Set([0, 32]);

  const scoreLayout = (layout) => {
    let alpha = 0;
    let space = 0;
    let digit = 0;
    let punct = 0;
    let non = 0;
    for (const row of decodeBytes(bitsGrid, layout)) {
      for (const value of row) {
        if (letters.has(value)) alpha += 1;
        else if (spaces.has(value)) space += 1;
        else if (digits.has(value)) digit += 1;
        else if (printable.has(value)) punct += 1;
        else non += 1;
      }
    }
    const primary = alpha * 3 + space * 2 + digit;
    const penalty = punct + non * 5;
    return [primary - penalty, -non];
  };

  const candidates = ['col', 'row'];
  const results = candidates
    .map((layout) => ({ layout, score: scoreLayout(layout) }))
    .sort((a, b) => b.score[0] - a.score[0] || b.score[1] - a.score[1]);
  return results[0].layout;
}

function bytesToLines(byteRows) {
  return byteRows.map((row) => {
    const trimmed = [...row];
    while (trimmed.length && trimmed[trimmed.length - 1] === 0) {
      trimmed.pop();
    }
    return trimmed.map((value) => (value === 0 ? ' ' : String.fromCharCode(value))).join('');
  });
}

export function decodeImageData(imageData, width, height, layoutHint) {
  const { data } = imageData;
  const total = width * height;
  const dataMask = new Array(total).fill(false);
  const blackMask = new Array(total).fill(false);
  const whiteMask = new Array(total).fill(false);
  const gray = new Array(total);

  for (let i = 0; i < total; i += 1) {
    const base = i * 4;
    const r = data[base];
    const g = data[base + 1];
    const b = data[base + 2];
    gray[i] = (r + g + b) / (3 * 255);
    const category = pixelCategory(r, g, b);
    if (category !== null) {
      dataMask[i] = true;
      if (category === 1) blackMask[i] = true;
      if (category === 0) whiteMask[i] = true;
    }
  }

  const bounds = cropToData(dataMask, width, height);
  const cropWidth = bounds.maxX - bounds.minX + 1;
  const cropHeight = bounds.maxY - bounds.minY + 1;

  const cropDataMask = new Array(cropWidth * cropHeight).fill(false);
  const cropBlackMask = new Array(cropWidth * cropHeight).fill(false);
  const cropWhiteMask = new Array(cropWidth * cropHeight).fill(false);
  const cropGray = new Array(cropWidth * cropHeight).fill(0);

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const srcIdx = y * width + x;
      const dstIdx = (y - bounds.minY) * cropWidth + (x - bounds.minX);
      cropDataMask[dstIdx] = dataMask[srcIdx];
      cropBlackMask[dstIdx] = blackMask[srcIdx];
      cropWhiteMask[dstIdx] = whiteMask[srcIdx];
      cropGray[dstIdx] = gray[srcIdx];
    }
  }

  const colMask = Array.from({ length: cropWidth }, (_, x) => {
    for (let y = 0; y < cropHeight; y += 1) {
      if (cropDataMask[y * cropWidth + x]) return true;
    }
    return false;
  });
  const rowMask = Array.from({ length: cropHeight }, (_, y) => {
    for (let x = 0; x < cropWidth; x += 1) {
      if (cropDataMask[y * cropWidth + x]) return true;
    }
    return false;
  });

  let colSegs = contiguousSegments(colMask);
  let rowSegs = contiguousSegments(rowMask);

  const blackRuns = collectRunLengths(cropBlackMask, cropWidth, cropHeight);
  const whiteRuns = collectRunLengths(cropWhiteMask, cropWidth, cropHeight);
  const bitSize = estimateBitSize(cropWidth, cropHeight, colSegs, rowSegs, blackRuns, whiteRuns);

  if (colSegs.length <= 1) {
    const charCount = Math.max(1, Math.round(cropWidth / (2 * bitSize)));
    colSegs = splitSegments(cropWidth, charCount);
  }
  if (rowSegs.length <= 1) {
    const lineCount = Math.max(1, Math.round(cropHeight / (4 * bitSize)));
    rowSegs = splitSegments(cropHeight, lineCount);
  }

  const bitsGrid = sampleBits(cropGray, cropWidth, cropHeight, rowSegs, colSegs);
  const layout = layoutHint === 'auto' ? chooseLayout(bitsGrid) : layoutHint;
  const byteRows = decodeBytes(bitsGrid, layout);

  byteRows.forEach((row) => {
    row.forEach((value) => {
      if (value < 0 || value > 255) {
        throw new Error('Decoded bytes out of extended ASCII range (0-255)');
      }
    });
  });

  return {
    lines: bytesToLines(byteRows),
    layout,
    bitSize,
  };
}
