"use client";

import { useState, useEffect } from "react";
import { startOAuthFlow, logout, type TokenResponse } from "@/lib/spec-oauth";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<TokenResponse | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("spec_tokens");
    if (stored) {
      setTokens(JSON.parse(stored));
    }
  }, []);

  async function handleLogin() {
    try {
      setLoading(true);
      setError(null);
      await startOAuthFlow();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    setTokens(null);
  }

  if (tokens) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-2xl w-full bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-2xl font-bold text-green-600 mb-6">
            Logged in to SPEC
          </h1>

          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-gray-700 mb-1">User DID</h2>
              <code className="block bg-gray-100 p-3 rounded text-sm break-all">
                {tokens.sub}
              </code>
            </div>

            <div>
              <h2 className="font-semibold text-gray-700 mb-1">
                Access Token
              </h2>
              <code className="block bg-gray-100 p-3 rounded text-xs break-all max-h-32 overflow-auto">
                {tokens.access_token}
              </code>
            </div>

            <div>
              <h2 className="font-semibold text-gray-700 mb-1">
                Refresh Token
              </h2>
              <code className="block bg-gray-100 p-3 rounded text-sm break-all">
                {tokens.refresh_token}
              </code>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Token Type:</span>{" "}
                <span className="font-mono">{tokens.token_type}</span>
              </div>
              <div>
                <span className="text-gray-500">Scope:</span>{" "}
                <span className="font-mono">{tokens.scope}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="mt-6 w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          SPEC Test Client
        </h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? "Redirecting..." : "Login with SPEC"}
        </button>

        <p className="mt-4 text-sm text-gray-500 text-center">
          Redirects to SPEC auth server at localhost:3000
        </p>
      </div>
    </div>
  );
}
