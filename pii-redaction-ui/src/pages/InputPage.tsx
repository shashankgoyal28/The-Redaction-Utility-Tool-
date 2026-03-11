import React, { useState } from "react";
import "../styles/inputPage.css";
import FileUploader from "../components/FileUploader";
import { useNavigate } from "react-router-dom";
import { redactText, redactFile } from "../api/redact";
import type { LabelStyle } from "../api/redact";

export default function InputPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<"text" | "pdf">("text");
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [options, setOptions] = useState({
    emails: true,
    phones: true,
    names: false,
    addresses: false,
  });

  const [labelStyle, setLabelStyle] = useState<LabelStyle>("typed");
  const [customLabel, setCustomLabel] = useState("");

  const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

  function toggleOption(key: keyof typeof options) {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function onRedact() {
    setIsSubmitting(true);

    try {
      /* ---------- TEXT MODE ---------- */
      if (mode === "text") {
        const payload = {
          text,
          redact_emails: options.emails,
          redact_phones: options.phones,
          redact_names: options.names,
          redact_addresses: options.addresses,
          label_style: labelStyle,
          custom_label: customLabel || null,
        };

        let textResp;
        try {
          textResp = await redactText(payload);
        } catch (err: any) {
          console.error("Text redaction error:", err);
          alert(err?.message || "Text redaction failed. Check backend logs.");
          return;
        }

        navigate("/results", {
          state: {
            ...textResp,
            file: null,
            options: payload,
            labelStyle,
            customLabel,
          },
        });

        return;
      }

      /* ---------- PDF MODE ---------- */
      if (!selectedFile) {
        alert("Please upload a PDF or image.");
        return;
      }

      if (!ALLOWED_TYPES.includes(selectedFile.type)) {
        alert(`Unsupported file type: ${selectedFile.type}`);
        return;
      }

      // For PDFs we always use black boxes in the final document.
      const payloadOptions = {
        redact_emails: options.emails,
        redact_phones: options.phones,
        redact_names: options.names,
        redact_addresses: options.addresses,
        label_style: "blackbox" as LabelStyle,
        custom_label: null as string | null,
      };

      let response;
      try {
        response = await redactFile(selectedFile, payloadOptions);
      } catch (err: any) {
        console.error("PDF redaction error:", err);
        alert(err?.message || "PDF redaction failed. Check backend logs.");
        return;
      }

      const previewUrl = URL.createObjectURL(selectedFile);

      navigate("/results", {
        state: {
          ...response,
          file: {
            name: selectedFile.name,
            size: selectedFile.size,
            type: selectedFile.type,
            url: previewUrl,
            originFile: selectedFile,
          },
          options: payloadOptions,
          labelStyle: "blackbox",
          customLabel: null,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container">
      <header className="page-header">
        <div>
          <h1 className="title">PII Redaction Tool</h1>
          <p className="subtitle">
            Automatically detect and remove sensitive information from text or PDF documents
            before sharing them.
          </p>
        </div>
        <div className="badge-pill">Secure · Fast · Regex-based</div>
      </header>

      {/* Mode Switch */}
      <div className="mode-toggle">
        <button
          className={mode === "text" ? "toggle active" : "toggle"}
          onClick={() => {
            setMode("text");
            // When coming back to text, keep whatever labelStyle user had or default to typed
            if (labelStyle !== "typed" && labelStyle !== "blackbox" && labelStyle !== "custom") {
              setLabelStyle("typed");
            }
          }}
        >
          ✏️ Text Mode
        </button>
        <button
          className={mode === "pdf" ? "toggle active" : "toggle"}
          onClick={() => {
            setMode("pdf");
            // In PDF mode we always use black boxes in the final PDF
            setLabelStyle("blackbox");
            setCustomLabel("");
          }}
        >
          📄 PDF / Image Mode
        </button>
      </div>
      <p className="mode-hint">
        {mode === "text"
          ? "Paste raw text to quickly test the redaction logic."
          : "Upload a PDF or image. The exported PDF will always use solid black boxes for redactions."}
      </p>

      {/* TEXT INPUT */}
      {mode === "text" && (
        <section className="panel">
          <div className="panel-header">
            <h2>Input Text</h2>
            <p className="panel-subtitle">
              Paste any content containing emails, phone numbers, names or addresses.
            </p>
          </div>
          <textarea
            className="text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here…"
          />
        </section>
      )}

      {/* PDF UPLOADER */}
      {mode === "pdf" && (
        <section className="panel">
          <div className="panel-header">
            <h2>Upload Document</h2>
            <p className="panel-subtitle">
              Supported: PDF, PNG, JPEG. For best results, use PDFs with selectable text (not
              scanned-only).
            </p>
          </div>
          <FileUploader
            onFileSelect={(file) => {
              if (file && !ALLOWED_TYPES.includes(file.type)) {
                alert(`Unsupported file type: ${file.type}`);
                setSelectedFile(null);
                return;
              }
              setSelectedFile(file);
            }}
          />
          {selectedFile && (
            <div className="file-meta-row">
              <span className="file-meta-label">Selected file:</span>
              <span className="file-meta-name">{selectedFile.name}</span>
              <span className="file-meta-size">
                {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type}
              </span>
            </div>
          )}
        </section>
      )}

      {/* Options */}
      <section className="panel mt-compact">
        <div className="panel-header">
          <h2>What should be redacted?</h2>
          <p className="panel-subtitle">
            Choose which categories of PII you want to remove. You can mix and match as needed.
          </p>
        </div>

        <div className="options two-column">
          <label>
            <input
              type="checkbox"
              checked={options.emails}
              onChange={() => toggleOption("emails")}
            />
            <span className="option-label">Emails</span>
            <span className="option-description">example@domain.com</span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={options.phones}
              onChange={() => toggleOption("phones")}
            />
            <span className="option-label">Phone Numbers</span>
            <span className="option-description">Mobile or landline numbers</span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={options.names}
              onChange={() => toggleOption("names")}
            />
            <span className="option-label">Names</span>
            <span className="option-description">
              Person names like &ldquo;John Doe&rdquo;
            </span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={options.addresses}
              onChange={() => toggleOption("addresses")}
            />
            <span className="option-label">Addresses</span>
            <span className="option-description">
              Street-style addresses detected via patterns
            </span>
          </label>
        </div>
      </section>

      {/* Label style */}
      <section className="panel mt-compact">
        <div className="panel-header">
          <h2>How should redactions look?</h2>
          <p className="panel-subtitle">
            In text mode, choose a redaction style for the preview. In PDF mode, the exported
            document always uses solid black boxes.
          </p>
        </div>

        <div className="label-style">
          {mode === "text" ? (
            <>
              <label>
                <input
                  type="radio"
                  name="label"
                  value="typed"
                  checked={labelStyle === "typed"}
                  onChange={() => setLabelStyle("typed")}
                />
                <div className="label-option">
                  <div className="label-option-title">Typed label</div>
                  <div className="label-option-example">[EMAIL_1], [PHONE_2], …</div>
                  <div className="label-option-desc">
                    Replaces PII with descriptive tokens. Great for debugging and reviewing.
                  </div>
                </div>
              </label>

              <label>
                <input
                  type="radio"
                  name="label"
                  value="blackbox"
                  checked={labelStyle === "blackbox"}
                  onChange={() => setLabelStyle("blackbox")}
                />
                <div className="label-option">
                  <div className="label-option-title">Black box</div>
                  <div className="label-option-example">██████</div>
                  <div className="label-option-desc">
                    Solid blocks that fully hide the content. Useful for final text outputs.
                  </div>
                </div>
              </label>

              <label>
                <input
                  type="radio"
                  name="label"
                  value="custom"
                  checked={labelStyle === "custom"}
                  onChange={() => setLabelStyle("custom")}
                />
                <div className="label-option">
                  <div className="label-option-title">Custom label</div>
                  <div className="label-option-example">
                    &ldquo;[REMOVED]&rdquo;, &ldquo;[PRIVATE]&rdquo;, …
                  </div>
                  <div className="label-option-desc">
                    Use your own replacement text for every redacted span.
                  </div>
                </div>
              </label>

              {labelStyle === "custom" && (
                <input
                  type="text"
                  className="custom-label-input"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Enter custom label, e.g. [REDACTED]"
                />
              )}
            </>
          ) : (
            // PDF mode: show only a fixed Black box info
            <div className="label-style pdf-mode-only">
              <div className="label-option">
                <div className="label-option-title">Black box (fixed for PDFs)</div>
                <div className="label-option-example">██████</div>
                <div className="label-option-desc">
                  For documents, PII is always covered with solid black rectangles in the exported
                  PDF. Label styles apply only to the text preview and summary.
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="cta-row">
        <button className="redact-btn" onClick={onRedact} disabled={isSubmitting}>
          {isSubmitting ? "Processing…" : "Run Redaction"}
        </button>
        <p className="cta-hint">
          Your document is processed by the backend and the redacted version is returned for
          download.
        </p>
      </div>
    </div>
  );
}




