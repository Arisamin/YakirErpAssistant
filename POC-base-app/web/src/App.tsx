import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Suppliers from './pages/Suppliers';
import Contracts from './pages/Contracts';
import BillingDocs from './pages/BillingDocs';
import Labor from './pages/Labor';
import Collections from './pages/Collections';
import Reports from './pages/Reports';
import Permissions from './pages/Permissions';
import Import from './pages/Import';

function Protected() {
  const { me, loading } = useAuth();
  if (loading) return <div className="center-msg">טוען…</div>;
  if (!me) return <Navigate to="/login" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected />}>
            <Route path="/" element={<Overview />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/labor" element={<Labor />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/docs" element={<BillingDocs />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/import" element={<Import />} />
            <Route path="/permissions" element={<Permissions />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
