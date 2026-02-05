import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import App from './App';
import './index.css';

// AuthProvider is now conditionally applied in App.jsx based on tenant context
// This allows the main domain to work without AuthProvider initialization

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LfPOyQsAAAAAJ6IWoXxLkAJFFJieigBc8sfNdZX';

ReactDOM.createRoot(document.getElementById('root')).render(
  <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </GoogleReCaptchaProvider>
);
