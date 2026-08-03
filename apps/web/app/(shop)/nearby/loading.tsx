import { SkelHeader, SkelList, Skel } from "@/src/components/skel";
export default function Loading() {
  return <div className="space-y-4"><SkelHeader /><Skel className="h-72 w-full rounded-2xl" /><SkelList n={4} /></div>;
}
