// Web interface functionality
import Pickr from '@simonwep/pickr';
import '@simonwep/pickr/dist/themes/nano.min.css';

const DEFAULT_BG_COLOR = '#c084fc';

export const elements = {
  encode: {
    text: document.getElementById('encode-text'),
    cell: document.getElementById('encode-cell'),
    spacing: document.getElementById('encode-spacing'),
    margin: document.getElementById('encode-margin'),
    bgInput: document.getElementById('encode-bg'),
    bgTrigger: document.getElementById('encode-bg-trigger'),
    button: document.getElementById('encode-btn'),
    canvas: document.getElementById('encode-canvas'),
    download: document.getElementById('encode-download'),
    copy: document.getElementById('encode-copy'),
    share: document.getElementById('encode-share'),
    status: document.getElementById('encode-status'),
    options: document.getElementById('encode-options'),
    optionsBtn: document.getElementById('encode-options-btn'),
  },
  decode: {
    file: document.getElementById('decode-input'),
    output: document.getElementById('decode-output'),
    status: document.getElementById('decode-status'),
  },
};

export const clipboardSupported = Boolean(navigator.clipboard && window.ClipboardItem);
export const shareSupported = Boolean(navigator.share && navigator.canShare);

export function setElementVisible(element, visible) {
  if (!element) return;
  element.classList.toggle('is-hidden', !visible);
}

export function normalizeHex(value) {
  if (!value) {
    return null;
  }
  let hex = value.trim();
  if (!hex.startsWith('#')) {
    hex = `#${hex}`;
  }
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    hex = `#${hex
      .slice(1)
      .split('')
      .map((ch) => ch + ch)
      .join('')}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }
  return hex.toUpperCase();
}

export function sanitizeHex(value) {
  const hex = normalizeHex(value);
  if (!hex) {
    throw new Error('Enter a color in #RRGGBB format.');
  }
  return hex;
}

export function hexToRgb(hex) {
  const value = parseInt(hex.replace('#', ''), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function updateTriggerPreview(hex) {
  const normalized = normalizeHex(hex) || DEFAULT_BG_COLOR;
  elements.encode.bgTrigger.style.background = normalized;
  elements.encode.bgTrigger.dataset.color = normalized;
  elements.encode.bgTrigger.textContent = normalized;
  const { r, g, b } = hexToRgb(normalized);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  elements.encode.bgTrigger.style.color = luminance > 0.55 ? '#1f2937' : '#f8fafc';
}

export function initColorPicker() {
  const pickr = Pickr.create({
    el: elements.encode.bgTrigger,
    theme: 'nano',
    default: elements.encode.bgInput.value,
    components: {
      preview: true,
      opacity: false,
      hue: true,
      interaction: {
        input: true,
        save: true,
      },
    },
  });

  pickr.on('change', (color) => {
    const hex = color.toHEXA().toString().toUpperCase();
    elements.encode.bgInput.value = hex;
    updateTriggerPreview(hex);
  });

  pickr.on('save', (color) => {
    const hex = color.toHEXA().toString().toUpperCase();
    elements.encode.bgInput.value = hex;
    updateTriggerPreview(hex);
    pickr.hide();
  });

  pickr.on('hide', () => {
    const normalized = normalizeHex(elements.encode.bgInput.value) || DEFAULT_BG_COLOR;
    elements.encode.bgInput.value = normalized;
    updateTriggerPreview(normalized);
  });
}

export function readOptions() {
  const bgHex = sanitizeHex(elements.encode.bgInput.value);
  elements.encode.bgInput.value = bgHex;
  const bgColor = hexToRgb(bgHex);
  const spacing = Number.parseInt(elements.encode.spacing.value, 10);
  return {
    oneColor: { r: 0, g: 0, b: 0 },
    zeroColor: { r: 255, g: 255, b: 255 },
    bgColor,
    cellSize: Number.parseInt(elements.encode.cell.value, 10),
    charSpacing: spacing,
    lineSpacing: spacing,
    margin: Number.parseInt(elements.encode.margin.value, 10),
  };
}

export async function decodeSelectedFile(file, layoutHint) {
  const image = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Import here to avoid circular dependency
  const { decodeImageData } = await import('./decoding');
  return decodeImageData(imageData, canvas.width, canvas.height, layoutHint);
}
