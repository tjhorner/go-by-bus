import type { BBox, FeatureCollection, Point } from "geojson"
import type { Component } from "svelte"
import { Balloon, Binoculars, Handbag, MapPin, TreePalm, Utensils } from "@lucide/svelte"

export enum PoiCategory {
  Food = "food",
  Shopping = "shopping",
  Entertainment = "entertainment",
  Leisure = "leisure",
  Tourism = "tourism",
  Other = "other",
}

export const poiCategoryIcons: Record<PoiCategory, Component> = {
  [PoiCategory.Food]: Utensils,
  [PoiCategory.Shopping]: Handbag,
  [PoiCategory.Entertainment]: Balloon,
  [PoiCategory.Leisure]: TreePalm,
  [PoiCategory.Tourism]: Binoculars,
  [PoiCategory.Other]: MapPin,
}

export interface PointOfInterestProperties {
  name: string
  category: PoiCategory
  subcategory?: string
  description?: string
  address?: string
  urls?: string[]
  phone?: string
  distanceFromNearestStop?: number
}

export interface PoiProvider {
  getPois(bbox: BBox): Promise<FeatureCollection<Point, PointOfInterestProperties>>
}
