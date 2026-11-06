import { useEffect, useState, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  FileSearch,
  FileSpreadsheet,
  FileText,
  FileUp,
  Filter,
  FolderOpen,
  History,
  Info,
  Layers,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserCheck,
  X,
  Calendar,
  Building2,
  Tag,
  Check,
} from "lucide-react";
import { api } from "./api";
import {
  reset,
  setAnalysis,
  setError,
  setIncident,
  setLoading,
  setSavedId,
  updateAnalysis,
  updateField,
} from "./redux/investigationSlice";
import s from "./App.module.css";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const CHAT_STORAGE_KEY = "aivoa_investigation_chat";

const SAMPLE_INCIDENT = `Deviation report — API-2026-014
Product: API Product X
Batch number: API-2026-014
Date: 2026-10-28
Department: Production
During review of the batch manufacturing record, the in-process assay result at the intermediate stage was found below the internal acceptance limit. The batch was placed on quality hold pending investigation. The operator informed the supervisor and the production team segregated the batch. The dispensing record, equipment calibration status, raw material COA, chromatograms and process parameter trend have not yet been attached to this initial report. No confirmed root cause is available at this stage.`;

export default function App() {
  const dispatch = useDispatch();
  const { incident, analysis, loading, error, savedId } = useSelector(
    (x) => x.investigation
  );

  const [page, setPage] = useState("new");
  const [source, setSource] = useState("");
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [db, setDb] = useState("Checking...");
  const [toast, setToast] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatFile, setChatFile] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);

  // Initialize and persist chat history in sessionStorage
  const [chatMessages, setChatMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      {
        role: "assistant",
        text: "HI , how can i assist you today ?",
      },
    ];
  });

  const messagesEndRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatMessages));
    } catch (e) {}
  }, [chatMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // History search and filters
  const [historySearch, setHistorySearch] = useState("");
  const [historySeverity, setHistorySeverity] = useState("All");
  const [historyStatus, setHistoryStatus] = useState("All");

  const notify = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 3500);
  };

  const showError = (m) => {
    dispatch(setError(m));
    notify(m);
  };

  function clearChatSession() {
    const initial = [
      {
        role: "assistant",
        text: "HI , how can i assist you today ?",
      },
    ];
    setChatMessages(initial);
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
    } catch (e) {}
    notify("Session conversation history reset.");
  }

  async function sendChatMessage() {
    const trimmed = chatInput.trim();
    if (!trimmed && !chatFile) {
      showError("Type a message or attach a PDF before sending to the assistant.");
      return;
    }
    if (chatFile && chatFile.size > MAX_UPLOAD_BYTES) {
      setChatFile(null);
      showError("Uploaded PDF exceeds 20 MB. Please choose a file under 20 MB.");
      return;
    }

    const userMessage = {
      role: "user",
      text: trimmed || `Uploaded: ${chatFile.name}`,
    };

    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput("");
    setChatFile(null);
    setChatLoading(true);

    try {
      const fd = new FormData();
      fd.append("message", trimmed || "");
      fd.append("incident", JSON.stringify(incident));
      fd.append("history", JSON.stringify(chatMessages.slice(-6)));
      if (chatFile) fd.append("file", chatFile);

      const result = await api.chat(fd);
      if (result.incident) {
        dispatch(setIncident(result.incident));
      }

      const replyText =
        result.reply ||
        "I reviewed your request and updated the investigation parameters.";

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: replyText,
        },
      ]);
      notify("Investigation details updated.");
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: e.message || "I could not process that input right now." },
      ]);
      showError(e.message);
    } finally {
      setChatLoading(false);
    }
  }

  useEffect(() => {
    api
      .health()
      .then((x) =>
        setDb(x.database_configured ? "Connected" : "Not configured")
      )
      .catch(() => setDb("Offline"));
  }, []);

  useEffect(() => {
    if (page === "history") loadHistory();
  }, [page]);

  const field = (name, value) => dispatch(updateField({ name, value }));

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const records = await api.list();
      setHistory(records || []);
    } catch (e) {
      notify(e.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function extract() {
    if (!source.trim() && !file) {
      showError("Please paste an incident report or upload a PDF document first.");
      return;
    }
    if (file && file.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      showError("File exceeds 20 MB limit. Please upload a PDF under 20 MB.");
      return;
    }
    dispatch(setLoading(true));
    dispatch(setError(""));
    try {
      const fd = new FormData();
      fd.append("text", source);
      fd.append("incident", JSON.stringify(incident));
      if (file) fd.append("file", file);
      const r = await api.extract(fd);
      dispatch(setIncident(r.incident));
      notify("Document parsed successfully. Investigation parameters populated.");
    } catch (e) {
      showError(e.message);
    } finally {
      dispatch(setLoading(false));
    }
  }

  async function analyze() {
    if (!incident.incident_description.trim()) {
      showError("Incident description is required before running causal analysis.");
      return;
    }
    dispatch(setLoading(true));
    dispatch(setError(""));
    try {
      const result = await api.analyze({
        incident,
        method: incident.investigation_method,
      });
      dispatch(setAnalysis(result));
      notify("Root cause evaluation & CAPA recommendations generated.");
    } catch (e) {
      showError(e.message);
    } finally {
      dispatch(setLoading(false));
    }
  }

  async function save() {
    if (!incident.title.trim() || !incident.incident_description.trim()) {
      showError("Investigation title and description are required to save.");
      return;
    }
    dispatch(setLoading(true));
    dispatch(setError(""));
    try {
      const r = await api.save({ incident, analysis: analysis || {} });
      dispatch(setSavedId(r.id));
      notify(`Investigation record #${r.id} saved successfully.`);
      loadHistory();
    } catch (e) {
      showError(e.message);
    } finally {
      dispatch(setLoading(false));
    }
  }

  async function openRecord(id) {
    try {
      const r = await api.get(id);
      dispatch(
        setIncident({
          title: r.title || "",
          batch_number: r.batch_number || "",
          product_name: r.product_name || "",
          incident_date: r.incident_date || "",
          department: r.department || "",
          severity: r.severity || "Medium",
          status: r.status || "Draft",
          incident_description: r.incident_description || "",
          containment_action: r.containment_action || "",
          investigation_method: r.investigation_method || "5 Whys",
        })
      );
      dispatch(setAnalysis(r.analysis));
      dispatch(setSavedId(r.id));
      setPage("new");
      notify(`Investigation record #${id} loaded.`);
    } catch (e) {
      notify(e.message);
    }
  }

  function newRecord() {
    dispatch(reset());
    setSource("");
    setFile(null);
    setPage("new");
  }

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (!droppedFile.name.toLowerCase().endsWith(".pdf")) {
        showError("Only PDF files are supported.");
        return;
      }
      if (droppedFile.size > MAX_UPLOAD_BYTES) {
        showError("File exceeds 20 MB limit.");
        return;
      }
      setFile(droppedFile);
    }
  };

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch =
        !historySearch ||
        (item.title && item.title.toLowerCase().includes(historySearch.toLowerCase())) ||
        (item.batch_number && item.batch_number.toLowerCase().includes(historySearch.toLowerCase())) ||
        (item.product_name && item.product_name.toLowerCase().includes(historySearch.toLowerCase()));

      const matchesSeverity =
        historySeverity === "All" || item.severity === historySeverity;

      const matchesStatus =
        historyStatus === "All" || item.status === historyStatus;

      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [history, historySearch, historySeverity, historyStatus]);

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className={s.shell}>
      {/* Enterprise Sidebar */}
      <aside className={s.sidebar}>
        <div className={s.brand}>
          <div className={s.brandIcon}>
            <ShieldCheck size={22} strokeWidth={2.2} />
          </div>
          <div className={s.brandInfo}>
            <span className={s.brandName}>AIVOA</span>
            <span className={s.brandSub}>QUALITY ENTERPRISE</span>
          </div>
        </div>

        <div className={s.navGroup}>
          <span className={s.navGroupTitle}>NAVIGATION</span>
          <button
            className={`${s.navItem} ${page === "new" ? s.navActive : ""}`}
            onClick={() => setPage("new")}
          >
            <ClipboardList size={18} />
            <span>Investigation Studio</span>
            {savedId && <span className={s.badgeId}>#{savedId}</span>}
          </button>
          <button
            className={`${s.navItem} ${page === "history" ? s.navActive : ""}`}
            onClick={() => {
              setPage("history");
              if (page === "history") {
                loadHistory();
              }
            }}
          >
            <History size={18} />
            <span>Audit Repository</span>
            {history.length > 0 && (
              <span className={s.badgeCount}>{history.length}</span>
            )}
          </button>
        </div>

        <div className={s.sidebarFooter}>
          <div className={s.systemStatusBlock}>
            <div className={s.statusRow}>
              <span className={s.statusLabel}>Repository</span>
              <span className={s.statusValue}>
                <span
                  className={`${s.statusDot} ${
                    db === "Connected" ? s.dotGreen : s.dotOrange
                  }`}
                />
                {db}
              </span>
            </div>
            <div className={s.statusRow}>
              <span className={s.statusLabel}>Engine</span>
              <span className={s.statusValue}>
                <span className={`${s.statusDot} ${s.dotGreen}`} />
                Operational
              </span>
            </div>
          </div>

          <div className={s.userBadge}>
            <div className={s.userAvatar}>QA</div>
            <div className={s.userMeta}>
              <span className={s.userName}>Quality Specialist</span>
              <span className={s.userRole}>Lead Investigator</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={s.main}>
        {/* Top Header */}
        <header className={s.topbar}>
          <div className={s.breadcrumbs}>
            <span>Quality Management</span>
            <ChevronRight size={14} className={s.breadcrumbSep} />
            <span>Investigations</span>
            <ChevronRight size={14} className={s.breadcrumbSep} />
            <strong className={s.breadcrumbCurrent}>
              {page === "new"
                ? savedId
                  ? `Investigation Record #${savedId}`
                  : "New Deviation Investigation"
                : "Investigation Audit Repository"}
            </strong>
          </div>

         
        </header>

        <div className={s.workspace}>
          <div className={s.contentArea}>
            {page === "new" ? (
              <div className={s.content}>
            {/* Page Header */}
            <div className={s.pageHead}>
              <div>
                <span className={s.pageCategory}>QUALITY ASSURANCE & REGULATORY COMPLIANCE</span>
                <h1 className={s.pageTitle}>Root Cause Analysis & CAPA</h1>
                <p className={s.pageSubtitle}>
                  Structured deviation intake, 5 Whys & Ishikawa causal breakdown, and CAPA remediation tracking.
                </p>
              </div>

              <div className={s.headActions}>
                <button className={s.btnSecondary} onClick={newRecord}>
                  <Plus size={16} /> New Record
                </button>
              </div>
            </div>

            {/* Executive Status Metrics */}
            <div className={s.metricsGrid}>
              <div className={s.metricCard}>
                <div className={s.metricIconWrapper}>
                  <Activity size={18} />
                </div>
                <div>
                  <span className={s.metricLabel}>INVESTIGATION WORKFLOW</span>
                  <div className={s.metricValue}>Deviation Lifecycle</div>
                  <span className={s.metricDesc}>Intake → Causal Analysis → CAPA</span>
                </div>
              </div>

              <div className={s.metricCard}>
                <div className={s.metricIconWrapper}>
                  <Layers size={18} />
                </div>
                <div>
                  <span className={s.metricLabel}>ANALYTICAL METHOD</span>
                  <div className={s.metricValue}>{incident.investigation_method}</div>
                  <span className={s.metricDesc}>Systematic Root Cause Methodology</span>
                </div>
              </div>

              <div className={s.metricCard}>
                <div className={s.metricIconWrapper}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <span className={s.metricLabel}>INVESTIGATION STATUS</span>
                  <div className={s.metricValue}>
                    <span className={`${s.badgeStatus} ${getStatusClass(incident.status)}`}>
                      {incident.status}
                    </span>
                  </div>
                  <span className={s.metricDesc}>QA Review & Verification Required</span>
                </div>
              </div>
            </div>

            {/* Step 2: Investigation Form */}
            <section className={s.card}>
              <div className={s.cardHeader}>
                <div>
                  <h2 className={s.cardTitle}>Investigation Parameters & Containment</h2>
                  <p className={s.cardSubtitle}>
                    Review and confirm the specific batch parameters, severity level, and immediate containment measures.
                  </p>
                </div>
                <span className={s.pillBadge}>
                  <FileCheck2 size={13} /> VERIFIED FORM
                </span>
              </div>

              <div className={s.cardBody}>
                <div className={s.formGrid}>
                  <div className={s.formColSpan2}>
                    <label className={s.fieldLabel}>
                      Investigation Title <span className={s.requiredMark}>*</span>
                    </label>
                    <input
                      type="text"
                      className={s.input}
                      value={incident.title}
                      onChange={(e) => field("title", e.target.value)}
                      placeholder="e.g. Low Assay Result in Intermediate Stage — Batch API-2026-014"
                    />
                  </div>

                  <div>
                    <label className={s.fieldLabel}>Batch / Lot Number</label>
                    <input
                      type="text"
                      className={s.input}
                      value={incident.batch_number}
                      onChange={(e) => field("batch_number", e.target.value)}
                      placeholder="e.g. API-2026-014"
                    />
                  </div>

                  <div>
                    <label className={s.fieldLabel}>Product / Material Name</label>
                    <input
                      type="text"
                      className={s.input}
                      value={incident.product_name}
                      onChange={(e) => field("product_name", e.target.value)}
                      placeholder="e.g. API Product X"
                    />
                  </div>

                  <div>
                    <label className={s.fieldLabel}>Incident Date</label>
                    <input
                      type="date"
                      className={s.input}
                      value={incident.incident_date}
                      onChange={(e) => field("incident_date", e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={s.fieldLabel}>Responsible Department</label>
                    <select
                      className={s.select}
                      value={incident.department}
                      onChange={(e) => field("department", e.target.value)}
                    >
                      <option value="">Select Department</option>
                      {[
                        "Production",
                        "Quality Control",
                        "Quality Assurance",
                        "Engineering",
                        "Warehouse",
                        "Packaging",
                        "Other",
                      ].map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={s.fieldLabel}>Severity Classification</label>
                    <select
                      className={`${s.select} ${getSeveritySelectClass(incident.severity)}`}
                      value={incident.severity}
                      onChange={(e) => field("severity", e.target.value)}
                    >
                      <option value="Low">Low — Minor impact, within internal variance</option>
                      <option value="Medium">Medium — Moderate out-of-specification or process trend</option>
                      <option value="High">High — Critical batch parameter violation</option>
                      <option value="Critical">Critical — Immediate product recall or safety risk</option>
                    </select>
                  </div>

                  <div>
                    <label className={s.fieldLabel}>Investigation Methodology</label>
                    <select
                      className={s.select}
                      value={incident.investigation_method}
                      onChange={(e) =>
                        field("investigation_method", e.target.value)
                      }
                    >
                      <option value="5 Whys">5 Whys (Iterative Root Cause Analysis)</option>
                      <option value="Fishbone">Fishbone (Ishikawa 6M Framework)</option>
                    </select>
                  </div>

                  <div>
                    <label className={s.fieldLabel}>Record Status</label>
                    <select
                      className={s.select}
                      value={incident.status}
                      onChange={(e) => field("status", e.target.value)}
                    >
                      {[
                        "Draft",
                        "Under Investigation",
                        "Pending Review",
                        "Approved",
                        "Closed",
                      ].map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={s.formColSpanFull}>
                    <label className={s.fieldLabel}>
                      Incident & Observation Description <span className={s.requiredMark}>*</span>
                    </label>
                    <textarea
                      className={s.textarea}
                      rows={4}
                      value={incident.incident_description}
                      onChange={(e) =>
                        field("incident_description", e.target.value)
                      }
                      placeholder="Detailed factual statement of the deviation: what occurred, intermediate/final results, affected systems, and initial observations..."
                    />
                  </div>

                  <div className={s.formColSpanFull}>
                    <label className={s.fieldLabel}>
                      Immediate Containment & Quarantine Actions
                    </label>
                    <textarea
                      className={s.textarea}
                      rows={3}
                      value={incident.containment_action}
                      onChange={(e) =>
                        field("containment_action", e.target.value)
                      }
                      placeholder="e.g. Batch placed on physical and electronic quality hold, material segregated in quarantine area, QA supervisor notified..."
                    />
                  </div>
                </div>
              </div>

              <div className={s.cardFooter}>
                <span className={s.footerHint}>
                  Fields marked <span className={s.requiredMark}>*</span> are mandatory for QA sign-off.
                </span>
                <button
                  type="button"
                  className={s.btnPrimary}
                  disabled={loading}
                  onClick={analyze}
                >
                  <Layers size={16} />
                  {loading ? "Evaluating Causes..." : "Run Root Cause Analysis & CAPA"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </section>

            {/* Step 3: Analysis Output */}
            {analysis && (
              <AnalysisSection
                analysis={analysis}
                onUpdate={(patch) => dispatch(updateAnalysis(patch))}
              />
            )}

            {/* Error Banner */}
            {error && (
              <div className={s.errorBanner}>
                <AlertCircle size={18} />
                <span className={s.errorText}>{error}</span>
                <button
                  type="button"
                  className={s.btnDismissError}
                  onClick={() => dispatch(setError(""))}
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Persistent Sticky Bottom Action Bar */}
            <div className={s.actionBar}>
              <div className={s.actionBarStatus}>
                <div className={s.actionBarTitle}>
                  {savedId
                    ? `Record #${savedId} Saved to Database`
                    : analysis
                    ? "Investigation & CAPA Analysis Ready"
                    : "Investigation Draft in Progress"}
                </div>
                <div className={s.actionBarSub}>
                  {savedId
                    ? "Stored in the compliance database. Ready for formal audit review."
                    : "Verify all causal hypotheses and CAPA allocations before committing to record."}
                </div>
              </div>

              <div className={s.actionBarButtons}>
                <button
                  type="button"
                  className={s.btnSave}
                  disabled={loading}
                  onClick={save}
                >
                  <Save size={16} />
                  {loading ? "Saving Record..." : "Save Investigation Record"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* History Page */
          <div className={s.content}>
            <div className={s.pageHead}>
              <div>
                <span className={s.pageCategory}>QUALITY AUDIT TRAIL</span>
                <h1 className={s.pageTitle}>Investigation Repository</h1>
                <p className={s.pageSubtitle}>
                  Historical root cause investigations and CAPA logs stored in the compliance repository.
                </p>
              </div>

              <div className={s.headActions}>
                <button className={s.btnPrimary} onClick={newRecord}>
                  <Plus size={16} /> New Investigation
                </button>
              </div>
            </div>

            <section className={s.card}>
              {/* Search & Filter Header */}
              <div className={s.filterBar}>
                <div className={s.searchBox}>
                  <Search size={16} className={s.searchIcon} />
                  <input
                    type="text"
                    className={s.searchInput}
                    placeholder="Search by title, batch number, or product..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                  {historySearch && (
                    <button
                      className={s.btnClearSearch}
                      onClick={() => setHistorySearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className={s.filterGroup}>
                  <div className={s.filterSelectWrap}>
                    <Filter size={14} className={s.filterIcon} />
                    <select
                      className={s.filterSelect}
                      value={historySeverity}
                      onChange={(e) => setHistorySeverity(e.target.value)}
                    >
                      <option value="All">All Severities</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>

                  <div className={s.filterSelectWrap}>
                    <select
                      className={s.filterSelect}
                      value={historyStatus}
                      onChange={(e) => setHistoryStatus(e.target.value)}
                    >
                      <option value="All">All Statuses</option>
                      <option value="Draft">Draft</option>
                      <option value="Under Investigation">Under Investigation</option>
                      <option value="Pending Review">Pending Review</option>
                      <option value="Approved">Approved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  <button
                    className={s.btnSecondary}
                    onClick={loadHistory}
                    disabled={historyLoading}
                    title="Refresh records"
                  >
                    <RefreshCw
                      size={14}
                      className={historyLoading ? s.spin : ""}
                    />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className={s.tableContainer}>
                {historyLoading ? (
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>RECORD / TITLE</th>
                        <th>BATCH</th>
                        <th>PRODUCT</th>
                        <th>DEPARTMENT</th>
                        <th>SEVERITY</th>
                        <th>STATUS</th>
                        <th>DATE</th>
                        <th className={s.textRight}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <tr key={i} className={s.skeletonRow}>
                          <td>
                            <div className={`${s.skeletonBlock} ${s.skTitle}`} />
                            <div className={`${s.skeletonBlock} ${s.skSubtitle}`} />
                          </td>
                          <td>
                            <div className={`${s.skeletonBlock} ${s.skBatch}`} />
                          </td>
                          <td>
                            <div className={`${s.skeletonBlock} ${s.skProduct}`} />
                          </td>
                          <td>
                            <div className={`${s.skeletonBlock} ${s.skDept}`} />
                          </td>
                          <td>
                            <div className={`${s.skeletonBlock} ${s.skBadge}`} />
                          </td>
                          <td>
                            <div className={`${s.skeletonBlock} ${s.skBadge}`} />
                          </td>
                          <td>
                            <div className={`${s.skeletonBlock} ${s.skDate}`} />
                          </td>
                          <td className={s.textRight}>
                            <div className={`${s.skeletonBlock} ${s.skButton}`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : filteredHistory.length > 0 ? (
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>RECORD / TITLE</th>
                        <th>BATCH</th>
                        <th>PRODUCT</th>
                        <th>DEPARTMENT</th>
                        <th>SEVERITY</th>
                        <th>STATUS</th>
                        <th>DATE</th>
                        <th className={s.textRight}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div className={s.tableTitle}>{row.title}</div>
                            <div className={s.tableSub}>
                              Record #{row.id} · Method: {row.investigation_method || "5 Whys"}
                            </div>
                          </td>
                          <td>
                            <span className={s.codeTag}>
                              {row.batch_number || "—"}
                            </span>
                          </td>
                          <td>
                            <span className={s.tableProduct}>
                              {row.product_name || "—"}
                            </span>
                          </td>
                          <td>{row.department || "—"}</td>
                          <td>
                            <span className={`${s.badgeSeverity} ${getSeverityBadgeClass(row.severity)}`}>
                              {row.severity}
                            </span>
                          </td>
                          <td>
                            <span className={`${s.badgeStatus} ${getStatusClass(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                          <td>
                            <span className={s.tableDate}>
                              {row.created_at ? row.created_at.slice(0, 10) : "—"}
                            </span>
                          </td>
                          <td className={s.textRight}>
                            <button
                              type="button"
                              className={s.btnOpenRecord}
                              onClick={() => openRecord(row.id)}
                            >
                              <span>Open Record</span>
                              <ArrowRight size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className={s.emptyState}>
                    <FolderOpen size={44} strokeWidth={1.5} className={s.emptyIcon} />
                    <h3 className={s.emptyTitle}>No Investigation Records Found</h3>
                    <p className={s.emptyText}>
                      {history.length === 0
                        ? "No root cause investigations have been saved to the database yet."
                        : "No records match the current filter criteria."}
                    </p>
                    <button className={s.btnPrimary} onClick={newRecord}>
                      <Plus size={16} /> Create New Investigation
                    </button>
                  </div>
                )}
              </div>

              <div className={s.tableFooter}>
                <span>
                  {historyLoading
                    ? "Loading audit records..."
                    : `Showing ${filteredHistory.length} of ${history.length} records`}
                </span>
              </div>
            </section>
          </div>
            )}
          </div>

          <aside className={s.chatPanel}>
            <div className={s.chatHeader}>
              <div className={s.chatTitleWrap}>
                <div className={s.chatIcon}>
                  <FileSearch size={16} />
                </div>
                <div>
                  <h3>AI Assistant</h3>
                  <small>Context-aware review</small>
                </div>
              </div>
            </div>

            <div className={s.chatMessages}>
              {chatMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`${s.chatBubble} ${
                    message.role === "user" ? s.chatBubbleUser : s.chatBubbleAI
                  }`}
                >
                  {message.text}
                </div>
              ))}
            </div>

            <div className={s.chatComposer}>
              <textarea
                rows={4}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Describe the incident or ask for review..."
              />

              <div className={s.chatActions}>
                <label className={s.chatUploadBtn}>
                  <FileUp size={14} /> PDF
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const selected = e.target.files?.[0] || null;
                      if (selected && selected.size > MAX_UPLOAD_BYTES) {
                        e.target.value = "";
                        setChatFile(null);
                        showError("Uploaded PDF exceeds 20 MB. Please select a smaller file.");
                        return;
                      }
                      setChatFile(selected);
                    }}
                  />
                </label>

                <button type="button" className={s.chatSendBtn} onClick={sendChatMessage}>
                  Send
                </button>
              </div>

              {chatFile && (
                <div className={s.chatFilePill}>
                  <FileText size={13} />
                  <span>{chatFile.name}</span>
                  <button type="button" onClick={() => setChatFile(null)}>
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Global Toast Alert */}
        {toast && (
          <div className={s.toast}>
            <CheckCircle2 size={18} />
            <span>{toast}</span>
          </div>
        )}

        {/* Enterprise Compliance Footer */}
      
      </main>
    </div>
  );
}

// Analysis & CAPA Section Component
function AnalysisSection({ analysis, onUpdate }) {
  const causes = analysis.potential_root_causes || [];
  const actions = analysis.capa_recommendations || [];
  const missing = analysis.missing_evidence || [];

  const handleEdit = (key, index, fieldName, value) => {
    const list = [...(analysis[key] || [])];
    list[index] = { ...list[index], [fieldName]: value };
    onUpdate({ [key]: list });
  };

  return (
    <section className={s.card}>
      <div className={s.cardHeader}>
        <div>
          <span className={s.stepBadge}>STEP 03</span>
          <h2 className={s.cardTitle}>Root Cause Analysis & CAPA Formulation</h2>
          <p className={s.cardSubtitle}>
            Systematic hypothesis testing, causal breakdown, and preventive actions. Review and verify all entries before finalizing.
          </p>
        </div>
        <span className={s.pillBadge}>
          <Layers size={13} /> EVALUATION & SYNTHESIS
        </span>
      </div>

      <div className={s.cardBody}>
        {/* Executive Summary */}
        {analysis.summary && (
          <div className={s.summaryBox}>
            <div className={s.summaryHeader}>
              <Info size={16} />
              <span>INVESTIGATION EXECUTIVE SUMMARY</span>
            </div>
            <p className={s.summaryContent}>{analysis.summary}</p>
          </div>
        )}

        {/* Potential Root Causes */}
        <div className={s.analysisSection}>
          <div className={s.sectionHeader}>
            <div className={s.sectionHeaderTitle}>
              <Activity size={18} className={s.sectionIcon} />
              <h3>Root Cause Hypotheses</h3>
            </div>
            <span className={s.counterBadge}>
              {causes.length} Identified Causes
            </span>
          </div>

          <div className={s.causesList}>
            {causes.map((causeItem, idx) => (
              <div key={idx} className={s.causeCard}>
                <div className={s.causeCardHead}>
                  <div className={s.causeNumber}>Hypothesis {idx + 1}</div>
                  <div className={s.causeStatusWrapper}>
                    <span className={s.causeStatusLabel}>Review Status:</span>
                    <select
                      className={`${s.statusSelect} ${getCauseStatusClass(causeItem.status)}`}
                      value={causeItem.status || "Unverified"}
                      onChange={(e) =>
                        handleEdit("potential_root_causes", idx, "status", e.target.value)
                      }
                    >
                      <option value="Unverified">Unverified</option>
                      <option value="Evidence Required">Evidence Required</option>
                      <option value="Confirmed by reviewer">Confirmed by Reviewer</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div className={s.causeInputGroup}>
                  <label className={s.fieldLabel}>Hypothesis / Root Cause</label>
                  <input
                    type="text"
                    className={s.input}
                    value={causeItem.cause || ""}
                    onChange={(e) =>
                      handleEdit("potential_root_causes", idx, "cause", e.target.value)
                    }
                  />
                </div>

                <div className={s.causeRationaleBlock}>
                  <span className={s.rationaleLabel}>Rationale & Logic:</span>
                  <p className={s.rationaleText}>{causeItem.rationale}</p>
                </div>

                {causeItem.evidence && (
                  <div className={s.evidenceRow}>
                    <span className={s.evidenceLabel}>Supporting Evidence:</span>
                    <span className={s.evidenceText}>
                      {Array.isArray(causeItem.evidence)
                        ? causeItem.evidence.join("; ") || "Pending documentation"
                        : causeItem.evidence}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Missing Evidence / Audit Gaps */}
        {missing.length > 0 && (
          <div className={s.analysisSection}>
            <div className={s.missingEvidenceBox}>
              <div className={s.missingHeader}>
                <AlertTriangle size={18} />
                <h4>Recommended Evidence for Verification</h4>
                <span className={s.missingCount}>{missing.length} Missing Items</span>
              </div>
              <p className={s.missingDesc}>
                The following documents and records should be retrieved and attached to validate the hypotheses:
              </p>
              <ul className={s.missingList}>
                {missing.map((item, i) => (
                  <li key={i} className={s.missingItem}>
                    <span className={s.missingBullet} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 5 Whys Visual Representation */}
        {analysis.method === "5 Whys" && analysis.five_whys && (
          <div className={s.analysisSection}>
            <div className={s.sectionHeader}>
              <div className={s.sectionHeaderTitle}>
                <Activity size={18} className={s.sectionIcon} />
                <h3>5 Whys Sequential Chain</h3>
              </div>
              <span className={s.counterBadge}>Iterative Root Cause Path</span>
            </div>

            <div className={s.whysChain}>
              {analysis.five_whys.map((step, idx) => (
                <div key={idx} className={s.whyNode}>
                  <div className={s.whyBadgeCol}>
                    <span className={s.whyBadge}>{idx + 1}</span>
                    {idx < analysis.five_whys.length - 1 && (
                      <div className={s.whyLine} />
                    )}
                  </div>
                  <div className={s.whyContent}>
                    <div className={s.whyQuestion}>
                      <span className={s.whyQuestionLabel}>Why {idx + 1}:</span>
                      <span>{step.question}</span>
                    </div>
                    <div className={s.whyAnswer}>
                      <strong>Finding:</strong> {step.answer}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fishbone Diagram (Ishikawa 6M) */}
        {analysis.method === "Fishbone" && analysis.fishbone && (
          <div className={s.analysisSection}>
            <div className={s.sectionHeader}>
              <div className={s.sectionHeaderTitle}>
                <Layers size={18} className={s.sectionIcon} />
                <h3>Ishikawa Fishbone (6M Categories)</h3>
              </div>
              <span className={s.counterBadge}>Systemic Factor Analysis</span>
            </div>

            <div className={s.fishboneGrid}>
              {Object.entries(analysis.fishbone).map(([cat, factors]) => (
                <div key={cat} className={s.fishboneCard}>
                  <div className={s.fishboneCategory}>
                    <Building2 size={16} />
                    <span>{cat}</span>
                  </div>
                  <div className={s.fishboneFactors}>
                    {Array.isArray(factors) && factors.length > 0 ? (
                      factors.map((f, i) => (
                        <div key={i} className={s.factorChip}>
                          <span className={s.factorBullet} />
                          <span>{f}</span>
                        </div>
                      ))
                    ) : (
                      <span className={s.factorEmpty}>No factors flagged</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CAPA Recommendations */}
        <div className={s.analysisSection}>
          <div className={s.sectionHeader}>
            <div className={s.sectionHeaderTitle}>
              <ShieldCheck size={18} className={s.sectionIcon} />
              <h3>Corrective & Preventive Action (CAPA) Plan</h3>
            </div>
            <span className={s.counterBadge}>
              {actions.length} Recommended Actions
            </span>
          </div>

          <div className={s.capaGrid}>
            {actions.map((act, idx) => {
              const isCorrective =
                (act.type || "").toLowerCase().includes("corrective");
              return (
                <div key={idx} className={s.capaCard}>
                  <div className={s.capaCardHead}>
                    <span
                      className={`${s.capaTypePill} ${
                        isCorrective ? s.capaCorrective : s.capaPreventive
                      }`}
                    >
                      {act.type || "Action Item"}
                    </span>
                    <span className={s.capaIndex}>CAPA #{idx + 1}</span>
                  </div>

                  <div className={s.capaBody}>
                    <label className={s.fieldLabel}>Action Description</label>
                    <textarea
                      className={s.textarea}
                      rows={2}
                      value={act.action || ""}
                      onChange={(e) =>
                        handleEdit("capa_recommendations", idx, "action", e.target.value)
                      }
                    />

                    <div className={s.capaMetaRow}>
                      <div className={s.capaOwnerCol}>
                        <label className={s.fieldLabel}>Assigned Owner / Role</label>
                        <input
                          type="text"
                          className={s.input}
                          value={act.suggested_owner || ""}
                          placeholder="e.g. Production Supervisor"
                          onChange={(e) =>
                            handleEdit(
                              "capa_recommendations",
                              idx,
                              "suggested_owner",
                              e.target.value
                            )
                          }
                        />
                      </div>

                      <div className={s.capaDueCol}>
                        <label className={s.fieldLabel}>Due (Days)</label>
                        <input
                          type="number"
                          min={1}
                          className={s.input}
                          value={act.suggested_due_days || 7}
                          onChange={(e) =>
                            handleEdit(
                              "capa_recommendations",
                              idx,
                              "suggested_due_days",
                              Number(e.target.value)
                            )
                          }
                        />
                      </div>
                    </div>

                    {act.rationale && (
                      <div className={s.capaRationale}>
                        <span className={s.rationaleLabel}>Remediation Target:</span>
                        <p>{act.rationale}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Regulatory Disclaimer Notice */}
        {analysis.limitations && (
          <div className={s.regulatoryNotice}>
            <ShieldAlert size={18} />
            <div>
              <strong>Compliance Notice:</strong>{" "}
              {Array.isArray(analysis.limitations)
                ? analysis.limitations.join(" ")
                : analysis.limitations}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// Helpers for semantic styling classes
function getSeverityBadgeClass(sev) {
  switch ((sev || "").toLowerCase()) {
    case "critical":
      return s.sevCritical;
    case "high":
      return s.sevHigh;
    case "medium":
      return s.sevMedium;
    case "low":
    default:
      return s.sevLow;
  }
}

function getSeveritySelectClass(sev) {
  switch ((sev || "").toLowerCase()) {
    case "critical":
      return s.selectCritical;
    case "high":
      return s.selectHigh;
    case "medium":
      return s.selectMedium;
    default:
      return "";
  }
}

function getStatusClass(status) {
  switch ((status || "").toLowerCase()) {
    case "approved":
    case "closed":
      return s.statusApproved;
    case "under investigation":
      return s.statusActive;
    case "pending review":
      return s.statusPending;
    case "draft":
    default:
      return s.statusDraft;
  }
}

function getCauseStatusClass(status) {
  switch ((status || "").toLowerCase()) {
    case "confirmed by reviewer":
      return s.causeConfirmed;
    case "evidence required":
      return s.causeEvidenceReq;
    case "rejected":
      return s.causeRejected;
    case "unverified":
    default:
      return s.causeUnverified;
  }
}
