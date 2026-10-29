import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import apiService from '../api/apiService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('saepcs_token') || null);
  const [isApiLive, setIsApiLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiChecking, setApiChecking] = useState(true);
  const isMountedRef = useRef(true);

  // 1. Verify backend health
  const verifyBackendHealth = useCallback(async () => {
    try {
      setApiChecking(true);
      const res = await apiService.checkHealth();
      const online = Boolean(
        res.connected &&
        (res.data?.status === 'healthy' || res.data?.ready !== undefined || res.data?.uptime !== undefined)
      );
      if (isMountedRef.current) {
        setIsApiLive(online);
      }
      return online;
    } catch {
      if (isMountedRef.current) {
        setIsApiLive(false);
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setApiChecking(false);
      }
    }
  }, []);

  // 2. Health check & authentication session initialization with auto-retry
  useEffect(() => {
    isMountedRef.current = true;
    let timer = null;

    const runInitCheck = async (attempt = 1) => {
      const online = await verifyBackendHealth();
      if (!isMountedRef.current) return;

      const savedToken = localStorage.getItem('saepcs_token');

      if (online) {
        if (savedToken) {
          try {
            const res = await apiService.getMe();
            if (res.data?.user && isMountedRef.current) {
              setUser(res.data.user);
              setToken(savedToken);
            }
          } catch (err) {
            if (err.response?.status === 401) {
              // Token actually expired/invalid -> clear
              localStorage.removeItem('saepcs_token');
              localStorage.removeItem('saepcs_user');
              if (isMountedRef.current) {
                setUser(null);
                setToken(null);
              }
            }
          }
        }
        if (isMountedRef.current) {
          setLoading(false);
        }
        // Periodic background heartbeat every 15 seconds
        timer = setTimeout(() => runInitCheck(1), 15000);
      } else {
        // If offline during initial start, retry quickly up to 6 times (every 1s)
        if (attempt <= 6) {
          timer = setTimeout(() => runInitCheck(attempt + 1), 1000);
        } else {
          // If still offline, unlock loading screen so UI can show connection status and retry option
          if (isMountedRef.current) {
            setLoading(false);
          }
          // Continue background polling every 6 seconds to recover automatically
          timer = setTimeout(() => runInitCheck(7), 6000);
        }
      }
    };

    runInitCheck();

    return () => {
      isMountedRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [verifyBackendHealth]);

  // Standard Credentials Login (Email & Password Required)
  const login = async (email, password) => {
    if (!email || !password) {
      throw new Error('Please enter both User ID (email) and password.');
    }

    setLoading(true);
    try {
      const res = await apiService.login({
        email: email.trim().toLowerCase(),
        password,
      });

      const { token: jwtToken, user: userData } = res.data;
      if (!jwtToken || !userData) {
        throw new Error('Invalid authentication response from server.');
      }

      localStorage.setItem('saepcs_token', jwtToken);
      localStorage.setItem('saepcs_user', JSON.stringify(userData));
      setToken(jwtToken);
      setUser(userData);
      setIsApiLive(true);
      return { success: true, user: userData };
    } catch (err) {
      // Re-verify health on failure in case server connection changed
      verifyBackendHealth();
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Authentication failed. Please verify your User ID and password.';
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('saepcs_token');
    localStorage.removeItem('saepcs_user');
    setUser(null);
    setToken(null);
  };

  const role = user?.role || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isApiLive,
        apiChecking,
        loading,
        login,
        logout,
        verifyBackendHealth,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
