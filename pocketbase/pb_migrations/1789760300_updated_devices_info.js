/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2153001328")

  // Phone model, e.g. "Galaxy S25 Ultra" / "SM-S938B"
  collection.fields.addAt(9, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_device_model",
    "max": 0,
    "min": 0,
    "name": "model",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // Android version, e.g. "Android 15 (API 35)"
  collection.fields.addAt(10, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_device_android",
    "max": 0,
    "min": 0,
    "name": "android",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // Manufacturer, e.g. "samsung"
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_device_maker",
    "max": 0,
    "min": 0,
    "name": "manufacturer",
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
  collection.fields.removeById("text_device_model")
  collection.fields.removeById("text_device_android")
  collection.fields.removeById("text_device_maker")
  return app.save(collection)
})
