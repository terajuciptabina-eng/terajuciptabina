// Groq floor-plan provider deployment marker: OpenRouter free JSON object fallback.
const ALLOWED_ORIGIN = 'https://terajuciptabina-eng.github.io';
const PROVIDER = String(process.env.AI_PROVIDER || 'groq').toLowerCase();
const OPENAI_MODEL = process.env.OPENAI_FLOORPLAN_MODEL || 'gpt-5.6-sol';
const GROQ_MODEL = process.env.GROQ_FLOORPLAN_MODEL || 'qwen/qwen3.8-27b';
const OPENROUTER_MODEL = process.env.OPENROUTER_FLOORPLAN_MODEL || 'google/gemma-4-31b-it:free';
const OPENROUTER_FALLBACK_MODELS = String(
  process.env.OPENROUTER_FLOORPLAN_FALLBACK_MODELS ||
  'google/gemma-4-26b-a4b-it:free,openrouter/free'
).split(',').map(value => value.trim()).filter(Boolean);
const MAX_IMAGES = 8;
const GROQ_MAX_IMAGES_PER_REQUEST = 3;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          page: { type: 'integer' },
          type: {
            type: 'string',
            enum: ['floor_plan','site_plan','roof_plan','elevation','schedule','presentation','other']
          },
          floor: { type: ['string','null'] },
          confidence: { type: 'string', enum: ['high','medium','low'] }
        },
        required: ['page','type','floor','confidence']
      }
    },
    spaces: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          page: { type: 'integer' },
          floor: { type: ['string','null'] },
          name: { type: 'string' },
          area: { type: ['number','null'] },
          unit: { type: 'string', enum: ['sqft','sqm','unknown'] },
          dimensions: { type: ['string','null'] },
          confidence: { type: 'string', enum: ['high','medium','low'] },
          source: {
            type: 'string',
            enum: ['explicit_label','schedule_crosscheck','visual_context','unknown']
          },
          notes: { type: ['string','null'] }
        },
        required: ['id','page','floor','name','area','unit','dimensions','confidence','source','notes']
      }
    },
    warnings: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['pages','spaces','warnings']
};

const SYSTEM_PROMPT = `You extract structured room and area data from architectural floor plans.

Your job is visual understanding, not OCR-only matching.

Rules:
1. Inspect the complete drawing context on each page. Identify enclosed rooms/spaces and the room label located in that space.
2. Extract an area only when the area is explicitly printed for that room/space. Never calculate or guess an area.
3. Never use dimension strings, grid numbers, drawing coordinates, title-block numbers, scale values, door/window sizes, boundary/setback dimensions, or unrelated schedule numbers as room areas.
4. Preserve duplicate room names as separate physical instances. Example: two BALCONY labels means two separate spaces if they are visibly separate.
5. A room label and its area may be visually separated; use the room's position and surrounding boundaries to associate them.
6. Classify every supplied page first. Extract spaces primarily from floor-plan pages. Ignore presentation renders, site/context plans, roof plans and elevations for room extraction. A schedule/accommodation page may be used only to cross-check explicitly printed room names and areas when it is supplied in the same request.
7. If a floor plan and a schedule disagree, keep the floor-plan value as the primary value and add a warning.
8. Do not invent missing room names, areas or dimensions. Use null for missing area/dimensions.
9. Return every distinct physical room/space you can identify, including porches, balconies, verandahs, halls, walkways, stairs, utility spaces and other enclosed/defined spaces when they are clearly labelled.
10. Keep names readable and faithful to the drawing. Do not normalize away useful identifiers such as BEDROOM 1, BATH 2, etc.
11. Confidence describes extraction confidence, not construction certainty.
12. Some requests may contain only a subset of a multi-page document. Never assume that an unseen page exists or use an unseen page as evidence.
13. Return JSON matching the supplied schema only.`;

