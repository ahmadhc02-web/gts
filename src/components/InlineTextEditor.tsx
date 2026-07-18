import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, RotateCcw, AlertCircle, Edit, Sparkles, Check } from 'lucide-react';
import { BrandingConfig } from '../types';
import { pocketbaseService } from '../lib/pocketbaseService';
import { safeLocalStorage } from '../lib/safeLocalStorage';
import { toast } from 'sonner';

interface InlineTextEditorProps {
  isActive: boolean;
  onToggle: () => void;
  branding?: BrandingConfig;
  userFullName?: string;
  onUpdateBranding?: (newBranding: BrandingConfig) => void;
}

interface EditingNodeInfo {
  element: HTMLElement;
  originalKey: string;
  currentValue: string;
}

// Global DOM translator helper that finds and replaces matching text nodes and leaf element containers
export const translateDOM = (translations: Record<string, string>) => {
  if (!translations || Object.keys(translations).length === 0) return;

  const walk = (node: Node) => {
    // Skip interactive/media elements
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      if (['script', 'style', 'iframe', 'input', 'textarea', 'select', 'canvas', 'svg', 'path', 'audio', 'video'].includes(tagName)) {
        return;
      }
      // Skip our own editor components
      if (el.closest('.inline-editor-ui')) {
        return;
      }

      // 1. Matched Entire Container Leaf Elements (e.g., spans/labels with split dynamic children, or GT/S logo split)
      const txt = (el.textContent || '').trim();
      if (txt && translations[txt]) {
        // If it does not contain block layout elements, translate its textContent directly
        if (!el.querySelector('div, p, h1, h2, h3, h4, h5, h6, table, form, main, section, header, footer, aside, nav, ul, ol')) {
          el.textContent = translations[txt];
          return; // Skip walking children because content was replaced
        }
      }
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const val = node.nodeValue;
      if (val) {
        const trimmed = val.trim();
        if (trimmed) {
          // If translation exists for this trimmed node content
          if (translations[trimmed]) {
            node.nodeValue = val.replace(trimmed, translations[trimmed]);
          } else {
            // Check exact trimmed matches and preserve surrounding whitespace
            const cleanKey = trimmed;
            if (translations[cleanKey]) {
              const leadSpace = val.match(/^\s*/)?.[0] || '';
              const trailSpace = val.match(/\s*$/)?.[0] || '';
              node.nodeValue = leadSpace + translations[cleanKey] + trailSpace;
            }
          }
        }
      }
    }

    let child = node.firstChild;
    while (child) {
      walk(child);
      child = child.nextSibling;
    }
  };

  walk(document.body);
};

