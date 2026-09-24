/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2153001328")

  // Per-installation ID the app generates once and persists, so the same
  // API key scanned by multiple phones doesn't make them overwrite each
  // other's device row (previously matched only by sim_slot/subscription_id).
  collection.fields.addAt(14, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_device_device_id",
    "max": 0,
    "min": 0,
    "name": "device_id",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2153001328")
  collection.fields.removeById("text_device_device_id")
  return app.save(collection)
})
