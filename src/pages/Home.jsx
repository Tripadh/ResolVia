import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";

const AnimatedStat = ({ number, label, suffix }) => {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !hasAnimated) {
        setHasAnimated(true);
        const end = parseInt(number);
        const duration = 1500;
        const steps = 60;
        const increment = end / steps;
        let current = 0;
        
        const timer = setInterval(() => {
          current += increment;
          if (current >= end) {
            setCount(end);
            clearInterval(timer);
          } else {
            setCount(Math.floor(current));
          }
        }, duration / steps);
        
        return () => clearInterval(timer);
      }
    }, { threshold: 0.3 });

    const element = document.getElementById(`stat-${label}`);
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, [number, label, hasAnimated]);

  return (
    <div style={styles.stat} id={`stat-${label}`}>
      <div style={styles.statNumber}>{count}{suffix}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
};

const Feature = ({ icon, title, desc }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div 
      style={{...styles.featureCard, ...(isHovered ? styles.featureCardHover : {})}}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{...styles.featureIcon, transform: isHovered ? 'scale(1.1)' : 'scale(1)'}}>
        {icon}
      </div>
      <h3 style={styles.featureTitle}>{title}</h3>
      <p style={styles.featureDesc}>{desc}</p>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      style={{...styles.card, ...(isHovered ? styles.cardHover : {})}}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{...styles.cardIcon, transform: isHovered ? 'scale(1.1)' : 'scale(1)'}}>
        {icon}
      </div>
      <h3 style={styles.cardTitle}>{title}</h3>
      <p style={styles.cardDesc}>{desc}</p>
    </div>
  );
};

const BenefitItem = ({ text }) => (
  <div style={styles.benefitItem}>
    <span style={styles.checkIcon}>✓</span>
    <span>{text}</span>
  </div>
);

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.animate-in').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'all 0.6s ease-out';
      observer.observe(el);
    });

    document.querySelectorAll('.stagger-item').forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = `all 0.5s ease-out ${i * 0.1}s`;
      observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div style={styles.page}>
      {/* NAVBAR */}
      <nav style={styles.nav}>
        <div style={styles.logoContainer}>
          <img src="/logo.svg" alt="ResolVia Logo" style={styles.logoImage} />
          <div style={styles.logoTextContainer}>
            <h2 style={styles.logoText}>ResolVia</h2>
            <p style={styles.logoSubtext}>COMPLAINT INTELLIGENCE</p>
          </div>
        </div>
        <div style={styles.navLinks}>
          <a style={styles.link} onClick={() => navigate("/")}>Home</a>
          <a style={styles.link}>Organizations</a>
          <a style={styles.link} onClick={() => navigate("/login")}>Login</a>
          <a style={styles.primaryBtn} onClick={() => navigate("/register")}>Get Started</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={styles.hero}>
        <div style={styles.heroText} className="animate-in">
         
          <h1 style={styles.heroTitle}>
            AI-Powered Complaint Intelligence Platform
          </h1>
          <p style={styles.heroSub}>
            Transform raw complaints into actionable insights with cutting-edge AI technology.
            Empower institutions, enterprises, and public services to build trust, improve
            services, and resolve issues 10x faster with intelligent automation.
          </p>
          <div style={styles.statsRow} className="animate-in">
            <AnimatedStat number="95" label="Faster Resolution" suffix="%" />
            <AnimatedStat number="85" label="Cost Reduction" suffix="%" />
            <AnimatedStat number="99" label="Accuracy Rate" suffix="%" />
          </div>
          <div>
            <button style={styles.primaryBtn} onClick={() => navigate("/register")}>Create Organization</button>
            <button style={styles.secondaryBtn}>Request Demo</button>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={styles.section} className="animate-in">
        <h2 style={styles.sectionTitle}>How ResolVia Transforms Complaint Management</h2>
        <p style={styles.sectionDesc}>
          Our AI-powered platform streamlines the entire complaint lifecycle, from submission to resolution
        </p>
        <div style={styles.grid3}>
          <div className="stagger-item">
            <Feature 
              icon="📝" 
              title="Collect Seamlessly" 
              desc="Multi-channel complaint collection through web, mobile, email, and social media. Accept complaints in under 30 seconds with smart forms that adapt to user input and validate data in real-time." 
            />
          </div>
          <div className="stagger-item">
            <Feature 
              icon="🤖" 
              title="Analyze Intelligently" 
              desc="Advanced AI algorithms automatically detect sentiment, urgency levels, complaint categories, and patterns. Machine learning identifies recurring issues and predicts resolution times with 99% accuracy." 
            />
          </div>
          <div className="stagger-item">
            <Feature 
              icon="⚡" 
              title="Act Decisively" 
              desc="Smart routing assigns complaints to the right teams instantly. Priority-based workflows ensure critical issues get immediate attention. Real-time dashboards help admins resolve complaints 10x faster." 
            />
          </div>
        </div>
      </section>

      {/* AI POWER */}
      <section style={styles.sectionAlt} className="animate-in">
        <h2 style={styles.sectionTitle}>Why Leading Organizations Choose ResolVia</h2>
        <p style={styles.sectionDesc}>
          Cutting-edge features powered by artificial intelligence and machine learning
        </p>
        <div style={styles.grid2}>
          <div className="stagger-item">
            <FeatureCard 
              icon="💬" 
              title="AI-Generated Auto Replies" 
              desc="Intelligent response system that generates contextual, empathetic replies based on complaint analysis, saving hours of manual work while maintaining quality." 
            />
          </div>
          <div className="stagger-item">
            <FeatureCard 
              icon="🌐" 
              title="Cross-Organization Intelligence" 
              desc="Learn from anonymized complaint patterns across industries. Benchmark your performance, discover best practices, and stay ahead of emerging issues." 
            />
          </div>
          <div className="stagger-item">
            <FeatureCard 
              icon="📊" 
              title="Complaint Lifecycle Visualization" 
              desc="Interactive dashboards with real-time analytics, trend analysis, heat maps, and comprehensive reporting. Track every complaint from submission to resolution with complete transparency." 
            />
          </div>
          <div className="stagger-item">
            <FeatureCard 
              icon="🎯" 
              title="Instant Onboarding & Setup" 
              desc="Get started in minutes with our guided onboarding wizard. Customizable workflows, role-based access, and seamless integration with your existing systems." 
            />
          </div>
        </div>
      </section>

      {/* ABOUT US */}
      <section style={styles.section} className="animate-in">
        <h2 style={styles.sectionTitle}>Built for Modern Organizations</h2>
        <div style={styles.aboutGrid} className="animate-in">
          <div style={styles.aboutText}>
            <h3 style={styles.aboutSubtitle}>Revolutionizing Public Service & Enterprise Support</h3>
            <p style={styles.aboutPara}>
              ResolVia was founded with a mission to transform how organizations handle complaints 
              and feedback. We combine advanced AI technology with deep domain expertise to create 
              a platform that doesn't just manage complaints—it turns them into opportunities for 
              improvement and growth.
            </p>
            <p style={styles.aboutPara}>
              Our platform serves government agencies, educational institutions, healthcare providers, 
              financial services, and enterprises across 50+ countries. From small organizations to 
              large-scale government departments processing millions of complaints annually, ResolVia 
              scales effortlessly to meet your needs.
            </p>
            <div style={styles.benefitsList}>
              <BenefitItem text="Enterprise-grade security & compliance (ISO 27001, GDPR, SOC 2)" />
              <BenefitItem text="24/7 multilingual support in 40+ languages" />
              <BenefitItem text="99.9% uptime SLA with redundant infrastructure" />
              <BenefitItem text="Custom integrations with your existing tools" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={styles.cta}>
        <h2 style={styles.ctaText}>Ready to Transform Your Complaint Management?</h2>
        <p style={styles.ctaSubtext}>
          Join 500+ organizations building trust and improving services with AI-powered complaint intelligence
        </p>
        <div style={styles.ctaButtons}>
          <button style={styles.primaryBtnLarge} onClick={() => navigate("/register")}>Start Free Trial</button>
          <button style={styles.secondaryBtnLight}>Schedule a Demo</button>
        </div>
        <p style={styles.ctaNote}>✓ No credit card required  ✓ Setup in 5 minutes  ✓ Cancel anytime</p>
      </section>

      {/* FOOTER */}
      <footer style={styles.footer}>
        © 2025 ResolVia — AI Digital Complaint Analyzer
      </footer>
    </div>
  );
}

