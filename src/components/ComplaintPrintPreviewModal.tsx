import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { 
  X, Printer, Calendar, MapPin, Phone, User, Package, Layers, CheckCircle2, ShieldAlert, Clock
} from 'lucide-react';
import { Complaint, UserProfile, BrandingConfig } from '../types';
import { cn } from '../lib/utils';

interface ComplaintPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaint: Complaint;
  currentUser: UserProfile;
  branding: BrandingConfig;
}

export default function ComplaintPrintPreviewModal({
  isOpen,
  onClose,
  complaint,
  currentUser,
  branding
}: ComplaintPrintPreviewModalProps) {
  if (!isOpen) return null;

  const customNames = branding.customNames || {};

  const handlePrint = () => {
    // We add a class to the body to help the CSS hide background elements during print
    document.body.classList.add('printing-single-complaint-active');
    window.print();
    // After printing/canceling, remove the class
    setTimeout(() => {
      document.body.classList.remove('printing-single-complaint-active');
    }, 1000);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'complete':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'in process':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'scheduled':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'text-red-700 font-extrabold';
      case 'high':
        return 'text-rose-600 font-bold';
      case 'medium':
        return 'text-amber-600 font-medium';
      default:
        return 'text-emerald-600 font-normal';
    }
  };

  return createPortal(
    <>
      {/* Print-specific style sheet override */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Setup single complaint page print rules */
          body.printing-single-complaint-active {
            background: white !important;
            color: black !important;
          }

          /* Hide all UI layout elements when printing single complaint */
          body.printing-single-complaint-active header,
          body.printing-single-complaint-active aside,
          body.printing-single-complaint-active footer,
          body.printing-single-complaint-active nav,
          body.printing-single-complaint-active .fixed:not(#a4-single-complaint-modal-wrapper),
          body.printing-single-complaint-active .toast,
          body.printing-single-complaint-active .sonner,
          body.printing-single-complaint-active button,
          body.printing-single-complaint-active #sidebar-toggle-btn,
          body.printing-single-complaint-active #rail-menu-btn,
          body.printing-single-complaint-active .print-single-hide {
            display: none !important;
          }

          /* Ensure wrapper matches absolute print page layout */
          body.printing-single-complaint-active #a4-single-complaint-modal-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            background: white !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            overflow: visible !important;
            z-index: 9999999 !important;
          }

          body.printing-single-complaint-active #a4-single-complaint-scroll-container {
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
          }

          body.printing-single-complaint-active #a4-single-complaint-paper {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 15mm 15mm 15mm 15mm !important;
            width: 210mm !important;
            height: 297mm !important;
            box-sizing: border-box !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
          }
        }
      ` }} />

      {/* Main Overlay Backdrop */}
      <div 
        id="a4-single-complaint-modal-wrapper"
        className="fixed inset-0 z-[600] flex items-stretch justify-end overflow-hidden bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm print:bg-transparent print:backdrop-blur-none print:static"
      >
        {/* Dynamic Controls Drawer (Hidden in print) */}
        <div 
          id="a4-single-complaint-controls"
          className="print-single-hide w-full md:w-[380px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shadow-2xl relative z-[610]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-150 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Printer size={18} />
              </div>
              <div>
                <h4 className="text-[13px] font-black uppercase tracking-wider text-slate-900 dark:text-white font-display">Print Dispatch Receipt</h4>
                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">A4 Portrait Standard Layout</p>
              </div>
            </div>
            
            <button
              id="close-preview-drawer-btn"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer active:scale-95 transition-colors border border-transparent"
            >
              <X size={18} />
            </button>
          </div>

          {/* Guidelines / Help Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar text-xs">
            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/60 p-4 rounded-2xl space-y-2 text-slate-600 dark:text-slate-400">
              <p className="font-extrabold uppercase text-[10px] text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500" />
                A4-Compliant Format
              </p>
              <p className="leading-relaxed">
                This preview renders a standard A4 portrait sheet formatted to serve as an official service card, fault dispatch record, or physical client receipt.
              </p>
              <ul className="list-disc pl-4 space-y-1 mt-2 text-[11px] font-medium">
                <li>Margins are pre-calculated for exact physical alignment.</li>
                <li>Hides unnecessary digital controls during print.</li>
                <li>Displays customer metadata, logs, and signature fields.</li>
              </ul>
            </div>

            <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Document Registry</span>
              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Ticket ID:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{complaint.id.substring(0, 10)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Issued On:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{new Date(complaint.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Zone / Sector:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{complaint.area}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Priority:</span>
                  <span className={cn("font-bold uppercase", getPriorityStyle(complaint.priority))}>{complaint.priority}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Printable Actions Button */}
          <div className="p-5 border-t border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col gap-3">
            <button
              id="trigger-physical-print-btn"
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[11px] cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20 border-none"
            >
              <Printer size={14} />
              Print Physical Receipt
            </button>
            <p className="text-[8.5px] text-center text-slate-400 uppercase tracking-widest font-mono font-bold">
              Sends to physical printer or saves as A4 PDF
            </p>
          </div>
        </div>

        {/* Live A4 Scrollable Preview Canvas on the right */}
        <div 
          id="a4-single-complaint-scroll-container"
          className="flex-1 bg-slate-100 dark:bg-slate-950 p-8 overflow-y-auto print:p-0 print:bg-white custom-scrollbar flex flex-col items-center gap-6"
        >
          {/* Canvas Indicator (Hidden in print) */}
          <div className="print-single-hide w-full max-w-[210mm] text-center border-b border-dashed border-slate-200 dark:border-slate-850 pb-2.5 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Live A4 portrait preview simulation
            </span>
            <span className="text-[11px] font-black text-indigo-500 bg-indigo-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              A4 portrait standard
            </span>
          </div>

          {/* Printable Paper Canvas (Matches A4 standard dimensions on screen) */}
          <div 
            id="a4-single-complaint-paper"
            className="w-[210mm] min-h-[297mm] bg-white text-slate-900 border border-slate-250 rounded-md shadow-2xl p-12 flex flex-col justify-between font-sans relative text-left select-text print:border-none print:shadow-none print:rounded-none print:p-0"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Top Section */}
            <div className="space-y-6">
              
              {/* Header Box */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-xl font-extrabold uppercase tracking-wide text-slate-950">
                    {branding.projectName || "Green Tech Services"}
                  </h1>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mt-0.5">
                    Operational Fault & Dispatch Management System
                  </p>
                  <p className="text-[9px] font-semibold text-slate-400 mt-1">
                    GTS Cloud Registry Automated Spool Output
                  </p>
                </div>
                
                <div className="text-right space-y-1">
                  <div className="inline-block px-3 py-1 border border-slate-950 font-mono text-[10px] font-bold uppercase tracking-wider bg-slate-50">
                    ID: {complaint.id.substring(0, 10).toUpperCase()}
                  </div>
                  <p className="text-[9px] font-mono text-slate-500 font-bold uppercase">
                    Issued: {new Date(complaint.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Title Header */}
              <div className="text-center py-2 bg-slate-100 border border-slate-250">
                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-950">
                  Official Service Dispatch & Fault Receipt
                </h2>
              </div>

              {/* Grid 1: Customer Identification */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                  I. Customer & Line Identification
                </h3>
                
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 font-bold text-slate-500 uppercase w-1/4">Client Name:</td>
                      <td className="py-2 text-slate-900 font-extrabold uppercase">{complaint.customerName}</td>
                      <td className="py-2 font-bold text-slate-500 uppercase w-1/4">Access ID:</td>
                      <td className="py-2 text-slate-900 font-mono font-bold uppercase">{complaint.customerUsername || "N/A"}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 font-bold text-slate-500 uppercase">Contact Number:</td>
                      <td className="py-2 font-mono text-slate-900 font-bold">{complaint.number}</td>
                      <td className="py-2 font-bold text-slate-500 uppercase">{customNames.zone || "Sector"}:</td>
                      <td className="py-2 text-slate-900 font-bold uppercase">{complaint.area}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 font-bold text-slate-500 uppercase">{customNames.pkg || "Profile"}:</td>
                      <td className="py-2 text-slate-900 font-bold uppercase">{complaint.pkgDetails || "N/A"}</td>
                      <td className="py-2 font-bold text-slate-500 uppercase">{customNames.nearby || "Nearby"}:</td>
                      <td className="py-2 text-slate-900 font-bold uppercase">{complaint.userNearby || "N/A"}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-slate-500 uppercase">{customNames.panel || "Panel"}:</td>
                      <td className="py-2 text-slate-900 font-bold uppercase" colSpan={3}>{complaint.panelDetails || "N/A"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Grid 2: Fault Details */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                  II. Operational Fault Log & Details
                </h3>

                <div className="grid grid-cols-2 gap-4 text-xs font-bold py-1.5 px-3 bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest">Fault Category: </span>
                    <span className="uppercase text-slate-900">{complaint.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest">Ticket Priority: </span>
                    <span className={cn("uppercase", getPriorityStyle(complaint.priority))}>{complaint.priority}</span>
                  </div>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded min-h-[80px]">
                  <p className="text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {complaint.description}
                  </p>
                </div>
              </div>

              {/* Grid 3: Resolution Protocol */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                  III. Technical Resolution Protocol
                </h3>
                
                {complaint.remarks ? (
                  <div className="p-4 bg-slate-50 border border-slate-250 rounded space-y-2">
                    <div className="flex justify-between items-center text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                      <span>✓ VERIFIED SERVICE RESOLUTION</span>
                      {complaint.remarkAuthorName && (
                        <span>DELEGATE: {complaint.remarkAuthorName.toUpperCase()}</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-850 leading-relaxed italic">
                      "{complaint.remarks}"
                    </p>
                  </div>
                ) : (
                  <div className="p-4 border border-dashed border-amber-300 bg-amber-50/40 rounded flex items-center gap-3">
                    <ShieldAlert size={16} className="text-amber-500 shrink-0" />
                    <div className="text-xs text-amber-800 font-bold uppercase tracking-wider">
                      ⚠️ RESOLUTION PROTOCOL OUTSTANDING / PENDING DEPLOYMENT
                    </div>
                  </div>
                )}
              </div>

              {/* Grid 4: Customer Feedback Reviews */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                  IV. Client Reviews & Satisfaction Telemetry
                </h3>

                {complaint.reviews && complaint.reviews.length > 0 ? (
                  <div className="space-y-2">
                    {complaint.reviews.map((rev, index) => (
                      <div key={rev.id} className="text-xs p-3 bg-white border border-slate-150 rounded space-y-1">
                        <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                          <span>Feedback Log #{index + 1}</span>
                          <span>{rev.authorName ? `Logged By: ${rev.authorName}` : ""} // {new Date(rev.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-800 font-medium leading-relaxed uppercase">
                          {rev.text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 border border-slate-200 text-center text-xs text-slate-400 font-medium italic">
                    No chronic satisfaction feedback reports logged for this ticket yet.
                  </div>
                )}
              </div>

            </div>

            {/* Bottom Signature / Footer Block */}
            <div className="space-y-8 pt-6 border-t border-slate-300">
              {/* Signatures */}
              <div className="grid grid-cols-2 gap-16 text-xs text-center font-bold">
                <div className="space-y-12">
                  <div className="border-b border-slate-400 h-6"></div>
                  <p className="uppercase text-[9px] text-slate-500 tracking-wider">
                    Authorized GTS Officer Signature / Stamp
                  </p>
                </div>
                <div className="space-y-12">
                  <div className="border-b border-slate-400 h-6"></div>
                  <p className="uppercase text-[9px] text-slate-500 tracking-wider">
                    Client Satisfaction Confirmation Signature
                  </p>
                </div>
              </div>

              {/* Footer text */}
              <div className="text-center text-[9.5px] font-bold text-slate-400 uppercase tracking-widest space-y-0.5">
                <p>Green Tech Services Sadiqabad Operational Registry System</p>
                <p className="text-[8px] font-medium text-slate-400 font-mono lowercase">
                  automated secure report printed on behalf of {currentUser.fullName || currentUser.username} // www.gtspak.net
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </>,
    document.body
  );
}
