import { Badge } from "@/components/ui";
import { STATUS_LABEL, type BookingStatus } from "@/lib/types";

const TONE = { pending: "warn", in_progress: "info", ready: "ok", registered: "neutral", cancelled: "danger" } as const;

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
