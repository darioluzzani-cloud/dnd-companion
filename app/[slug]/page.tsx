'use client';
import { useParams } from 'next/navigation';
import { CampaignApp } from '@/components/CampaignApp';

export default function CampaignPage() {
  const params = useParams();
  const slug = params.slug as string;
  return <CampaignApp slug={slug} />;
}
