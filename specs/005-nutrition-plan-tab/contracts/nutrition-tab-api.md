# Contract: Nutrition Plan API

**Purpose**: Defines the API contract for fetching nutrition plan content from server

**Version**: 1.0  
**Status**: Design Phase

---

## Endpoint: Get Nutrition Plan

### Request

**Method**: `GET`

**Path**: `/api/customer/:slug/nutrition`

**URL Parameters**:

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `slug` | string | Yes | Customer identifier (e.g., "jaqueline-orellano") |

**Query Parameters**: None

**Headers**: None required (no authentication in coach-only system)

**Body**: N/A

**Example**:
```
GET /api/customer/jaqueline-orellano/nutrition
```

---

### Response

**Success Response**

**Status Code**: `200 OK`

**Content-Type**: `application/json`

**Body**:
```json
{
  "content": "## Nutrition Goals\n\n- Protein: 90-110g/day\n- Carbs: 220-270g/day\n...",
  "isEmpty": false,
  "lastModified": "2026-09-16T10:30:00Z"
}
```

**Field Descriptions**:

| Field | Type | Always Present | Notes |
|-------|------|-----------------|-------|
| `content` | string | Yes | Raw markdown content from nutrition_plan.md. Empty string if file doesn't exist. |
| `isEmpty` | boolean | Yes | true if nutrition_plan.md doesn't exist or is empty; false if content exists |
| `lastModified` | string (ISO-8601) | No | File modification timestamp; can be used for cache validation in future |

**Example: Nutrition Plan Exists**:
```json
{
  "content": "# Plan Nutricional: Jaqueline Orellano\n\n**Fecha de creación:** 16 de Septiembre, 2026\n...",
  "isEmpty": false,
  "lastModified": "2026-09-16T10:30:00Z"
}
```

**Example: No Nutrition Plan Yet**:
```json
{
  "content": "",
  "isEmpty": true,
  "lastModified": null
}
```

---

**Error Response**

**Status Code**: `404 Not Found`

**Condition**: Customer directory doesn't exist

**Body**:
```json
{
  "error": "Customer not found"
}
```

---

**Status Code**: `400 Bad Request`

**Condition**: Invalid customer slug format

**Body**:
```json
{
  "error": "Invalid customer slug format"
}
```

---

**Status Code**: `413 Payload Too Large`

**Condition**: nutrition_plan.md file exceeds 100KB

**Body**:
```json
{
  "error": "Nutrition plan file exceeds maximum size (100KB)"
}
```

---

**Status Code**: `500 Internal Server Error`

**Condition**: File read error (permissions, disk error, etc.)

**Body**:
```json
{
  "error": "Unable to read nutrition plan file"
}
```

---

## Implementation Notes

### Server-Side (app/server/serve.js)

1. Parse customer slug from URL path
2. Validate slug format (lowercase alphanumeric and hyphens)
3. Read file: `/customers/{slug}/nutrition_plan.md`
4. Check file size (max 100KB)
5. Return JSON response with content and isEmpty flag

### Client-Side (app/src/views/customer-view.js)

1. Call this endpoint when loading customer profile
2. Store response in `data.nutrition` object
3. Pass to TabContainer
4. TabContainer renders via marked() library

### No Caching

- File is read fresh on each customer profile load (per spec IV: no redundant reads)
- Future optimization: Add ETag or Last-Modified headers for cache validation

### Backward Compatibility

- New endpoint; doesn't modify existing /api/customer/:slug/ endpoints
- Existing program, feedback, notes endpoints unchanged

---

## Testing Strategy

**Happy Path**: Customer with nutrition_plan.md → returns 200 with content

**Edge Case 1**: Customer without nutrition_plan.md → returns 200 with isEmpty=true, content=""

**Edge Case 2**: nutrition_plan.md file is 100KB exactly → returns 200

**Edge Case 3**: nutrition_plan.md file is 100.1KB → returns 413

**Edge Case 4**: Customer slug is "test@invalid" (special chars) → returns 400

**Error Case 1**: File read permission denied → returns 500

---

## Contract Version History

- **1.0** (2026-09-16): Initial design, nutrition plan retrieval endpoint
