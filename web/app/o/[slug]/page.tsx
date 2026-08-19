import { OrganizationWorkspace } from '@/components/OrganizationWorkspace';

export default async function OrganizationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <OrganizationWorkspace slug={slug} />;
}
