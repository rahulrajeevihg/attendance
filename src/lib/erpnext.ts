const ERPNEXT_URL = 'https://erp.ihgind.com';
const API_KEY = 'e9d536fe3a27e08';
const API_SECRET = '80ca732d095ceb7';

export interface MobileCheckinData {
    employee: string;
    log_type: 'IN' | 'OUT';
    checkin_time: string; // ISO format
    latitude: number;
    longitude: number;
    landmark?: string;
    status?: 'Pending' | 'Approved' | 'Rejected';
    hod?: string;
}

export const erpnext = {
    async postCheckin(data: MobileCheckinData) {
        const response = await fetch(`${ERPNEXT_URL}/api/resource/Mobile Checkin`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${API_KEY}:${API_SECRET}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error._server_messages || 'Failed to post check-in to ERPNext');
        }

        return await response.json();
    },

    async getPendingCheckins(hodId?: string) {
        let url = `${ERPNEXT_URL}/api/resource/Mobile Checkin?fields=["*"]&filters=[["status", "=", "Pending"]]`;
        if (hodId) {
            url += `&filters=[["hod", "=", "${hodId}"]]`; // Simple filter logic
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `token ${API_KEY}:${API_SECRET}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch pending check-ins');
        }

        const data = await response.json();
        return data.data;
    },

    async updateStatus(name: string, status: 'Approved' | 'Rejected', remarks?: string) {
        const response = await fetch(`${ERPNEXT_URL}/api/resource/Mobile Checkin/${name}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${API_KEY}:${API_SECRET}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                status,
                approver_remarks: remarks,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to ${status} check-in`);
        }

        return await response.json();
    }
};
