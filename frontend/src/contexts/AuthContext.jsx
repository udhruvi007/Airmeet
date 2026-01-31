import React, { createContext } from "react";
import { loginApi, registerApi } from "../api/authApi";

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {

  const handleLogin = async (username, password) => {
    const res = await loginApi(username, password);
    return res.data;
  };

  const handleRegister = async (name, username, password) => {
    const res = await registerApi(name, username, password);
    return res.data.message || "Registered Successfully";
  };

  return (
    <AuthContext.Provider value={{ handleLogin, handleRegister }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
