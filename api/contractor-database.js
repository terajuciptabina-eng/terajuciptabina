const ALLOWED_ORIGIN = "https://terajuciptabina-eng.github.io";
const REPO = process.env.GITHUB_DATA_REPO || "terajuciptabina-eng/terajuciptabina";
const BRANCH = process.env.GITHUB_DATA_BRANCH || "experiment/contractor-database";
const DATA_ROOT = "data/contractors";
const STATES = new Set([
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang",
  "Pulau Pinang", "Perak", "Perlis", "Sabah", "Sarawak", "Selangor",
  "Terengganu", "Kuala Lumpur", "Labuan", "Putrajaya"
]);
const PROJECT_TYPES = new Set(["build", "renovation"]);

function send(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function safePart(value, label) {
  const text = String(value || "").trim();
  if (!text || text.length > 100 || !/^[A-Za-z0-9._-]+$/.test(text)) {
    throw new Error(`Invalid ${label}.`);
  }
  return text;
}

function normaliseState(value) {
  const state = String(value || "").trim();
  if (!STATES.has(state)) throw new Error("Invalid state.");
  return state;
}

function normaliseProjectType(value) {
  const type = String(value || "").trim().toLowerCase();
  if (!PROJECT_TYPES.has(type)) throw new Error("Invalid project type.");
  return type;
}

function dataPath(contractorId, state, projectType) {
  const safeId = safePart(contractorId, "contractorId");
  const safeState = normaliseState(state).replace(/\s+/g, "-");
  const safeType = normaliseProjectType(projectType);
  return `${DATA_ROOT}/${safeId}/${safeState}/${safeType}.json`;
}

async function githubRequest(path, options = {}) {
  const token = process.env.GITHUB_DATA_TOKEN;
  if (!token) throw new Error("GITHUB_DATA_TOKEN is not configured.");

  const response = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Teraju-Ciptabina-Contractor-Database",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) {}
  return { response, body };
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length > 1000) throw new Error("Invalid items.");

  return items.map((item) => {
    const itemId = String(item?.itemId || "").trim();
    if (!itemId || itemId.length > 150 || !/^[A-Za-z0-9._:-]+$/.test(itemId)) {
      throw new Error("Invalid itemId.");
    }

    const description = String(item?.description || "").trim().slice(0, 300);
    const unit = String(item?.unit || "").trim().slice(0, 30);
    const rate = Number(item?.rate);
    const quantity = Number(item?.quantity ?? item?.qty ?? 0);

    if (!description || !unit || !Number.isFinite(rate) || rate < 0 || rate > 100000000) {
      throw new Error(`Invalid item data for ${itemId}.`);
    }
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 100000000) {
      throw new Error(`Invalid quantity for ${itemId}.`);
    }

    return {
      itemId,
      description,
      unit,
      rate,
      quantity,
      included: item?.included !== false,
      active: item?.active !== false,
      custom: item?.custom === true,
      updatedAt: new Date().toISOString()
    };
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET" && req.method !== "PUT") {
    return send(res, 405, { message: "Method not allowed" });
  }

  try {
    const source = req.method === "GET" ? req.query : (req.body || {});
    const contractorId = safePart(source.contractorId, "contractorId");
    const state = normaliseState(source.state);
    const projectType = normaliseProjectType(source.projectType);
    const path = dataPath(contractorId, state, projectType);

    if (req.method === "GET") {
      const result = await githubRequest(path, { method: "GET" });
      if (result.response.status === 404) {
        return send(res, 200, {
          success: true,
          exists: false,
          contractorId,
          state,
          projectType,
          items: []
        });
      }
      if (!result.response.ok || !result.body?.content) {
        console.error("GitHub database read failed:", result.body);
        return send(res, 502, { message: "Unable to read contractor database." });
      }

      const decoded = Buffer.from(result.body.content, "base64").toString("utf8");
      const data = JSON.parse(decoded);
      return send(res, 200, {
        success: true,
        exists: true,
        contractorId,
        state,
        projectType,
        sha: result.body.sha,
        items: Array.isArray(data.items) ? data.items : []
      });
    }

    const items = validateItems(source.items);
    const now = new Date().toISOString();
    const payload = {
      schemaVersion: 1,
      contractorId,
      state,
      projectType,
      updatedAt: now,
      items
    };

    // Read the current blob first so concurrent edits cannot silently overwrite it.
    const current = await githubRequest(path, { method: "GET" });
    const currentSha = current.response.ok ? current.body?.sha : null;
    const content = Buffer.from(JSON.stringify(payload, null, 2) + "\n").toString("base64");
    const commitBody = {
      message: `Update contractor database: ${contractorId} / ${state} / ${projectType}`,
      content,
      branch: BRANCH
    };
    if (currentSha) commitBody.sha = currentSha;

    const result = await githubRequest(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(commitBody)
    });

    if (!result.response.ok) {
      console.error("GitHub database write failed:", result.body);
      return send(res, 502, { message: "Unable to save contractor database." });
    }

    return send(res, 200, {
      success: true,
      saved: true,
      contractorId,
      state,
      projectType,
      path,
      sha: result.body?.content?.sha || null,
      updatedAt: now
    });
  } catch (error) {
    console.error("contractor-database error:", error);
    const status = /Invalid /.test(error.message) ? 400 : 500;
    return send(res, status, { message: error.message || "Contractor database error." });
  }
}
