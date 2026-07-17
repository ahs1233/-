import { SkelHeader, SkelGrid, Skel } from "@/src/components/skel";
export default function Loading() {
  return <div className="space-y-5"><SkelHeader /><Skel className="h-72 w-full rounded-3xl" /><SkelGrid /></div>;
}
