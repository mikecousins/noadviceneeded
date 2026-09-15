import { Form, useNavigation } from "react-router";

import { Button } from "./ui";
import { dateTime } from "~/lib/format";

export interface SyncView {
  status: "synced" | "fresh" | "reconnect" | "error";
  syncedAt: string | null;
}

const copy: Record<SyncView["status"], string | null> = {
  synced: null,
  fresh: null,
  reconnect: "Your SnapTrade access has ended. Sign in again from the home page to reconnect.",
  error: "SnapTrade didn't answer just now. Figures below are from the last successful read.",
};

/** The "last read" line and Refresh button every app page shows. */
export function SyncStatus({ sync }: { sync: SyncView }) {
  const navigation = useNavigation();
  const refreshing =
    navigation.state !== "idle" && navigation.formData?.get("intent") === "refresh";
  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <Form method="post">
        <input type="hidden" name="intent" value="refresh" />
        <Button type="submit" variant="secondary" disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh from SnapTrade"}
        </Button>
      </Form>
      <p className="text-xs text-ink-muted">
        {sync.syncedAt ? `Last read ${dateTime(sync.syncedAt)}` : "Not read yet"}
      </p>
      {copy[sync.status] && <p className="max-w-sm text-xs text-danger">{copy[sync.status]}</p>}
    </div>
  );
}
