
export interface WhatsAppNotification {
  type: 'registered' | 'completed';
  customerName: string;
  complaintId: string;
  category: string;
  phoneNumber: string;
  description?: string;
}

export const generateWhatsAppMessage = (data: WhatsAppNotification): string => {
  const { type, customerName, complaintId, category, description } = data;
  
  if (type === 'registered') {
    return `*ISP SERVICE UPDATE: COMPLAINT REGISTERED* ✅\n\n` +
           `Dear *${customerName}*,\n\n` +
           `Your service request has been successfully registered in our operational relay.\n\n` +
           `🎫 *Complaint ID:* ${complaintId}\n` +
           `📂 *Category:* ${category}\n` +
           `${description ? `📝 *Description:* ${description}\n` : ''}` +
           `🕒 *Status:* PENDING_DISPATCH\n\n` +
           `Our field technician will be assigned to your zone shortly. Thank you for your patience.\n\n` +
           `_GTS Network Operations Control_`;
  } else {
    return `*ISP SERVICE UPDATE: COMPLAINT RESOLVED* 🎉\n\n` +
           `Dear *${customerName}*,\n\n` +
           `We are pleased to inform you that your complaint (ID: *${complaintId}*) has been marked as *COMPLETE*.\n\n` +
           `Your service should now be fully restored. Please verify the connection. If you're still facing issues, contact our support line immediately.\n\n` +
           `✨ *Thank you for choosing our fiber service!*\n\n` +
           `_GTS Network Operations Control_`;
  }
};

export const sendWhatsAppNotification = (data: WhatsAppNotification) => {
  const message = generateWhatsAppMessage(data);
  // Remove non-numeric characters from phone number
  const cleanPhone = data.phoneNumber.replace(/\D/g, '');
  // If no country code, assume Pakistan (+92)
  const finalPhone = cleanPhone.length === 11 ? `92${cleanPhone.substring(1)}` : cleanPhone;
  
  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${finalPhone}?text=${encodedMessage}`;
  
  window.open(url, '_blank');
};

export const sendWhatsAppViaServer = async (data: WhatsAppNotification): Promise<{ success: boolean, error?: string }> => {
  const message = generateWhatsAppMessage(data);
  try {
    const response = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: data.phoneNumber,
        text: message
      })
    });
    
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to send message via server');
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Server WhatsApp Error:', error);
    return { success: false, error: error.message };
  }
};
