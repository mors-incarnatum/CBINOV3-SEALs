import { notFound } from "next/navigation";
import { isCategoryId, CATEGORY_IDS } from "@/lib/board";
import CategoryBoard from "@/app/components/CategoryBoard";

export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORY_IDS.map((categoryId) => ({ categoryId }));
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  if (!isCategoryId(categoryId)) notFound();
  return <CategoryBoard key={categoryId} categoryId={categoryId} />;
}
