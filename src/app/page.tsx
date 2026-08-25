"use client";

import { useState } from "react";
import { Phone, Shield, Zap, Clock } from "lucide-react";
import { businesses, BusinessConfig } from "@/lib/config/businesses";
import { BusinessCard } from "@/components/BusinessCard";
import { VoiceCall } from "@/components/VoiceCall";

export default function Home() {
  const [activeBusiness, setActiveBusiness] = useState<BusinessConfig | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-10 dark:opacity-20" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
              <Phone className="w-4 h-4" />
              <span>KI-Telefonassistent Demo</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
              Ihr intelligenter
              <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Telefonassistent
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
              24/7 erreichbar, professionell und freundlich. 
              Testen Sie jetzt unseren KI-Assistenten für Kleinunternehmen.
            </p>

            {/* Features */}
            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>Sofortige Antworten</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-500" />
                <span>24/7 verfügbar</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-500" />
                <span>Deutsch & Englisch</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Demo Section */}
      <main className="max-w-6xl mx-auto px-4 pb-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Wählen Sie ein Demo-Unternehmen
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Klicken Sie auf &ldquo;Testanruf starten&rdquo; um den Assistenten auszuprobieren
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {businesses.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              onCall={() => setActiveBusiness(business)}
            />
          ))}
        </div>

        {/* How it works */}
        <section className="mt-20">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-10">
            So funktioniert es
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">1</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Demo wählen
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Wählen Sie ein Demo-Unternehmen aus den verfügbaren Optionen
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-purple-600 dark:text-purple-400">2</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Mikrofon erlauben
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Erlauben Sie den Zugriff auf Ihr Mikrofon für das Gespräch
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-pink-600 dark:text-pink-400">3</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Loslegen
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sprechen Sie mit dem KI-Assistenten wie am Telefon
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Powered by{" "}
            <a
              href="https://x.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Grok Voice
            </a>{" "}
            | Demo-Projekt für KI-Telefonassistenten
          </p>
        </div>
      </footer>

      {/* Voice Call Modal */}
      {activeBusiness && (
        <VoiceCall
          business={activeBusiness}
          onEnd={() => setActiveBusiness(null)}
        />
      )}
    </div>
  );
}
