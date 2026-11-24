// Lightweight touch & scroll diagnostics overlay.
// Only loaded dynamically when ?touchdebug=1 or localStorage 'gp_touchdebug' === '1'.

interface AncestorSnapshot {
  element: string;
  isScrollContainer: boolean;
  touchAction: string;
  overflow: string;
  overscrollBehavior: string;
  pointerEvents: string;
  position: string;
}

interface TouchDebugSnapshot {
  timestamp: string;
  touchedElement: string;
  effectiveTouchAction: string;
  touchMovePreventDefaultCount: number;
  lastPreventDefaultTarget: string | null;
  lastPreventDefaultType: string | null;
  lastPreventDefaultCancelable: boolean | null;
  windowInnerHeight: number;
  visualViewportHeight: number | null;
  dvh100Px: number | null;
  ancestors: AncestorSnapshot[];
}

type GestureFlag =
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'pinch-zoom'
  | 'double-tap-zoom';

const ALL_GESTURES: GestureFlag[] = [
  'pan-left',
  'pan-right',
  'pan-up',
  'pan-down',
  'pinch-zoom',
  'double-tap-zoom',
];

function parseTouchActionTokens(value: string): Set<GestureFlag> {
  const normalized = (value || 'auto').trim().toLowerCase();
  if (!normalized || normalized === 'auto') {
    return new Set(ALL_GESTURES);
  }
  if (normalized === 'none') {
    return new Set();
  }
  const tokens = normalized.split(/\s+/);
  const out = new Set<GestureFlag>();
  for (const tok of tokens) {
    if (tok === 'manipulation') {
      out.add('pan-left');
      out.add('pan-right');
      out.add('pan-up');
      out.add('pan-down');
      out.add('pinch-zoom');
    } else if (tok === 'pan-x') {
      out.add('pan-left');
      out.add('pan-right');
    } else if (tok === 'pan-y') {
      out.add('pan-up');
      out.add('pan-down');
    } else if (
      tok === 'pan-left' ||
      tok === 'pan-right' ||
      tok === 'pan-up' ||
      tok === 'pan-down' ||
      tok === 'pinch-zoom'
    ) {
      out.add(tok);
    }
  }
  return out;
}

function formatEffectiveTouchAction(flags: Set<GestureFlag>): string {
  if (flags.size === 0) return 'none (blocked)';
  if (flags.size === ALL_GESTURES.length) return 'auto';
  if (
    flags.size === 5 &&
    flags.has('pan-left') &&
    flags.has('pan-right') &&
    flags.has('pan-up') &&
    flags.has('pan-down') &&
    flags.has('pinch-zoom') &&
    !flags.has('double-tap-zoom')
  ) {
    return 'manipulation';
  }
  const parts: string[] = [];
  if (flags.has('pan-left') && flags.has('pan-right')) {
    parts.push('pan-x');
  } else {
    if (flags.has('pan-left')) parts.push('pan-left');
    if (flags.has('pan-right')) parts.push('pan-right');
  }
  if (flags.has('pan-up') && flags.has('pan-down')) {
    parts.push('pan-y');
  } else {
    if (flags.has('pan-up')) parts.push('pan-up');
    if (flags.has('pan-down')) parts.push('pan-down');
  }
  if (flags.has('pinch-zoom')) parts.push('pinch-zoom');
  if (flags.has('double-tap-zoom')) parts.push('double-tap-zoom');
  return parts.join(' ') || 'none';
}

function describeElement(el: Element | null): string {
  if (!el) return 'null';
  const tag = el.tagName.toLowerCase();
  const idPart = el.id ? `#${el.id}` : '';
  const rawClass =
    typeof (el as HTMLElement).className === 'string'
      ? (el as HTMLElement).className
      : el.getAttribute('class') || '';
  const classes = rawClass
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((c) => `.${c}`)
    .join('');
  return `${tag}${idPart}${classes}`;
}

