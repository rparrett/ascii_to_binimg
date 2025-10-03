// Main application entry point
import 'bulma/css/bulma.min.css';
import './styles.css';
import {
  elements,
  clipboardSupported,
  setElementVisible,
  initColorPicker,
  updateTriggerPreview,
  readOptions,
  decodeSelectedFile,
} from './ui';
import { generateAsciiBinaryImage } from './encoding';

let lastRenderedUrl = null;

function performRender() {
  const text = elements.encode.text.value;
  if (!text.trim()) {
    lastRenderedUrl = null;
    setElementVisible(elements.encode.download, false);
    setElementVisible(elements.encode.copy, false);
    setElementVisible(elements.encode.canvas, false);
    elements.encode.status.textContent = 'Enter some text first.';
    return;
  }
  try {
    const options = readOptions();
    generateAsciiBinaryImage(text, options, elements.encode.canvas);
    lastRenderedUrl = elements.encode.canvas.toDataURL('image/png');
    setElementVisible(elements.encode.canvas, true);
    setElementVisible(elements.encode.download, true);
    elements.encode.status.textContent = 'Image generated successfully.';
    if (clipboardSupported) {
      setElementVisible(elements.encode.copy, true);
      elements.encode.copy.disabled = false;
      elements.encode.copy.removeAttribute('aria-hidden');
    }
  } catch (error) {
    console.error(error);
    lastRenderedUrl = null;
    setElementVisible(elements.encode.download, false);
    setElementVisible(elements.encode.copy, false);
    setElementVisible(elements.encode.canvas, false);
    elements.encode.status.textContent = error.message;
  }
}

// Initialize the app when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  initColorPicker();
  updateTriggerPreview(elements.encode.bgInput.value);
  setElementVisible(elements.encode.canvas, false);
  setElementVisible(elements.encode.download, false);
  setElementVisible(elements.encode.copy, false);
  elements.encode.status.textContent = '';

  if (!clipboardSupported) {
    elements.encode.copy.title = 'Copy requires Clipboard API support';
    elements.encode.copy.disabled = true;
    elements.encode.copy.setAttribute('aria-hidden', 'true');
  } else {
    elements.encode.copy.title = 'Copy PNG to clipboard';
    elements.encode.copy.disabled = false;
  }
});

// Encoding event handlers
elements.encode.button.addEventListener('click', performRender);

elements.encode.optionsBtn.addEventListener('click', () => {
  const isHidden = elements.encode.options.classList.contains('is-hidden');
  setElementVisible(elements.encode.options, isHidden);
  elements.encode.optionsBtn.textContent = isHidden ? 'Hide Options' : 'Show Options';
});

elements.encode.text.addEventListener('input', () => {
  if (!elements.encode.text.value.trim()) {
    lastRenderedUrl = null;
    setElementVisible(elements.encode.download, false);
    setElementVisible(elements.encode.copy, false);
    setElementVisible(elements.encode.canvas, false);
    elements.encode.status.textContent = '';
  }
});

elements.encode.download.addEventListener('click', () => {
  if (!lastRenderedUrl) {
    return;
  }
  const link = document.createElement('a');
  link.href = lastRenderedUrl;
  link.download = 'out.png';
  link.click();
});

elements.encode.copy.addEventListener('click', async () => {
  if (!clipboardSupported) {
    return;
  }
  if (!lastRenderedUrl) {
    return;
  }
  try {
    const blob = await new Promise((resolve) => {
      elements.encode.canvas.toBlob((b) => resolve(b), 'image/png');
    });
    if (!blob) throw new Error('Failed to copy image');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  } catch (error) {
    console.error(error);
  }
});

// Decoding event handlers
async function handleFileDecoding(file) {
  if (!file) {
    elements.decode.status.textContent = 'Choose a PNG file first.';
    elements.decode.output.value = '';
    return;
  }
  elements.decode.status.textContent = 'Decoding…';
  elements.decode.output.value = '';
  try {
    const result = await decodeSelectedFile(file, 'auto');
    elements.decode.output.value = result.lines.join('\n');
    elements.decode.status.textContent = `Decoded ${result.lines.length} line(s).`;
  } catch (error) {
    console.error(error);
    elements.decode.status.textContent = error.message;
  }
}

elements.decode.file.addEventListener('change', async () => {
  await handleFileDecoding(elements.decode.file.files[0]);
});

// Add drag and drop support to file input
const fileDropZone = elements.decode.file.parentElement.parentElement;

fileDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
});

fileDropZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
});

fileDropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  const { files } = e.dataTransfer;
  if (files.length > 0 && files[0].type === 'image/png') {
    elements.decode.file.files = files;
    await handleFileDecoding(files[0]);
  }
});
