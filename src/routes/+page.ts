import { transitData } from "$lib/transit/data-provider"
import type { PageLoad } from "./$types"

export const load: PageLoad = async () => {
  return {
    routes: transitData.getRoutes(),
  }
}
