export default async function handler(req, res) {
  const origin = "https://terajuciptabina-eng.github.io";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed." });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || "terajuciptabina-eng/terajuciptabina";

  if (!token) {
    return res.status(500).json({ message: "GitHub data source is not configured." });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  async function github(path) {
    const r = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { r, data };
  }

  try {
    const [homeowners, contractors] = await Promise.all([
      github("data/users/homeowners"),
      github("data/users/contractors")
    ]);

    const countJsonFiles = (result) => {
      if (!result.r.ok || !Array.isArray(result.data)) return 0;
      return result.data.filter(item =>
        item && item.type === "file" && String(item.name || "").endsWith(".json")
      ).length;
    };

    const homeownerCount = countJsonFiles(homeowners);
    const contractorCount = countJsonFiles(contractors);
    const registeredAccounts = homeownerCount + contractorCount;

    return res.status(200).json({
      ok: true,
      source: "Admin Database",
      registeredAccounts,
      homeowners: homeownerCount,
      contractors: contractorCount,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("investor-insights error:", error);
    return res.status(500).json({ message: "Unable to load investor insights." });
  }
}
