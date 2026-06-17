import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// construct directories
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const frontendDir = path.join(__dirname, '../frontend/build');

dotenv.config({
  path: path.join(__dirname, '.env')
});

// create server
const app = express();

// -------------------------------------------------------
// Sicherheitsheader (Helmet)
// -------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // bei Bedarf anpassen (Svelte/Vite Inline-Styles)
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"], // Frontend spricht nur den eigenen Server an
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  // Da das Frontend selbst Bilder/Skripte vom eigenen Server lädt,
  // crossOriginResourcePolicy meist unproblematisch auf "same-origin" (Default)
}));

app.use(express.json({ limit: "100kb" })); // Payload-Größe begrenzen gegen Missbrauch

// -------------------------------------------------------
// Rate Limiting – wichtig, da externe (kostenpflichtige) APIs angesprochen werden!
// -------------------------------------------------------
const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 30, // max. 30 Requests pro IP in diesem Zeitraum
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Anfragen, bitte später erneut versuchen." }
});

// -------------------------------------------------------
// Authorization
// -------------------------------------------------------
function requireApiKey(req, res, next) {
    const key = req.headers["x-api-key"];
    if (key !== process.env.API_KEY) {
        return res.status(403).json({ error: "Kein Zugriff" });
    }
    next();
}

// Hugging Face Setup
const HF_ENDPOINT = "https://router.huggingface.co/hf-inference/models/MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli";
const HF_HEADERS  = { Authorization: `Bearer ${process.env.HF_TOKEN}` };
const GNEWS_URL   = "https://gnews.io/api/v4/search";

// Hugging Face Functions
async function sentiment(topic, text) {
  const payload = {
    inputs: text,
    parameters: {
      candidate_labels: [
        `positive about ${topic}`,
        `neutral toward ${topic}`,
        `negative about ${topic}`
      ],
      multi_label: false
    }
  };
  const res = await fetch(HF_ENDPOINT, {
    method: "POST",
    headers: { ...HF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HF API ${res.status}`);
  const r = await res.json();
  return {
    labels:   r.labels,
    scores:   r.scores,
    sequence: r.sequence,
    topLabel: r.labels[0]
  };
}

app.use(express.static(frontendDir));

app.get('/{*splat}', (_, res) =>
  res.sendFile(path.join(frontendDir, 'index.html'))
);

app.get("/health", (_, res) => res.send("ok"));

app.use(requireApiKey);
app.use(analyzeLimiter); // Rate-Limit nur auf geschützte API-Routen

// -------------------------------------------------------
// Eingabevalidierung – einfache, aber wichtige Helper
// -------------------------------------------------------
function isValidTopic(topic) {
  return typeof topic === "string" && topic.trim().length > 0 && topic.trim().length <= 200;
}
function isValidText(text) {
  return typeof text === "string" && text.trim().length <= 5000;
}

app.post("/analyze", async (req, res) => {
  try {
    const { topic = "", text = "" } = req.body;

    if (!isValidTopic(topic)) {
      return res.status(400).json({ error: "Ungültiges oder fehlendes 'topic'" });
    }
    if (!isValidText(text)) {
      return res.status(400).json({ error: "Ungültiger oder zu langer 'text'" });
    }

    const out = await sentiment(topic.trim(), text.trim());
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Interner Fehler bei der Analyse" }); // keine Details nach außen
  }
});

app.post("/analyze-media", async (req, res) => {
  try {
    const topic = (req.body.topic || "").trim();
    if (!isValidTopic(topic)) {
      return res.status(400).json({ error: "Ungültiges oder fehlendes 'topic'" });
    }

    const from = new Date(Date.now() - 3 * 365 * 24 * 3600 * 1e3)
                   .toISOString().slice(0, 10);

    const relParams =
      new URLSearchParams({ q: topic, lang: "de", max: "100",
                            sort: "relevance", from, token: process.env.GNEWS_API_KEY });
    const relResp = await fetch(`${GNEWS_URL}?${relParams}`);
    const rel = (await relResp.json()).articles || [];
    if (!rel.length) return res.status(404).json({ error: "No articles found" });

    // bucket by month and attach sentiment
    const monthBuckets = {};
    const results = [];
    for (const art of rel) {
      const content = art.description || art.content || "";
      if (!content.trim()) continue;

      const s = await sentiment(topic, content);
      const key = new Date(art.publishedAt).toISOString().slice(0, 7);
      monthBuckets[key] ??= { positive: 0, neutral: 0, negative: 0, total: 0 };
      const root = s.topLabel.split(" ")[0];
      monthBuckets[key][root] += 1;
      monthBuckets[key].total += 1;

      results.push({ article: art, analysis: s });
    }

    const pct = (n, t) => t ? +(n * 100 / t).toFixed(2) : 0;
    const monthly_percentages = Object.fromEntries(
      Object.entries(monthBuckets).map(([m, c]) => [
        m, { positive: pct(c.positive,c.total),
             neutral:  pct(c.neutral,c.total),
             negative: pct(c.negative,c.total) } ]));

    // 30‐day pulse (latest query)
    const latParams =
      new URLSearchParams({ q: topic, lang: "de", max: "100",
                            sort: "publishedAt", token: process.env.GNEWS_API_KEY });
    const lat = (await (await fetch(`${GNEWS_URL}?${latParams}`)).json()).articles || [];
    const recentCut = Date.now() - 30 * 24 * 3600 * 1e3;
    const recentCounts = { positive: 0, neutral: 0, negative: 0 };

    for (const a of lat) {
      const cont = a.description || a.content || "";
      if (!cont.trim()) continue;
      const root = (await sentiment(topic, cont)).topLabel.split(" ")[0];
      if (new Date(a.publishedAt).getTime() >= recentCut) recentCounts[root] += 1;
    }
    const total = Object.values(recentCounts).reduce((a,b)=>a+b,0);
    const pctR = k => total ? +(recentCounts[k]*100/total).toFixed(2) : 0;

    res.json({
      summary_recent: {
        ...recentCounts,
        percentages: { positive:pctR("positive"), neutral:pctR("neutral"), negative:pctR("negative") },
        total, dominantSentiment: total ? Object.keys(recentCounts).reduce((a,b)=>recentCounts[a]>recentCounts[b]?a:b) : null,
        windowDays: 30
      },
      monthly_percentages,
      results,
      mostRecentArticle: results[0]
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Interner Fehler bei der Medienanalyse" }); // keine Details nach außen
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API listening on ${PORT}`);
});