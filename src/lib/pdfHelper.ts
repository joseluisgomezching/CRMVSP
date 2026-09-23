import html2canvas from 'html2canvas';

/**
 * Mathematical OKLCH to sRGB converter
 * Converts CSS oklch(L C H [/ A]) to standard rgb(...) or rgba(...)
 */
function oklchToRgb(l: number, c: number, h: number, a: number = 1): string {
  const hRad = ((h || 0) * Math.PI) / 180;
  const a_ = (c || 0) * Math.cos(hRad);
  const b_ = (c || 0) * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a_ + 0.2158037573 * b_;
  const m_ = l - 0.1055613458 * a_ - 0.0638541728 * b_;
  const s_ = l - 0.0894841775 * a_ - 1.2914855480 * b_;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const rLin = +4.0767434036 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  function toGamma(val: number): number {
    const clamped = Math.max(0, Math.min(1, val));
    return clamped <= 0.0031308
      ? Math.round(clamped * 12.92 * 255)
      : Math.round((1.055 * Math.pow(clamped, 1 / 2.4) - 0.055) * 255);
  }

  const r = toGamma(rLin);
  const g = toGamma(gLin);
  const b = toGamma(bLin);

  return a < 1
    ? `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`
    : `rgb(${r}, ${g}, ${b})`;
}

/**
 * Replaces any oklch(...) inside a CSS string with standard rgb(...) or rgba(...)
 */
function replaceOklchInString(str: string): string {
  return str.replace(
    /oklch\(\s*([\d.]+%?|none)\s+([\d.]+%?|none)\s+([\d.]+(?:deg|rad|turn)?|none)(?:\s*\/\s*([\d.]+%?|none))?\s*\)/gi,
    (_match, lStr, cStr, hStr, aStr) => {
      let l = lStr === 'none' ? 0 : parseFloat(lStr);
      if (lStr.endsWith('%')) l = l / 100;

      let c = cStr === 'none' ? 0 : parseFloat(cStr);
      if (cStr.endsWith('%')) c = (c / 100) * 0.4;

      let h = hStr === 'none' ? 0 : parseFloat(hStr);
      if (hStr.endsWith('rad')) h = (h * 180) / Math.PI;
      else if (hStr.endsWith('turn')) h = h * 360;

      let a = 1;
      if (aStr && aStr !== 'none') {
        a = parseFloat(aStr);
        if (aStr.endsWith('%')) a = a / 100;
      }

      return oklchToRgb(l, c, h, a);
    }
  );
}

/**
 * Fallback parser for CSS color functions
 */
export function parseCssColorToRgba(colorStr: string): string {
  if (!colorStr || typeof colorStr !== 'string') return '#000000';
  const trimmed = colorStr.trim();
  if (!trimmed) return '#000000';

  if (/^#([0-9a-f]{3,8})$/i.test(trimmed) || /^rgba?\s*\(/i.test(trimmed) || trimmed === 'transparent' || trimmed === 'inherit' || trimmed === 'currentColor') {
    return trimmed;
  }

  if (trimmed.includes('oklch')) {
    return replaceOklchInString(trimmed);
  }

  return '#000000';
}

/**
 * Sanitize any CSS string to strip unsupported modern color functions
 * like oklch, oklab, lab, lch, color-mix, etc.
 */
export function sanitizeCssString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  if (!str.includes('oklch') && !str.includes('color-mix') && !str.includes('oklab') && !str.includes('lab') && !str.includes('lch') && !str.includes('color(')) {
    return str;
  }

  let result = replaceOklchInString(str);

  // Replace other unsupported CSS Color 4 functions with safe fallbacks
  result = result.replace(/(?:color-mix|oklab|lab|lch|color)\([^()]*(?:\([^()]*\)[^()]*)*\)/gi, 'rgba(0, 0, 0, 0.5)');

  // Safety cleanup for any remaining oklch
  if (result.includes('oklch')) {
    result = result.replace(/oklch\([^)]+\)/gi, '#000000');
  }

  return result;
}

/**
 * Creates a proxy for CSSStyleDeclaration that guarantees all color values
 * returned to html2canvas are strictly compatible rgb/rgba/#hex strings.
 */
function createSafeStyleDeclaration(target: CSSStyleDeclaration): CSSStyleDeclaration {
  return new Proxy(target, {
    get(t: any, prop: string | symbol) {
      if (prop === 'getPropertyValue') {
        return function (propertyName: string) {
          const raw = t.getPropertyValue(propertyName);
          return typeof raw === 'string' ? sanitizeCssString(raw) : raw;
        };
      }
      if (prop === 'item') {
        return function (index: number) {
          return t.item(index);
        };
      }
      if (prop === 'getPropertyPriority') {
        return function (propertyName: string) {
          return t.getPropertyPriority(propertyName);
        };
      }

      const val = Reflect.get(t, prop, t);
      if (typeof val === 'function') {
        return function (...args: any[]) {
          const res = val.apply(t, args);
          return typeof res === 'string' ? sanitizeCssString(res) : res;
        };
      }
      if (typeof val === 'string') {
        return sanitizeCssString(val);
      }
      return val;
    }
  });
}

