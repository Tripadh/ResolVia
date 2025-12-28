import { useEffect, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { auth, rtdb } from "../firebase/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { ref, push, onValue, get, update, remove } from "firebase/database";
import "./DashboardUser.css";

// Workflow stages for tracking
const WORKFLOW_STAGES = [
  { id: 'submitted', label: 'Submitted', icon: '📝' },
  { id: 'analyzed', label: 'AI Analyzed', icon: '🤖' },
  { id: 'assigned', label: 'Assigned', icon: '👤' },
  { id: 'in-progress', label: 'In Progress', icon: '⚡' },
  { id: 'resolved', label: 'Resolved', icon: '✅' }
];

function DashboardUser() {
  const navigate = useNavigate();

  const [complaintTitle, setComplaintTitle] = useState("");
  const [complaintDescription, setComplaintDescription] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [userData, setUserData] = useState(null);
  const [orgName, setOrgName] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [expandedCards, setExpandedCards] = useState({});
  const [satisfactionRatings, setSatisfactionRatings] = useState({});
  const [showAutoReply, setShowAutoReply] = useState(false);
  const [autoReplyMessage, setAutoReplyMessage] = useState(null);

  /* ===============================
     AUTH → FETCH USER DATA
  =============================== */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }

      const userRef = ref(rtdb, `users/${user.uid}`);
      const snap = await get(userRef);

      if (snap.exists()) {
        setUserData(snap.val());
        
        // Fetch organization name
        if (snap.val().orgId) {
          const orgRef = ref(rtdb, `organizations/${snap.val().orgId}`);
          const orgSnap = await get(orgRef);
          if (orgSnap.exists()) {
            setOrgName(orgSnap.val().name || snap.val().orgId);
          }
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  /* ===============================
     REALTIME: MY COMPLAINTS ONLY
  =============================== */
  useEffect(() => {
    if (!userData) return;

    const complaintsRef = ref(rtdb, "complaints");

    const unsubscribe = onValue(complaintsRef, (snapshot) => {
      if (snapshot.exists()) {
        const all = Object.entries(snapshot.val()).map(
          ([id, c]) => ({ id, ...c })
        );

        const mine = all
          .filter((c) => c.userId === auth.currentUser.uid)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setComplaints(mine);
      } else {
        setComplaints([]);
      }
    });

    return () => unsubscribe();
  }, [userData]);

  /* ===============================
     HELPER FUNCTIONS
  =============================== */
  const getEffectiveStatus = (complaint) => {
    if (complaint.statusHistory) {
      const stages = ['resolved', 'in-progress', 'assigned', 'analyzed', 'submitted'];
      for (const stage of stages) {
        if (complaint.statusHistory[stage]) return stage;
      }
    }
    if (complaint.aiAnalysis && !complaint.statusHistory?.analyzed) {
      return 'analyzed';
    }
    if (complaint.status === 'open') return 'submitted';
    return complaint.status || 'submitted';
  };

  const getStageIndex = (status) => {
    return WORKFLOW_STAGES.findIndex(s => s.id === status);
  };

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return formatDate(dateString);
  };

  const toggleCard = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Generate AI auto-reply based on complaint content
  const generateAutoReply = (title, description) => {
    const text = (title + ' ' + description).toLowerCase();
    
    // Detect complaint category and generate appropriate response
    let category = 'general';
    let emoji = '📋';
    let apology = '';
    let action = '';
    let timeline = '';
    
    if (text.includes('billing') || text.includes('payment') || text.includes('charge') || text.includes('refund') || text.includes('money') || text.includes('fee')) {
      category = 'billing';
      emoji = '💳';
      apology = "We sincerely apologize for any billing inconvenience you've experienced.";
      action = "Our finance team will review your account and transaction history immediately.";
      timeline = "Billing issues are typically resolved within 24-48 hours.";
    } else if (text.includes('delivery') || text.includes('shipping') || text.includes('package') || text.includes('order') || text.includes('late') || text.includes('arrived')) {
      category = 'delivery';
      emoji = '📦';
      apology = "We're truly sorry for the delivery issues you've faced.";
      action = "Our logistics team will track your order and provide an update shortly.";
      timeline = "You'll receive tracking information within 2-4 hours.";
    } else if (text.includes('product') || text.includes('quality') || text.includes('defect') || text.includes('broken') || text.includes('damaged') || text.includes('not working')) {
      category = 'product';
      emoji = '🔧';
      apology = "We apologize for the product quality issues you've encountered.";
      action = "Our quality assurance team will assess this and arrange a replacement or refund.";
      timeline = "Expect a response within 24 hours with resolution options.";
    } else if (text.includes('service') || text.includes('staff') || text.includes('rude') || text.includes('behavior') || text.includes('attitude') || text.includes('customer service')) {
      category = 'service';
      emoji = '🤝';
      apology = "We deeply apologize for the service experience that did not meet your expectations.";
      action = "This feedback will be shared with our management team for immediate review.";
      timeline = "A senior representative will contact you within 12 hours.";
    } else if (text.includes('technical') || text.includes('bug') || text.includes('error') || text.includes('crash') || text.includes('not loading') || text.includes('website') || text.includes('app')) {
      category = 'technical';
      emoji = '💻';
      apology = "We apologize for the technical difficulties you've experienced.";
      action = "Our tech team has been notified and will investigate the issue.";
      timeline = "Technical issues are prioritized and addressed within 6-12 hours.";
    } else if (text.includes('food') || text.includes('meal') || text.includes('taste') || text.includes('cold') || text.includes('hygiene') || text.includes('restaurant')) {
      category = 'food';
      emoji = '🍽️';
      apology = "We sincerely apologize for the food-related issue you've experienced.";
      action = "Our quality team will review this with the kitchen staff immediately.";
      timeline = "You'll receive a resolution offer within 4 hours.";
    } else if (text.includes('safety') || text.includes('security') || text.includes('dangerous') || text.includes('threat') || text.includes('emergency')) {
      category = 'safety';
      emoji = '🚨';
      apology = "We take your safety concern very seriously.";
      action = "This has been escalated to our safety team for immediate action.";
      timeline = "A safety officer will contact you within 1 hour.";
    } else {
      apology = "We sincerely apologize for any inconvenience you've experienced.";
      action = "Your complaint has been received and will be reviewed by our team.";
      timeline = "Expect a response within 24-48 hours.";
    }
    
    return {
      emoji,
      category: category.charAt(0).toUpperCase() + category.slice(1),
      greeting: `Thank you for reaching out, ${userData?.name?.split(' ')[0] || 'Valued Customer'}!`,
      apology,
      action,
      timeline,
      closing: "We value your feedback and are committed to resolving this promptly.",
      ticketNote: "Your complaint has been logged and assigned a tracking ID. You can monitor its progress in real-time from your dashboard."
    };
  };

  /* ===============================
     SUBMIT COMPLAINT (WITH orgId)
  =============================== */
  const submitComplaint = async () => {
    if (!complaintTitle.trim() || !complaintDescription.trim()) {
      showToastMessage("⚠️ Please fill in all fields");
      return;
    }

    if (!userData?.orgId) {
      showToastMessage("⚠️ No organization linked to your account");
      return;
    }

    // Generate auto-reply before clearing form
    const reply = generateAutoReply(complaintTitle, complaintDescription);
    
    await push(ref(rtdb, "complaints"), {
      title: complaintTitle.trim(),
      description: complaintDescription.trim(),
      status: "open",
      userId: auth.currentUser.uid,
      userName: userData.name || auth.currentUser.email?.split("@")[0] || "Anonymous",
      userEmail: auth.currentUser.email || "",
      orgId: userData.orgId,
      createdAt: new Date().toISOString(),
      statusHistory: {
        submitted: new Date().toISOString()
      }
    });

    setComplaintTitle("");
    setComplaintDescription("");
    setAutoReplyMessage(reply);
    setShowAutoReply(true);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const handleSatisfactionRating = async (complaintId, rating) => {
    setSatisfactionRatings(prev => ({ ...prev, [complaintId]: rating }));
    const complaintRef = ref(rtdb, `complaints/${complaintId}`);
    await update(complaintRef, { userSatisfactionRating: rating });
    showToastMessage("Thank you for your feedback! ⭐");
  };

  const handleDeleteComplaint = async (complaintId, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this complaint? This action cannot be undone.")) {
      try {
        const complaintRef = ref(rtdb, `complaints/${complaintId}`);
        await remove(complaintRef);
        showToastMessage("🗑️ Complaint deleted successfully");
      } catch (error) {
        showToastMessage("❌ Failed to delete complaint");
      }
    }
  };

  // Stats calculations
  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => !['resolved'].includes(getEffectiveStatus(c))).length,
    resolved: complaints.filter(c => getEffectiveStatus(c) === 'resolved').length,
    inProgress: complaints.filter(c => getEffectiveStatus(c) === 'in-progress').length
  };

  // Activity timeline generation
  const generateTimeline = () => {
    const activities = [];
    complaints.forEach(complaint => {
      // Submitted
      activities.push({
        id: `${complaint.id}-created`,
        title: complaint.title,
        message: "You submitted a new complaint",
        icon: "📝",
        time: complaint.createdAt,
        type: 'submitted'
      });
      
      if (complaint.statusHistory) {
        // AI Analyzed
        if (complaint.statusHistory.analyzed) {
          activities.push({
            id: `${complaint.id}-analyzed`,
            title: complaint.title,
            message: "AI analyzed your complaint and determined priority",
            icon: "🤖",
            time: complaint.statusHistory.analyzed,
            type: 'analyzed'
          });
        }
        
        // Assigned to manager
        if (complaint.statusHistory.assigned) {
          activities.push({
            id: `${complaint.id}-assigned`,
            title: complaint.title,
            message: complaint.assignedManagerName 
              ? `Assigned to ${complaint.assignedManagerName} for review`
              : "A manager has been assigned to handle your case",
            icon: "👤",
            time: complaint.statusHistory.assigned,
            type: 'assigned'
          });
        }
        
        // In Progress
        if (complaint.statusHistory['in-progress']) {
          activities.push({
            id: `${complaint.id}-in-progress`,
            title: complaint.title,
            message: "Manager is actively working on your complaint",
            icon: "⚡",
            time: complaint.statusHistory['in-progress'],
            type: 'in-progress'
          });
        }
        
        // Resolved
        if (complaint.statusHistory.resolved) {
          activities.push({
            id: `${complaint.id}-resolved`,
            title: complaint.title,
            message: "Your complaint has been resolved! Please rate your experience",
            icon: "✅",
            time: complaint.statusHistory.resolved,
            type: 'resolved'
          });
        }
      }
      
      // If AI analysis exists but not in statusHistory
      if (complaint.aiAnalysis && !complaint.statusHistory?.analyzed) {
        activities.push({
          id: `${complaint.id}-ai`,
          title: complaint.title,
          message: `AI detected: ${complaint.aiAnalysis.priority || 'Normal'} priority - ${complaint.aiAnalysis.category || 'General'}`,
          icon: "🤖",
          time: complaint.createdAt,
          type: 'analyzed'
        });
      }
    });
    
    return activities
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 15);
  };

  /* ===============================
     LOADING STATE
  =============================== */
  if (loading) {
    return (
      <div className="user-dashboard">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  /* ===============================
     RENDER
  =============================== */
  return (
    <div className="user-dashboard">
      {/* NAVBAR */}
      <nav className="user-navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">🛡️</div>
          <span className="navbar-title">User Portal</span>
          {orgName && (
            <span className="navbar-org">• {orgName}</span>
          )}
        </div>

        <div className="navbar-center">
          <button
            className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📋 My Complaints
          </button>
          <button
            className={`nav-tab ${activeTab === 'submit' ? 'active' : ''}`}
            onClick={() => setActiveTab('submit')}
          >
            ✍️ Submit New
          </button>
          <button
            className={`nav-tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            📊 Activity
          </button>
        </div>

        <div className="navbar-right">
          <div className="user-profile">
            <div className="user-avatar">
              {userData?.name?.charAt(0)?.toUpperCase() || '👤'}
            </div>
            <div className="user-info">
              <span className="user-name">{userData?.name || 'User'}</span>
              <span className="user-role">Customer</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="user-content">
        {/* Welcome Hero */}
        <div className="welcome-hero">
          <div className="welcome-text">
            <h1>👋 Welcome back, {userData?.name?.split(' ')[0] || 'User'}!</h1>
            <p>Track your complaints and see real-time progress updates from our team.</p>
          </div>
          <div className="welcome-stats">
            <div className="welcome-stat">
              <div className="welcome-stat-number">{stats.total}</div>
              <div className="welcome-stat-label">Total Complaints</div>
            </div>
            <div className="welcome-stat">
              <div className="welcome-stat-number" style={{ color: '#fbbf24' }}>{stats.pending}</div>
              <div className="welcome-stat-label">In Queue</div>
            </div>
            <div className="welcome-stat">
              <div className="welcome-stat-number" style={{ color: '#34d399' }}>{stats.resolved}</div>
              <div className="welcome-stat-label">Resolved</div>
            </div>
          </div>
        </div>

        {/* SUBMIT NEW COMPLAINT TAB */}
        {activeTab === 'submit' && (
          <div className="submit-section">
            <div className="section-header">
              <div className="section-icon">✍️</div>
              <h2 className="section-title">Submit a New Complaint</h2>
            </div>
            
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Brief title for your complaint..."
                  value={complaintTitle}
                  onChange={(e) => setComplaintTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Quick Tips</label>
                <div style={{ 
                  background: 'rgba(139, 92, 246, 0.1)', 
                  padding: '14px 18px', 
                  borderRadius: '12px',
                  fontSize: '13px',
                  color: 'var(--user-text-muted)'
                }}>
                  💡 Be specific and include relevant details like dates, names, or order numbers.
                </div>
              </div>
              <div className="form-group full-width">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  placeholder="Describe your issue in detail. Our AI will analyze and route it to the right team..."
                  value={complaintDescription}
                  onChange={(e) => setComplaintDescription(e.target.value)}
                  rows={5}
                />
              </div>
            </div>

            <button 
              className="submit-btn" 
              onClick={submitComplaint}
              disabled={!complaintTitle.trim() || !complaintDescription.trim()}
            >
              🚀 Submit Complaint
            </button>
          </div>
        )}

        {/* MY COMPLAINTS TAB */}
        {activeTab === 'overview' && (
          <div className="complaints-section">
            <div className="complaints-header">
              <h2 className="complaints-title">
                📋 My Complaints
                <span className="complaints-count">{complaints.length} total</span>
              </h2>
            </div>

            {complaints.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3 className="empty-title">No complaints yet</h3>
                <p className="empty-text">
                  Submit your first complaint and we'll help you track it.
                </p>
              </div>
            ) : (
              <div className="complaints-list">
                {complaints.map((complaint) => {
                  const effectiveStatus = getEffectiveStatus(complaint);
                  const stageIndex = getStageIndex(effectiveStatus);
                  const isExpanded = expandedCards[complaint.id];
                  
                  return (
                    <div key={complaint.id} className="complaint-card">
                      {/* Card Header */}
                      <div 
                        className="complaint-card-header" 
                        onClick={() => toggleCard(complaint.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="complaint-info">
                          <h3 className="complaint-title">
                            {isExpanded ? '▼' : '▶'} {complaint.title}
                          </h3>
                          <div className="complaint-meta">
                            <span>🕒 {getTimeAgo(complaint.createdAt)}</span>
                            {complaint.assignedManagerName && (
                              <span>👤 {complaint.assignedManagerName}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className={`complaint-status status-${effectiveStatus === 'resolved' ? 'resolved' : effectiveStatus === 'in-progress' ? 'in-progress' : 'open'}`}>
                            {WORKFLOW_STAGES.find(s => s.id === effectiveStatus)?.icon} {effectiveStatus.replace('-', ' ')}
                          </div>
                          <button
                            onClick={(e) => handleDeleteComplaint(complaint.id, e)}
                            className="delete-btn"
                            title="Delete complaint"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="complaint-body">
                          <p className="complaint-description">{complaint.description}</p>

                          {/* AI Analysis Section */}
                          {complaint.aiAnalysis && (
                            <div className="ai-response">
                              <div className="ai-response-header">
                                <div className="ai-icon">🤖</div>
                                <span className="ai-label">AI Analysis</span>
                              </div>
                              <p className="ai-summary">{complaint.aiAnalysis.summary}</p>
                              <div className="ai-tags">
                                {complaint.aiAnalysis.priority && (
                                  <span className={`ai-tag priority-${complaint.aiAnalysis.priority.toLowerCase()}`}>
                                    ⚡ {complaint.aiAnalysis.priority}
                                  </span>
                                )}
                                {complaint.aiAnalysis.emotion && (
                                  <span className="ai-tag emotion">
                                    💭 {complaint.aiAnalysis.emotion}
                                  </span>
                                )}
                                {complaint.aiAnalysis.category && (
                                  <span className="ai-tag category">
                                    📁 {complaint.aiAnalysis.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Workflow Pipeline Tracker */}
                          <div className="workflow-tracker">
                            <h4 className="workflow-title">📍 Complaint Progress</h4>
                            <div className="workflow-stages">
                              {WORKFLOW_STAGES.map((stage, index) => {
                                const isCompleted = index < stageIndex;
                                const isCurrent = index === stageIndex;
                                
                                return (
                                  <Fragment key={stage.id}>
                                    <div className="workflow-stage">
                                      <div className={`stage-bubble ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                                        {isCompleted ? '✓' : stage.icon}
                                      </div>
                                      <span className="stage-label">{stage.label}</span>
                                    </div>
                                    {index < WORKFLOW_STAGES.length - 1 && (
                                      <div className={`workflow-connector ${isCompleted ? 'completed' : ''}`}></div>
                                    )}
                                  </Fragment>
                                );
                              })}
                            </div>
                          </div>

                          {/* Satisfaction Rating (for resolved complaints) */}
                          {effectiveStatus === 'resolved' && (
                            <div style={{ 
                              marginTop: '20px', 
                              padding: '16px', 
                              background: 'rgba(16, 185, 129, 0.1)', 
                              borderRadius: '12px',
                              textAlign: 'center'
                            }}>
                              <p style={{ marginBottom: '12px', fontSize: '14px', color: '#34d399' }}>
                                ✅ This complaint has been resolved. How was your experience?
                              </p>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                {[1, 2, 3, 4, 5].map(star => (
                                  <button
                                    key={star}
                                    onClick={() => handleSatisfactionRating(complaint.id, star)}
                                    style={{
                                      background: (satisfactionRatings[complaint.id] || complaint.userSatisfactionRating) >= star 
                                        ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' 
                                        : 'rgba(255,255,255,0.1)',
                                      border: 'none',
                                      borderRadius: '50%',
                                      width: '40px',
                                      height: '40px',
                                      fontSize: '18px',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    ⭐
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div className="activity-section">
            <div className="section-header">
              <div className="section-icon">📊</div>
              <h2 className="section-title">Recent Activity</h2>
            </div>
            
            {generateTimeline().length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3 className="empty-title">No activity yet</h3>
                <p className="empty-text">Your complaint history will appear here.</p>
              </div>
            ) : (
              <div className="timeline">
                {generateTimeline().map(activity => (
                  <div key={activity.id} className="timeline-item">
                    <div className="timeline-dot" style={{
                      background: activity.type === 'resolved' ? '#10b981' :
                                  activity.type === 'in-progress' ? '#0ea5e9' :
                                  activity.type === 'analyzed' ? '#8b5cf6' :
                                  activity.type === 'assigned' ? '#f59e0b' :
                                  '#64748b'
                    }}></div>
                    <div className="timeline-content">
                      <div className="timeline-icon">{activity.icon}</div>
                      <div className="timeline-details">
                        <h4 className="timeline-title">{activity.title}</h4>
                        <p className="timeline-message">{activity.message}</p>
                        <span className="timeline-time">{getTimeAgo(activity.time)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="toast">
          <span className="toast-icon">✨</span>
          <span className="toast-message">{toastMessage}</span>
        </div>
      )}

      {/* AI Auto-Reply Modal */}
      {showAutoReply && autoReplyMessage && (
        <div className="auto-reply-overlay" onClick={() => { setShowAutoReply(false); setActiveTab('overview'); }}>
          <div className="auto-reply-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auto-reply-header">
              <div className="auto-reply-icon">{autoReplyMessage.emoji}</div>
              <div className="auto-reply-badge">
                <span className="ai-badge">🤖 AI Response</span>
                <span className="category-badge">{autoReplyMessage.category} Issue</span>
              </div>
            </div>
            
            <div className="auto-reply-body">
              <h3 className="auto-reply-greeting">{autoReplyMessage.greeting}</h3>
              
              <div className="auto-reply-section">
                <p className="auto-reply-apology">{autoReplyMessage.apology}</p>
              </div>
              
              <div className="auto-reply-section">
                <h4>📋 What happens next?</h4>
                <p>{autoReplyMessage.action}</p>
              </div>
              
              <div className="auto-reply-section">
                <h4>⏱️ Expected Timeline</h4>
                <p>{autoReplyMessage.timeline}</p>
              </div>
              
              <div className="auto-reply-note">
                <span className="note-icon">📍</span>
                <p>{autoReplyMessage.ticketNote}</p>
              </div>
              
              <p className="auto-reply-closing">{autoReplyMessage.closing}</p>
            </div>
            
            <button 
              className="auto-reply-close-btn"
              onClick={() => { setShowAutoReply(false); setActiveTab('overview'); }}
            >
              ✓ Got it, View My Complaints
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardUser;
