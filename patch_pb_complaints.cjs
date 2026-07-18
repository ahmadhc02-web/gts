const fs = require('fs');
let content = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

const complaintsCode = `
  saveComplaint: async (complaint: any, tenantId: string = 'main') => {
    try {
      const filter = \`complaint_id = "\${complaint.id}" && tenant_id = "\${tenantId}"\`;
      const existing = await pb.collection('complaints').getList(1, 1, { filter });
      const payload = {
        complaint_id: complaint.id,
        member_id: complaint.memberId,
        member_name: complaint.memberName,
        customer_name: complaint.customerName,
        customer_username: complaint.customerUsername,
        area: complaint.area,
        description: complaint.description,
        number: complaint.number,
        status: complaint.status,
        category: complaint.category,
        priority: complaint.priority,
        pkg_details: complaint.pkgDetails || '',
        user_nearby: complaint.userNearby || '',
        panel_details: complaint.panelDetails || '',
        created_at: complaint.createdAt,
        updated_at: complaint.updatedAt || '',
        remarks: complaint.remarks || '',
        remark_author_id: complaint.remarkAuthorId || '',
        remark_author_name: complaint.remarkAuthorName || '',
        reviews: complaint.reviews ? JSON.stringify(complaint.reviews) : '',
        dealer_id: complaint.dealerId || '',
        scheduled_at: complaint.scheduledAt || '',
        tenant_id: tenantId
      };
      if (existing.items.length > 0) {
        await pb.collection('complaints').update(existing.items[0].id, payload);
      } else {
        await pb.collection('complaints').create(payload);
      }
    } catch(e) { console.error("PB: Failed to save complaint", e); }
  },
  deleteComplaint: async (complaintId: string, tenantId: string = 'main') => {
    try {
      const filter = \`complaint_id = "\${complaintId}" && tenant_id = "\${tenantId}"\`;
      const existing = await pb.collection('complaints').getList(1, 1, { filter });
      if (existing.items.length > 0) {
        await pb.collection('complaints').delete(existing.items[0].id);
      }
    } catch(e) { console.error("PB: Failed to delete complaint", e); }
  },`;

if (!content.includes('saveComplaint: async')) {
  content = content.replace(/}\\s*,\\s*getLedgerFolders:/g, '},' + complaintsCode + '\n  getLedgerFolders:');
  
  if (!content.includes('saveComplaint: async')) {
     content = content.replace('getLedgerFolders: async', complaintsCode.trim() + '\n  getLedgerFolders: async');
  }

  fs.writeFileSync('src/lib/pocketbaseService.ts', content);
  console.log('Added complaints sync to Pocketbase');
} else {
  console.log('Complaints sync already in Pocketbase');
}
