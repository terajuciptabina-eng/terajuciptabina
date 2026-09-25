const ALLOWED_ORIGIN = 'https://terajuciptabina-eng.github.io';
const MODEL = process.env.OPENAI_FLOORPLAN_MODEL || 'gpt-5.6-sol';
const MAX_IMAGES = 8;
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
6. For multi-page documents, classify every page first. Extract spaces primarily from floor-plan pages. Ignore presentation renders, site/context plans, roof plans and elevations for room extraction. A schedule/accommodation page may be used only to cross-check explicitly printed room names and areas.
7. If a floor plan and a schedule disagree, keep the floor-plan value as the primary value and add a warning.
8. Do not invent missing room names, areas or dimensions. Use null for missing area/dimensions.
9. Return every distinct physical room/space you can identify, including porches, balconies, verandahs, halls, walkways, stairs, utility spaces and other enclosed/defined spaces when they are clearly labelled.
10. Keep names readable and faithful to the drawing. Do not normalize away useful identifiers such as BEDROOM 1, BATH 2, etc.
11. Confidence describes extraction confidence, not construction certainty.
12. Return JSON matching the supplied schema only.`;

function jsonError(res, status, message) {
  return res.status(status).json({ success: false, message });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed.');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return jsonError(res, 500, 'OpenAI API is not configured. Add OPENAI_API_KEY to the Vercel project environment.');

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

    const content = [
      {
        type: 'input_text',
        text: `${SYSTEM_PROMPT}

Source file: ${fileName}
There are ${images.length} page image(s). Page numbers are provided in the content immediately before each image.`
      }
    ];

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
        model: MODEL,
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

    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}

    if (!response.ok) {
      console.error('OpenAI floor-plan extraction failed:', response.status, data || raw);
      return jsonError(res, 502, data?.error?.message || 'OpenAI floor-plan extraction failed.');
    }

    const outputText = data?.output_text ||
      data?.output?.flatMap(item => item?.content || [])
        ?.filter(item => item?.type === 'output_text')
        ?.map(item => item.text)
        ?.join('') || '';

    let extraction;
    try {
      extraction = JSON.parse(outputText);
    } catch {
      console.error('OpenAI returned non-JSON floor-plan output:', outputText);
      return jsonError(res, 502, 'OpenAI returned an invalid structured floor-plan result.');
    }

    if (!extraction || !Array.isArray(extraction.spaces) || !Array.isArray(extraction.pages)) {
      return jsonError(res, 502, 'OpenAI returned an incomplete floor-plan result.');
    }

    return res.status(200).json({
      success: true,
      model: MODEL,
      fileName,
      pages: extraction.pages,
      spaces: extraction.spaces,
      warnings: extraction.warnings || []
    });
  } catch (error) {
    console.error('floor-plan-ai error:', error);
    return jsonError(res, 500, 'Unable to process the floor plan.');
  }
}
