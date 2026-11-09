import { CATEGORY_IDS } from "@/lib/board";
import CategoryBoard from "@/app/components/CategoryBoard";
export const dynamicParams = true;
export function generateStaticParams() { return CATEGORY_IDS.map(categoryId => ({ categoryId })); }
export default async function CategoryPage({ params }: {
    params: Promise<{
        categoryId: string;
    }>;
}) {
    const { categoryId } = await params;
    return <CategoryBoard key={categoryId} categoryId={categoryId}/>;
}
