const ERP_PROXY_URL = "/api/erp";

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

export interface AttendanceRecord {
    name?: string;
    status?: string;
    attendance_date?: string;
    employee?: string;
    docstatus?: number;
    [key: string]: string | number | null | undefined;
}

export interface OvertimeAllocationRecord {
    [key: string]: string | number | null | undefined;
}

export interface SalarySlipRecord {
    name: string;
    employee?: string;
    employee_name?: string;
    start_date?: string;
    end_date?: string;
    posting_date?: string;
    currency?: string;
    gross_pay?: number | string | null;
    net_pay?: number | string | null;
    rounded_total?: number | string | null;
    status?: string;
    docstatus?: number;
}

export interface SalarySlipComponent {
    salary_component?: string;
    amount?: number | string | null;
    default_amount?: number | string | null;
    additional_amount?: number | string | null;
    base?: number | string | null;
    rate?: number | string | null;
    stat_amount?: number | string | null;
    parentfield?: string;
    idx?: number;
}

export interface SalarySlipDetail extends SalarySlipRecord {
    earnings?: SalarySlipComponent[];
    deductions?: SalarySlipComponent[];
}

const buildHeaders = (): HeadersInit => {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
};

const parseErrorMessage = async (response: Response, fallbackMessage: string) => {
    try {
        const error = await response.json();

        if (error?._server_messages) {
            const messages = JSON.parse(error._server_messages);
            return messages.map((m: any) => JSON.parse(m).message).join(' | ');
        }

        if (error?.message) return error.message;
        if (error?._error_message) return error._error_message;
        if (error?.exception) return String(error.exception);

        return `${fallbackMessage} (${response.status})`;
    } catch {
        const text = await response.text();
        return text ? `${fallbackMessage} (${response.status}): ${text.slice(0, 200)}` : `${fallbackMessage} (${response.status})`;
    }
};

const erpFetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
        credentials: 'include',
        ...options,
        headers: {
            ...buildHeaders(),
            ...(options.headers || {}),
        },
    });
};

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

        const response = await erpFetch(`${ERP_PROXY_URL}/resource/Mobile%20Checkin`, {
            method: 'POST',
            body: JSON.stringify(formattedData),
        });

        if (!response.ok) {
            const errorMsg = await parseErrorMessage(response, 'Failed to post check-in to ERPNext');
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

        const url = `${ERP_PROXY_URL}/resource/Mobile%20Checkin?fields=["*"]&filters=${JSON.stringify(filters)}`;

        const response = await erpFetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Failed to fetch pending check-ins'));
        }

        const data = await response.json();
        return data.data;
    },

    async getMyCheckins(employeeId: string) {
        const filters = [["employee", "=", employeeId]];
        const url = `${ERP_PROXY_URL}/resource/Mobile%20Checkin?fields=["*"]&filters=${JSON.stringify(filters)}&order_by=checkin_time desc`;

        const response = await erpFetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Failed to fetch your check-ins'));
        }

        const data = await response.json();
        return data.data;
    },

    async getTeamCheckins(hodId: string) {
        const filters = [
            ["hod", "=", hodId],
            ["employee", "!=", hodId]
        ];
        const url = `${ERP_PROXY_URL}/resource/Mobile%20Checkin?fields=["*"]&filters=${JSON.stringify(filters)}&order_by=checkin_time desc`;

        const response = await erpFetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Failed to fetch team check-ins'));
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
        const url = `${ERP_PROXY_URL}/resource/Employee%20Checkin?fields=["*"]&filters=${JSON.stringify(filters)}&order_by=time asc&limit_page_length=500`;

        const response = await erpFetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Failed to fetch official attendance'));
        }

        const data = await response.json();
        return data.data;
    },

    async getAttendanceSummary(employeeId: string, fromDate: string, toDate: string) {
        const filters = [
            ["employee", "=", employeeId],
            ["attendance_date", "between", [fromDate, toDate]],
            ["docstatus", "=", 1]
        ];
        const url = `${ERP_PROXY_URL}/resource/Attendance?fields=["*"]&filters=${JSON.stringify(filters)}&limit_page_length=500`;

        const response = await erpFetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Failed to fetch attendance summary'));
        }

        const data = await response.json();
        return (data.data || []) as AttendanceRecord[];
    },

    async getOvertimeAllocations(employeeId: string, fromDate: string, toDate: string) {
        const filters = [["employee", "=", employeeId]];
        const fields = `["*"]`;
        const url = `${ERP_PROXY_URL}/resource/Overtime%20Alloctation?fields=${fields}&filters=${JSON.stringify(filters)}&limit_page_length=500`;
        const response = await erpFetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Failed to fetch overtime allocation'));
        }

        const data = await response.json();
        const rows = (data.data || []) as OvertimeAllocationRecord[];
        const filteredRows = rows.filter((row) => {
            const otDate = String(row.ot_date || row.date || row.attendance_date || "");
            const status = String(row.status || row.workflow_state || row.approval_status || "").trim().toLowerCase();
            const docstatus = Number(row.docstatus ?? 0);
            const isApproved = status === "" ? docstatus === 1 : status === "approved";
            const isWithinRange = Boolean(otDate && otDate >= fromDate && otDate <= toDate);
            return isApproved && isWithinRange;
        });

        console.log("[KPI Debug] Overtime rows returned from ERP", {
            employeeId,
            fromDate,
            toDate,
            totalRows: rows.length,
            matchedRows: filteredRows.length,
            rows,
            filteredRows,
        });

        return filteredRows;
    },

    async getSalarySlips(employeeId: string, fromDate: string, toDate: string) {
        const filters = [
            ["employee", "=", employeeId],
            ["start_date", ">=", fromDate],
            ["end_date", "<=", toDate],
            ["docstatus", "=", 1]
        ];
        const fields = JSON.stringify([
            "name",
            "employee",
            "employee_name",
            "start_date",
            "end_date",
            "posting_date",
            "currency",
            "gross_pay",
            "net_pay",
            "rounded_total",
            "status",
            "docstatus"
        ]);
        const url = `${ERP_PROXY_URL}/resource/Salary%20Slip?fields=${fields}&filters=${JSON.stringify(filters)}&order_by=start_date desc&limit_page_length=12`;
        const response = await erpFetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Failed to fetch salary slips'));
        }

        const data = await response.json();
        return (data.data || []) as SalarySlipRecord[];
    },

    async getSalarySlipDetail(name: string) {
        const response = await erpFetch(`${ERP_PROXY_URL}/resource/Salary%20Slip/${encodeURIComponent(name)}`, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Failed to fetch salary slip details'));
        }

        const data = await response.json();
        return (data.data || null) as SalarySlipDetail | null;
    },

    async getSalarySlipPrintHtml(name: string, printFormat = "Standard") {
        const params = new URLSearchParams({
            doctype: "Salary Slip",
            name,
            format: printFormat,
            no_letterhead: "0",
            trigger_print: "0",
        });

        const response = await erpFetch(`${ERP_PROXY_URL}/printview?${params.toString()}`, {
            method: 'GET',
            headers: {
                Accept: 'text/html',
            },
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Failed to fetch salary slip print view'));
        }

        return await response.text();
    },

    async updateStatus(name: string, status: 'Approved' | 'Rejected', remarks?: string) {
        const response = await erpFetch(`${ERP_PROXY_URL}/resource/Mobile%20Checkin/${name}`, {
            method: 'PUT',
            body: JSON.stringify({
                status,
                approver_remarks: remarks,
            }),
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, `Failed to ${status} check-in`));
        }

        return await response.json();
    },

    async deleteCheckin(name: string) {
        const response = await erpFetch(`${ERP_PROXY_URL}/resource/Mobile%20Checkin/${name}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Failed to delete check-in log'));
        }

        return await response.json();
    },

    async login(usr: string, pwd: string) {
        const response = await erpFetch(`${ERP_PROXY_URL}/login`, {
            method: 'POST',
            body: JSON.stringify({ usr, pwd }),
        });
        if (!response.ok) throw new Error(await parseErrorMessage(response, 'Invalid credentials'));
        return await response.json();
    },

    async logout() {
        await erpFetch(`${ERP_PROXY_URL}/logout`, {
            method: 'POST',
        });
    },

    async getEmployee(email: string) {
        const url = `${ERP_PROXY_URL}/resource/Employee?fields=["name","employee_name","reports_to","image"]&filters=[["user_id", "=", "${email}"]]`;
        const response = await erpFetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Failed to fetch Employee data'));
        }

        const data = await response.json();
        console.log("ERPNext Employee Data:", data);
        return data.data?.[0] || null;
    },

    async getEmployeeImages(employeeIds: string[]) {
        if (employeeIds.length === 0) return {};
        const filters = JSON.stringify([["name", "in", employeeIds]]);
        const url = `${ERP_PROXY_URL}/resource/Employee?fields=["name","image"]&filters=${filters}`;
        const response = await erpFetch(url, {
            method: 'GET',
        });
        const data = await response.json();
        const imageMap: Record<string, string> = {};
        data.data?.forEach((e: any) => {
            if (e.image) imageMap[e.name] = `https://erp.ihgind.com${e.image}`;
        });
        return imageMap;
    },

    async isManager(employeeId: string) {
        const url = `${ERP_PROXY_URL}/resource/Employee?filters=[["reports_to", "=", "${employeeId}"]]&limit=1`;
        const response = await erpFetch(url, {
            method: 'GET',
        });
        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Failed to check manager status'));
        }
        const data = await response.json();
        return data.data && data.data.length > 0;
    }
};
