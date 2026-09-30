import { UserRound } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectableAgents } from "@/lib/agent-roster";
import { useSnapshot } from "@/lib/crm-data";
import { setOperatorId, useOperatorId } from "@/lib/local-session";

const NONE = "__none__";

/** "Operating as" switcher: picks which agent manual logs are attributed to. No login needed. */
export function AgentSelector() {
  const data = useSnapshot();
  const operatorId = useOperatorId();
  const agents = selectableAgents(data.profiles);
  const current = agents.find((a) => a.id === operatorId);

  return (
    <Select
      value={current ? current.id : NONE}
      onValueChange={(value) => setOperatorId(value === NONE ? null : value)}
    >
      <SelectTrigger
        className="h-8 w-8 shrink-0 justify-center gap-1.5 overflow-hidden rounded-full border-border/70 bg-secondary/60 px-0 text-xs sm:w-auto sm:max-w-[150px] sm:justify-between sm:rounded-md sm:px-3 xl:max-w-[230px] [&>span]:hidden sm:[&>span]:inline [&>svg:last-child]:hidden sm:[&>svg:last-child]:block"
        aria-label="Operating as"
      >
        <UserRound className="size-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Select agent" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={NONE}>Observer</SelectItem>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            {agent.name}
            {agent.employee_id ? ` · ${agent.employee_id}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