function jsonError(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function uniquePages(pages) {
  const seen = new Set();
  return pages.filter(page => {
    const key = String(page?.page);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueSpaces(spaces) {
  const used = new Set();
  return spaces.map((space, index) => {
    const base = String(space?.id || `${space?.page || 0}-${index + 1}`);
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return { ...space, id };
  });
}

async function parseStructuredResponse(response, provider) {
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}

  if (!response.ok) {
    console.error(`${provider} floor-plan extraction failed:`, response.status, data || raw);
    throw new Error(data?.error?.message || `${provider} floor-plan extraction failed.`);
  }

  const outputText = provider === 'groq' || provider === 'openrouter'
    ? (typeof data?.choices?.[0]?.message?.content === 'string'
        ? data.choices[0].message.content
        : Array.isArray(data?.choices?.[0]?.message?.content)
          ? data.choices[0].message.content.map(item => item?.text || '').join('')
          : '')
    : data?.output_text ||
      data?.output?.flatMap(item => item?.content || [])
        ?.filter(item => item?.type === 'output_text')
        ?.map(item => item.text)
        ?.join('') || '';

  let extraction;
  try {
    extraction = JSON.parse(outputText);
  } catch {
    console.error(`${provider} returned non-JSON floor-plan output:`, outputText);
    throw new Error(`${provider} returned an invalid structured floor-plan result.`);
  }

  if (!extraction || !Array.isArray(extraction.spaces) || !Array.isArray(extraction.pages)) {
    throw new Error(`${provider} returned an incomplete floor-plan result.`);
  }

  return extraction;
}

async function callGroq(images, fileName) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Groq API is not configured. Add GROQ_API_KEY to the Vercel project environment.');

  const content = [{
    type: 'text',
    text: `${SYSTEM_PROMPT}

Source file: ${fileName}
This request contains ${images.length} page image(s). Page numbers are provided immediately before each image.
Analyze only the supplied pages.

Return ONLY one valid JSON object with exactly these top-level arrays:
{
  "pages": [{"page": 1, "type": "floor_plan|site_plan|roof_plan|elevation|schedule|presentation|other", "floor": "string or null", "confidence": "high|medium|low"}],
  "spaces": [{"id": "unique string", "page": 1, "floor": "string or null", "name": "room/space name", "area": 0, "unit": "sqft|sqm|unknown", "dimensions": "string or null", "confidence": "high|medium|low", "source": "explicit_label|schedule_crosscheck|visual_context|unknown", "notes": "string or null"}],
  "warnings": ["string"]
}
Use null when area or dimensions are unavailable. Do not add markdown or commentary.`
  }];

  for (const image of images) {
    const page = Number(image.page) || 1;
    content.push({ type: 'text', text: `PAGE ${page}` });
    content.push({
      type: 'image_url',
      image_url: { url: image.data }
    });
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content }],
      temperature: 0.1,
      max_completion_tokens: 12000,
      response_format: {
        type: 'json_object'
      },
      reasoning_effort: 'none',
      include_reasoning: false,
      stream: false
    })
  });

  return parseStructuredResponse(response, 'Groq');
}

async function callOpenRouter(images, fileName, model = OPENROUTER_MODEL) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OpenRouter API is not configured. Add OPENROUTER_API_KEY to the Vercel project environment.');

  const content = [{
    type: 'text',
    text: `${SYSTEM_PROMPT}

Source file: ${fileName}
This request contains ${images.length} page image(s). Page numbers are provided immediately before each image.
Analyze only the supplied pages.

Return ONLY one valid JSON object with exactly these top-level arrays:
{
  "pages": [{"page": 1, "type": "floor_plan|site_plan|roof_plan|elevation|schedule|presentation|other", "floor": "string or null", "confidence": "high|medium|low"}],
  "spaces": [{"id": "unique string", "page": 1, "floor": "string or null", "name": "room/space name", "area": 0, "unit": "sqft|sqm|unknown", "dimensions": "string or null", "confidence": "high|medium|low", "source": "explicit_label|schedule_crosscheck|visual_context|unknown", "notes": "string or null"}],
  "warnings": ["string"]
}
Use null when area or dimensions are unavailable. Do not add markdown or commentary.`
  }];

  for (const image of images) {
    const page = Number(image.page) || 1;
    content.push({ type: 'text', text: `PAGE ${page}` });
    content.push({
      type: 'image_url',
      image_url: { url: image.data }
    });
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': ALLOWED_ORIGIN,
      'X-Title': 'TERAJU WORKS Floor Plan AI'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      temperature: 0.1,
      max_tokens: 12000,
      response_format: {
        type: 'json_object'
      }
    })
  });

  return parseStructuredResponse(response, 'OpenRouter').then(extraction => ({ extraction, model }));
}

