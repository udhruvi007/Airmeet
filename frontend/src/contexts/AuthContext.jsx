import React, { createContext, useMemo, useState, useCallback} from "react";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();

  const [userData, setUserData] = useState({});

  // ---------- helpers ----------
 const getCurrentUser = useCallback(
  () => localStorage.getItem("airmeet_current_user") || "",
  []
);

const historyKey = useCallback(
  () => `airmeet_history_${getCurrentUser() || "guest"}`,
  [getCurrentUser]
);


const handleRegister = useCallback(async (name, username, password) => {
  const users = JSON.parse(localStorage.getItem("airmeet_users") || "[]");
  const exists = users.find((u) => u.username === username);
  if (exists) throw new Error("User already exists");

  users.push({ name, username, password });
  localStorage.setItem("airmeet_users", JSON.stringify(users));

  return "Registration successful! Please sign in.";
}, []);

const handleLogin = useCallback(async (username, password) => {
  const users = JSON.parse(localStorage.getItem("airmeet_users") || "[]");

  const user = users.find((u) => u.username === username && u.password === password);
  if (!user) throw new Error("Invalid username or password");

  localStorage.setItem("token", "demo-token-" + username);
  localStorage.setItem("airmeet_current_user", username);

  setUserData({ name: user.name, username: user.username });
  navigate("/home");
}, [navigate]);

const handleLogout = useCallback(() => {
  localStorage.removeItem("token");
  localStorage.removeItem("airmeet_current_user");
  setUserData({});
  navigate("/");
}, [navigate]);

const getHistoryOfUser = useCallback(async () => {
  const key = historyKey();
  const history = JSON.parse(localStorage.getItem(key) || "[]");
  return Array.isArray(history) ? history : [];
}, [historyKey]);

const addToUserHistory = useCallback(async (meetingCode) => {
  if (!meetingCode) return;

  const key = historyKey();
  const history = JSON.parse(localStorage.getItem(key) || "[]");

  history.push({ meeting_code: meetingCode, date: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(history));
}, [historyKey]);

 const value = useMemo(
  () => ({
    userData,
    setUserData,
    handleRegister,
    handleLogin,
    handleLogout,
    addToUserHistory,
    getHistoryOfUser,
  }),
  [
    userData,
    handleRegister,
    handleLogin,
    handleLogout,
    addToUserHistory,
    getHistoryOfUser,
  ]
);


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
