import React from 'react';
import { motion } from 'motion/react';
import { Printer, Download, X } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { DeferredBody } from '../ui/DeferredBody';
import { ReceiptCardSkeleton } from './EntrySheetSkeletons';

export interface ReceiptPreviewPanelProps {
  receiptPanelReady: boolean;
  setReceiptPanelReady: (ready: boolean) => void;
  onClose: () => void;
  onHold: () => void;
  lastSavedEntry: { name: string; amount: number; comments?: string; originalIndex?: number } | null;
  multiSavedEntries: { name: string; amount: number; comments?: string; originalIndex?: number }[] | null;
  previewItemsData: Array<{ entry: any; client: any; actualCount: number }>;
  receiptConfig: {
    title: string;
    address1: string;
    address2: string;
    footer: string;
  };
  getOutstandingPaymentForEntry: (entryName?: string) => number;
  currentReceiptCode: string;
  onRegenerateReceiptCode: () => void;
  onSaveReceiptCode: (code: string) => Promise<void>;
}

const ReceiptPreviewPanel: React.FC<ReceiptPreviewPanelProps> = React.memo(({
  receiptPanelReady,
  setReceiptPanelReady,
  onClose,
  onHold,
  lastSavedEntry,
  multiSavedEntries,
  previewItemsData,
  receiptConfig,
  getOutstandingPaymentForEntry,
  currentReceiptCode,
  onRegenerateReceiptCode,
  onSaveReceiptCode,
}) => {
  const isMulti = multiSavedEntries && multiSavedEntries.length > 0;
  const itemsToPrint = isMulti
    ? multiSavedEntries.slice(0, 4)
    : lastSavedEntry
    ? [lastSavedEntry]
    : [];

  const totalOutstanding = itemsToPrint.reduce((sum, item) => {
    return sum + (item?.name ? getOutstandingPaymentForEntry(item.name) : 0);
  }, 0);

  const totalPreviewAmt = isMulti
    ? multiSavedEntries.slice(0, 4).reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
    : lastSavedEntry
    ? Number(lastSavedEntry.amount) || 0
    : 0;

  return (
    <motion.div
      initial={{ x: 380, opacity: 0.5 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0.5 }}
      transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.22 }}
      style={{ willChange: 'transform' }}
      onAnimationComplete={() => {
        setReceiptPanelReady(true);
      }}
      drag={receiptPanelReady ? 'x' : false}
      dragDirectionLock
      dragConstraints={{ left: 0, right: 380 }}
      dragElastic={{ left: 0.1, right: 0.6 }}
      onDragEnd={(_event, info) => {
        if (info.offset.x > 120) {
          onClose();
        }
      }}
      className="absolute right-0 top-0 h-full w-[380px] max-w-full z-[400] shadow-2xl bg-[#fafafa] dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 p-4 flex flex-col gap-4 font-sans text-slate-900 dark:text-slate-100 print:hidden text-left overflow-y-auto scrollbar-thin transform-gpu"
    >
      {/* Header / Title block */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-205 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Printer className="text-brand-accent h-5 w-5" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 font-mono">
              Receipt Panel
            </h3>
            <p className="text-[10px] text-slate-400">Live printer & pdf queue</p>
          </div>
        </div>

        <button
          onClick={onHold}
          className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 border border-amber-500/20 cursor-pointer"
          title="Hold the receipt and show floating pending button"
        >
          <span>Hold</span>
        </button>
      </div>

      {/* Receipt Preview */}
      <div className="flex-1 flex flex-col items-center justify-center py-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-white/10 overflow-y-auto">
        <DeferredBody fallback={<ReceiptCardSkeleton />}>
          {!receiptPanelReady ? (
            <ReceiptCardSkeleton />
          ) : lastSavedEntry ? (
            (() => {
              const now = new Date();
              const optionsDate: Intl.DateTimeFormatOptions = {
                month: 'long',
                day: '2-digit',
                year: 'numeric',
              };
              const formattedDate = now.toLocaleDateString('en-US', optionsDate);

              let hours = now.getHours();
              const minutes = String(now.getMinutes()).padStart(2, '0');
              const ampm = hours >= 12 ? 'pm' : 'am';
              hours = hours % 12;
              hours = hours ? hours : 12;
              const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
              const shift = now.getHours() >= 6 && now.getHours() < 18 ? 'Day' : 'Night';
              const displayTimeStr = `${formattedTime} - ${shift}`;

              return (
                <div className="w-[320px] bg-white text-slate-950 p-6 shadow-xl rounded-md border border-slate-200 relative text-center font-sans">
                  <h1 className="text-sm font-black tracking-wider uppercase mt-2 mb-1 text-slate-900 font-sans whitespace-nowrap overflow-hidden text-ellipsis w-full block text-center">
                    {receiptConfig.title}
                  </h1>

                  <p className="text-[10px] leading-tight font-medium text-slate-500 mb-4">
                    {receiptConfig.address1} {receiptConfig.address2}
                  </p>

                  <div className="bg-slate-100 rounded-lg p-3 flex justify-between items-center mb-4 text-left">
                    <div className="text-[13px] font-black uppercase tracking-wider text-slate-800">
                      ONLINE RECEIPT
                    </div>
                    <div className="text-[9px] font-bold text-slate-600 text-right space-y-0.5 leading-tight">
                      <div>Date : {formattedDate}</div>
                      <div>Time : {displayTimeStr}</div>
                    </div>
                  </div>

                  <div className="w-full text-left mb-4">
                    <div className="flex justify-between bg-[#137347] text-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider mb-2 rounded-sm">
                      <span>Description</span>
                      <span>Amount (PKR)</span>
                    </div>

                    <div className="space-y-2.5 text-[11px] font-medium text-slate-700 px-3 min-h-[90px]">
                      {previewItemsData.map(({ entry, client, actualCount }, index) => {
                        const hasExtraDetails = actualCount <= 2 && client;
                        return (
                          <div
                            key={index}
                            className="flex justify-between items-start pb-1.5 border-b border-dashed border-slate-100 last:border-0 pt-1"
                          >
                            <div className="flex flex-col text-left max-w-[170px] overflow-hidden">
                              <span className="truncate leading-tight font-semibold text-slate-800">
                                {entry?.name || '\u00A0'}
                              </span>
                              {hasExtraDetails && (
                                <div className="flex flex-col mt-0.5 space-y-0.5 text-[9px] text-slate-500 font-medium">
                                  {client.username && (
                                    <span className="truncate">
                                      ID: <span className="font-mono text-slate-700">{client.username}</span>
                                    </span>
                                  )}
                                  {client.mobileNumber && (
                                    <span className="truncate">
                                      Mob: <span className="font-mono text-slate-700">{client.mobileNumber}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <span className="font-mono font-bold text-slate-900 pt-0.5">
                              {entry?.amount !== undefined &&
                              entry?.amount !== null &&
                              entry?.amount !== '' &&
                              !isNaN(Number(entry?.amount))
                                ? Number(entry?.amount).toFixed(2)
                                : '\u00A0'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col items-end gap-1 text-right mt-3 pr-3">
                      <div className="flex items-center gap-2 text-[12px] font-extrabold text-slate-900">
                        <span>Total:</span>
                        <span className="font-mono text-emerald-600 font-black">
                          = {totalPreviewAmt.toFixed(2)}
                        </span>
                      </div>
                      {totalOutstanding > 0 && (
                        <div className="flex items-center gap-2 text-[11px] font-extrabold text-slate-900">
                          <span>Outstanding payment:</span>
                          <span className="font-mono text-rose-600 font-black">
                            = {totalOutstanding.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="border-t-2 border-slate-950 mt-3 mb-2"></div>
                  </div>

                  <p className="text-[10.5px] italic font-bold text-slate-500 leading-normal mb-1">
                    Thank You For Using Our Services.
                  </p>
                  <p className="text-[13px] font-bold text-slate-700 mb-6 tracking-wide">
                    Contact # 0300 1020757
                  </p>

                  <div className="flex items-end justify-between relative min-h-[50px] mb-2">
                    <div className="absolute left-2 bottom-1 text-slate-200/50 text-2xl font-black uppercase tracking-wider transform -rotate-12 select-none pointer-events-none">
                      STAMP
                    </div>

                    <div className="text-emerald-500 border-2 border-emerald-500 rounded px-2 py-0.5 text-xl font-black uppercase tracking-widest transform -rotate-12 opacity-90 select-none">
                      PAID
                    </div>

                    <div className="flex flex-col items-center text-center relative z-10">
                      <div className="w-28 border-b border-slate-900 mb-1 relative">
                        <span
                          className="absolute bottom-0.5 left-0 right-0 text-[18px] font-black text-slate-800/20 pointer-events-none"
                          style={{ fontFamily: "'Brush Script MT', cursive" }}
                        >
                          Ahmad
                        </span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                        Authorized Sign
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-xs text-slate-400 text-center px-4">
              No saved ledger entry found. Save the sheet first to see a receipt.
            </p>
          )}
        </DeferredBody>
      </div>

      {/* Action Buttons for active receipt print */}
      {lastSavedEntry && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              const now = new Date();
              const optionsDate: Intl.DateTimeFormatOptions = {
                month: 'long',
                day: '2-digit',
                year: 'numeric',
              };
              const formattedDate = now.toLocaleDateString('en-US', optionsDate);

              let hours = now.getHours();
              const minutes = String(now.getMinutes()).padStart(2, '0');
              const ampm = hours >= 12 ? 'pm' : 'am';
              hours = hours % 12;
              hours = hours ? hours : 12;
              const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
              const shift = now.getHours() >= 6 && now.getHours() < 18 ? 'Day' : 'Night';
              const displayTimeStr = `${formattedTime} - ${shift}`;

              const printSection = document.createElement('div');
              printSection.id = 'print-section';
              printSection.style.position = 'absolute';
              printSection.style.left = '0';
              printSection.style.top = '0';
              printSection.style.width = '100%';
              printSection.style.background = 'white';
              printSection.style.color = 'black';
              printSection.style.padding = '0';
              printSection.style.margin = '0';

              const itemsHtml = previewItemsData
                .map(({ entry: item, client, actualCount }) => {
                  const hasExtraDetails = actualCount <= 2 && client;
                  const subDetailsHtml = hasExtraDetails
                    ? `
                      <div style="display: flex; flex-direction: column; font-size: 8pt; color: #64748b; margin-top: 3px; font-weight: 500; font-family: sans-serif; text-align: left;">
                        ${client.username ? `<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">ID: <span style="font-family: monospace; font-weight: bold; color: #334155;">${client.username}</span></span>` : ''}
                        ${client.mobileNumber ? `<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Mob: <span style="font-family: monospace; font-weight: bold; color: #334155;">${client.mobileNumber}</span></span>` : ''}
                      </div>
                    `
                    : '';

                  return `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; font-size: 11pt; font-weight: normal; margin-bottom: 12px; border-bottom: 1px dashed #f1f5f9; padding-bottom: 5px; color: #334155;">
                      <div style="display: flex; flex-direction: column; text-align: left; max-width: 170px; overflow: hidden;">
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: bold;">${item?.name || '&nbsp;'}</span>
                        ${subDetailsHtml}
                      </div>
                      <span style="font-family: monospace; font-weight: bold; padding-top: 2px;">${item?.amount !== undefined && item?.amount !== null && item?.amount !== '' && !isNaN(Number(item?.amount)) ? Number(item?.amount).toFixed(2) : '&nbsp;'}</span>
                    </div>
                  `;
                })
                .join('');
              const computedTotal = itemsToPrint.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);

              printSection.innerHTML = `
                <style>
                  @media print {
                    @page {
                      size: A5 portrait;
                      margin: 0 !important;
                    }
                    html, body {
                      background: white !important;
                      color: black !important;
                      margin: 0 !important;
                      padding: 0 !important;
                      width: 148mm !important;
                      height: 210mm !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                    }
                    #root, .print\\:hidden, .fixed, .absolute, [class*="fixed"], [class*="absolute"], #root > * {
                      display: none !important;
                    }
                    #print-section {
                      display: block !important;
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 148mm !important;
                      height: 210mm !important;
                      padding: 10mm 15mm 15mm 15mm !important;
                      box-sizing: border-box !important;
                      background: white !important;
                    }
                  }
                </style>
                <div style="width: 100%; max-width: 118mm; height: 178mm; margin: 0 auto; text-align: center; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; box-sizing: border-box; background: #fff; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
                  <div>
                    <h1 style="font-size: 14pt; font-weight: 900; font-family: sans-serif; margin: 5px 0 2px 0; text-transform: uppercase; letter-spacing: 1px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; width: 100%; display: block;">${receiptConfig.title}</h1>
                    <p style="font-size: 10.5pt; margin: 0; color: #64748b; font-weight: 500; font-family: sans-serif;">${receiptConfig.address1} ${receiptConfig.address2}</p>
                    
                    <div style="background-color: #f1f5f9; border-radius: 6px; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; margin: 18px 0 20px 0;">
                      <div style="font-size: 14pt; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #1e293b; font-family: sans-serif;">ONLINE RECEIPT</div>
                      <div style="font-size: 9.5pt; font-weight: bold; color: #475569; text-align: left; line-height: 1.4; font-family: sans-serif;">
                        <div><b>Date :</b> ${formattedDate}</div>
                        <div><b>Time :</b> ${displayTimeStr}</div>
                      </div>
                    </div>

                    <div style="text-align: left; margin-bottom: 20px;">
                      <div style="display: flex; justify-content: space-between; background-color: #137347; color: white; padding: 8px 12px; font-size: 10.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; border-radius: 4px;">
                        <span>Description</span>
                        <span>Amount (PKR)</span>
                      </div>
                      <div style="padding: 0 5px; min-height: 100px;">
                        ${itemsHtml}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 0 5px;">
                      <div style="color: #10b981; border: 3px solid #10b981; border-radius: 4px; padding: 4px 10px; font-size: 22pt; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; transform: rotate(-12deg); opacity: 0.9; font-family: sans-serif; user-select: none;">
                        PAID
                      </div>
                      
                      <div style="display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: 4px;">
                        <div style="font-size: 12pt; font-weight: bold; color: #000;">
                          Total: <span style="font-family: monospace; font-size: 13pt; color: #10b981; font-weight: 900; margin-left: 5px;">= ${computedTotal.toFixed(2)}</span>
                        </div>
                        ${totalOutstanding > 0 ? `
                        <div style="font-size: 11pt; font-weight: bold; color: #000;">
                          Outstanding payment: <span style="font-family: monospace; font-size: 11.5pt; color: #ef4444; font-weight: 900; margin-left: 5px;">= ${totalOutstanding.toFixed(2)}</span>
                        </div>
                        ` : ''}
                      </div>
                    </div>

                    <div style="border-top: 2.5px solid #000; margin: 15px 0 10px 0;"></div>

                    <p style="font-size: 10.5pt; font-style: italic; font-weight: bold; margin: 0 0 5px 0; color: #64748b;">Thank You For Using Our Services.</p>
                    <p style="font-size: 14pt; font-weight: bold; margin: 0 0 20px 0; color: #475569; letter-spacing: 0.5px;">Contact # 0300 1020757</p>

                    <div style="display: flex; justify-content: space-between; align-items: flex-end; position: relative; min-height: 55px; margin-top: 15px;">
                      <div style="color: #f1f5f9; font-size: 32pt; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; transform: rotate(-12deg); position: absolute; left: 10px; bottom: 5px; opacity: 0.8; font-family: sans-serif; user-select: none; pointer-events: none;">
                        STAMP
                      </div>

                      <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-left: auto; position: relative; width: 140px;">
                        <div style="width: 100%; border-bottom: 1.5px solid #000; margin-bottom: 5px;"></div>
                        <span style="font-size: 9pt; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Authorized Sign</span>
                      </div>
                    </div>
                  </div>
                </div>
              `;
              document.body.appendChild(printSection);

              const printAndRegenerate = async () => {
                await onSaveReceiptCode(currentReceiptCode);
                window.print();

                if (rootEl) rootEl.style.display = 'block';
                document.body.removeChild(printSection);
                onRegenerateReceiptCode();
              };

              const rootEl = document.getElementById('root');
              if (rootEl) rootEl.style.display = 'none';
              printAndRegenerate();
            }}
            className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer border-none"
          >
            <Printer size={13} />
            Print Receipt
          </button>

          <button
            onClick={() => {
              try {
                const now = new Date();
                const optionsDate: Intl.DateTimeFormatOptions = {
                  month: 'long',
                  day: '2-digit',
                  year: 'numeric',
                };
                const formattedDate = now.toLocaleDateString('en-US', optionsDate);

                let hours = now.getHours();
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const ampm = hours >= 12 ? 'pm' : 'am';
                hours = hours % 12;
                hours = hours ? hours : 12;
                const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
                const shift = now.getHours() >= 6 && now.getHours() < 18 ? 'Day' : 'Night';
                const displayTimeStr = `${formattedTime} - ${shift}`;

                const doc = new jsPDF({
                  orientation: 'portrait',
                  unit: 'mm',
                  format: 'a5',
                });

                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(14);
                doc.text(receiptConfig.title, 74, 15, { align: 'center' });

                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(`${receiptConfig.address1} ${receiptConfig.address2}`, 74, 21, {
                  align: 'center',
                });

                doc.setFillColor(241, 245, 249);
                doc.roundedRect(15, 26, 118, 16, 2, 2, 'F');

                doc.setTextColor(30, 41, 59);
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(14);
                doc.text('ONLINE RECEIPT', 20, 36.5);

                doc.setFontSize(9);
                doc.setTextColor(71, 85, 105);
                doc.text(`Date : ${formattedDate}`, 130, 32, { align: 'right' });
                doc.text(`Time : ${displayTimeStr}`, 130, 37.5, { align: 'right' });

                doc.setFillColor(19, 115, 71);
                doc.roundedRect(15, 48, 118, 10, 1, 1, 'F');

                doc.setTextColor(255, 255, 255);
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(10.5);
                doc.text('Description', 18, 54.5);
                doc.text('Amount (PKR)', 130, 54.5, { align: 'right' });

                let y = 66;
                doc.setTextColor(51, 65, 85);
                previewItemsData.forEach(({ entry: item, client, actualCount }) => {
                  const hasExtraDetails = actualCount <= 2 && client;

                  doc.setFont('Helvetica', 'bold');
                  doc.setFontSize(11);
                  doc.text(item?.name || '', 18, y);
                  doc.setFont('Courier', 'bold');
                  const amtText =
                    item?.amount !== undefined &&
                    item?.amount !== null &&
                    item?.amount !== '' &&
                    !isNaN(Number(item?.amount))
                      ? Number(item?.amount).toFixed(2)
                      : '';
                  doc.text(amtText, 130, y, { align: 'right' });

                  if (hasExtraDetails) {
                    y += 4.5;
                    doc.setFont('Helvetica', 'normal');
                    doc.setFontSize(8.5);
                    doc.setTextColor(100, 116, 139);
                    let extraLine = '';
                    if (client.username) extraLine += `ID: ${client.username}`;
                    if (client.mobileNumber) {
                      if (extraLine) extraLine += '   |   ';
                      extraLine += `Mob: ${client.mobileNumber}`;
                    }
                    doc.text(extraLine, 18, y);
                    doc.setTextColor(51, 65, 85);
                  }

                  y += 4;
                  doc.setDrawColor(241, 245, 249);
                  doc.setLineWidth(0.3);
                  doc.line(15, y, 133, y);
                  y += 6;
                });

                y = 115;

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

                doc.setTextColor(0, 0, 0);
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(12);
                doc.text('Total:', 85, y + 4);

                doc.setFont('Courier', 'bold');
                doc.setFontSize(13);
                doc.setTextColor(16, 185, 129);
                const computedTotal = itemsToPrint.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                doc.text(`= ${computedTotal.toFixed(2)}`, 130, y + 4, { align: 'right' });

                if (totalOutstanding > 0) {
                  doc.setTextColor(0, 0, 0);
                  doc.setFont('Helvetica', 'bold');
                  doc.setFontSize(11);
                  doc.text('Outstanding payment:', 72, y + 10);
                  doc.setFont('Courier', 'bold');
                  doc.setFontSize(11.5);
                  doc.setTextColor(239, 68, 68);
                  doc.text(`= ${totalOutstanding.toFixed(2)}`, 130, y + 10, { align: 'right' });
                }

                doc.setLineWidth(0.8);
                doc.setDrawColor(0, 0, 0);
                doc.line(15, y + 18, 133, y + 18);

                doc.setFont('Helvetica', 'italic');
                doc.setFontSize(10.5);
                doc.setTextColor(100, 116, 139);
                doc.text('Thank You For Using Our Services.', 74, y + 25, { align: 'center' });

                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(14);
                doc.setTextColor(71, 85, 105);
                doc.text('Contact # 0300 1020757', 74, y + 32, { align: 'center' });

                doc.setTextColor(241, 245, 249);
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(32);
                doc.saveGraphicsState();
                doc.setCurrentTransformationMatrix(doc.Matrix(0.9781, -0.2079, 0.2079, 0.9781, 22, y + 45));
                doc.text('STAMP', 0, 0);
                doc.restoreGraphicsState();

                doc.setLineWidth(0.4);
                doc.setDrawColor(0, 0, 0);
                doc.line(90, y + 46, 130, y + 46);

                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(100, 116, 139);
                doc.text('Authorized Sign', 110, y + 51, { align: 'center' });

                const saveAndRegen = async () => {
                  await onSaveReceiptCode(currentReceiptCode);
                  doc.save('Receipt.pdf');
                  toast.success('Receipt PDF saved!');
                  onRegenerateReceiptCode();
                };
                saveAndRegen();
              } catch (err) {
                console.error(err);
                toast.error('Could not save PDF');
              }
            }}
            className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer border-none"
          >
            <Download size={13} />
            Save PDF
          </button>

          <button
            onClick={onClose}
            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </motion.div>
  );
});
ReceiptPreviewPanel.displayName = 'ReceiptPreviewPanel';

export default ReceiptPreviewPanel;
