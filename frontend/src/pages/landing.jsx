import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const VideoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const Shield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const MonitorUp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17V9M8 13l4-4 4 4" />
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <path d="M12 21h0" />
  </svg>
);

const MessageSquare = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const Hand = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 00-4 0v1" />
    <path d="M14 10V4a2 2 0 00-4 0v2" />
    <path d="M10 10.5V6a2 2 0 00-4 0v8" />
    <path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15" />
  </svg>
);

const Lock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const CamIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const features = [
  { icon: <VideoIcon />, title: "Crystal Clear Video", desc: "4K video support with adaptive bitrate streaming for flawless quality on any connection.", accent: true },
  { icon: <MonitorUp />, title: "Screen Sharing", desc: "Share your entire screen, specific windows, or browser tabs with annotation tools.", accent: false },
  { icon: <MessageSquare />, title: "Live Chat & Reactions", desc: "In-meeting chat with file sharing, @mentions, threads, and floating emoji reactions.", accent: false },
  { icon: <Lock />, title: "Waiting Room & Admit", desc: "Host can approve participants before they join the meeting for better security.", accent: false },
  { icon: <Hand />, title: "Hand Raise & Q&A", desc: "Organized participation with hand raise queue and dedicated Q&A panel.", accent: false },
  { icon: <Lock />, title: "End-to-End Encryption", desc: "Enterprise-grade security with E2E encryption, waiting rooms, and meeting passwords.", accent: false },
];

export default function Landing() {
  const [meetingCode, setMeetingCode] = useState("");
  const navigate = useNavigate();

  const generateMeetingCode = () => {
    return (
      Math.random().toString(36).substring(2, 5) +
      "-" +
      Math.random().toString(36).substring(2, 6) +
      "-" +
      Math.random().toString(36).substring(2, 5)
    );
  };

  const joinMeeting = () => {
    if (!meetingCode.trim()) return;
    navigate(`/meet/${meetingCode.trim()}`);
  };

  const startMeeting = () => {
    navigate(`/meet/${generateMeetingCode()}`);
  };

  return (
    <div className="landingPageContainer">
      <nav>
        <div className="navHeader">
          <div className="navLogo"><CamIcon /></div>
          <h2>AirMeet</h2>
        </div>

        <div className="navlist">
          <Link to="/auth?mode=login"><p>Sign In</p></Link>
          <Link to="/auth?mode=register"><p className="nav-btn-primary">Get Started</p></Link>
        </div>
      </nav>

      <div className="landingMainContainer">
        <div className="hero-content">
          <div className="hero-badge">
            <div className="hero-badge-dot"></div>
            <span>Smart Meeting Tools Built In</span>
          </div>

         <h1 className="hero-title">
  <span className="gradient-text">Meet</span> Anyone.
  <br />
  Anytime. Anywhere
</h1>

          <p>Whether it{"'"}s a quick chat or an important meeting, AirMeet has you covered.</p>

          <div className="hero-buttons" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="Enter meeting code"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinMeeting()}
                style={{ padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#111", color: "white", flex: 1 }}
              />
              <button className="btn-primary" onClick={joinMeeting}>Join</button>
            </div>

            <button className="btn-secondary" onClick={startMeeting}>
              Start a Meeting <ArrowRight />
            </button>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-icon"><VideoIcon /></div>
              <div className="hero-stat-text"><strong>HD Video</strong><span>4K Support</span></div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-icon"><Shield /></div>
              <div className="hero-stat-text"><strong>E2E Encrypted</strong><span>Secured</span></div>
            </div>
          </div>
        </div>

        <div className="hero-image">
          <div className="hero-image-card" style={{ background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
            <div style={{ textAlign: "center", padding: 40 }}>
              <div className="heroCamPulse">
  <svg className="heroCamPulseIcon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
</div>

              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Crystal clear video conferencing</p>
            </div>
          </div>
        </div>
      </div>

      <section id="features" className="features-section">
        <div className="section-header">
          <p className="section-tag">Features</p>
          <h2>Everything you need for seamless meetings</h2>
        </div>

        <div className="features-grid">
          {features.map((f, i) => (
            <div className="feature-card" key={i}>
              <div className={`feature-icon ${f.accent ? "accent" : "default"}`}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="navLogo"><CamIcon /></div>
            <span>AirMeet</span>
          </div>
          <p>Built for the future of remote collaboration</p>
        </div>
      </footer>
    </div>
  );
}
