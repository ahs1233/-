import { SkelHeader, SkelChips, SkelGrid, Skel } from "@/src/components/skel";
export default function Loading() {
  return <div className="space-y-5"><SkelHeader /><Skel className="h-40 w-full rounded-3xl" /><SkelChips /><SkelGrid /></div>;
}
