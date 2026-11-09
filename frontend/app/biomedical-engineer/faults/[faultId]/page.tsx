import FaultDetail from "@/components/faults/FaultDetail";

type FaultDetailsPageProps = {
  params: Promise<{
    faultId: string;
  }>;
};

export default async function FaultDetailsPage({
  params,
}: FaultDetailsPageProps) {
  const { faultId } = await params;

  return <FaultDetail faultId={faultId} />;
}
