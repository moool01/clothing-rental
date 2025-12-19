import React from 'react';
import Index from "./pages/Index";
import { Login } from "./pages/Login";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

const AppContent = () => {
  const { role } = useAuth();

  if (!role) {
    return <Login />;
  }

  return <Index />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
