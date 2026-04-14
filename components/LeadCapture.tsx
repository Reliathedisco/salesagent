'use client';

import { useState, FormEvent } from 'react';

interface LeadCaptureProps {
  onSubmit: (name: string, email: string) => void;
  visible: boolean;
}

export default function LeadCapture({ onSubmit, visible }: LeadCaptureProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!visible || submitted) return null;

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail) return;
    onSubmit(name.trim(), email.trim());
    setSubmitted(true);
  }

  return (
    <div className="my-3 p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
      <p className="text-sm font-medium text-gray-800 mb-1">
        Want us to follow up?
      </p>
      <p className="text-xs text-gray-500 mb-3">
        Leave your details and we&apos;ll get back to you.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!isValidEmail}
          className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Get in touch
        </button>
      </form>
    </div>
  );
}
