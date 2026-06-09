// src/services/gmailService.ts
import { googleSheetsService } from './googleSheetsService';

const getApiUrl = (endpoint: string): string => {
  const host = window.location.hostname;
  if (
    host === 'localhost' || 
    host === '127.0.0.1' || 
    host.includes('.run.app')
  ) {
    return endpoint;
  }
  return `https://ais-pre-y57fbgpyjpmaocrhgtopol-853220806804.asia-southeast1.run.app${endpoint}`;
};

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  to: string;
  from: string;
  date: string;
  snippet: string;
}

export const gmailService = {
  getMessages: async (): Promise<GmailMessage[]> => {
    const tokens = googleSheetsService.getTokens();
    if (!tokens) {
      throw new Error("Google account is not connected. Connect your account first in the Admin Panel.");
    }

    try {
      const tokensParam = encodeURIComponent(JSON.stringify(tokens));
      const response = await fetch(getApiUrl(`/api/gmail/messages?tokens=${tokensParam}`), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        let errMessage = "Failed to load Gmail messages";
        try {
          const errBody = await response.json();
          errMessage = errBody.error || errMessage;
        } catch (e) {}
        throw new Error(errMessage);
      }

      const result = await response.json();
      googleSheetsService.processResponseJson(result);
      return result.messages || [];
    } catch (error) {
      console.error("gmailService.getMessages Error:", error);
      throw error;
    }
  },

  sendEmail: async (to: string, subject: string, body: string): Promise<any> => {
    const tokens = googleSheetsService.getTokens();
    if (!tokens) {
      throw new Error("Google account is not connected. Connect your account first in the Admin Panel.");
    }

    try {
      const response = await fetch(getApiUrl('/api/gmail/send'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tokens,
          to,
          subject,
          body
        })
      });

      if (!response.ok) {
        let errMessage = "Failed to send email";
        try {
          const errBody = await response.json();
          errMessage = errBody.error || errMessage;
        } catch (e) {}
        throw new Error(errMessage);
      }

      const result = await response.json();
      googleSheetsService.processResponseJson(result);
      return result;
    } catch (error) {
      console.error("gmailService.sendEmail Error:", error);
      throw error;
    }
  },

  getTemplates: (companyName: string = "Green Tech Services"): { name: string; subject: string; body: (data: any) => string }[] => {
    return [
      {
        name: "Complaint Registered Receipt",
        subject: `[GTS-ISP] Complaint Registered Successfully - Ref: #`,
        body: (data: any) => `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="background-color: #10b981; padding: 15px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 20px; letter-spacing: 0.05em;">COMPLAINT REGISTRY LOGGED</h1>
            </div>
            
            <div style="padding: 20px; color: #1e293b; line-height: 1.6;">
              <p>Dear <strong>${data.customerName || "Valued Client"}</strong>,</p>
              <p>Your technical complaint has been successfully registered with our GTS-ISP core diagnostics grid. Our technicians are already reviewing telemetry indicators for your connection.</p>
              
              <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #64748b;">Complaint Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <tr>
                    <td style="padding: 4px 0; color: #64748b; font-weight: bold; width: 35%;">Complaint Reference ID:</td>
                    <td style="padding: 4px 0; color: #0f172a; font-weight: bold;">#${data.id || "N/A"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #64748b; font-weight: bold;">Category / Issue:</td>
                    <td style="padding: 4px 0; color: #0f172a;">${data.category || "N/A"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #64748b; font-weight: bold;">Area / Zone:</td>
                    <td style="padding: 4px 0; color: #0f172a;">${data.area || "N/A"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #64748b; font-weight: bold;">Reporter Priority:</td>
                    <td style="padding: 4px 0; color: #f43f5e; font-weight: bold;">${data.priority || "Medium"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #64748b; font-weight: bold;">Description:</td>
                    <td style="padding: 4px 0; color: #0f172a; font-style: italic;">"${data.description || "No description provided."}"</td>
                  </tr>
                </table>
              </div>

              <p>You can track updates to this registry in your customer dashboard or contact us directly at our hotline referencing this Complaint ID.</p>
              <p>GTS team is active 24/7 to resolve network anomalies.</p>
            </div>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <div style="text-align: center; color: #94a3b8; font-size: 11px;">
              ${companyName} Support Registry Services &bull; Active ISP Diagnostics<br />
              This email is automatically synchronized and sent via our authenticated secure Gmail Gateway on behalf of GTS.
            </div>
          </div>
        `
      },
      {
        name: "Telemetry Diagnostic Statement",
        subject: `[GTS-ISP] Telemetry Diagnostics & Fiber Link Test - Ref: #`,
        body: (data: any) => `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="background-color: #3b82f6; padding: 15px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 18px; letter-spacing: 0.05em; text-transform: uppercase;">Fiber Link Telemetry Diagnostics</h1>
            </div>
            
            <div style="padding: 20px; color: #1e293b; line-height: 1.6;">
              <p>Hello <strong>${data.customerName || "Valued Client"}</strong>,</p>
              <p>Our Network Operations Center (NOC) has performed active telemetry tests and optical link checks on your server loop under complaint ticket <strong>#${data.id || "N/A"}</strong>. Below is the active diagnostics trace summary:</p>
              
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; margin: 20px 0; border-radius: 8px;">
                <h3 style="margin: 0 0 10px 0; font-size: 13px; color: #166534; text-transform: uppercase;">Diagnostic Trace Metric</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; font-family: monospace;">
                  <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 6px 0; color: #475569; font-weight: bold;">TEST INSTANCE:</td>
                    <td style="padding: 6px 0; color: #0f172a; text-align: right;">ACTIVE_FIBER_PING</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 6px 0; color: #475569; font-weight: bold;">INTERFACE SPEED:</td>
                    <td style="padding: 6px 0; color: #0f172a; text-align: right;">GTS_CORE_GPON_LINK</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 6px 0; color: #475569; font-weight: bold;">LATENCY REF:</td>
                    <td style="padding: 6px 0; color: #16a34a; font-weight: bold; text-align: right;">${data.latency || "14.2ms (EXCELLENT)"}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 6px 0; color: #475569; font-weight: bold;">SIGNAL POWER (Rx):</td>
                    <td style="padding: 6px 0; color: #16a34a; font-weight: bold; text-align: right;">-21.45 dBm (STEADY)</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #475569; font-weight: bold;">LINK INTEGRITY:</td>
                    <td style="padding: 6px 0; color: #10b981; font-weight: bold; text-align: right;">99.8% LOSSLESS</td>
                  </tr>
                </table>
              </div>

              <p><strong>NOC Action Statement:</strong> Optical fiber light signals indicate excellent physical level line budget. Router buffer resets or localized device reboots are recommended to optimize performance. Our team remains on alert to dispatch site tech teams if needed.</p>
            </div>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <div style="text-align: center; color: #94a3b8; font-size: 11px;">
              ${companyName} NOC Diagnostics &bull; Automated Telemetry Core<br />
              Gmail API Service Dispatch Gateway
            </div>
          </div>
        `
      },
      {
        name: "Anomalies Resolution Statement",
        subject: `[GTS-ISP] Ticket Status Resolved - Ref: #`,
        body: (data: any) => `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="background-color: #10b981; padding: 15px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 20px; letter-spacing: 0.05em; text-transform: uppercase;">ANOMALY RESOLVED & CLOSED</h1>
            </div>
            
            <div style="padding: 20px; color: #1e293b; line-height: 1.6;">
              <p>Dear <strong>${data.customerName || "Valued Client"}</strong>,</p>
              <p>We are pleased to inform you that your registered network complaint reference <strong>#${data.id || "N/A"}</strong> has been marked as <strong>RESOLVED</strong> by our line tech specialists.</p>
              
              <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #64748b;">Closure Log Summary</h3>
                <p style="font-size: 13px; color: #334155; margin: 0;">
                  "Splice repairs and signal balancing have successfully restored optimal levels on your physical GPON loop. Diagnostic ping checks indicate flawless network latency indices."
                </p>
              </div>

              <p>Please test your local WiFi connection. If you experience further issues, do not hesitate to contact our customer helpline immediately.</p>
              <p>Thank you for choosing GTS ISP as your premium fiber partner.</p>
            </div>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <div style="text-align: center; color: #94a3b8; font-size: 11px;">
              ${companyName} Support and Customer Success Team &bull; ISP Management Portal
            </div>
          </div>
        `
      }
    ];
  }
};
