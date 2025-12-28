import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, rtdb } from "../firebase/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  ref,
  push,
  onValue,
  get,
  update,
} from "firebase/database";

import {
  Chart as ChartJS,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";

import "./AdminDashboard.css";

ChartJS.register(
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

function AdminDashboard() {
    // Error banner UI
    const renderDbErrorBanner = () => dbError ? (
      <div style={{background:'#fee',color:'#b00',padding:'12px',marginBottom:'16px',border:'1px solid #b00',borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'space-between',zIndex:1000}}>
        <span><b>Database Error:</b> {dbError}</span>
        <button style={{marginLeft:'16px',padding:'6px 12px',background:'#b00',color:'#fff',border:'none',borderRadius:'4px',cursor:'pointer'}} onClick={fetchOnce}>Retry</button>
      </div>
    ) : null;
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [dbError, setDbError] = useState(null);

  const [orgName, setOrgName] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);

  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedManager, setSelectedManager] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  /* ===============================
     AUTH + ROLE CHECK
  =============================== */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }
      // ...existing code...
    });
    return () => unsub();
  }, [navigate]);

  /* ===============================
     REALTIME DATA
  =============================== */
  useEffect(() => {
    const orgsRef = ref(rtdb, "organizations");
    const usersRef = ref(rtdb, "users");
    const complaintsRef = ref(rtdb, "complaints");
    const auditLogsRef = ref(rtdb, "auditLogs");

    const unsubOrgs = onValue(
      orgsRef,
      (s) => {
        const orgData = s.exists() ? Object.entries(s.val()).map(([id, v]) => ({ id, ...v })) : [];
        console.log("Organizations data:", orgData);
        setOrgs(orgData);
        setDbError(null);
      },
      (err) => {
        console.error("Failed to read organizations:", err);
        setDbError(err.message || String(err));
      }
    );

    const unsubUsers = onValue(
      usersRef,
      (s) => {
        const userData = s.exists() ? Object.entries(s.val()).map(([id, v]) => ({ id, ...v })) : [];
        console.log("Users data:", userData);
        setUsers(userData);
        setDbError(null);
      },
      (err) => {
        console.error("Failed to read users:", err);
        setDbError(err.message || String(err));
      }
    );

    const unsubComplaints = onValue(
      complaintsRef,
      (s) => {
        const data = s.exists() ? Object.entries(s.val()).map(([id, v]) => ({ id, ...v })) : [];
        setComplaints(data);
        setDbError(null);
      },
      (err) => {
        console.error("Failed to read complaints:", err);
        setDbError(err.message || String(err));
      }
    );

    const unsubAuditLogs = onValue(
      auditLogsRef,
      (s) => {
        console.log("Audit logs data:", s.exists() ? s.val() : "No audit logs");
        const logs = s.exists()
          ? Object.entries(s.val()).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          : [];
        setAuditLogs(logs);
        setDbError(null);
      },
      (err) => {
        console.error("Failed to read audit logs:", err);
        setDbError(err.message || String(err));
      }
    );

    // Cleanup subscriptions on unmount
    return () => {
      unsubOrgs();
      unsubUsers();
      unsubComplaints();
      unsubAuditLogs();
    };
  }, []);

  // One-time fetch fallback for manual retry
  const fetchOnce = async () => {
    try {
      setDbError(null);
      const usersSnap = await get(ref(rtdb, "users"));
      if (usersSnap.exists()) {
        const userData = Object.entries(usersSnap.val()).map(([id, v]) => ({ id, ...v }));
        console.log("Fetched users once:", userData);
        setUsers(userData);
      }

      const auditSnap = await get(ref(rtdb, "auditLogs"));
      if (auditSnap.exists()) {
        const logs = Object.entries(auditSnap.val()).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        console.log("Fetched audit logs once:", logs);
        setAuditLogs(logs);
      }
    } catch (err) {
      console.error("One-time fetch failed:", err);
      setDbError(err.message || String(err));
    }
  };

  /* ===============================
     AUDIT LOG HELPER
  =============================== */
  const logAdminAction = async (action) => {
    try {
      await push(ref(rtdb, "auditLogs"), {
        action,
        adminId: auth.currentUser?.uid || null,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.warn("Failed to log admin action:", err);
      // don't block main flow if audit logging fails
    }
  };

  /* ===============================
     CREATE ORG
  =============================== */
  const createOrganization = async () => {
    if (creatingOrg) return; // 🛑 HARD BLOCK
    if (!orgName || !emailDomain) {
      alert("Fill all fields");
      return;
    }

    setCreatingOrg(true);

    try {
      await push(ref(rtdb, "organizations"), {
        name: orgName.trim(),
        emailDomain: emailDomain.trim().toLowerCase(),
        createdAt: Date.now(),
      });

      await logAdminAction(`Created organization ${orgName}`);

      setOrgName("");
      setEmailDomain("");
    } catch (err) {
      console.error("Create organization failed:", err);
      alert("Failed to create organization: " + err.message);
    } finally {
      setCreatingOrg(false);
    }
  };

  /* ===============================
     ASSIGN MANAGER
  =============================== */
  const assignManager = async () => {
    if (!selectedOrg || !selectedManager) {
      return alert("Please select both organization and user");
    }

    try {
      await update(ref(rtdb, `users/${selectedManager}`), {
        orgId: selectedOrg,
        role: "manager",
      });

      const orgName = orgs.find(o => o.id === selectedOrg)?.name || selectedOrg;
      const userEmail = users.find(u => u.id === selectedManager)?.email || selectedManager;

      await logAdminAction(`Assigned ${userEmail} as manager of ${orgName}`);
      
      alert(`Successfully assigned ${userEmail} as manager of ${orgName}`);
      
      // Reset selections
      setSelectedOrg("");
      setSelectedManager("");
    } catch (error) {
      console.error("Error assigning manager:", error);
      alert("Failed to assign manager. Please try again.");
    }
  };

  /* ===============================
     DATA FOR CHARTS
  =============================== */
  const complaintsByOrg = orgs.map(
    (o) =>
      complaints.filter((c) => c.orgId === o.id).length
  );

  const priorityData = {};
  complaints.forEach((c) => {
    const p = c.aiAnalysis?.priority;
    if (p) priorityData[p] = (priorityData[p] || 0) + 1;
  });

  const complaintsByDay = {};
  complaints.forEach((c) => {
    const day = new Date(c.createdAt || 0).toDateString();
    complaintsByDay[day] =
      (complaintsByDay[day] || 0) + 1;
  });

  /* ===============================
     COMMON INSIGHTS - Pattern Detection
  =============================== */
  const generateCommonInsights = () => {
    const insights = [];
    
    // Category patterns across organizations
    const categoryByOrg = {};
    complaints.forEach(c => {
      const category = c.aiAnalysis?.category || 'General';
      const orgId = c.orgId;
      if (!categoryByOrg[category]) categoryByOrg[category] = new Set();
      categoryByOrg[category].add(orgId);
    });
    
    Object.entries(categoryByOrg).forEach(([category, orgSet]) => {
      if (orgSet.size >= 2) {
        insights.push({
          type: 'pattern',
          icon: '🔍',
          title: `${category} issues are common across ${orgSet.size} organizations`,
          description: `Multiple institutions reporting similar ${category.toLowerCase()} concerns`,
          severity: orgSet.size >= 3 ? 'high' : 'medium'
        });
      }
    });
    
    // Time-based patterns
    const monthlyComplaints = {};
    complaints.forEach(c => {
      const month = new Date(c.createdAt).toLocaleString('default', { month: 'long' });
      const category = c.aiAnalysis?.category || 'General';
      const key = `${month}-${category}`;
      monthlyComplaints[key] = (monthlyComplaints[key] || 0) + 1;
    });
    
    Object.entries(monthlyComplaints).forEach(([key, count]) => {
      if (count >= 3) {
        const [month, category] = key.split('-');
        insights.push({
          type: 'spike',
          icon: '📈',
          title: `${category} complaints spike in ${month}`,
          description: `${count} complaints recorded - consider proactive measures`,
          severity: count >= 5 ? 'high' : 'medium'
        });
      }
    });
    
    // High priority trend
    const criticalCount = complaints.filter(c => 
      c.aiAnalysis?.priority === 'Critical' || c.aiAnalysis?.priority === 'High'
    ).length;
    
    if (criticalCount > 0) {
      const percentage = ((criticalCount / complaints.length) * 100).toFixed(0);
      insights.push({
        type: 'alert',
        icon: '⚠️',
        title: `${percentage}% of complaints are high priority`,
        description: `${criticalCount} complaints require immediate attention`,
        severity: percentage > 30 ? 'high' : 'medium'
      });
    }
    
    // Emotion patterns
    const negativeEmotions = complaints.filter(c => 
      ['Frustrated', 'Angry', 'Upset', 'Disappointed'].includes(c.aiAnalysis?.emotion)
    ).length;
    
    if (negativeEmotions >= 3) {
      insights.push({
        type: 'emotion',
        icon: '😤',
        title: `${negativeEmotions} complaints show negative sentiment`,
        description: 'Customer satisfaction may need attention',
        severity: negativeEmotions >= 5 ? 'high' : 'medium'
      });
    }
    
    // Unassigned complaints
    const unassigned = complaints.filter(c => !c.assignedManagerId && c.status !== 'resolved').length;
    if (unassigned > 0) {
      insights.push({
        type: 'action',
        icon: '📋',
        title: `${unassigned} complaints pending assignment`,
        description: 'These complaints need manager assignment',
        severity: unassigned >= 5 ? 'high' : 'low'
      });
    }
    
    return insights.slice(0, 6);
  };

  /* ===============================
     MANAGER PERFORMANCE STATS
  =============================== */
  const getManagerStats = () => {
    const managers = users.filter(u => u.role === 'manager');
    
    return managers.map(manager => {
      // Get complaints either assigned directly to manager OR from their organization
      const assigned = complaints.filter(c => 
        c.assignedManagerId === manager.id || 
        (c.orgId === manager.orgId && manager.orgId)
      );
      
      // Get effective status helper
      const getStatus = (c) => {
        if (c.statusHistory?.resolved || c.status === 'resolved') return 'resolved';
        if (c.statusHistory?.['in-progress']) return 'in-progress';
        if (c.statusHistory?.assigned || c.assignedManagerId) return 'assigned';
        if (c.aiAnalysis || c.statusHistory?.analyzed) return 'analyzed';
        return 'submitted';
      };
      
      const resolved = assigned.filter(c => getStatus(c) === 'resolved');
      const inProgress = assigned.filter(c => getStatus(c) === 'in-progress');
      const pending = assigned.filter(c => !['resolved', 'in-progress'].includes(getStatus(c)));
      
      // Calculate average resolution time
      let avgResolutionTime = 0;
      const resolvedWithTime = resolved.filter(c => c.createdAt && (c.statusHistory?.resolved || c.resolvedAt));
      if (resolvedWithTime.length > 0) {
        const totalTime = resolvedWithTime.reduce((acc, c) => {
          const createdTime = new Date(c.createdAt).getTime();
          const resolvedTime = new Date(c.statusHistory?.resolved || c.resolvedAt).getTime();
          return acc + (resolvedTime - createdTime);
        }, 0);
        avgResolutionTime = totalTime / resolvedWithTime.length / (1000 * 60 * 60); // hours
      }
      
      // Performance score
      const resolutionRate = assigned.length > 0 ? (resolved.length / assigned.length) * 100 : 0;
      
      return {
        email: manager.email,
        orgId: manager.orgId,
        orgName: orgs.find(o => o.id === manager.orgId)?.name || 'Unassigned',
        total: assigned.length,
        resolved: resolved.length,
        inProgress: inProgress.length,
        pending: pending.length,
        resolutionRate: resolutionRate.toFixed(0),
        avgTime: avgResolutionTime > 0 ? `${avgResolutionTime.toFixed(1)}h` : '-',
        status: resolutionRate >= 80 ? 'excellent' : resolutionRate >= 50 ? 'good' : resolutionRate > 0 ? 'needs-improvement' : 'new'
      };
    }).sort((a, b) => b.resolved - a.resolved);
  };

  // Debug: log orgs and users on every render
  console.log("Reer: orgs=", orgs, "users=", users);
  return (
    <>
      {renderDbErrorBanner()}
      <div className="admin">
        {/* NAVBAR */}
        <nav className="admin-navbar">
          <div className="navbar-brand">
            <span className="brand-icon">⚡</span>
            <span className="brand-text">Admin Control Center</span>
          </div>
            <div className="navbar-menu">
              <button 
                className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
                onClick={() => setActiveTab("dashboard")}
              >
                <span className="nav-icon">📊</span>
                <span className="nav-label">Dashboard</span>
              </button>
              <button 
                className={`nav-item ${activeTab === "organizations" ? "active" : ""}`}
            onClick={() => setActiveTab("organizations")}
          >
            <span className="nav-icon">🏢</span>
            <span className="nav-label">Organizations</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <span className="nav-icon">👥</span>
            <span className="nav-label">Users</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            <span className="nav-icon">📜</span>
            <span className="nav-label">Audit Logs</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === "insights" ? "active" : ""}`}
            onClick={() => setActiveTab("insights")}
          >
            <span className="nav-icon">🔮</span>
            <span className="nav-label">Insights</span>
          </button>
        </div>
        
        <button
          className="nav-logout"
          onClick={async () => {
            await signOut(auth);
            navigate("/login");
          }}
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </nav>

      <div className="admin-content">
        {/* DASHBOARD TAB */}
        {activeTab === "dashboard" && (
          <>
      <section className="health-section">
        <h3>🚦 System Health</h3>
        <div className="stats-grid">
          <div className="stat-card stat-orgs">
            <div className="stat-icon">🏢</div>
            <div className="stat-info">
              <span className="stat-value">{orgs.length}</span>
              <span className="stat-label">Organizations</span>
            </div>
            <div className="stat-indicator active"></div>
          </div>

          <div className="stat-card stat-users">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <span className="stat-value">{users.length}</span>
              <span className="stat-label">Total Users</span>
            </div>
            <div className="stat-indicator active"></div>
          </div>

          <div className="stat-card stat-complaints">
            <div className="stat-icon">📋</div>
            <div className="stat-info">
              <span className="stat-value">{complaints.length}</span>
              <span className="stat-label">Complaints</span>
            </div>
            <div className="stat-trend">
              <span className="trend-up">↑ Live</span>
            </div>
          </div>

          <div className="stat-card stat-ai">
            <div className="stat-icon">🤖</div>
            <div className="stat-info">
              <span className="stat-value">
                {complaints.filter((c) => c.aiAnalysis?.summary).length}
              </span>
              <span className="stat-label">AI Analyzed</span>
            </div>
            <div className="stat-progress">
              <div 
                className="progress-bar" 
                style={{ 
                  width: `${complaints.length > 0 
                    ? (complaints.filter((c) => c.aiAnalysis?.summary).length / complaints.length) * 100 
                    : 0}%` 
                }}
              ></div>
            </div>
          </div>

          <div className="stat-card stat-resolved">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <span className="stat-value">
                {complaints.filter((c) => c.status === "resolved").length}
              </span>
              <span className="stat-label">Resolved</span>
            </div>
            <div className="stat-indicator success"></div>
          </div>

          <div className="stat-card stat-pending">
            <div className="stat-icon">⏳</div>
            <div className="stat-info">
              <span className="stat-value">
                {complaints.filter((c) => c.status === "pending" || !c.status).length}
              </span>
              <span className="stat-label">Pending</span>
            </div>
            <div className="stat-indicator warning"></div>
          </div>
        </div>
      </section>

      {/* CHARTS */}
      <div className="charts-grid">
        <section>
          <h3>📊 Complaints by Organization</h3>
          <div className="chart-container-bar">
            <Bar
              data={{
                labels: orgs.length > 0 ? orgs.map((o) => o.name) : ["No Data"],
                datasets: [
                  {
                    label: "Complaints",
                    data: orgs.length > 0 ? complaintsByOrg : [0],
                    backgroundColor: [
                      "rgba(99, 102, 241, 0.8)",
                      "rgba(34, 197, 94, 0.8)",
                      "rgba(245, 158, 11, 0.8)",
                      "rgba(239, 68, 68, 0.8)",
                      "rgba(168, 85, 247, 0.8)",
                    ],
                    borderColor: [
                      "#6366f1",
                      "#22c55e",
                      "#f59e0b",
                      "#ef4444",
                      "#a855f7",
                    ],
                    borderWidth: 2,
                    borderRadius: 6,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { color: "#9ca3af" },
                    grid: { color: "rgba(255,255,255,0.05)" },
                  },
                  x: {
                    ticks: { color: "#9ca3af" },
                    grid: { display: false },
                  },
                },
              }}
            />
          </div>
        </section>

        <section>
          <h3>🧠 Priority Distribution</h3>
          <div className="chart-container">
            <Pie
              data={{
                labels: Object.keys(priorityData).length > 0 
                  ? Object.keys(priorityData) 
                  : ["High", "Medium", "Low"],
                datasets: [
                  {
                    data: Object.values(priorityData).length > 0 
                      ? Object.values(priorityData) 
                      : [0, 0, 0],
                    backgroundColor: [
                      "rgba(239, 68, 68, 0.85)",
                      "rgba(245, 158, 11, 0.85)",
                      "rgba(34, 197, 94, 0.85)",
                      "rgba(99, 102, 241, 0.85)",
                    ],
                    borderColor: [
                      "#ef4444",
                      "#f59e0b",
                      "#22c55e",
                      "#6366f1",
                    ],
                    borderWidth: 2,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      color: "#e5e7eb",
                      padding: 12,
                      font: { size: 11 },
                    },
                  },
                },
              }}
            />
          </div>
        </section>

        <section>
          <h3>📈 Complaints Over Time</h3>
          <div className="chart-container-bar">
            <Bar
              data={{
                labels: Object.keys(complaintsByDay).length > 0 
                  ? Object.keys(complaintsByDay).slice(-7) 
                  : ["No Data"],
                datasets: [
                  {
                    label: "Complaints",
                    data: Object.values(complaintsByDay).length > 0 
                      ? Object.values(complaintsByDay).slice(-7) 
                      : [0],
                    backgroundColor: "rgba(129, 140, 248, 0.7)",
                    borderColor: "#818cf8",
                    borderWidth: 2,
                    borderRadius: 6,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { color: "#9ca3af" },
                    grid: { color: "rgba(255,255,255,0.05)" },
                  },
                  x: {
                    ticks: { color: "#9ca3af", maxRotation: 45 },
                    grid: { display: false },
                  },
                },
              }}
            />
          </div>
        </section>
      </div>

      {/* MANAGER PERFORMANCE SECTION */}
      <section className="manager-performance-section">
        <h3>👔 Manager Performance</h3>
        <p className="section-subtitle">Track how managers are handling complaints</p>
        
        {getManagerStats().length === 0 ? (
          <div className="no-insights">
            <span className="no-data-icon">👥</span>
            <p>No managers assigned yet</p>
          </div>
        ) : (
          <div className="manager-table-container">
            <table className="manager-table">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Organization</th>
                  <th>Assigned</th>
                  <th>Resolved</th>
                  <th>In Progress</th>
                  <th>Pending</th>
                  <th>Avg Time</th>
                  <th>Resolution Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {getManagerStats().map(manager => (
                  <tr key={manager.id}>
                    <td className="manager-info">
                      <div className="manager-avatar">
                        {manager.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="manager-details">
                        <span className="manager-name">{manager.name}</span>
                        <span className="manager-email">{manager.email}</span>
                      </div>
                    </td>
                    <td><span className="org-badge">{manager.orgName}</span></td>
                    <td className="stat-cell">{manager.total}</td>
                    <td className="stat-cell resolved">{manager.resolved}</td>
                    <td className="stat-cell in-progress">{manager.inProgress}</td>
                    <td className="stat-cell pending">{manager.pending}</td>
                    <td className="stat-cell">{manager.avgTime}</td>
                    <td>
                      <div className="rate-bar">
                        <div className="rate-fill" style={{ width: `${manager.resolutionRate}%` }}></div>
                        <span className="rate-text">{manager.resolutionRate}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${manager.status}`}>
                        {manager.status === 'excellent' ? '⭐ Excellent' : 
                         manager.status === 'good' ? '✓ Good' : 
                         manager.status === 'needs-improvement' ? '⚡ Needs Improvement' : 
                         '🆕 New'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
          </>
        )}

        {/* ORGANIZATIONS TAB */}
        {activeTab === "organizations" && (
          <>
            <div className="page-header">
              <h2>🏢 Organization Management</h2>
              <p className="page-subtitle">Create and manage organizations</p>
            </div>

            <div className="org-grid">
              <section className="org-form-card">
                <h3>➕ Create New Organization</h3>
                <div className="form-group">
                  <label>Organization Name</label>
                  <input
                    placeholder="Enter organization name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Email Domain</label>
                  <input
                    placeholder="e.g., company.com"
                    value={emailDomain}
                    onChange={(e) => setEmailDomain(e.target.value)}
                  />
                </div>
                <button
                  className="btn-primary"
                  onClick={createOrganization}
                  disabled={creatingOrg}
                >
                  <span>🚀</span> {creatingOrg ? "Creating..." : "Create Organization"}
                </button>
              </section>

              <section className="org-form-card">
                <h3>👔 Assign Manager</h3>
                <div className="form-group">
                  <label>Select Organization</label>
                  <select 
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                  >
                    <option value="">Choose an organization...</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Select User</label>
                  <select 
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                  >
                    <option value="">Choose a user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn-primary" onClick={assignManager}>
                  <span>✨</span> Assign Manager
                </button>
              </section>
            </div>

            <section className="org-list-card">
              <h3>📋 Existing Organizations</h3>
              <div className="org-table">
                <div className="table-header">
                  <span>Name</span>
                  <span>Email Domain</span>
                  <span>Created</span>
                  <span>Complaints</span>
                </div>
                {orgs.length === 0 ? (
                  <div className="empty-state">No organizations yet</div>
                ) : (
                  orgs.map((o) => (
                    <div key={o.id} className="table-row">
                      <span className="org-name">{o.name}</span>
                      <span className="org-domain">@{o.emailDomain}</span>
                      <span className="org-date">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </span>
                      <span className="org-count">
                        {complaints.filter((c) => c.orgId === o.id).length}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        {/* USERS TAB */}
        {activeTab === "users" && (
          <>
            <div className="page-header">
              <h2>👥 User Management</h2>
              <p className="page-subtitle">
                View and manage all users 
                <span className="live-badge">🔴 Live • {users.length} users</span>
              </p>
            </div>

            <section className="users-list-card">
              <div className="users-table">
                <div className="table-header">
                  <span>Email</span>
                  <span>Role</span>
                  <span>Organization</span>
                </div>
                {users.length === 0 ? (
                  <div className="empty-state">No users found</div>
                ) : (
                  users.map((u) => (
                    <div key={u.id} className="table-row">
                      <span className="user-email">{u.email}</span>
                      <span className={`user-role role-${u.role || 'user'}`}>
                        {u.role || 'user'}
                      </span>
                      <span className="user-org">
                        {orgs.find((o) => o.id === u.orgId)?.name || '—'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        {/* AUDIT LOGS TAB */}
        {activeTab === "logs" && (
          <>
            <div className="page-header">
              <h2>📜 Audit Logs</h2>
              <p className="page-subtitle">
                Track all admin activities
                <span className="live-badge">🔴 Live • {auditLogs.length} entries</span>
              </p>
            </div>

            <section className="audit-card">
              <ul className="audit-list">
                {auditLogs.length === 0 ? (
                  <li className="empty-state">No audit logs yet. Actions will appear here in real-time.</li>
                ) : (
                  auditLogs.map((l) => (
                    <li key={l.id} className="audit-item">
                      <div className="audit-time">
                        {new Date(l.timestamp).toLocaleString()}
                      </div>
                      <div className="audit-action">{l.action}</div>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </>
        )}

        {/* PLATFORM INSIGHTS TAB */}
        {activeTab === "insights" && (
          <>
            <div className="page-header">
              <h2>🔮 Platform Insights</h2>
              <p className="page-subtitle">
                AI-detected patterns and trends across all organizations
                <span className="live-badge">🔴 Live Analysis</span>
              </p>
            </div>

            {/* Quick Stats */}
            <div className="insight-stats-grid">
              <div className="insight-stat-card">
                <div className="insight-stat-icon">🏢</div>
                <div className="insight-stat-info">
                  <span className="insight-stat-value">{orgs.length}</span>
                  <span className="insight-stat-label">Organizations</span>
                </div>
              </div>
              <div className="insight-stat-card">
                <div className="insight-stat-icon">📋</div>
                <div className="insight-stat-info">
                  <span className="insight-stat-value">{complaints.length}</span>
                  <span className="insight-stat-label">Total Complaints</span>
                </div>
              </div>
              <div className="insight-stat-card">
                <div className="insight-stat-icon">👔</div>
                <div className="insight-stat-info">
                  <span className="insight-stat-value">{users.filter(u => u.role === 'manager').length}</span>
                  <span className="insight-stat-label">Active Managers</span>
                </div>
              </div>
              <div className="insight-stat-card">
                <div className="insight-stat-icon">✅</div>
                <div className="insight-stat-info">
                  <span className="insight-stat-value">
                    {complaints.length > 0 
                      ? ((complaints.filter(c => c.status === 'resolved' || c.statusHistory?.resolved).length / complaints.length) * 100).toFixed(0)
                      : 0}%
                  </span>
                  <span className="insight-stat-label">Resolution Rate</span>
                </div>
              </div>
            </div>

            {/* Common Insights Section */}
            <section className="insights-section">
              <h3>🎯 Detected Patterns</h3>
              <p className="section-subtitle">Issues affecting multiple organizations</p>
              
              {generateCommonInsights().length === 0 ? (
                <div className="no-insights">
                  <span className="no-data-icon">📊</span>
                  <p>Not enough data yet to generate insights. Patterns will appear as more complaints are submitted.</p>
                </div>
              ) : (
                <div className="insights-grid">
                  {generateCommonInsights().map((insight, idx) => (
                    <div key={idx} className={`insight-card insight-${insight.severity}`}>
                      <div className="insight-icon">{insight.icon}</div>
                      <div className="insight-content">
                        <h4 className="insight-title">{insight.title}</h4>
                        <p className="insight-desc">{insight.description}</p>
                      </div>
                      <span className={`insight-badge ${insight.severity}`}>
                        {insight.severity === 'high' ? '🔴 High' : insight.severity === 'medium' ? '🟡 Medium' : '🟢 Low'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Category Breakdown */}
            <section className="insights-section">
              <h3>📁 Complaint Categories</h3>
              <p className="section-subtitle">Distribution of complaints by type</p>
              
              <div className="category-breakdown">
                {(() => {
                  const categories = {};
                  complaints.forEach(c => {
                    const cat = c.aiAnalysis?.category || 'Uncategorized';
                    categories[cat] = (categories[cat] || 0) + 1;
                  });
                  
                  const sortedCategories = Object.entries(categories)
                    .sort((a, b) => b[1] - a[1]);
                  
                  if (sortedCategories.length === 0) {
                    return <div className="no-insights"><p>No categorized complaints yet</p></div>;
                  }
                  
                  return sortedCategories.map(([category, count]) => (
                    <div key={category} className="category-bar-item">
                      <div className="category-info">
                        <span className="category-name">{category}</span>
                        <span className="category-count">{count} complaints</span>
                      </div>
                      <div className="category-bar">
                        <div 
                          className="category-fill" 
                          style={{ width: `${(count / complaints.length) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </section>

            {/* Organization Comparison */}
            <section className="insights-section">
              <h3>🏆 Organization Comparison</h3>
              <p className="section-subtitle">Complaint volume and resolution by organization</p>
              
              <div className="org-comparison-grid">
                {orgs.map(org => {
                  const orgComplaints = complaints.filter(c => c.orgId === org.id);
                  const resolved = orgComplaints.filter(c => c.status === 'resolved' || c.statusHistory?.resolved).length;
                  const rate = orgComplaints.length > 0 ? ((resolved / orgComplaints.length) * 100).toFixed(0) : 0;
                  
                  return (
                    <div key={org.id} className="org-comparison-card">
                      <div className="org-comparison-header">
                        <span className="org-comparison-name">{org.name}</span>
                        <span className="org-comparison-domain">@{org.emailDomain}</span>
                      </div>
                      <div className="org-comparison-stats">
                        <div className="org-stat">
                          <span className="org-stat-value">{orgComplaints.length}</span>
                          <span className="org-stat-label">Complaints</span>
                        </div>
                        <div className="org-stat">
                          <span className="org-stat-value resolved">{resolved}</span>
                          <span className="org-stat-label">Resolved</span>
                        </div>
                        <div className="org-stat">
                          <span className="org-stat-value">{rate}%</span>
                          <span className="org-stat-label">Rate</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
    </>
  );

}
export default AdminDashboard;

