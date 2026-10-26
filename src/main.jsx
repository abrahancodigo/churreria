import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Plus Jakarta Sans self-hosted: mismos pesos que usa la interfaz (400-800),
// servidos del mismo origen (sin Google Fonts ni peticiones render-blocking).
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import '@fontsource/plus-jakarta-sans/800.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
