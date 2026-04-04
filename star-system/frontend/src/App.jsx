import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/shared/Sidebar'
import Dashboard   from './pages/Dashboard'
import RegionsPage from './pages/Regions'
import TeachersPage from './pages/Teachers'
import ImportPage  from './pages/Import'
import Register    from './pages/Register'

function Layout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register"  element={<Register />} />
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/regions"   element={<Layout><RegionsPage /></Layout>} />
        <Route path="/teachers"  element={<Layout><TeachersPage /></Layout>} />
        <Route path="/import"    element={<Layout><ImportPage /></Layout>} />
        <Route path="*"          element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}