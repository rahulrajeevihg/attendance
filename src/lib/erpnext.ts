const ERPNEXT_URL = 'https://erp.ihgind.com';
const TOKEN = 'token 5a58f74d3a6048c:b76e8329ac883ff';

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
                'Authorization': TOKEN,
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
                'Authorization': TOKEN,
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
                'Authorization': TOKEN,
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
    },

    async login(usr: string, pwd: string) {
        const response = await fetch(`${ERPNEXT_URL}/api/method/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usr, pwd }),
        });
        if (!response.ok) throw new Error('Invalid credentials');
        return await response.json();
    },

    async getEmployee(email: string) {
        const url = `${ERPNEXT_URL}/api/resource/Employee?fields=["name","employee_name","reports_to"]&filters=[["user_id", "=", "${email}"]]`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': TOKEN },
        });
        const data = await response.json();
        return data.data?.[0] || null;
    }
};