async function callOpenAI(images, fileName) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API is not configured. Add OPENAI_API_KEY to the Vercel project environment.');

  const content = [{
    type: 'input_text',
    text: `${SYSTEM_PROMPT}

Source file: ${fileName}
There are ${images.length} page image(s). Page numbers are provided in the content immediately before each image.`
  }];

  for (const image of images) {
    const page = Number(image.page) || 1;
    content.push({ type: 'input_text', text: `PAGE ${page}` });
    content.push({
      type: 'input_image',
      image_url: image.data,
      detail: 'high'
    });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content }],
      text: {
        format: {
          type: 'json_schema',
          name: 'floor_plan_extraction',
          strict: true,
          schema
        }
      }
    })
  });

  return parseStructuredResponse(response, 'OpenAI');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed.');

  try {
    const body = req.body || {};
    const images = Array.isArray(body.images) ? body.images : [];
    const fileName = String(body.fileName || 'floor-plan').slice(0, 200);

    if (!images.length) return jsonError(res, 400, 'No floor-plan images supplied.');
    if (images.length > MAX_IMAGES) return jsonError(res, 400, `Too many pages. Maximum supported is ${MAX_IMAGES} images per extraction.`);

    let totalBytes = 0;
    for (const image of images) {
      if (typeof image?.data !== 'string' || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image.data)) {
        return jsonError(res, 400, 'Each page must be a JPEG, PNG or WEBP data URL.');
      }
      totalBytes += Buffer.byteLength(image.data, 'utf8');
    }
    if (totalBytes > MAX_BODY_BYTES) {
      return jsonError(res, 413, 'Floor-plan images are too large. Please use the built-in image/PDF compression and try again.');
    }

    const selectedProvider = PROVIDER === 'openai' ? 'openai' : 'groq';
    const batches = chunk(images, GROQ_MAX_IMAGES_PER_REQUEST);

    const extractions = [];
    let actualProvider = selectedProvider;
    let actualModel = selectedProvider === 'openai' ? OPENAI_MODEL : GROQ_MODEL;
    for (const batch of batches) {
      try {
        if (selectedProvider === 'openai') {
          extractions.push(await callOpenAI(batch, fileName));
        } else {
          extractions.push(await callGroq(batch, fileName));
        }
      } catch (primaryError) {
        if (selectedProvider !== 'groq') throw primaryError;
        console.warn('Groq floor-plan extraction failed; falling back to OpenRouter:', primaryError?.message || primaryError);
        actualProvider = 'openrouter';

        const fallbackModels = [OPENROUTER_MODEL, ...OPENROUTER_FALLBACK_MODELS]
          .filter((model, index, list) => model && list.indexOf(model) === index);
        let fallbackResult = null;
        let lastFallbackError = primaryError;

        for (const model of fallbackModels) {
          try {
            console.info(`Trying OpenRouter floor-plan model: ${model}`);
            fallbackResult = await callOpenRouter(batch, fileName, model);
            actualModel = model;
            break;
          } catch (fallbackError) {
            lastFallbackError = fallbackError;
            console.warn(`OpenRouter floor-plan model failed (${model}):`, fallbackError?.message || fallbackError);
          }
        }

        if (!fallbackResult) throw lastFallbackError;
        extractions.push(fallbackResult.extraction);
      }
    }

    const pages = uniquePages(extractions.flatMap(item => item.pages || []))
      .sort((a, b) => Number(a.page) - Number(b.page));

    const spaces = uniqueSpaces(
      extractions
        .flatMap(item => item.spaces || [])
        .sort((a, b) => Number(a.page) - Number(b.page))
    );

    const warnings = [
      ...new Set(
        extractions
          .flatMap(item => item.warnings || [])
          .filter(Boolean)
      )
    ];

    if (actualProvider === 'groq' && batches.length > 1) {
      warnings.push(`Groq processed ${images.length} pages in ${batches.length} visual batches.`);
    }

    return res.status(200).json({
      success: true,
      provider: actualProvider,
      model: actualModel,
      fileName,
      pages,
      spaces,
      warnings
    });
  } catch (error) {
    console.error('floor-plan-ai error:', error);
    return jsonError(res, 502, error?.message || 'Unable to process the floor plan.');
  }
}
