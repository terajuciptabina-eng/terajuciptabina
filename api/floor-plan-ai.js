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
    throw new Error((data && data.error && data.error.message) || `${provider} floor-plan extraction failed.`);
  }

  const message = data && data.choices && data.choices[0] && data.choices[0].message;
  const chatOutputText = typeof (message && message.content) === 'string'
    ? message.content
    : Array.isArray(message && message.content)
      ? message.content.map(item => item && (item.text || item.content) || '').join('')
      : '';
  const responsesOutputText = data.output_text ||
    (data.output || []).flatMap(item => item && item.content || [])
      .filter(item => item && item.type === 'output_text')
      .map(item => item.text)
      .join('') || '';
  const outputText = chatOutputText || responsesOutputText;

  console.info(provider + ' response metadata:', JSON.stringify({
    model: data.model || null,
    finish_reason: data.choices && data.choices[0] && data.choices[0].finish_reason || null,
    content_type: outputText ? (chatOutputText ? (Array.isArray(message && message.content) ? 'chat-array' : 'chat-string') : 'responses-output_text') : 'empty',
    content_length: outputText.length
  }));

  const cleaned = outputText.trim();

  let extraction;
  try {
    extraction = JSON.parse(cleaned);
  } catch {
    console.error(`${provider} returned non-JSON floor-plan output:`, JSON.stringify({
      model: data.model || null,
      finish_reason: data.choices && data.choices[0] && data.choices[0].finish_reason || null,
      content_length: outputText.length,
      content_preview: outputText.slice(0, 500)
    }));
    throw new Error(`${provider} returned an invalid structured floor-plan result.`);
  }

  return normalizeExtraction(extraction, provider);
}

function normalizeExtraction(extraction, provider) {
  if (!extraction || typeof extraction !== 'object') throw new Error(`${provider} returned an invalid floor-plan object.`);
  const warnings = Array.isArray(extraction.warnings)
    ? extraction.warnings.map(value => String(value || '').trim()).filter(Boolean)
    : [];
  const allowedTypes = new Set(['floor_plan','site_plan','roof_plan','elevation','schedule','presentation','other']);
  const allowedConfidence = new Set(['high','medium','low']);
  const allowedUnits = new Set(['sqft','sqm','unknown']);
  const allowedSources = new Set(['explicit_label','schedule_crosscheck','visual_context','unknown']);

  const pages = Array.isArray(extraction.pages)
    ? extraction.pages.map((page, index) => {
        const pageNo = Number(page && page.page);
        const type = String((page && page.type) || 'other');
        const floor = page && page.floor !== null && page.floor !== undefined && page.floor !== '' ? String(page.floor) : null;
        const confidence = String((page && page.confidence) || 'low').toLowerCase();
        if (!Number.isInteger(pageNo) || pageNo < 1) {
          warnings.push(`Ignored invalid page entry at index ${index + 1}.`);
          return null;
        }
        return { page: pageNo, type: allowedTypes.has(type) ? type : 'other', floor, confidence: allowedConfidence.has(confidence) ? confidence : 'low' };
      }).filter(Boolean)
    : [];
  if (!Array.isArray(extraction.pages)) warnings.push('Model omitted the pages array.');

  const spaces = Array.isArray(extraction.spaces)
    ? extraction.spaces.map((space, index) => {
        const name = String((space && space.name) || '').trim();
        const page = Number(space && space.page);
        if (!name || !Number.isInteger(page) || page < 1) {
          warnings.push(`Ignored invalid space entry at index ${index + 1}.`);
          return null;
        }
        const rawArea = space && space.area;
        const area = rawArea === null || rawArea === undefined || rawArea === '' ? null : Number(rawArea);
        const validArea = area === null || (Number.isFinite(area) && area >= 0);
        if (!validArea) warnings.push(`Area for "${name}" on page ${page} was invalid and was cleared.`);
        const unit = String((space && space.unit) || 'unknown').toLowerCase();
        const confidence = String((space && space.confidence) || 'low').toLowerCase();
        const source = String((space && space.source) || 'unknown').toLowerCase();
        const floor = space && space.floor !== null && space.floor !== undefined && space.floor !== '' ? String(space.floor) : null;
        return {
          id: String((space && space.id) || `space-${page}-${index + 1}`),
          page, floor, name, area: validArea ? area : null,
          unit: allowedUnits.has(unit) ? unit : 'unknown',
          dimensions: space && space.dimensions !== null && space.dimensions !== undefined && space.dimensions !== '' ? String(space.dimensions) : null,
          confidence: allowedConfidence.has(confidence) ? confidence : 'low',
          source: allowedSources.has(source) ? source : 'unknown',
          notes: space && space.notes !== null && space.notes !== undefined && space.notes !== '' ? String(space.notes) : null
        };
      }).filter(Boolean)
    : [];
  if (!Array.isArray(extraction.spaces)) warnings.push('Model omitted the spaces array.');
  return { pages, spaces, warnings };
}

