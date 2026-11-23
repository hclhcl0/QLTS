import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import Layout from './components/Layout';
import Login from './pages/Login';
import Welcome from './pages/Welcome';

// Lazy-loaded route pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Assets = lazy(() => import('./pages/Assets'));
const AssetDetail = lazy(() => import('./pages/AssetDetail'));
const AssetForm = lazy(() => import('./pages/AssetForm'));
const Transfers = lazy(() => import('./pages/Transfers'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Disposals = lazy(() => import('./pages/Disposals'));
const Depreciation = lazy(() => import('./pages/Depreciation'));
const Calibration = lazy(() => import('./pages/Calibration'));
const PlannedMaintenance = lazy(() => import('./pages/PlannedMaintenance'));
const QRScanner = lazy(() => import('./pages/QRScanner'));
const Departments = lazy(() => import('./pages/Departments'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ 
  children, 
  adminOnly = false, 
  allowedRoles 
}: { 
  children: React.ReactNode; 
  adminOnly?: boolean; 
  allowedRoles?: string[]; 
}) {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400">
          Đang tải giao diện...
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/qr/:assetCode" element={<AssetDetail />} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/assets/new" element={<AssetForm />} />
          <Route path="/assets/:id" element={<AssetDetail />} />
          <Route path="/assets/:id/edit" element={<AssetForm />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/planned-maintenance" element={
            <ProtectedRoute allowedRoles={['ADMIN', 'VIEWER', 'MANAGER_DUOC', 'DEPARTMENT']}>
              <PlannedMaintenance />
            </ProtectedRoute>
          } />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/disposals" element={<Disposals />} />
          <Route path="/depreciation" element={<Depreciation />} />
          <Route path="/calibration" element={<Calibration />} />
          <Route path="/qr-scanner" element={<QRScanner />} />
          <Route path="/departments" element={
            <ProtectedRoute adminOnly><Departments /></ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute adminOnly><Users /></ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute adminOnly><Settings /></ProtectedRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
