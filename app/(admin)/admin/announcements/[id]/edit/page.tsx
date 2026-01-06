import { AnnouncementForm } from "@/components/admin/announcement-form";

interface EditAnnouncementPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAnnouncementPage({
  params,
}: EditAnnouncementPageProps) {
  const { id } = await params;
  return <AnnouncementForm announcementId={id} />;
}

