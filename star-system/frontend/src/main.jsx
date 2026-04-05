/**
 * Application Entry Point
 *
 * This is the main entry file that bootstraps the React application.
 * It renders the App component into the root DOM element.
 *
 * React.StrictMode is enabled for development warnings about:
 * - Unsafe lifecycle methods
 * - Deprecated APIs
 * - Side effects in render
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Create root and render the application
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)