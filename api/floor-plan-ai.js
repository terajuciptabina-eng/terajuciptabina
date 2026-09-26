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
- Classify every page: floor_plan, site_plan, roof_plan, elevation, schedule, presentation or other.
- Extract rooms/spaces primarily from floor-plan pages.
- Read the room label associated with its actual bounded space.
- Preserve the room/space label exactly as printed, including visible numbers such as BEDROOM 1, BEDROOM 2, etc. Do not shorten a label by dropping its number.
- Treat each printed room label and explicit area as ONE label-area pair. Verify that the area belongs to that exact bounded room before emitting it.
- Never transfer an area from an adjacent room, column, row, nearby label, or another page. Do not match areas by reading order or vertical order alone.
- When several labels and areas are close together, use enclosing walls/boundaries and the physical position of each label and area to establish the correct pair.
- If a room label contains a combined name such as "KITCHEN & DINING", preserve the complete combined label as ONE physical space when the drawing shows one bounded space with one explicit area. Never split it into KITCHEN and DINING and never duplicate its area.
- Read an area ONLY when that area is explicitly printed for that room/space. If not explicit, use NULL.
- If the label is readable but its area association is uncertain, keep the room name and set area=NULL rather than borrowing a nearby area.
- Never calculate area and never use dimension strings, grid numbers, title-block numbers, scale values, door/window sizes or unrelated numbers as room areas.
- Preserve duplicate room names as separate physical spaces.
- Include porches, verandahs, balconies, halls, utility spaces and other spaces ONLY when the drawing explicitly labels the physical space or clearly names it.
- Do NOT infer a room/space from symbols, furniture, dimension lines, grid numbers, circulation lines, doors, openings, wall geometry or visual shapes alone. A SPACE record requires a readable room/space name visibly printed on the drawing. Never create a name such as BATH 3, BEDROOM 4, HALL, STAIRS or BALCONY unless that exact name is visibly printed.
- In particular, NEVER create a STAIRS/STAIRCASE/STAIR space unless the drawing explicitly labels that physical space as stairs/staircase.
- Scan the entire drawing exhaustively and enumerate every visible room/space label, including labels near edges or partly obscured by watermark/glare. Do not stop after the first few rooms. If a label and explicit area are visibly present, include them even when the text is partially obscured.
- Do not invent a room name just because a graphic resembles a familiar architectural feature.
- Use surrounding walls/boundaries and label position to associate the correct area with the correct room.
- If text is unclear, use the best readable label only when supported by the drawing; otherwise use UNCLEAR in the note and area=NULL.
- source must be explicit_label, schedule_crosscheck, visual_context or unknown.
- Use no pipe character inside any field.
- Keep each SPACE record to one line.
- Do not omit a distinct physical room merely because another room has the same name.
- The same page may be supplied as multiple visual views (full page and detail crops). Treat them as ONE page. Combine evidence across views, deduplicate the same physical space, and keep the clearest readable label/area. Never count the same room twice merely because it appears in multiple views.
- Do not invent unseen pages or values.`
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
      temperature: 0.2,
      max_output_tokens: 1000
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
    content_length: visualText.length,
    output_tokens: visionData?.usage?.output_tokens ?? null,
    content_preview: visualText.slice(0, 4000)
  }));

  if (!visualText.trim()) {
    throw new Error('Groq visual pass returned no analysis.');
  }

  const extraction = parseGroqInventory(visualText);
  if (!extraction.spaces.length) {
    console.error('Groq visual inventory parse produced 0 spaces:', JSON.stringify({
      content_length: visualText.length,
      content_preview: visualText.slice(0, 2000)
    }));
    throw new Error('Groq visual analysis returned no parseable room/space records.');
  }

  return extraction;
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
