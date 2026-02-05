import { useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage } from "../api/client";
import { getProjects, type Project } from "../api/projects";

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function ProjectsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSeqRef = useRef(0);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit));
  }, [limit, total]);

  useEffect(() => {
    const controller = new AbortController();
    const seq = ++fetchSeqRef.current;

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await getProjects(
          { page, limit },
          { signal: controller.signal },
        );

        if (fetchSeqRef.current !== seq) return;
        setProjects(res.data);
        setTotal(res.meta.total);
        setHasNext(Boolean(res.meta.hasNext));
      } catch (err) {
        if (fetchSeqRef.current !== seq) return;
        setError(getApiErrorMessage(err, "Failed to load projects."));
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [limit, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="page">
      <h1 className="page-title">Projects</h1>

      {error && (
        <div className="card" style={{ borderColor: "#e57373" }}>
          <div className="card-title" style={{ color: "#e57373" }}>
            Error
          </div>
          <div className="muted">{error}</div>
        </div>
      )}

      <div className="card">
        <div className="card-title">All Projects</div>

        {loading ? (
          <div className="muted">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="muted">No projects found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Owner</th>
                  <th>Archived</th>
                  <th>Created</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="muted">{p.ownerId ?? "—"}</td>
                    <td>{p.isArchived ? "Yes" : "No"}</td>
                    <td className="muted">{formatDate(p.createdAt)}</td>
                    <td className="muted">{formatDate(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <div className="muted">
            Page {page} of {totalPages} • {total} total
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              className="btn"
              disabled={loading || !hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
