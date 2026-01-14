import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AxiosError } from "axios";
import Modal from "../components/Modal";
import { useAuth } from "../auth/useAuth";
import {
  getAuditLogs,
  type AuditLogRow,
  type GetAuditLogsParams,
} from "../api/auditLogs";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

function isCanceledError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === "ERR_CANCELED";
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function safePrettyJson(value: unknown): string {
  if (value === null || typeof value === "undefined") return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function metaPreview(value: unknown): string {
  if (value === null || typeof value === "undefined") return "—";
  if (typeof value === "string")
    return value.length > 60 ? `${value.slice(0, 60)}…` : value;
  if (typeof value === "object") {
    try {
      const s = JSON.stringify(value);
      if (!s) return "—";
      return s.length > 60 ? `${s.slice(0, 60)}…` : s;
    } catch {
      return "View";
    }
  }
  return String(value);
}

function actorLabel(row: AuditLogRow): string {
  if (row.actor?.email) {
    return row.actor.name
      ? `${row.actor.email} (${row.actor.name})`
      : row.actor.email;
  }
  return row.actorUserId || "—";
}

function NotAuthorized() {
  return (
    <div className="page">
      <h1 className="page-title">Audit Logs</h1>
      <div className="card">
        <div className="card-title">Not authorized</div>
        <div className="muted">
          You don’t have permission to view audit logs.
        </div>
      </div>
    </div>
  );
}

const ACTION_OPTIONS = [
  "ALL",
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DELETED",
  "ROLE_CREATED",
  "ROLE_UPDATED",
  "ROLE_ASSIGNED",
  "ROLE_PERMISSION_UPDATED",
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PROJECT_ARCHIVED",
];

export default function AuditLogsPage() {
  const { permissions } = useAuth();
  const canReadAuditLogs = permissions.includes("audit.read");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [action, setAction] = useState("ALL");
  const [actorUserIdInput, setActorUserIdInput] = useState("");
  const [actorEmailInput, setActorEmailInput] = useState("");
  const [entityTypeInput, setEntityTypeInput] = useState("");
  const [entityIdInput, setEntityIdInput] = useState("");
  const [requestIdInput, setRequestIdInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const actorUserId = useDebouncedValue(actorUserIdInput, 300);
  const actorEmail = useDebouncedValue(actorEmailInput, 300);
  const entityType = useDebouncedValue(entityTypeInput, 300);
  const entityId = useDebouncedValue(entityIdInput, 300);
  const requestId = useDebouncedValue(requestIdInput, 300);

  const [items, setItems] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const fetchSeqRef = useRef(0);

  const query = useMemo<GetAuditLogsParams>(() => {
    return {
      page,
      limit,
      action,
      actorUserId,
      actorEmail,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      entityType,
      entityId,
      requestId,
    };
  }, [
    action,
    actorEmail,
    actorUserId,
    dateFrom,
    dateTo,
    entityId,
    entityType,
    limit,
    page,
    requestId,
  ]);

  const fetchAuditLogs = useCallback(
    async (opts?: { signal?: AbortSignal }) => {
      if (!canReadAuditLogs) return;

      const seq = ++fetchSeqRef.current;
      setLoading(true);
      setError(null);

      try {
        const res = await getAuditLogs(query, { signal: opts?.signal });
        if (fetchSeqRef.current !== seq) return;
        setItems(res.data);
        setTotal(res.meta.total);
        setHasNext(Boolean(res.meta.hasNext));
      } catch (err) {
        if (isCanceledError(err)) return;
        if (fetchSeqRef.current !== seq) return;
        const msg =
          (err as AxiosError<{ message?: string }>).response?.data?.message ||
          (err as Error)?.message ||
          "Failed to load audit logs.";
        setError(msg);
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }
    },
    [canReadAuditLogs, query]
  );

  useEffect(() => {
    if (!canReadAuditLogs) return;
    const controller = new AbortController();
    void fetchAuditLogs({ signal: controller.signal });
    return () => controller.abort();
  }, [canReadAuditLogs, fetchAuditLogs]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit));
  }, [limit, total]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const onRetry = useCallback(() => {
    const controller = new AbortController();
    void fetchAuditLogs({ signal: controller.signal });
  }, [fetchAuditLogs]);

  const onOpenDetails = useCallback((row: AuditLogRow) => {
    setSelected(row);
    setDetailsOpen(true);
  }, []);

  const onCloseDetails = useCallback(() => {
    setDetailsOpen(false);
    setSelected(null);
  }, []);

  if (!canReadAuditLogs) {
    return <NotAuthorized />;
  }

  return (
    <div className="page">
      <h1 className="page-title">Audit Logs</h1>
      <div className="muted">
        Review security-relevant activity across the system.
      </div>

      {error ? (
        <div className="alert">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>{error}</div>
            <button className="btn" type="button" onClick={onRetry}>
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <div className="toolbar">
        <div className="toolbar-left" style={{ flexWrap: "wrap", gap: 12 }}>
          <label className="field">
            <span className="muted">Action</span>
            <select
              className="select"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="muted">Actor User ID</span>
            <input
              className="input"
              value={actorUserIdInput}
              onChange={(e) => {
                setActorUserIdInput(e.target.value);
                setPage(1);
              }}
              placeholder="cuid…"
              type="text"
            />
          </label>

          <label className="field">
            <span className="muted">Actor Email</span>
            <input
              className="input"
              value={actorEmailInput}
              onChange={(e) => {
                setActorEmailInput(e.target.value);
                setPage(1);
              }}
              placeholder="user@company.com"
              type="text"
            />
          </label>

          <label className="field">
            <span className="muted">From</span>
            <input
              className="input"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              type="date"
            />
          </label>

          <label className="field">
            <span className="muted">To</span>
            <input
              className="input"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              type="date"
            />
          </label>

          <label className="field">
            <span className="muted">Entity Type</span>
            <input
              className="input"
              value={entityTypeInput}
              onChange={(e) => {
                setEntityTypeInput(e.target.value);
                setPage(1);
              }}
              placeholder="User / Role / Project"
              type="text"
            />
          </label>

          <label className="field">
            <span className="muted">Entity ID</span>
            <input
              className="input"
              value={entityIdInput}
              onChange={(e) => {
                setEntityIdInput(e.target.value);
                setPage(1);
              }}
              placeholder="id…"
              type="text"
            />
          </label>

          <label className="field">
            <span className="muted">Request ID</span>
            <input
              className="input"
              value={requestIdInput}
              onChange={(e) => {
                setRequestIdInput(e.target.value);
                setPage(1);
              }}
              placeholder="requestId…"
              type="text"
            />
          </label>

          <label className="field">
            <span className="muted">Page Size</span>
            <select
              className="select"
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Audit Events</div>

        {loading ? (
          <div className="muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="muted">No audit logs found.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 190 }}>Timestamp</th>
                <th style={{ width: 170 }}>Action</th>
                <th>Actor</th>
                <th>Entity</th>
                <th style={{ width: 220 }}>RequestId</th>
                <th style={{ width: 160 }}>Meta</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>{row.action}</td>
                  <td>{actorLabel(row)}</td>
                  <td>
                    {row.entityType}
                    {row.entityId ? `: ${row.entityId}` : ""}
                  </td>
                  <td>{row.requestId || "—"}</td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span className="muted">{metaPreview(row.meta)}</span>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => onOpenDetails(row)}
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <div className="muted">
            Total: {total} • Page {page} of {totalPages}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn"
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Prev
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext || loading}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <Modal
        title={selected ? `Audit Log ${selected.id}` : "Audit Log"}
        isOpen={detailsOpen}
        onClose={onCloseDetails}
      >
        {selected ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="muted">
              Timestamp: {formatDate(selected.createdAt)}
            </div>
            <div className="muted">Action: {selected.action}</div>
            <div className="muted">Actor: {actorLabel(selected)}</div>
            <div className="muted">
              Entity: {selected.entityType}
              {selected.entityId ? `: ${selected.entityId}` : ""}
            </div>
            <div className="muted">RequestId: {selected.requestId || "—"}</div>
            {typeof selected.ipAddress !== "undefined" ? (
              <div className="muted">IP: {selected.ipAddress || "—"}</div>
            ) : null}
            {typeof selected.userAgent !== "undefined" ? (
              <div className="muted">
                User-Agent: {selected.userAgent || "—"}
              </div>
            ) : null}

            <div>
              <div className="muted" style={{ marginBottom: 6 }}>
                Meta
              </div>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: 0,
                }}
              >
                {safePrettyJson(selected.meta)}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
