import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Printer, Save, X, Edit3, Download, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { UserProfile, BrandingConfig } from '../types';
import { getCardStyle } from '../lib/styleUtils';
import { cn } from '../lib/utils';

interface ReceiptTemplate {
  title: string;
  address1: string;
  address2: string;
  footer: string;
  item1Name: string;
  item1Amount: string;
  item2Name: string;
  item2Amount: string;
  item3Name: string;
  item3Amount: string;
  item4Name: string;
  item4Amount: string;
}

interface ReceiptManagerProps {
  currentUser: UserProfile;
  branding: BrandingConfig;
}

export default function ReceiptManager({ currentUser, branding }: ReceiptManagerProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [template, setTemplate] = useState<ReceiptTemplate>({
    title: 'GREEN TECH SERVICES',
    address1: 'Jinnah Complax Road',
    address2: 'Sadiqabad',
    footer: 'Thank You For Using Our Services.',
    item1Name: 'Item 1',
    item1Amount: '0.00',
    item2Name: 'Item 2',
    item2Amount: '0.00',
    item3Name: 'Item 3',
    item3Amount: '0.00',
    item4Name: 'Item 4',
    item4Amount: '0.00',
  });

  // Load template from localStorage
  useEffect(() => {
    const title = localStorage.getItem('gts_receipt_title') || 'GREEN TECH SERVICES';
    const address1 = localStorage.getItem('gts_receipt_address1') || 'Jinnah Complax Road';
    const address2 = localStorage.getItem('gts_receipt_address2') || 'Sadiqabad';
    const footer = localStorage.getItem('gts_receipt_footer') || 'Thank You For Using Our Services.';
    const item1Name = localStorage.getItem('gts_receipt_item1_name') || 'Item 1';
    const item1Amount = localStorage.getItem('gts_receipt_item1_amount') || '0.00';
    const item2Name = localStorage.getItem('gts_receipt_item2_name') || 'Item 2';
    const item2Amount = localStorage.getItem('gts_receipt_item2_amount') || '0.00';
    const item3Name = localStorage.getItem('gts_receipt_item3_name') || 'Item 3';
    const item3Amount = localStorage.getItem('gts_receipt_item3_amount') || '0.00';
    const item4Name = localStorage.getItem('gts_receipt_item4_name') || 'Item 4';
    const item4Amount = localStorage.getItem('gts_receipt_item4_amount') || '0.00';

    setTemplate({
      title,
      address1,
      address2,
      footer,
      item1Name,
      item1Amount,
      item2Name,
      item2Amount,
      item3Name,
      item3Amount,
      item4Name,
      item4Amount,
    });
  }, []);

  const handleSaveTemplate = () => {
    localStorage.setItem('gts_receipt_title', template.title);
    localStorage.setItem('gts_receipt_address1', template.address1);
    localStorage.setItem('gts_receipt_address2', template.address2);
    localStorage.setItem('gts_receipt_footer', template.footer);
    localStorage.setItem('gts_receipt_item1_name', template.item1Name);
    localStorage.setItem('gts_receipt_item1_amount', template.item1Amount);
    localStorage.setItem('gts_receipt_item2_name', template.item2Name);
    localStorage.setItem('gts_receipt_item2_amount', template.item2Amount);
    localStorage.setItem('gts_receipt_item3_name', template.item3Name);
    localStorage.setItem('gts_receipt_item3_amount', template.item3Amount);
    localStorage.setItem('gts_receipt_item4_name', template.item4Name);
    localStorage.setItem('gts_receipt_item4_amount', template.item4Amount);
    
    // Dispatch a storage event so other open components like EntrySheet get notified instantly
    window.dispatchEvent(new Event('storage'));
    
    toast.success('Receipt template saved successfully!');
    setShowEditor(false);
  };

  // Helper to generate dynamic or static date & time formatted like screenshot
  const getFormattedDateTime = () => {
    const now = new Date();
    const optionsDate: Intl.DateTimeFormatOptions = { month: 'long', day: '2-digit', year: 'numeric' };
    const formattedDate = now.toLocaleDateString('en-US', optionsDate);
    
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // hour '0' should be '12'
    const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
    
    const shift = (now.getHours() >= 6 && now.getHours() < 18) ? 'Day' : 'Night';
    return {
      date: formattedDate,
      time: `${formattedTime} - ${shift}`
    };
  };

  const { date: displayDate, time: displayTime } = getFormattedDateTime();

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 150] // thermal receipt size 80mm x 150mm
      });

      // Set clean typography
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(template.title, 40, 12, { align: 'center' });

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(template.address1, 40, 18, { align: 'center' });
      doc.text(template.address2, 40, 23, { align: 'center' });

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(displayDate, 40, 29, { align: 'center' });
      doc.text(displayTime, 40, 34, { align: 'center' });

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('......................................................................................', 40, 39, { align: 'center' });
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Online Receipt', 40, 44, { align: 'center' });
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('......................................................................................', 40, 49, { align: 'center' });

      // Draw items
      let y = 56;
      const items = [
        { name: template.item1Name, amount: template.item1Amount },
        { name: template.item2Name, amount: template.item2Amount },
        { name: template.item3Name, amount: template.item3Amount },
        { name: template.item4Name, amount: template.item4Amount }
      ];

      items.forEach(item => {
        if (item.name.trim()) {
          doc.setFont('Helvetica', 'normal');
          doc.text(item.name, 8, y);
          const amt = Number(item.amount) || 0;
          doc.text(amt.toFixed(2), 72, y, { align: 'right' });
          y += 6;
        }
      });

      y += 2;
      doc.text('........................................................', 72, y, { align: 'right' });
      y += 6;

      // Draw Total
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Total:', 8, y);
      
      const totalSum = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      doc.text(`= ${totalSum.toFixed(2)}`, 72, y, { align: 'right' });

      y += 12;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      const footerLines = doc.splitTextToSize(template.footer, 64);
      doc.text(footerLines, 40, y, { align: 'center' });

      // Draw horizontal line for signature and STAMP watermark
      y += 18;
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(8, y, 38, y); // 30mm line for signature
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Sign', 23, y + 4, { align: 'center' });

      // Rotated semi-transparent STAMP watermark
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(230, 230, 230); // light gray color
      doc.text('STAMP', 54, y + 2, { angle: -15 });
      doc.setTextColor(0, 0, 0); // Restore to black for other uses

      doc.save('Receipt.pdf');
      toast.success('Receipt PDF downloaded successfully!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Receipts Virtual Directory Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowEditor(true)}
          className={cn(
            "p-6 cursor-pointer flex flex-col items-center justify-center border text-center transition-all relative overflow-hidden group",
            getCardStyle(branding.cardStyle)
          )}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all duration-300" />
          
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-sm z-10">
            <FileText size={28} />
          </div>
          
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 group-hover:text-blue-500 transition-colors mb-1">
            Recipt
          </h4>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Click to configure & print receipt
          </p>
        </motion.div>
      </div>

      {/* Editor & Mockup Modal Popup */}
      <AnimatePresence>
        {showEditor && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={cn(
                "w-full max-w-4xl border overflow-hidden shadow-2xl flex flex-col lg:flex-row text-left",
                getCardStyle(branding.cardStyle)
              )}
            >
              {/* Left Side: Controls */}
              <div className="flex-1 p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[85vh] border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Printer className="text-blue-500 w-5 h-5" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
                      Receipt Template Customizer
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEditor(false)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer border-none bg-transparent"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Header customization */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Header Title</label>
                    <input
                      type="text"
                      value={template.title}
                      onChange={(e) => setTemplate({ ...template, title: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-colors uppercase font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Address Line 1</label>
                      <input
                        type="text"
                        value={template.address1}
                        onChange={(e) => setTemplate({ ...template, address1: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-colors font-semibold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Address Line 2</label>
                      <input
                        type="text"
                        value={template.address2}
                        onChange={(e) => setTemplate({ ...template, address2: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-colors font-semibold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Items customization */}
                  <div className="space-y-3 pt-2">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Default Items & Amounts</span>
                    
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Item 1 Name"
                          value={template.item1Name}
                          onChange={(e) => setTemplate({ ...template, item1Name: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 outline-none font-semibold text-slate-800 dark:text-slate-100"
                        />
                        <input
                          type="text"
                          placeholder="Amount"
                          value={template.item1Amount}
                          onChange={(e) => setTemplate({ ...template, item1Amount: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 outline-none font-mono text-right text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Item 2 Name"
                          value={template.item2Name}
                          onChange={(e) => setTemplate({ ...template, item2Name: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 outline-none font-semibold text-slate-800 dark:text-slate-100"
                        />
                        <input
                          type="text"
                          placeholder="Amount"
                          value={template.item2Amount}
                          onChange={(e) => setTemplate({ ...template, item2Amount: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 outline-none font-mono text-right text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Item 3 Name"
                          value={template.item3Name}
                          onChange={(e) => setTemplate({ ...template, item3Name: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 outline-none font-semibold text-slate-800 dark:text-slate-100"
                        />
                        <input
                          type="text"
                          placeholder="Amount"
                          value={template.item3Amount}
                          onChange={(e) => setTemplate({ ...template, item3Amount: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 outline-none font-mono text-right text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Item 4 Name"
                          value={template.item4Name}
                          onChange={(e) => setTemplate({ ...template, item4Name: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 outline-none font-semibold text-slate-800 dark:text-slate-100"
                        />
                        <input
                          type="text"
                          placeholder="Amount"
                          value={template.item4Amount}
                          onChange={(e) => setTemplate({ ...template, item4Amount: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 outline-none font-mono text-right text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer message */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Footer Note</label>
                    <textarea
                      value={template.footer}
                      onChange={(e) => setTemplate({ ...template, footer: e.target.value })}
                      className="w-full h-16 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-colors font-semibold text-slate-800 dark:text-slate-100 resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSaveTemplate}
                    className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 border-none cursor-pointer shadow-lg shadow-blue-600/20"
                  >
                    <Save size={14} />
                    Save Template
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    <Download size={14} />
                    Download PDF
                  </button>
                </div>
              </div>

              {/* Right Side: Virtual Receipt Mockup */}
              <div className="w-full lg:w-[360px] bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-full max-w-[280px] bg-white dark:bg-white text-slate-950 p-6 shadow-xl rounded-md border border-slate-200 relative font-sans text-center">
                  {/* Subtle thermal print paper lines */}
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-b from-slate-200 to-transparent opacity-20" />
                  
                  {/* Company header */}
                  <h1 className="text-base font-black tracking-wide uppercase font-serif mt-2 mb-1">
                    {template.title || 'GREEN TECH SERVICES'}
                  </h1>
                  
                  <p className="text-[10px] leading-tight font-medium text-slate-600">
                    {template.address1 || 'Jinnah Complax Road'}
                  </p>
                  <p className="text-[10px] leading-tight font-medium text-slate-600 mb-2">
                    {template.address2 || 'Sadiqabad'}
                  </p>

                  {/* Date & Time */}
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-900 leading-normal space-y-0.5 mb-3">
                    <div>{displayDate}</div>
                    <div>{displayTime}</div>
                  </div>

                  {/* Separators & Title */}
                  <div className="text-[9px] font-bold text-slate-400 tracking-tighter leading-none select-none">
                    ..................................................................
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-900 my-1">
                    Online Receipt
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 tracking-tighter leading-none select-none mb-3">
                    ..................................................................
                  </div>

                  {/* Items List */}
                  <div className="space-y-1.5 text-xs font-semibold text-left mb-4">
                    {template.item1Name && (
                      <div className="flex justify-between items-center">
                        <span className="truncate max-w-[150px]">{template.item1Name}</span>
                        <span className="font-mono">{(parseFloat(template.item1Amount) || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {template.item2Name && (
                      <div className="flex justify-between items-center">
                        <span className="truncate max-w-[150px]">{template.item2Name}</span>
                        <span className="font-mono">{(parseFloat(template.item2Amount) || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {template.item3Name && (
                      <div className="flex justify-between items-center">
                        <span className="truncate max-w-[150px]">{template.item3Name}</span>
                        <span className="font-mono">{(parseFloat(template.item3Amount) || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {template.item4Name && (
                      <div className="flex justify-between items-center">
                        <span className="truncate max-w-[150px]">{template.item4Name}</span>
                        <span className="font-mono">{(parseFloat(template.item4Amount) || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Separation */}
                  <div className="text-right text-[9px] font-bold text-slate-400 tracking-tighter leading-none select-none mb-1.5">
                    ................................
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center text-xs font-extrabold text-slate-950 mb-6">
                    <span>Total:</span>
                    <span className="font-mono">
                      = {(
                        (parseFloat(template.item1Amount) || 0) +
                        (parseFloat(template.item2Amount) || 0) +
                        (parseFloat(template.item3Amount) || 0) +
                        (parseFloat(template.item4Amount) || 0)
                      ).toFixed(2)}
                    </span>
                  </div>

                  {/* Footer message */}
                  <p className="text-[10px] font-extrabold text-slate-800 leading-relaxed max-w-[200px] mx-auto mb-6 whitespace-pre-line">
                    {template.footer || 'Thank You For Using Our Services.'}
                  </p>

                  {/* Signature and Stamp Watermark */}
                  <div className="mt-8 pt-4 border-t border-dashed border-slate-100 flex items-end justify-between relative min-h-[55px]">
                    <div className="flex flex-col items-center">
                      <div className="w-24 border-b border-slate-950 mb-1" />
                      <span className="text-[10px] font-bold text-slate-500">Sign</span>
                    </div>
                    
                    <div className="text-slate-200/40 text-4xl font-black uppercase tracking-wider select-none transform -rotate-12 absolute right-4 bottom-2 font-sans">
                      STAMP
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
