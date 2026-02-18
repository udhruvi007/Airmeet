import axios from "axios";
import server from "../environment";

const API = axios.create({
  baseURL: `http://localhost:8000/api/v1/users`,
  headers: {
    "Content-Type": "application/json"
  }
});

export const loginApi = (username, password) =>
  API.post("/login", { username, password });

export const registerApi = (name, username, password) =>
  API.post("/register", { name, username, password });
