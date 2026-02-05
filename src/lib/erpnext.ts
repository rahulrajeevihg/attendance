const ERPNEXT_URL = 'https://erp.ihgind.com';
const TOKEN = 'token e9d536fe3a27e08:af972b4f3a436ed';

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
        // ERPNext expects Datetime in 'YYYY-MM-DD HH:mm:ss' format
        // Only format if it's an ISO string (contains 'T'), otherwise it's already formatted
        const formattedData = {
            ...data,
            checkin_time: data.checkin_time.includes('T')
                ? data.checkin_time.replace('T', ' ').split('.')[0]
                : data.checkin_time
        };

        console.log("POSTING to ERPNext:", formattedData);

        const response = await fetch(`${ERPNEXT_URL}/api/resource/Mobile Checkin`, {
            method: 'POST',
            headers: {
                'Authorization': TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(formattedData),
        });

        if (!response.ok) {
            let errorMsg = 'Failed to post check-in to ERPNext';
            try {
                const error = await response.json();
                console.error("ERPNext Error Response:", error);

                if (error._server_messages) {
                    const messages = JSON.parse(error._server_messages);
                    // Join all messages into one string
                    errorMsg = messages.map((m: any) => JSON.parse(m).message).join(' | ');
                } else if (error.exception) {
                    errorMsg = `Server Exception: ${error.exception}`;
                } else if (error.message) {
                    errorMsg = error.message;
                }
            } catch (e) {
                const text = await response.text();
                console.error("ERPNext raw error:", text);
                errorMsg = `Server Error (${response.status}): ${text.substring(0, 100)}`;
            }
            throw new Error(errorMsg);
        }

        return await response.json();
    },

    async getPendingCheckins(hodId?: string) {
        let filters: any[] = [["status", "=", "Pending"]];
        if (hodId) {
            filters.push(["hod", "=", hodId]);
            filters.push(["employee", "!=", hodId]); // Prevent self-approval
        }

        const url = `${ERPNEXT_URL}/api/resource/Mobile Checkin?fields=["*"]&filters=${JSON.stringify(filters)}`;

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

    async getMyCheckins(employeeId: string) {
        const filters = [["employee", "=", employeeId]];
        const url = `${ERPNEXT_URL}/api/resource/Mobile Checkin?fields=["*"]&filters=${JSON.stringify(filters)}&order_by=checkin_time desc`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch your check-ins');
        }

        const data = await response.json();
        return data.data;
    },

    async getTeamCheckins(hodId: string) {
        const filters = [
            ["hod", "=", hodId],
            ["employee", "!=", hodId]
        ];
        const url = `${ERPNEXT_URL}/api/resource/Mobile Checkin?fields=["*"]&filters=${JSON.stringify(filters)}&order_by=checkin_time desc`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch team check-ins');
        }

        const data = await response.json();
        return data.data;
    },

    async getOfficialCheckins(employeeId: string, fromDate: string, toDate: string) {
        const filters = [
            ["employee", "=", employeeId],
            ["time", ">=", fromDate],
            ["time", "<=", toDate]
        ];
        const url = `${ERPNEXT_URL}/api/resource/Employee Checkin?fields=["*"]&filters=${JSON.stringify(filters)}&order_by=time asc`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch official attendance');
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

    async deleteCheckin(name: string) {
        const response = await fetch(`${ERPNEXT_URL}/api/resource/Mobile Checkin/${name}`, {
            method: 'DELETE',
            headers: {
                'Authorization': TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to delete check-in log');
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
        const url = `${ERPNEXT_URL}/api/resource/Employee?fields=["name","employee_name","reports_to","image"]&filters=[["user_id", "=", "${email}"]]`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': TOKEN },
        });

        if (!response.ok) {
            let errorMsg = 'Failed to fetch Employee data';
            try {
                const error = await response.json();
                console.error("ERPNext Employee Fetch Error:", error);

                if (error._server_messages) {
                    const messages = JSON.parse(error._server_messages);
                    errorMsg = messages.map((m: any) => JSON.parse(m).message).join(' | ');
                } else if (error.exception) {
                    errorMsg = `Server Exception: ${error.exception}`;
                } else if (error._error_message) {
                    errorMsg = error._error_message;
                }
            } catch (e) {
                const text = await response.text();
                errorMsg = `Server Error (${response.status}): ${text}`;
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log("ERPNext Employee Data:", data);
        return data.data?.[0] || null;
    },

    async getEmployeeImages(employeeIds: string[]) {
        if (employeeIds.length === 0) return {};
        const filters = JSON.stringify([["name", "in", employeeIds]]);
        const url = `${ERPNEXT_URL}/api/resource/Employee?fields=["name","image"]&filters=${filters}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': TOKEN },
        });
        const data = await response.json();
        const imageMap: Record<string, string> = {};
        data.data?.forEach((e: any) => {
            if (e.image) imageMap[e.name] = `${ERPNEXT_URL}${e.image}`;
        });
        return imageMap;
    },

    async isManager(employeeId: string) {
        const url = `${ERPNEXT_URL}/api/resource/Employee?filters=[["reports_to", "=", "${employeeId}"]]&limit=1`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': TOKEN },
        });
        const data = await response.json();
        return data.data && data.data.length > 0;
    }
};
