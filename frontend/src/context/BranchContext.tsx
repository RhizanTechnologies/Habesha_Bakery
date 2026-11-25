'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { api } from '@/lib/axios';

export interface Branch {
  id: string;
  name: string;
  code?: string | null;
  isHub?: boolean;
  address?: string | null;
  location?: string;
  phone?: string;
  isActive?: boolean;
}

interface BranchContextType {
  branches: Branch[];
  selectedBranchId: string | null; // null means 'ALL' branches for OWNER
  selectedBranch: Branch | null;
  setSelectedBranchId: (id: string | null) => void;
  isLoadingBranches: boolean;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('erp_branches');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  const fetchBranches = async (silent = false) => {
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) return;
    if (!silent && branches.length === 0) setIsLoadingBranches(true);
    try {
      const { data } = await api.get<Branch[]>('/branches');
      const validBranches = Array.isArray(data) ? data : [];
      const sorted = [...validBranches].sort((a, b) => {
        if (a.isHub && !b.isHub) return -1;
        if (!a.isHub && b.isHub) return 1;
        const aIsMain = a.name.toLowerCase().includes('main') || a.name.toLowerCase().includes('hub');
        const bIsMain = b.name.toLowerCase().includes('main') || b.name.toLowerCase().includes('hub');
        if (aIsMain && !bIsMain) return -1;
        if (!aIsMain && bIsMain) return 1;
        return a.name.localeCompare(b.name);
      });
      setBranches(sorted);
      try {
        localStorage.setItem('erp_branches', JSON.stringify(validBranches));
      } catch {}

      setSelectedBranchIdState((prev) => {
        const savedBranch = typeof window !== 'undefined' ? localStorage.getItem('selectedBranchId') : null;
        const currentTarget = prev || (savedBranch && savedBranch !== 'ALL' ? savedBranch : null);
        if (currentTarget) {
          const exists = validBranches.some((b) => b.id === currentTarget);
          if (!exists) {
            try {
              localStorage.setItem('selectedBranchId', 'ALL');
            } catch {}
            return null;
          }
        }
        return prev;
      });
    } catch (e) {
      console.error('Failed to fetch branches:', e);
    } finally {
      if (!silent) setIsLoadingBranches(false);
    }
  };

  const refreshBranches = async () => {
    if (!user || (typeof window !== 'undefined' && !localStorage.getItem('token'))) return;
    if (user.role === 'OWNER') {
      await fetchBranches(true);
    } else if (user.branch) {
      setBranches([user.branch]);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) return;

    if (user.role === 'OWNER') {
      // Owner can see all branches or select a specific branch
      const savedBranch = localStorage.getItem('selectedBranchId');
      setSelectedBranchIdState(savedBranch === 'ALL' || !savedBranch ? null : savedBranch);
      fetchBranches();
    } else {
      // Admin / Staff locked to their assigned branchId
      setSelectedBranchIdState(user.branchId || null);
      if (user.branch) {
        setBranches([user.branch]);
      }
    }
  }, [user]);

  useEffect(() => {
    const handleSync = () => {
      refreshBranches();
    };
    window.addEventListener('erp_branches_updated', handleSync);
    return () => window.removeEventListener('erp_branches_updated', handleSync);
  }, [user]);

  const setSelectedBranchId = (id: string | null) => {
    setSelectedBranchIdState(id);
    if (id === null) {
      localStorage.setItem('selectedBranchId', 'ALL');
    } else {
      localStorage.setItem('selectedBranchId', id);
    }
  };

  const selectedBranch = selectedBranchId
    ? branches.find((b) => b.id === selectedBranchId) || null
    : null;

  return (
    <BranchContext.Provider value={{ branches, selectedBranchId, selectedBranch, setSelectedBranchId, isLoadingBranches, refreshBranches }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};
