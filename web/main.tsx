/**
 * Web entry point.
 *
 * 1. Inject web API compatibility layer (all window.* interfaces).
 * 2. Load the shared renderer bootstrap (React root, contexts, routing).
 *
 * This MUST be the first script — web-api.ts establishes the APIs that
 * the renderer code expects via window.api / window.maven / etc.
 */
import { injectWebAPI } from './api/web-api'

injectWebAPI()

// Now bootstrap the shared renderer
import('../src/renderer/src/main')
