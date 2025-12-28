import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, rtdb, functions } from "../firebase/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { ref, get, query, orderByChild, equalTo, onValue, update } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler } from "chart.js";
import { Pie, Bar, Doughnut, Line } from "react-chartjs-2";
import "./ManagerDashboard.css";

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

/* ===============================
   WORKFLOW STAGES
=============================== */
const WORKFLOW_STAGES = [
  { key: "submitted", label: "Submitted", icon: "📥" },
  { key: "analyzed", label: "Analyzed", icon: "🤖" },
  { key: "assigned", label: "Assigned", icon: "👤" },
  { key: "in-progress", label: "In Progress", icon: "⚙️" },
  { key: "resolved", label: "Resolved", icon: "✅" },
];

function ManagerDashboard() {
  const navigate = useNavigate();

  const [managerData, setManagerData] = useState(null);
  const [orgName, setOrgName] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyzingIds, setAnalyzingIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState("overview");
  const [filter, setFilter] = useState("all");

  /* ===============================
     RE-ANALYZE COMPLAINT FUNCTION
  =============================== */
  const handleReanalyze = async (complaintId) => {
    setAnalyzingIds((prev) => new Set([...prev, complaintId]));
    setError(null); // Clear previous errors

    try {
      const reanalyzeComplaint = httpsCallable(functions, "reanalyzeComplaint");
      const result = await reanalyzeComplaint({ complaintId });
      console.log("✅ Re-analysis successful:", result.data);
      
      // Clear error on success
      setError(null);
    } catch (error) {
      console.error("Re-analysis failed:", error);
      const errorMessage = error.message || error.details || "Unknown error occurred";
      setError("Failed to analyze complaint: " + errorMessage);
    } finally {
      setAnalyzingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(complaintId);
        return newSet;
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  /* ===============================
     UPDATE COMPLAINT STATUS
  =============================== */
  const handleStatusUpdate = async (complaintId, newStatus) => {
    if (!managerData?.orgId) {
      setError("No organization found");
      return;
    }
    
    try {
      // Clear any previous error
      setError(null);
      
      const complaintRef = ref(rtdb, `complaints/${complaintId}`);
      const updates = {
        workflowStatus: newStatus,
        lastUpdated: new Date().toISOString(),
      };
      
      // Add to status history
      updates[`statusHistory/${newStatus}`] = new Date().toISOString();
      
      // If resolved, also update the main status
      if (newStatus === "resolved") {
        updates.status = "resolved";
      }
      
      await update(complaintRef, updates);
      console.log("Status updated to:", newStatus);
    } catch (error) {
      console.error("Status update failed:", error);
      setError("Failed to update status: " + error.message);
    }
  };

  /* ===============================
     GET CURRENT STAGE INDEX
  =============================== */
  const getStageIndex = (status) => {
    const index = WORKFLOW_STAGES.findIndex((s) => s.key === status);
    return index >= 0 ? index : 0;
  };

  /* ===============================
     GET EFFECTIVE WORKFLOW STATUS
  =============================== */
  const getEffectiveStatus = (complaint) => {
    // If already has workflowStatus, use it
    if (complaint.workflowStatus) {
      return complaint.workflowStatus;
    }
    // If has AI analysis, at least "analyzed"
    if (complaint.aiAnalysis) {
      return "analyzed";
    }
    // Default to submitted
    return "submitted";
  };

  /* ===============================
     CALCULATE AI INSIGHTS
  =============================== */
  const calculateInsights = () => {
    const stageDelays = {};
    let bottleneckStage = null;
    let maxDelay = 0;

    complaints.forEach((c) => {
      if (c.statusHistory) {
        const history = c.statusHistory;
        WORKFLOW_STAGES.forEach((stage, idx) => {
          if (idx > 0 && history[stage.key] && history[WORKFLOW_STAGES[idx - 1].key]) {
            const prev = new Date(history[WORKFLOW_STAGES[idx - 1].key]);
            const curr = new Date(history[stage.key]);
            const delay = (curr - prev) / (1000 * 60 * 60); // hours
            
            if (!stageDelays[stage.key]) stageDelays[stage.key] = [];
            stageDelays[stage.key].push(delay);
          }
        });
      }
    });

    // Find average delays and bottleneck
    const avgDelays = {};
    Object.keys(stageDelays).forEach((key) => {
      const avg = stageDelays[key].reduce((a, b) => a + b, 0) / stageDelays[key].length;
      avgDelays[key] = avg;
      if (avg > maxDelay) {
        maxDelay = avg;
        bottleneckStage = key;
      }
    });

    // Count stuck complaints (using effective status)
    const stuckComplaints = complaints.filter((c) => {
      const effectiveStatus = getEffectiveStatus(c);
      if (effectiveStatus === "resolved") return false;
      const lastUpdate = c.lastUpdated ? new Date(c.lastUpdated) : new Date(c.createdAt);
      const hoursStuck = (new Date() - lastUpdate) / (1000 * 60 * 60);
      return hoursStuck > 24; // Stuck for more than 24 hours
    }).length;

    // Count resolved using effective status
    const resolvedCount = complaints.filter((c) => getEffectiveStatus(c) === "resolved").length;

    return { avgDelays, bottleneckStage, stuckComplaints, maxDelay, resolvedCount };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false); // ✅ FIX 1
        navigate("/login");
        return;
      }
      try {
        const userRef = ref(rtdb, `users/${user.uid}`);
        const snap = await get(userRef);
        if (!snap.exists()) {
          setError("User data not found");
          setLoading(false);
          return;
        }
        const userData = snap.val();
        setManagerData(userData);
        // ✅ FIX 2: role guard
        if (userData.role !== "manager") {
          setError("Access denied: Not a manager");
          setLoading(false);
          return;
        }
        // Get organization name
        if (userData.orgId) {
          const orgRef = ref(rtdb, `organizations/${userData.orgId}`);
          const orgSnap = await get(orgRef);
          if (orgSnap.exists()) {
            setOrgName(orgSnap.val().name || userData.orgId);
          }
          // Realtime complaints listener
          const complaintsQuery = query(
            ref(rtdb, "complaints"),
            orderByChild("orgId"),
            equalTo(userData.orgId)
          );
          // 🔄 Realtime complaints listener (UPDATED – SAFE VERSION)
          onValue(
            complaintsQuery,
            (snapshot) => {
              if (snapshot.exists()) {
                const list = Object.entries(snapshot.val()).map(([id, data]) => ({
                  id,
                  ...data,
                }));
                // 🔧 Sort by newest first
                list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setComplaints(list);
              } else {
                setComplaints([]); // ✅ No data is NOT an error
              }
              setLoading(false); // ✅ ALWAYS stop loading
            },
            (error) => {
              console.error("Complaints listener error:", error);
              setError(error.message);
              setLoading(false); // ✅ STOP loading even on error
            }
          );
        } else {
          setError("No organization assigned");
          setLoading(false); // ✅ REQUIRED
        }
      } catch (error) {
        setError("Failed to load user data: " + (error.message || "Unknown error"));
        setLoading(false);
      }
    });
    // Cleanup function for the listener
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);


  /* ===============================
     STATS CALCULATION
  =============================== */
  const stats = {
    total: complaints.length,
    pending: complaints.filter((c) => getEffectiveStatus(c) !== "resolved").length,
    resolved: complaints.filter((c) => getEffectiveStatus(c) === "resolved").length,
    critical: complaints.filter((c) => c.aiAnalysis?.priority?.toLowerCase() === "critical").length,
  };

  /* ===============================
     FILTER COMPLAINTS
  =============================== */
  const filteredComplaints = complaints.filter((c) => {
    if (filter === "all") return true;
    if (filter === "pending") return getEffectiveStatus(c) !== "resolved";
    if (filter === "resolved") return getEffectiveStatus(c) === "resolved";
    return true;
  });

  /* ===============================
     HELPER FUNCTIONS
  =============================== */
  const getPriorityClass = (priority) => {
    const p = priority?.toLowerCase() || "unknown";
    if (["critical", "high", "medium", "low"].includes(p)) {
      return `badge-priority-${p}`;
    }
    return "badge-priority-medium";
  };

  const getEmotionClass = (emotion) => {
    const e = emotion?.toLowerCase() || "unknown";
    return `emotion-${e}`;
  };

  const formatDate = (date) => {
    if (!date) return "No date";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /* ===============================
     LOADING STATE
  =============================== */
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading dashboard...</p>
      </div>
    );
  }

  /* ===============================
     RENDER
  =============================== */
  return (
    <div className="manager">
      {/* NAVBAR */}
      <nav className="manager-navbar">
        <div className="navbar-left">
          <div className="navbar-logo">🛡️</div>
          <span className="navbar-title">Complaint Manager</span>
          {orgName && (
            <div className="navbar-org">
              <span>🏢</span>
              <span>{orgName}</span>
            </div>
          )}
        </div>

        <div className="navbar-center">
          <button
            className={`nav-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <span>📊</span> Overview
          </button>
          <button
            className={`nav-tab ${activeTab === "complaints" ? "active" : ""}`}
            onClick={() => setActiveTab("complaints")}
          >
            <span>📝</span> Complaints
          </button>
          <button
            className={`nav-tab ${activeTab === "analytics" ? "active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            <span>📈</span> Analytics
          </button>
        </div>

        <div className="navbar-right">
          <div className="user-profile">
            <div className="user-avatar">👤</div>
            <div className="user-info">
              <span className="user-name">{managerData?.name || "Manager"}</span>
              <span className="user-role">Manager</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <span>🚪</span> Logout
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="manager-content">
        {error && (
          <div className="error-banner">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* STATS ROW */}
        <div className="stats-row">
          <div className="stat-box total">
            <div className="stat-icon">📋</div>
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">Total Complaints</div>
          </div>
          <div className="stat-box pending">
            <div className="stat-icon">⏳</div>
            <div className="stat-number">{stats.pending}</div>
            <div className="stat-label">Pending Analysis</div>
          </div>
          <div className="stat-box resolved">
            <div className="stat-icon">✅</div>
            <div className="stat-number">{stats.resolved}</div>
            <div className="stat-label">Resolved</div>
          </div>
          <div className="stat-box critical">
            <div className="stat-icon">🔥</div>
            <div className="stat-number">{stats.critical}</div>
            <div className="stat-label">Critical Issues</div>
          </div>
        </div>

        {/* AI INSIGHTS PANEL */}
        {complaints.length > 0 && (() => {
          const insights = calculateInsights();
          return (
            <div className="ai-insights-panel">
              <div className="insights-header">
                <div className="insights-icon">🧠</div>
                <h3 className="insights-title">AI Workflow Insights</h3>
              </div>
              <div className="insights-grid">
                <div className="insight-card">
                  <span className="insight-emoji">⚡</span>
                  <div className="insight-content">
                    <span className="insight-label">Bottleneck Stage</span>
                    <span className="insight-value highlight-red">
                      {insights.bottleneckStage 
                        ? WORKFLOW_STAGES.find(s => s.key === insights.bottleneckStage)?.label 
                        : "None detected"}
                    </span>
                  </div>
                </div>
                <div className="insight-card">
                  <span className="insight-emoji">⏱️</span>
                  <div className="insight-content">
                    <span className="insight-label">Avg Delay at Bottleneck</span>
                    <span className="insight-value">
                      {insights.maxDelay > 0 ? `${insights.maxDelay.toFixed(1)} hrs` : "N/A"}
                    </span>
                  </div>
                </div>
                <div className="insight-card">
                  <span className="insight-emoji">🚨</span>
                  <div className="insight-content">
                    <span className="insight-label">Stuck Complaints (24h+)</span>
                    <span className={`insight-value ${insights.stuckComplaints > 0 ? "highlight-red" : "highlight-green"}`}>
                      {insights.stuckComplaints}
                    </span>
                  </div>
                </div>
                <div className="insight-card">
                  <span className="insight-emoji">📈</span>
                  <div className="insight-content">
                    <span className="insight-label">Resolution Rate</span>
                    <span className="insight-value highlight-green">
                      {complaints.length > 0 
                        ? `${Math.round((insights.resolvedCount / complaints.length) * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB CONTENT */}
        {activeTab === "overview" && (
          <>
            {/* SUMMARY TABLE */}
            <div className="section-header">
              <h2 className="section-title">
                <span>📊</span>
                Complaints Overview
                <span className="section-badge">{complaints.length}</span>
              </h2>
            </div>

            {complaints.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3 className="empty-title">No complaints found</h3>
                <p className="empty-text">Your organization hasn't received any complaints yet.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="complaints-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Priority</th>
                      <th>Emotion</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaints.slice(0, 10).map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="table-user">
                            <span className="table-avatar">👤</span>
                            {c.userName || "Unknown"}
                          </div>
                        </td>
                        <td className="table-title">{c.title || "Untitled"}</td>
                        <td>
                          <span className="table-category">
                            {c.aiAnalysis?.category || "—"}
                          </span>
                        </td>
                        <td>
                          {c.aiAnalysis?.priority ? (
                            <span className={`table-badge ${getPriorityClass(c.aiAnalysis.priority)}`}>
                              {c.aiAnalysis.priority}
                            </span>
                          ) : (
                            <span className="table-badge badge-pending">Pending</span>
                          )}
                        </td>
                        <td>
                          {c.aiAnalysis?.emotion ? (
                            <span className={`table-emotion ${getEmotionClass(c.aiAnalysis.emotion)}`}>
                              {c.aiAnalysis.emotion}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <span className={`table-status ${c.status === "open" ? "status-open" : "status-resolved"}`}>
                            {c.status?.toUpperCase() || "OPEN"}
                          </span>
                        </td>
                        <td className="table-date">{formatDate(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* RECENT COMPLAINTS CARDS */}
            {complaints.length > 0 && (
              <>
                <div className="section-header" style={{ marginTop: "40px" }}>
                  <h2 className="section-title">
                    <span>📝</span>
                    Recent Complaints
                    <span className="section-badge">{Math.min(5, complaints.length)}</span>
                  </h2>
                </div>

                <div className="complaints-grid">
                  {complaints.slice(0, 5).map((complaint) => (
                    <div key={complaint.id} className="complaint-card">
                      <div className="complaint-header">
                        <div className="complaint-title-group">
                          <h3 className="complaint-title">{complaint.title || "Untitled Complaint"}</h3>
                          <div className="complaint-meta">
                            <span className="meta-item">
                              <span>👤</span>
                              {complaint.userName || "Unknown User"}
                            </span>
                            <span className="meta-item">
                              <span>📅</span>
                              {formatDate(complaint.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="complaint-badges">
                          <span className={`badge badge-status-${complaint.status === "open" ? "open" : "resolved"}`}>
                            {complaint.status?.toUpperCase() || "OPEN"}
                          </span>
                          {complaint.aiAnalysis?.priority && (
                            <span className={`badge ${getPriorityClass(complaint.aiAnalysis.priority)}`}>
                              {complaint.aiAnalysis.priority}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="complaint-body">
                        <p className="complaint-description">{complaint.description || "No description provided"}</p>

                        {complaint.aiAnalysis ? (
                          <div className="ai-analysis">
                            <div className="ai-header">
                              <div className="ai-icon">🤖</div>
                              <span className="ai-title">AI Analysis</span>
                            </div>
                            <p className="ai-summary">{complaint.aiAnalysis.summary}</p>
                            <div className="ai-tags">
                              {complaint.aiAnalysis.emotion && (
                                <span className={`ai-tag ${getEmotionClass(complaint.aiAnalysis.emotion)}`}>
                                  😊 {complaint.aiAnalysis.emotion}
                                </span>
                              )}
                              {complaint.aiAnalysis.category && (
                                <span className="ai-tag category">📁 {complaint.aiAnalysis.category}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="no-analysis">
                            <span className="no-analysis-text">This complaint hasn't been analyzed yet</span>
                            <button
                              onClick={() => handleReanalyze(complaint.id)}
                              disabled={analyzingIds.has(complaint.id)}
                              className="analyze-btn"
                            >
                              {analyzingIds.has(complaint.id) ? <>⏳ Analyzing...</> : <>🔄 Analyze Now</>}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* WORKFLOW PIPELINE */}
                      <div className="workflow-pipeline">
                        <div className="pipeline-header">
                          <span className="pipeline-title">📋 Workflow Status</span>
                          <span className="pipeline-hint">Click to update status</span>
                        </div>
                        <div className="pipeline-stages">
                          {WORKFLOW_STAGES.map((stage, idx) => {
                            const effectiveStatus = getEffectiveStatus(complaint);
                            const currentIdx = getStageIndex(effectiveStatus);
                            const isCompleted = idx < currentIdx;
                            const isCurrent = idx === currentIdx;
                            const isClickable = idx <= currentIdx + 1 && idx > 0;

                            return (
                              <div key={stage.key} className="pipeline-stage-wrapper">
                                <button
                                  className={`pipeline-stage ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""} ${isClickable ? "clickable" : ""}`}
                                  onClick={() => isClickable && handleStatusUpdate(complaint.id, stage.key)}
                                  disabled={!isClickable}
                                  title={isClickable ? `Mark as ${stage.label}` : "Complete previous stages first"}
                                >
                                  <span className="stage-icon">{stage.icon}</span>
                                  <span className="stage-label">{stage.label}</span>
                                </button>
                                {idx < WORKFLOW_STAGES.length - 1 && (
                                  <div className={`pipeline-connector ${isCompleted ? "completed" : ""}`}></div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "complaints" && (
          <>
            <div className="section-header">
              <h2 className="section-title">
                <span>📝</span>
                Recent Complaints
                <span className="section-badge">{filteredComplaints.length}</span>
              </h2>
              <div className="filter-group">
                <button
                  className={`filter-btn ${filter === "all" ? "active" : ""}`}
                  onClick={() => setFilter("all")}
                >
                  All
                </button>
                <button
                  className={`filter-btn ${filter === "pending" ? "active" : ""}`}
                  onClick={() => setFilter("pending")}
                >
                  Pending
                </button>
                <button
                  className={`filter-btn ${filter === "resolved" ? "active" : ""}`}
                  onClick={() => setFilter("resolved")}
                >
                  Resolved
                </button>
              </div>
            </div>

            {filteredComplaints.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3 className="empty-title">No complaints found</h3>
                <p className="empty-text">
                  {filter === "all"
                    ? "Your organization hasn't received any complaints yet."
                    : `No ${filter} complaints at the moment.`}
                </p>
              </div>
            ) : (
              <div className="complaints-grid">
                {filteredComplaints.map((complaint) => (
                  <div key={complaint.id} className="complaint-card">
                    <div className="complaint-header">
                      <div className="complaint-title-group">
                        <h3 className="complaint-title">{complaint.title || "Untitled Complaint"}</h3>
                        <div className="complaint-meta">
                          <span className="meta-item">
                            <span>👤</span>
                            {complaint.userName || "Unknown User"}
                          </span>
                          <span className="meta-item">
                            <span>📅</span>
                            {formatDate(complaint.createdAt)}
                          </span>
                          <span className="meta-item">
                            <span>🔖</span>
                            ID: {complaint.id.slice(-6)}
                          </span>
                        </div>
                      </div>
                      <div className="complaint-badges">
                        <span className={`badge badge-status-${complaint.status === "open" ? "open" : "resolved"}`}>
                          {complaint.status?.toUpperCase() || "OPEN"}
                        </span>
                        {complaint.aiAnalysis?.priority && (
                          <span className={`badge ${getPriorityClass(complaint.aiAnalysis.priority)}`}>
                            {complaint.aiAnalysis.priority}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="complaint-body">
                      <p className="complaint-description">{complaint.description || "No description provided"}</p>

                      {complaint.aiAnalysis ? (
                        <div className="ai-analysis">
                          <div className="ai-header">
                            <div className="ai-icon">🤖</div>
                            <span className="ai-title">AI Analysis</span>
                          </div>
                          <p className="ai-summary">{complaint.aiAnalysis.summary}</p>
                          <div className="ai-tags">
                            {complaint.aiAnalysis.emotion && (
                              <span className={`ai-tag ${getEmotionClass(complaint.aiAnalysis.emotion)}`}>
                                😊 {complaint.aiAnalysis.emotion}
                              </span>
                            )}
                            {complaint.aiAnalysis.category && (
                              <span className="ai-tag category">📁 {complaint.aiAnalysis.category}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="no-analysis">
                          <span className="no-analysis-text">This complaint hasn't been analyzed yet</span>
                          <button
                            onClick={() => handleReanalyze(complaint.id)}
                            disabled={analyzingIds.has(complaint.id)}
                            className="analyze-btn"
                          >
                            {analyzingIds.has(complaint.id) ? <>⏳ Analyzing...</> : <>🔄 Analyze Now</>}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* WORKFLOW PIPELINE */}
                    <div className="workflow-pipeline">
                      <div className="pipeline-header">
                        <span className="pipeline-title">📋 Workflow Status</span>
                        <span className="pipeline-hint">Click to update status</span>
                      </div>
                      <div className="pipeline-stages">
                        {WORKFLOW_STAGES.map((stage, idx) => {
                          const effectiveStatus = getEffectiveStatus(complaint);
                          const currentIdx = getStageIndex(effectiveStatus);
                          const isCompleted = idx < currentIdx;
                          const isCurrent = idx === currentIdx;
                          const isClickable = idx <= currentIdx + 1 && idx > 0;

                          return (
                            <div key={stage.key} className="pipeline-stage-wrapper">
                              <button
                                className={`pipeline-stage ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""} ${isClickable ? "clickable" : ""}`}
                                onClick={() => isClickable && handleStatusUpdate(complaint.id, stage.key)}
                                disabled={!isClickable}
                                title={isClickable ? `Mark as ${stage.label}` : "Complete previous stages first"}
                              >
                                <span className="stage-icon">{stage.icon}</span>
                                <span className="stage-label">{stage.label}</span>
                              </button>
                              {idx < WORKFLOW_STAGES.length - 1 && (
                                <div className={`pipeline-connector ${isCompleted ? "completed" : ""}`}></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "analytics" && (
          <div className="analytics-container">
            {/* PRIORITY DISTRIBUTION */}
            <div className="chart-row">
              <div className="chart-card">
                <h3 className="chart-title">🚨 Priority Distribution</h3>
                <div className="chart-wrapper">
                  <Doughnut
                    data={{
                      labels: ["Critical", "High", "Medium", "Low"],
                      datasets: [{
                        data: [
                          complaints.filter(c => c.aiAnalysis?.priority?.toLowerCase() === "critical").length,
                          complaints.filter(c => c.aiAnalysis?.priority?.toLowerCase() === "high").length,
                          complaints.filter(c => c.aiAnalysis?.priority?.toLowerCase() === "medium").length,
                          complaints.filter(c => c.aiAnalysis?.priority?.toLowerCase() === "low").length,
                        ],
                        backgroundColor: ["#ef4444", "#f97316", "#eab308", "#22c55e"],
                        borderColor: "#1e293b",
                        borderWidth: 3,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: "bottom", labels: { color: "#94a3b8", padding: 15 } },
                      },
                    }}
                  />
                </div>
              </div>

              <div className="chart-card">
                <h3 className="chart-title">😊 Emotion Breakdown</h3>
                <div className="chart-wrapper">
                  <Pie
                    data={{
                      labels: ["Angry", "Frustrated", "Calm", "Distressed", "Other"],
                      datasets: [{
                        data: [
                          complaints.filter(c => c.aiAnalysis?.emotion?.toLowerCase() === "angry").length,
                          complaints.filter(c => c.aiAnalysis?.emotion?.toLowerCase() === "frustrated").length,
                          complaints.filter(c => c.aiAnalysis?.emotion?.toLowerCase() === "calm").length,
                          complaints.filter(c => c.aiAnalysis?.emotion?.toLowerCase() === "distressed").length,
                          complaints.filter(c => !c.aiAnalysis?.emotion || !["angry", "frustrated", "calm", "distressed"].includes(c.aiAnalysis?.emotion?.toLowerCase())).length,
                        ],
                        backgroundColor: ["#ef4444", "#f97316", "#22c55e", "#8b5cf6", "#64748b"],
                        borderColor: "#1e293b",
                        borderWidth: 3,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: "bottom", labels: { color: "#94a3b8", padding: 15 } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            {/* WORKFLOW STATUS & CATEGORY */}
            <div className="chart-row">
              <div className="chart-card">
                <h3 className="chart-title">📊 Workflow Status</h3>
                <div className="chart-wrapper">
                  <Bar
                    data={{
                      labels: ["Submitted", "Analyzed", "Assigned", "In Progress", "Resolved"],
                      datasets: [{
                        label: "Complaints",
                        data: [
                          complaints.filter(c => getEffectiveStatus(c) === "submitted").length,
                          complaints.filter(c => getEffectiveStatus(c) === "analyzed").length,
                          complaints.filter(c => getEffectiveStatus(c) === "assigned").length,
                          complaints.filter(c => getEffectiveStatus(c) === "in-progress").length,
                          complaints.filter(c => getEffectiveStatus(c) === "resolved").length,
                        ],
                        backgroundColor: ["#64748b", "#0ea5e9", "#8b5cf6", "#f59e0b", "#22c55e"],
                        borderRadius: 8,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                      },
                      scales: {
                        x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
                        y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true },
                      },
                    }}
                  />
                </div>
              </div>

              <div className="chart-card">
                <h3 className="chart-title">📁 Categories</h3>
                <div className="chart-wrapper">
                  <Bar
                    data={{
                      labels: [...new Set(complaints.map(c => c.aiAnalysis?.category || "Uncategorized"))].slice(0, 6),
                      datasets: [{
                        label: "Complaints",
                        data: [...new Set(complaints.map(c => c.aiAnalysis?.category || "Uncategorized"))].slice(0, 6).map(
                          cat => complaints.filter(c => (c.aiAnalysis?.category || "Uncategorized") === cat).length
                        ),
                        backgroundColor: "#0ea5e9",
                        borderRadius: 8,
                      }],
                    }}
                    options={{
                      indexAxis: "y",
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                      },
                      scales: {
                        x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true },
                        y: { ticks: { color: "#94a3b8" }, grid: { display: false } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            {/* COMPLAINTS TREND */}
            <div className="chart-row full-width">
              <div className="chart-card">
                <h3 className="chart-title">📈 Complaints Trend (Last 7 Days)</h3>
                <div className="chart-wrapper-wide">
                  <Line
                    data={(() => {
                      const last7Days = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      });
                      const counts = last7Days.map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
                        return complaints.filter(c => {
                          const created = new Date(c.createdAt);
                          return created >= dayStart && created < dayEnd;
                        }).length;
                      });
                      return {
                        labels: last7Days,
                        datasets: [{
                          label: "New Complaints",
                          data: counts,
                          borderColor: "#0ea5e9",
                          backgroundColor: "rgba(14, 165, 233, 0.1)",
                          fill: true,
                          tension: 0.4,
                          pointBackgroundColor: "#0ea5e9",
                          pointBorderColor: "#fff",
                          pointBorderWidth: 2,
                          pointRadius: 5,
                        }],
                      };
                    })()}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                      },
                      scales: {
                        x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
                        y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ManagerDashboard;
      
