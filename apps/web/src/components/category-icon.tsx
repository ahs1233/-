import {
  Shirt,
  Smartphone,
  House,
  Baby,
  Sparkles,
  ShoppingBasket,
  Watch,
  Tag,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  shirt: Shirt,
  dress: Shirt,
  smartphone: Smartphone,
  home: House,
  baby: Baby,
  sparkles: Sparkles,
  "shopping-basket": ShoppingBasket,
  watch: Watch,
};

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && MAP[name]) || Tag;
  return <Icon className={className} />;
}
