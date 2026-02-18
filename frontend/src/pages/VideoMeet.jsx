import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import io from "socket.io-client";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:8000";

const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

export default function VideoMeet() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const fileInputRef = useRef(null);

  // socket + webrtc
  const socketRef = useRef(null);
  const peersRef = useRef({}); // { socketId: RTCPeerConnection }
  const remoteVideoRefs = useRef({}); // { socketId: HTMLVideoElement }

  // media availability
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);

  // toggles
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);

  // chat
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);

  // lobby
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");

  // waiting room state (from backend)
  const [isWaiting, setIsWaiting] = useState(false);
  const [role, setRole] = useState("guest"); // "host" | "guest"

  // UI state
  const [layout, setLayout] = useState("grid");
  const [handRaised, setHandRaised] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [floatingReaction, setFloatingReaction] = useState(null);

  const [showParticipants, setShowParticipants] = useState(false);
  const [meetingTime, setMeetingTime] = useState("00:00");
  const [meetingStart, setMeetingStart] = useState(null);
  const [participantSearch, setParticipantSearch] = useState("");

  // UI-only recording
  const [isRecording, setIsRecording] = useState(false);

  const [meetingTitle, setMeetingTitle] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Polls (UI-only local)
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [activePoll, setActivePoll] = useState(null);
  const [myVote, setMyVote] = useState(null);

  // Settings (UI-only)
  const [noiseCancel, setNoiseCancel] = useState(true);
  const [hdVideo, setHdVideo] = useState(true);
  const [autoAdmit, setAutoAdmit] = useState(true);

  // participants from backend
  const [participants, setParticipants] = useState([]); // [{id,name}]
  const [waitingRoom, setWaitingRoom] = useState([]); // [{id,name,joinedAt}]
  const [remoteIds, setRemoteIds] = useState([]); // socketIds of remote users

  // ---------------------------
  // helpers
  // ---------------------------
const safePlay = useCallback((el) => {
  if (!el) return;
  const p = el.play?.();
  if (p) p.catch(() => {});
}, []);