async function callGroq(images, fileName) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Groq API is not configured. Add GROQ_API_KEY to the Vercel project environment.');

  // PASS 1: visual understanding. Do not constrain the vision model to JSON.
  // This lets the model spend its output budget actually reading the drawing.
  const visionContent = [{
    type: 'input_text',
    text: `You are the visual-analysis stage of an architectural floor-plan extraction system.

Source file: ${fileName}
This request contains ${images.length} page image(s).

Read the supplied drawing(s) visually and produce a detailed plain-text inventory for the next extraction stage.

For EACH supplied page:
- classify the page: floor plan, site plan, roof plan, elevation, schedule, presentation or other
- identify the floor if visible
- on floor-plan pages, inspect every distinct physical room/space
- read the room label INSIDE or associated with its actual bounded space
- read the explicit area printed for that room if present
- preserve duplicate names as separate physical spaces
- include porches, verandahs, balconies, halls, stairs, walkways, utility spaces and other clearly labelled/defined spaces
- if an area is not explicitly printed, say AREA NOT EXPLICIT rather than calculating or guessing
- do NOT use dimensions, grid numbers, title-block numbers, scale values, door/window sizes or unrelated numbers as room areas
- use surrounding walls/boundaries and the position of labels to associate each area with the correct room
- if text is unclear, say UNCLEAR rather than inventing it

This is a visual reading task. Do not summarize the drawing. Give a concrete page-by-page room inventory with the actual labels and numbers you can see.`
  }];

  for (const image of images) {
    const page = Number(image.page) || 1;
    visionContent.push({ type: 'input_text', text: `PAGE ${page}` });
    visionContent.push({
      type: 'input_image',
      image_url: image.data,
      detail: 'high'
    });
  }

  const visionResponse = await fetch('https://api.groq.com/openai/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      input: [{ role: 'user', content: visionContent }],
      temperature: 0.7,
      max_output_tokens: 12000
    })
  });

  const visionRaw = await visionResponse.text();
  let visionData = null;
  try { visionData = visionRaw ? JSON.parse(visionRaw) : null; } catch {}
  if (!visionResponse.ok) {
    console.error('Groq visual pass failed:', visionResponse.status, visionData || visionRaw);
    throw new Error((visionData && visionData.error && visionData.error.message) || 'Groq visual analysis failed.');
  }

  const visualText = visionData?.output_text ||
    (visionData?.output || []).flatMap(item => item?.content || [])
      .filter(item => item?.type === 'output_text')
      .map(item => item.text)
      .join('') || '';

  console.info('Groq visual pass metadata:', JSON.stringify({
    model: visionData?.model || GROQ_MODEL,
    status: visionData?.status || null,
    content_length: visualText.length
  }));

  if (!visualText.trim()) {
    throw new Error('Groq visual pass returned no analysis.');
  }

  // PASS 2: convert the visual inventory into the application's strict schema.
  const structuredPrompt = `You are the structured extraction stage of an architectural floor-plan system.

Convert the following VISUAL INVENTORY into the supplied JSON schema.

CRITICAL RULES:
- Preserve every distinct physical room/space from the visual inventory.
- Do not drop rooms merely because names repeat.
- If the visual inventory says AREA NOT EXPLICIT or UNCLEAR, use area=null.
- Never calculate area from dimensions.
- Never turn dimensions, grid numbers, title-block numbers or unrelated numbers into area.
- Keep page classification and floor information.
- source should be explicit_label when the area is visibly printed for that room, schedule_crosscheck only when explicitly cross-checked from a supplied schedule, visual_context when the room is visually identified but the area is not explicit, otherwise unknown.
- Return the complete object, not a summary.

VISUAL INVENTORY:
${visualText}`;

  const structuredResponse = await fetch('https://api.groq.com/openai/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: structuredPrompt }] }],
      text: {
        format: {
          type: 'json_schema',
          name: 'floor_plan_extraction',
          strict: true,
          schema
        }
      },
      max_output_tokens: 12000
    })
  });

  return parseStructuredResponse(structuredResponse, 'Groq');
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
    const providersUsed = new Set();
    const modelsUsed = new Set();
    for (const batch of batches) {
      try {
        if (selectedProvider === 'openai') {
          extractions.push(await callOpenAI(batch, fileName));
          providersUsed.add('openai');
          modelsUsed.add(OPENAI_MODEL);
        } else {
          extractions.push(await callGroq(batch, fileName));
          providersUsed.add('groq');
          modelsUsed.add(GROQ_MODEL);
        }
      } catch (primaryError) {
        if (selectedProvider !== 'groq') throw primaryError;
        const primaryMessage = primaryError && primaryError.message ? primaryError.message : primaryError;
        console.warn('Groq floor-plan extraction failed; falling back to OpenRouter:', primaryMessage);
        const fallbackModels = [OPENROUTER_MODEL, ...OPENROUTER_FALLBACK_MODELS].filter((model, index, list) => model && list.indexOf(model) === index);
        let fallbackResult = null;
        let lastFallbackError = primaryError;
        for (const model of fallbackModels) {
          try {
            console.info(`Trying OpenRouter floor-plan model: ${model}`);
            fallbackResult = await callOpenRouter(batch, fileName, model);
            break;
          } catch (fallbackError) {
            lastFallbackError = fallbackError;
            const fallbackMessage = fallbackError && fallbackError.message ? fallbackError.message : fallbackError;
            console.warn(`OpenRouter floor-plan model failed (${model}):`, fallbackMessage);
          }
        }
        if (!fallbackResult) throw lastFallbackError;
        extractions.push(fallbackResult.extraction);
        providersUsed.add('openrouter');
        modelsUsed.add(fallbackResult.model);
      }
    }
    const actualProvider = [...providersUsed].join('+') || selectedProvider;
    const actualModel = [...modelsUsed].join(', ') || (selectedProvider === 'openai' ? OPENAI_MODEL : GROQ_MODEL);

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
