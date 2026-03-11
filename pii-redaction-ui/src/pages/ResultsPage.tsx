// src/pages/ResultsPage.tsx
import React, { useState } from "react";
import "../styles/resultsPage.css";
import { useNavigate, useLocation } from "react-router-dom";
import { downloadRedactedFileByUrl } from "../api/redact";

export default function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    original_text = "No original text received.",
    redacted_text = "No redacted text received.",
    summary = { counts: {}, items: [] },
    file = null,
    download_url = null,
    message = null,
    options = {
      redact_emails: true,
      redact_phones: true,
      redact_names: false,
      redact_addresses: false,
    },
    labelStyle = "typed",
    customLabel = null,
  } = (location.state as any) || {};

  const [activeTab, setActiveTab] = useState<"original" | "redacted" | "summary" | "file">(
    "original"
  );
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    try {
      if (!download_url) {
        alert("No download URL available. Try re-running the redaction.");
        return;
      }

      setDownloading(true);

      const blob = await downloadRedactedFileByUrl(download_url);

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file?.name ? `redacted_${file.name}` : "redacted_output.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download redacted PDF. Check backend logs.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopySummary() {
    const lines = [
      "Redaction Summary",
      `Counts: ${Object.entries(summary.counts)
        .map(([k, v]) => `${k}:${v}`)
        .join(" • ")}`,
      "",
      "Items:",
      ...summary.items.map(
        (it: any, i: number) => `${i + 1}. ${it.type}: "${it.original}" → ${it.label}`
      ),
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      alert("Summary copied to clipboard");
    } catch {
      alert("Copy failed — your browser might block clipboard access.");
    }
  }

  const totalRedacted =
    (summary.counts?.EMAIL ?? 0) +
    (summary.counts?.PHONE ?? 0) +
    (summary.counts?.NAME ?? 0) +
    (summary.counts?.ADDRESS ?? 0);

  return (
    <div className="results-root">
      <div className="results-card">
        <header className="results-header">
          <div>
            <h1 className="results-heading">Redaction Results</h1>
            <p className="results-subtitle">
              Review the changes, inspect what was removed, and download the redacted document.
            </p>
          </div>
          <div className="results-meta-pill">
            {file?.name ? (
              <>
                <span className="pill-label">Source file</span>
                <span className="pill-value">{file.name}</span>
              </>
            ) : (
              <>
                <span className="pill-label">Source</span>
                <span className="pill-value">Raw text</span>
              </>
            )}
          </div>
        </header>

        {message && (
          <div className="info-banner">
            <span className="info-dot" />
            <span>{message}</span>
          </div>
        )}

        <div className="results-overview-row">
          <div className="overview-item">
            <div className="overview-label">Total redactions</div>
            <div className="overview-value">{totalRedacted}</div>
          </div>
          <div className="overview-item">
            <div className="overview-label">Label style</div>
            <div className="overview-value">
              {labelStyle === "typed"
                ? "Typed tokens"
                : labelStyle === "blackbox"
                ? "Black boxes"
                : "Custom label"}
            </div>
          </div>
          <div className="overview-item">
            <div className="overview-label">PII types</div>
            <div className="overview-pills">
              {options.redact_emails && <span className="chip">Email</span>}
              {options.redact_phones && <span className="chip">Phone</span>}
              {options.redact_names && <span className="chip">Name</span>}
              {options.redact_addresses && <span className="chip">Address</span>}
              {!options.redact_emails &&
                !options.redact_phones &&
                !options.redact_names &&
                !options.redact_addresses && <span className="chip muted">None selected</span>}
            </div>
          </div>
        </div>

        <div className="tabs-row" role="tablist" aria-label="Results tabs">
          <button
            role="tab"
            aria-selected={activeTab === "original"}
            className={`tab ${activeTab === "original" ? "active" : ""}`}
            onClick={() => setActiveTab("original")}
          >
            Original
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "redacted"}
            className={`tab ${activeTab === "redacted" ? "active" : ""}`}
            onClick={() => setActiveTab("redacted")}
          >
            Redacted
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "summary"}
            className={`tab ${activeTab === "summary" ? "active" : ""}`}
            onClick={() => setActiveTab("summary")}
          >
            Summary
          </button>
          {file?.url && (
            <button
              role="tab"
              aria-selected={activeTab === "file"}
              className={`tab ${activeTab === "file" ? "active" : ""}`}
              onClick={() => setActiveTab("file")}
            >
              File Preview
            </button>
          )}
        </div>

        <div className="content-row">
          <div className="main-column">
            {activeTab === "original" && (
              <pre className="text-box" aria-label="Original text">
                {original_text}
              </pre>
            )}

            {activeTab === "redacted" && (
              <pre className="text-box" aria-label="Redacted text">
                {redacted_text}
              </pre>
            )}

            {activeTab === "summary" && (
              <div className="summary-view">
                <h3>Summary of Redaction</h3>

                <div className="stats-row">
                  {["NAME", "EMAIL", "PHONE", "ADDRESS"].map((k) => (
                    <div key={k} className="stat-card" aria-hidden>
                      <div className="stat-title">{k}</div>
                      <div className="stat-value">{summary.counts[k] ?? 0}</div>
                    </div>
                  ))}
                </div>

                <div className="summary-list">
                  <h4>Redacted Items</h4>
                  {summary.items.length === 0 && (
                    <p className="summary-empty">
                      No PII was detected based on the current detection rules and options.
                    </p>
                  )}
                  <ul>
                    {summary.items.map((item: any, idx: number) => (
                      <li key={idx} className="summary-item">
                        <div className="item-left">
                          <span className="item-type">{item.type}</span>
                          <code className="item-original"> {item.original}</code>
                        </div>
                        <div className="item-right">
                          <span className="item-label">{item.label}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {activeTab === "file" && file?.url && (
              <div className="file-preview">
                <h3>Uploaded File Preview</h3>
                {file.type === "application/pdf" ? (
                  <iframe src={file.url} title="PDF preview" className="pdf-iframe" />
                ) : (
                  <img src={file.url} alt="uploaded preview" className="preview-image" />
                )}
              </div>
            )}

            <div className="actions-row">
              <button className="btn btn-secondary" onClick={() => navigate("/")}>
                Back
              </button>

              <div style={{ flex: 1 }} />

              <button className="btn btn-ghost" onClick={handleCopySummary}>
                Copy Summary
              </button>

              <button
                className="btn btn-primary"
                onClick={handleDownload}
                disabled={downloading || !download_url}
              >
                {downloading
                  ? "Downloading…"
                  : download_url
                  ? "Download Redacted PDF"
                  : "No PDF available"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

