const fs = require('fs');
const path = require('path');

const filesToPatch = [
  path.join(__dirname, '..', 'node_modules', 'html2canvas', 'dist', 'html2canvas.esm.js'),
  path.join(__dirname, '..', 'node_modules', 'html2canvas', 'dist', 'html2canvas.js')
];

filesToPatch.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const target = 'var SUPPORTED_COLOR_FUNCTIONS = {';
    if (!content.includes(target)) {
      return;
    }
    if (content.includes('SUPPORTED_COLOR_FUNCTIONS = new Proxy')) {
      console.log(`[patch-html2canvas] Already patched: ${filePath}`);
      return;
    }

    const replacement = 'var SUPPORTED_COLOR_FUNCTIONS = new Proxy({\n    hsl: hsl,\n    hsla: hsl,\n    rgb: rgb,\n    rgba: rgb\n}, {\n    get: function(target, prop) {\n        if (prop in target) return target[prop];\n        return function() { return 0; };\n    }\n});\nvar _OLD_SUPPORTED_COLOR_FUNCTIONS = {';

    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[patch-html2canvas] Successfully patched: ${filePath}`);
  } catch (err) {
    console.warn(`[patch-html2canvas] Failed to patch ${filePath}:`, err);
  }
});
