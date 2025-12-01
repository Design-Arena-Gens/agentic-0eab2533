"use client";

import { FormEvent, useMemo, useState } from "react";

type Recipe = {
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
};

type GenerateResponse = {
  recipes: Recipe[];
  summary: string;
};

export default function HomePage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendPhone, setSendPhone] = useState("");
  const [sendingToWhatsApp, setSendingToWhatsApp] = useState(false);
  const [whatsAppResult, setWhatsAppResult] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImageDataUrl(null);
      setImagePreview(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setImagePreview(result);
        setImageDataUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!imageDataUrl) {
      setError("Upload a photo of your leftovers first.");
      return;
    }

    setLoading(true);
    setError(null);
    setRecipes([]);
    setSummary(null);
    setWhatsAppResult(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl,
          notes: notes.trim()
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? "Unable to generate recipes.");
      }

      const data = (await response.json()) as GenerateResponse;
      setRecipes(data.recipes);
      setSummary(data.summary);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong while generating recipes.");
      }
    } finally {
      setLoading(false);
    }
  };

  const combinedMessage = useMemo(() => {
    if (!recipes.length) return "";
    const lines: string[] = [
      "🍳 *Kitchen Remix AI Recipes*",
      summary ? `${summary}\n` : ""
    ];
    recipes.forEach((recipe, index) => {
      lines.push(`*${index + 1}. ${recipe.name}*`);
      lines.push(recipe.description);
      lines.push("_Ingredients_:");
      recipe.ingredients.forEach((ingredient) => lines.push(`• ${ingredient}`));
      lines.push("_Steps_:");
      recipe.steps.forEach((step, stepIndex) =>
        lines.push(`${stepIndex + 1}. ${step}`)
      );
      lines.push("");
    });
    return lines.join("\n").trim();
  }, [recipes, summary]);

  const handleSendToWhatsApp = async () => {
    if (!combinedMessage) return;
    setSendingToWhatsApp(true);
    setWhatsAppResult(null);
    setError(null);

    try {
      const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: combinedMessage,
          phoneNumber: sendPhone.trim() || undefined
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to send WhatsApp message.");
      }

      const data = await response.json();
      setWhatsAppResult(
        data.status === "queued"
          ? "WhatsApp message queued successfully!"
          : "WhatsApp message sent."
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while sending WhatsApp message.";
      setError(message);
    } finally {
      setSendingToWhatsApp(false);
    }
  };

  return (
    <main className="flex flex-col gap-10 px-6 pb-16 pt-12 sm:px-10 md:px-16 lg:px-24">
      <header className="mx-auto max-w-4xl rounded-3xl bg-slate-900/60 px-6 py-10 shadow-lg shadow-blue-500/10 ring-1 ring-slate-800 md:px-10">
        <div className="flex flex-col gap-4 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-400">
            Kitchen Remix AI
          </span>
          <h1 className="text-4xl font-semibold sm:text-5xl">
            Turn leftovers into{" "}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-green-400 bg-clip-text text-transparent">
              chef-crafted recipes
            </span>
          </h1>
          <p className="text-sm text-slate-300 sm:text-base">
            Upload a photo of what&apos;s left in your fridge. We&apos;ll detect
            the ingredients, generate at least three tasty recipes, and share
            them straight to WhatsApp.
          </p>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-10">
        <form className="flex flex-col gap-6" onSubmit={handleGenerate}>
          <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
            <div className="flex flex-col gap-3 lg:col-span-2">
              <label
                htmlFor="image"
                className="text-sm font-semibold uppercase tracking-wide text-slate-300"
              >
                1. Snap your leftovers
              </label>
              <input
                id="image"
                name="image"
                type="file"
                required
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 transition hover:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              />
              <p className="text-xs text-slate-500">
                Clear, well-lit photos give the best results.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:col-span-3">
              <label
                htmlFor="notes"
                className="text-sm font-semibold uppercase tracking-wide text-slate-300"
              >
                2. Add kitchen notes (optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Tell the chef about dietary preferences, missing pantry staples, or equipment limits."
                className="min-h-[140px] rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 transition hover:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              />
            </div>
          </div>

          {imagePreview && (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Leftover ingredients preview"
                  className="max-h-64 w-full rounded-xl object-cover"
                />
              </div>
              <div className="flex flex-col gap-2 text-sm text-slate-300">
                <span className="font-semibold text-slate-100">
                  Ingredient recognition
                </span>
                <p>
                  The AI will detect items in your photo and blend them with
                  your notes to engineer recipes tailored to your kitchen.
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/60"
          >
            {loading ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white/50 border-t-transparent" />
                Generating recipes…
              </>
            ) : (
              "Generate 3+ recipes"
            )}
          </button>
        </form>

        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {recipes.length > 0 && (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold text-white">
                Your remix menu
              </h2>
              {summary && (
                <p className="text-sm text-slate-300">{summary}</p>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {recipes.map((recipe, index) => (
                <article
                  key={recipe.name}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-lg shadow-slate-950/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-blue-400">
                        Recipe {index + 1}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-white">
                        {recipe.name}
                      </h3>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300">{recipe.description}</p>
                  <div className="flex flex-col gap-4 text-sm text-slate-200">
                    <div>
                      <h4 className="font-semibold uppercase tracking-wide text-slate-400">
                        Ingredients
                      </h4>
                      <ul className="mt-1 space-y-1 text-slate-300">
                        {recipe.ingredients.map((ingredient) => (
                          <li key={ingredient} className="leading-relaxed">
                            • {ingredient}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold uppercase tracking-wide text-slate-400">
                        Steps
                      </h4>
                      <ol className="mt-1 space-y-1 text-slate-300">
                        {recipe.steps.map((step) => (
                          <li key={step} className="leading-relaxed">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold text-emerald-200">
                  Share on WhatsApp
                </h3>
                <p className="text-sm text-emerald-100/80">
                  Send the complete menu to friends, family, or yourself.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),auto] md:items-end">
                <label className="flex flex-col gap-2 text-sm text-emerald-100/80">
                  WhatsApp number (international format)
                  <input
                    type="tel"
                    value={sendPhone}
                    onChange={(event) => setSendPhone(event.target.value)}
                    placeholder="+14155551212"
                    className="rounded-xl border border-emerald-400/50 bg-emerald-950/40 px-4 py-3 text-sm text-white placeholder:text-emerald-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSendToWhatsApp}
                  disabled={sendingToWhatsApp || !combinedMessage}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/60"
                >
                  {sendingToWhatsApp ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-emerald-900/60 border-t-transparent" />
                      Sending…
                    </>
                  ) : (
                    "Send to WhatsApp"
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-100/70">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(combinedMessage)
                      .then(() => setWhatsAppResult("Copied recipes to clipboard."))
                      .catch(() => setError("Unable to copy recipes to clipboard."));
                  }}
                  className="rounded-full border border-emerald-400/60 px-3 py-1 font-semibold text-emerald-100 transition hover:border-emerald-300 hover:text-white"
                >
                  Copy recipes
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(combinedMessage)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-emerald-400/60 px-3 py-1 font-semibold text-emerald-100 transition hover:border-emerald-300 hover:text-white"
                >
                  Share via WhatsApp Web
                </a>
                {whatsAppResult && (
                  <span className="font-medium text-emerald-200">
                    {whatsAppResult}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