export default function InlineTextEditor({
  isActive,
  onToggle,
  branding,
  userFullName = 'Super Admin',
  onUpdateBranding
}: InlineTextEditorProps) {
  const [editingNode, setEditingNode] = useState<EditingNodeInfo | null>(null);
  const [customValue, setCustomValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Helper to determine if element is eligible for inline-text-editing
  const isEditableElement = (el: HTMLElement): boolean => {
    if (!el) return false;
    const tagName = el.tagName.toLowerCase();
    
    // Ignore input forms, action triggers, media element wrappers, etc.
    if (['input', 'textarea', 'select', 'option', 'script', 'style', 'iframe', 'canvas', 'svg', 'path', 'audio', 'video', 'img'].includes(tagName)) {
      return false;
    }

    // Ignore elements within our own inline editor popovers & other control buttons
    if (el.closest('.inline-editor-ui') || el.closest('#profile-toggle-btn') || el.closest('#sidebar-toggle-btn')) {
      return false;
    }

    // Check if element has at least one active child Node containing non-empty text content
    const hasActiveTextChild = Array.from(el.childNodes).some(
      node => node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim() !== ''
    );

    return hasActiveTextChild;
  };

  // Inject custom stylesheet for highlight border & cursor feedback dynamically
  useEffect(() => {
    const styleId = 'inline-text-editor-styles';
    let styleElement = document.getElementById(styleId);

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.innerHTML = `
        .inline-editable-hover {
          outline: 2px dashed #10b981 !important;
          outline-offset: 1px !important;
          opacity: 0.95;
          position: relative;
          cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%2310b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>') 4 12, pointer !important;
          transition: outline 0.15s ease-in-out;
        }
      `;
      document.head.appendChild(styleElement);
    }

    return () => {
      styleElement?.remove();
    };
  }, []);

  // Listen for Mouse Hover events when Inline Editing Mode is enabled
  useEffect(() => {
    if (!isActive) return;

    let lastHovered: HTMLElement | null = null;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isEditableElement(target)) {
        if (lastHovered && lastHovered !== target) {
          lastHovered.classList.remove('inline-editable-hover');
        }
        target.classList.add('inline-editable-hover');
        lastHovered = target;
      } else {
        if (lastHovered) {
          lastHovered.classList.remove('inline-editable-hover');
          lastHovered = null;
        }
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      target.classList.remove('inline-editable-hover');
    };

    // Capture Clicks to trigger the Text Edit overlay Dialog
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isEditableElement(target)) {
        e.stopPropagation();
        e.preventDefault();

        const currentText = (target.innerText || target.textContent || '').trim();
        if (!currentText) return;

        // Trace and retrieve original translation key from config if already customized
        let originalTextKey = currentText;
        if (branding?.translations) {
          // If the current text is already a key in the translations dictionary mapping to itself or something else,
          // then the current text itself has established itself as the original/default reference standard!
          if (branding.translations[currentText] !== undefined) {
            originalTextKey = currentText;
          } else {
            for (const [key, val] of Object.entries(branding.translations)) {
              if (val === currentText) {
                originalTextKey = key;
                break;
              }
            }
          }
        }

        setEditingNode({
          element: target,
          originalKey: originalTextKey,
          currentValue: currentText
        });
        setCustomValue(currentText);
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('click', handleDocumentClick, true);
      if (lastHovered) {
        lastHovered.classList.remove('inline-editable-hover');
      }
    };
  }, [isActive, branding?.translations]);

  // Realtime Live translation observer to render customized translations dynamically
  // Realtime Live translation observer to render customized translations dynamically
  useEffect(() => {
    if (!branding?.translations || Object.keys(branding.translations).length === 0) return;

    let isTranslating = false;
    let pendingTranslateTimeout: number | null = null;

    const runTranslation = () => {
      if (isTranslating) return;
      isTranslating = true;
      try {
        observer.disconnect();
        translateDOM(branding.translations || {});
      } catch (err) {
        console.error("Observer translation error:", err);
      } finally {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true
        });
        isTranslating = false;
      }
    };

    const scheduleTranslation = () => {
      if (pendingTranslateTimeout) {
        cancelAnimationFrame(pendingTranslateTimeout);
      }
      pendingTranslateTimeout = requestAnimationFrame(() => {
        runTranslation();
      });
    };

    const observer = new MutationObserver((mutations) => {
      let shouldTranslate = false;
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          shouldTranslate = true;
          break;
        }
        if (m.type === 'characterData') {
          const tar = m.target.parentElement;
          if (tar && !tar.closest('.inline-editor-ui')) {
            shouldTranslate = true;
            break;
          }
        }
      }

      if (shouldTranslate) {
        scheduleTranslation();
      }
    });

    // Run initial translation immediately
    runTranslation();

    return () => {
      observer.disconnect();
      if (pendingTranslateTimeout) {
        cancelAnimationFrame(pendingTranslateTimeout);
      }
    };
  }, [branding?.translations]);

  // Save changes to Firestore
  const handleSaveTextUpdate = async () => {
    if (!editingNode || !branding) return;

    try {
      setIsSaving(true);
      const cleanedInput = customValue.trim();

      const existingTranslations = branding.translations ? { ...branding.translations } : {};

      if (cleanedInput === '' || cleanedInput === editingNode.originalKey) {
        // Remove customization if empty, reverting back to code default
        delete existingTranslations[editingNode.originalKey];
        delete existingTranslations[editingNode.currentValue];
      } else {
        // Enforce translation pairing
        // 1. Map the original key to the newest input value so it applies globally
        existingTranslations[editingNode.originalKey] = cleanedInput;

        // 2. Scan and update all existing translations that mapped to either originalKey or old currentValue,
        // so they now all target the new cleanedInput. This creates a permanent, solid reference tree.
        for (const [key, val] of Object.entries(existingTranslations)) {
          if (val === editingNode.originalKey || val === editingNode.currentValue) {
            existingTranslations[key] = cleanedInput;
          }
        }

        // 3. Keep a self-mapping of the new input to itself so it is instantly recognized as a default/original reference.
        existingTranslations[cleanedInput] = cleanedInput;
      }

      const updatedBranding: BrandingConfig = {
        ...branding,
        translations: existingTranslations,
        updatedAt: Date.now(),
        updatedBy: userFullName
      };

      try {
        safeLocalStorage.setItem('gts_branding', JSON.stringify(updatedBranding));
        safeLocalStorage.setItem('gts_translations', JSON.stringify(existingTranslations));
      } catch (cacheErr) {
        console.warn("Failed to update branding local cache", cacheErr);
      }

      // Save to dedicated unbreakable translations storage and the global configuration document
      await pocketbaseService.updateTranslations(existingTranslations);
      await pocketbaseService.updateBranding(updatedBranding, userFullName);
      
      if (onUpdateBranding) {
        onUpdateBranding(updatedBranding);
      }
      
      // Update element directly in the local viewport for immediate response
      if (editingNode.element) {
        editingNode.element.innerText = cleanedInput || editingNode.originalKey;
      }

      toast.success('Text Updated Globally', {
        description: `Successfully synchronized and updated on all admin & client boards.`,
        icon: <Sparkles className="text-emerald-500 w-5 h-5 animate-spin" />,
        duration: 3000
      });

      setEditingNode(null);
    } catch (err: any) {
      console.error("Text Update Failed:", err);
      toast.error("Sync Failure", {
        description: "Failed to persist branding values to firestore. Check connection."
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Revert custom translations to system default
  const handleResetToDefault = async () => {
    if (!editingNode || !branding) return;

    try {
      setIsSaving(true);
      const existingTranslations = branding.translations ? { ...branding.translations } : {};
      
      delete existingTranslations[editingNode.originalKey];

      const updatedBranding: BrandingConfig = {
        ...branding,
        translations: existingTranslations,
        updatedAt: Date.now(),
        updatedBy: userFullName
      };

      try {
        safeLocalStorage.setItem('gts_branding', JSON.stringify(updatedBranding));
        safeLocalStorage.setItem('gts_translations', JSON.stringify(existingTranslations));
      } catch (cacheErr) {
        console.warn("Failed to clear local cache for default", cacheErr);
      }

      await pocketbaseService.updateTranslations(existingTranslations);
      await pocketbaseService.updateBranding(updatedBranding, userFullName);
      
      if (onUpdateBranding) {
        onUpdateBranding(updatedBranding);
      }
      
      if (editingNode.element) {
        editingNode.element.innerText = editingNode.originalKey;
      }

      toast.success('Restored Default Text', {
        description: 'Successfully reverted back to native defaults.'
      });
      setEditingNode(null);
    } catch (err) {
      console.error("Revert Failure:", err);
      toast.error("Revert Failure");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Dynamic top bar notice showing active editor status */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="inline-editor-ui fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-slate-900/90 text-white shadow-2xl backdrop-blur-md flex items-center gap-3 border border-emerald-500/30 text-xs sm:text-sm"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-slate-100">
              <strong className="text-emerald-400 font-extrabold">SUPER ADMIN EDIT MODE:</strong> Hover and click any text on the screen to rename it globally.
            </span>
            <button
              onClick={onToggle}
              className="ml-2 hover:bg-slate-800 p-1.5 rounded-full text-slate-400 hover:text-white transition-all active:scale-95"
              title="Deactivate inline text editor"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Elegant Pop-up Modal dialog for customizing selected Text node */}
      <AnimatePresence>
        {editingNode && (
          <div className="inline-editor-ui fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg overflow-hidden bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl p-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                    <Edit size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-100">Quick-Edit Global Text</h3>
                    <p className="text-[10px] text-slate-400">Modify any text node instantly across all viewer panels.</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingNode(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="py-4 space-y-4">
                <div className="bg-slate-950/50 rounded-xl p-3.5 border border-slate-800/60">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Original / Default Reference</span>
                  <p className="text-sm font-semibold max-h-24 overflow-y-auto mt-1 break-words text-slate-300">
                    {editingNode.originalKey}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Custom Translated Text</label>
                    <span className="text-[10px] text-slate-500">Real-time sync</span>
                  </div>
                  <textarea
                    rows={3}
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    className="w-full text-sm font-medium px-3.5 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none transition-all"
                    placeholder="Enter customized label or custom language translation..."
                  />
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl disabled:opacity-50 transition-all active:scale-95"
                >
                  <RotateCcw size={14} />
                  Restore Default
                </button>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingNode(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTextUpdate}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl disabled:opacity-50 transition-all shadow-md shadow-emerald-600/10 active:scale-95"
                  >
                    {isSaving ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
