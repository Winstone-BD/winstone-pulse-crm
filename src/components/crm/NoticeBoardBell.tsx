import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone } from "lucide-react";

import { NoticeBoardPanel } from "@/components/crm/NoticeBoardPanel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAdminToken } from "@/lib/local-session";
import { listNoticeBoard } from "@/lib/notice-board.functions";

export function NoticeBoardBell() {
  const adminToken = useAdminToken();
  const load = useServerFn(listNoticeBoard);
  const { data } = useQuery({ queryKey: ["it-notice-board", adminToken ? "pin" : "session"], queryFn: () => load({ data: { adminToken } }), retry: false, refetchInterval: 60_000 });
  const unread = (data?.notices ?? []).filter((notice) => !notice.read).length;
  return <Popover><PopoverTrigger asChild><button type="button" aria-label="IT Council notices" className="relative inline-flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-foreground"><Megaphone className="size-3.5" />{unread > 0 ? <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white">{unread}</span> : null}</button></PopoverTrigger><PopoverContent align="end" className="w-[min(92vw,28rem)] p-3"><NoticeBoardPanel compact /></PopoverContent></Popover>;
}