import presetsData from "@openstreetmap/id-tagging-schema/dist/presets.min.json"
import translations from "@openstreetmap/id-tagging-schema/dist/translations/en.min.json"

type Tags = Record<string, string>

interface PresetDefinition {
  tags?: Tags
  addTags?: Tags
  matchScore?: number
  searchable?: boolean
  locationSetID?: string
  geometry?: string[]
  name?: string
}

interface PresetsData {
  [presetId: string]: PresetDefinition
}

interface MatchResult {
  id: string
  preset: PresetDefinition
  score: number
}

type TagIndex = Record<string, Record<string, string[]>>

function buildIndex(presets: PresetsData): TagIndex {
  const index: TagIndex = {}
  for (const [id, preset] of Object.entries(presets)) {
    for (const [key, value] of Object.entries(preset.tags ?? {})) {
      index[key] ??= {}
      index[key][value] ??= []
      index[key][value].push(id)
    }
  }
  return index
}

function matchScore(preset: PresetDefinition, entityTags: Tags): number {
  const tags = preset.tags ?? {}
  const addTags = preset.addTags ?? tags
  const originalScore = preset.matchScore ?? 1
  const seen = new Set<string>()
  let score = 0

  for (const [k, v] of Object.entries(tags)) {
    seen.add(k)
    if (entityTags[k] === v) {
      score += originalScore
    } else if (v === "*" && k in entityTags) {
      score += originalScore / 2
    } else {
      return -1
    }
  }

  for (const [k, v] of Object.entries(addTags)) {
    if (!seen.has(k) && entityTags[k] === v) {
      score += originalScore
    }
  }

  if (preset.searchable === false) {
    score *= 0.999
  }

  return score
}

function isFallback(preset: PresetDefinition): boolean {
  const tagCount = Object.keys(preset.tags ?? {}).length
  return tagCount === 0 || (tagCount === 1 && "area" in (preset.tags ?? {}))
}

const presets = presetsData as PresetsData
const index = buildIndex(presets)

export function matchTags(entityTags: Tags): MatchResult | undefined {
  let bestScore = -1
  let bestMatch: MatchResult | undefined
  const seen = new Set<string>()

  for (const [k, v] of Object.entries(entityTags)) {
    const valueIndex = index[k]
    if (!valueIndex) continue

    const candidates = [...(valueIndex[v] ?? []), ...(valueIndex["*"] ?? [])]

    for (const id of candidates) {
      if (seen.has(id)) continue
      seen.add(id)

      const preset = presets[id]
      const score = matchScore(preset, entityTags)
      if (score === -1) continue

      if (score > bestScore) {
        bestScore = score
        bestMatch = { id, preset, score }
      }
    }
  }

  // addr:* fallback
  if (!bestMatch || isFallback(bestMatch.preset)) {
    for (const k of Object.keys(entityTags)) {
      if (/^addr:/.test(k) && index["addr:*"]?.["*"]) {
        const id = index["addr:*"]["*"][0]
        return { id, preset: presets[id], score: 0 }
      }
    }
  }

  return bestMatch
}

export function getPresetName(tags: Tags): string {
  const match = matchTags(tags)
  if (!match?.id) {
    return "Unknown"
  }

  const translation = (translations as any).en.presets.presets[match.id]
  return translation?.name ?? match.id
}
