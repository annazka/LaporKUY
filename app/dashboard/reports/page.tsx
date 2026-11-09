import {DataUnavailable} from "@/components/data-unavailable";
import { requireViewer, backend, accessToken } from "@/lib/backend";
import { ReportExplorer } from "@/components/widgets";
import { PageTitle } from "@/components/ui";
import { DashboardNav } from "@/components/dashboard-nav";
import type { Report } from "@/lib/types";
export default async function MyReports() {
  const user = await requireViewer(false, "/dashboard/reports"),
    token = await accessToken();
  const submissions = await backend(
    `/rest/v1/submissions?select=report_id&user_id=eq.${user.id}`,
    {},
    token,
  ).catch(() => null);
  const ids = [
    ...new Set((submissions ?? []).map((s: { report_id: string }) => s.report_id)),
  ];
  const reports: Report[] | null = submissions === null ? null : ids.length
    ? await backend(
        `/rest/v1/reports?select=*&id=in.(${ids.join(",")})&order=created_at.desc`,
        {},
        token,
      ).catch(() => null)
    : [];
  return (
    <div className="container page dashboard-shell">
      <DashboardNav />
      <div className="dashboard-content">
        <PageTitle
          eyebrow="KONTRIBUSI KAMU"
          title="Laporan saya."
          description="Cari dan pantau laporan yang kamu kirim atau dukung."
        />
        {reports === null ? <DataUnavailable message="Laporan kamu belum dapat dimuat."/> : <ReportExplorer reports={reports} />}
      </div>
    </div>
  );
}