function isScrollableContainer(el: Element, cs: CSSStyleDeclaration): boolean {
  const oy = cs.overflowY;
  const ox = cs.overflowX;
  const canScrollY = (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1;
  const canScrollX = (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1;
  return canScrollY || canScrollX;
}

let activeTeardown: (() => void) | null = null;

export function initTouchDebug(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }
  if (activeTeardown) {
    return activeTeardown;
  }

  // Hidden probe to measure CSS 100dvh in pixels
  const dvhProbe = document.createElement('div');
  dvhProbe.setAttribute('aria-hidden', 'true');
  dvhProbe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:100dvh;visibility:hidden;pointer-events:none;z-index:-1;';
  document.body.appendChild(dvhProbe);

  const measure100Dvh = (): number | null => {
    try {
      const h = dvhProbe.getBoundingClientRect().height;
      return h > 0 ? Math.round(h * 100) / 100 : null;
    } catch {
      return null;
    }
  };

  // Floating debug panel
  const panel = document.createElement('div');
  panel.id = 'gp-touch-debug-panel';
  panel.style.cssText = [
    'position:fixed',
    'left:8px',
    'right:8px',
    'bottom:calc(8px + env(safe-area-inset-bottom, 0px))',
    'max-height:42dvh',
    'z-index:2147483647',
    'background:rgba(15,23,42,0.94)',
    'color:#e2e8f0',
    'border:1px solid rgba(56,189,248,0.45)',
    'border-radius:12px',
    'box-shadow:0 12px 32px rgba(0,0,0,0.45)',
    'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace',
    'font-size:11px',
    'line-height:1.4',
    'display:flex',
    'flex-direction:column',
    'overflow:hidden',
    'touch-action:pan-x pan-y',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;background:rgba(30,41,59,0.95);border-bottom:1px solid rgba(148,163,184,0.22);flex-shrink:0;';

  const title = document.createElement('span');
  title.textContent = 'TouchDebug Active (tap anywhere)';
  title.style.cssText = 'font-weight:700;color:#38bdf8;font-size:11px;';

  const btnGroup = document.createElement('div');
  btnGroup.style.cssText = 'display:flex;align-items:center;gap:6px;';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy report';
  copyBtn.style.cssText =
    'padding:3px 8px;border-radius:6px;border:1px solid rgba(56,189,248,0.45);background:rgba(14,165,233,0.18);color:#e0f2fe;font-size:10px;font-weight:700;cursor:pointer;';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText =
    'padding:3px 8px;border-radius:6px;border:1px solid rgba(248,113,113,0.45);background:rgba(239,68,68,0.2);color:#fee2e2;font-size:10px;font-weight:700;cursor:pointer;';

  btnGroup.appendChild(copyBtn);
  btnGroup.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(btnGroup);

  const body = document.createElement('pre');
  body.style.cssText =
    'margin:0;padding:8px 10px;overflow:auto;white-space:pre-wrap;word-break:break-word;flex:1;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;font-size:10.5px;';
  body.textContent = 'Touch any element to inspect its scroll/touch-action chain...';

  panel.appendChild(header);
  panel.appendChild(body);
  document.body.appendChild(panel);

  let currentSnapshot: TouchDebugSnapshot | null = null;
  let touchMovePreventDefaultCount = 0;
  let lastPreventDefaultTarget: string | null = null;
  let lastPreventDefaultType: string | null = null;
  let lastPreventDefaultCancelable: boolean | null = null;

  const renderSnapshot = () => {
    if (!currentSnapshot) return;
    const s = currentSnapshot;
    const lines: string[] = [
      `Target: ${s.touchedElement}`,
      `Effective touch-action: ${s.effectiveTouchAction}`,
      `touchmove preventDefault(): ${s.touchMovePreventDefaultCount > 0 ? `YES (${s.touchMovePreventDefaultCount}x, last=${s.lastPreventDefaultType} on ${s.lastPreventDefaultTarget}, cancelable=${s.lastPreventDefaultCancelable})` : 'NO'}`,
      `Viewport: innerHeight=${s.windowInnerHeight}px | visualViewport=${s.visualViewportHeight ?? 'n/a'}px | 100dvh=${s.dvh100Px ?? 'unsupported'}px`,
      `Ancestors to scroll container (${s.ancestors.length}):`,
    ];
    s.ancestors.forEach((a, idx) => {
      lines.push(
        `  ${idx}. ${a.element}${a.isScrollContainer ? ' [SCROLL CONTAINER]' : ''}`
      );
      lines.push(
        `     touch-action=${a.touchAction} | overflow=${a.overflow} | overscroll=${a.overscrollBehavior} | pointer-events=${a.pointerEvents} | pos=${a.position}`
      );
    });
    body.textContent = lines.join('\n');
  };

  // Wrap Event.prototype.preventDefault ONLY while touchdebug is active
  const origPreventDefault = Event.prototype.preventDefault;
  Event.prototype.preventDefault = function patchedPreventDefault(this: Event) {
    if (this && (this.type === 'touchmove' || this.type === 'touchstart')) {
      if (this.type === 'touchmove') {
        touchMovePreventDefaultCount += 1;
      }
      lastPreventDefaultType = this.type;
      lastPreventDefaultCancelable = this.cancelable;
      lastPreventDefaultTarget =
        this.target instanceof Element ? describeElement(this.target) : String(this.target);
      if (currentSnapshot) {
        currentSnapshot.touchMovePreventDefaultCount = touchMovePreventDefaultCount;
        currentSnapshot.lastPreventDefaultTarget = lastPreventDefaultTarget;
        currentSnapshot.lastPreventDefaultType = lastPreventDefaultType;
        currentSnapshot.lastPreventDefaultCancelable = lastPreventDefaultCancelable;
        renderSnapshot();
      }
    }
    return origPreventDefault.apply(this, arguments as unknown as []);
  };

  const handleTouchStart = (e: TouchEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target || panel.contains(target)) return;

    // Reset per-gesture counter at start of new touch
    touchMovePreventDefaultCount = 0;
    lastPreventDefaultTarget = null;
    lastPreventDefaultType = null;
    lastPreventDefaultCancelable = null;

    const ancestors: AncestorSnapshot[] = [];
    let effective = new Set<GestureFlag>(ALL_GESTURES);
    let node: Element | null = target;

    while (node) {
      const cs = window.getComputedStyle(node);
      const isScroll = node !== target && isScrollableContainer(node, cs);
      const nodeScrollItself = node === target && isScrollableContainer(node, cs);
      const touchAction = cs.touchAction || 'auto';
      const tokens = parseTouchActionTokens(touchAction);
      const nextEffective = new Set<GestureFlag>();
      for (const g of effective) {
        if (tokens.has(g)) nextEffective.add(g);
      }
      effective = nextEffective;

      ancestors.push({
        element: describeElement(node),
        isScrollContainer: isScroll || nodeScrollItself,
        touchAction,
        overflow: `${cs.overflowX}/${cs.overflowY}`,
        overscrollBehavior: `${cs.overscrollBehaviorX}/${cs.overscrollBehaviorY}`,
        pointerEvents: cs.pointerEvents || 'auto',
        position: cs.position || 'static',
      });

      if (isScroll) {
        break;
      }
      if (node === document.documentElement) {
        break;
      }
      node = node.parentElement;
    }

    currentSnapshot = {
      timestamp: new Date().toISOString(),
      touchedElement: describeElement(target),
      effectiveTouchAction: formatEffectiveTouchAction(effective),
      touchMovePreventDefaultCount: 0,
      lastPreventDefaultTarget: null,
      lastPreventDefaultType: null,
      lastPreventDefaultCancelable: null,
      windowInnerHeight: window.innerHeight,
      visualViewportHeight: window.visualViewport
        ? Math.round(window.visualViewport.height * 100) / 100
        : null,
      dvh100Px: measure100Dvh(),
      ancestors,
    };

    renderSnapshot();
  };

  const handleCopy = async () => {
    const text = currentSnapshot
      ? JSON.stringify(currentSnapshot, null, 2)
      : 'No touch recorded yet.';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy report';
      }, 1400);
    } catch {
      copyBtn.textContent = 'Copy failed';
      setTimeout(() => {
        copyBtn.textContent = 'Copy report';
      }, 1400);
    }
  };

  const teardown = () => {
    Event.prototype.preventDefault = origPreventDefault;
    document.removeEventListener('touchstart', handleTouchStart, true);
    copyBtn.removeEventListener('click', handleCopy);
    closeBtn.removeEventListener('click', handleClose);
    panel.remove();
    dvhProbe.remove();
    activeTeardown = null;
  };

  const handleClose = () => {
    try {
      window.localStorage.removeItem('gp_touchdebug');
    } catch {
      // ignore
    }
    teardown();
  };

  document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
  copyBtn.addEventListener('click', handleCopy);
  closeBtn.addEventListener('click', handleClose);

  activeTeardown = teardown;
  return teardown;
}
