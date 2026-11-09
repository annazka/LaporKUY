import {DashboardNav} from "@/components/dashboard-nav";
import { PageTitle, Empty } from "@/components/ui";
import { ReportExplorer } from "@/components/widgets";
import { requireViewer, reports } from "@/lib/backend";
import type { Report } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfileReports() {
  await requireViewer(false, "/profile/reports");
  let list: Report[] = [];
  let failed = false;
  try {
    list = await reports();
  } catch {
    failed = true;
  }

  return (
    <div className="container page dashboard-shell">
      <DashboardNav/>
      <div className="dashboard-content">
        <PageTitle
          eyebrow="LAPORAN WARGA"
          title="Jelajahi laporan."
          description="Cari laporan jalan rusak dan pantau status penanganannya."
        />
        {failed ? (
          <Empty
            title="Laporan belum dapat dimuat."
            text="Muat ulang halaman untuk mencoba kembali."
            action={false}
          />
        ) : (
          <ReportExplorer reports={list} />
        )}
      </div>
    </div>
  );
}