/**
 * Hook getComputedStyle on any window object (main window or cloned iframe window)
 */
export function hookGetComputedStyle(targetWindow: Window): () => void {
  try {
    if (!targetWindow || !targetWindow.getComputedStyle) return () => {};

    const originalGetComputedStyle = targetWindow.getComputedStyle;
    
    // Check if already hooked
    if ((originalGetComputedStyle as any).__isOklchSafe) {
      return () => {};
    }

    const hooked = function (elt: Element, pseudoElt?: string | null) {
      const styleDeclaration = originalGetComputedStyle.call(targetWindow, elt, pseudoElt);
      return createSafeStyleDeclaration(styleDeclaration);
    };
    (hooked as any).__isOklchSafe = true;
    (hooked as any).__original = originalGetComputedStyle;

    targetWindow.getComputedStyle = hooked;

    return () => {
      try {
        if (targetWindow.getComputedStyle === hooked) {
          targetWindow.getComputedStyle = originalGetComputedStyle;
        }
      } catch {
        // ignore restore error
      }
    };
  } catch (e) {
    console.warn('[pdfHelper] Could not hook getComputedStyle:', e);
    return () => {};
  }
}

/**
 * Sanitizes the cloned document created by html2canvas:
 * 1. Hooks getComputedStyle on the cloned iframe's window
 * 2. Strips oklch from all <style> tags
 * 3. Strips oklch from inline styles and SVG fill/stroke attributes
 */
export function sanitizeHtml2CanvasClonedDoc(clonedDoc: Document): void {
  if (!clonedDoc) return;

  // 1. Hook getComputedStyle on the cloned window
  try {
    const win = clonedDoc.defaultView;
    if (win) {
      hookGetComputedStyle(win);
    }
  } catch (e) {
    console.warn('[pdfHelper] Error hooking cloned window getComputedStyle:', e);
  }

  // 2. Sanitize all <style> elements in cloned document
  try {
    const styleTags = clonedDoc.querySelectorAll('style');
    styleTags.forEach(styleTag => {
      if (styleTag.textContent && (styleTag.textContent.includes('oklch') || styleTag.textContent.includes('color-mix'))) {
        styleTag.textContent = sanitizeCssString(styleTag.textContent);
      }
    });
  } catch (e) {
    console.warn('[pdfHelper] Error sanitizing style tags:', e);
  }

  // 3. Sanitize inline styles and attributes on all elements
  try {
    const allElements = clonedDoc.querySelectorAll('*');
    const colorProperties = [
      'color',
      'backgroundColor',
      'borderColor',
      'borderTopColor',
      'borderBottomColor',
      'borderLeftColor',
      'borderRightColor',
      'outlineColor',
      'boxShadow',
      'textShadow',
      'fill',
      'stroke'
    ];

    allElements.forEach(node => {
      const el = node as HTMLElement;
      if (el.style) {
        colorProperties.forEach(prop => {
          const val = (el.style as any)[prop];
          if (val && typeof val === 'string' && (val.includes('oklch') || val.includes('color-mix') || val.includes('oklab') || val.includes('lab') || val.includes('lch'))) {
            (el.style as any)[prop] = sanitizeCssString(val);
          }
        });
      }

      if (node.hasAttribute('fill')) {
        const fill = node.getAttribute('fill') || '';
        if (fill.includes('oklch') || fill.includes('color-mix')) {
          node.setAttribute('fill', sanitizeCssString(fill));
        }
      }
      if (node.hasAttribute('stroke')) {
        const stroke = node.getAttribute('stroke') || '';
        if (stroke.includes('oklch') || stroke.includes('color-mix')) {
          node.setAttribute('stroke', sanitizeCssString(stroke));
        }
      }
    });
  } catch (e) {
    console.warn('[pdfHelper] Error sanitizing elements:', e);
  }
}

/**
 * Drop-in safe wrapper for html2canvas that ensures:
 * 1. Main window getComputedStyle is hooked during rendering
 * 2. Cloned iframe getComputedStyle and DOM are sanitized
 * 3. User onclone callback is preserved and called
 * 4. html2canvas never throws "Attempting to parse an unsupported color function"
 */
export async function safeHtml2Canvas(
  element: HTMLElement,
  options: any = {}
): Promise<HTMLCanvasElement> {
  const unhookMain = typeof window !== 'undefined' ? hookGetComputedStyle(window) : () => {};

  const userOnClone = options.onclone;
  const mergedOptions = {
    ...options,
    onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
      sanitizeHtml2CanvasClonedDoc(clonedDoc);
      if (typeof userOnClone === 'function') {
        userOnClone(clonedDoc, clonedEl);
      }
    }
  };

  try {
    return await html2canvas(element, mergedOptions);
  } finally {
    unhookMain();
  }
}
