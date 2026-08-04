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
  outstandingAmount?: string;
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
    outstandingAmount: '0.00',
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
    const outstandingAmount = localStorage.getItem('gts_receipt_outstanding_amount') || '0.00';

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
      outstandingAmount,
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
    localStorage.setItem('gts_receipt_outstanding_amount', template.outstandingAmount || '0.00');
    
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
        format: 'a5'
      });

      // Main Header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(template.title, 74, 15, { align: 'center' });
      
      // Address
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`${template.address1} ${template.address2}`, 74, 21, { align: 'center' });
      
      // Gray Online Receipt Box
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(15, 26, 118, 16, 2, 2, 'F');

      doc.setTextColor(30, 41, 59);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('ONLINE RECEIPT', 20, 36.5);
      
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Date : ${displayDate}`, 130, 32, { align: 'right' });
      doc.text(`Time : ${displayTime}`, 130, 37.5, { align: 'right' });

      // Green Table Header
      doc.setFillColor(19, 115, 71);
      doc.roundedRect(15, 48, 118, 10, 1, 1, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('Description', 18, 54.5);
      doc.text('Amount (PKR)', 130, 54.5, { align: 'right' });

      let y = 66;
      const items = [
        { name: template.item1Name, amount: template.item1Amount },
        { 
          name: template.item2Name && template.item2Name !== 'Item 2' ? template.item2Name : '', 
          amount: template.item2Name && template.item2Name !== 'Item 2' ? template.item2Amount : '' 
        },
        { 
          name: template.item3Name && template.item3Name !== 'Item 3' ? template.item3Name : '', 
          amount: template.item3Name && template.item3Name !== 'Item 3' ? template.item3Amount : '' 
        },
        { 
          name: template.item4Name && template.item4Name !== 'Item 4' ? template.item4Name : '', 
          amount: template.item4Name && template.item4Name !== 'Item 4' ? template.item4Amount : '' 
        }
      ];

      const printItems = [...items];
      while (printItems.length < 4) {
        printItems.push({
          name: '',
          amount: ''
        });
      }

      doc.setTextColor(51, 65, 85);
      printItems.forEach(item => {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(item.name || '', 18, y);
        doc.setFont('Courier', 'bold');
        const amtText = item.amount !== undefined && item.amount !== null && item.amount !== '' && !isNaN(Number(item.amount)) ? Number(item.amount).toFixed(2) : '';
        doc.text(amtText, 130, y, { align: 'right' });
        
        y += 5;
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.3);
        doc.line(15, y, 133, y);
        y += 7;
      });

      // Totals section
      y = 115;
      
      // PAID Stamp
      doc.saveGraphicsState();
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(1.0);
      doc.setTextColor(16, 185, 129);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.setCurrentTransformationMatrix(doc.Matrix(0.9781, -0.2079, 0.2079, 0.9781, 18, y + 10));
      doc.roundedRect(0, -8, 28, 12, 1, 1, 'D');
      doc.text('PAID', 14, 0, { align: 'center' });
      doc.restoreGraphicsState();

      // Total
      doc.setTextColor(0, 0, 0);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Total:', 85, y + 4);
      
      doc.setFont('Courier', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(16, 185, 129);
      const totalSum = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      doc.text(`= ${totalSum.toFixed(2)}`, 130, y + 4, { align: 'right' });

      const outstandingVal = parseFloat(template.outstandingAmount || '0');
      if (outstandingVal > 0) {
        doc.setTextColor(0, 0, 0);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Outstanding payment:', 72, y + 10);
        doc.setFont('Courier', 'bold');
        doc.setFontSize(11.5);
        doc.setTextColor(239, 68, 68);
        doc.text(`= ${outstandingVal.toFixed(2)}`, 130, y + 10, { align: 'right' });
      }

      // Separator Line
      doc.setLineWidth(0.8);
      doc.setDrawColor(0, 0, 0);
      doc.line(15, y + 18, 133, y + 18);
      
      // Footer lines
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(10.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Thank You For Using Our Services.', 74, y + 25, { align: 'center' });
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(71, 85, 105);
      doc.text('Contact # 0300 1020757', 74, y + 32, { align: 'center' });

      // Stamp Watermark
      doc.setTextColor(241, 245, 249);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(32);
      doc.saveGraphicsState();
      doc.setCurrentTransformationMatrix(doc.Matrix(0.9781, -0.2079, 0.2079, 0.9781, 22, y + 45));
      doc.text('STAMP', 0, 0);
      doc.restoreGraphicsState();

      // Authorized Sign
      doc.setLineWidth(0.4);
      doc.setDrawColor(0, 0, 0);
      doc.line(90, y + 46, 130, y + 46);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Authorized Sign', 110, y + 51, { align: 'center' });

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
              <div className="flex-1 p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[85vh] border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/10">
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
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-colors uppercase font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Address Line 1</label>
                      <input
                        type="text"
                        value={template.address1}
                        onChange={(e) => setTemplate({ ...template, address1: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-colors font-semibold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Address Line 2</label>
                      <input
                        type="text"
                        value={template.address2}
                        onChange={(e) => setTemplate({ ...template, address2: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-colors font-semibold text-slate-800 dark:text-slate-100"
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
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 outline-none font-semibold text-slate-800 dark:text-slate-100"
                        />
                        <input
                          type="text"
                          placeholder="Amount"
                          value={template.item1Amount}
                          onChange={(e) => setTemplate({ ...template, item1Amount: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 outline-none font-mono text-right text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Item 2 Name"
                          value={template.item2Name}
                          onChange={(e) => setTemplate({ ...template, item2Name: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 outline-none font-semibold text-slate-800 dark:text-slate-100"
                        />
                        <input
                          type="text"
                          placeholder="Amount"
                          value={template.item2Amount}
                          onChange={(e) => setTemplate({ ...template, item2Amount: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 outline-none font-mono text-right text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Item 3 Name"
                          value={template.item3Name}
                          onChange={(e) => setTemplate({ ...template, item3Name: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 outline-none font-semibold text-slate-800 dark:text-slate-100"
                        />
                        <input
                          type="text"
                          placeholder="Amount"
                          value={template.item3Amount}
                          onChange={(e) => setTemplate({ ...template, item3Amount: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 outline-none font-mono text-right text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Item 4 Name"
                          value={template.item4Name}
                          onChange={(e) => setTemplate({ ...template, item4Name: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 outline-none font-semibold text-slate-800 dark:text-slate-100"
                        />
                        <input
                          type="text"
                          placeholder="Amount"
                          value={template.item4Amount}
                          onChange={(e) => setTemplate({ ...template, item4Amount: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 outline-none font-mono text-right text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Outstanding Balance customization */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Outstanding Payment (CR.)</label>
                    <input
                      type="text"
                      placeholder="Outstanding Amount (e.g. 500.00)"
                      value={template.outstandingAmount || ''}
                      onChange={(e) => setTemplate({ ...template, outstandingAmount: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-colors font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  {/* Footer message */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Footer Note</label>
                    <textarea
                      value={template.footer}
                      onChange={(e) => setTemplate({ ...template, footer: e.target.value })}
                      className="w-full h-16 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-colors font-semibold text-slate-800 dark:text-slate-100 resize-none"
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
                <div className="w-full max-w-[300px] bg-white dark:bg-white text-slate-950 p-6 shadow-xl rounded-md border border-slate-200 relative font-sans text-center">
                  {/* Subtle thermal print paper lines */}
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-b from-slate-200 to-transparent opacity-20" />
                  
                  {/* Company header */}
                  <h1 className="text-sm font-black tracking-wider uppercase mt-2 mb-1 text-slate-900 font-sans whitespace-nowrap overflow-hidden text-ellipsis w-full block text-center">
                    {template.title || 'GREEN TECH SERVICES'}
                  </h1>
                  
                  <p className="text-[10px] leading-tight font-medium text-slate-500 mb-4">
                    {template.address1 || 'Jinnah Complax Road'} {template.address2 || 'Sadiqabad'}
                  </p>

                  {/* Header Box */}
                  <div className="bg-slate-100 rounded-lg p-3 flex justify-between items-center mb-4 text-left">
                    <div className="text-[12px] font-black uppercase tracking-wider text-slate-800">
                      ONLINE RECEIPT
                    </div>
                    <div className="text-[9px] font-bold text-slate-600 text-right space-y-0.5 leading-tight">
                      <div>Date : {displayDate}</div>
                      <div>Time : {displayTime}</div>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="w-full text-left mb-4">
                    <div className="flex justify-between bg-[#137347] text-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider mb-2 rounded-sm">
                      <span>Description</span>
                      <span>Amount (PKR)</span>
                    </div>
                    
                    <div className="space-y-2.5 text-[11px] font-medium text-slate-700 px-3 min-h-[90px]">
                      <div className="flex justify-between items-center pb-1 border-b border-dashed border-slate-100">
                        <span className="truncate max-w-[140px] leading-tight text-slate-800">
                          {template.item1Name || 'Item 1'}
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {template.item1Amount !== undefined && template.item1Amount !== null && template.item1Amount !== '' && !isNaN(Number(template.item1Amount)) ? Number(template.item1Amount).toFixed(2) : '\u00A0'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pb-1 border-b border-dashed border-slate-100">
                        <span className="truncate max-w-[140px] leading-tight text-slate-800">
                          {template.item2Name && template.item2Name !== 'Item 2' ? template.item2Name : '\u00A0'}
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {template.item2Name && template.item2Name !== 'Item 2' && template.item2Amount !== undefined && template.item2Amount !== null && template.item2Amount !== '' && !isNaN(Number(template.item2Amount)) ? Number(template.item2Amount).toFixed(2) : '\u00A0'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pb-1 border-b border-dashed border-slate-100">
                        <span className="truncate max-w-[140px] leading-tight text-slate-800">
                          {template.item3Name && template.item3Name !== 'Item 3' ? template.item3Name : '\u00A0'}
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {template.item3Name && template.item3Name !== 'Item 3' && template.item3Amount !== undefined && template.item3Amount !== null && template.item3Amount !== '' && !isNaN(Number(template.item3Amount)) ? Number(template.item3Amount).toFixed(2) : '\u00A0'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pb-1 border-b border-dashed border-slate-100 last:border-0">
                        <span className="truncate max-w-[140px] leading-tight text-slate-800">
                          {template.item4Name && template.item4Name !== 'Item 4' ? template.item4Name : '\u00A0'}
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {template.item4Name && template.item4Name !== 'Item 4' && template.item4Amount !== undefined && template.item4Amount !== null && template.item4Amount !== '' && !isNaN(Number(template.item4Amount)) ? Number(template.item4Amount).toFixed(2) : '\u00A0'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Totals Section */}
                    <div className="flex flex-col items-end gap-1 text-right mt-3 pr-3">
                      <div className="flex items-center gap-2 text-[12px] font-extrabold text-slate-900">
                        <span>Total:</span>
                        <span className="font-mono text-emerald-600 font-black">
                          = {(
                            (parseFloat(template.item1Amount) || 0) +
                            (template.item2Name && template.item2Name !== 'Item 2' ? (parseFloat(template.item2Amount) || 0) : 0) +
                            (template.item3Name && template.item3Name !== 'Item 3' ? (parseFloat(template.item3Amount) || 0) : 0) +
                            (template.item4Name && template.item4Name !== 'Item 4' ? (parseFloat(template.item4Amount) || 0) : 0)
                          ).toFixed(2)}
                        </span>
                      </div>
                      {parseFloat(template.outstandingAmount || '0') > 0 && (
                        <div className="flex items-center gap-2 text-[11px] font-extrabold text-slate-900">
                          <span>Outstanding payment:</span>
                          <span className="font-mono text-rose-600 font-black">
                            = {parseFloat(template.outstandingAmount || '0').toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="border-t-2 border-slate-950 mt-3 mb-2"></div>
                  </div>

                  {/* Footer message */}
                  <p className="text-[10.5px] italic font-bold text-slate-500 leading-normal mb-1">
                    Thank You For Using Our Services.
                  </p>
                  <p className="text-[13px] font-bold text-slate-700 mb-6 tracking-wide">
                    Contact # 0300 1020757
                  </p>

                  {/* Signature & Stamp Watermark */}
                  <div className="flex items-end justify-between relative min-h-[50px] mb-2">
                    {/* STAMP Watermark */}
                    <div className="absolute left-2 bottom-1 text-slate-200/50 text-2xl font-black uppercase tracking-wider transform -rotate-12 select-none pointer-events-none">
                      STAMP
                    </div>

                    <div className="text-emerald-500 border-2 border-emerald-500 rounded px-2 py-0.5 text-xl font-black uppercase tracking-widest transform -rotate-12 opacity-90 select-none">
                      PAID
                        </div>
                    
                    <div className="flex flex-col items-center text-center relative z-10">
                      <div className="w-28 border-b border-slate-900 mb-1 relative">
                        <span className="absolute bottom-0.5 left-0 right-0 text-[18px] font-black text-slate-800/20 pointer-events-none" style={{ fontFamily: "'Brush Script MT', cursive" }}>Ahmad</span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Authorized Sign</span>
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
