import http from 'k6/http';
import { check } from 'k6';
export const options = {
 vus: Number(__ENV.VUS || 10), duration: __ENV.DURATION || '30s',
 summaryTrendStats: ['med','p(95)','p(99)','min','max'],
 thresholds: {http_req_failed: ['rate<0.01'],checks:['rate>0.99']},
};
export default function () {
 const response=http.get(`${__ENV.BASE_URL}/api/dashboard/summary?month=2026-10-01`,{headers:{Authorization:`Bearer ${__ENV.TOKEN}`}});
 check(response, {'status 200':r=>r.status===200,'10,000-row summary':r=>r.json('summary.accountCount')===1});
}
export function handleSummary(data) { return { [__ENV.RESULT_FILE || 'result.json']: JSON.stringify(data,null,2) }; }
