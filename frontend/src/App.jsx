import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SharePage from './pages/SharePage'
import PWABanner from './components/PWABanner'

const Guard = ({ children }) =>
  localStorage.getItem('tv_token') ? children : <Navigate to="/login" replace />

export default function App() {
  return (
    <BrowserRouter>
      <PWABanner />
      <Routes>
        <Route path="/login"        element={<Login />} />
        <Route path="/share/:token" element={<SharePage />} />
        <Route path="/*"            element={<Guard><Dashboard /></Guard>} />
      </Routes>
    </BrowserRouter>
  )
}
