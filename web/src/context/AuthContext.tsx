import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, GuestWorkspace } from '../types';
import { api } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  workspaceId: string | null;
  isGuest: boolean;
  recoveryKey: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  continueAsGuest: (name?: string) => Promise<{ workspaceId: string; recoveryKey: string }>;
  recoverGuest: (recoveryKey: string) => Promise<void>;
  setGuestSession: (token: string, workspace: GuestWorkspace, recoveryKey?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('pocketprint_token'));
  const [workspaceId, setWorkspaceId] = useState<string | null>(localStorage.getItem('pocketprint_workspace_id'));
  const [isGuest, setIsGuest] = useState<boolean>(localStorage.getItem('pocketprint_is_guest') === 'true');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(localStorage.getItem('pocketprint_recovery_key'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function initAuth() {
      if (token) {
        try {
          const res = await api.getMe();
          setUser(res.user);
          if (res.workspaceId) {
            setWorkspaceId(res.workspaceId);
            localStorage.setItem('pocketprint_workspace_id', res.workspaceId);
          }
          connectSocket(token);
        } catch (e) {
          console.warn('Session expired or invalid, clearing local session');
          logout();
        }
      }
      setIsLoading(false);
    }
    initAuth();
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('pocketprint_token', newToken);
    localStorage.setItem('pocketprint_workspace_id', newUser.id);
    localStorage.setItem('pocketprint_is_guest', 'false');
    localStorage.removeItem('pocketprint_recovery_key');
    setToken(newToken);
    setUser(newUser);
    setWorkspaceId(newUser.id);
    setIsGuest(false);
    setRecoveryKey(null);
    connectSocket(newToken);
  };

  const continueAsGuest = async (name?: string) => {
    const res = await api.createGuestWorkspace(name);
    const { token: guestToken, workspace, recoveryKey: recKey } = res;
    localStorage.setItem('pocketprint_token', guestToken);
    localStorage.setItem('pocketprint_workspace_id', workspace.id);
    localStorage.setItem('pocketprint_is_guest', 'true');
    localStorage.setItem('pocketprint_recovery_key', recKey);

    setToken(guestToken);
    setWorkspaceId(workspace.id);
    setIsGuest(true);
    setRecoveryKey(recKey);
    setUser({
      id: workspace.id,
      email: `guest-${workspace.id.slice(-6)}@pocketprint.local`,
      name: workspace.name,
    });
    connectSocket(guestToken);
    return { workspaceId: workspace.id, recoveryKey: recKey };
  };

  const recoverGuest = async (key: string) => {
    const res = await api.recoverGuestWorkspace(key);
    const { token: guestToken, workspace } = res;
    localStorage.setItem('pocketprint_token', guestToken);
    localStorage.setItem('pocketprint_workspace_id', workspace.id);
    localStorage.setItem('pocketprint_is_guest', 'true');
    localStorage.setItem('pocketprint_recovery_key', key);

    setToken(guestToken);
    setWorkspaceId(workspace.id);
    setIsGuest(true);
    setRecoveryKey(key);
    setUser({
      id: workspace.id,
      email: `guest-${workspace.id.slice(-6)}@pocketprint.local`,
      name: workspace.name,
    });
    connectSocket(guestToken);
  };

  const setGuestSession = (newToken: string, workspace: GuestWorkspace, recKey?: string) => {
    localStorage.setItem('pocketprint_token', newToken);
    localStorage.setItem('pocketprint_workspace_id', workspace.id);
    localStorage.setItem('pocketprint_is_guest', 'true');
    if (recKey) localStorage.setItem('pocketprint_recovery_key', recKey);

    setToken(newToken);
    setWorkspaceId(workspace.id);
    setIsGuest(true);
    if (recKey) setRecoveryKey(recKey);
    setUser({
      id: workspace.id,
      email: `guest-${workspace.id.slice(-6)}@pocketprint.local`,
      name: workspace.name,
    });
    connectSocket(newToken);
  };

  const logout = () => {
    localStorage.removeItem('pocketprint_token');
    localStorage.removeItem('pocketprint_workspace_id');
    localStorage.removeItem('pocketprint_is_guest');
    localStorage.removeItem('pocketprint_recovery_key');
    setToken(null);
    setUser(null);
    setWorkspaceId(null);
    setIsGuest(false);
    setRecoveryKey(null);
    disconnectSocket();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        workspaceId,
        isGuest,
        recoveryKey,
        isLoading,
        login,
        continueAsGuest,
        recoverGuest,
        setGuestSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
