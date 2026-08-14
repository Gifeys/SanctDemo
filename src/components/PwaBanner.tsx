import React, { useState } from "react";
import { Download, FileCode, CheckCircle, HelpCircle, Layers, Clipboard, Globe } from "lucide-react";

export default function PwaBanner() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const manifestJson = `{
  "short_name": "SanctiWalk",
  "name": "SanctiWalk Pilgrim Guide",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "/icons/icon-512.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ],
  "start_url": "/?source=pwa",
  "background_color": "#5A5A40",
  "theme_color": "#5A5A40",
  "display": "standalone",
  "orientation": "portrait"
}`;

  const serviceWorkerCode = `// public/sw.js
const CACHE_NAME = 'sanctiwalk-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css',
  '/src/data.ts',
  '/favicon.ico'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});`;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2500);
  };

  return (
    <div className="p-4 bg-[#F5F5F0] space-y-6">
      {/* Overview Card */}
      <div className="bg-[#5A5A40] text-white p-5 rounded-3xl shadow-sm relative overflow-hidden border border-[#D6D6C2]">
        <div className="absolute right-0 bottom-0 opacity-10 translate-y-4 translate-x-4">
          <Layers className="w-48 h-48" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="text-[10px] uppercase font-bold tracking-widest text-[#C2A649] font-serif italic">
            STI College - Capstone 2 Toolkit
          </div>
          <h2 className="text-xl font-bold font-serif italic tracking-tight">
            How to Pitch PWA for Capstone 2
          </h2>
          <p className="text-xs text-[#EBEBE0] leading-relaxed max-w-sm font-sans">
            Presenting a PWA solves the cross-platform mobile limitation elegantly. You maintain a single React codebase, deploy instantly, and fulfill all requirements of a high-grade software thesis!
          </p>
        </div>
      </div>

      {/* Slideout FAQ Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-[#4A4A35] flex items-center gap-1.5 font-serif italic">
          <HelpCircle className="w-4 h-4 text-[#5A5A40]" /> STI Panel Q&A Defense Prep
        </h3>
        
        <div className="space-y-2.5">
          <div className="p-3 bg-[#EBEBE0]/30 rounded-2xl border border-[#D6D6C2] space-y-1">
            <h4 className="text-xs font-bold text-[#4A4A35] font-serif italic">
              Q: Why build a PWA instead of native iOS & Android apps?
            </h4>
            <p className="text-xs text-[#8A8A70] leading-relaxed font-sans">
              <strong>Answer:</strong> Native iOS requires Xcode and macOS (not accessible with Windows laptops). Developing separate Kotlin and Swift apps doubles development overhead. A PWA provides a single, cost-effective codebase that runs cross-platform natively, utilizing Service Workers to work offline.
            </p>
          </div>

          <div className="p-3 bg-[#EBEBE0]/30 rounded-2xl border border-[#D6D6C2] space-y-1">
            <h4 className="text-xs font-bold text-[#4A4A35] font-serif italic">
              Q: Can a PWA use hardware like Geolocation & Cameras?
            </h4>
            <p className="text-xs text-[#8A8A70] leading-relaxed font-sans">
              <strong>Answer:</strong> Yes, modern browsers grant PWAs full native-like hardware access via standardized Web APIs (such as `navigator.geolocation` and `MediaDevices`). No App Store compilation required!
            </p>
          </div>
        </div>
      </div>

      {/* Code assets */}
      <div className="space-y-4 border-t border-[#D6D6C2] pt-4">
        <h3 className="text-sm font-bold text-[#4A4A35] flex items-center gap-1.5 font-serif italic">
          <FileCode className="w-4 h-4 text-[#5A5A40]" /> PWA Blueprint Code Files
        </h3>
        <p className="text-xs text-[#8A8A70] font-sans">
          Copy these directly into your project directory for full desktop and mobile installation capability.
        </p>

        {/* manifest.json */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] font-bold text-[#5A5A40] bg-[#EBEBE0] px-2.5 py-1 rounded-md border border-[#D6D6C2]">
              public/manifest.json
            </span>
            <button
              onClick={() => copyToClipboard(manifestJson, "manifest")}
              className="flex items-center gap-1 text-[#5A5A40] hover:underline font-bold text-[11px] uppercase tracking-wider"
            >
              {copiedText === "manifest" ? (
                <>
                  <CheckCircle className="w-3 h-3 text-green-700" /> Copied!
                </>
              ) : (
                <>
                  <Clipboard className="w-3 h-3" /> Copy Schema
                </>
              )}
            </button>
          </div>
          <pre className="p-3 bg-[#33332D] text-[#C2A649] font-mono text-[10px] rounded-2xl overflow-x-auto max-h-[160px] border border-[#D6D6C2]/40">
            {manifestJson}
          </pre>
        </div>

        {/* sw.js */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] font-bold text-[#5A5A40] bg-[#EBEBE0] px-2.5 py-1 rounded-md border border-[#D6D6C2]">
              public/sw.js (Service Worker)
            </span>
            <button
              onClick={() => copyToClipboard(serviceWorkerCode, "sw")}
              className="flex items-center gap-1 text-[#5A5A40] hover:underline font-bold text-[11px] uppercase tracking-wider"
            >
              {copiedText === "sw" ? (
                <>
                  <CheckCircle className="w-3 h-3 text-green-700" /> Copied!
                </>
              ) : (
                <>
                  <Clipboard className="w-3 h-3" /> Copy Code
                </>
              )}
            </button>
          </div>
          <pre className="p-3 bg-[#33332D] text-[#EBEBE0] font-mono text-[10px] rounded-2xl overflow-x-auto max-h-[160px] border border-[#D6D6C2]/40">
            {serviceWorkerCode}
          </pre>
        </div>
      </div>

      <div className="p-4 bg-[#E0E2D1] border border-[#D6D6C2] rounded-2xl flex items-start gap-2.5">
        <Globe className="w-4 h-4 text-[#5A5A40] shrink-0 mt-0.5" />
        <div className="text-xs text-[#4A4A35] space-y-1">
          <p className="font-bold font-serif italic">Instant Cloud Deployment Ready!</p>
          <p className="leading-relaxed font-sans text-xs text-[#5A5A40]">
            Because this is deployed as a secure full-stack web application, you can test it on your actual iPhone or Android phone immediately by visiting the **Shared App URL** at the top right of your screen! No Xcode or Windows emulators needed.
          </p>
        </div>
      </div>
    </div>
  );
}
