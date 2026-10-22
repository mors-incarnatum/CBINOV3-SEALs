import { CATEGORIES, type CategoryId } from "@/lib/board";

export default function CategoryBanner({
  categoryId,
}: {
  categoryId: CategoryId;
}) {
  const category = CATEGORIES[categoryId];
  return (
    <div
      className="text-center font-bold text-sm md:text-base py-1.5 border rounded-none shadow-xs shrink-0"
      style={{
        background: category.background,
        borderColor: category.color,
        color: category.color,
      }}
    >
      {category.label}
    </div>
  );
}