const styles = {
  page: {
    background: "linear-gradient(180deg, #F8F7FF 0%, #FAF5FF 50%, #FEFCFF 100%)",
    minHeight: "100vh",
    fontFamily: "'Poppins', sans-serif",
    color: "#1E293B"
  },
  nav: {
    background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
    padding: "18px 60px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "white"
  },
  logoContainer: {
    display: "flex",
    alignItems: "center",
    gap: 15
  },
  logoImage: {
    height: 60,
    width: "auto"
  },
  logoTextContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 2
  },
  logoText: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: -0.5
  },
  logoSubtext: {
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1.5,
    color: "#C4B5FD",
    lineHeight: 1
  },
  logo: { margin: 0 },
  navLinks: { display: "flex", gap: 20, alignItems: "center" },
  link: { 
    color: "white", 
    cursor: "pointer",
    transition: "opacity 0.3s ease",
    opacity: 1
  },
  primaryBtn: {
    background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
    border: "none",
    padding: "10px 18px",
    borderRadius: 8,
    color: "white",
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 4px 6px rgba(139, 92, 246, 0.3)"
  },
  secondaryBtn: {
    border: "2px solid #8B5CF6",
    background: "transparent",
    padding: "10px 18px",
    borderRadius: 8,
    color: "#8B5CF6",
    marginLeft: 12,
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
  },
  hero: {
    padding: "80px 60px 100px",
    textAlign: "center",
    background: "linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)",
    position: "relative",
    overflow: "hidden"
  },
  badge: {
    display: "inline-block",
    background: "linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)",
    color: "#7C3AED",
    padding: "8px 20px",
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 25,
    boxShadow: "0 4px 12px rgba(139, 92, 246, 0.15)"
  },
  heroTitle: { 
    fontSize: 52, 
    marginBottom: 20,
    lineHeight: 1.2,
    maxWidth: 900,
    margin: "0 auto 20px"
  },
  heroSub: { 
    fontSize: 20, 
    maxWidth: 800, 
    margin: "20px auto",
    lineHeight: 1.6,
    color: "#475569"
  },
  statsRow: {
    display: "flex",
    justifyContent: "center",
    gap: 60,
    margin: "50px auto 40px",
    maxWidth: 700
  },
  stat: {
    textAlign: "center"
  },
  statNumber: {
    fontSize: 48,
    fontWeight: 700,
    color: "#8B5CF6",
    marginBottom: 8
  },
  statLabel: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: 500
  },
  section: { 
    padding: "80px 60px", 
    textAlign: "center",
    background: "rgba(255, 255, 255, 0.6)",
    backdropFilter: "blur(10px)"
  },
  sectionAlt: { 
    padding: "80px 60px", 
    background: "linear-gradient(135deg, rgba(237, 233, 254, 0.4) 0%, rgba(250, 245, 255, 0.4) 100%)", 
    textAlign: "center",
    backdropFilter: "blur(10px)"
  },
  sectionTitle: { 
    fontSize: 38, 
    marginBottom: 15,
    fontWeight: 700
  },
  sectionDesc: {
    fontSize: 18,
    color: "#64748B",
    maxWidth: 700,
    margin: "0 auto 50px",
    lineHeight: 1.6
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 30
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
    gap: 30
  },
  featureCard: {
    background: "white",
    padding: 40,
    borderRadius: 16,
    border: "1px solid #E2E8F0",
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    cursor: "pointer",
    textAlign: "left",
    position: "relative",
    overflow: "hidden"
  },
  featureCardHover: {
    transform: "translateY(-8px)",
    boxShadow: "0 20px 40px rgba(139, 92, 246, 0.15)",
    borderColor: "#8B5CF6"
  },
  featureIcon: {
    fontSize: 48,
    marginBottom: 20,
    transition: "transform 0.3s ease",
    display: "inline-block"
  },
  featureTitle: {
    fontSize: 24,
    marginBottom: 15,
    fontWeight: 600
  },
  featureDesc: {
    fontSize: 16,
    lineHeight: 1.6,
    color: "#64748B"
  },
  card: {
    background: "white",
    padding: 35,
    borderRadius: 16,
    border: "1px solid #E2E8F0",
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    textAlign: "left",
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden"
  },
  cardHover: {
    transform: "translateY(-8px)",
    boxShadow: "0 20px 40px rgba(139, 92, 246, 0.15)",
    borderColor: "#DDD6FE"
  },
  cardIcon: {
    fontSize: 40,
    marginBottom: 20,
    transition: "transform 0.3s ease",
    display: "inline-block"
  },
  cardTitle: {
    fontSize: 22,
    marginBottom: 12,
    fontWeight: 600
  },
  cardDesc: {
    fontSize: 15,
    lineHeight: 1.6,
    color: "#64748B"
  },
  aboutGrid: {
    maxWidth: 1100,
    margin: "0 auto"
  },
  aboutText: {
    textAlign: "left"
  },
  aboutSubtitle: {
    fontSize: 28,
    marginBottom: 20,
    color: "#1E293B"
  },
  aboutPara: {
    fontSize: 17,
    lineHeight: 1.8,
    color: "#475569",
    marginBottom: 20
  },
  benefitsList: {
    marginTop: 30
  },
  benefitItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 16,
    marginBottom: 15,
    color: "#334155"
  },
  checkIcon: {
    color: "#10B981",
    fontSize: 20,
    fontWeight: 700
  },
  cta: {
    background: "linear-gradient(135deg, #1E1B4B 0%, #7C3AED 100%)",
    color: "white",
    padding: "80px 60px",
    textAlign: "center"
  },
  ctaText: { 
    fontSize: 42,
    marginBottom: 15,
    fontWeight: 700
  },
  ctaSubtext: {
    fontSize: 19,
    marginBottom: 35,
    opacity: 0.95,
    maxWidth: 700,
    margin: "0 auto 35px"
  },
  ctaButtons: {
    display: "flex",
    gap: 15,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 25
  },
  primaryBtnLarge: {
    background: "white",
    color: "#7C3AED",
    border: "none",
    padding: "16px 40px",
    borderRadius: 10,
    fontSize: 18,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 8px 20px rgba(255,255,255,0.3)"
  },
  secondaryBtnLight: {
    border: "2px solid white",
    background: "transparent",
    padding: "16px 40px",
    borderRadius: 10,
    color: "white",
    fontSize: 18,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    backdropFilter: "blur(10px)"
  },
  ctaNote: {
    fontSize: 14,
    opacity: 0.9,
    marginTop: 20
  },
  footer: {
    background: "#1E1B4B",
    color: "#CBD5E1",
    textAlign: "center",
    padding: 20
  }
};