const attachStream = useCallback((el, stream, muted = false) => {
  if (!el || !stream) return;
  el.srcObject = stream;
  el.muted = muted;
  el.playsInline = true;
  el.autoplay = true;
  safePlay(el);
}, [safePlay]);

  const toDisplayName = (id) => {
    const p = participants.find((x) => x.id === id);
    return p?.name || `Guest-${id?.slice?.(0, 5) || "??"}`;
  };

  const totalParticipants = remoteIds.length + 1;
  const getGridClass = () => {
    if (totalParticipants <= 1) return "cols-1";
    if (totalParticipants <= 4) return "cols-2";
    if (totalParticipants <= 9) return "cols-3";
    return "cols-4";
  };

  // ---------------------------
  // 1) get user media on mount
  // ---------------------------
  useEffect(() => {
    const getPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        window.localStream = stream;

        setVideoAvailable(stream.getVideoTracks().length > 0);
        setAudioAvailable(stream.getAudioTracks().length > 0);

        if (localVideoRef.current) {
          attachStream(localVideoRef.current, stream, true);
          localVideoRef.current.style.transform = "scaleX(-1)";
        }
      } catch (e) {
        console.error("Camera error:", e);
        setVideoAvailable(false);
        setAudioAvailable(false);
      }
    };

    getPermission();

    return () => {
      try {
        const s = window.localStream;
        if (s) s.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  // reattach local stream on view changes
  useEffect(() => {
    if (!askForUsername && !screen && window.localStream && localVideoRef.current) {
      attachStream(localVideoRef.current, window.localStream, true);
      localVideoRef.current.style.transform = "scaleX(-1)";
    }
  }, [askForUsername, layout, screen,attachStream]);

  // meeting title
  useEffect(() => {
    const saved = localStorage.getItem(`meeting_title_${roomId}`);
    if (saved) setMeetingTitle(saved);
  }, [roomId]);

  // timer
  useEffect(() => {
    if (!meetingStart) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - meetingStart) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const secs = String(elapsed % 60).padStart(2, "0");
      setMeetingTime(`${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [meetingStart]);

  // ---------------------------
  // WebRTC
  // ---------------------------
  const createPeer = useCallback((remoteSocketId) => {
    const pc = new RTCPeerConnection({ iceServers });

    const stream = window.localStream;
    if (stream) stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit("signal", remoteSocketId, { candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      const [remoteStream] = e.streams;
      if (!remoteStream) return;

      const el = remoteVideoRefs.current[remoteSocketId];
      if (el) attachStream(el, remoteStream, false);

      setRemoteIds((prev) => (prev.includes(remoteSocketId) ? prev : [...prev, remoteSocketId]));
    };

    peersRef.current[remoteSocketId] = pc;
    return pc;
  }, [attachStream]);

  const cleanupPeer = useCallback((id) => {
    try {
      peersRef.current[id]?.close();
    } catch {}
    delete peersRef.current[id];
    delete remoteVideoRefs.current[id];

    setRemoteIds((prev) => prev.filter((x) => x !== id));
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const closeAllPeers = useCallback(() => {
    Object.keys(peersRef.current).forEach((id) => {
      try {
        peersRef.current[id]?.close();
      } catch {}
    });
    peersRef.current = {};
    remoteVideoRefs.current = {};
    setRemoteIds([]);
  }, []);

  // ---------------------------
  // socket connect AFTER name submit
  // ---------------------------
  useEffect(() => {
    if (askForUsername) return;
    if (!roomId) return;

    const socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      // JOIN WITH WAITING ROOM FLOW ✅
      socket.emit("join-room", { roomId, name: username });

      // show myself in list (temporary, final list participants-update se sync hogi)
      setParticipants([{ id: socket.id, name: `${username} (You)` }]);
    });

    // guest is waiting
    socket.on("waiting", () => {
      setIsWaiting(true);
      setRole("guest");
    });

    // host sees waiting list updates
    socket.on("waiting-update", (list) => {
      setWaitingRoom(Array.isArray(list) ? list : []);
    });

    // admitted (host or guest)
    socket.on("join-approved", ({ role: r, participants: ids, waiting }) => {
      setIsWaiting(false);
      setRole(r || "guest");
      setMeetingStart(Date.now());

      // waiting list (host)
      setWaitingRoom(Array.isArray(waiting) ? waiting : []);

      // build participant names
      const cleanIds = Array.isArray(ids) ? ids : [];
      const mapped = cleanIds.map((id) => ({
        id,
        name: id === socket.id ? `${username} (You)` : `Guest-${id.slice(0, 5)}`,
      }));
      setParticipants(mapped);

      // remote tiles
      setRemoteIds(cleanIds.filter((id) => id !== socket.id));

      // attach local
      if (window.localStream && localVideoRef.current) {
        attachStream(localVideoRef.current, window.localStream, true);
        localVideoRef.current.style.transform = "scaleX(-1)";
      }
    });

    socket.on("denied", () => {
      alert("Host denied your entry.");
      setIsWaiting(false);
      handleEndCall(true);
    });

    // participants list push (backend emits ids)
    socket.on("participants-update", (ids) => {
      const cleanIds = Array.isArray(ids) ? ids : [];
      setParticipants((prev) => {
        const meName = `${username} (You)`;
        const prevMap = new Map(prev.map((p) => [p.id, p.name]));

        const next = cleanIds.map((id) => ({
          id,
          name: id === socket.id ? meName : prevMap.get(id) || `Guest-${id.slice(0, 5)}`,
        }));
        return next;
      });

      setRemoteIds(cleanIds.filter((id) => id !== socket.id));
    });

    // when someone is admitted -> server tells everyone
    socket.on("user-joined", async (newUserId, roomClients) => {
      // sync participants list (ids only)
      const ids = Array.isArray(roomClients) ? roomClients : [];
      setParticipants((prev) => {
        const prevMap = new Map(prev.map((p) => [p.id, p.name]));
        const meName = `${username} (You)`;

        const next = ids.map((id) => ({
          id,
          name: id === socket.id ? meName : prevMap.get(id) || `Guest-${id.slice(0, 5)}`,
        }));
        return next;
      });

      setRemoteIds(ids.filter((id) => id !== socket.id));

      // IMPORTANT: existing users should create offer to the newly joined user
      if (newUserId !== socket.id) {
        const pc = peersRef.current[newUserId] || createPeer(newUserId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("signal", newUserId, { sdp: pc.localDescription });
        } catch (e) {
          console.error("Offer error:", e);
        }
      }
    });

    socket.on("signal", async (fromId, payload) => {
      let pc = peersRef.current[fromId];
      if (!pc) pc = createPeer(fromId);

      try {
        if (payload?.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          if (payload.sdp.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("signal", fromId, { sdp: pc.localDescription });
          }
        } else if (payload?.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch (e) {
        console.error("Signal handling error:", e);
      }
    });

    socket.on("chat-message", (data, sender) => {
      setMessages((prev) => [...prev, { sender: sender || "Guest", data }]);
      if (!showChat) setNewMessages((p) => p + 1);
    });

    socket.on("user-left", (id) => {
      cleanupPeer(id);
      setMessages((prev) => [...prev, { sender: "System", data: `A user left`, type: "system" }]);
    });

    socket.on("host-changed", () => {
      // optional: you can show toast
      setMessages((prev) => [...prev, { sender: "System", data: `Host changed`, type: "system" }]);
    });

    return () => {
      try {
        socket.disconnect();
      } catch {}
      socketRef.current = null;
      closeAllPeers();
    };
  }, [askForUsername, roomId, username, createPeer, cleanupPeer, closeAllPeers]);

  // ---------------------------
  // actions
  // ---------------------------
  const connect = () => {
    setAskForUsername(false);
    // meetingStart will set when join-approved
  };

  const admitUser = (targetId) => {
    if (!socketRef.current) return;
    socketRef.current.emit("admit-user", { roomId, targetId });
  };

  const denyUser = (targetId) => {
    if (!socketRef.current) return;
    socketRef.current.emit("deny-user", { roomId, targetId });
  };

  // lobby camera/mic toggles
  const toggleLobbyCam = () => {
    const s = window.localStream;
    if (!s) return;
    const t = s.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setVideoAvailable(t.enabled);
    setVideo(t.enabled);
  };

  const toggleLobbyMic = () => {
    const s = window.localStream;
    if (!s) return;
    const t = s.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setAudioAvailable(t.enabled);
    setAudio(t.enabled);
  };

  // meeting controls
  const handleVideo = () => {
    setVideo((prev) => {
      const next = !prev;
      const s = window.localStream || localVideoRef.current?.srcObject;
      if (s) s.getVideoTracks().forEach((t) => (t.enabled = next));
      return next;
    });
  };

  const handleAudio = () => {
    setAudio((prev) => {
      const next = !prev;
      const s = window.localStream || localVideoRef.current?.srcObject;
      if (s) s.getAudioTracks().forEach((t) => (t.enabled = next));
      return next;
    });
  };

  const handleScreen = async () => {
    if (!screen) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });

        if (localVideoRef.current) {
          attachStream(localVideoRef.current, screenStream, true);
          localVideoRef.current.style.transform = "none";
        }

        screenStream.getVideoTracks()[0].onended = () => {
          setScreen(false);
          if (window.localStream && localVideoRef.current) {
            attachStream(localVideoRef.current, window.localStream, true);
            localVideoRef.current.style.transform = "scaleX(-1)";
          }
        };

        setScreen(true);
      } catch {}
    } else {
      setScreen(false);
      if (window.localStream && localVideoRef.current) {
        attachStream(localVideoRef.current, window.localStream, true);
        localVideoRef.current.style.transform = "scaleX(-1)";
      }
    }
  };

  const handleEndCall = (silent = false) => {
    if (!silent) {
      try {
        const s = window.localStream;
        if (s) s.getTracks().forEach((t) => t.stop());
      } catch {}
    }

    try {
      socketRef.current?.disconnect();
    } catch {}

    closeAllPeers();
    navigate("/home");
  };

  const toggleHandRaise = () => {
    setHandRaised((prev) => {
      const next = !prev;
      setMessages((msgs) => [
        ...msgs,
        { sender: "System", data: `${username} ${next ? "raised" : "lowered"} their hand`, type: "system" },
      ]);
      return next;
    });
  };

  const sendReaction = (emoji) => {
    setFloatingReaction(emoji);
    setShowReactions(false);
    setMessages((prev) => [...prev, { sender: username, data: emoji, type: "reaction" }]);
    setTimeout(() => setFloatingReaction(null), 2000);
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    socketRef.current?.emit("chat-message", message.trim(), username);
    setMessage("");
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const isImage = file.type.startsWith("image/");
      setMessages((prev) => [
        ...prev,
        { sender: username, data: reader.result, type: isImage ? "image" : "file", fileName: file.name },
      ]);
      if (!showChat) setNewMessages((p) => p + 1);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const toggleRecording = useCallback(() => {
    setIsRecording((prev) => {
      setMessages((msgs) => [
        ...msgs,
        { sender: "System", data: prev ? "Recording stopped (UI only)" : "Recording started (UI only)", type: "system" },
      ]);
      return !prev;
    });
    setShowMore(false);
  }, []);

  const createPoll = () => {
    const cleaned = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || cleaned.length < 2) return;

    setActivePoll({ question: pollQuestion, options: cleaned, votes: cleaned.map(() => 0) });
    setMessages((prev) => [...prev, { sender: "System", data: `Poll: "${pollQuestion}"`, type: "system" }]);

    setPollQuestion("");
    setPollOptions(["", ""]);
    setMyVote(null);
    setShowPollModal(false);
  };

  const votePoll = (index) => {
    if (myVote !== null || !activePoll) return;
    setMyVote(index);
    setActivePoll((prev) => {
      const newVotes = [...prev.votes];
      newVotes[index]++;
      return { ...prev, votes: newVotes };
    });
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/meet/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveMeetingTitle = (title) => {
    setMeetingTitle(title);
    localStorage.setItem(`meeting_title_${roomId}`, title);
    setShowTitleModal(false);
  };

  // ---------------------------
  // UI: LOBBY
  // ---------------------------
  if (askForUsername) {
    return (
      <div className="lobbyContainer">
        <header className="lobbyHeader">
          <div className="lobbyHeader-brand">
            <div className="navLogo" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span>AirMeet</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: "4px 12px", borderRadius: 8, background: "var(--bg-secondary)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Meeting: <span style={{ color: "var(--primary)", fontWeight: 600 }}>{roomId}</span>
            </div>
          </div>
        </header>

        <main className="lobbyMain">
          <div className="lobby-preview">
            <div className="lobby-preview-card">
              <div className="lobby-video-wrapper">
                <video ref={localVideoRef} autoPlay muted playsInline style={{ transform: "scaleX(-1)" }} />
                <div className="lobby-video-controls">
                  <button className={`lobby-control-btn ${videoAvailable ? "on" : "off"}`} onClick={toggleLobbyCam} disabled={!window.localStream}>
                    Camera
                  </button>
                  <button className={`lobby-control-btn ${audioAvailable ? "on" : "off"}`} onClick={toggleLobbyMic} disabled={!window.localStream}>
                    Mic
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lobby-form">
            <div className="lobby-form-card">
              <h1>Join Meeting</h1>
              <p>Enter your name to join the meeting</p>

              <div className="lobby-inputs">
                <div className="lobby-input-group">
                  <label>Your Name</label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && username.trim() && connect()}
                  />
                </div>
                <button className="lobby-join-btn" onClick={connect} disabled={!username.trim()}>
                  Continue
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ---------------------------
  // UI: WAITING SCREEN (guest)
  // ---------------------------
  if (isWaiting) {
    return (
      <div className="lobbyContainer" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div style={{ maxWidth: 520, padding: 24, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h2 style={{ marginBottom: 8 }}>Waiting for host approval…</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
            You are in the waiting room for <b>{roomId}</b>. Host will admit you.
          </p>
          <button className="btn-secondary" onClick={() => handleEndCall()}>
            Leave
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------
  // UI: MEETING ROOM
  // ---------------------------
  return (
    <div className="meetVideoContainer">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileSelect}
        accept="image/*,.pdf,.doc,.docx,.txt,.zip"
      />

      <header className="meetHeader">
        <div className="meetHeader-left">
          <span className="meetHeader-title" style={{ cursor: "pointer" }} onClick={() => setShowTitleModal(true)}>
            {meetingTitle || "AirMeet Meeting"}
          </span>
          <div className="meetHeader-badge">E2E Encrypted</div>
          <div className="meetHeader-badge" style={{ marginLeft: 8 }}>{role === "host" ? "Host" : "Guest"}</div>
        </div>

        <div className="meetHeader-right">
          <div className="layout-switcher">
            <button className={`layout-btn ${layout === "grid" ? "active" : ""}`} onClick={() => setLayout("grid")}>Grid</button>
            <button className={`layout-btn ${layout === "speaker" ? "active" : ""}`} onClick={() => setLayout("speaker")}>Speaker</button>
          </div>
        </div>
      </header>

      <div className="meetBody">
        <div className="meetMain">
          {activePoll && (
            <div style={{ marginBottom: 12, padding: 16, borderRadius: "var(--radius)", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Poll: {activePoll.question}</span>
                <button style={{ fontSize: "0.7rem", color: "var(--text-muted)" }} onClick={() => { setActivePoll(null); setMyVote(null); }}>
                  Dismiss
                </button>
              </div>

              {activePoll.options.map((opt, i) => {
                const totalVotes = activePoll.votes.reduce((a, b) => a + b, 0);
                const pct = totalVotes > 0 ? Math.round((activePoll.votes[i] / totalVotes) * 100) : 0;

                return (
                  <div key={i} className={`poll-option ${myVote === i ? "selected" : ""}`} onClick={() => votePoll(i)}>
                    <div className="poll-option-radio" />
                    <div style={{ flex: 1 }}>
                      <div className="poll-option-text">{opt}</div>
                      {myVote !== null && (
                        <div className="poll-results-bar">
                          <div className="poll-results-fill" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                    {myVote !== null && <span className="poll-option-count">{pct}%</span>}
                  </div>
                );
              })}
            </div>
          )}

          {layout === "grid" ? (
            <div className={`videoGrid ${getGridClass()}`}>
              {/* Local */}
              <div className="participantTile">
                {handRaised && <div className="hand-raise-indicator">{"\u270B"}</div>}
                <video ref={localVideoRef} autoPlay muted playsInline style={{ transform: "scaleX(-1)" }} />
                <div className="participantTile-info">
                  <div className="participantTile-name">
                    <span>{username} (You)</span>
                    {role === "host" && <span className="host-badge">Host</span>}
                  </div>
                </div>
              </div>

              {/* Remotes */}
              {remoteIds.map((id) => (
                <div className="participantTile" key={id}>
                  <video
                    ref={(el) => { if (el) remoteVideoRefs.current[id] = el; }}
                    autoPlay
                    playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div className="participantTile-info">
                    <div className="participantTile-name">
                      <span>{toDisplayName(id)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="speakerView">
              <div className="speakerMain">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover", transform: screen ? "none" : "scaleX(-1)" }}
                />
                <div className="speakerMain-info">
                  <div className="speakerMain-name">{username}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CHAT */}
        {showChat && (
          <div className="meetSidebar">
            <div className="sidePanel-header">
              <h3>Chat</h3>
              <button className="sidePanel-close" onClick={() => setShowChat(false)}>X</button>
            </div>

            <div className="chatMessages">
              {messages.map((item, index) => (
                <div key={index}>
                  {item.type === "system" ? (
                    <div style={{ textAlign: "center", margin: "12px 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {item.data}
                    </div>
                  ) : item.type === "reaction" ? (
                    <div style={{ textAlign: "center", margin: "8px 0", fontSize: "1.5rem" }}>{item.data}</div>
                  ) : item.type === "image" ? (
                    <div className={`chatMessage ${item.sender === username ? "isMe" : ""}`}>
                      <div className="chatMessage-content">
                        <div className={`chatMessage-bubble ${item.sender === username ? "me" : "other"}`} style={{ padding: 4 }}>
                          <img src={item.data} alt={item.fileName} style={{ maxWidth: "100%", borderRadius: 8, display: "block" }} />
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4, padding: "0 4px" }}>
                            {item.fileName}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : item.type === "file" ? (
                    <a href={item.data} download={item.fileName} style={{ textDecoration: "none" }}>
                      <div className="chatMessage-bubble file">{item.fileName}</div>
                    </a>
                  ) : (
                    <div className="chatMessage-bubble">
                      <b style={{ marginRight: 6 }}>{item.sender}:</b> {item.data}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="chatInput">
              <div className="chatInput-wrapper">
                <button onClick={() => fileInputRef.current?.click()} title="Attach">+</button>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button className="chatInput-send" onClick={sendMessage} disabled={!message.trim()}>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PARTICIPANTS */}
        {showParticipants && (
          <div className="meetSidebar">
            <div className="sidePanel-header">
              <h3>Participants ({participants.length})</h3>
              <button className="sidePanel-close" onClick={() => setShowParticipants(false)}>X</button>
            </div>

            <div className="participantsList-search" style={{ padding: "12px 16px" }}>
              <input
                type="text"
                placeholder="Search participants..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: "rgba(20, 26, 39, 0.5)",
                  color: "var(--text)",
                }}
              />
            </div>

            {/* WAITING ROOM (Host Only) ✅ */}
            {role === "host" && waitingRoom.length > 0 && (
              <div style={{ padding: "0 16px 12px" }}>
                <p style={{ color: "var(--primary)", marginBottom: 8 }}>Waiting to join ({waitingRoom.length})</p>

                {waitingRoom.map((p) => (
                  <div key={p.id} className="participantsList-item" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{p.name}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => admitUser(p.id)}>Admit</button>
                      <button onClick={() => denyUser(p.id)}>Deny</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="participantsList">
              {participants
                .filter((p) => (p.name || "").toLowerCase().includes(participantSearch.toLowerCase()))
                .map((p) => (
                  <div className="participantsList-item" key={p.id}>
                    <span>{p.name}</span>
                  </div>
                ))}
            </div>

            <button className="invite-btn" onClick={() => { setShowInviteModal(true); setShowParticipants(false); }}>
              Invite People
            </button>
          </div>
        )}
      </div>

      {/* CONTROLS */}
      <div className="meetControls">
        {floatingReaction && <div className="floating-reaction">{floatingReaction}</div>}

        {showReactions && (
          <div className="reactions-popup">
            <div className="reactions-popup-inner">
              {["👍", "👏", "❤️", "😂", "😮", "🎉", "🔥", "💯"].map((e) => (
                <button key={e} className="reaction-btn" onClick={() => sendReaction(e)}>{e}</button>
              ))}
            </div>
          </div>
        )}

        {showMore && (
          <div className="more-popup">
            <div className="more-popup-inner">
              <button className="more-popup-item" onClick={toggleRecording}>
                {isRecording ? "Stop Recording" : "Start Recording"}
              </button>
              <button className="more-popup-item" onClick={() => { setShowPollModal(true); setShowMore(false); }}>
                Polls
              </button>
              <button className="more-popup-item" onClick={() => { setShowSettingsModal(true); setShowMore(false); }}>
                Settings
              </button>
            </div>
          </div>
        )}

        <div className="meetControls-left">
          <div className="meetControls-timer">
            <span>{isRecording ? "REC " : ""}{meetingTime}</span>
          </div>
          <button className="meetControls-meta-btn" onClick={copyMeetingLink}>
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>

        <div className="meetControls-center">
          <button className={`control-btn ${audio ? "default" : "off"}`} onClick={handleAudio}>Mic</button>
          <button className={`control-btn ${video ? "default" : "off"}`} onClick={handleVideo}>Cam</button>
          <button className={`control-btn ${screen ? "active" : "default"}`} onClick={handleScreen}>Screen</button>
          <button className={`control-btn ${handRaised ? "active" : "default"}`} onClick={toggleHandRaise}>Hand</button>

          <button className="control-btn default" onClick={() => { setShowReactions((p) => !p); setShowMore(false); }}>🙂</button>
          <button className="control-btn default" onClick={() => { setShowMore((p) => !p); setShowReactions(false); }}>⋯</button>

          <button className="control-end-btn" onClick={() => handleEndCall(false)}>End</button>
        </div>

        <div className="meetControls-right">
          <button className={`panel-toggle-btn ${showParticipants ? "active" : ""}`} onClick={() => { setShowParticipants((p) => !p); setShowChat(false); }}>
            People ({participants.length})
          </button>
          <button className={`panel-toggle-btn ${showChat ? "active" : ""}`} onClick={() => { setShowChat((p) => !p); setShowParticipants(false); setNewMessages(0); }}>
            Chat {newMessages > 0 ? `(${newMessages})` : ""}
          </button>
        </div>
      </div>

      {/* INVITE MODAL */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowInviteModal(false)}>
          <div className="modal-card">
            <h2>Invite People</h2>

            <label>Meeting Code</label>
            <div className="invite-copy-box">
              <input type="text" value={roomId || ""} readOnly />
              <button
                className="invite-copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(roomId || "");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <label>Meeting Link</label>
            <div className="invite-copy-box">
              <input type="text" value={`${window.location.origin}/meet/${roomId}`} readOnly />
              <button className="invite-copy-btn" onClick={copyMeetingLink}>
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>

            <button className="modal-btn-primary" onClick={() => setShowInviteModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* POLL MODAL */}
      {showPollModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowPollModal(false)}>
          <div className="modal-card">
            <h2>Create a Poll</h2>

            <label>Question</label>
            <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} />

            <label>Options</label>
            {pollOptions.map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  value={opt}
                  onChange={(e) => {
                    const next = [...pollOptions];
                    next[i] = e.target.value;
                    setPollOptions(next);
                  }}
                />
                {pollOptions.length > 2 && (
                  <button className="modal-btn-cancel" onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>
                    Remove
                   </button>
                )}
              </div>
            ))}

            {pollOptions.length < 6 && (
              <button className="modal-btn-primary" onClick={() => setPollOptions([...pollOptions, ""])}>+ Add option</button>
            )}

            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setShowPollModal(false)}>Cancel</button>
              <button className="modal-btn-primary" onClick={createPoll}>Launch Poll</button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowSettingsModal(false)}>
          <div className="modal-card">
            <h2>Meeting Settings</h2>

            <div className="settings-option">
              <div>
                <div className="settings-option-label">Noise Cancellation</div>
                <div className="settings-option-desc">Reduces background noise</div>
              </div>
              <div className={`toggle-switch ${noiseCancel ? "on" : ""}`} onClick={() => setNoiseCancel((p) => !p)} />
            </div>

            <div className="settings-option">
              <div>
                <div className="settings-option-label">HD Video</div>
                <div className="settings-option-desc">Higher quality video stream</div>
              </div>
              <div className={`toggle-switch ${hdVideo ? "on" : ""}`} onClick={() => setHdVideo((p) => !p)} />
            </div>

            <div className="settings-option">
              <div>
                <div className="settings-option-label">Auto-admit</div>
                <div className="settings-option-desc">Automatically admit participants</div>
              </div>
              <div className={`toggle-switch ${autoAdmit ? "on" : ""}`} onClick={() => setAutoAdmit((p) => !p)} />
            </div>

            <div className="modal-actions">
              <button className="modal-btn-primary" onClick={() => setShowSettingsModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* TITLE MODAL */}
      {showTitleModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowTitleModal(false)}>
          <div className="modal-card">
            <h2>Edit Meeting Title</h2>

            <input
              type="text"
              defaultValue={meetingTitle}
              onKeyDown={(e) => e.key === "Enter" && saveMeetingTitle(e.target.value)}
            />

            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setShowTitleModal(false)}>Cancel</button>
              <button
                className="modal-btn-primary"
                onClick={() => {
                  const input = document.querySelector('.modal-card input[type="text"]');
                  if (input) saveMeetingTitle(input.value);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
