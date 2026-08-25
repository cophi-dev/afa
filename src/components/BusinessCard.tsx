"use client";

import { Phone, Clock, Wrench } from "lucide-react";
import { BusinessConfig } from "@/lib/config/businesses";

interface BusinessCardProps {
  business: BusinessConfig;
  onCall: () => void;
}

export function BusinessCard({ business, onCall }: BusinessCardProps) {
  const getTodayHours = () => {
    const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    const today = days[new Date().getDay()];
    const hours = business.openingHours[today];
    
    if (hours === "closed") {
      return "Heute geschlossen";
    }
    return `Heute: ${hours.open} - ${hours.close} Uhr`;
  };

  return (
    <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Color accent bar */}
      <div
        className="h-2"
        style={{ backgroundColor: business.color }}
      />
      
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0"
            style={{ backgroundColor: `${business.color}20` }}
          >
            {business.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {business.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {business.description}
            </p>
          </div>
        </div>

        {/* Opening hours */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-4">
          <Clock className="w-4 h-4" />
          <span>{getTodayHours()}</span>
        </div>

        {/* Services preview */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Wrench className="w-4 h-4" />
            <span>Leistungen</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {business.services.slice(0, 3).map((service) => (
              <span
                key={service.name}
                className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {service.name}
              </span>
            ))}
            {business.services.length > 3 && (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                +{business.services.length - 3} mehr
              </span>
            )}
          </div>
        </div>

        {/* Sample questions */}
        <div className="mb-5">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Beispielfragen:
          </p>
          <ul className="space-y-1">
            {business.sampleQuestions.slice(0, 2).map((q, i) => (
              <li
                key={i}
                className="text-xs text-gray-600 dark:text-gray-400 italic"
              >
                &ldquo;{q}&rdquo;
              </li>
            ))}
          </ul>
        </div>

        {/* Call button */}
        <button
          onClick={onCall}
          className="w-full py-3 px-4 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: business.color }}
        >
          <Phone className="w-5 h-5" />
          <span>Testanruf starten</span>
        </button>
      </div>
    </div>
  );
}
