/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const settings = app.settings()
  // Allow batched record creation so large campaigns can be queued quickly.
  settings.batch.enabled = true
  settings.batch.maxRequests = 1000
  settings.batch.timeout = 60
  app.save(settings)
}, (app) => {
  const settings = app.settings()
  settings.batch.enabled = false
  app.save(settings)
})
