/**
 * The project configurator stays hidden until it is switched on: read at runtime so one image fits every
 * environment. While off, its page answers 404 and no entry point is drawn. The API has the same flag.
 */
export function projectConfiguratorEnabled(): boolean {
  return process.env.PROJECT_CONFIGURATOR_ENABLED === "true";
}
