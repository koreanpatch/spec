"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { handleCallback, type TokenResponse } from "@/lib/spec-oauth";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<TokenResponse | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setStatus("error");
      setError(`Authorization denied: ${errorParam}`);
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setError("Missing code or state parameter in callback");
      return;
    }

    handleCallback(code, state)
      .then((result) => {
        setTokens(result);
        setStatus("success");
        localStorage.setItem("spec_tokens", JSON.stringify(result));
      })
      .catch((err) => {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Token exchange failed");
      });
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Exchanging authorization code...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-2xl w-full bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold text-green-600 mb-6">
          Login Successful
        </h1>

        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-700 mb-1">User DID</h2>
            <code className="block bg-gray-100 p-3 rounded text-sm break-all">
              {tokens?.sub}
            </code>
          </div>

          <div>
            <h2 className="font-semibold text-gray-700 mb-1">Access Token</h2>
            <code className="block bg-gray-100 p-3 rounded text-xs break-all max-h-32 overflow-auto">
              {tokens?.access_token}
            </code>
          </div>

          <div>
            <h2 className="font-semibold text-gray-700 mb-1">Refresh Token</h2>
            <code className="block bg-gray-100 p-3 rounded text-sm break-all">
              {tokens?.refresh_token}
            </code>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Token Type:</span>{" "}
              <span className="font-mono">{tokens?.token_type}</span>
            </div>
            <div>
              <span className="text-gray-500">Scope:</span>{" "}
              <span className="font-mono">{tokens?.scope}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push("/")}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded cursor-pointer"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-600">Loading...</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
